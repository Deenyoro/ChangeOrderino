#!/bin/bash
set -e

echo "Getting admin token..."
TOKEN=$(docker compose exec -T api curl -s -X POST "http://keycloak:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "Creating realm roles..."

# Create admin role
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "admin",
    "description": "Administrator role"
  }'
echo "Created admin role"

# Create project_manager role
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "project_manager",
    "description": "Project Manager role"
  }'
echo "Created project_manager role"

# Create office_staff role
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "office_staff",
    "description": "Office Staff role"
  }'
echo "Created office_staff role"

# Create foreman role
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "foreman",
    "description": "Foreman role"
  }'
echo "Created foreman role"

echo "Getting user ID..."
USER_ID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/users?username=admin" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

echo "Getting role IDs..."
ADMIN_ROLE=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/admin" \
  -H "Authorization: Bearer $TOKEN")

PROJECT_MANAGER_ROLE=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/project_manager" \
  -H "Authorization: Bearer $TOKEN")

OFFICE_STAFF_ROLE=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/office_staff" \
  -H "Authorization: Bearer $TOKEN")

echo "Assigning roles to admin user..."
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/users/$USER_ID/role-mappings/realm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "[$ADMIN_ROLE, $PROJECT_MANAGER_ROLE, $OFFICE_STAFF_ROLE]"

echo ""
echo "=========================================="
echo "Roles created and assigned!"
echo "=========================================="
echo "Roles: admin, project_manager, office_staff, foreman"
echo "Admin user has: admin, project_manager, office_staff"
echo ""
echo "Now configuring client to include roles in token..."
echo "=========================================="

# Get client UUID
CLIENT_UUID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/clients?clientId=changeorderino-app" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

# Create realm roles mapper
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
  }'

echo ""
echo "Client mapper configured!"
echo "Roles will now be included in JWT tokens."
echo ""
echo "Log out and log back in to see the changes."
