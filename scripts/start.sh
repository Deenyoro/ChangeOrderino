#!/bin/bash

set -e

echo "🚀 Starting ChangeOrderino..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration before continuing!"
    echo "   Key settings to configure:"
    echo "   - POSTGRES_PASSWORD"
    echo "   - SMTP_USERNAME and SMTP_PASSWORD (for email)"
    echo "   - Labor rates and OH&P percentages"
    echo ""
    read -p "Press Enter to continue with default development settings, or Ctrl+C to exit and configure..."
fi

# Check if starting with auth
AUTH_PROFILE=""
if grep -q "^AUTH_ENABLED=true" .env 2>/dev/null; then
    echo "🔐 Authentication is ENABLED"
    echo "   Starting with Keycloak..."
    AUTH_PROFILE="--profile auth"
else
    echo "🔓 Authentication is DISABLED (development mode)"
    echo "   Starting without Keycloak..."
fi

echo ""
echo "🐳 Starting Docker containers..."
docker compose $AUTH_PROFILE up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ ChangeOrderino is starting!"
echo ""
echo "📍 Access Points:"
echo "   Frontend:    http://localhost:3000"
echo "   API Docs:    http://localhost:3000/docs"
echo "   MinIO:       http://localhost:9090 (user: minioadmin, pass: minioadmin123)"

if [ -n "$AUTH_PROFILE" ]; then
    echo "   Keycloak:    https://localhost:8443/admin (user: admin, pass: admin)"
fi

echo ""
echo "📝 View logs:"
echo "   docker compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker compose down"
echo ""
