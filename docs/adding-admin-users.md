# Adding Admin Users to ChangeOrderino

## Quick Guide: Making Someone an Admin

### Step 1: Get Keycloak Admin Password
```bash
docker compose exec keycloak env | grep KEYCLOAK_ADMIN_PASSWORD
```
This will show you the admin password (you'll need it in Step 2).

### Step 2: Login to Keycloak Admin CLI
```bash
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user admin \
  --password <PASSWORD_FROM_STEP_1>
```

### Step 3: Find the User's ID
```bash
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh get users \
  -r changeorderino \
  --fields id,email,username | grep -B2 -A2 "user@email.com"
```
Replace `user@email.com` with their actual email. Copy the `id` value.

### Step 4: Add Admin Role
```bash
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh add-roles \
  -r changeorderino \
  --uid <USER_ID_FROM_STEP_3> \
  --rolename admin
```

### Step 5: Verify Admin Role Was Added
```bash
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh get-roles \
  -r changeorderino \
  --uid <USER_ID_FROM_STEP_3>
```
You should see `"name" : "admin"` in the output.

### Step 6: User Logs Out and Back In
Tell the user to:
1. Log out of the app
2. Close their browser completely (clears the JWT token)
3. Log back in
4. They will now see all admin features!

---

## Complete Example

Here's a full example for adding `jennifer.dortmund@treconstruction.net` as admin:

```bash
# 1. Get password
docker compose exec keycloak env | grep KEYCLOAK_ADMIN_PASSWORD
# Output: KEYCLOAK_ADMIN_PASSWORD=2a41938c392384420a7d2465f1c2e5c4

# 2. Login to Keycloak admin
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user admin \
  --password 2a41938c392384420a7d2465f1c2e5c4

# 3. Find Jennifer's user ID
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh get users \
  -r changeorderino \
  --fields id,email,username | grep -B2 -A2 "jennifer.dortmund"
# Output shows: "id" : "13f899fe-b92b-46a4-a472-9d7490475394"

# 4. Add admin role
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh add-roles \
  -r changeorderino \
  --uid 13f899fe-b92b-46a4-a472-9d7490475394 \
  --rolename admin

# 5. Verify
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh get-roles \
  -r changeorderino \
  --uid 13f899fe-b92b-46a4-a472-9d7490475394
# Should see "admin" role listed
```

---

## Current Admin Users

As of October 2025:
- admin@treconstruction.net (System Administrator)
- c392126b_admin@treconstruction.net (Admin User)
- tom.eger@treconstruction.net (Tom Eger)
- jennifer.dortmund@treconstruction.net (Jennifer Dortmund)

---

## Available Roles in Keycloak

The ChangeOrderino realm has these roles:
- **admin** - Full system access (Settings, Users, Projects, TNM Tickets, Email Logs, Audit)
- **project_manager** - Project management access
- **office_staff** - Office administrative access
- **foreman** - Create and manage TNM tickets (DEFAULT for all TRE employees)

---

## Default Behavior

**All TRE employees who log in via Office365 SSO automatically get "foreman" role.**

This is handled by the authentication code in `services/api/app/core/auth.py`:

```python
# Auto-assign default "foreman" role to any authenticated user without specific roles
# This allows all TRE employees to create TNM forms without manual role assignment
if not roles:
    roles = ["foreman"]
```

This means:
- ✅ Anyone from TRE can log in and create TNM tickets immediately
- ✅ No manual setup required for regular users
- ✅ Only admins need to be explicitly assigned the admin role

---

## Troubleshooting

### User still doesn't see admin features after logging back in

1. Make sure they **closed their browser** (not just logged out)
2. Verify the role was added in Keycloak:
   ```bash
   docker compose exec keycloak /opt/keycloak/bin/kcadm.sh get-roles \
     -r changeorderino --uid <USER_ID>
   ```
3. Check the API logs to see what roles are in their token:
   ```bash
   docker compose logs api --tail 50 | grep -i role
   ```

### "Invalid user credentials" when trying to login to Keycloak admin

The admin password may have changed. Check the docker-compose.yml or .env file for the current `KEYCLOAK_ADMIN_PASSWORD`.

### Can't find the user in Keycloak

Make sure the user has logged into the app at least once via Office365. Users are created in Keycloak on their first login.
