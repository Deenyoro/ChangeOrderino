#!/bin/sh
# Don't exit on error - we want nginx to start even if config injection fails
set +e

echo "🚀 ChangeOrderino Frontend - Starting..."

# Read VERSION from file
VERSION=$(cat /usr/share/nginx/html/VERSION 2>/dev/null || echo "unknown")

# Create runtime configuration file
echo "📝 Generating runtime configuration..."
cat > /usr/share/nginx/html/config.js << EOF
// Runtime configuration - injected at container startup
window.__RUNTIME_CONFIG__ = {
  API_URL: '${VITE_API_URL:-/api}',
  AUTH_ENABLED: '${VITE_AUTH_ENABLED:-false}',
  KEYCLOAK_URL: '${VITE_KEYCLOAK_URL:-}',
  KEYCLOAK_REALM: '${VITE_KEYCLOAK_REALM:-}',
  KEYCLOAK_CLIENT_ID: '${VITE_KEYCLOAK_CLIENT_ID:-}',
  VERSION: '${VERSION}'
};

console.log('✅ Runtime config loaded:', window.__RUNTIME_CONFIG__);
EOF

echo "✅ Runtime configuration created"
echo "   VERSION: ${VERSION}"
echo "   API_URL: ${VITE_API_URL:-/api}"
echo "   AUTH_ENABLED: ${VITE_AUTH_ENABLED:-false}"
echo "   KEYCLOAK_URL: ${VITE_KEYCLOAK_URL:-(not set)}"
echo "   KEYCLOAK_REALM: ${VITE_KEYCLOAK_REALM:-(not set)}"
echo "   KEYCLOAK_CLIENT_ID: ${VITE_KEYCLOAK_CLIENT_ID:-(not set)}"

# Update index.html to include runtime config
if [ -f /usr/share/nginx/html/index.html ]; then
  # Check if config.js is already included
  if ! grep -q "config.js" /usr/share/nginx/html/index.html; then
    echo "📝 Injecting config.js into index.html..."
    # Use awk for Alpine Linux compatibility (more reliable than sed with newlines)
    if awk '/<head>/ {print; print "    <script src=\"/config.js\"></script>"; next} {print}' \
      /usr/share/nginx/html/index.html > /tmp/index.html.tmp; then
      mv /tmp/index.html.tmp /usr/share/nginx/html/index.html
      echo "✅ config.js injected into index.html"
    else
      echo "⚠️  Warning: Could not inject config.js, continuing anyway..."
      rm -f /tmp/index.html.tmp
    fi
  else
    echo "ℹ️  config.js already present in index.html"
  fi
else
  echo "⚠️  Warning: index.html not found, skipping config injection"
fi

echo "🌐 Starting nginx..."
# Re-enable exit on error for nginx execution
set -e
exec "$@"
