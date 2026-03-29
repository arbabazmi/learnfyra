# Master Task List
**Last Updated:** 2026-03-28

## Status Legend
- DONE — Completed and tested
- IN PROGRESS — Currently being worked on
- BLOCKED — Waiting on dependency
- TODO — Not yet started
- DEFERRED — Out of scope for current phase

---

## Local-First Setup

These setup tasks MUST be complete before any sprint involving DynamoDB local begins. SETUP-001 and SETUP-002 are not required for Sprint 1 (M04 local guest mode). They are required starting Sprint 3 (M02 DynamoDB adapter) and Sprint 4 (M05).

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| SETUP-001 | Start dynamodb-local Docker container | TODO | `docker run -p 8000:8000 amazon/dynamodb-local` | Pre-Sprint 3 |
| SETUP-002 | Create DynamoDB local tables (bootstrap script) | TODO | `node scripts/bootstrap-local-db.js` — creates all local tables for M02/M05/M06 | Pre-Sprint 3 |
| SETUP-003 | Verify Google OAuth `http://localhost:3000` callback works end-to-end | TODO | Confirm redirect URI configured in Google Cloud Console | Pre-Sprint 8 |
| SETUP-004 | Seed question-bank.json with sample questions | TODO | `node scripts/seed-question-bank.js` — seeds `worksheets-local/question-bank/` for QB local adapter testing | Pre-Sprint 3 |

---

## Module M01 — Auth & Identity

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M01-BE-01 | Cognito User Pool CDK construct | DONE | | — |
| M01-BE-02 | Lambda Authorizer (JWT validation + IAM policy) | DONE | | — |
| M01-BE-03 | authHandler.js — POST /api/auth/token | DONE | | — |
| M01-BE-04 | authHandler.js — POST /api/auth/refresh | DONE | | — |
| M01-BE-05 | authHandler.js — POST /api/auth/logout | DONE | | — |
| M01-BE-06 | authHandler.js — GET/PUT /api/auth/me | DONE | | — |
| M01-BE-07 | Parent-child link — POST /api/auth/link-child | DONE | | — |
| M01-BE-08 | Local auth adapter (APP_RUNTIME=local) | DONE | | — |
| M01-FE-01 | Login page (login.html + auth.js) | BLOCKED | Awaiting UI template | Sprint 8 |
| M01-FE-02 | Register page with role selection | BLOCKED | Awaiting UI template | Sprint 8 |
| M01-FE-03 | Google OAuth redirect flow (client-side PKCE) | BLOCKED | Awaiting UI template | Sprint 8 |
| M01-FE-04 | Token storage + auto-refresh | BLOCKED | Awaiting UI template | Sprint 8 |
| M01-FE-05 | Logout UI | BLOCKED | Awaiting UI template | Sprint 8 |
| M01-TEST-01 | Unit tests for authHandler | DONE | | — |
| M01-TEST-02 | Unit tests for Lambda Authorizer | DONE | | — |
| M01-TEST-03 | Integration test: full auth flow | DONE | | — |

---

## Module M02 — Question Bank

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| QB-IMPL-001 | DynamoDB QuestionBank table CDK construct | TODO | Needs DynamoDB table + GSI-1 | Sprint 3 |
| QB-IMPL-002 | localAdapter.js (QB_ADAPTER=local) | TODO | JSON file read/write under worksheets-local/question-bank/ | Sprint 3 |
| QB-IMPL-003 | dynamoAdapter.js (QB_ADAPTER=dynamodb) | TODO | AWS SDK v3, lazy import, DB_ENDPOINT aware | Sprint 3 |
| QB-IMPL-004 | index.js adapter factory | TODO | Reads QB_ADAPTER env var; throws at init for unknown values | Sprint 3 |
| QB-IMPL-005 | dedupeHash computation | TODO | SHA256 in src/questionBank/utils.js | Sprint 3 |
| QB-CDK-001 | CDK: LearnfyraQuestionBank-{env} table | TODO | PAY_PER_REQUEST, GSI-1 on lookupKey + typeDifficulty | Sprint 3 |
| QB-CDK-002 | CDK: grant DynamoDB access to generate Lambda | TODO | dynamodb:GetItem, PutItem, Query, UpdateItem | Sprint 3 |
| QB-CDK-003 | CDK: QB_ADAPTER env var injection | TODO | Inject QB_ADAPTER and QUESTION_BANK_TABLE_NAME into generate Lambda | Sprint 3 |
| QB-TEST-001 | Unit tests for both adapters (aws-sdk-client-mock) | TODO | Local and DynamoDB adapters; grade boundary tests | Sprint 3 |
| QB-TEST-002 | Unit test: dedupeHash uniqueness | TODO | Same text different casing/whitespace → same hash | Sprint 3 |

---

## Module M03 — Worksheet Generator

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M03-BE-01 | generateHandler.js Lambda handler | DONE | | — |
| M03-BE-02 | generator.js — generateWorksheet() pipeline | DONE | | — |
| M03-BE-03 | promptBuilder.js — system + user + strict prompts | DONE | | — |
| M03-BE-04 | topics.js — CURRICULUM map v1.1.0 | DONE | 410 topic combos | — |
| M03-BE-05 | Bank-first assembly (integrate M02) | BLOCKED | Depends on QB-IMPL-001 through QB-IMPL-004 | Sprint 3 |
| M03-BE-06 | generationMode + provenanceLevel fields | BLOCKED | Depends on M03-BE-05 | Sprint 3 |
| M03-BE-07 | solve-data.json written alongside worksheet | DONE | | — |
| M03-BE-08 | metadata.json written alongside worksheet | DONE | | — |
| M03-BE-09 | downloadHandler.js — GET /api/download | DONE | | — |
| M03-FE-01 | Generate form wired to POST /api/generate | DONE | In frontend/js/app.js | — |
| M03-TEST-01 | Unit tests for generator.js | DONE | 88 tests passing | — |
| M03-TEST-02 | Unit tests for promptBuilder.js | DONE | | — |
| M03-TEST-03 | Unit tests for exporters | DONE | | — |
| M03-TEST-04 | Integration: bank-first generate flow | BLOCKED | Depends on M02 | Sprint 3 |

---

## Module M04 — Online Solve & Submit

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M04-BE-01 | solveHandler.js — GET /api/solve/:id | TODO | Strip answer and explanation from response | Sprint 1 |
| M04-BE-02 | submitHandler.js — POST /api/submit | TODO | Score + return result; stub aggregator call for local mode | Sprint 1 |
| M04-BE-03 | scorer.js — all 7 question types | TODO | src/solve/scorer.js | Sprint 1 |
| M04-BE-04 | resultBuilder.js — score summary + breakdown | TODO | src/solve/resultBuilder.js | Sprint 1 |
| M04-BE-05 | Path traversal guard (UUID v4 validation) | TODO | RC-BE-02 — both handlers, before any file/S3 op | Sprint 1 |
| M04-BE-06 | Wire routes in server.js | TODO | GET /api/solve/:id, POST /api/submit | Sprint 1 |
| M04-FE-01 | solve.html — interactive solve page | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-FE-02 | solve.js — timer, answer capture, submit | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-FE-03 | solve.css — solve page styles | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-FE-04 | Wire "Solve Online" button from result page | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-TEST-01 | Unit tests for scorer.js | TODO | All 7 question types, unanswered, grade 1 (5q), grade 10 (30q) | Sprint 1 |
| M04-TEST-02 | Unit tests for resultBuilder.js | TODO | Percentage computation, zero totalPoints guard | Sprint 1 |
| M04-TEST-03 | Unit tests for solveHandler | TODO | Mock Lambda events, UUID v4 validation, 404 path | Sprint 1 |
| M04-TEST-04 | Unit tests for submitHandler | TODO | Mock Lambda events, guest mode (no DynamoDB writes), all scoring paths | Sprint 1 |
| M04-TEST-05 | Integration: full solve flow (generate → solve → submit) | TODO | End-to-end on localhost:3000 | Sprint 1 |

---

## Module M05 — Progress & Reporting

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M05-BE-01 | progressHandler.js — GET /api/progress/me | TODO | Default values for new users with 0 attempts | Sprint 4 |
| M05-BE-02 | progressHandler.js — GET /api/progress/history | TODO | limit + lastKey pagination | Sprint 4 |
| M05-BE-03 | dashboardHandler.js — teacher + parent dashboards | TODO | needsIntervention flag, NO_CHILD_LINKED error | Sprint 4 |
| M05-BE-04 | aggregator.js — update precomputed fields | TODO | Called by submitHandler; stub created in Sprint 1, full impl in Sprint 4 | Sprint 4 |
| M05-BE-05 | certificateHandler.js — generate + get | TODO | Score threshold 80%, idempotency, presigned URL | Sprint 4 |
| M05-BE-06 | certificateBuilder.js — PDF generation | TODO | Puppeteer (already installed), US Letter, no external fonts | Sprint 4 |
| M05-CDK-001 | CDK: LearnfyraWorksheetAttempt table | TODO | PK=userId, SK=worksheetId#completedAt | Sprint 4 |
| M05-CDK-002 | CDK: LearnfyraCertificates table | TODO | userId-index GSI | Sprint 4 |
| M05-TEST-01 | Unit tests for progressHandler | TODO | Default values, aggregate fields, pagination at 45 attempts | Sprint 4 |
| M05-TEST-02 | Unit tests for dashboardHandler | TODO | Teacher ownership, needsIntervention, parent NO_CHILD_LINKED | Sprint 4 |
| M05-TEST-03 | Unit tests for certificateHandler | TODO | Score threshold, idempotency, presigned URL format | Sprint 4 |
| M05-FE-01 | Student progress dashboard | BLOCKED | Awaiting UI template | Sprint 5 |
| M05-FE-02 | Teacher class dashboard | BLOCKED | Awaiting UI template | Sprint 5 |
| M05-FE-03 | Parent child progress page | BLOCKED | Awaiting UI template | Sprint 5 |
| M05-FE-04 | Certificate download UI | BLOCKED | Awaiting UI template | Sprint 5 |

---

## Module M06 — Class Management

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M06-BE-01 | classHandler.js — POST /api/classes + DELETE student | TODO | Join code generation, uniqueness check, 6-char alphanumeric | Sprint 6 |
| M06-BE-02 | classHandler.js — GET /api/classes/me | TODO | Teacher view (teacherId-index GSI) and student view (studentId-index GSI) | Sprint 6 |
| M06-BE-03 | classHandler.js — POST /api/classes/join | TODO | Join code lookup, duplicate enrollment guard (409) | Sprint 6 |
| M06-BE-04 | classHandler.js — GET /api/classes/:id/students | TODO | Roster with avgScore, lastActive, completion stats | Sprint 6 |
| M06-BE-05 | classHandler.js — POST /api/classes/:id/assignments | TODO | Blocked on Open Question 2 (Assignments table design) | Sprint 6 |
| M06-CDK-001 | CDK: LearnfyraClasses + LearnfyraClassMemberships tables | TODO | teacherId-index and studentId-index GSIs | Sprint 6 |
| M06-TEST-01 | Unit tests for classHandler | TODO | All CRUD, join code uniqueness, role enforcement (teacher/student/403) | Sprint 6 |
| M06-FE-01 | Teacher class creation page | BLOCKED | Awaiting UI template | Sprint 7 |
| M06-FE-02 | Student join-class flow | BLOCKED | Awaiting UI template | Sprint 7 |
| M06-FE-03 | Teacher class roster view | BLOCKED | Awaiting UI template | Sprint 7 |
| M06-FE-04 | Student pending assignments view | BLOCKED | Awaiting UI template | Sprint 7 |

---

## Module M07 — Admin Control Plane

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M07-BE-01 | adminHandler.js — user management endpoints | TODO | List users, update role, deactivate | Sprint 9 |
| M07-BE-02 | adminHandler.js — model management endpoints | TODO | Get/update active Claude model config | Sprint 9 |
| M07-BE-03 | adminHandler.js — worksheet oversight endpoints | TODO | List all worksheets, expire/delete | Sprint 9 |
| M07-BE-04 | adminHandler.js — config management endpoints | TODO | Maintenance mode toggle, feature flags | Sprint 9 |
| M07-BE-05 | adminHandler.js — reports endpoints | TODO | Platform usage stats, generation counts by day | Sprint 9 |
| M07-CDK-001 | CDK: LearnfyraConfig table | TODO | | Sprint 9 |
| M07-TEST-01 | Unit tests for adminHandler (all RBAC cases) | TODO | Admin-only — teacher/student/parent all return 403 | Sprint 9 |
| M07-FE-01 | Admin dashboard page | BLOCKED | Awaiting UI template | Sprint 10 |
| M07-FE-02 | User management table | BLOCKED | Awaiting UI template | Sprint 10 |
| M07-FE-03 | Config management page | BLOCKED | Awaiting UI template | Sprint 10 |
| M07-FE-04 | Worksheet oversight table | BLOCKED | Awaiting UI template | Sprint 10 |

---

## Cross-Module Tasks

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| INT-BE-01 | Backend contract lock (all M01-M07 endpoints frozen) | DONE | RC-BE-01, 2026-03-26 | — |
| INT-BE-02 | Path traversal hardening on solve/submit | DONE | RC-BE-02, 1143 tests passing | — |
| INT-BE-03 | Maintenance mode middleware (check Config on every request) | TODO | Reads LearnfyraConfig — M07-CDK-001 must exist first | Sprint 9 |

---

## Infrastructure Tasks

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| CDK-001 | S3 worksheets bucket with lifecycle | DONE | | — |
| CDK-002 | S3 frontend bucket | DONE | | — |
| CDK-003 | API Gateway + Lambda integration | DONE | | — |
| CDK-004 | CloudFront distribution | DONE | | — |
| CDK-005 | Cognito User Pool + Hosted UI | DONE | | — |
| CDK-006 | Secrets Manager integration | DONE | | — |
| CDK-007 | CloudWatch alarms (DOP-08) | DONE | | — |
| CDK-008 | CloudWatch dashboard (14 widgets) | DONE | | — |
| CDK-009 | Domain routing (Route 53 + ACM) | DONE | | — |
| CDK-010 | DynamoDB tables for M02-M07 | TODO | Blocked until each module designed; broken into per-module CDK tasks above | AWS sprints |
| CDK-011 | GitHub Actions CI/CD pipelines | DONE | | — |
