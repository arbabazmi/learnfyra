# My Worksheets Tracking — Feature Spec

**Branch:** feat/my-worksheets-tracking
**Date:** 2026-04-03
**Status:** Implemented

---

## Feature: My Worksheets Tracking

### User Story
As a student or teacher,
I want to see all the worksheets I have generated with their current status (New, In Progress, Completed),
So that I can track my learning progress and quickly return to worksheets I haven't finished.

### Acceptance Criteria

**AC-1 — Worksheet list returns all generated worksheets:**
Given an authenticated user has generated 5 worksheets,
When they call GET /api/worksheets/mine,
Then the response includes all 5 worksheets with correct `status`, `score`, and `createdAt` fields.

**AC-2 — Status derivation is accurate:**
Given a worksheet has never been attempted,
When GET /api/worksheets/mine is called,
Then that worksheet has `status: "new"` and `score: null`.

Given a worksheet has at least one completed scored attempt,
When GET /api/worksheets/mine is called,
Then that worksheet has `status: "completed"` and `score` equal to the most recent attempt percentage.

**AC-3 — Completed count de-duplicates retakes:**
Given a user has completed the same worksheet 3 times,
When GET /api/dashboard/stats is called,
Then `worksheetsDone` counts that worksheet as 1 (not 3).

**AC-4 — Dashboard stats reflect generated worksheets, not just attempts:**
Given a user has generated 10 worksheets but only completed 4,
When GET /api/dashboard/stats is called,
Then `totalWorksheets` is 10, `worksheetsDone` is 4, and `newWorksheets` is 6.

**AC-5 — Dashboard recent-worksheets shows generated worksheets:**
Given a user has generated worksheets but not yet solved any,
When GET /api/dashboard/recent-worksheets is called,
Then worksheets appear with `status: "new"` rather than an empty list.

**AC-6 — Practice mode exposes answers:**
Given a worksheet exists in storage,
When GET /api/solve/{id}?mode=practice is called,
Then each question in the response includes both `answer` and `explanation` fields.

**AC-7 — Exam mode never exposes answers:**
Given GET /api/solve/{id} is called without `mode=practice`,
Then no question in the response contains `answer` or `explanation` fields.

**AC-8 — AWS: createdBy-index GSI exists on GenerationLog:**
Given the CDK stack is deployed to any environment,
When `cdk synth` is run,
Then `LearnfyraGenerationLog-{env}` table has a `createdBy-index` GSI with PK=createdBy, SK=createdAt, Projection=ALL.

**AC-9 — Ownership isolation:**
Given User A and User B have each generated 3 worksheets,
When User A calls GET /api/worksheets/mine,
Then the response contains only User A's 3 worksheets and no worksheets from User B.

**AC-10 — Sidebar badge accuracy:**
Given a user has 7 generated worksheets,
When the sidebar worksheet badge is rendered,
Then it displays the count 7 (sourced from the API, not hardcoded).

**AC-11 — Status badges are visually differentiated:**
Given the My Worksheets page is rendered,
When worksheets with different statuses are displayed,
Then New badges appear in blue, In Progress badges in amber, and Completed badges in green.

**AC-12 — AI disclaimer on results screen:**
Given a student submits answers and receives their score,
When the results screen is displayed,
Then an AI compliance disclaimer is visible indicating results are AI-generated.

### AWS Services Involved

- **DynamoDB:** `LearnfyraGenerationLog-{env}` table — new `createdBy-index` GSI (PK=createdBy, SK=createdAt, Projection=ALL)
- **Lambda:** `learnfyra-progress` — handles `GET /api/worksheets/mine` in addition to existing `/api/progress/*` routes
- **Lambda:** `learnfyra-dashboard` — updated to query `createdBy-index` for `GET /api/dashboard/stats` and `GET /api/dashboard/recent-worksheets`
- **API Gateway:** New route `GET /api/worksheets/mine` mapped to `learnfyra-progress` Lambda
- **SSM Parameter Store:** `scripts/load-aws-config.js` reads from SSM for local dev config loading

### Out of Scope

- Per-worksheet score history (only the most recent attempt score is surfaced in the list)
- Worksheet deletion by users (admin-only)
- Filtering the My Worksheets list by subject or grade (future enhancement)
- Sharing worksheets between users
- Offline status sync

### Dependencies

- `LearnfyraGenerationLog` table must have `createdBy` attribute populated by `generateHandler.js` for authenticated requests
- JWT must contain `userId` claim (handled by `learnfyra-auth` and `learnfyra-authorizer`)
- `LearnfyraWorksheetAttempt` table must be queryable by userId to derive status (existing)

### Open Questions (resolved)

- Q: Should `status` reflect only completed attempts or any attempt? A: Status uses the most recent attempt to determine the state. A worksheet goes directly from `new` to `completed` when a scored submit is received. `in-progress` is reserved for partial save scenarios (Phase 2).
- Q: Should guest-generated worksheets appear anywhere? A: No. Only authenticated user worksheets tracked via `createdBy`. Guest worksheets have `createdBy: null` and are excluded from the `createdBy-index` GSI.
- Q: How does the sidebar badge get its count? A: It calls `GET /api/dashboard/stats` and reads `totalWorksheets`.

---

## Feature: AWS Config Loader for Local Dev

### User Story
As a developer,
I want to run `npm run dev:aws` and have my local `.env` automatically populated from AWS,
So that I do not need to manually copy secrets from the AWS console.

### Acceptance Criteria

**AC-1:** Given a developer has AWS credentials configured locally, when they run `npm run dev:aws`, then `scripts/load-aws-config.js` fetches all required secrets and env vars and writes them to `.env`.

**AC-2:** Given the script runs successfully, when `node server.js` starts, then it uses the fetched ANTHROPIC_API_KEY, WORKSHEET_BUCKET_NAME, and ALLOWED_ORIGIN without any manual intervention.

**AC-3:** The `.env` file written by this script MUST NOT be committed to git (confirmed in `.gitignore`).

### AWS Services Involved

- **SSM Parameter Store:** Source of secrets (ANTHROPIC_API_KEY, LOCAL_JWT_SECRET)
- **Lambda (GetFunctionConfiguration):** Source of environment variables from `learnfyra-generate` and `learnfyra-auth` functions

### Out of Scope

- Automatic `.env` refresh while the server is running
- Windows-only execution paths — script uses Unix-compatible Node.js APIs

### Dependencies

- Developer must have `AWS_PROFILE` or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` set with read access to SSM and Lambda GetFunctionConfiguration
