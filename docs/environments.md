# Environments

| Environment | Purpose | Data | Configuration |
|---|---|---|---|
| Local | Individual development | Synthetic | Repository-root `.env` |
| CI | Disposable verification | Temporary synthetic | GitHub Actions environment |
| Staging | Shared demonstration and acceptance | Synthetic | Hosting secret store |
| Production | Not part of Milestone 0 | None yet | Must be designed before pilot |

## Variables

| Variable | Used by | Purpose |
|---|---|---|
| `APP_ENV` | API | `local`, `ci`, `staging`, or `production` |
| `NODE_ENV` | Web/API | Runtime mode |
| `DATABASE_URL` | Prisma/API | PostgreSQL connection string; secret outside local development |
| `API_PORT` | API | Listening port |
| `API_URL` | Web server | Server-side API base URL |
| `NEXT_PUBLIC_API_URL` | Browser | Public API base URL; never put secrets here |
| `WEB_ORIGIN` | API | Allowed browser origin; comma-separated when necessary |
| `UPLOAD_DIR` | API | Prototype local-storage directory |
| `DEMO_USER_EMAIL` | API | Synthetic demo identity only |
| `LOG_LEVEL` | API | `error`, `warn`, `log`, `debug`, or `verbose` |

The API loads the repository-root `.env` even when npm starts it from `apps/api`. Existing process variables win, so CI and hosting configuration are never overwritten by the file. Missing required values stop startup with a `Configuration error` naming the variable.

## Staging contract

- HTTPS for web and API
- managed PostgreSQL separate from local and future production data
- secret values stored by the hosting provider, never committed
- migrations deployed before the new API receives traffic
- API readiness must pass before deployment is accepted
- visible staging label and synthetic data only
- application logs available to both developers

Record provider-specific deployment commands only after the company approves the host and data-residency choice.
