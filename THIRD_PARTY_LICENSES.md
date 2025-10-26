# Third-Party Licenses

This document lists all third-party open-source software used in the ChangeOrderino project.

## Frontend (React/TypeScript)

### Production Dependencies

| Package | Version | License |
|---------|---------|---------|
| @headlessui/react | ^2.2.9 | MIT |
| @reduxjs/toolkit | ^2.9.2 | MIT |
| @tanstack/react-query | ^5.90.5 | MIT |
| axios | ^1.12.2 | MIT |
| date-fns | ^4.1.0 | MIT |
| keycloak-js | ^26.2.1 | Apache-2.0 |
| lucide-react | ^0.548.0 | ISC |
| react | ^18.3.1 | MIT |
| react-dom | ^18.3.1 | MIT |
| react-hook-form | ^7.65.0 | MIT |
| react-hot-toast | ^2.6.0 | MIT |
| react-redux | ^9.2.0 | MIT |
| react-router-dom | ^7.9.4 | MIT |
| signature_pad | ^5.1.1 | MIT |

### Development Dependencies

| Package | Version | License |
|---------|---------|---------|
| @vitejs/plugin-react | ^4.3.1 | MIT |
| autoprefixer | ^10.4.21 | MIT |
| eslint | ^8.57.0 | MIT |
| postcss | ^8.5.6 | MIT |
| tailwindcss | ^3.4.18 | MIT |
| typescript | ^5.2.2 | Apache-2.0 |
| vite | ^4.5.3 | MIT |

## API Service (Python/FastAPI)

| Package | Version | License |
|---------|---------|---------|
| fastapi | ^0.119.0 | MIT |
| uvicorn | ^0.32.0 | BSD-3-Clause |
| sqlalchemy | ^2.0.0 | MIT |
| asyncpg | ^0.30.0 | Apache-2.0 |
| alembic | ^1.13.0 | MIT |
| pydantic | ^2.10.0 | MIT |
| pydantic-settings | ^2.6.0 | MIT |
| python-multipart | ^0.0.18 | Apache-2.0 |
| python-jose | ^3.3.0 | MIT |
| passlib | ^1.7.4 | BSD |
| python-keycloak | ^4.7.0 | MIT |
| aioredis | ^2.0.1 | MIT |
| redis | ^5.2.0 | MIT |
| rq | ^2.0.0 | BSD-2-Clause |
| minio | ^7.2.0 | Apache-2.0 |
| aiofiles | ^24.1.0 | Apache-2.0 |
| jinja2 | ^3.1.0 | BSD-3-Clause |
| reportlab | ^4.2.0 | BSD |
| weasyprint | ^63.1 | BSD-3-Clause |
| structlog | ^25.0.0 | MIT/Apache-2.0 |
| websockets | ^15.0 | BSD-3-Clause |
| httpx | ^0.28.0 | BSD-3-Clause |
| pillow | ^11.0.0 | HPND |
| python-dateutil | ^2.9.0 | Apache-2.0/BSD-3-Clause |
| email-validator | ^2.2.0 | CC0-1.0 |

## Email Service (Python)

| Package | Version | License |
|---------|---------|---------|
| aiosmtplib | 3.0.2 | MIT |
| jinja2 | 3.1.4 | BSD-3-Clause |
| premailer | 3.10.0 | Python-2.0 |
| cssutils | 2.11.1 | LGPL-3.0 |
| redis | 5.2.0 | MIT |
| rq | 2.0.0 | BSD-2-Clause |
| rq-scheduler | 0.14.0 | MIT |
| sqlalchemy | 2.0.36 | MIT |
| asyncpg | 0.30.0 | Apache-2.0 |
| psycopg2-binary | 2.9.10 | LGPL-3.0 |
| python-dotenv | 1.0.1 | BSD-3-Clause |
| python-dateutil | 2.9.0 | Apache-2.0/BSD-3-Clause |

## Infrastructure (Docker Images)

| Image | Version | License |
|-------|---------|---------|
| postgres | 18-alpine | PostgreSQL License |
| redis | 8-alpine | BSD-3-Clause |
| minio/minio | latest | AGPL-3.0 |
| quay.io/keycloak/keycloak | 26.4 | Apache-2.0 |
| cloudflare/cloudflared | latest | Apache-2.0 |
| nginx | (embedded in frontend) | BSD-2-Clause |

## License Summaries

### MIT License
The MIT License is a permissive free software license. It permits reuse within proprietary software provided all copies include the license terms and copyright notice.

### Apache-2.0
The Apache License 2.0 is a permissive license that also provides an express grant of patent rights from contributors to users.

### BSD Licenses (2-Clause, 3-Clause)
BSD licenses are permissive free software licenses with minimal restrictions on redistribution.

### PostgreSQL License
Similar to the MIT License, the PostgreSQL License is a permissive free software license.

### AGPL-3.0
GNU Affero General Public License v3.0 is a copyleft license requiring source code disclosure for network use. MinIO uses AGPL-3.0.

### LGPL-3.0
GNU Lesser General Public License v3.0 allows linking with proprietary software while keeping the library itself open source.

## Full License Texts

Full license texts for all dependencies can be found in:
- Node.js packages: `node_modules/[package]/LICENSE`
- Python packages: Python package metadata or source repositories

## Compliance Notes

This project uses open-source software in compliance with their respective licenses. All required attributions and copyright notices are maintained within the distributed packages.

For MinIO (AGPL-3.0): ChangeOrderino uses MinIO as a separate service component for object storage. The AGPL license applies to MinIO itself, not to applications that use it as a service over a network API.

## Third-Party Service Integrations

The following external services are integrated but not distributed with this software:

- **Microsoft Azure Active Directory / Entra ID**: OAuth 2.0/OIDC authentication provider
- **Cloudflare Tunnel**: Secure reverse proxy service

These services are governed by their respective terms of service and are not covered by this document.

---

**Last Updated**: October 26, 2025
**Project**: ChangeOrderino v1.0.0
