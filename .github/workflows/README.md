# GitHub Actions Workflows Documentation

This directory contains the CI/CD workflows for ChangeOrderino. All workflows are based on industry best practices and adapted from the Tagistry project.

## Workflows Overview

### 1. `ci.yml` - Main CI/CD Pipeline ✅

**Triggers:**
- Push to `master`, `main`, or `develop` branches
- Pull requests to `master`, `main`, or `develop` branches

**Jobs:**

#### Frontend Tests
- Node.js 22 setup with npm caching
- Dependency installation with `npm ci`
- ESLint linting
- TypeScript compilation and Vite build

#### Backend API Tests
- Python 3.13 with Poetry
- PostgreSQL 18 and Redis 8 service containers
- Syntax validation
- Database connection testing
- **Sequential execution:** Only runs if frontend tests pass

#### Docker Build Test
- Tests building all service containers:
  - `api` - Backend FastAPI service
  - `frontend-auth` - Frontend with Keycloak authentication
  - `frontend-noauth` - Frontend without authentication
  - `email-service` - Background email worker
- Uses GitHub Actions cache for faster builds
- **Sequential execution:** Only runs if API tests pass

#### Integration Test
- Full docker-compose stack deployment
- Health check validation for all services
- API endpoint testing
- Frontend availability testing
- **Sequential execution:** Only runs if Docker builds succeed

**Key Features:**
- Fail-fast strategy - stops on first error
- Comprehensive health checks with retry logic (90 seconds)
- Detailed error logging on failure
- Automatic cleanup of resources

---

### 2. `build-and-push.yml` - Docker Image Publishing 🐳

**Triggers:**
- Push to `master` or `main` branches
- Git tags matching `v*` (e.g., v1.0.0)
- Manual workflow dispatch

**Images Built:**

1. **API Service**
   - `ghcr.io/{owner}/changeorderino-api:latest`
   - Python 3.13 FastAPI backend

2. **Frontend with Authentication**
   - `ghcr.io/{owner}/changeorderino-frontend:latest`
   - React + Vite with Keycloak integration
   - Environment variables:
     - `VITE_AUTH_ENABLED=true`
     - `VITE_KEYCLOAK_URL=https://localhost:8443`
     - `VITE_KEYCLOAK_REALM=changeorderino`
     - `VITE_KEYCLOAK_CLIENT_ID=changeorderino-app`

3. **Frontend without Authentication**
   - `ghcr.io/{owner}/changeorderino-frontend:latest-noauth`
   - React + Vite standalone (no Keycloak)
   - Environment variables:
     - `VITE_AUTH_ENABLED=false`

4. **Email Service**
   - `ghcr.io/{owner}/changeorderino-email-service:latest`
   - Python background worker for email notifications

**Features:**
- Multi-platform support (linux/amd64)
- GitHub Actions cache optimization
- Semantic versioning support
- Build summary with quick-start instructions
- Public images (no authentication required to pull)

**Manual Dispatch Options:**
- `push_images`: Choose whether to push to registry (true/false)

---

### 3. `deploy.yml` - Production Deployment 🚀

**Triggers:**
- Git tags matching `v*`
- Manual workflow dispatch

**Environment:** Production

**Deployment Process:**
1. SSH to production server
2. Backup current `.env` file
3. Pull latest code from Git
4. Start services with `docker compose up -d`
5. Health check validation (up to 2 minutes)
6. Display deployment status

**Required GitHub Secrets:**
- `DEPLOY_HOST` - Production server hostname/IP
- `DEPLOY_USER` - SSH username
- `DEPLOY_KEY` - SSH private key
- `DEPLOY_PORT` - SSH port (optional, defaults to 22)

**Server Requirements:**
- Git repository cloned at `/opt/docker/ChangeOrderino`
- Docker and Docker Compose installed
- Services accessible on localhost:3000

---

### 4. `security.yml` - Security Scanning 🔒

**Triggers:**
- Weekly schedule (Mondays at 2 AM UTC)
- Push to `main` or `master` branches
- Pull requests to `main` or `master` branches

**Scans:**

#### Basic Security Scan
- **Trivy vulnerability scanner** - Filesystem scanning for:
  - Known CVEs in dependencies
  - Misconfigurations
  - Security issues
- **Secret detection** - Checks for hardcoded:
  - Passwords
  - API keys
  - Tokens
  - Other sensitive data

#### CodeQL Analysis
- Static code analysis for Python and JavaScript
- Detects:
  - SQL injection vulnerabilities
  - Cross-site scripting (XSS)
  - Command injection
  - Path traversal
  - Other security issues
- **Note:** Requires GitHub Advanced Security for private repositories
- Continues gracefully if unavailable (public repos get it free)

**Non-blocking:** Security scans provide warnings but don't fail builds

---

### 5. `dependency-safety.yml` - Dependency Checks 📦

**Triggers:**
- Pull requests that modify:
  - `services/*/package*.json`
  - `services/*/requirements.txt`
  - `services/*/pyproject.toml`
  - `services/*/poetry.lock`

**Checks:**

#### Frontend Dependencies
- Node.js 22 environment
- `npm audit` for security vulnerabilities
- Only fails on high/critical vulnerabilities
- Low/moderate vulnerabilities are warnings

#### Backend Dependencies
- Python 3.13 with Poetry
- `safety` scanner for Python packages
- Version compatibility checks
- Dependency conflict detection

---

### 6. `merge-group.yml` - Merge Queue 🔄

**Triggers:**
- GitHub merge queue activation

**Purpose:**
Quick validation before merging to protected branches

**Checks:**
- Frontend linting
- Frontend build (includes type checking)

**Why it's faster:**
- Skips backend tests
- Skips Docker builds
- Skips integration tests
- Only validates the most critical frontend changes

---

## Workflow Configuration

### Environment Variables

All workflows use consistent environment variables:

```yaml
REGISTRY: ghcr.io
IMAGE_NAME: ${{ github.repository }}
```

### Build Arguments for Frontend

Both CI and build-and-push workflows use these build arguments:

```dockerfile
VITE_API_URL=/api
VITE_AUTH_ENABLED=true/false
VITE_KEYCLOAK_URL=https://localhost:8443
VITE_KEYCLOAK_REALM=changeorderino
VITE_KEYCLOAK_CLIENT_ID=changeorderino-app
```

### Service Health Checks

All workflows verify services are healthy before proceeding:

- **Frontend (nginx):** `http://localhost:3000/health`
- **API:** `http://localhost:3000/api/health` (through nginx proxy)
- **Database:** `pg_isready` command
- **Redis:** `redis-cli ping` command

---

## Setup Instructions

### 1. Enable GitHub Actions

Ensure GitHub Actions is enabled in your repository settings.

### 2. Configure Secrets

For deployment, add these secrets in GitHub:
1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `DEPLOY_HOST`: Your production server hostname
   - `DEPLOY_USER`: SSH username
   - `DEPLOY_KEY`: SSH private key (entire key including headers)
   - `DEPLOY_PORT`: SSH port (optional)

### 3. Configure GitHub Container Registry

Images are automatically pushed to GitHub Container Registry (GHCR).

**To use the images:**

```bash
# Pull pre-built images
docker pull ghcr.io/YOUR_USERNAME/changeorderino-api:latest
docker pull ghcr.io/YOUR_USERNAME/changeorderino-frontend:latest
docker pull ghcr.io/YOUR_USERNAME/changeorderino-email-service:latest

# Or pull the no-auth frontend
docker pull ghcr.io/YOUR_USERNAME/changeorderino-frontend:latest-noauth
```

### 4. Branch Protection Rules (Recommended)

Configure branch protection for `main`/`master`:
1. Go to Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
4. Select required status checks:
   - `Frontend Tests`
   - `Backend API Tests`
   - `Docker Build Test`
   - `Integration Test`

---

## Troubleshooting

### CI Failures

**Frontend tests fail:**
- Check ESLint configuration
- Verify TypeScript types
- Review build logs for errors

**Backend tests fail:**
- Verify database connection
- Check Poetry dependencies
- Review Python syntax errors

**Integration tests fail:**
- Check Docker Compose configuration
- Verify health check endpoints
- Review service logs in workflow output

### Build and Push Failures

**Authentication errors:**
- Ensure `GITHUB_TOKEN` has package write permissions
- Check repository package settings

**Build failures:**
- Verify Dockerfile syntax
- Check build arguments are correct
- Review build context paths

### Deployment Failures

**SSH connection fails:**
- Verify `DEPLOY_HOST` is correct
- Check `DEPLOY_KEY` is the complete private key
- Ensure `DEPLOY_PORT` matches your server

**Health checks fail:**
- Check service logs on the server
- Verify `.env` configuration
- Ensure all required services are running

---

## Best Practices

1. **Always test locally first:**
   ```bash
   # Run linting
   cd services/frontend && npm run lint

   # Build locally
   docker compose build

   # Test integration
   docker compose up
   ```

2. **Use feature branches:**
   - Create feature branches from `develop`
   - Open PRs to trigger CI checks
   - Merge to `develop` after approval
   - Release to `main` with version tags

3. **Version tags:**
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

4. **Monitor workflow runs:**
   - Check Actions tab in GitHub
   - Review logs for failures
   - Fix issues promptly

5. **Keep dependencies updated:**
   - Review Dependabot PRs
   - Update dependencies regularly
   - Test thoroughly after updates

---

## Workflow Maintenance

### Updating Node.js Version

Update in these files:
- `.github/workflows/ci.yml`
- `.github/workflows/dependency-safety.yml`
- `.github/workflows/merge-group.yml`
- `services/frontend/Dockerfile`

### Updating Python Version

Update in these files:
- `.github/workflows/ci.yml`
- `.github/workflows/dependency-safety.yml`
- `services/api/Dockerfile`
- `services/api/pyproject.toml`

### Adding New Services

1. Update `ci.yml` docker-build matrix
2. Update `build-and-push.yml` matrix
3. Add to docker-compose.yml
4. Update integration test configuration

---

## Performance Optimizations

All workflows use several optimizations:

1. **Caching:**
   - npm packages cached by node-version
   - Poetry dependencies cached
   - Docker layers cached in GitHub Actions
   - Build cache scope per service

2. **Parallel Execution:**
   - Matrix builds run in parallel
   - Multiple services build simultaneously

3. **Fail-fast:**
   - Workflows stop on first failure
   - Saves CI minutes and provides faster feedback

4. **Conditional Execution:**
   - Jobs skip if dependencies fail
   - Security scans don't block builds

---

## Cost Considerations

GitHub Actions provides:
- **Public repos:** Unlimited minutes
- **Private repos:** 2,000 minutes/month (free tier)

**Tips to reduce usage:**
1. Use merge queue for quick checks
2. Cache dependencies aggressively
3. Skip workflows on draft PRs
4. Use `paths` filters to run only when needed

---

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions tab
2. Review this documentation
3. Check the main project README
4. Open an issue on GitHub

---

**Last Updated:** 2025-10-25
**Version:** 1.0.0
