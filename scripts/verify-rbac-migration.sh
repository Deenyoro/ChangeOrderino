#!/bin/bash
# ==========================================
# RBAC Migration Verification Script
# ==========================================
# Tests all components of the RBAC migration

set -e  # Exit on error

echo "=========================================="
echo "RBAC Migration Verification"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

test_info() {
    echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

echo "=========================================="
echo "1. Database Enum Verification"
echo "=========================================="

# Check database enum values
echo "Checking user_role enum values in database..."
ENUM_VALUES=$(docker exec changeorderino-db psql -U changeorderino -d changeorderino -t -c \
    "SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'user_role';")

if [[ $ENUM_VALUES == *"admin"* ]] && \
   [[ $ENUM_VALUES == *"foreman"* ]] && \
   [[ $ENUM_VALUES == *"project_manager"* ]] && \
   [[ $ENUM_VALUES == *"office_staff"* ]]; then
    test_pass "Database enum contains all required roles"
    test_info "Enum values: $ENUM_VALUES"
else
    test_fail "Database enum missing required roles"
    test_info "Found: $ENUM_VALUES"
fi

echo ""
echo "=========================================="
echo "2. API Health Check"
echo "=========================================="

# Test API health endpoint
echo "Testing API health endpoint..."
HEALTH_STATUS=$(curl -s http://localhost:3000/api/health | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)

if [ "$HEALTH_STATUS" == "healthy" ]; then
    test_pass "API is healthy and responding"
else
    test_fail "API health check failed"
fi

echo ""
echo "=========================================="
echo "3. Frontend Accessibility"
echo "=========================================="

# Test frontend
echo "Testing frontend accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)

if [ "$FRONTEND_STATUS" == "200" ]; then
    test_pass "Frontend is accessible"
else
    test_fail "Frontend returned HTTP $FRONTEND_STATUS"
fi

echo ""
echo "=========================================="
echo "4. Database Connection"
echo "=========================================="

# Test database connection
echo "Testing database connection..."
DB_STATUS=$(docker exec changeorderino-db psql -U changeorderino -d changeorderino -t -c "SELECT 1;" 2>/dev/null | tr -d ' \n')

if [ "$DB_STATUS" == "1" ]; then
    test_pass "Database connection successful"
else
    test_fail "Database connection failed"
fi

echo ""
echo "=========================================="
echo "5. Migration Files"
echo "=========================================="

# Check migration files exist
if [ -f "/opt/docker/ChangeOrderino/migrations/01-init-db.sql" ]; then
    test_pass "01-init-db.sql exists"
else
    test_fail "01-init-db.sql not found"
fi

if [ -f "/opt/docker/ChangeOrderino/migrations/02-add-user-roles.sql" ]; then
    test_pass "02-add-user-roles.sql exists"
else
    test_fail "02-add-user-roles.sql not found"
fi

# Check init-db.sql has updated enum
if grep -q "CREATE TYPE user_role AS ENUM ('admin', 'foreman', 'project_manager', 'office_staff', 'viewer')" /opt/docker/ChangeOrderino/migrations/01-init-db.sql; then
    test_pass "01-init-db.sql contains updated user_role enum"
else
    test_fail "01-init-db.sql enum definition not updated"
fi

echo ""
echo "=========================================="
echo "6. Container Health Status"
echo "=========================================="

# Check all containers are healthy
CONTAINERS=("changeorderino-db" "changeorderino-api" "changeorderino-frontend" "changeorderino-redis" "changeorderino-minio")

for container in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")

    if [ "$STATUS" == "healthy" ]; then
        test_pass "$container is healthy"
    elif [ "$STATUS" == "not_found" ]; then
        test_fail "$container not found"
    else
        test_fail "$container status: $STATUS"
    fi
done

echo ""
echo "=========================================="
echo "7. User Roles in Database"
echo "=========================================="

# Check users table
echo "Checking users table for role column..."
USER_COUNT=$(docker exec changeorderino-db psql -U changeorderino -d changeorderino -t -c \
    "SELECT COUNT(*) FROM users WHERE role IN ('admin', 'foreman', 'project_manager', 'office_staff', 'viewer');" | tr -d ' \n')

test_info "Found $USER_COUNT users with valid roles"

if [ "$USER_COUNT" -ge "1" ]; then
    test_pass "Users table has valid role values"
else
    test_fail "No users found with valid roles"
fi

echo ""
echo "=========================================="
echo "8. API Endpoints Test"
echo "=========================================="

# Test projects endpoint
echo "Testing /api/v1/projects/ endpoint..."
PROJECTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/projects/)

if [ "$PROJECTS_STATUS" == "200" ]; then
    test_pass "Projects endpoint returns 200 OK"
else
    test_fail "Projects endpoint returned HTTP $PROJECTS_STATUS"
fi

# Test TNM tickets endpoint
echo "Testing /api/v1/tnm-tickets/ endpoint..."
TNM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/tnm-tickets/)

if [ "$TNM_STATUS" == "200" ]; then
    test_pass "TNM tickets endpoint returns 200 OK"
else
    test_fail "TNM tickets endpoint returned HTTP $TNM_STATUS"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✅ ALL TESTS PASSED!"
    echo "RBAC Migration: COMPLETE"
    echo "Production Ready: YES"
    echo "==========================================${NC}"
    exit 0
else
    echo -e "${RED}=========================================="
    echo "❌ SOME TESTS FAILED"
    echo "Please review failed tests above"
    echo "==========================================${NC}"
    exit 1
fi
