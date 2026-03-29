# Scope Definition — Phase 1

## Phase 1 In Scope

### Module M01 — Auth & Identity
- Google OAuth via Cognito Hosted UI (PKCE flow)
- Local email/password accounts via Cognito User Pool
- Roles: student, teacher, parent, admin
- JWT access tokens (HS256, 1h expiry) + refresh tokens (30d)
- Lambda Authorizer protecting all authenticated API Gateway routes
- Guest mode: worksheet generation and solve without login; progress not saved
- No PII stored beyond email, name, role

### Module M02 — Question Bank
- DynamoDB `QuestionBank` table with dedupeHash (SHA256) and GSI-1
- GSI-1 lookupKey = `grade#{grade}#subject#{subject}#topic#{topic}`, sort key = `typeDifficulty`
- QB_ADAPTER env var: `local` (dev/test) or `dynamodb` (staging/prod)
- Local adapter reads/writes JSON files under `worksheets-local/`
- DynamoDB adapter uses AWS SDK v3; never called in unit tests

### Module M03 — Worksheet Generator
- Bank-first assembly: query QB before calling Claude AI
- generationMode field: `bank-only` | `ai-only` | `mixed`
- provenanceLevel field: `full-bank` | `partial-bank` | `full-ai`
- Claude AI called only for gap-fill when bank has insufficient questions
- POST /api/generate → stores worksheet.pdf, worksheet.docx, worksheet.html, answer-key files, metadata.json, solve-data.json
- Supports all 7 question types: multiple-choice, true-false, fill-in-blank, short-answer, matching, show-your-work, word-problem
- Standards-aligned: CCSS (Math/ELA), NGSS (Science), C3 (Social Studies), NHES (Health)

### Module M04 — Online Solve & Submit
- GET /api/solve/:worksheetId — returns questions only, no answers
- POST /api/submit — scores answers against stored solve-data.json, returns per-question breakdown
- Timed mode: countdown from estimatedTime, auto-submit on expiry
- Untimed mode: no timer, student submits when ready
- Instant scoring with correct/incorrect indicator and explanation per question
- Score stored as WorksheetAttempt in DynamoDB (authenticated users only)

### Module M05 — Progress & Reporting
- Per-student attempt history with score, percentage, time taken
- Teacher view: class performance aggregates, per-student drill-down
- Parent view: child progress, weak area identification
- Precomputed aggregates: totalAttempts, avgScore, streak, lastActive
- Completion certificates (basic MVP version)

### Module M06 — Class & Relationship Management
- Teacher creates/manages classes
- Student joins class via code or teacher invite
- Parent linked to student account
- Class-level worksheet assignment

### Module M07 — Admin Control Plane
- User management (CRUD, role assignment, suspension)
- AI model management: active model selection, hot-swap between providers, audit trail
- Worksheet oversight: flagging, removal, quality review
- Platform config: rate limits, feature flags, maintenance mode
- Access matrix: Super Admin > Ops Admin > Support Admin > Data/Compliance Admin

## Phase 1 Out of Scope

- Rewards, gamification, badges, streaks, points system (Phase 2)
- Angular 17+ frontend rebuild (Phase 2 — current frontend is plain HTML/JS)
- Completion certificates beyond basic MVP (Phase 2)
- Multi-provider OAuth (GitHub, Microsoft) — Google only in Phase 1
- LMS SSO and multi-tenant school federation (Phase 2+)
- Real-time collaboration or live class sessions
- Mobile native apps

## Implementation Constraints

### Local-First Rule
All features must work on localhost:3000 before any AWS deployment is attempted. Lambda handlers must be callable directly from Express routes without code changes. APP_RUNTIME=`local` uses file system and local DynamoDB adapter; APP_RUNTIME=`aws` uses S3 and DynamoDB.

### Lambda Compatibility
Every handler must follow the standard pattern: lazy imports for cold start, `context.callbackWaitsForEmptyEventLoop = false`, CORS headers on every response including OPTIONS. No handler may call real AWS services when APP_RUNTIME=local.

### No Breaking Changes
All M01–M07 API contracts are frozen as of RC-BE-01. Any change to an existing endpoint requires a version bump (e.g., `/api/v2/`) and must not break existing callers.

### Test Coverage Gate
CI pipeline blocks merges below 80% line coverage. Every Lambda handler needs unit tests with mock events and mock AWS SDK calls via aws-sdk-client-mock.

## Promotion Sequence

```
local (localhost:3000)
  ↓  pass: npm test + manual smoke test
dev (web.dev.learnfyra.com / api.dev.learnfyra.com)
  ↓  pass: automated smoke tests in CI + dev deploy workflow
staging (web.staging.learnfyra.com / api.staging.learnfyra.com)
  ↓  pass: full regression suite + manual sign-off
prod (web.learnfyra.com / api.learnfyra.com)
     requires: manual approval gate in GitHub Actions
```

## Module Build Sequence

Recommended order to minimize blocking dependencies:

1. M01 Auth (Cognito + Lambda Authorizer) — unblocks all protected routes
2. M02 Question Bank (DynamoDB table + local adapter) — unblocks M03
3. M03 Worksheet Generator (bank-first + Claude gap-fill) — unblocks M04, M05
4. M04 Solve & Submit (scoring engine + handlers) — unblocks M05 attempt storage
5. M05 Progress & Reporting (aggregates + dashboards) — unblocks M06 class analytics
6. M06 Class Management (classes + memberships) — unblocks M07 class oversight
7. M07 Admin Control Plane (last — depends on all modules being stable)
