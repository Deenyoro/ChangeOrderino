#!/bin/bash
set -e

echo "========================================"
echo "Azure AD / Office 365 Integration Setup"
echo "========================================"
echo ""
echo "This script will configure Keycloak to use Azure AD for authentication."
echo ""
echo "Prerequisites:"
echo "  1. You have created an Azure AD App Registration"
echo "  2. You have the Tenant ID, Client ID, and Client Secret"
echo "  3. You have set the redirect URI in Azure AD to:"
echo "     https://auth-co.treconstruction.net/realms/changeorderino/broker/azuread/endpoint"
echo ""
echo "See docs/AZURE_AD_SETUP.md for detailed instructions."
echo ""

# Prompt for Azure AD credentials
read -p "Enter Azure Tenant ID: " AZURE_TENANT_ID
read -p "Enter Azure Client ID: " AZURE_CLIENT_ID
read -sp "Enter Azure Client Secret: " AZURE_CLIENT_SECRET
echo ""
echo ""

if [ -z "$AZURE_TENANT_ID" ] || [ -z "$AZURE_CLIENT_ID" ] || [ -z "$AZURE_CLIENT_SECRET" ]; then
  echo "❌ Error: All fields are required"
  exit 1
fi

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
echo "Step 2: Creating Azure AD identity provider..."

# Create the identity provider
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/identity-provider/instances" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"alias\": \"azuread\",
    \"providerId\": \"microsoft\",
    \"enabled\": true,
    \"updateProfileFirstLoginMode\": \"on\",
    \"trustEmail\": true,
    \"storeToken\": false,
    \"addReadTokenRoleOnCreate\": false,
    \"authenticateByDefault\": false,
    \"linkOnly\": false,
    \"firstBrokerLoginFlowAlias\": \"first broker login\",
    \"config\": {
      \"clientId\": \"$AZURE_CLIENT_ID\",
      \"clientSecret\": \"$AZURE_CLIENT_SECRET\",
      \"tenant\": \"$AZURE_TENANT_ID\",
      \"defaultScope\": \"openid profile email\",
      \"useJwksUrl\": \"true\",
      \"syncMode\": \"IMPORT\",
      \"hideOnLoginPage\": \"false\",
      \"guiOrder\": \"1\",
      \"displayName\": \"Microsoft Office 365\"
    }
  }" > /dev/null 2>&1

RESULT=$?

if [ $RESULT -eq 0 ]; then
  echo "✓ Azure AD identity provider created successfully"
else
  echo "⚠️  Provider may already exist or error occurred"
  echo "   Continuing with mapper configuration..."
fi

echo ""
echo "Step 3: Configuring attribute mappers..."

# Add email mapper
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/identity-provider/instances/azuread/mappers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "email",
    "identityProviderAlias": "azuread",
    "identityProviderMapper": "oidc-user-attribute-idp-mapper",
    "config": {
      "claim": "email",
      "user.attribute": "email",
      "syncMode": "INHERIT"
    }
  }' > /dev/null 2>&1

# Add first name mapper
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/identity-provider/instances/azuread/mappers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "first name",
    "identityProviderAlias": "azuread",
    "identityProviderMapper": "oidc-user-attribute-idp-mapper",
    "config": {
      "claim": "given_name",
      "user.attribute": "firstName",
      "syncMode": "INHERIT"
    }
  }' > /dev/null 2>&1

# Add last name mapper
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/identity-provider/instances/azuread/mappers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "last name",
    "identityProviderAlias": "azuread",
    "identityProviderMapper": "oidc-user-attribute-idp-mapper",
    "config": {
      "claim": "family_name",
      "user.attribute": "lastName",
      "syncMode": "INHERIT"
    }
  }' > /dev/null 2>&1

echo "✓ Attribute mappers configured"

echo ""
echo "Step 4: Setting default role for new users..."

# Create foreman role if it doesn't exist
docker compose exec -T api curl -s -X POST "http://keycloak:8080/admin/realms/changeorderino/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "foreman", "description": "Foreman - Can create TNM tickets"}' > /dev/null 2>&1 || true

# Get the foreman role ID
FOREMAN_ROLE_ID=$(docker compose exec -T api curl -s -X GET "http://keycloak:8080/admin/realms/changeorderino/roles/foreman" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

if [ -n "$FOREMAN_ROLE_ID" ]; then
  # Set foreman as default role for the realm
  docker compose exec -T api curl -s -X PUT "http://keycloak:8080/admin/realms/changeorderino" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "defaultRoles": ["offline_access", "uma_authorization", "foreman"]
    }' > /dev/null 2>&1

  echo "✓ Default role set to 'foreman' (can create TNM tickets)"
else
  echo "⚠️  Could not set default role - you may need to configure this manually"
fi

echo ""
echo "=========================================="
echo "✅ Azure AD Integration Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Test login at: https://co.treconstruction.net"
echo "  2. You should see a 'Sign in with Microsoft Office 365' button"
echo "  3. All O365 users can sign in and create TNM tickets"
echo "  4. Assign admin/manager roles to specific users:"
echo ""
echo "     ./scripts/assign-role.sh admin user@yourcompany.com"
echo "     ./scripts/assign-role.sh project_manager user@yourcompany.com"
echo ""
echo "Redirect URI for Azure AD:"
echo "  https://auth-co.treconstruction.net/realms/changeorderino/broker/azuread/endpoint"
echo ""
