# Office 365 Integration - Quick Start

Connect your Office 365 organization to ChangeOrderino in 3 easy steps.

## Quick Overview

After setup:
- ✅ All O365 users can sign in and create TNM tickets
- ✅ You manually assign admin/manager roles to trusted users
- ✅ Single sign-on with your existing Microsoft accounts

## Step 1: Create Azure AD App (10 minutes)

1. Go to https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **+ New registration**
4. Fill in:
   - Name: `ChangeOrderino`
   - Account type: "Accounts in this organizational directory only"
   - Redirect URI: `https://auth-co.treconstruction.net/realms/changeorderino/broker/azuread/endpoint`
5. After creation, copy these values:
   - **Application (client) ID**
   - **Directory (tenant) ID**
6. Go to **Certificates & secrets** → **+ New client secret**
7. Copy the **secret value** immediately
8. Go to **API permissions** → **+ Add permission** → **Microsoft Graph** → **Delegated permissions**
9. Add: `openid`, `profile`, `email`, `User.Read`
10. Click **Grant admin consent**

## Step 2: Run Automated Setup (2 minutes)

```bash
cd /opt/docker/ChangeOrderino
./scripts/setup-azure-ad.sh
```

When prompted, enter:
- Your Azure Tenant ID
- Your Azure Client ID
- Your Azure Client Secret

The script will:
- Configure Keycloak with Azure AD
- Set up attribute mapping
- Configure default "foreman" role for all new users

## Step 3: Assign Admin Roles (1 minute per user)

After users sign in for the first time, assign roles to admins/managers:

```bash
# Make someone an admin (full access)
./scripts/assign-role.sh admin user@yourcompany.com

# Make someone a project manager
./scripts/assign-role.sh project_manager user@yourcompany.com

# Make someone office staff
./scripts/assign-role.sh office_staff user@yourcompany.com
```

## Test It Out

1. Go to https://co.treconstruction.net
2. You should see "Sign in with Microsoft Office 365" button
3. Click it to test the integration
4. All O365 users can now sign in!

## Role Permissions Quick Reference

| Role | TNM Tickets | Projects | Settings |
|------|-------------|----------|----------|
| **foreman** (default) | ✅ Create/Edit | ❌ | ❌ |
| **office_staff** | ✅ View all | 📖 View only | ✅ |
| **project_manager** | ✅ Full access | ✅ | 📖 View |
| **admin** | ✅ | ✅ | ✅ |

## Common Commands

```bash
# Assign roles to users
./scripts/assign-role.sh <role> <email>

# Set up default role (already done by setup script)
./scripts/setup-default-role.sh

# View Keycloak logs if issues occur
docker compose logs keycloak
```

## Need Help?

See the full documentation: [docs/AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)
