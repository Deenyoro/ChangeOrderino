# Office 365 / Azure AD Integration with Keycloak

This guide will help you connect your Office 365 organization to ChangeOrderino using Azure AD as an identity provider.

## Overview

After setup:
- **All O365 users** in your organization can sign in and create TNM tickets
- **Only designated admins/managers** can access projects, settings, and other features
- You manually assign admin/manager roles to specific users in Keycloak

## Part 1: Create Azure AD App Registration

### Step 1: Access Azure Portal

1. Go to https://portal.azure.com
2. Sign in with your O365 admin account
3. Navigate to **Azure Active Directory** (or **Microsoft Entra ID**)

### Step 2: Create App Registration

1. Click **App registrations** in the left menu
2. Click **+ New registration**
3. Fill in the form:
   - **Name**: `ChangeOrderino`
   - **Supported account types**: Select "Accounts in this organizational directory only"
   - **Redirect URI**:
     - Type: `Web`
     - URI: `https://auth-co.treconstruction.net/realms/changeorderino/broker/azuread/endpoint`
4. Click **Register**

### Step 3: Get Application (Client) ID

1. After registration, you'll see the **Overview** page
2. Copy the **Application (client) ID** - you'll need this later
3. Copy the **Directory (tenant) ID** - you'll need this too

### Step 4: Create Client Secret

1. Click **Certificates & secrets** in the left menu
2. Click **+ New client secret**
3. Add a description: `ChangeOrderino Secret`
4. Set expiration: `24 months` (or as per your policy)
5. Click **Add**
6. **IMPORTANT**: Copy the secret **Value** immediately - you can't see it again!

### Step 5: Configure API Permissions

1. Click **API permissions** in the left menu
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
6. Click **Add permissions**
7. Click **Grant admin consent for [Your Organization]** (requires admin)

### Step 6: Save Your Credentials

You now have three values:
- **Tenant ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Client ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Client Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

Keep these secure - you'll need them for Part 2.

## Part 2: Configure Keycloak

### Option A: Automated Setup (Recommended)

Run the automated setup script:

```bash
cd /opt/docker/ChangeOrderino
./scripts/setup-azure-ad.sh
```

The script will prompt you for:
- Azure Tenant ID
- Azure Client ID
- Azure Client Secret

### Option B: Manual Setup

If you prefer manual setup:

1. Go to https://auth-co.treconstruction.net
2. Sign in as admin
3. Navigate to **changeorderino** realm
4. Click **Identity Providers** in the left menu
5. Select **Microsoft** from the provider list
6. Configure:
   - **Alias**: `azuread`
   - **Display Name**: `Microsoft Office 365`
   - **Client ID**: [Your Azure Client ID]
   - **Client Secret**: [Your Azure Client Secret]
   - **Tenant ID**: [Your Azure Tenant ID]
   - **Default Scopes**: `openid profile email`
7. Save

## Part 3: Assign Admin/Manager Roles

By default, all O365 users who sign in will have the "foreman" role (can create TNM tickets only).

To give someone admin or manager access:

### Using Keycloak Admin UI

1. Go to https://auth-co.treconstruction.net
2. Sign in as admin
3. Navigate to **changeorderino** realm
4. Click **Users** in the left menu
5. Find the user (they must have signed in at least once)
6. Click on their username
7. Go to **Role mappings** tab
8. Click **Assign role**
9. Select roles to assign:
   - `admin` - Full access to everything
   - `project_manager` - Can manage projects and TNM tickets
   - `office_staff` - Can manage settings and view reports
10. Click **Assign**

### Using Script (Faster for Multiple Users)

```bash
# Assign admin role to a user by email
./scripts/assign-role.sh admin user@yourcompany.com

# Assign project_manager role
./scripts/assign-role.sh project_manager user@yourcompany.com
```

## Part 4: Test the Integration

1. Open https://co.treconstruction.net
2. You should see a "Sign in with Microsoft Office 365" button
3. Click it to test Azure AD login
4. First-time users will be asked to consent to the app
5. After successful login, they'll have access to create TNM tickets

## Role Permissions

| Role | TNM Tickets | Projects | Settings | Reports |
|------|-------------|----------|----------|---------|
| foreman (default) | Create/Edit own | ❌ | ❌ | ❌ |
| office_staff | View all | View only | ✅ | ✅ |
| project_manager | Full access | Full access | View only | ✅ |
| admin | Full access | Full access | ✅ | ✅ |

## Troubleshooting

### "Invalid redirect URI" error

Make sure the redirect URI in Azure AD exactly matches:
```
https://auth-co.treconstruction.net/realms/changeorderino/broker/azuread/endpoint
```

### Users can't sign in

1. Check that admin consent was granted for API permissions
2. Verify the Client Secret hasn't expired
3. Check Keycloak logs: `docker compose logs keycloak`

### Users have no permissions

Make sure the "foreman" role is set as the default role in Keycloak:
```bash
./scripts/setup-default-role.sh
```

## Security Notes

- Client secrets expire - set a calendar reminder to renew before expiration
- Only grant admin/manager roles to trusted users
- Regularly audit user roles in Keycloak
- Consider enabling MFA in Azure AD for additional security
