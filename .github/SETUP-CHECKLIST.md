# GitHub Actions Setup Checklist

Use this checklist to ensure your CI/CD workflows are properly configured and working.

## Pre-Deployment Checklist

### ✅ Local Testing

- [ ] Frontend lints without errors
  ```bash
  cd services/frontend && npm run lint
  ```

- [ ] Frontend builds successfully
  ```bash
  cd services/frontend && npm run build
  ```

- [ ] Backend syntax is valid
  ```bash
  cd services/api && poetry run python -m py_compile app/main.py
  ```

- [ ] All Docker images build
  ```bash
  docker compose build
  ```

- [ ] Full stack runs locally
  ```bash
  docker compose up -d
  curl http://localhost:3000/health
  curl http://localhost:3000/api/health
  docker compose down
  ```

### ✅ Repository Configuration

- [ ] GitHub Actions is enabled
  - Go to: Settings → Actions → General
  - Enable "Allow all actions and reusable workflows"

- [ ] Workflow permissions configured
  - Go to: Settings → Actions → General → Workflow permissions
  - Select "Read and write permissions"
  - Check "Allow GitHub Actions to create and approve pull requests"

- [ ] GitHub Container Registry enabled
  - Go to: Settings → Packages
  - Ensure packages are enabled

### ✅ Secrets Configuration (For Deployment)

- [ ] DEPLOY_HOST configured
  - Settings → Secrets and variables → Actions → New repository secret
  - Name: `DEPLOY_HOST`
  - Value: Your production server IP or hostname

- [ ] DEPLOY_USER configured
  - Name: `DEPLOY_USER`
  - Value: SSH username (e.g., `root` or `deploy`)

- [ ] DEPLOY_KEY configured
  - Name: `DEPLOY_KEY`
  - Value: Complete SSH private key including headers
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...
  -----END OPENSSH PRIVATE KEY-----
  ```

- [ ] DEPLOY_PORT configured (optional)
  - Name: `DEPLOY_PORT`
  - Value: SSH port (default: 22)

### ✅ Production Server Setup

- [ ] Server is accessible via SSH
  ```bash
  ssh -i /path/to/key user@host -p port
  ```

- [ ] Docker is installed
  ```bash
  docker --version
  docker compose version
  ```

- [ ] Repository is cloned at correct path
  ```bash
  # On server:
  cd /opt/docker/ChangeOrderino
  git status
  ```

- [ ] Environment file is configured
  ```bash
  # On server:
  cd /opt/docker/ChangeOrderino
  test -f .env && echo "✅ .env exists" || echo "❌ .env missing"
  ```

- [ ] Services can start successfully
  ```bash
  # On server:
  docker compose up -d
  docker compose ps
  ```

## Post-Deployment Checklist

### ✅ First Workflow Run

- [ ] Push to trigger CI workflow
  ```bash
  git add .github/ services/frontend/Dockerfile docs/
  git commit -m "Add CI/CD workflows"
  git push origin develop
  ```

- [ ] Check Actions tab
  - Go to: Actions tab in GitHub
  - Verify "CI/CD Pipeline" workflow starts

- [ ] Monitor workflow progress
  - Click on the running workflow
  - Watch each job complete
  - Review logs if any job fails

### ✅ Workflow Validation

- [ ] Frontend Tests pass
  - Linting completes
  - Build succeeds
  - No type errors

- [ ] Backend API Tests pass
  - Syntax check passes
  - Database connection succeeds

- [ ] Docker Build Test passes
  - All 4 services build:
    - api
    - frontend-auth
    - frontend-noauth
    - email-service

- [ ] Integration Test passes
  - Services start successfully
  - Health checks pass
  - All endpoints respond

### ✅ Security Scanning

- [ ] Basic security scan completes
  - Trivy scanning runs
  - No critical vulnerabilities found

- [ ] CodeQL analysis (if available)
  - Python analysis completes
  - JavaScript analysis completes
  - Or gracefully skips if unavailable

### ✅ Image Publishing

- [ ] Build and push workflow tested
  ```bash
  git checkout main
  git merge develop
  git push origin main
  ```

- [ ] Images appear in GHCR
  - Go to: Repository → Packages
  - Verify images are published:
    - changeorderino-api
    - changeorderino-frontend
    - changeorderino-email-service

- [ ] Images can be pulled
  ```bash
  docker pull ghcr.io/YOUR_USERNAME/changeorderino-frontend:latest
  docker pull ghcr.io/YOUR_USERNAME/changeorderino-frontend:latest-noauth
  ```

### ✅ Deployment Workflow

- [ ] Create version tag
  ```bash
  git tag -a v1.0.0 -m "Initial release"
  git push origin v1.0.0
  ```

- [ ] Deployment workflow runs
  - Go to: Actions → Deploy Application
  - Verify it starts automatically

- [ ] Deployment succeeds
  - SSH connection successful
  - Code pulled successfully
  - Services restart
  - Health checks pass

- [ ] Production is accessible
  - Test production URL
  - Verify all services running
  - Check logs for errors

## Branch Protection (Recommended)

### ✅ Configure Main Branch

- [ ] Branch protection enabled
  - Go to: Settings → Branches → Add rule
  - Branch name pattern: `main`

- [ ] Required checks configured
  - Require a pull request before merging
  - Require status checks to pass before merging
  - Required checks:
    - [ ] Frontend Tests
    - [ ] Backend API Tests
    - [ ] Docker Build Test
    - [ ] Integration Test

- [ ] Additional protections
  - [ ] Require branches to be up to date before merging
  - [ ] Require conversation resolution before merging
  - [ ] Do not allow bypassing the above settings

### ✅ Configure Develop Branch

- [ ] Branch protection enabled
  - Branch name pattern: `develop`

- [ ] Basic protections
  - Require a pull request before merging
  - Require status checks to pass before merging

## Monitoring and Maintenance

### ✅ Regular Checks

- [ ] Weekly security scan reviews
  - Check: Actions → Security Scanning
  - Review any vulnerabilities found
  - Update dependencies as needed

- [ ] Monthly dependency updates
  - Review Dependabot PRs (if enabled)
  - Update major versions carefully
  - Test thoroughly after updates

- [ ] Workflow performance monitoring
  - Check CI duration trends
  - Optimize slow jobs
  - Review cache hit rates

### ✅ Troubleshooting Resources

- [ ] Documentation reviewed
  - Read: `.github/workflows/README.md`
  - Read: `docs/CI-CD-SETUP.md`

- [ ] Emergency contacts documented
  - Server admin contact
  - GitHub admin contact
  - On-call rotation (if applicable)

- [ ] Rollback procedure tested
  ```bash
  # On server, if deployment fails:
  git checkout v1.0.0  # previous working tag
  docker compose up -d
  ```

## Success Criteria

All items checked means:
- ✅ CI/CD pipelines are fully operational
- ✅ Security scanning is active
- ✅ Automated deployments work
- ✅ Both auth variants build successfully
- ✅ Production is protected and stable

## Common Issues

### Workflow doesn't start
- Check if GitHub Actions is enabled
- Verify workflow file syntax
- Check branch name matches trigger

### SSH deployment fails
- Verify DEPLOY_* secrets are set correctly
- Test SSH connection manually
- Check server firewall rules
- Verify deployment path exists

### Docker build fails
- Test build locally first
- Check build arguments
- Verify Dockerfile syntax
- Review build logs in Actions

### Health checks timeout
- Increase timeout values
- Check service dependencies
- Verify health check endpoints
- Review container logs

## Getting Help

1. Check workflow logs in Actions tab
2. Review documentation in `.github/workflows/README.md`
3. Test failing step locally
4. Check GitHub Actions documentation
5. Review docker-compose configuration

## Next Steps After Setup

Once all items are checked:

1. **Set up automated dependency updates**
   - Enable Dependabot
   - Configure automatic security updates

2. **Configure notifications**
   - Set up Slack/Discord webhooks
   - Configure email notifications for failures

3. **Document team workflow**
   - Feature branch → develop → main
   - PR requirements
   - Review process

4. **Create release process**
   - Semantic versioning strategy
   - Release notes template
   - Changelog maintenance

---

**Last Updated:** 2025-10-25
**Status:** Ready for use
**Documentation:** See `.github/workflows/README.md` for details
