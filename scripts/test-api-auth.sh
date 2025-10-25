#!/bin/bash

echo "Getting access token..."
TOKEN=$(curl -s -X POST "https://auth-co.treconstruction.net/realms/changeorderino/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=changeorderino-app" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "Testing API with token..."
curl -s -X GET "https://co.treconstruction.net/api/v1/projects/?is_active=true" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✓ API authentication works!' if isinstance(data, list) else data)"
