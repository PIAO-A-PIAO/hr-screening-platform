# DS-HR — Clean Milestone 0

This repository is a fresh technical foundation for Digital Shovel's internal
asynchronous interview platform.

## Deliberately not included

- No positions or jobs
- No interview templates or questions
- No candidates, applications, invitations, or demo tokens
- No recordings, reviews, scores, or L1–L4 workflow
- No fake authentication or seeded business data
- No tables from the old prototype

Milestone 0 contains only the frontend shell, API shell, PostgreSQL connection,
private-storage readiness check, empty baseline migration, automated checks,
Docker configuration, and CI workflow.

## Requirements

- Node.js 24+
- npm 10+
- Docker Desktop

## First run

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d postgres
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

Open:

- Frontend: http://localhost:3000
- API root: http://localhost:4000/api
- Liveness: http://localhost:4000/api/health/live
- Readiness: http://localhost:4000/api/health/ready
- API documentation: http://localhost:4000/api/docs

Expected readiness response:

```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "storage": true
  }
}
```

There is intentionally no `db:seed` command.

## Daily startup

```powershell
docker compose up -d postgres
npm run dev
```

## Verification

```powershell
npm run verify
```

This runs Prisma generation, linting, all workspace type-checks, API tests, and
production builds for the API and frontend.
