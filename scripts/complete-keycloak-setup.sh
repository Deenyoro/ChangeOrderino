#!/bin/bash
set -e

echo "=========================================="
echo "Complete Keycloak Setup"
echo "=========================================="

echo ""
echo "Step 1: Getting admin token..."
TOKEN=$(docker compose exec -T api curl -s -X POST "http://keycloak:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "✓ Got token"

echo ""
echo "Step 2: Creating changeorderino realm..."
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "changeorderino",
    "enabled": true,
    "displayName": "ChangeOrderino",
    "registrationAllowed": false,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": false,
    "bruteForceProtected": true
  }' > /dev/null

echo "✓ Realm created"

echo ""
echo "Step 3: Creating PUBLIC client..."
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "changeorderino-app",
    "name": "ChangeOrderino Application",
    "enabled": true,
    "publicClient": true,
    "redirectUris": ["https://co.treconstruction.net/*"],
    "webOrigins": ["https://co.treconstruction.net"],
    "protocol": "openid-connect",
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "fullScopeAllowed": true
  }' > /dev/null

echo "✓ Client created (public)"

echo ""
echo "Step 4: Creating realm roles..."

docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "admin", "description": "Administrator"}' > /dev/null

docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "project_manager", "description": "Project Manager"}' > /dev/null

docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "office_staff", "description": "Office Staff"}' > /dev/null

docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "foreman", "description": "Foreman"}' > /dev/null

echo "✓ Roles created (admin, project_manager, office_staff, foreman)"

echo ""
echo "Step 5: Configuring client to include roles in token..."
CLIENT_UUID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/clients?clientId=changeorderino-app" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/clients/$CLIENT_UUID/protocol-mappers/models" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "realm roles",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-realm-role-mapper",
    "config": {
      "multivalued": "true",
      "userinfo.token.claim": "true",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "claim.name": "roles",
      "jsonType.label": "String"
    }
  }' > /dev/null

echo "✓ Role mapper configured"

echo ""
echo "Step 6: Creating admin user..."
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@treconstruction.net",
    "emailVerified": true,
    "enabled": true,
    "firstName": "Admin",
    "lastName": "User"
  }' > /dev/null

echo "✓ User created"

echo ""
echo "Step 7: Setting password..."
USER_ID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/users?username=admin" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

docker compose exec -T api curl -s -X PUT "http://keycloak:8080/admin/realms/changeorderino/users/$USER_ID/reset-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "password",
    "value": "admin",
    "temporary": false
  }' > /dev/null

echo "✓ Password set"

echo ""
echo "Step 8: Assigning roles to admin user..."
ADMIN_ROLE=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/admin" \
  -H "Authorization: Bearer $TOKEN")

PROJECT_MANAGER_ROLE=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/project_manager" \
  -H "Authorization: Bearer $TOKEN")

OFFICE_STAFF_ROLE=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/office_staff" \
  -H "Authorization: Bearer $TOKEN")

docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/users/$USER_ID/role-mappings/realm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "[$ADMIN_ROLE, $PROJECT_MANAGER_ROLE, $OFFICE_STAFF_ROLE]" > /dev/null

echo "✓ Roles assigned"

echo ""
echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""
echo "Configuration:"
echo "  • Realm: changeorderino"
echo "  • Client: changeorderino-app (PUBLIC)"
echo "  • User: admin"
echo "  • Password: admin"
echo "  • Roles: admin, project_manager, office_staff"
echo ""
echo "Login at: https://co.treconstruction.net"
echo "=========================================="
