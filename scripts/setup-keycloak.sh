#!/bin/bash
set -e

echo "Getting admin token..."
TOKEN=$(docker compose exec -T api curl -s -X POST "http://keycloak:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "Creating changeorderino realm..."
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
  }'

echo "Realm created!"

echo "Creating changeorderino-app client..."
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "changeorderino-app",
    "name": "ChangeOrderino Application",
    "description": "Main application client",
    "enabled": true,
    "clientAuthenticatorType": "client-secret",
    "redirectUris": ["https://co.treconstruction.net/*"],
    "webOrigins": ["https://co.treconstruction.net"],
    "publicClient": false,
    "protocol": "openid-connect",
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "serviceAccountsEnabled": true,
    "authorizationServicesEnabled": false,
    "fullScopeAllowed": true
  }'

echo "Client created!"

echo "Getting client secret..."
CLIENT_UUID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/clients?clientId=changeorderino-app" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

CLIENT_SECRET=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/clients/$CLIENT_UUID/client-secret" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)['value'])")

echo "Client Secret: $CLIENT_SECRET"

echo "Creating admin user..."
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
  }'

echo "User created!"

# Get user ID
USER_ID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/users?username=admin" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

echo "Setting password for admin user..."
docker compose exec -T api curl -s -X PUT "http://keycloak:8080/admin/realms/changeorderino/users/$USER_ID/reset-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "password",
    "value": "admin",
    "temporary": false
  }'

echo "Password set!"

echo ""
echo "=========================================="
echo "Keycloak Setup Complete!"
echo "=========================================="
echo "Realm: changeorderino"
echo "Client ID: changeorderino-app"
echo "Client Secret: $CLIENT_SECRET"
echo "Admin User: admin"
echo "Admin Password: admin"
echo ""
echo "Next step: Update .env with client secret"
echo "=========================================="

# Write secret to file for easy retrieval
echo "$CLIENT_SECRET" > /tmp/keycloak-client-secret.txt
