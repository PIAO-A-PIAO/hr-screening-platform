# Development data handling

Milestone 0 environments are not approved for personal information.

## Prohibited

- real candidate or employee names and email addresses
- resumes, identity documents, phone numbers, addresses, or immigration data
- real interview recordings or transcripts
- company credentials, tokens, private keys, or production database dumps
- `.env` files in Git or project ZIP archives

## Required

- use clearly synthetic seed identities and answers
- keep local uploads under the ignored `var/uploads` directory
- review staged files before each commit
- store staging secrets in the approved hosting secret store
- remove `.git`, `.env`, uploads, logs, and database dumps from shared archives
- treat accidental sensitive-data entry as an incident and notify the repository owners

The current local upload and demo-auth implementations are prototype boundaries. They must be replaced by private object storage, malware scanning, company SSO, server-side authorization, hashed invitation tokens, retention automation, and audit logging before any real-candidate pilot.
