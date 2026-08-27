# ADR: EC2 Staging HTTPS Setup

## Context

The DS-HR staging environment is deployed on AWS EC2 using Docker Compose:

```text
nginx
├── web:3000
└── api:4000
    └── postgres:5432
```

Originally, Nginx exposed only HTTP on port 80. Browser APIs such as `getUserMedia` require a secure context, so HTTPS is required for features such as camera access.

## Decision

Use DuckDNS to provide a stable hostname, `ds-hr.duckdns.org`, pointing to the EC2 static public IP.

TLS is terminated by the existing Docker Nginx container. A Let's Encrypt certificate is issued using Certbot and mounted into Nginx.

The EC2 Security Group allows inbound traffic on:

```text
80   HTTP
443  HTTPS
```

Communication between Nginx, Web, API, and PostgreSQL continues over the internal Docker network and does not require TLS.

## Staging Docker Compose

The staging environment uses:

```text
docker-compose.staging.yml
```

Environment variables are stored on the EC2 instance at:

```text
/opt/ds-hr/.env.staging
```

Key configuration includes:

```dotenv
POSTGRES_DB=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...

DATABASE_URL=postgresql://...@postgres:5432/...

WEB_ORIGIN=https://ds-hr.duckdns.org
NEXT_PUBLIC_API_URL=https://ds-hr.duckdns.org/api

AWS_REGION=...
S3_BUCKET_NAME=...
```

The staging Compose project name is fixed as:

```text
ds-hr-staging
```

The standard staging deployment command is:

```bash
docker compose \
  --project-name ds-hr-staging \
  --env-file /opt/ds-hr/.env.staging \
  -f docker-compose.staging.yml \
  up -d --remove-orphans
```

This matches the deployment configuration used by GitHub Actions.

## Result

The staging application is available at:

```text
https://ds-hr.duckdns.org
```

Nginx redirects HTTP traffic on port 80 to HTTPS on port 443 and routes requests as follows:

```text
/       → web:3000
/api/   → api:4000
```

The staging application is now served from a secure browser context, allowing browser features such as camera access.

Manual EC2 deployments and GitHub Actions use the same deployment configuration:

```text
project: ds-hr-staging
env: /opt/ds-hr/.env.staging
compose: docker-compose.staging.yml
```

This prevents accidentally creating a separate Docker Compose project or starting staging without the required environment variables.
