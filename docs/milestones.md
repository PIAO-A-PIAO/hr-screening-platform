# Milestones

## Milestone 0 — Foundation

### Outcome

A developer can clone the repository, copy `.env.example`, install with `npm ci`, start PostgreSQL, deploy migrations, and run both applications without undocumented fixes. CI performs the same checks and starts the production builds. The shared staging environment is HTTPS-only and uses synthetic data.

### Included

- npm-workspace monorepo with pinned Node version and committed lockfile
- Next.js web application and NestJS API
- PostgreSQL through Docker Compose and Prisma migrations
- deterministic repository-root `.env` loading
- startup configuration validation with named errors
- public liveness and dependency readiness endpoints
- database and local-storage readiness probes
- consistent API error responses and graceful shutdown
- root lint, type-check, test, build, and verify commands
- CI PostgreSQL service, migrations, production builds, and startup smoke tests
- explicit demo seeding; API and Docker startup never seed automatically
- local, CI, and staging documentation

### Excluded

Milestone 0 does not approve authentication, private media storage, real candidate data, interview versioning, email, transcription, pipeline stages, or production deployment. Existing prototype screens remain demonstration-only until their later milestone replaces the unsafe boundaries.

### Required evidence

- clean-clone acceptance test result
- successful `npm run verify`
- green GitHub Actions run
- HTTPS staging web URL
- successful staging `/api/health/ready` response
- reviewed first migration and environment inventory

### Acceptance gate

- [ ] `npm ci` succeeds on a clean clone
- [ ] `docker compose up -d postgres` reaches healthy
- [ ] `npm run db:generate` succeeds
- [ ] `npm run db:deploy` succeeds
- [ ] `npm run db:seed` is explicit and repeatable
- [ ] `npm run verify` passes
- [ ] compiled API starts and liveness returns HTTP 200
- [ ] readiness returns HTTP 200 with database and storage true
- [ ] production web build starts and returns HTTP 200
- [ ] GitHub Actions is green
- [ ] branch protection requires CI and review
- [ ] HTTPS staging web and API respond
- [ ] staging has a separate managed PostgreSQL database
- [ ] logs and hosting configuration contain no secrets or local URLs
- [ ] only synthetic data is present

### Next milestone

Milestone 1 replaces the prototype domain foundation with positions, interview templates, immutable published interview versions, ordered questions, choices, and file-asset metadata. Do not add further UI breadth before the Milestone 0 gate is closed.
