# Local development

## Prerequisites

- Git
- Node.js 24 (`.nvmrc`)
- npm 10 or newer
- Docker Desktop with Linux containers

## Clean setup — PowerShell

```powershell
git clone <repository-url>
Set-Location internal-video-interview-platform
Copy-Item .env.example .env
npm ci
docker compose up -d postgres
npm run db:generate
npm run db:deploy
npm run db:seed
npm run verify
npm run dev
```

## Clean setup — bash

```bash
git clone <repository-url>
cd internal-video-interview-platform
cp .env.example .env
npm ci
docker compose up -d postgres
npm run db:generate
npm run db:deploy
npm run db:seed
npm run verify
npm run dev
```

## URLs

- Web: `http://localhost:3000`
- API liveness: `http://localhost:4000/api/health/live`
- API readiness: `http://localhost:4000/api/health/ready`
- OpenAPI: `http://localhost:4000/api/docs`
- Seeded candidate: `http://localhost:3000/interview/demo-candidate-token`

Expected readiness:

```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "storage": true
  }
}
```

## Database lifecycle

- `docker compose stop` stops PostgreSQL and preserves the named volume.
- `docker compose down` removes containers and preserves the named volume.
- `docker compose down -v` deletes the local database volume. This is destructive.

Demo seeding is always explicit. Neither `npm run dev` nor Docker API startup runs the seed.
