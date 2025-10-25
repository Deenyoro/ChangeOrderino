#!/bin/bash
set -e

echo "=========================================="
echo "Setting Default Role for New Users"
echo "=========================================="
echo ""
echo "This script configures Keycloak to automatically assign the 'foreman' role"
echo "to all new users. Foreman role allows creating TNM tickets only."
echo ""

echo "Step 1: Getting Keycloak admin token..."

# Get admin password from .env file
ADMIN_PASSWORD=$(grep "^KEYCLOAK_ADMIN_PASSWORD=" .env | cut -d '=' -f2)

TOKEN=$(docker compose exec -T api curl -s -X POST "http://keycloak:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=$ADMIN_PASSWORD&grant_type=password&client_id=admin-cli" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get admin token"
  exit 1
fi

echo "✓ Admin token obtained"

echo ""
echo "Step 2: Creating foreman role if it doesn't exist..."

# Create foreman role
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "foreman",
    "description": "Foreman - Can create and manage TNM tickets"
  }' > /dev/null 2>&1 || echo "   (Role may already exist)"

echo "✓ Foreman role ready"

echo ""
echo "Step 3: Adding foreman to default roles..."

# Add foreman to the default-roles-changeorderino composite role
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh add-roles \
  -r changeorderino \
  --rname default-roles-changeorderino \
  --rolename foreman 2>&1 || echo "   (Role may already be in default roles)"

echo "✓ Default roles updated"

echo ""
echo "=========================================="
echo "✅ Default Role Configuration Complete!"
echo "=========================================="
echo ""
echo "All new users will automatically receive:"
echo "  - foreman role (can create TNM tickets)"
echo ""
echo "To grant admin/manager access to specific users:"
echo "  ./scripts/assign-role.sh admin user@yourcompany.com"
echo "  ./scripts/assign-role.sh project_manager user@yourcompany.com"
echo ""
