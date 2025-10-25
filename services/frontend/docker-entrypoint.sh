#!/bin/sh
set -e

echo "🚀 ChangeOrderino Frontend - Starting..."

# Create runtime configuration file
echo "📝 Generating runtime configuration..."
cat > /usr/share/nginx/html/config.js << EOF
// Runtime configuration - injected at container startup
window.__RUNTIME_CONFIG__ = {
  API_URL: '${VITE_API_URL:-/api}',
  AUTH_ENABLED: '${VITE_AUTH_ENABLED:-false}',
  KEYCLOAK_URL: '${VITE_KEYCLOAK_URL:-}',
  KEYCLOAK_REALM: '${VITE_KEYCLOAK_REALM:-}',
  KEYCLOAK_CLIENT_ID: '${VITE_KEYCLOAK_CLIENT_ID:-}'
};

console.log('✅ Runtime config loaded:', window.__RUNTIME_CONFIG__);
EOF

echo "✅ Runtime configuration created"
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
    sed -i 's|<head>|<head>\n    <script src="/config.js"></script>|' /usr/share/nginx/html/index.html
    echo "✅ config.js injected into index.html"
  fi
fi

echo "🌐 Starting nginx..."
exec "$@"
