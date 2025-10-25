#!/bin/bash
set -e

echo "Getting admin token..."
TOKEN=$(docker compose exec -T api curl -s -X POST "http://keycloak:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "Getting client UUID..."
CLIENT_UUID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/clients?clientId=changeorderino-app" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

echo "Updating client to public..."
docker compose exec -T api curl -s -X PUT "http://keycloak:8080/admin/realms/changeorderino/clients/$CLIENT_UUID" \
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
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": true,
    "serviceAccountsEnabled": false,
    "authorizationServicesEnabled": false,
    "fullScopeAllowed": true
  }'

echo ""
echo "Client updated to public!"
echo "The frontend should now be able to authenticate."
