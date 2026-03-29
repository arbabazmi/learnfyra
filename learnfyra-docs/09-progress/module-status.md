# Module Status

**Last Updated:** 2026-03-28

---

## Local Dev Setup Status

These four setup tasks gate all sprint work. SETUP-001 and SETUP-002 are required before any sprint that touches DynamoDB local (Sprint 3 onward). SETUP-003 gates Sprint 8 (M01 Frontend). SETUP-004 gates Sprint 3 (M02).

| Task ID | Description | Status | Notes |
|---|---|---|---|
| SETUP-001 | Start dynamodb-local Docker container | TODO | `docker run -p 8000:8000 amazon/dynamodb-local` — required before Sprint 3 |
| SETUP-002 | Create DynamoDB local tables (bootstrap script) | TODO | `node scripts/bootstrap-local-db.js` — creates all local tables for M02, M05, M06 |
| SETUP-003 | Verify Google OAuth `http://localhost:3000` callback works end-to-end | TODO | Confirm `http://localhost:3000` is configured as redirect URI in Google Cloud Console |
| SETUP-004 | Seed question-bank.json with sample questions | TODO | `node scripts/seed-question-bank.js` — seeds `worksheets-local/question-bank/` |

---

## Overall Platform Completion

| Module | Backend | Frontend | Tests | CDK | Status |
|---|---|---|---|---|---|
| M01 Auth | DONE | BLOCKED (UI template) | DONE | DONE | Backend complete; frontend awaiting UI template |
| M02 Question Bank | TODO | N/A | TODO | TODO | Ready to start — Sprint 3 |
| M03 Worksheet Generator | DONE (no bank) | DONE | DONE | DONE | Bank-first pending M02 |
| M04 Solve & Submit | TODO | BLOCKED (UI template) | TODO | DONE | Ready to start — Sprint 1 |
| M05 Progress & Reporting | TODO | BLOCKED (UI template) | TODO | TODO | Blocked on M04 — Sprint 4 |
| M06 Class Management | TODO | BLOCKED (UI template) | TODO | TODO | Ready to start (M01 auth done) — Sprint 6 |
| M07 Admin Control Plane | TODO | BLOCKED (UI template) | TODO | TODO | Ready to start (M01 auth done) — Sprint 9 |

---

## M01 — Auth & Identity

**Backend Status: DONE**
- Cognito User Pool CDK: deployed to dev/staging/prod
- Lambda Authorizer: deployed, protecting all non-guest routes
- authHandler.js: all auth endpoints working (token, refresh, logout, me)
- Local auth adapter: working (APP_RUNTIME=local, LOCAL_JWT_SECRET)
- Tests: 88 tests passing

**Frontend Status: BLOCKED — Awaiting UI template from product owner**
- login.html: not built — blocked on UI template
- register.html: not built — blocked on UI template
- auth.js (PKCE, token storage, auto-refresh): not built — blocked on UI template
- Local dev note: `server.js` will inject `window.LEARNFYRA_CONFIG = { apiBase: 'http://localhost:3000', cognitoAuthorizeUrl: '', clientId: 'local', redirectUri: 'http://localhost:3000' }` for local development. Google OAuth button will be hidden when `cognitoAuthorizeUrl` is empty.
- Blocked: UI template not received. Do not start M01-FE-01 through M01-FE-05 until template is received.

**Assigned Sprint:** Sprint 8 (frontend only)

**Known Issues:** None

---

## M02 — Question Bank

**Status: Ready to start — Sprint 3**

Design is complete (see `02-modules/worksheet-generator.md` and `03-data-design/dynamodb-design.md`).

**Local development path:**
1. Start with `QB_ADAPTER=local` — no Docker or AWS required.
2. Create `src/questionBank/utils.js` (dedupeHash) first — pure function, easiest to test.
3. Create `src/questionBank/localAdapter.js` — JSON file read/write.
4. Create `src/questionBank/index.js` (factory).
5. Create `src/questionBank/dynamoAdapter.js` — requires `dynamodb-local` (SETUP-001 + SETUP-002).
6. Wire into `src/ai/generator.js` (M03-BE-05).

**Local env vars:** `QB_ADAPTER=local` for local adapter work. `QB_ADAPTER=dynamodb` + `DB_ENDPOINT=http://localhost:8000` for DynamoDB adapter testing.

**Blocking:** M03 bank-first assembly (M03-BE-05) and M03-TEST-04.

**Open Questions blocking implementation:**
- `typeRatio` map not yet defined in topics.js — needed before M03-BE-05.
- GSI on dedupeHash decision needed before QB-CDK-001.

---

## M03 — Worksheet Generator

**Backend Status: DONE (without bank-first)**
- generateHandler.js: working
- generator.js: working (ai-only mode)
- promptBuilder.js: working
- topics.js: 410 topic combinations verified
- Exporters: HTML, PDF (Puppeteer), DOCX, answer key — all working
- solve-data.json and metadata.json written correctly
- Tests: 88 unit tests passing

**Bank-first Status: BLOCKED on M02**
- Depends on QB-IMPL-001 through QB-IMPL-004 completion (Sprint 3)
- M03-BE-05 estimated at 2–3 days of development

**Frontend Status: DONE**
- frontend/index.html: working
- frontend/js/app.js: grade/subject/topic selectors working
- Generate form wired to POST /api/generate

**Known Issues:**
- generationMode and provenanceLevel fields not yet in response (pending M02)
- All generations currently ai-only mode

---

## M04 — Online Solve & Submit

**Status: Ready to start — Sprint 1**

`solve-data.json` is already written by the generator (M03-BE-07 DONE). No new storage setup is needed. Backend development can start immediately.

**Local dev path (no Docker, no DynamoDB required for local guest mode):**
1. Create `src/solve/scorer.js` — pure function, no dependencies.
2. Create `src/solve/resultBuilder.js`.
3. Create `backend/handlers/solveHandler.js`.
4. Create `backend/handlers/submitHandler.js` (includes aggregator stub — `aggregator.js` returns immediately in local mode).
5. Wire routes in `server.js`.

**Local env vars required:** `APP_RUNTIME=local`, `NODE_ENV=development`

**No DynamoDB needed locally:** When `APP_RUNTIME=local`, submitHandler operates in guest mode for all submissions. No WorksheetAttempt records are written locally. The aggregator stub is called but does nothing.

**Frontend Status: BLOCKED — Awaiting UI template from product owner**
- solve.html, solve.js, solve.css: not built — blocked on UI template
- Do not start M04-FE-01 through M04-FE-04 until UI template is received AND Sprint 1 backend is complete.

**Assigned Sprint:** Sprint 1 (backend), Sprint 2 (frontend — BLOCKED)

---

## M05 — Progress & Reporting

**Status: Blocked on M04 — Sprint 4**

Cannot start until M04 backend (Sprint 1) is complete. The `aggregator.js` stub created during Sprint 1 is replaced with the full implementation in Sprint 4.

**Local dev prerequisites (Sprint 4):**
- `dynamodb-local` Docker container running (SETUP-001)
- `LearnfyraWorksheetAttempt-local` table created (SETUP-002)
- `LearnfyraCertificates-local` table created (SETUP-002)
- M04 backend complete and `npm test` passing

**Puppeteer note:** `certificateBuilder.js` uses Puppeteer, which is already installed. No Lambda layer or Chromium setup is needed locally. For AWS deployment, a `@sparticuz/chromium` Lambda layer will be needed (Open Question M05-OQ-4).

**Frontend Status: BLOCKED — Awaiting UI template from product owner**

**Assigned Sprint:** Sprint 4 (backend), Sprint 5 (frontend — BLOCKED)

---

## M06 — Class Management

**Status: Ready to start (M01 auth done) — Sprint 6**

M01 auth backend is complete. Local auth adapter with `LOCAL_JWT_SECRET` is ready. All M06 endpoints require teacher or student JWTs, which can be signed locally.

**Local dev prerequisites:**
- `dynamodb-local` Docker container running (SETUP-001)
- `LearnfyraClasses-local` table created (SETUP-002)
- `LearnfyraClassMemberships-local` table created (SETUP-002)

**Local env vars required:** `APP_RUNTIME=local`, `LOCAL_JWT_SECRET`, `DB_ENDPOINT=http://localhost:8000`

**Open Question blocking M06-BE-05:** Assignments table design not decided (Open Question M06-OQ-2). The `POST /api/classes/:id/assignments` handler cannot be finalized until the table structure is chosen.

**Frontend Status: BLOCKED — Awaiting UI template from product owner**

**Assigned Sprint:** Sprint 6 (backend), Sprint 7 (frontend — BLOCKED)

---

## M07 — Admin Control Plane

**Status: Ready to start (M01 auth done) — Sprint 9**

M01 auth backend is complete. Admin-only JWT can be signed locally with `LOCAL_JWT_SECRET` and `role: "admin"`. No other M-series module is a hard prerequisite, though `INT-BE-03` (maintenance mode middleware) depends on the `LearnfyraConfig` table (M07-CDK-001).

**Frontend Status: BLOCKED — Awaiting UI template from product owner**

**Assigned Sprint:** Sprint 9 (backend), Sprint 10 (frontend — BLOCKED)

---

## Infrastructure

**CDK Stack Status:**

| Construct | Dev | Staging | Prod |
|---|---|---|---|
| S3 worksheets bucket | DEPLOYED | DEPLOYED | DEPLOYED |
| S3 frontend bucket | DEPLOYED | DEPLOYED | DEPLOYED |
| API Gateway | DEPLOYED | DEPLOYED | DEPLOYED |
| Lambda functions (generate, download, list) | DEPLOYED | DEPLOYED | DEPLOYED |
| Lambda Authorizer | DEPLOYED | DEPLOYED | DEPLOYED |
| CloudFront | DEPLOYED | DEPLOYED | DEPLOYED |
| Cognito User Pool | DEPLOYED | DEPLOYED | DEPLOYED |
| Secrets Manager | DEPLOYED | DEPLOYED | DEPLOYED |
| CloudWatch alarms (DOP-08) | DEPLOYED | DEPLOYED | DEPLOYED |
| CloudWatch dashboard | DEPLOYED | DEPLOYED | DEPLOYED |
| Domain routing (Route 53) | DEPLOYED | DEPLOYED | DEPLOYED |
| DynamoDB tables (M02-M07) | TODO | TODO | TODO |
| Lambda solve/submit functions | TODO | TODO | TODO |
| Lambda auth/progress/class/admin | TODO | TODO | TODO |

---

## DOP-08 Monitoring Status

**Status: COMPLETE (2026-03-26)**

All 24 CloudWatch alarms deployed:
- 12 anomaly detection alarms (per-function errors + duration)
- 4 concurrent execution alarms
- 4 API Gateway alarms (4xx, 5xx, throttle, surge)
- 4 cost/billing alarms

14-widget CloudWatch dashboard deployed.

SNS topic `learnfyra-{env}-ops-alerts` configured for all alarms.

---

## RC-BE-01 — Backend Contract Lock Status

**Status: COMPLETE (2026-03-26)**

All M01-M07 endpoint signatures frozen. 1143 tests passing.

API contracts documented in `04-api-contracts/`.

---

## RC-BE-02 — Security Hardening Status

**Status: COMPLETE (2026-03-26)**

Path traversal protection on solve/submit handlers implemented and tested.

worksheetId validated as UUID v4 before any file/S3 access. 1143 tests passing (includes RC-BE-02 regression tests).

---

## Recently Completed Work (March 2026)

- DOP-05: Promotion readiness gates documented and validated
- DOP-07: CloudWatch Logs Insights query pack created (4 queries, 4 dashboard panels)
- DOP-08: Full CloudWatch alarm and dashboard suite deployed
- RC-BE-01: All M01-M07 backend contracts locked
- RC-BE-02: Path traversal hardening on solve/submit handlers
- Domain routing: all three environments (dev/staging/prod) live on custom domains
- Rebrand: edusheet-* resources migrated to learnfyra-* naming
- BA update (2026-03-28): All 5 requirement specs updated with local-first constraints, sprint plan rewritten, master task list updated with Sprint column and SETUP tasks, module status updated with BLOCKED status for all frontend modules awaiting UI template
