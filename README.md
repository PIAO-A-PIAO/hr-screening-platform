# Internal Video Interview Platform

A Milestone 0 foundation and runnable prototype for asynchronous hiring interviews. It uses Next.js, NestJS, PostgreSQL, Prisma, and the browser MediaRecorder API.

> Development and staging are synthetic-data environments. Do not enter real candidate names, email addresses, resumes, or recordings.

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

- Node.js 24 LTS (the included `.nvmrc` selects it)
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

3. Install exact locked dependencies:

   ```bash
   npm ci
   ```

4. Generate the Prisma client and create the database:

   ```bash
   npm run db:generate
   npm run db:deploy
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
npm run verify
```

The command generates Prisma, lints, type-checks, tests, and creates production builds. The same checks run in CI, followed by compiled API and production web startup smoke tests.

## Foundation endpoints

- Liveness: `http://localhost:4000/api/health/live`
- Readiness: `http://localhost:4000/api/health/ready`
- OpenAPI: `http://localhost:4000/api/docs`

Readiness is successful only when PostgreSQL and the configured upload directory are available.

## Company repository and continued development

- [Company GitHub setup](docs/company-github-setup.md): private repository creation, first push, authentication, rulesets, security controls, and developer onboarding.
- [Development guide](docs/development-guide.md): source ownership, full-stack change order, migrations, configuration, and verification.
- [Product scope](docs/product-scope.md): what works now, Hireflix-style parity targets, company-specific features, and production release gates.
- [Milestones](docs/milestones.md): Milestone 0 scope, evidence, and acceptance gate.
- [Environments](docs/environments.md): local, CI, staging, and configuration rules.
- [Local development](docs/local-development.md): clean-machine setup and Windows commands.
- [Troubleshooting](docs/troubleshooting.md): common Docker, Prisma, port, and configuration failures.
- [Data handling](docs/data-handling.md): synthetic-data and secret-handling rules.
- [Contributing](CONTRIBUTING.md): branch, commit, pull request, and definition-of-done rules.
- [Security](SECURITY.md): sensitive-data rules and production blockers.

## Demo users

The API currently resolves an internal identity from `x-demo-user-email` and defaults to `recruiter@demo.local`. This is intentionally isolated in `apps/api/src/auth`, so replacing it with company OIDC does not affect jobs, interviews, candidates, or reviews.

Seeded identities:

- `recruiter@demo.local`
- `reviewer@demo.local`

To view the app as the second reviewer during API testing, send `x-demo-user-email: reviewer@demo.local`.

## Important MVP limitations

This codebase is a full working development application, not yet a production deployment. Before real candidate use, complete the hardening list in `docs/architecture.md`, especially SSO/RBAC, private object storage, hashed invitations, malware scanning, transcription jobs, retention policy, audit logs, monitoring, and backups.

Local media uploads are limited to 250 MB and stored under `var/uploads`. The storage boundary is isolated so it can be replaced with direct multipart S3/R2 uploads later.

## Milestone 0 status

The code portion is complete when `npm run verify` passes. The full milestone remains open until the repository also has a green GitHub Actions run and an HTTPS staging deployment with a successful readiness response.
