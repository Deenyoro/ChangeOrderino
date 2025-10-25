# ChangeOrderino

**Construction Change Order Management System**

ChangeOrderino is a full-stack web application for managing Time & Materials (TNM) tickets and Request for Change Orders (RFCOs) in the construction industry. Built for TRE Construction, it streamlines the workflow from field ticket creation to General Contractor approval.

---

## 🎯 Features

### Core Functionality
- **Project/Job Management** - Track multiple construction projects with custom OH&P percentages
- **TNM Ticket Creation** - Foremen create detailed Time & Materials tickets on iPads in the field
- **Line-Item Detail** - Capture Labor, Materials, Equipment, and Subcontractor costs
- **Automated Calculations** - Apply configurable Overhead & Profit (OH&P) percentages per cost category
- **Admin Review Dashboard** - Office admins review, edit, and approve tickets before sending
- **PDF Generation** - Automatically generate professional RFCO PDFs
- **Email Integration** - Send RFCOs to General Contractors via Office 365 SMTP
- **GC Approval Portal** - Secure, no-login approval links for General Contractors
- **Line-Item Approvals** - GCs can approve/deny individual line items or entire tickets
- **Automatic Reminders** - Scheduled email reminders until GC responds
- **Audit Trail** - Complete history of all changes, sends, and approvals

### Authentication & Security
- **Keycloak SSO** - Centralized authentication with role-based access control
- **Role-Based Permissions** - Admin, Foreman, and Viewer roles
- **Secure Approval Tokens** - Time-limited JWT tokens for GC approval links
- **No-Auth Mode** - Optional development mode without authentication

### iPad-Optimized
- **Touch-Friendly Interface** - Designed for foremen working in the field
- **Digital Signatures** - Capture GC signatures directly on iPad
- **Photo Upload** - Attach photos of signed TNM tickets
- **Offline-Ready** (future) - Work offline and sync when connected

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Redux Toolkit (state management)
- React Query (data fetching)
- Tailwind CSS (styling)
- Axios (HTTP client)
- Keycloak.js (authentication)

**Backend:**
- FastAPI (Python 3.13)
- PostgreSQL 18 (database)
- SQLAlchemy 2.0 (ORM)
- Alembic (migrations)
- Redis 8 (queue & cache)
- MinIO (S3-compatible storage)

**Services:**
- **API** - FastAPI REST API with WebSocket support
- **Email Service** - Background worker for SMTP and reminders
- **Frontend** - Nginx + React SPA
- **Keycloak** - Authentication server (optional)
- **PostgreSQL** - Relational database
- **Redis** - Queue and caching
- **MinIO** - Object storage for attachments

### Database Schema

```
Projects (jobs)
  ├── TNM Tickets (change orders)
  │   ├── Labor Items
  │   ├── Material Items
  │   ├── Equipment Items
  │   ├── Subcontractor Items
  │   ├── Line Item Approvals
  │   └── Assets (photos, signatures)
  ├── Email Log
  └── Audit Log
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Office 365 account with SMTP enabled
- (Optional) Keycloak realm configured

### 1. Clone & Configure

```bash
cd /opt/docker/ChangeOrderino

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

### 2. Key Environment Variables

**Database:**
```bash
POSTGRES_PASSWORD=your_strong_password
```

**Email (Office 365):**
```bash
SMTP_USERNAME=changeorder@treconstruction.net
SMTP_PASSWORD=your_email_password
SMTP_FROM_EMAIL=changeorder@treconstruction.net
```

**Authentication (optional):**
```bash
AUTH_ENABLED=true
KEYCLOAK_ADMIN_PASSWORD=your_keycloak_admin_password
```

**Labor Rates:**
```bash
RATE_PROJECT_MANAGER=91
RATE_SUPERINTENDENT=82
RATE_CARPENTER=75
RATE_LABORER=57
```

**Default OH&P Percentages:**
```bash
DEFAULT_MATERIAL_OHP=15
DEFAULT_LABOR_OHP=20
DEFAULT_EQUIPMENT_OHP=10
DEFAULT_SUBCONTRACTOR_OHP=5
```

### 3. Start Services

**Without Authentication (Development):**
```bash
docker compose up -d
```

**With Keycloak Authentication:**
```bash
docker compose --profile auth up -d
```

### 4. Access the Application

- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:3000/docs
- **MinIO Console:** http://localhost:9090
- **Keycloak Admin:** https://localhost:8443/admin (if auth enabled)

### Using Pre-built Images

Instead of building locally, you can pull pre-built images from GitHub Container Registry:

```bash
# Pull images
docker pull ghcr.io/{owner}/changeorderino-api:latest
docker pull ghcr.io/{owner}/changeorderino-frontend:latest
docker pull ghcr.io/{owner}/changeorderino-email-service:latest

# Or use the no-auth frontend
docker pull ghcr.io/{owner}/changeorderino-frontend:latest-noauth
```

Then update your `docker-compose.yml` to use `image:` instead of `build:` for each service.

---

## 🔄 CI/CD

GitHub Actions workflows handle testing, building, and deployment automatically.

### Workflows

**ci.yml** - Runs on every push and PR:
- Lints and builds frontend
- Tests backend with PostgreSQL/Redis
- Builds Docker images (both auth variants)
- Runs full integration tests

**build-and-push.yml** - Publishes Docker images to GitHub Container Registry:
- Builds on push to main/master or version tags
- Creates images for:
  - `ghcr.io/{owner}/changeorderino-api:latest`
  - `ghcr.io/{owner}/changeorderino-frontend:latest` (with Keycloak)
  - `ghcr.io/{owner}/changeorderino-frontend:latest-noauth` (standalone)
  - `ghcr.io/{owner}/changeorderino-email-service:latest`

**deploy.yml** - Deploys to production via SSH when you push version tags.

**security.yml** - Weekly security scans with Trivy and CodeQL.

**dependency-safety.yml** - Checks for vulnerable dependencies on PRs.

### Setup

Configure secrets in GitHub repo settings for deployment:
```
DEPLOY_HOST - Production server IP
DEPLOY_USER - SSH username
DEPLOY_KEY - SSH private key
DEPLOY_PORT - SSH port (optional)
```

See `.github/workflows/README.md` for complete documentation.

---

## 📋 Workflows

### 1. Office Admin: Create a Project

```
1. Log into dashboard
2. Navigate to Projects → New Project
3. Fill out:
   - Project Name & Number
   - General Contractor Info (email, contact)
   - Project Manager
   - OH&P Percentages (or use defaults)
   - Reminder Settings
4. Save
```

### 2. Foreman: Create TNM Ticket (iPad)

```
1. Log in on iPad
2. Tap "New TNM Ticket"
3. Select Project (auto-fills project number)
4. Enter:
   - Ticket Title & Description
   - Your Name & Email
   - Proposal Date (defaults to today)
5. Add Line Items:
   - Labor: Description, Hours, Type (PM/Super/Carpenter/Laborer)
   - Materials: Description, Qty, Unit, Price
   - Equipment: Description, Qty, Unit, Price
   - Subcontractors: Name, Description, Date, Amount
6. Capture:
   - GC Signature (on iPad)
   - Or upload photo of signed ticket
7. Submit for Review
```

### 3. Office Admin: Review & Send

```
1. Dashboard shows "Pending Review" tickets
2. Open ticket
3. Review all line items
4. Adjust OH&P percentages if needed
5. Verify calculated totals
6. Enter GC email
7. Click "Send RFCO"
   → PDF generated
   → Email sent with approval link
   → Status: "Sent"
```

### 4. General Contractor: Approve/Deny

```
1. GC receives email with:
   - PDF attachment
   - Secure approval link
2. Click link (no login required)
3. Review all line items
4. Options:
   - Approve All
   - Deny All
   - Approve/Deny individual items
   - Add comments
5. Submit response
   → Status updated
   → Approval confirmation email sent to TRE
```

### 5. Automatic Reminders

```
- If no response: Weekly reminders (configurable)
- Max retries: 4 (configurable)
- Tracks all reminder emails in audit log
```

---

## 🔐 Authentication Setup (Keycloak)

### Create Realm

1. Access Keycloak: https://localhost:8443/admin
2. Login: `admin` / `<KEYCLOAK_ADMIN_PASSWORD>`
3. Create realm: `changeorderino`

### Create Client

1. Clients → Create Client
2. Client ID: `changeorderino-app`
3. Client Type: `OpenID Connect`
4. Standard Flow: Enabled
5. Valid Redirect URIs: `http://localhost:3000/*`, `https://localhost:3443/*`
6. Web Origins: `http://localhost:3000`, `https://localhost:3443`
7. Save

### Create Roles

1. Realm Roles → Create:
   - `admin` - Full access (office admins)
   - `foreman` - Create/view tickets
   - `viewer` - Read-only access

### Create Users

1. Users → Add User
2. Username, Email, First/Last Name
3. Credentials → Set Password
4. Role Mapping → Assign role

---

## 📊 API Endpoints

### Projects

```
GET    /api/v1/projects           # List projects
POST   /api/v1/projects           # Create project
GET    /api/v1/projects/{id}      # Get project
PUT    /api/v1/projects/{id}      # Update project
DELETE /api/v1/projects/{id}      # Delete (soft) project
```

### TNM Tickets

```
GET    /api/v1/tnm-tickets                      # List tickets
POST   /api/v1/tnm-tickets                      # Create ticket
GET    /api/v1/tnm-tickets/{id}                 # Get ticket
PUT    /api/v1/tnm-tickets/{id}                 # Update ticket
POST   /api/v1/tnm-tickets/{id}/send            # Send to GC
GET    /api/v1/tnm-tickets/{id}/pdf             # Generate PDF
```

### Approvals (GC, No Auth)

```
GET    /api/v1/approvals/verify/{token}         # Verify approval link
POST   /api/v1/approvals/{token}/submit         # Submit approval
```

### Assets

```
POST   /api/v1/assets/upload                    # Upload file
GET    /api/v1/assets/{id}                      # Get asset
```

---

## 💾 Database

### Manual Access

```bash
# Connect to database
docker compose exec db psql -U changeorderino -d changeorderino

# Common queries
SELECT * FROM projects;
SELECT * FROM tnm_tickets WHERE status = 'pending_review';
SELECT * FROM email_log WHERE tnm_ticket_id = 'xxx';
```

### Migrations

```bash
# Run migrations (auto-runs on API startup)
docker compose exec api alembic upgrade head

# Create new migration
docker compose exec api alembic revision --autogenerate -m "description"
```

---

## 📧 Email Configuration

### Office 365 SMTP

**Method 1: SMTP AUTH (Recommended)**
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=changeorder@treconstruction.net
SMTP_PASSWORD=<app_password_or_oauth>
```

**Requirements:**
- Licensed Office 365 mailbox
- Enable SMTP AUTH (Modern Authentication)
- Generate App Password if MFA enabled

**Method 2: SMTP Relay**
- Configure Exchange Online connector
- Whitelist server IP
- No authentication required

### Email Templates

Located in `/services/email-service/templates/`:
- `rfco_send.html` - Initial RFCO email to GC
- `reminder.html` - Reminder email template
- `approval_confirmation.html` - Confirmation email to TRE

---

## 🧪 Testing

### Run Backend Tests

```bash
docker compose exec api pytest
```

### Manual API Testing

```bash
# Get health status
curl http://localhost:3000/health

# Create project (with auth token)
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Street Renovation",
    "project_number": "2024-001",
    "gc_email": "gc@example.com"
  }'
```

---

## 🐛 Troubleshooting

### Services Not Starting

```bash
# Check logs
docker compose logs -f api
docker compose logs -f db

# Restart services
docker compose restart

# Full reset
docker compose down -v
docker compose up -d
```

### Database Connection Issues

```bash
# Check database health
docker compose exec db pg_isready -U changeorderino

# Recreate database
docker compose down
docker volume rm changeorderino_db-data
docker compose up -d
```

### Email Not Sending

```bash
# Check email service logs
docker compose logs -f email-service

# Test SMTP connection
docker compose exec email-service python -c "
import smtplib
server = smtplib.SMTP('smtp.office365.com', 587)
server.starttls()
server.login('user', 'pass')
print('SMTP OK')
"
```

### Keycloak Issues

```bash
# Reset Keycloak admin password
docker compose exec keycloak /opt/keycloak/bin/kc.sh reset-password --user admin
```

---

## 📁 Project Structure

```
ChangeOrderino/
├── .github/
│   ├── workflows/               # GitHub Actions CI/CD
│   │   ├── ci.yml              # Main CI pipeline
│   │   ├── build-and-push.yml  # Docker image publishing
│   │   ├── deploy.yml          # Production deployment
│   │   ├── security.yml        # Security scanning
│   │   ├── dependency-safety.yml
│   │   ├── merge-group.yml
│   │   └── README.md           # Workflow documentation
│   └── SETUP-CHECKLIST.md      # CI/CD setup guide
│
├── services/
│   ├── api/                      # FastAPI backend
│   │   ├── app/
│   │   │   ├── core/            # Config, database, auth
│   │   │   ├── models/          # SQLAlchemy models
│   │   │   ├── schemas/         # Pydantic schemas
│   │   │   ├── api/v1/          # API routes
│   │   │   ├── services/        # Business logic
│   │   │   └── main.py          # FastAPI app
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   │
│   ├── frontend/                 # React SPA
│   │   ├── src/
│   │   │   ├── api/             # API client
│   │   │   ├── components/      # React components
│   │   │   ├── pages/           # Page components
│   │   │   ├── store/           # Redux store
│   │   │   └── main.tsx
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── email-service/            # Email background worker
│       ├── Dockerfile
│       └── worker.py
│
├── migrations/                   # Database init scripts
│   └── 01-init-db.sql
│
├── nginx/                        # Nginx config
│   └── nginx.conf
│
├── scripts/                      # Utility scripts
│   └── init-multiple-databases.sh
│
├── docs/                        # Documentation
│   └── CI-CD-SETUP.md          # CI/CD details
│
├── docker-compose.yml            # Service orchestration
├── .env.example                  # Environment template
├── LICENSE                       # License file
└── README.md                     # This file
```

---

## 🔮 Roadmap

### Phase 1: MVP (Current)
- ✅ Project & TNM ticket management
- ✅ Line-item detail capture
- ✅ OH&P calculations
- ✅ Basic API & database
- ⏳ Frontend React UI
- ⏳ PDF generation
- ⏳ Email integration
- ⏳ GC approval portal

### Phase 2: Enhancement
- ⬜ iPad-optimized foreman interface
- ⬜ Digital signature capture
- ⬜ Photo uploads
- ⬜ Real-time status updates (WebSocket)
- ⬜ Email reminder scheduler
- ⬜ Advanced reporting

### Phase 3: Advanced
- ⬜ Offline mode (PWA)
- ⬜ Mobile apps (React Native)
- ⬜ Accounting integration (QuickBooks)
- ⬜ Document management
- ⬜ Custom OH&P rules
- ⬜ Multi-company support

---

## 👥 Contributing

### Development Setup

```bash
# Backend
cd services/api
poetry install
poetry shell
uvicorn app.main:app --reload

# Frontend
cd services/frontend
npm install
npm run dev
```

### Code Style

- **Python**: Black formatter, Ruff linter
- **TypeScript**: ESLint, Prettier
- **Commits**: Conventional Commits format

---

## 📄 License

See the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

**Issues:** https://github.com/your-repo/changeorderino/issues
**Email:** support@treconstruction.net
**Documentation:** https://docs.changeorderino.com (coming soon)

---

## 🙏 Acknowledgments

Built with modern tools:
- FastAPI, React, PostgreSQL, Redis, MinIO
- Inspired by Tagistry architecture
- Keycloak for enterprise authentication
- Docker for consistent deployment

**Built for TRE Construction** 🏗️
