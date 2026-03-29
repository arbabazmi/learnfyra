# Sprint Plan
**Last Updated:** 2026-03-28
**Strategy:** Backend-first, local-first, module by module

---

## Execution Order (rationale)

1. **M04** — No blockers. `solve-data.json` is already written by M03. Scoring engine has zero external dependencies. This is the fastest path to a working end-to-end feature on localhost:3000.
2. **M02** — No blockers for the local adapter. Unblocks M03-BE-05 (bank-first generation) and reduces Claude API spend long-term.
3. **M05** — Needs M04 `WorksheetAttempt` data. `aggregator.js` stub must exist when M04-BE-02 is written, so M05-BE-04 stub is created during M04 sprint even though the full M05 sprint is separate.
4. **M06** — Needs M01 auth tokens (backend already done). Local adapter requires `dynamodb-local` with two tables. No dependency on M04 or M05 for the core class management CRUD.
5. **M01 Frontend** — Auth backend is done. Blocked on UI template from product owner.
6. **M07** — Admin control plane. Needs M01 auth (done). Lowest user priority. Blocked on UI template for frontend.

All frontend sprints are blocked on:
- The corresponding backend sprint being complete and tested.
- Receipt of UI template from product owner.

---

## Local Dev Setup (prerequisite for all sprints)

These four setup tasks MUST be complete before Sprint 1 begins. They are tracked as SETUP-001 through SETUP-004 in the master task list.

| Task | Command / Action |
|---|---|
| SETUP-001 | `docker run -p 8000:8000 amazon/dynamodb-local` |
| SETUP-002 | `node scripts/bootstrap-local-db.js` — creates all DynamoDB local tables |
| SETUP-003 | Verify Google OAuth `http://localhost:3000` callback works end-to-end |
| SETUP-004 | `node scripts/seed-question-bank.js` — seeds `worksheets-local/question-bank/` for QB local adapter testing |

SETUP-001 and SETUP-002 are not needed for Sprint 1 (M04 backend requires no DynamoDB locally in guest mode). They are required starting Sprint 3 (M02 DynamoDB adapter) and Sprint 4 (M05).

---

## Sprint 1 — M04 Backend: Online Solve & Submit (Local)

**Goal:** Full solve/submit flow working on `http://localhost:3000`. Students can generate a worksheet and immediately solve it online with instant scoring.
**Blocking:** Nothing. `solve-data.json` is already written by the generator.
**Local env vars required:** `APP_RUNTIME=local`, `NODE_ENV=development`
**No DynamoDB needed:** Local submit operates in guest mode for all submissions when `APP_RUNTIME=local`.

### Tasks

| Task ID | Description |
|---|---|
| M04-BE-03 | Create `src/solve/scorer.js` — `scoreWorksheet(worksheet, submittedAnswers)` — all 7 question types |
| M04-BE-04 | Create `src/solve/resultBuilder.js` — `buildResult(worksheet, results, submissionMeta)` |
| M04-BE-05 | Path traversal guard — UUID v4 validation in both handlers |
| M04-BE-01 | Create `backend/handlers/solveHandler.js` — `GET /api/solve/:worksheetId`, strips answer fields |
| M04-BE-02 | Create `backend/handlers/submitHandler.js` — `POST /api/submit`, scores and returns result; creates stub call to `aggregator.js` (returns immediately in local mode) |
| M04-BE-06 | Add `GET /api/solve/:id` and `POST /api/submit` routes to `server.js` |
| M04-TEST-01 | `tests/unit/scorer.test.js` — all 7 question types, unanswered, boundary (5 questions Grade 1, 30 questions Grade 10) |
| M04-TEST-02 | `tests/unit/resultBuilder.test.js` — percentage computation, zero totalPoints guard |
| M04-TEST-03 | `tests/unit/solveHandler.test.js` — mock Lambda events, UUID v4 validation, 404 path |
| M04-TEST-04 | `tests/unit/submitHandler.test.js` — mock Lambda events, guest mode (no DynamoDB writes), all scoring paths |
| M04-TEST-05 | `tests/integration/solve.test.js` — full flow: generate worksheet → GET /api/solve → POST /api/submit → verify score |

### Done When
- `GET /api/solve/{uuid}` returns questions without `answer` or `explanation` fields on `http://localhost:3000`.
- `GET /api/solve/{not-a-uuid}` returns 400 `INVALID_WORKSHEET_ID`.
- `GET /api/solve/{valid-uuid-not-found}` returns 404 `WORKSHEET_NOT_FOUND`.
- `POST /api/submit` returns a scored result with `totalScore`, `totalPoints`, `percentage`, and a `results` array.
- All 7 question types score correctly per the rules in `REQ-M04-003`.
- Unanswered questions score 0 with `studentAnswer: ""`.
- Grade 1 worksheet (5 questions) and Grade 10 worksheet (30 questions) both score correctly.
- `npm test` passes for all M04 test files.

### Local Verification Command
```
node server.js &
# Generate a worksheet
curl -X POST http://localhost:3000/api/generate -H "Content-Type: application/json" \
  -d '{"grade":3,"subject":"Math","topic":"Multiplication","difficulty":"Medium","questionCount":5}'
# Copy the returned worksheetId and test solve
curl http://localhost:3000/api/solve/{worksheetId}
```

---

## Sprint 2 — M04 Frontend: Solve Page

**Status:** BLOCKED — Awaiting UI template from product owner. Do not start until Sprint 1 is complete AND the UI template has been received.

**Tasks (to execute once unblocked):**

| Task ID | Description |
|---|---|
| M04-FE-01 | `frontend/solve.html` — interactive solve form, mode selection screen, question rendering, results display |
| M04-FE-02 | `frontend/js/solve.js` — timer (timed/untimed), input rendering for all 7 question types, answer capture, auto-submit, results rendering |
| M04-FE-03 | `frontend/css/solve.css` — solve page styles matching main teal/orange theme |
| M04-FE-04 | Wire "Solve Online" button from the generate result page in `frontend/js/app.js` |

**Done When:** Student can click "Solve Online" from the results page, select timed or untimed mode, fill in all question types, submit, and see a scored results breakdown — all on `http://localhost:3000`.

**Note:** Do not start until UI template is received and Sprint 1 is complete.

---

## Sprint 3 — M02 Backend: Question Bank (Local)

**Goal:** Local JSON adapter and DynamoDB adapter both working. Bank-first generation wired into the generate pipeline.
**Blocking:** Nothing. Local adapter requires no Docker container.
**Local env vars required:** `QB_ADAPTER=local` (for local adapter), `QB_ADAPTER=dynamodb` + `DB_ENDPOINT=http://localhost:8000` (for DynamoDB adapter testing).

### Tasks

| Task ID | Description |
|---|---|
| QB-IMPL-005 | Create `src/questionBank/utils.js` — `computeDedupeHash(question)` using Node.js crypto |
| QB-IMPL-002 | Create `src/questionBank/localAdapter.js` — JSON file read/write under `worksheets-local/question-bank/` |
| QB-IMPL-004 | Create `src/questionBank/index.js` — adapter factory reading `QB_ADAPTER` env var |
| QB-IMPL-003 | Create `src/questionBank/dynamoAdapter.js` — AWS SDK v3, lazy import, `DB_ENDPOINT` aware |
| QB-CDK-001 | CDK: `LearnfyraQuestionBank-{env}` DynamoDB table, PAY_PER_REQUEST, GSI-1 |
| QB-CDK-002 | CDK: grant `dynamodb:GetItem`, `PutItem`, `Query`, `UpdateItem` to `learnfyra-generate` Lambda |
| QB-CDK-003 | CDK: inject `QB_ADAPTER` and `QUESTION_BANK_TABLE_NAME` env vars into generate Lambda |
| M03-BE-05 | Update `src/ai/generator.js` — bank-first assembly pipeline (Steps 2–7 per REQ-QB-006) |
| M03-BE-06 | Add `generationMode` and `provenanceLevel` fields to generate response, `metadata.json`, `solve-data.json` |
| QB-TEST-001 | `tests/unit/` — unit tests for both adapters using aws-sdk-client-mock for DynamoDB adapter |
| QB-TEST-002 | `tests/unit/` — dedupeHash uniqueness and normalization tests |
| M03-TEST-04 | `tests/integration/` — bank-first generate flow: ai-only, mixed, bank-only modes |

### Done When
- `QB_ADAPTER=local`: `POST /api/generate` saves new AI questions to `worksheets-local/question-bank/`, second identical request returns `generationMode: "mixed"` or `"bank-only"`.
- Deduplication: same question text (different casing/whitespace) does not create a duplicate bank entry.
- Grade 1 and Grade 10 bank entries are fully isolated from each other.
- `questionCount=5` and `questionCount=30` both work correctly through the bank-first pipeline.
- `npm test` passes for all QB and M03 test files.

---

## Sprint 4 — M05 Backend: Progress & Reporting (Local)

**Goal:** Progress aggregates updated after each submission. Teacher, student, and parent dashboards working. Certificates generated via Puppeteer.
**Blocking:** Sprint 1 (M04) must be complete. `aggregator.js` stub from Sprint 1 is now replaced with the full implementation.
**Prerequisite:** `dynamodb-local` running with `LearnfyraWorksheetAttempt-local` and `LearnfyraCertificates-local` tables created by `scripts/bootstrap-local-db.js`.

### Tasks

| Task ID | Description |
|---|---|
| M05-BE-04 | Create `src/reporting/aggregator.js` — `updateProgressAggregates(userId, attemptData)` — replaces stub from Sprint 1 |
| M05-BE-01 | Create `backend/handlers/progressHandler.js` — `GET /api/progress/me`, `GET /api/progress/history` |
| M05-BE-02 | Add pagination support to `progressHandler.js` — `limit` and `lastKey` params |
| M05-BE-03 | Create `backend/handlers/dashboardHandler.js` — teacher class view, parent child view, role-aware `GET /api/dashboard` |
| M05-BE-06 | Create `src/reporting/certificateBuilder.js` — `buildCertificatePDF()` using Puppeteer |
| M05-BE-05 | Create `backend/handlers/certificateHandler.js` — `POST /api/certificates/generate`, `GET /api/certificates/:id` |
| M05-CDK-001 | CDK: `LearnfyraWorksheetAttempt-{env}` DynamoDB table |
| M05-CDK-002 | CDK: `LearnfyraCertificates-{env}` DynamoDB table with userId-index GSI |
| M05-TEST-01 | `tests/unit/progressHandler.test.js` — defaults for new users, aggregate field population |
| M05-TEST-02 | `tests/unit/dashboardHandler.test.js` — teacher ownership check, needsIntervention flag, parent NO_CHILD_LINKED |
| M05-TEST-03 | `tests/unit/certificateHandler.test.js` — score threshold, idempotency, presigned URL |

### Done When
- After `POST /api/submit` with a valid JWT, `GET /api/progress/me` reflects the new attempt data.
- New student with 0 attempts returns default values (no 500 error).
- `GET /api/progress/history?limit=20` paginates correctly at 45 attempts.
- Teacher class dashboard flags students with avgScore < 60 as `needsIntervention: true`.
- `POST /api/certificates/generate` with percentage >= 80 produces a PDF buffer and writes the certificate record locally.
- Second call with the same worksheetId returns the existing certificate (idempotent).
- Streak increments on consecutive calendar days and resets after a gap.
- `npm test` passes for all M05 test files.

---

## Sprint 5 — M05 Frontend: Progress Dashboards

**Status:** BLOCKED — Awaiting UI template from product owner. Do not start until Sprint 4 is complete AND the UI template has been received.

**Tasks (to execute once unblocked):**
- Student progress dashboard page (score history, streak, weak/strong areas)
- Teacher class dashboard page (roster, intervention flags, assignment completion)
- Parent child progress page
- Certificate download UI

**Note:** Do not start until UI template is received and Sprint 4 is complete.

---

## Sprint 6 — M06 Backend: Class Management (Local)

**Goal:** Teachers can create classes, generate join codes, and assign worksheets. Students can join classes and see pending assignments.
**Blocking:** M01 auth backend (already done). `dynamodb-local` must be running with `LearnfyraClasses-local` and `LearnfyraClassMemberships-local` tables.
**Local env vars required:** `APP_RUNTIME=local`, `LOCAL_JWT_SECRET`, `DB_ENDPOINT=http://localhost:8000`

### Tasks

| Task ID | Description |
|---|---|
| M06-BE-01 | Create `backend/handlers/classHandler.js` — `POST /api/classes`, join code generation, `DELETE /api/classes/:id/students/:id` |
| M06-BE-02 | Add `GET /api/classes/me` to `classHandler.js` — teacher and student views |
| M06-BE-03 | Add `POST /api/classes/join` to `classHandler.js` — join code lookup, duplicate enrollment guard |
| M06-BE-04 | Add `GET /api/classes/:classId/students` to `classHandler.js` — roster with performance data |
| M06-BE-05 | Add `POST /api/classes/:classId/assignments` to `classHandler.js` — assignment record write |
| M06-CDK-001 | CDK: `LearnfyraClasses-{env}` (teacherId-index GSI) and `LearnfyraClassMemberships-{env}` (studentId-index GSI) |
| M06-TEST-01 | `tests/unit/classHandler.test.js` — all CRUD operations, join code uniqueness, role enforcement (teacher/student/403) |

### Done When
- Teacher can create a class, receive a unique 6-character join code, and the record exists in `dynamodb-local`.
- Student can join with the join code — `ClassMembership` record written with `status: "active"`.
- Duplicate enrollment returns 409 `ALREADY_ENROLLED`.
- Invalid join code returns 404 `INVALID_JOIN_CODE`.
- Teacher assigning a worksheet results in enrolled students seeing `pendingAssignments: 1` in `GET /api/classes/me`.
- Non-teacher call to `POST /api/classes` returns 403.
- `npm test` passes for all M06 test files.

---

## Sprint 7 — M06 Frontend: Class UI

**Status:** BLOCKED — Awaiting UI template from product owner. Do not start until Sprint 6 is complete AND the UI template has been received.

**Tasks (to execute once unblocked):**
- Teacher class creation page
- Student join-class flow (enter 6-character code)
- Teacher class roster view with intervention flags
- Student pending assignments view

**Note:** Do not start until UI template is received and Sprint 6 is complete.

---

## Sprint 8 — M01 Frontend: Auth Pages

**Status:** BLOCKED — Awaiting UI template from product owner. Do not start until the UI template has been received. Backend (M01-BE-01 through M01-BE-08) is already done.

**Tasks (to execute once unblocked):**

| Task ID | Description |
|---|---|
| M01-FE-01 | `frontend/login.html` + `frontend/js/auth.js` — email/password login, Google OAuth button, token storage |
| M01-FE-02 | `frontend/register.html` — role selector (Student, Teacher, Parent — no Admin), client-side validation |
| M01-FE-03 | Google OAuth PKCE client-side flow — `auth.js` implements full PKCE, reads `window.LEARNFYRA_CONFIG` |
| M01-FE-04 | Token storage and auto-refresh — in-memory `accessToken`, `localStorage` refresh token, `requireAuth()` |
| M01-FE-05 | Logout UI — `POST /api/auth/logout`, `clearSession()`, redirect to `/login.html` |

**Local verification:** Open `http://localhost:3000/login.html`, submit email/password, verify redirect to `index.html` with `learnfyra_refresh_token` in `localStorage`. Verify `requireAuth()` redirects protected pages to `/login.html` with `post_login_redirect` in `sessionStorage`.

**Note:** Do not start until UI template is received.

---

## Sprint 9 — M07 Backend: Admin Control Plane (Local)

**Goal:** Admin user management, model management, worksheet oversight, config management, and reports endpoints.
**Blocking:** M01 auth backend (already done). Admin role JWT required.
**Local env vars required:** `APP_RUNTIME=local`, `LOCAL_JWT_SECRET` (sign a token with `role: "admin"` for testing)

### Tasks

| Task ID | Description |
|---|---|
| M07-BE-01 | `backend/handlers/adminHandler.js` — user management endpoints (list users, update role, deactivate) |
| M07-BE-02 | Add model management endpoints to `adminHandler.js` — get/update active Claude model config |
| M07-BE-03 | Add worksheet oversight endpoints to `adminHandler.js` — list all generated worksheets, expire/delete |
| M07-BE-04 | Add config management endpoints to `adminHandler.js` — maintenance mode toggle, feature flags |
| M07-BE-05 | Add reports endpoints to `adminHandler.js` — platform usage stats, generation counts by day |
| M07-CDK-001 | CDK: `LearnfyraConfig-{env}` DynamoDB table |
| M07-TEST-01 | `tests/unit/adminHandler.test.js` — all RBAC cases (admin-only endpoints reject teacher/student/parent JWTs) |

### Done When
- Admin JWT can call all M07 endpoints on `http://localhost:3000`.
- Non-admin JWTs (teacher, student, parent) receive 403 on all M07 endpoints.
- Maintenance mode can be toggled via config endpoint and is respected by `INT-BE-03` middleware.
- `npm test` passes for all M07 test files.

---

## Sprint 10 — M07 Frontend: Admin Panel

**Status:** BLOCKED — Awaiting UI template from product owner. Do not start until Sprint 9 is complete AND the UI template has been received.

**Tasks (to execute once unblocked):**
- Admin dashboard page (platform stats, active users, generation counts)
- User management table (list, role change, deactivate)
- Config management page (maintenance mode toggle, Claude model selector)
- Worksheet oversight table

**Note:** Do not start until UI template is received and Sprint 9 is complete.

---

## AWS Deploy Sprints (Phase 2 — after all local sprints pass)

These sprints are not scheduled until all local backend sprints are complete and all tests pass. The handlers are already Lambda-compatible — AWS deployment is purely infrastructure work.

| Sprint | Goal |
|---|---|
| AWS-1 | Deploy M04 solve/submit handlers — CDK adds `learnfyra-solve` and `learnfyra-submit` Lambda functions |
| AWS-2 | Deploy M02 question bank — CDK adds `LearnfyraQuestionBank` DynamoDB table, grants to generate Lambda |
| AWS-3 | Deploy M05 progress/reporting/certificate handlers and DynamoDB tables |
| AWS-4 | Deploy M06 class management handler and DynamoDB tables |
| AWS-5 | Deploy M01 frontend (login.html, register.html, auth.js) to S3 + CloudFront |
| AWS-6 | Deploy M07 admin handler and LearnfyraConfig table |
| AWS-7 | Deploy all frontend pages to S3 + CloudFront once UI template sprints are complete |

Each AWS sprint follows the promotion path: dev → staging (smoke tests pass) → prod (manual approval).

---

## Sprint Status Summary

| Sprint | Module | Layer | Status |
|---|---|---|---|
| Sprint 1 | M04 | Backend (local) | Ready to start |
| Sprint 2 | M04 | Frontend | BLOCKED — awaiting UI template |
| Sprint 3 | M02 | Backend (local) | Ready to start (no blockers) |
| Sprint 4 | M05 | Backend (local) | Blocked on Sprint 1 |
| Sprint 5 | M05 | Frontend | BLOCKED — awaiting UI template |
| Sprint 6 | M06 | Backend (local) | Ready to start (M01 auth done) |
| Sprint 7 | M06 | Frontend | BLOCKED — awaiting UI template |
| Sprint 8 | M01 | Frontend | BLOCKED — awaiting UI template |
| Sprint 9 | M07 | Backend (local) | Ready to start (M01 auth done) |
| Sprint 10 | M07 | Frontend | BLOCKED — awaiting UI template |
