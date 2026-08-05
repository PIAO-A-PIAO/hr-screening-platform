# Internal Video Interview Platform

A runnable MVP for asynchronous hiring interviews. It uses Next.js, NestJS, PostgreSQL, Prisma, and the browser MediaRecorder API.

## What works

- Create and list jobs.
- Build interviews with single-choice, multiple-choice, long-text, fill-in-the-blank, and timed video questions.
- Add an image or video URL to any question prompt.
- Assign a weight to every question.
- Publish an interview and create expiring candidate invitation links.
- Record candidate video answers from the browser with preparation time, a three-second countdown, a ten-second warning, automatic stop, upload, and retry.
- Save individual answers and recover them after refresh.
- Review text, choice, and video answers in a three-panel workspace with an editable rough transcript.
- Rate every answer from 0–5 in 0.5 increments, add notes, and calculate a collective weighted score across reviewers.
- Browse the API at `http://localhost:4000/api/docs`.

## Repository structure

```text
apps/
  api/        NestJS API organized by feature module
  web/        Next.js hiring and candidate portals
packages/
  database/   Prisma schema, migrations, and deterministic seed
  contracts/  Shared validation contracts
docs/         Architecture and production hardening notes
var/uploads/  Local-development media storage (gitignored)
```

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Docker Desktop (only PostgreSQL is required in Docker for the standard setup)
- Chrome, Edge, Firefox, or Safari with camera/microphone permission for recording

## Recommended local setup

Run every command from the repository root.

1. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Generate the Prisma client and create the database:

   ```bash
   npm run db:generate
   npx prisma migrate dev --schema packages/database/prisma/schema.prisma --name init
   ```

5. Load the deterministic demo data:

   ```bash
   npm run db:seed
   ```

6. Start the API and frontend together:

   ```bash
   npm run dev
   ```

7. Open:

   - Hiring portal: `http://localhost:3000`
   - Seeded candidate interview: `http://localhost:3000/interview/demo-candidate-token`
   - API documentation: `http://localhost:4000/api/docs`

## Verification commands

```bash
npm test
npm run build
```

## Demo users

The API currently resolves an internal identity from `x-demo-user-email` and defaults to `recruiter@demo.local`. This is intentionally isolated in `apps/api/src/auth`, so replacing it with company OIDC does not affect jobs, interviews, candidates, or reviews.

Seeded identities:

- `recruiter@demo.local`
- `reviewer@demo.local`

To view the app as the second reviewer during API testing, send `x-demo-user-email: reviewer@demo.local`.

## Important MVP limitations

This codebase is a full working development application, not yet a production deployment. Before real candidate use, complete the hardening list in `docs/architecture.md`, especially SSO/RBAC, private object storage, hashed invitations, malware scanning, transcription jobs, retention policy, audit logs, monitoring, and backups.

Local media uploads are limited to 250 MB and stored under `var/uploads`. The storage boundary is isolated so it can be replaced with direct multipart S3/R2 uploads later.
