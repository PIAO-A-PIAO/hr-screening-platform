# DS-HR Phase 2 — Route and UX Inventory

**Milestone:** P2-M02  
**Product:** DS-HR Video Screening Platform  
**Baseline:** Phase 1 verified at commit `7143ff0`  
**Status:** Design and route definition  

## 1. Purpose

Phase 2 is primarily a UI/UX modernization of the working Phase 1 MVP, with a small number of targeted new features. This document defines the final information architecture, page responsibilities, reusable components, API dependencies, user states, mobile behavior, and migration path before UI implementation begins.

The Phase 1 workflow must remain operational throughout Phase 2:

1. Create a position.
2. Create and attach a screening test.
3. Configure email templates and reminders.
4. Invite a candidate.
5. Open the interview through a secure invitation token.
6. Complete multiple-choice, short-answer, and video questions.
7. Submit the attempt.
8. Review the candidate and update the recruitment stage.

## 2. Scope

### Included

- Final recruiter and candidate route structure.
- Consistent recruiter application shell.
- Dashboard and position-list redesign.
- Candidate pipeline redesign.
- Position configuration and test-builder separation.
- Interview review page.
- Email-management page.
- Candidate welcome, device-check, and interview flows.
- CSV candidate import.
- Automatic timed video recording.
- Loading, empty, error, success, and mobile states.
- Redirect and legacy-route strategy.
- Reuse plan for existing components and APIs.

### Not included in P2-M02

- Implementing the redesigned pages.
- Removing Phase 1 routes.
- Changing database records.
- Replacing working APIs without a confirmed requirement.
- Authentication, login, logout, password reset, or SSO.
- Final brand polish, animation, or advanced reporting.

## 3. Design Principles

1. Preserve working Phase 1 behavior until its replacement passes regression testing.
2. Use real persisted data; do not build completed screens around mock records.
3. Keep recruiter and candidate experiences visually and structurally separate.
4. Use one persistent shell across recruiter and administrator pages.
5. Keep candidate pages focused, distraction-free, and token-authenticated.
6. Reuse working components and API clients where practical.
7. Introduce new backend behavior only when the required UI cannot be supported by existing APIs.
8. Every page must define loading, empty, error, and success feedback.
9. Every interactive page must work on desktop and mobile.
10. Destructive and asynchronous actions must prevent accidental duplicate execution.

## 4. Route Classifications

| Classification | Meaning |
| --- | --- |
| Keep | Route and purpose remain substantially unchanged. |
| Redesign | Route remains, but structure and user experience change. |
| Redirect | Old route forwards to a new canonical route. |
| Development Only | Route remains accessible through `/dev` for diagnostics and testing. |
| Replace | Route remains temporarily and is removed only after its replacement passes regression testing. |
| New | Route does not currently exist. |

## 5. Current Route Inventory

### Recruiter routes

| Current route | Existing responsibility | Phase 2 decision | Final route |
| --- | --- | --- | --- |
| `/` | Recruitment dashboard | Redesign | `/` |
| `/positions` | Position listing | Redesign | `/positions` |
| `/positions/create` | Create a position | Redirect | `/positions/new/edit` |
| `/positions/:positionId` | Position details, test, invitations, email rules, and candidate stages | Redesign and split | `/positions/:positionId` |
| `/positions/:positionId/test` | Attached test questions | Replace | `/positions/:positionId/edit/:testId` |
| `/email-templates` | Email-template management | Redirect | `/email` |
| Not available | Position configuration | New | `/positions/:positionId/edit` |
| Not available | Candidate interview review | New | `/positions/:positionId/interview/:interviewId` |

### Candidate routes

| Current route | Existing responsibility | Phase 2 decision | Final route |
| --- | --- | --- | --- |
| `/tests/take` | Manually enter an invitation token | Development Only | `/interview/:invitationToken` |
| `/tests/:testId?inviteToken=...` | Take the assigned test | Replace | `/interview/:invitationToken/onair` |
| `/video-recording` | Standalone recording feasibility page | Development Only | Integrated into `/interview/:invitationToken/onair` |
| Not available | Candidate welcome and progress | New | `/interview/:invitationToken` |
| Not available | Camera and microphone check | New | `/interview/:invitationToken/device` |
| Not available | Dedicated completion state | Optional new route | `/interview/:invitationToken/complete` |

### Development routes

The following routes remain available through `/dev` until Phase 2 replacements pass regression testing:

- `/questions`
- `/questions/create`
- `/questions/view`
- `/responses/create`
- `/responses/view`
- `/tests`
- `/tests/create`
- `/tests/take`
- `/users`
- `/users/create`
- `/users/view`
- `/users/role/CANDIDATE`
- `/users/role/RECRUITER`
- `/attempts/view`
- `/video-recording`

## 6. Final Information Architecture

### Recruiter navigation

```text
Dashboard              /
Positions              /positions
Email                  /email
Development Portal     /dev
Logout                 Disabled until authentication is implemented
```

### Candidate journey

```text
Invitation link
  → Welcome and progress
  → Device check
  → Interview
  → Completion
```

The invitation token resolves the candidate, position, test, attempt, expiration, and persisted progress. The candidate must not need to know or enter an internal test ID.

## 7. Global Recruiter Application Shell

### Scope

All recruiter and administrator pages.

### Conceptual layout

```text
Application
├── Persistent sidebar
│   ├── DS-HR product identity
│   ├── Current-user placeholder
│   ├── Dashboard
│   ├── Positions
│   ├── Email
│   ├── Development Portal
│   └── Disabled Logout
├── Persistent header
│   ├── Page title or breadcrumb
│   └── Page-level primary action
└── Main content
```

### UX requirements

- Active navigation item is clearly identified.
- Page content is not duplicated beneath multiple nested shells.
- Sidebar collapses into a drawer or menu on smaller screens.
- Keyboard focus moves predictably when the mobile menu opens and closes.
- Candidate-facing routes never render recruiter navigation.
- `/dev` remains accessible from the bottom of the sidebar.

### Existing components

- `components/layout/application-frame.tsx`
- `components/layout/recruiter-shell.tsx`
- `components/layout/recruiter-nav.tsx`

### Decision

Reuse and refactor the existing shell. Do not create a second competing layout system.

## 8. Dashboard

### Route

`/`

### User

Recruiter or administrator.

### Purpose

Provide an immediate view of recruitment workload and direct the user to positions requiring attention.

### Conceptual layout

```text
Page header
├── Title: Dashboard
└── Create Position

Summary metrics
├── Open Positions
├── Invited Candidates
├── In Progress
└── To Be Evaluated

Main content
├── Recently Updated Positions
└── Attention Required
```

### Primary action

Create Position.

### Data displayed

- Position counts.
- Candidate workflow counts.
- Recently updated positions.
- Positions with candidates waiting for evaluation.
- Operational warnings that require recruiter action.

### Existing components and APIs

- `components/dashboard/dashboard-home.tsx`
- Existing position-list endpoint.
- Existing candidate counts returned with position data.

### Phase 2 changes

- Improve hierarchy and scanability.
- Make position summaries clickable.
- Highlight actionable evaluation work.
- Remove development-oriented wording.
- Use shared cards, badges, loading states, and empty states.

### States

- **Loading:** summary-card skeletons and list placeholders.
- **Empty:** explain that no positions exist and show Create Position.
- **Error:** retain the page shell and allow retry.
- **Success:** show persisted counts and position data.

### Mobile

- Metrics stack or use a two-column grid.
- Position cards become single-column.
- Primary action remains visible without horizontal scrolling.

### Acceptance criteria

- Dashboard uses persisted data.
- Every count links to a useful destination where applicable.
- Empty, loading, and error states are understandable.
- Layout works at common mobile and desktop widths.

## 9. Positions List

### Route

`/positions`

### User

Recruiter or administrator.

### Purpose

Find, compare, open, configure, and close job positions.

### Conceptual layout

```text
Page header
├── Positions
└── Create New Position

Toolbar
├── Open / Draft / Closed tabs
├── Title search
├── Tag multi-select
└── Sort

Position list
├── Position Summary Card
└── Pagination
```

### Position Summary Card

Show:

- Position title.
- Tags.
- Departments.
- Position status.
- Creation or update time.
- Invited count.
- In Progress count.
- To Be Evaluated count.
- Shortlisted count.
- Hired count where useful.
- Configure action.
- Close action for eligible positions.

### Interactions

- Card body opens `/positions/:positionId`.
- Configure opens `/positions/:positionId/edit`.
- Create opens `/positions/new/edit`.
- Status-count chips open the position with the corresponding status filter.
- Tag chips toggle the active tag filter.
- Action clicks do not trigger card-body navigation.

### Existing components and APIs

- `components/positions-index-route.tsx`
- `components/position-summary-card.tsx`
- Existing position list and candidate-count behavior.

### Missing or extended backend work

- Status query parameter.
- Debounced title search.
- Multi-select tags.
- Sorting.
- Pagination.
- Prefer one aggregated candidate-count query instead of N+1 requests.

### States

- **Loading:** toolbar remains stable; card skeletons appear below.
- **Empty status:** explain that no positions exist in the selected status.
- **No search results:** preserve filters and provide Clear Filters.
- **Error:** show retry without clearing the selected tab and filters.
- **Closing:** disable the action and prevent duplicate requests.

### Mobile

- Toolbar controls stack vertically.
- Tabs may scroll horizontally if necessary.
- Candidate counts wrap into multiple rows.
- Card actions remain touch-friendly.

### Acceptance criteria

- Open is the default tab.
- Search operates only on position title.
- Filters and sorting apply before pagination.
- Ten positions appear per page.
- Position counts come from persisted interview or assignment data.

## 10. Create and Edit Position

### Routes

- Create: `/positions/new/edit`
- Edit: `/positions/:positionId/edit`

### User

Recruiter or administrator.

### Purpose

Create or configure a position, its test, departments, tags, and email sequence.

### Conceptual layout

```text
Page header
├── Back
├── Create/Edit Position
└── Save status

Position details
├── Title
├── Status
├── Tags
└── Departments

Attached test
├── Question count
├── Preview
└── Edit

Email sequence
├── Ordered rules
├── Add Rule
└── Preview
```

### Create-mode behavior

- Navigating to `/positions/new/edit` does not create an empty database record.
- The position is persisted only after required fields validate and Save succeeds.
- After creation, replace `new` with the persisted ID.

### Existing components and APIs

- `components/position-create-route.tsx`
- `components/position-detail-route.tsx`
- `components/create-test-panel.tsx`
- `components/position-email-sequence-panel.tsx`
- Existing position creation and detail APIs.

### Phase 2 changes

- Move configuration out of the candidate pipeline.
- Replace owner and location according to the approved Phase 2 data decision.
- Support tags and multiple departments.
- Show only test summary, preview, and edit actions here.
- Simplify the email sequence to template + condition rules.

### Email conditions

- On Invitation.
- On Completion.
- No Response in X Hours.

### States

- **Loading:** form skeleton for existing positions.
- **Validation:** field-level messages and page summary where appropriate.
- **Saving:** disable duplicate Save actions.
- **Success:** visible saved confirmation without losing the page context.
- **Unsaved changes:** warn before destructive navigation where practical.
- **Error:** retain entered values and provide retry.

### Mobile

- Single-column form.
- Sticky or easily reachable Save action.
- Tag and department selectors remain keyboard- and touch-accessible.

### Acceptance criteria

- Create and edit modes are explicit.
- Cancel restores the last persisted state.
- Tags reject case-insensitive duplicates.
- Departments come from approved department choices.
- Email rules validate before saving.

## 11. Position Candidate Pipeline

### Route

`/positions/:positionId`

### User

Recruiter or administrator.

### Purpose

View, find, invite, and move candidates through the recruitment workflow for one position.

### Conceptual layout

```text
Page header
├── Back to Positions
├── Position title
└── Configure Position

Toolbar
├── Invited / To Evaluate / Shortlisted / Discarded
├── Candidate-name search
├── Sort
└── Invite Candidate

Candidate list
└── Candidate Summary Card
```

### Candidate Summary Card

Show:

- Candidate name.
- Candidate email.
- Invitation time.
- Submission or completion time where available.
- Current workflow status.
- Stage-change control.
- Email History action.

### Workflow presentation

The UI uses simplified views without deleting the detailed backend workflow.

Recommended groupings:

- **Invited:** Invited and In Progress.
- **To Evaluate:** To Be Evaluated and active Stage 1/2/3 review rounds where required.
- **Shortlisted:** Shortlisted and Hired where appropriate.
- **Discarded:** Discarded and Withdrawn.
- On Hold remains explicitly visible through a badge or secondary filter.

The final mapping must be approved before implementation.

### Existing components and APIs

- `components/position-detail-route.tsx`
- `components/candidate-stages-panel.tsx`
- `components/invite-candidate-panel.tsx`
- Candidate-stage list, transition, history, and delete endpoints.

### Phase 2 changes

- Remove test and email configuration panels from this page.
- Add tabbed pipeline views.
- Add candidate-name search and sorting.
- Move invitation into a modal.
- Add CSV import.
- Add email history.
- Completed candidate cards open interview review.
- Invited candidates remain non-clickable until review data exists.

### States

- **Loading:** candidate-card skeletons within the selected tab.
- **Empty tab:** explain that no candidates are in the selected status.
- **No results:** preserve the active status and allow clearing search.
- **Updating stage:** disable the candidate’s stage control only.
- **Conflict:** reload the latest stage after an optimistic-concurrency error.
- **Error:** retry without losing current status/search context.

### Mobile

- Tabs scroll horizontally if necessary.
- Search, sort, and Invite stack vertically.
- Candidate metadata and actions stack inside cards.

### Acceptance criteria

- `?status=` opens the intended status view.
- Search applies within the current view.
- Stage transitions respect server-provided allowed transitions.
- Refresh preserves persisted stage changes.
- Duplicate invite submission is prevented.

## 12. Invite Candidate and CSV Import

### Entry point

Invite Candidate action on `/positions/:positionId`.

### Conceptual modal

```text
Invite Candidate
├── Single Invite
│   ├── First name
│   ├── Last name
│   ├── Email
│   └── Invite
└── Import CSV
    ├── Select file
    ├── Validation preview
    ├── Import valid rows
    └── Results summary
```

### CSV behavior

- Accept `name` + `email` or `first_name` + `last_name` + `email`.
- Ignore unrelated columns.
- Normalize email casing and whitespace.
- Parse a combined name conservatively.
- Report invalid rows before import.
- Identify duplicates within the file and existing position assignments.
- Process valid rows in a bounded batch.
- Return per-row success, duplicate, invalid, or failed results.
- Prevent repeated imports while processing.

### New backend work

- CSV parsing may occur in the browser, but server validation remains authoritative.
- Batch invitation endpoint or controlled sequential calls.
- Duplicate position-interview protection.
- Structured result response.

### Acceptance criteria

- Valid rows are invited.
- Invalid rows do not block valid rows.
- Duplicate interviews are not created.
- The recruiter receives a clear result summary.

## 13. Test Builder

### Route

`/positions/:positionId/edit/:testId`

### User

Recruiter or administrator.

### Purpose

Create, edit, order, remove, and preview the questions attached to a position’s screening test.

### Conceptual layout

```text
Page header
├── Back to Position Configuration
└── Position title

Builder
├── Question editor
│   ├── Title
│   ├── Description
│   ├── Question type
│   ├── Type-specific settings
│   └── Save Question
└── Question order
    ├── Question summaries
    ├── Move Up / Move Down
    ├── Remove
    └── Add New Question
```

### Type-specific settings

#### Video

- Question video upload.
- Upload and processing state.
- Processed preview when available.

#### Multiple choice

- Exactly four option fields.
- One correct-answer selection.

#### Short answer

- Maximum answer length.

### Existing components and APIs

- `components/create-test-panel.tsx`
- `components/question-creator.tsx`
- `components/question-viewer.tsx`
- Existing test/question creation, ordering, and asset endpoints.

### States

- **Loading:** test and question-list skeleton.
- **Draft edit:** clear unsaved indicator.
- **Saving:** disable repeated actions.
- **Processing video:** display pending status without blocking unrelated questions.
- **Error:** retain unsaved values.
- **Removing:** request confirmation.

### Mobile

- Builder columns stack with question order first or through an accessible toggle.
- Reordering controls remain touch-friendly.
- Avoid drag-and-drop as the only ordering method.

### Acceptance criteria

- Pending edits are saved or explicitly resolved before switching questions.
- Failed saves never clear the current editor.
- Ordering persists after refresh.
- Candidate scoring controls do not appear in the authoring interface.

## 14. Interview Review

### Route

`/positions/:positionId/interview/:interviewId`

### User

Recruiter or reviewer.

### Purpose

Review the candidate’s completed responses, record feedback, and update recruitment status.

### Conceptual layout

```text
Candidate header
├── Back to Pipeline
├── Candidate name and email
├── Completion time
└── Status control

Review area
├── Question list
└── Answer panel
    ├── Question title and description
    ├── Candidate response
    ├── Correct answer where applicable
    ├── Score
    └── Reviewer comment

Candidate navigation
├── Previous Candidate
└── Next Candidate
```

### Response display

- **Multiple choice:** show all options, candidate selection, and correct answer with text/icons in addition to colour.
- **Short answer:** show the submitted text and configured maximum length where useful.
- **Video:** show the processed playable response and processing/error state.

### Feedback

- Score from 1–10 for short-answer and video responses.
- Comment saved per response.
- Feedback remains separate from question-authoring data.

### Existing components and APIs

- `components/attempt-view-route.tsx`
- `components/response-view-route.tsx`
- Existing attempt, response, and candidate-stage endpoints.

### New backend work

- One interview-review response containing candidate, position, attempt, ordered questions, responses, and feedback.
- Persist reviewer score and comment.
- Stable previous/next navigation within the current workflow view.

### States

- **Loading:** candidate header and review-panel skeletons.
- **No response:** explicit unanswered state.
- **Video processing:** processing indicator with retry/reload guidance.
- **Saving feedback:** disable the current Save action.
- **Error:** retain unsaved score and comment where possible.

### Mobile

- Question list becomes a dropdown or horizontal selector.
- Answer content appears below the candidate header.
- Previous/Next actions remain visible after the response content.

### Acceptance criteria

- Every submitted response is viewable.
- Feedback persists after refresh.
- Status changes use the canonical workflow policy.
- Previous/Next remains within a stable candidate ordering.

## 15. Email Management

### Route

`/email`

### User

Recruiter or administrator.

### Purpose

Configure the sender and manage reusable candidate email templates.

### Conceptual layout

```text
Email Settings
├── SMTP host
├── Port
├── Username
├── Replace password
└── Sender address

Email Templates
├── Search
├── Tag filter
├── Create Template
└── Template cards
    ├── Preview
    ├── Edit
    └── Delete
```

### Template fields

- Title.
- From: configured sender.
- To: `{candidate_email}`.
- Subject.
- HTML content.
- Supported placeholders.
- Tags.

### Existing components and APIs

- `components/email-template-manager.tsx`
- Existing email-template CRUD endpoints.
- Existing HTML email storage and sending pipeline.

### New or extended backend work

- Secure sender-settings API if settings move out of environment configuration.
- Never return an existing SMTP password to the browser.
- Template tags.
- Supported-placeholder validation.

### States

- **Loading:** settings and template skeletons.
- **No templates:** clear Create Template action.
- **No search results:** Clear Filters action.
- **Saving:** prevent duplicate form submission.
- **Deleting:** lightweight confirmation.
- **Error:** retain edited template content.

### Mobile

- Settings and template list stack.
- Template actions wrap beneath template details.
- Modal editor uses the full available viewport.

### Acceptance criteria

- Template preview uses the same rendering logic used when sending.
- Unknown placeholders produce validation feedback.
- SMTP secrets are never returned or logged in plaintext.
- `/email-templates` redirects to `/email` after replacement is complete.

## 16. Candidate Welcome

### Route

`/interview/:invitationToken`

### User

Candidate.

### Purpose

Validate the invitation, explain the interview state, and direct the candidate to the device check or completion state.

### Conceptual layout

```text
Candidate page
├── Company and role identity
├── Interview status message
├── Progress where applicable
├── Support or privacy information
└── Check Input Devices
```

### States

- **New:** `Welcome to the test for role {roleName}`.
- **Partial:** `You've completed X/Y questions. Please continue.`
- **Complete:** `You've already completed the test.`
- **Invalid:** invitation not found.
- **Expired:** invitation expired.
- **Loading:** neutral validation state without recruiter navigation.

### Existing components and APIs

- `components/take-test-route.tsx`
- Existing invitation-token resolution and attempt endpoints.

### New or extended backend work

- Resolve the token without requiring the internal test ID.
- Return position title, test progress, completion, and expiration.
- Derive completion from unique persisted question responses.

### Mobile

- Single focused column.
- Large primary action.
- No sidebar or recruiter controls.

### Acceptance criteria

- Invalid and expired links show explicit messages.
- Completed interviews cannot restart.
- Partial interviews continue through the device check.
- Internal candidate or assignment details are not unnecessarily exposed.

## 17. Device Check

### Route

`/interview/:invitationToken/device`

### User

Candidate.

### Purpose

Confirm camera and microphone access before starting or continuing the interview.

### Conceptual layout

```text
Audio and Video Test
├── Camera preview
├── Microphone volume meter
├── Camera selector
├── Microphone selector
├── Speaker selector when supported
├── Permission and device guidance
└── Start Interview
```

### Existing components and APIs

- Recording and permission logic from `components/video-recording-route.tsx`.

### New behavior

- Enumerate available media devices.
- Update the preview when the selected camera changes.
- Display a real-time microphone input meter.
- Feature-detect speaker selection.
- Stop temporary preview streams when leaving the page.

### States

- Requesting permission.
- Permission denied.
- No camera.
- No microphone.
- Device disconnected.
- Camera ready but microphone inactive.
- Ready to start.

### Mobile

- Preview appears above controls.
- Controls use full-width touch targets.
- Orientation changes do not leave stale media streams.

### Acceptance criteria

- Start Interview is enabled only when valid camera and microphone input are detected.
- Unsupported speaker selection does not block the candidate.
- Permission failures include recovery guidance.

## 18. Candidate Interview / On Air

### Route

`/interview/:invitationToken/onair`

### User

Candidate.

### Purpose

Present the next unanswered question, save the response safely, and advance until the interview is complete.

### Conceptual layout

```text
Interview
├── Question number and progress
├── Question title and description
├── Type-specific answer area
├── Save/Submit state
└── Support/error feedback
```

### Multiple-choice question

- Four radio options.
- Candidate selection.
- Submit or continue action.

### Short-answer question

- Text area.
- Maximum-length enforcement.
- Remaining-character feedback where useful.

### Video question sequence

1. Automatically play the question video without controls.
2. Replace it with the recording area when playback completes.
3. Show a three-second countdown.
4. Start recording automatically.
5. Show the live candidate preview.
6. Show a visible 60-second countdown or configured limit.
7. Show a warning near the end.
8. Stop automatically when time expires.
9. Allow early submission after recording begins.
10. Finalize the Blob and upload it.
11. Mark the question complete only after server confirmation.

### Existing components and APIs

- `components/test-answer-route.tsx`
- `components/question-answerer.tsx`
- `components/video-recording-route.tsx`
- Existing attempt, response, and video-upload endpoints.

### New or extended backend work

- Load the next unanswered question.
- Persist responses question-by-question.
- Idempotent save and submission behavior.
- Resume after refresh or interruption.
- Return server-authoritative progress.

### States

- Loading next question.
- Preparing question video.
- Preparing recording.
- Countdown.
- Recording.
- Uploading.
- Saving.
- Upload failed with retry.
- Permission lost.
- Completed.

### Mobile

- Single-column layout.
- Video respects the viewport and orientation.
- Countdown and remaining time stay visible.
- Primary action remains reachable without overlapping the preview.

### Acceptance criteria

- Refresh resumes at the next unanswered question.
- Temporary browser Blob URLs are never treated as persisted responses.
- Repeated Submit does not create duplicate responses.
- Final completion is shown only after all responses are persisted.

## 19. Shared UI Components for P2-M03

P2-M03 should establish or standardize:

- `AppShell`
- `Sidebar`
- `Header`
- `PageHeader`
- `Button`
- `Input`
- `Textarea`
- `Select`
- `SearchInput`
- `Tabs`
- `StatusBadge`
- `TagChip`
- `Card`
- `Modal`
- `Dropdown`
- `Pagination`
- `LoadingState`
- `EmptyState`
- `ErrorState`
- `ConfirmDialog`
- `Toast`
- `EmailPreview`

Every component must support keyboard interaction, visible focus, disabled state, loading state where applicable, and responsive layout.

## 20. Existing Component Reuse Plan

| Existing component | Phase 2 decision |
| --- | --- |
| `application-frame.tsx` | Reuse with shell consolidation. |
| `recruiter-shell.tsx` | Reuse and refactor. |
| `recruiter-nav.tsx` | Reuse and update navigation destinations. |
| `dashboard-home.tsx` | Reuse data behavior; redesign presentation. |
| `positions-index-route.tsx` | Reuse API flow; add query state and controls. |
| `position-summary-card.tsx` | Refactor into the Phase 2 position card. |
| `position-detail-route.tsx` | Split pipeline and configuration responsibilities. |
| `candidate-stages-panel.tsx` | Reuse stage rules; redesign into pipeline tabs/cards. |
| `invite-candidate-panel.tsx` | Refactor into a modal and add CSV import. |
| `position-email-sequence-panel.tsx` | Move to position configuration and simplify rules. |
| `create-test-panel.tsx` | Reuse business flow; refactor into dedicated builder. |
| `question-creator.tsx` | Reuse question-type behavior. |
| `question-viewer.tsx` | Reuse for test preview and development tools. |
| `question-answerer.tsx` | Reuse type-specific answer controls. |
| `test-answer-route.tsx` | Replace page structure; reuse API interaction carefully. |
| `video-recording-route.tsx` | Reuse media logic; split into device and recording components. |
| `email-template-manager.tsx` | Reuse CRUD behavior; redesign under `/email`. |
| `attempt-view-route.tsx` | Reuse data concepts for interview review. |
| `response-view-route.tsx` | Reuse answer display logic for interview review. |

## 21. Existing API Capabilities

The current API already supports:

- Question listing and creation.
- Question video and thumbnail upload/retrieval.
- Video transcode request.
- Test listing, creation, update, retrieval, question creation, and ordering.
- User listing, generation, invitation, retrieval, status update, and deletion.
- Email-template CRUD.
- Response creation, retrieval, and video upload/retrieval.
- Invitation-token resolution.
- Attempt start, save, submit, and retrieval.
- Position listing, creation, and retrieval.
- Position email-sequence update.
- Position candidate listing.
- Candidate stage history, transition, and removal.
- API liveness and readiness checks.

## 22. Missing or Extended API Capabilities

The following must be confirmed or added during implementation:

- Position title search, status filter, tag filter, sorting, and pagination.
- Aggregated candidate counts for position cards.
- Position update endpoint for title, status, tags, and departments.
- Candidate-name search and sorting within a position.
- CSV or batch candidate invitation with structured row results.
- Candidate-specific email history.
- Completion-triggered email.
- Consolidated interview-review response.
- Reviewer score and comment persistence.
- Token-only welcome/progress response.
- Next-unanswered-question response.
- Question-by-question persisted candidate progress.
- Idempotent response submission.
- Video-processing job types and status.
- Secure email settings if moved from environment configuration.

## 23. Redirect and Compatibility Plan

| Legacy route | Future destination | Activation rule |
| --- | --- | --- |
| `/positions/create` | `/positions/new/edit` | Enable after create mode passes regression. |
| `/email-templates` | `/email` | Enable after email CRUD and preview pass regression. |
| `/positions/:positionId/test` | `/positions/:positionId/edit/:testId` | Enable after the test builder passes regression. |
| `/tests/take` | Remain under `/dev` | Do not redirect until token-based welcome is complete. |
| `/tests/:testId?inviteToken=...` | `/interview/:invitationToken/onair` | Replace only after the full candidate flow passes regression. |

Redirects must preserve query parameters only when they remain meaningful and safe.

## 24. Cross-Cutting UX States

Every page must explicitly implement:

### Loading

- Preserve the page structure.
- Avoid layout jumps where practical.
- Disable actions that cannot complete.

### Empty

- Explain why the page is empty.
- Provide the next useful action.

### Error

- Use plain-language messages.
- Preserve user input where safe.
- Offer retry when the operation is recoverable.
- Do not expose secrets or raw server internals.

### Success

- Confirm the completed action.
- Update affected persisted data without requiring a full-page reload where practical.

### Conflict

- Reload current server state.
- Explain when another update changed the record.
- Never silently overwrite a newer stage revision.

## 25. Responsive and Accessibility Requirements

- Support current desktop Chrome, Edge, Firefox, and Safari.
- Validate candidate flows on Android Chrome and iOS Safari.
- Provide visible keyboard focus.
- Associate form controls with labels.
- Do not use colour as the only status or correctness indicator.
- Use native buttons and form controls where practical.
- Modals must trap focus and return focus to their trigger.
- Ensure touch targets remain usable on mobile.
- Avoid horizontal page scrolling.
- Provide accessible text for icons.
- Ensure video states and countdowns have visible textual indicators.

## 26. P2-M02 Deliverables

- Approved current-route inventory.
- Approved final recruiter routes.
- Approved final candidate routes.
- Recruiter navigation definition.
- Candidate journey definition.
- Page-by-page UX contracts.
- Component reuse plan.
- API capability and gap list.
- Redirect plan.
- Shared state requirements.
- Mobile and accessibility requirements.

## 27. P2-M02 Acceptance Criteria

P2-M02 is complete when:

- Every current user-facing page is classified.
- Every final Phase 2 page has a confirmed route and purpose.
- Recruiter, candidate, and development experiences are separated.
- Every final page identifies existing reusable components.
- Every final page identifies existing and missing API work.
- Loading, empty, error, and success states are defined.
- Mobile behavior is defined.
- Legacy pages remain available until replacements pass regression testing.
- No Phase 1 capability is removed.
- The team approves this document as the implementation reference for P2-M03 and later milestones.

