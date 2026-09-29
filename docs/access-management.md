# DS-HR access management

This phase introduces Admin and Recruiter identities. Candidates continue using only the existing `/interview/:invitationToken` links.

## Apply locally

1. Generate a distinct secret for each environment: `openssl rand -hex 32`.
2. Set `AUTH_SECRET` in the local `.env` or staging environment. Do not commit it.
3. Run `npm ci`, `npm run db:deploy`, and `npm run verify`.
4. Restart the API and web processes. In Docker Compose, rebuild API and web after deploying the source. Worker code is unchanged but the schema migration must be applied before starting the new API.
5. Visit `/register` once to create the initial admin. Registration closes when an admin exists.
6. From `/admin`, create recruiters and assign departments. An unassigned recruiter has an empty position list and cannot create a position.

Existing recruiter records have no password after migration. An admin can set their passwords in `/admin`, or create new accounts. Existing candidates remain in `Candidate` and keep token-only access.

## Enforcement

- Access cookies are HTTP-only and signed; refresh tokens are stored as hashes, rotated, and revoked on logout.
- The API checks active status and department membership on every protected request.
- Recruiter list pagination is filtered in the database.
- Candidate test and attempt responses omit answer keys and reviewer feedback.
- Legacy development routes under `/tests`, `/users`, and `/questions` are internal; candidate email links remain under `/interview`.

## Before public use

Run a browser test against a migrated staging database with an Admin, a Recruiter assigned to one department, an unassigned Recruiter, and a candidate invitation. Confirm out-of-department reads and writes return 403, the candidate link works without a login cookie, and response JSON contains no `isCorrect`, `answerHint`, or reviewer comments.

## Local email delivery

The local Docker worker reads email settings from `.env`. Set `EMAIL_ENABLED=true` and provide `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` for your mail provider. Alternatively, set a separate `EMAIL_SETTINGS_ENCRYPTION_KEY` with at least 32 random characters and save the SMTP settings on `/email-templates`. Then run `docker compose up -d --build --force-recreate api worker`. Check `docker compose logs --tail=100 worker` for delivery or SMTP errors. Do not paste passwords or secrets in logs or messages.

With email disabled, new queued tasks stay pending and can be sent after enabling the worker. Earlier versions marked skipped tasks as `SENT` even though no message was delivered; those records are not retried automatically. Inspect the candidate's email history before deciding whether to issue a fresh invitation or restore an individual task. Do not bulk reset sent tasks, which could resend messages that were actually delivered.
