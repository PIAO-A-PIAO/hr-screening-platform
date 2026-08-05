# Architecture

Milestone 0 establishes three separate runtime boundaries:

1. `apps/web` — Next.js internal web shell
2. `apps/api` — NestJS API shell and operational health endpoints
3. `packages/database` — Prisma configuration and reviewed migrations

PostgreSQL is the relational database. `var/private-storage` represents private
file storage locally; it is checked for read/write access but is not publicly
served and has no upload endpoint yet.

The API is a modular monolith. Recruitment modules will be added one at a time
after their ownership, permissions, contracts, and data relationships are
designed. The clean baseline contains no recruitment-domain tables.
