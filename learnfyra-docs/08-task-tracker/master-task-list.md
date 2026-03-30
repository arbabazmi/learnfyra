# Master Task List
**Last Updated:** 2026-03-29 (sync pass — task tracker updated to match actual codebase state)

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
| SETUP-001 | Start dynamodb-local Docker container | Done | `docker run -p 8000:8000 amazon/dynamodb-local` | Pre-Sprint 3 |
| SETUP-002 | Create DynamoDB local tables (bootstrap script) | Done | `node scripts/bootstrap-local-db.js` — creates all local tables for M02/M05/M06 | Pre-Sprint 3 |
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
| QB-IMPL-002 | localAdapter.js (QB_ADAPTER=local) | DONE | src/questionBank/localQuestionBankAdapter.js + reuseHook.js | Sprint 3 |
| QB-IMPL-003 | dynamoAdapter.js (QB_ADAPTER=dynamodb) | DONE | src/questionBank/dynamoAdapter.js + utils.js (dedupeHash GSI, lookupKey GSI, SELECT COUNT) | Sprint 3 |
| QB-IMPL-004 | index.js adapter factory | DONE | src/questionBank/index.js — local + dynamodb adapters wired | Sprint 3 |
| QB-IMPL-005 | dedupeHash computation | DONE | SHA256 in localQuestionBankAdapter.js | Sprint 3 |
| QB-CDK-001 | CDK: LearnfyraQuestionBank-{env} table | DONE | LearnfyraQuestionBank-local created by bootstrap-local-db.js | Sprint 3 |
| QB-CDK-002 | CDK: grant DynamoDB access to generate Lambda | TODO | dynamodb:GetItem, PutItem, Query, UpdateItem | Sprint 3 |
| QB-CDK-003 | CDK: QB_ADAPTER env var injection | TODO | Inject QB_ADAPTER and QUESTION_BANK_TABLE_NAME into generate Lambda | Sprint 3 |
| QB-TEST-001 | Unit tests for both adapters (aws-sdk-client-mock) | DONE | questionBankDynamoAdapter.test.js + questionBankUtils.test.js + questionBankIndex.test.js | Sprint 3 |
| QB-TEST-002 | Unit test: dedupeHash uniqueness | DONE | questionBankUtils.test.js — 12 cases including case/whitespace insensitivity | Sprint 3 |

---

## Module M03 — Worksheet Generator

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M03-BE-01 | generateHandler.js Lambda handler | DONE | | — |
| M03-BE-02 | generator.js — generateWorksheet() pipeline | DONE | | — |
| M03-BE-03 | promptBuilder.js — system + user + strict prompts | DONE | | — |
| M03-BE-04 | topics.js — CURRICULUM map v1.1.0 | DONE | 410 topic combos | — |
| M03-BE-05 | Bank-first assembly (integrate M02) | DONE | src/ai/generator.js — bank-only / mixed / ai-only modes with error tolerance | Sprint 3 |
| M03-BE-06 | generationMode + provenanceLevel fields | DONE | Added to generateWorksheet() return value | Sprint 3 |
| M03-BE-07 | solve-data.json written alongside worksheet | DONE | | — |
| M03-BE-08 | metadata.json written alongside worksheet | DONE | | — |
| M03-BE-09 | downloadHandler.js — GET /api/download | DONE | | — |
| M03-FE-01 | Generate form wired to POST /api/generate | DONE | In frontend/js/app.js | — |
| M03-TEST-01 | Unit tests for generator.js | DONE | 88 tests passing | — |
| M03-TEST-02 | Unit tests for promptBuilder.js | DONE | | — |
| M03-TEST-03 | Unit tests for exporters | DONE | | — |
| M03-TEST-04 | Integration: bank-first generate flow | DONE | Covered in generator.test.js bank-first test cases | Sprint 3 |

---

## Module M04 — Online Solve & Submit

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M04-BE-01 | solveHandler.js — GET /api/solve/:id | DONE | backend/handlers/solveHandler.js | Sprint 1 |
| M04-BE-02 | submitHandler.js — POST /api/submit | DONE | backend/handlers/submitHandler.js | Sprint 1 |
| M04-BE-03 | scorer.js — all 7 question types | DONE | src/solve/scorer.js | Sprint 1 |
| M04-BE-04 | resultBuilder.js — score summary + breakdown | DONE | src/solve/resultBuilder.js | Sprint 1 |
| M04-BE-05 | Path traversal guard (UUID v4 validation) | DONE | UUID_REGEX in both handlers | Sprint 1 |
| M04-BE-06 | Wire routes in server.js | DONE | GET /api/solve/:id, POST /api/submit wired | Sprint 1 |
| M04-FE-01 | solve.html — interactive solve page | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-FE-02 | solve.js — timer, answer capture, submit | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-FE-03 | solve.css — solve page styles | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-FE-04 | Wire "Solve Online" button from result page | BLOCKED | Awaiting UI template | Sprint 2 |
| M04-TEST-01 | Unit tests for scorer.js | DONE | scorer.test.js — all 7 question types passing | Sprint 1 |
| M04-TEST-02 | Unit tests for resultBuilder.js | DONE | resultBuilder.test.js passing | Sprint 1 |
| M04-TEST-03 | Unit tests for solveHandler | DONE | solveHandler.test.js passing | Sprint 1 |
| M04-TEST-04 | Unit tests for submitHandler | DONE | submitHandler.test.js passing | Sprint 1 |
| M04-TEST-05 | Integration: full solve flow (generate → solve → submit) | DONE | tests/integration/solve.test.js passing | Sprint 1 |

---

## Module M05 — Progress & Reporting

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M05-BE-01 | progressHandler.js — GET /api/progress/me | DONE | progressHandler.js — GET /api/progress/history, /insights, /parent/:childId | Sprint 4 |
| M05-BE-02 | progressHandler.js — GET /api/progress/history | DONE | Included in progressHandler.js | Sprint 4 |
| M05-BE-03 | dashboardHandler.js — teacher + parent dashboards | DONE | analyticsHandler.js covers analytics; progressHandler covers parent view | Sprint 4 |
| M05-BE-04 | aggregator.js — update precomputed fields | DONE | Called by submitHandler in M04 | Sprint 4 |
| M05-BE-05 | certificateHandler.js — generate + get | DONE | certificatesHandler.js — list + download with signed tokens | Sprint 4 |
| M05-BE-06 | certificateBuilder.js — PDF generation | DONE | src/templates/certificate.html.js — HTML cert content | Sprint 4 |
| M05-CDK-001 | CDK: LearnfyraWorksheetAttempt table | DONE | LearnfyraWorksheetAttempt-local created by bootstrap-local-db.js | Sprint 4 |
| M05-CDK-002 | CDK: LearnfyraCertificates table | DONE | LearnfyraCertificates-local created by bootstrap-local-db.js | Sprint 4 |
| M05-TEST-01 | Unit tests for progressHandler | DONE | progressHandler.test.js passing | Sprint 4 |
| M05-TEST-02 | Unit tests for dashboardHandler | DONE | analyticsHandler.test.js passing | Sprint 4 |
| M05-TEST-03 | Unit tests for certificateHandler | DONE | certificatesHandler.test.js passing | Sprint 4 |
| M05-FE-01 | Student progress dashboard | BLOCKED | Awaiting UI template | Sprint 5 |
| M05-FE-02 | Teacher class dashboard | BLOCKED | Awaiting UI template | Sprint 5 |
| M05-FE-03 | Parent child progress page | BLOCKED | Awaiting UI template | Sprint 5 |
| M05-FE-04 | Certificate download UI | BLOCKED | Awaiting UI template | Sprint 5 |

---

## Module M06 — Class Management

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M06-BE-01 | classHandler.js — POST /api/classes + DELETE student | DONE | classHandler.js — POST /api/class/create | Sprint 6 |
| M06-BE-02 | classHandler.js — GET /api/classes/me | DONE | GET /api/class/:id/students | Sprint 6 |
| M06-BE-03 | classHandler.js — POST /api/classes/join | DONE | In classHandler.js | Sprint 6 |
| M06-BE-04 | classHandler.js — GET /api/classes/:id/students | DONE | GET /api/class/:id/students | Sprint 6 |
| M06-BE-05 | classHandler.js — POST /api/classes/:id/assignments | BLOCKED | Blocked on Open Question 2 (Assignments table design) | Sprint 6 |
| M06-CDK-001 | CDK: LearnfyraClasses + LearnfyraClassMemberships tables | DONE | LearnfyraClasses-local + LearnfyraClassMemberships-local created by bootstrap | Sprint 6 |
| M06-TEST-01 | Unit tests for classHandler | DONE | classHandler.test.js passing | Sprint 6 |
| M06-FE-01 | Teacher class creation page | BLOCKED | Awaiting UI template | Sprint 7 |
| M06-FE-02 | Student join-class flow | BLOCKED | Awaiting UI template | Sprint 7 |
| M06-FE-03 | Teacher class roster view | BLOCKED | Awaiting UI template | Sprint 7 |
| M06-FE-04 | Student pending assignments view | BLOCKED | Awaiting UI template | Sprint 7 |

---

## Module M07 — Admin Control Plane

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M07-BE-01 | adminHandler.js — user management endpoints | DONE | adminHandler.js — policies, model routing, budget, repeat-cap, audit events | Sprint 9 |
| M07-BE-02 | adminHandler.js — model management endpoints | DONE | PUT /api/admin/policies/model-routing | Sprint 9 |
| M07-BE-03 | adminHandler.js — worksheet oversight endpoints | DONE | Covered in adminHandler.js | Sprint 9 |
| M07-BE-04 | adminHandler.js — config management endpoints | DONE | PUT /api/admin/policies + feature flag support | Sprint 9 |
| M07-BE-05 | adminHandler.js — reports endpoints | DONE | GET /api/admin/audit/events | Sprint 9 |
| M07-CDK-001 | CDK: LearnfyraConfig table | DONE | LearnfyraConfig-local created by bootstrap-local-db.js | Sprint 9 |
| M07-TEST-01 | Unit tests for adminHandler (all RBAC cases) | DONE | adminHandler.test.js passing | Sprint 9 |
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

---

## Module M08 — LLM Generation & Routing System

| Task ID | Task | Status | Notes | Sprint |
|---|---|---|---|---|
| M08-BE-01 | `src/ai/routing/modelRouter.js` — selectModel() with haiku/sonnet routing rules | DONE | src/ai/routing/modelRouter.js | Sprint 11 |
| M08-BE-02 | `src/ai/validation/answerValidator.js` — validateAnswer() using Sonnet | DONE | src/ai/validation/answerValidator.js | Sprint 11 |
| M08-BE-03 | `src/ai/cache/questionCache.js` — in-memory TTL cache | DONE | src/ai/cache/questionCache.js | Sprint 11 |
| M08-BE-04 | `src/ai/prompts/questionPrompts.js` — structured question generation prompts | DONE | src/ai/prompts/questionPrompts.js | Sprint 11 |
| M08-BE-05 | `src/ai/prompts/validationPrompts.js` — answer validation prompts | DONE | src/ai/prompts/validationPrompts.js | Sprint 11 |
| M08-BE-06 | `src/ai/prompts/explanationPrompts.js` — explanation generation prompts | DONE | src/ai/prompts/explanationPrompts.js | Sprint 11 |
| M08-BE-07 | `src/ai/pipeline/questionPipeline.js` — 4-step generation pipeline | DONE | src/ai/pipeline/questionPipeline.js | Sprint 11 |
| M08-BE-08 | `src/ai/pipeline/batchGenerator.js` — parallel batch generation | DONE | src/ai/pipeline/batchGenerator.js | Sprint 11 |
| M08-BE-09 | `backend/handlers/generateQuestionsHandler.js` — POST /api/generate-questions | DONE | backend/handlers/generateQuestionsHandler.js | Sprint 11 |
| M08-BE-10 | Add POST /api/generate-questions route to server.js | DONE | Route wired in server.js | Sprint 11 |
| M08-TEST-01 | `tests/unit/modelRouter.test.js` — all routing rules + edge cases | DONE | modelRouter.test.js passing | Sprint 11 |
| M08-TEST-02 | `tests/unit/answerValidator.test.js` — validation pass/fail/retry | DONE | answerValidator.test.js passing | Sprint 11 |
| M08-TEST-03 | `tests/unit/questionCache.test.js` — hit/miss/TTL/flush | DONE | questionCache.test.js passing | Sprint 11 |
| M08-TEST-04 | `tests/unit/questionPipeline.test.js` — pipeline steps, retry escalation | DONE | questionPipeline.test.js passing | Sprint 11 |
| M08-TEST-05 | `tests/unit/batchGenerator.test.js` — batch of 10, concurrency limit | DONE | batchGenerator.test.js passing | Sprint 11 |
| M08-TEST-06 | `tests/unit/generateQuestionsHandler.test.js` — handler validation, 200/400/500 | DONE | generateQuestionsHandler.test.js passing | Sprint 11 |
