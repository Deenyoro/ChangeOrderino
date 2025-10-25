# Authentication & Role-Based Access Control Architecture
## ChangeOrderino - Production Deployment Guide

**Last Updated:** October 25, 2025
**Status:** ✅ Architecture Ready for Production

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Current Architecture](#current-architecture)
3. [Production Deployment Flow](#production-deployment-flow)
4. [O365/Keycloak Integration](#o365keycloak-integration)
5. [Role-Based Access Control](#role-based-access-control)
6. [Foreman User Journey](#foreman-user-journey)
7. [Configuration Steps](#configuration-steps)
8. [Security Considerations](#security-considerations)

---

## 🎯 Overview

### Vision
Foremen access the app via **`co.treconstruction.net/tnm`**, log in with their **TRE O365 email**, and are immediately taken to the **TNM creation page**. They can ONLY create TNM tickets - no access to dashboards, projects, or other administrative features.

### Key Requirements
- ✅ Short, memorable URL: `co.treconstruction.net/tnm`
- ✅ O365 Single Sign-On (SSO) via Keycloak
- ✅ Foremen can ONLY access `/tnm/create`
- ✅ Default role for all TRE O365 users: **foreman**
- ✅ No navigation to other pages
- ✅ Cloudflare Tunnel for secure access

---

## 🏗️ Current Architecture

### Authentication Stack
```
User Browser
    ↓
Cloudflare Tunnel (co.treconstruction.net)
    ↓
NGINX (Port 3000)
    ↓
React Frontend
    ↓
Keycloak (OAuth2/OIDC)
    ↓
Azure AD / O365
```

### Components

#### 1. **Keycloak Configuration** (`/services/frontend/src/keycloak.ts`)
- ✅ PKCE flow (Proof Key for Code Exchange)
- ✅ Runtime configuration support
- ✅ Token refresh every 60 seconds
- ✅ Reads from `window.__RUNTIME_CONFIG__` or env vars

```typescript
const keycloakConfig = {
  url: 'https://keycloak.treconstruction.net',
  realm: 'tre-construction',
  clientId: 'changeorderino',
};
```

#### 2. **User Roles** (`/services/frontend/src/types/user.ts`)
```typescript
export enum UserRole {
  ADMIN = 'admin',
  FOREMAN = 'foreman',
  PROJECT_MANAGER = 'project_manager',
  OFFICE_STAFF = 'office_staff',
}
```

#### 3. **Role Extraction** (`/services/frontend/src/App.tsx:81-84`)
Roles are extracted from Keycloak's JWT token:
```typescript
const keycloakRoles = userInfo?.realm_access?.roles || [];
const mappedRoles = keycloakRoles
  .filter((role: string) => Object.values(UserRole).includes(role as UserRole))
  .map((role: string) => role as UserRole);
```

#### 4. **Role-Based Navigation** (`/services/frontend/src/components/layout/Sidebar.tsx:14-18`)
```typescript
const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard,
    roles: ['admin', 'office_staff', 'project_manager'] },
  { name: 'Projects', href: '/projects', icon: FolderKanban,
    roles: ['admin', 'office_staff', 'project_manager'] },
  { name: 'TNM Tickets', href: '/tnm-tickets', icon: FileText,
    roles: ['admin', 'office_staff', 'project_manager', 'foreman'] }, // ⚠️ NEEDS FIX
  { name: 'Create TNM', href: '/tnm/create', icon: FileText,
    roles: ['foreman'] }, // ✅ FOREMAN ONLY
  { name: 'Settings', href: '/settings', icon: Settings,
    roles: ['admin'] },
];
```

**⚠️ Issue Identified:** Foremen can currently see "TNM Tickets" (the list view). This should be restricted to admin/office staff only.

#### 5. **Auth Hook** (`/services/frontend/src/hooks/useAuth.ts`)
Provides role checking utilities:
```typescript
const { isForeman, isAdmin, isProjectManager, isOfficeStaff, hasRole } = useAuth();
```

---

## 🚀 Production Deployment Flow

### Phase 1: Current State (Development)
```
AUTH_ENABLED=false
```
- Mock admin user for all requests
- No authentication required
- Direct access to all pages

### Phase 2: Staging (Keycloak + Local Users)
```
AUTH_ENABLED=true
KEYCLOAK_URL=https://keycloak.staging.treconstruction.net
KEYCLOAK_REALM=tre-construction
KEYCLOAK_CLIENT_ID=changeorderino
```
- Keycloak authentication required
- Manual user creation in Keycloak
- Test O365 federation

### Phase 3: Production (Keycloak + O365 SSO)
```
AUTH_ENABLED=true
KEYCLOAK_URL=https://keycloak.treconstruction.net
KEYCLOAK_REALM=tre-construction
KEYCLOAK_CLIENT_ID=changeorderino
CLOUDFLARE_TUNNEL_TOKEN=<token>
```
- O365 SSO fully configured
- Auto-role assignment (foreman as default)
- Cloudflare Tunnel active
- Short URL: `co.treconstruction.net/tnm` → `/tnm/create`

---

## 🔐 O365/Keycloak Integration

### Step 1: Azure AD App Registration

1. **Navigate to Azure Portal:**
   - Go to `portal.azure.com`
   - Navigate to "Azure Active Directory" → "App registrations"

2. **Register New Application:**
   ```
   Name: ChangeOrderino
   Supported account types: Accounts in this organizational directory only (TRE Construction)
   Redirect URI: https://keycloak.treconstruction.net/realms/tre-construction/broker/azuread/endpoint
   ```

3. **Note Application (client) ID:**
   ```
   Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Directory (tenant) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

4. **Create Client Secret:**
   - Go to "Certificates & secrets"
   - New client secret → Note the value (only shown once!)

5. **Configure API Permissions:**
   - Add permissions:
     - `User.Read` (Delegated)
     - `email` (OpenID)
     - `profile` (OpenID)
     - `openid` (OpenID)
   - Grant admin consent

### Step 2: Keycloak Identity Provider Configuration

1. **Add Azure AD Identity Provider:**
   ```
   Keycloak Admin Console
   → Realm: tre-construction
   → Identity Providers
   → Add provider: Microsoft
   ```

2. **Configure Provider:**
   ```
   Alias: azuread
   Display Name: TRE O365 Login
   Client ID: <Application ID from Azure>
   Client Secret: <Client secret from Azure>
   ```

3. **Advanced Settings:**
   ```
   Default Scopes: openid profile email
   Sync Mode: IMPORT
   Trust Email: ON
   ```

4. **Mappers Configuration:**
   - Email: `${ALIAS}.email` → email
   - First Name: `${ALIAS}.given_name` → firstName
   - Last Name: `${ALIAS}.family_name` → lastName
   - Username: `${ALIAS}.preferred_username` → username

### Step 3: Default Role Assignment

1. **Create Foreman Role in Keycloak:**
   ```
   Realm: tre-construction
   → Roles
   → Add Role: "foreman"
   ```

2. **Set as Default Role:**
   ```
   Realm Settings
   → User Registration
   → Default Roles
   → Add "foreman"
   ```

3. **Configure First Login Flow:**
   ```
   Identity Providers → azuread
   → First Login Flow: first broker login
   → Post Login Flow: <create custom flow>
   ```

4. **Custom Post-Login Flow:**
   ```
   Authentication → Flows
   → Create Flow: "auto-assign-foreman"
   → Add Execution: "Set Role Mapper"
   → Configure: Always assign "foreman" role
   ```

### Step 4: Frontend Configuration

Update `.env` or Docker Compose runtime config:
```bash
VITE_AUTH_ENABLED=true
VITE_KEYCLOAK_URL=https://keycloak.treconstruction.net
VITE_KEYCLOAK_REALM=tre-construction
VITE_KEYCLOAK_CLIENT_ID=changeorderino
```

---

## 🔒 Role-Based Access Control

### Role Matrix

| Feature | Admin | Project Manager | Office Staff | Foreman |
|---------|-------|----------------|--------------|---------|
| Dashboard | ✅ | ✅ | ✅ | ❌ |
| View Projects | ✅ | ✅ | ✅ | ❌ |
| Create Projects | ✅ | ✅ | ✅ | ❌ |
| View TNM List | ✅ | ✅ | ✅ | ⚠️ **SHOULD BE ❌** |
| Create TNM | ✅ | ✅ | ✅ | ✅ |
| Edit TNM | ✅ | ✅ | ✅ | ❌ |
| Delete TNM | ✅ | ❌ | ❌ | ❌ |
| Send to GC | ✅ | ✅ | ✅ | ❌ |
| Manual Override | ✅ | ❌ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ |

### Current Implementation

**Navigation Filtering** ✅ WORKING
- Sidebar automatically hides menu items based on user roles
- Foremen only see "Create TNM" link

**Route Protection** ⚠️ NEEDS IMPLEMENTATION
- Currently, ALL routes are accessible if you know the URL
- Need to add route-level protection to prevent direct URL access

---

## 👷 Foreman User Journey

### Step-by-Step Flow

1. **User Access:**
   ```
   Foreman opens browser
   → Navigates to: co.treconstruction.net/tnm
   ```

2. **Cloudflare Tunnel:**
   ```
   Cloudflare Tunnel intercepts request
   → Proxies to NGINX on internal network
   → NGINX serves React app
   ```

3. **React App Initialization:**
   ```
   App.tsx loads
   → Checks AUTH_ENABLED (true)
   → Detects no authentication
   → Redirects to Keycloak login
   ```

4. **Keycloak Login:**
   ```
   Keycloak presents login screen
   → User clicks "Login with TRE O365"
   → Redirects to Azure AD login page
   ```

5. **Azure AD Authentication:**
   ```
   User enters: john.doe@treconstruction.net
   → Azure AD validates credentials
   → Returns OAuth token to Keycloak
   ```

6. **Keycloak Processes Login:**
   ```
   Keycloak receives Azure token
   → Creates local user (if first time)
   → Assigns "foreman" role (default)
   → Issues JWT token
   → Redirects back to React app
   ```

7. **React App Receives Token:**
   ```
   App.tsx extracts user info from JWT
   → Roles: ['foreman']
   → Stores in Redux: { user, roles: ['foreman'] }
   → Checks original path: /tnm
   → Redirects to: /tnm/create
   ```

8. **Create TNM Page Loads:**
   ```
   Foreman sees:
   - Header with logout button
   - Sidebar with ONLY "Create TNM" (no other links)
   - TNM creation form (iPad-optimized)
   ```

9. **Foreman Creates TNM:**
   ```
   Fills out form
   → Submits
   → API validates user has 'foreman' role
   → Creates TNM ticket
   → Success message
   → Form resets for next TNM
   ```

### URL Routing Behavior

```
User Request URL              → Final Destination
-------------------------------------------------------
co.treconstruction.net        → /tnm/create (foreman)
co.treconstruction.net/tnm    → /tnm/create (foreman)
co.treconstruction.net/projects → 403 Forbidden (foreman)
co.treconstruction.net/dashboard → 403 Forbidden (foreman)
```

---

## ⚙️ Configuration Steps

### 1. Database Role Alignment

**Current State:**
- Database enum: `'admin', 'foreman', 'viewer'`
- TypeScript enum: `'admin', 'foreman', 'project_manager', 'office_staff'`

**Action Required:** ⚠️
Update database enum to match TypeScript:
```sql
ALTER TYPE user_role ADD VALUE 'project_manager';
ALTER TYPE user_role ADD VALUE 'office_staff';
```

### 2. Sidebar Navigation Fix

**File:** `/services/frontend/src/components/layout/Sidebar.tsx:16`

**Current:**
```typescript
{ name: 'TNM Tickets', href: '/tnm-tickets', icon: FileText,
  roles: ['admin', 'office_staff', 'project_manager', 'foreman'] },
```

**Change To:**
```typescript
{ name: 'TNM Tickets', href: '/tnm-tickets', icon: FileText,
  roles: ['admin', 'office_staff', 'project_manager'] }, // Removed 'foreman'
```

### 3. Route Protection Component

**Create:** `/services/frontend/src/components/auth/ProtectedRoute.tsx`

Purpose: Wrap routes to enforce role-based access control at route level

### 4. Cloudflare Tunnel Configuration

**Setup:**
```bash
cloudflared tunnel create changeorderino
cloudflared tunnel route dns changeorderino co.treconstruction.net

# Config file: cloudflared-config.yml
tunnel: changeorderino
credentials-file: /path/to/credentials.json

ingress:
  - hostname: co.treconstruction.net
    service: http://localhost:3000
    originRequest:
      noTLSVerify: false
  - service: http_status:404
```

**Environment Variable:**
```bash
CLOUDFLARE_TUNNEL_TOKEN=<token-from-cloudflare>
```

### 5. NGINX Path Rewrite (Optional)

To redirect `/tnm` → `/tnm/create`:

```nginx
location /tnm {
    rewrite ^/tnm$ /tnm/create permanent;
}
```

---

## 🔐 Security Considerations

### 1. Token Management
- ✅ Tokens refreshed every 60 seconds
- ✅ PKCE flow prevents token interception
- ✅ HTTP-only cookies for session storage (Keycloak)

### 2. CORS Configuration
- ⚠️ Ensure CORS origins include production domain:
  ```python
  CORS_ORIGINS=https://co.treconstruction.net,https://keycloak.treconstruction.net
  ```

### 3. Route Protection
- ⚠️ Implement ProtectedRoute component (PENDING)
- ⚠️ Add role checks at API level (already done via `get_current_user`)

### 4. Audit Trail
- ✅ All TNM creations logged with user ID
- ✅ Audit log tracks who created/modified records

---

## 📝 Implementation Checklist

### Immediate (Required for Production)
- [ ] Fix database user_role enum alignment
- [ ] Remove 'foreman' from TNM Tickets navigation
- [ ] Create ProtectedRoute component
- [ ] Wrap all routes with ProtectedRoute
- [ ] Test direct URL access prevention

### Pre-Production
- [ ] Set up Keycloak server
- [ ] Register Azure AD app
- [ ] Configure O365 identity provider in Keycloak
- [ ] Set foreman as default role
- [ ] Test O365 login flow end-to-end

### Production
- [ ] Set up Cloudflare Tunnel
- [ ] Configure DNS: co.treconstruction.net
- [ ] Set AUTH_ENABLED=true
- [ ] Update CORS origins
- [ ] Deploy and test

---

## 🎯 Success Criteria

The implementation is successful when:

1. ✅ Foreman navigates to `co.treconstruction.net/tnm`
2. ✅ Prompted to log in with TRE O365 credentials
3. ✅ After login, lands on `/tnm/create`
4. ✅ Sidebar shows ONLY "Create TNM" link
5. ✅ Cannot access `/projects`, `/dashboard`, or other pages (even via direct URL)
6. ✅ Can successfully create TNM tickets
7. ✅ Can log out and session is cleared
8. ✅ Next login uses SSO (no password prompt if already logged into O365)

---

## 📚 References

- [Keycloak Azure AD Integration](https://www.keycloak.org/docs/latest/server_admin/#_identity_broker_microsoft)
- [Azure AD App Registration](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Cloudflare Tunnel Setup](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [OAuth2 PKCE Flow](https://oauth.net/2/pkce/)

---

**Document Owner:** ChangeOrderino Development Team
**Review Frequency:** Monthly
**Next Review:** November 25, 2025
