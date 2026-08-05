# Troubleshooting

## `Configuration error: DATABASE_URL is required`

Copy `.env.example` to `.env` in the repository root. Do not set variables manually in every terminal.

## Readiness reports `database: false`

Run `docker compose ps` and confirm PostgreSQL is healthy. Then run `npm run db:deploy`. Check that port 5432 is not occupied by another PostgreSQL instance.

## Readiness reports `storage: false`

Confirm `UPLOAD_DIR` points to a directory the API process can read and write. For local development, keep `UPLOAD_DIR=./var/uploads`; startup creates it automatically.

## Port 3000, 4000, or 5432 is already in use

Stop the conflicting process or container. If a port must change, update both the relevant port and every URL that references it in `.env` and Docker configuration.

## Prisma client or type errors after installing

Run `npm run db:generate`. A clean `npm ci` followed by this command should be sufficient; do not install undeclared packages manually.

## Web can load but cannot reach the API

Check `API_URL` for server-side requests, `NEXT_PUBLIC_API_URL` for browser requests, and `WEB_ORIGIN` for CORS. Staging values must use HTTPS and must not contain localhost.

## Docker API has no demo records

This is intentional. Run `npm run db:seed` explicitly against the intended synthetic environment. Production-style startup never seeds.
