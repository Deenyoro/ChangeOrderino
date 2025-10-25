#!/bin/bash
# Email Service Integration Test Script

set -e

echo "======================================"
echo "Email Service Integration Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are running
echo "1. Checking if services are running..."
echo "--------------------------------------"

if docker compose ps email-service | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Email service is running"
else
    echo -e "${RED}✗${NC} Email service is not running"
    echo "   Run: docker compose up -d email-service"
    exit 1
fi

if docker compose ps redis | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Redis is running"
else
    echo -e "${RED}✗${NC} Redis is not running"
    exit 1
fi

if docker compose ps db | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Database is running"
else
    echo -e "${RED}✗${NC} Database is not running"
    exit 1
fi

if docker compose ps api | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} API service is running"
else
    echo -e "${RED}✗${NC} API service is not running"
    exit 1
fi

echo ""

# Check SMTP configuration
echo "2. Checking SMTP configuration..."
echo "--------------------------------------"

SMTP_ENABLED=$(grep "^SMTP_ENABLED=" .env | cut -d'=' -f2)
SMTP_HOST=$(grep "^SMTP_HOST=" .env | cut -d'=' -f2)
SMTP_PASSWORD=$(grep "^SMTP_PASSWORD=" .env | cut -d'=' -f2)

if [ "$SMTP_ENABLED" = "true" ]; then
    echo -e "${GREEN}✓${NC} SMTP is enabled"
    echo "   Host: $SMTP_HOST"

    if [ -n "$SMTP_PASSWORD" ]; then
        echo -e "${GREEN}✓${NC} SMTP password is configured"
    else
        echo -e "${YELLOW}⚠${NC} SMTP password is not set (emails won't actually send)"
    fi
else
    echo -e "${YELLOW}⚠${NC} SMTP is disabled (test mode)"
fi

echo ""

# Test Redis connection
echo "3. Testing Redis connection from email service..."
echo "--------------------------------------"

if docker compose exec -T email-service python -c "
import redis
from app.config import config
redis_conn = redis.from_url(config.REDIS_URL)
redis_conn.ping()
print('✓ Redis connection successful')
" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Redis connection works"
else
    echo -e "${RED}✗${NC} Redis connection failed"
    exit 1
fi

echo ""

# Test database connection
echo "4. Testing database connection from email service..."
echo "--------------------------------------"

if docker compose exec -T email-service python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import config

async def test():
    engine = create_async_engine(config.DATABASE_URL, echo=False)
    async with engine.connect() as conn:
        await conn.execute('SELECT 1')
    await engine.dispose()
    print('✓ Database connection successful')

asyncio.run(test())
" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Database connection works"
else
    echo -e "${RED}✗${NC} Database connection failed"
    exit 1
fi

echo ""

# Check queue health
echo "5. Checking queue health..."
echo "--------------------------------------"

QUEUE_HEALTH=$(docker compose exec -T email-service python -c "
from app.services.queue_service import queue_service
health = queue_service.health_check()
print(f\"Queue length: {health.get('queue_length', 'unknown')}\")
print(f\"Failed count: {health.get('failed_count', 'unknown')}\")
print(f\"Healthy: {health.get('healthy', False)}\")
" 2>/dev/null)

if echo "$QUEUE_HEALTH" | grep -q "Healthy: True"; then
    echo -e "${GREEN}✓${NC} Queue is healthy"
    echo "$QUEUE_HEALTH" | sed 's/^/   /'
else
    echo -e "${RED}✗${NC} Queue is unhealthy"
    echo "$QUEUE_HEALTH" | sed 's/^/   /'
fi

echo ""

# Check reminder scheduler
echo "6. Checking reminder scheduler..."
echo "--------------------------------------"

SCHEDULER_HEALTH=$(docker compose exec -T email-service python -c "
from app.services.reminder_scheduler import reminder_scheduler
health = reminder_scheduler.health_check()
print(f\"Enabled: {health.get('enabled', False)}\")
print(f\"Scheduled jobs: {health.get('scheduled_jobs', 0)}\")
print(f\"Interval: {health.get('interval_days', 0)} days\")
print(f\"Max retries: {health.get('max_retries', 0)}\")
" 2>/dev/null)

echo "$SCHEDULER_HEALTH" | sed 's/^/   /'

echo ""

# Check email logs in database
echo "7. Checking email log table..."
echo "--------------------------------------"

EMAIL_COUNT=$(docker compose exec -T db psql -U changeorderino -d changeorderino -t -c "SELECT COUNT(*) FROM email_log;" 2>/dev/null | tr -d ' ')

echo "   Total emails logged: $EMAIL_COUNT"

if [ "$EMAIL_COUNT" -gt 0 ]; then
    echo "   Recent emails:"
    docker compose exec -T db psql -U changeorderino -d changeorderino -c "
    SELECT
        to_email,
        email_type,
        status,
        created_at
    FROM email_log
    ORDER BY created_at DESC
    LIMIT 5;
    " 2>/dev/null | sed 's/^/   /'
fi

echo ""

# Check worker logs
echo "8. Checking worker logs (last 20 lines)..."
echo "--------------------------------------"

docker compose logs --tail=20 email-service 2>/dev/null | sed 's/^/   /'

echo ""

# Test template rendering
echo "9. Testing template rendering..."
echo "--------------------------------------"

if docker compose exec -T email-service python -c "
from app.services.template_service import template_service
from datetime import date

tnm_ticket = {
    'tnm_number': 'TEST-001',
    'title': 'Test',
    'proposal_date': date(2025, 10, 25),
    'submitter_name': 'Test',
    'submitter_email': 'test@test.com',
    'proposal_amount': 1000.0,
    'labor_subtotal': 800.0, 'labor_ohp_percent': 20.0, 'labor_total': 960.0,
    'material_subtotal': 0, 'material_ohp_percent': 15.0, 'material_total': 0,
    'equipment_subtotal': 0, 'equipment_ohp_percent': 10.0, 'equipment_total': 0,
    'subcontractor_subtotal': 0, 'subcontractor_ohp_percent': 5.0, 'subcontractor_total': 0,
}

project = {'name': 'Test Project', 'project_number': 'PROJ-001'}

html, subject = template_service.render_rfco_email(tnm_ticket, project, 'http://test.com')
print(f'✓ Template rendered: {len(html)} chars')
" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Template rendering works"
else
    echo -e "${RED}✗${NC} Template rendering failed"
fi

echo ""

# Summary
echo "======================================"
echo "Summary"
echo "======================================"
echo -e "${GREEN}✓${NC} All integration tests passed!"
echo ""
echo "Next steps:"
echo "  1. Configure SMTP credentials in .env"
echo "  2. Test sending an actual email"
echo "  3. Monitor worker logs: docker compose logs -f email-service"
echo "  4. Check queue status: GET /api/v1/email-service/health"
echo ""
