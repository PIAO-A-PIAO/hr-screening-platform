# Contributing

This repository uses short-lived branches and pull requests into `main`.

## Before starting

1. Read [Company GitHub Setup](docs/company-github-setup.md).
2. Complete the local setup in [Development Guide](docs/development-guide.md).
3. Confirm the change against [Product Scope](docs/product-scope.md).

## Standard workflow

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

Make the change, then run:

```bash
npm test
npm run build
git status
```

Commit only files related to the change:

```bash
git add <paths>
git commit -m "feat: short description"
git push -u origin feature/short-description
```

Open a pull request, complete the checklist, obtain one approval, and merge only after CI passes.

## Branch names

- `feature/...` for new behavior
- `fix/...` for defects
- `docs/...` for documentation
- `chore/...` for tooling and maintenance
- `security/...` for security hardening

## Commit prefixes

Use `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, or `security:`.

## Database changes

Never manually edit an already-applied migration. Update `schema.prisma`, generate a new migration, inspect its SQL, and commit both the schema and migration directory.

```bash
npx prisma migrate dev \
  --schema packages/database/prisma/schema.prisma \
  --name descriptive_change
```

## Definition of done

- Acceptance criteria are met.
- Authorization is enforced server-side where applicable.
- Input validation and failure states are handled.
- Tests cover important business logic.
- Database migrations are safe and reviewed.
- `npm test` and `npm run build` pass.
- Documentation and `.env.example` are updated when configuration changes.
- No credentials, candidate data, recordings, resumes, or local environment files are committed.
