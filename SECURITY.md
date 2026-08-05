# Security Policy

This repository contains an internal-development MVP. It must not process real candidate data until the production-readiness gates in [Product Scope](docs/product-scope.md) are complete.

## Reporting a vulnerability

Do not open a public issue containing vulnerability details, credentials, candidate information, recordings, or access tokens. Report the issue through the company's approved private security channel and include:

- affected component and environment;
- reproduction steps;
- expected and observed behavior;
- impact and any known exposure;
- a proposed mitigation, if known.

## Never commit

- `.env` files or credentials;
- production database exports;
- candidate resumes, videos, transcripts, or personal information;
- cloud access keys, OAuth secrets, signing keys, or webhook secrets;
- local files from `var/uploads`.

## Production release blockers

The following are mandatory before real candidate use:

- company SSO and server-side RBAC;
- private object storage with short-lived signed access;
- hashed, revocable, expiring candidate invitation tokens;
- rate limiting and abuse protection;
- immutable audit logging;
- retention/deletion rules and backup/restore tests;
- malware scanning for uploaded documents;
- encryption and secret management;
- dependency, code, container, and infrastructure scanning;
- centralized monitoring and incident-response ownership;
- privacy/legal review for candidate consent and data handling.
