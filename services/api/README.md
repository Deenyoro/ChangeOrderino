# ChangeOrderino API

FastAPI backend service for the ChangeOrderino Construction Change Order Management System.

## Overview

This service provides REST API endpoints for managing construction change orders, projects, users, approvals, and related workflows.

## Technology Stack

- **Framework:** FastAPI 0.119+
- **Database:** PostgreSQL with AsyncPG
- **ORM:** SQLAlchemy 2.0 (async)
- **Migrations:** Alembic
- **Authentication:** Keycloak (optional) with python-keycloak
- **Job Queue:** Redis + RQ
- **File Storage:** MinIO S3-compatible storage
- **PDF Generation:** ReportLab + WeasyPrint
- **Email:** SMTP with Jinja2 templates
- **Logging:** Structlog

## Development

### Prerequisites

- Python 3.13+
- Poetry for dependency management
- PostgreSQL database
- Redis (for job queue)

### Installation

```bash
# Install dependencies
poetry install

# Activate virtual environment
poetry shell

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Testing

```bash
# Run tests
poetry run pytest

# Run tests with coverage
poetry run pytest --cov=app --cov-report=html
```

### Code Quality

```bash
# Format code
poetry run black .

# Lint
poetry run ruff check .

# Type checking
poetry run mypy app/
```

## API Documentation

Once running, interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment Variables

See `.env.example` in project root for all configuration options.

## Project Structure

```
app/
├── api/v1/          # API endpoints
├── core/            # Core configuration
├── models/          # SQLAlchemy models
├── schemas/         # Pydantic schemas
├── services/        # Business logic
└── main.py          # Application entry point
```

## Docker

This service is designed to run in Docker. See the main project `docker-compose.yml` for orchestration.

## License

Proprietary - TRE Construction
