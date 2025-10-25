#!/bin/bash
set -e

# Usage: ./scripts/assign-role.sh <role> <email>
# Example: ./scripts/assign-role.sh admin user@yourcompany.com

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <role> <email>"
  echo ""
  echo "Available roles:"
  echo "  admin           - Full access to everything"
  echo "  project_manager - Manage projects and TNM tickets"
  echo "  office_staff    - Manage settings and view reports"
  echo "  foreman         - Create TNM tickets only (default for all users)"
  echo ""
  echo "Example:"
  echo "  $0 admin user@yourcompany.com"
  exit 1
fi

ROLE_NAME=$1
USER_EMAIL=$2

echo "=========================================="
echo "Assigning role to user"
echo "=========================================="
echo "Role:  $ROLE_NAME"
echo "Email: $USER_EMAIL"
echo ""

# Validate role
case $ROLE_NAME in
  admin|project_manager|office_staff|foreman)
    ;;
  *)
    echo "❌ Error: Invalid role '$ROLE_NAME'"
    echo ""
    echo "Valid roles: admin, project_manager, office_staff, foreman"
    exit 1
    ;;
esac

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
echo "Step 2: Finding user by email..."

# Search for user by email
USER_DATA=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/users?email=$USER_EMAIL&exact=true" \
  -H "Authorization: Bearer $TOKEN")

USER_ID=$(echo "$USER_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['id'] if len(data) > 0 else '')" 2>/dev/null || echo "")

if [ -z "$USER_ID" ]; then
  echo "❌ User not found: $USER_EMAIL"
  echo ""
  echo "Note: The user must have signed in at least once before you can assign roles."
  echo "      Ask them to visit https://co.treconstruction.net and sign in first."
  exit 1
fi

USERNAME=$(echo "$USER_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0].get('username', 'unknown'))")
FIRST_NAME=$(echo "$USER_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0].get('firstName', ''))")
LAST_NAME=$(echo "$USER_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0].get('lastName', ''))")

echo "✓ User found: $FIRST_NAME $LAST_NAME ($USERNAME)"

echo ""
echo "Step 3: Getting role information..."

# Get the role details
ROLE_DATA=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/$ROLE_NAME" \
  -H "Authorization: Bearer $TOKEN")

ROLE_ID=$(echo "$ROLE_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

if [ -z "$ROLE_ID" ]; then
  echo "❌ Role not found: $ROLE_NAME"
  echo "   Run ./scripts/complete-keycloak-setup.sh to create roles"
  exit 1
fi

echo "✓ Role found: $ROLE_NAME"

echo ""
echo "Step 4: Assigning role to user..."

# Assign the role to the user
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/users/$USER_ID/role-mappings/realm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "[
    {
      \"id\": \"$ROLE_ID\",
      \"name\": \"$ROLE_NAME\"
    }
  ]" > /dev/null

echo "✓ Role assigned successfully"

echo ""
echo "=========================================="
echo "✅ Complete!"
echo "=========================================="
echo ""
echo "User: $FIRST_NAME $LAST_NAME ($USER_EMAIL)"
echo "Role: $ROLE_NAME"
echo ""
echo "The user will have their new permissions the next time they sign in."
echo "They may need to sign out and sign back in for changes to take effect."
echo ""
