# Product Scope and Feature Completeness

The product is an internal asynchronous interview platform inspired by proven one-way interviewing workflows. It should reproduce useful workflows, not Hireflix branding, copyrighted assets, proprietary source code, or pixel-for-pixel presentation.

There is no fixed development timeline in this document. Work is organized by release gates so the team can improve the application in the order that provides the most value.

## Current working MVP

| Area | Implemented now |
|---|---|
| Jobs | Create jobs, list jobs, open job details |
| Interview builder | Single choice, multiple choice, long text, fill in the blank, and video questions |
| Rich prompts | Text prompts plus image/video prompt URL support |
| Scoring design | Weight per question |
| Invitations | Expiring candidate invitation token and seeded demo link |
| Candidate flow | Answer persistence, timed recording, preparation timer, countdown, warning, automatic stop, retry |
| Media | Browser MediaRecorder upload to a local development adapter |
| Review | Three-panel answer review, video playback, editable rough transcript, notes |
| Ratings | Per-answer 0–5 rating in 0.5 increments |
| Collective score | Average reviewers per question, then weight questions into one candidate score |
| Platform | Next.js, NestJS, PostgreSQL, Prisma, Docker Compose, Swagger, tests, CI |

## Gate A: Complete internal demo

This is the next practical target for demonstrations using synthetic candidates only.

- edit, duplicate, archive, reopen, and search jobs;
- reorder and edit questions safely;
- upload image/video prompts instead of URL-only prompts;
- interview intro, instructions, outro, and preview;
- per-question preparation time, answer time, retakes, and required/optional setting;
- candidate welcome page, consent, device test, and practice recording;
- improved candidate progress and recovery states;
- candidate list with status, collective score, filters, and sorting;
- reviewer playback-speed controls and keyboard navigation;
- clear empty, loading, validation, and failure states;
- responsive candidate experience and accessibility pass.

Exit condition: the three primary journeys—build, answer, review—work reliably with demo data and no manual database work.

## Gate B: Safe company pilot

- company OIDC/SSO;
- Admin, HR/Recruiter, Hiring Manager, and Reviewer roles;
- department and job-level access controls enforced in the API;
- private S3/R2/Azure Blob storage with multipart upload and short-lived playback URLs;
- token hashing, revocation, rotation, expiration, and single-candidate controls;
- background queue and workers for media validation, normalization, thumbnails, and transcription;
- real automatic transcription with status and retry handling;
- resume upload/viewer and malware scanning;
- structured audit events and application/stage history;
- candidate consent, privacy notice, retention, deletion, and legal review;
- rate limits, secure headers, request limits, and abuse monitoring;
- centralized logs, metrics, error reporting, health checks, alerts, and backup restore test;
- staging environment separated from production.

Exit condition: security, privacy, and operations owners approve use with a limited real-candidate pilot.

## Gate C: Hireflix-equivalent workflow coverage

Hireflix's current official product material describes the following workflow groups. These are compatibility targets, not a requirement to copy its design.

### Interview creation and branding

- video and/or text questions;
- custom intro and outro videos;
- per-question thinking time, answer time, and retakes;
- preview before publishing;
- branding themes, logo, colors, company name, white label, and custom domain;
- job/position tags and user-specific position access.

### Candidate invitation and communication

- individual invitations and bulk CSV import;
- shareable application link;
- editable invitation, reminder, completion, and outcome templates;
- scheduled/automatic reminders;
- email delivery and open tracking;
- optional SMS/WhatsApp provider adapters;
- bulk exports;
- configurable internal completion notifications.

### Candidate experience

- no candidate account or application download;
- desktop, tablet, and mobile browser support;
- localization and translated candidate interface;
- resilient upload, refresh recovery, and useful permission/network diagnostics;
- accessible device test and practice flow.

### Collaborative review

- shared review access with scoped expiring links;
- playback speed controls;
- ratings, comments, and structured feedback;
- automatic per-answer transcription;
- secure video download subject to permission and retention policy;
- team members and review assignments.

### Integration and governance

- versioned API and signed webhooks;
- webhooks for invitation, started, submitted, review, and status events;
- ATS adapters or a stable integration API;
- SSO, audit logs, automatic candidate deletion, and access history;
- GDPR/privacy workflows and evidence needed for the company's own compliance program.

## Gate D: Company differentiators

These go beyond a basic one-way-video clone and should be preserved as first-class product features:

- MCQ, multi-select, text, fill-in-the-blank, video, resume, image identification, and mixed-media questions;
- image or video attached to any compatible question;
- weight per question;
- 0–5 ratings with half-star increments on every answer;
- multiple reviewers voting independently;
- weighted collective score visible on the candidate list;
- corrected transcript beside each answer;
- rubric dimensions in addition to the simple star score;
- Invited → In Progress → Submitted → L1 → L2 → L3 → L4 → Offer/Hired/Rejected/On Hold workflow;
- immutable transition history and reviewer recommendations;
- department pipeline, completion, reviewer workload, and CSV reports;
- reusable question libraries and versioned interview templates.

## Recommended implementation order

Do not attempt every item at once. Use this dependency order:

1. stabilize current build/answer/review journeys;
2. add real authentication and authorization;
3. replace local media with private object storage and workers;
4. complete transcription, resume handling, and audit history;
5. add communications, bulk operations, and workflow stages;
6. add analytics, APIs/webhooks, branding, and integrations;
7. complete production operations, privacy evidence, and external security review.

## Product references

- Hireflix official feature list: https://hireflix.com/en/pricing
- Hireflix product overview: https://hireflix.com/en
- Hireflix interview creation guide: https://help.hireflix.com/article/puvypyfhej-creating-a-video-interview
- Hireflix API/ATS guide: https://help.hireflix.com/article/c6l3n1qgrw-integrating-hireflix-in-your-ats

These references are discovery inputs only. Revalidate them before prioritizing parity work because third-party product behavior can change.
