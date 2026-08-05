# Milestone 0 acceptance

Milestone 0 is complete when all of the following are true:

- A clean checkout installs with `npm ci`.
- PostgreSQL starts and the empty baseline migration deploys.
- `npm run verify` passes.
- The compiled API responds to liveness and readiness checks.
- Readiness verifies PostgreSQL and private storage.
- The production frontend responds and can reach the API.
- GitHub Actions is green.
- HTTPS staging is reachable outside the local network.
- No old prototype features, business tables, demo users, candidate tokens, or
  seeded recruitment data are present.
