# M01 Auth & M03 Worksheet Generator — Requirements & Task Board
**Date:** 2026-03-26  
**Scope:** Backend only — M01 Authentication/Authorization + M03 Worksheet Generator  
**Mode:** Requirements and task planning only — NO implementation in this document  
**Sources:** BA analysis, architect design, dev code audit, devops IaC audit — all conducted from live codebase  

---

## Status Legend
| Symbol | Meaning |
|---|---|
| [DONE] | Fully implemented and working |
| [PARTIAL] | Exists but incomplete, stubbed, or local-only |
| [MISSING] | Not implemented at all |
| [INFERRED] | Not in original spec but clearly required |
| todo | Task not started |
| in-progress | Task actively being worked |
| done | Task complete and tested |

---

# PART 1 — BA: Requirement Baselines

## 1.1 Requirement Baseline — M01: Authentication & Authorization

| REQ-AUTH-NNN | Requirement | Priority | Status | Acceptance Criteria |
|---|---|---|---|---|
| REQ-AUTH-001 | System must support local email/password registration with bcrypt hashing | P0 | [DONE] | Given a new email + valid password + role + displayName, When POST /api/auth/register, Then 200 + { userId, email, role, displayName, token } |
| REQ-AUTH-002 | System must reject duplicate email registration with 409 | P0 | [DONE] | Given an email already registered, When POST /api/auth/register, Then 409 with "account already exists" |
| REQ-AUTH-003 | System must support local email/password login | P0 | [DONE] | Given valid email + password, When POST /api/auth/login, Then 200 + { userId, email, role, displayName, token } |
| REQ-AUTH-004 | System must return 401 on invalid email or password — no distinguishing which is wrong | P0 | [DONE] | Given incorrect credentials, When POST /api/auth/login, Then 401 with generic "Invalid email or password" |
| REQ-AUTH-005 | System must support logout (client-side token invalidation for MVP) | P0 | [DONE] | Given any valid session, When POST /api/auth/logout, Then 200 + { message: 'Logged out.' } |
| REQ-AUTH-006 | System must issue JWT HS256 tokens with role claims on register and login | P0 | [DONE] | Given a successful register or login, When token is decoded, Then payload contains { sub (userId), email, role } |
| REQ-AUTH-007 | JWT tokens must expire after 7 days | P0 | [DONE] | Given a token issued at T, When verified at T+8 days, Then token is rejected with expiry error |
| REQ-AUTH-008 | JWT_SECRET must be injected from SSM in all non-development environments | P0 | [PARTIAL] | Given CDK deploys Lambda, When JWT_SECRET SSM param read, Then value is set — but AUTH_MODE=mock means real JWT signing path is bypassed in current CDK |
| REQ-AUTH-009 | System must support Google OAuth initiation — return real authorization URL | P0 | [MISSING] | Given POST /api/auth/oauth/google, When Google OAuth app credentials are set, Then real Google consent URL returned |
| REQ-AUTH-010 | System must handle Google OAuth callback — exchange code for user, issue JWT | P0 | [MISSING] | Given GET /api/auth/callback/google with valid code, When exchange succeeds, Then user created/found and JWT issued with role claims |
| REQ-AUTH-011 | System must support a second OAuth provider (GitHub or Microsoft) | P1 | [MISSING] | Given POST /api/auth/oauth/github, When real GitHub OAuth configured, Then GitHub consent URL returned and callback handled |
| REQ-AUTH-012 | Role claims must be limited to: student, teacher, parent | P0 | [DONE] | Given a register attempt with role='admin', When validated, Then 400 error — role must be one of student/teacher/parent |
| REQ-AUTH-013 | System must support an admin/super-admin role for platform operations | P0 | [MISSING] | Given an admin user, When they call admin-only endpoints, Then access is granted; non-admins receive 403 |
| REQ-AUTH-014 | All protected routes must enforce Bearer JWT validation via authMiddleware | P0 | [PARTIAL] | Given a request without Authorization header, When hitting a protected route, Then 401 returned — middleware exists but not universally applied |
| REQ-AUTH-015 | Role-based access control must be enforced via assertRole per route | P0 | [PARTIAL] | Given a student calls a teacher-only route, When assertRole(['teacher']) runs, Then 403 returned |
| REQ-AUTH-016 | System must implement a token refresh endpoint | P1 | [MISSING] | Given POST /api/auth/refresh with valid refresh token, When not expired, Then new access token returned without re-login |
| REQ-AUTH-017 | System must enforce rate limiting on auth endpoints (register, login, oauth) | P0 | [MISSING] | Given more than N requests per minute from same IP, When rate limit hit, Then 429 returned |
| REQ-AUTH-018 | Parent users must have child-link state tracked and enforced | P1 | [MISSING] | Given a parent with no linked child, When parent accesses student data, Then guided link flow shown, not data |
| REQ-AUTH-019 | System must handle multi-provider account linking (same email, Google + GitHub) [INFERRED] | P2 | [MISSING] | Given email X registered via Google, When same email X arrives via GitHub OAuth, Then accounts linked, not duplicated |
| REQ-AUTH-020 | OAuth redirect URIs must be environment-aware (localhost for dev, CloudFront domain for prod) [INFERRED] | P0 | [MISSING] | Given CDK deploy to staging/prod, When OAuth callback fires, Then redirect URI points to correct environment domain, not localhost |
| REQ-AUTH-021 | System must implement a production-grade auth adapter (Cognito) for AWS deployment | P0 | [MISSING] | Given AUTH_MODE=cognito and Cognito User Pool configured, When login occurs, Then Cognito handles credential verification and token issuance |
| REQ-AUTH-022 | All auth error responses must use consistent schema: { error: string } | P0 | [DONE] | Given any auth failure, When error returned, Then body is { error: "message" } with appropriate HTTP status |
| REQ-AUTH-023 | CORS headers must be present on all auth responses including error paths | P0 | [DONE] | Given any auth endpoint response, Then Access-Control-Allow-Origin header is present |
| REQ-AUTH-024 | OPTIONS preflight must be handled on all auth routes | P0 | [DONE] | Given OPTIONS request to any auth route, Then 200 with CORS headers and empty body |
| REQ-AUTH-025 | Email must be normalized to lowercase and trimmed before storage and lookup [INFERRED] | P0 | [DONE] | Given email " User@Example.COM ", When stored, Then stored as "user@example.com" |
| REQ-AUTH-026 | Password must not be logged or included in any response body [INFERRED] | P0 | [DONE] | Given any auth response, Then passwordHash field is stripped from all public user objects |

---

## 1.2 Requirement Baseline — M03: Worksheet Generator

| REQ-GEN-NNN | Requirement | Priority | Status | Acceptance Criteria |
|---|---|---|---|---|
| REQ-GEN-001 | POST /api/generate must remain fully backward compatible with existing clients | P0 | [DONE] | Given existing generate request body { grade, subject, topic, difficulty, questionCount, format }, When sent, Then existing response shape { success, worksheetKey, answerKeyKey, metadata, worksheetId } returned unchanged |
| REQ-GEN-002 | System must use bank-first assembly — query question bank before calling AI | P0 | [DONE] | Given a generate request, When bank has matching questions, Then banked questions are selected first before AI is called |
| REQ-GEN-003 | AI must only be called for question slots not covered by the bank | P0 | [DONE] | Given bank covers 6 of 10 requested questions, When assembler runs, Then AI called for exactly 4 questions |
| REQ-GEN-004 | Model tier must be selected based on missing count and difficulty | P0 | [DONE] | Given missingCount ≤ 5, When model selected, Then haiku-tier used; missingCount > 15 or Hard+count>10 → premium tier |
| REQ-GEN-005 | Each AI-generated question must be validated before being stored to bank | P0 | [DONE] | Given AI returns a question, When validateQuestion runs, Then invalid questions are rejected and not stored |
| REQ-GEN-006 | Valid AI-generated questions must be stored to the question bank | P0 | [DONE] | Given a validated AI question, When addIfNotExists called, Then question stored with deduplication check |
| REQ-GEN-007 | Question reuse must be tracked (reuseCount incremented) for banked questions | P0 | [DONE] | Given a banked question is used in a worksheet, When recordQuestionReuse called, Then reuseCount incremented |
| REQ-GEN-008 | All questions must be renumbered 1..N after bank+AI merge | P0 | [DONE] | Given 6 banked + 4 AI questions, When merged, Then questions numbered 1–10 sequentially |
| REQ-GEN-009 | Worksheet JSON must include provenance metadata (banked vs AI-generated per question) | P1 | [PARTIAL] | Given a generated worksheet, When JSON inspected, Then each question has provenance field indicating source |
| REQ-GEN-010 | solve-data.json must be written alongside the worksheet on every generation | P0 | [PARTIAL] | Given POST /api/generate succeeds, When worksheets-local/{uuid}/ inspected, Then solve-data.json contains full worksheet with answers |
| REQ-GEN-011 | POST /api/generate must require a valid JWT (auth enforcement) | P0 | [MISSING] | Given a request without Authorization header, When POST /api/generate called, Then 401 returned |
| REQ-GEN-012 | Only teacher role may call POST /api/generate [INFERRED] | P1 | [MISSING] | Given a student JWT, When POST /api/generate called, Then 403 returned |
| REQ-GEN-013 | System must enforce per-user/role generation quota [INFERRED] | P1 | [MISSING] | Given a teacher has generated 50 worksheets today, When they generate another, Then quota check runs and throttles if exceeded |
| REQ-GEN-014 | Generated worksheet must be associated with the requesting teacher's userId | P1 | [MISSING] | Given a teacher with userId X generates a worksheet, When metadata.json written, Then teacherId: X is present |
| REQ-GEN-015 | System must return a structured error with errorCode on all failure paths | P0 | [DONE] | Given any generation failure, When error returned, Then body contains { success: false, error, errorCode, errorStage, requestId } |
| REQ-GEN-016 | CORS headers must be present on all generate responses including error paths | P0 | [DONE] | Given any generate response, Then Access-Control-Allow-Origin header is present |
| REQ-GEN-017 | Worksheet and answer-key files must be uploaded to S3 after generation | P0 | [DONE] | Given successful generation, When S3 inspected, Then worksheets/{date}/{uuid}/worksheet.{ext} and answer-key.{ext} present |
| REQ-GEN-018 | API key (ANTHROPIC_API_KEY) must be loaded from SSM Parameter Store on Lambda cold start | P0 | [DONE] | Given Lambda cold start, When SSM_PARAM_NAME env var set, Then API key fetched from SSM and cached in module scope |
| REQ-GEN-019 | System must have an integration test covering the full bank-first generation flow | P0 | [MISSING] | Given integration test suite, When bank-first flow run end-to-end, Then worksheet generated, bank queried, AI gap-filled, stored, result returned |
| REQ-GEN-020 | Input validation must reject invalid grade, subject, topic, questionCount, format values | P0 | [DONE] | Given invalid request body, When validateGenerateBody runs, Then 400 returned with specific field error |
| REQ-GEN-021 | Question bank adapter must be configurable for local (JSON) vs production (future DB) use | P1 | [PARTIAL] | Given QB_ADAPTER=local env var, When question bank queried, Then local JSON adapter used; future QB_ADAPTER=dynamodb should route to DynamoDB |
| REQ-GEN-022 | System must support optional student name personalization on worksheet | P1 | [DONE] | Given studentName in request body, When worksheet generated, Then student name appears on the worksheet |
| REQ-GEN-023 | Worksheet expiry lifecycle (7 days) must be enforced at S3 level | P0 | [DONE] | Given a worksheet uploaded to S3, When 7+ days pass, Then S3 lifecycle rule expires the object |

---

# PART 2 — ARCHITECT: Design Decisions & Solution Approach

## 2.1 Design Decisions — M01 Auth

| DEC-AUTH-NNN | Decision | Chosen Approach | Rationale | Blocking REQs |
|---|---|---|---|---|
| DEC-AUTH-001 | Production auth strategy: Cognito vs custom JWT | **Cognito Hosted UI + PKCE flow** for OAuth; custom JWT (current tokenUtils.js) for local dev | Cognito handles OAuth token exchange, PKCE, user pool, MFA, refresh tokens natively. Avoid reinventing secure auth. | REQ-AUTH-009, REQ-AUTH-010, REQ-AUTH-021 |
| DEC-AUTH-002 | Token refresh strategy | **Short-lived access token (1h) + long-lived refresh token (30d)** via Cognito token rotation | 7-day JWT with no refresh is a security risk — stolen token valid for 7 days. Cognito provides this out of the box. | REQ-AUTH-016 |
| DEC-AUTH-003 | API Gateway authorization | **API Gateway Lambda Authorizer** (custom JWT verifier) for protected routes | Prevents unauthenticated traffic from reaching Lambda at all. Lower cost, better security than handler-level only. | REQ-AUTH-014, REQ-AUTH-015 |
| DEC-AUTH-004 | Rate limiting on auth endpoints | **API Gateway Usage Plan + per-route throttle overrides** for /auth/register and /auth/login | API GW handles at edge, no Lambda invocation cost for blocked requests. App-level rate limiting not needed for MVP. | REQ-AUTH-017 |
| DEC-AUTH-005 | Admin role strategy | **JWT role claim: 'admin'** added to VALID_ROLES + assertRole(['admin']) middleware | Simple, consistent with existing role claim pattern. Admin user created via seeding, not self-registration. | REQ-AUTH-013 |
| DEC-AUTH-006 | OAuth redirect URI strategy | **Environment variable OAUTH_CALLBACK_BASE_URL** — set to localhost:3000 (dev), CloudFront domain (staging/prod) via CDK env | Avoids hardcoded localhost in prod Lambda. CDK injects the correct base URL per environment. | REQ-AUTH-020 |
| DEC-AUTH-007 | Multi-provider account linking | **Email as primary identity key** — if OAuth email matches existing account, link provider; do not create duplicate account | Simplest safe approach. Flag linked providers in user record. Defer complex account merge flows. | REQ-AUTH-019 |
| DEC-AUTH-008 | Parent-child link enforcement | **Separate parentLinks table** (already exists in data-local/parentLinks.json) — middleware check on student data routes | Not in auth token — checked at route handler level when parent accesses student resources. | REQ-AUTH-018 |

## 2.2 Design Decisions — M03 Generator

| DEC-GEN-NNN | Decision | Chosen Approach | Rationale | Blocking REQs |
|---|---|---|---|---|
| DEC-GEN-001 | Auth enforcement on POST /api/generate | **HTTP header: Authorization Bearer JWT** — validated via authMiddleware.validateToken() before generation | Consistent with all other protected routes. Minimal change to existing handler. | REQ-GEN-011 |
| DEC-GEN-002 | Role restriction on generate | **teacher role only** — assertRole(['teacher']) after validateToken | Students should not generate custom worksheets (they solve assigned ones). Admin may also generate. | REQ-GEN-012 |
| DEC-GEN-003 | Teacher-worksheet association | **teacherId added to metadata.json and solve-data.json** — extracted from JWT payload after validateToken | Does not change client-facing response shape. Teachership tracked in metadata only. | REQ-GEN-014 |
| DEC-GEN-004 | Question bank storage for production | **DynamoDB** — single-table design, keyed by grade+subject+topic | S3/JSON not viable at scale. Question bank needs filtering, dedup check, reuseCount updates. DynamoDB provides this with low cost. | REQ-GEN-021 |
| DEC-GEN-005 | Quota enforcement strategy | **DynamoDB counter per teacherId per day** OR **API Gateway Usage Plan per API key** — decision needed (see GAP-003) | App-level DynamoDB counter is more granular but adds complexity. API GW usage plan is simpler but less user-aware. | REQ-GEN-013 |
| DEC-GEN-006 | solve-data.json storage | **Always written to worksheets-local/{uuid}/solve-data.json (dev)** and **S3 key: worksheets/{date}/{uuid}/solve-data.json (prod)** — must verify assembler writes it | Confirmed in assembler documentation but not verified end-to-end. Needs audit task. | REQ-GEN-010 |

---

# PART 3 — DEV: Code Audit

## 3.1 M01 Auth — File-by-File Audit

| File | Exists | Status | What It Does | Missing / Incomplete | Rewrite Needed? |
|---|---|---|---|---|---|
| backend/handlers/authHandler.js | YES | PARTIAL | Routes: register, login, logout, oauth/:provider, callback/:provider. Full handler logic. | No token refresh route. No admin role support. No rate limiting. OAuth routes call stub adapter only. | No — extend |
| src/auth/index.js | YES | PARTIAL | Auth adapter factory. Returns mockAuthAdapter. Throws on cognito. | Cognito adapter branch throws error — not implemented. | No — extend |
| src/auth/mockAuthAdapter.js | YES | DONE (local) | bcrypt user create/verify/token, local JSON DB, authType field | Production-only: no Cognito path | No — keep, add cognito adapter separately |
| src/auth/oauthStubAdapter.js | YES | PARTIAL (stub only) | Returns fake authorization URLs and mock users. Google + GitHub stub. CSRF state generated but not validated. | No real OAuth exchange. No real token exchange. No real user creation from OAuth profile. | No — keep for local dev, add real adapter |
| src/auth/tokenUtils.js | YES | DONE | JWT HS256 sign/verify, JWT_SECRET from env, 7-day default expiry | No refresh token logic | No — extend for refresh token |
| backend/middleware/authMiddleware.js | YES | DONE | validateToken (Bearer JWT) + assertRole (allowlist). Case-insensitive header read. | Not applied universally — each handler must call explicitly | No — keep as-is |
| tests/unit/authHandler.test.js | YES | PARTIAL | Exists — covers register, login, logout, oauth routes | Scope of coverage unknown without reading; needs audit | — |
| tests/unit/authMiddleware.test.js | YES | DONE | Exists | — | — |
| tests/unit/oauthStubAdapter.test.js | YES | DONE | Exists | — | — |
| tests/unit/tokenUtils.test.js | YES | DONE | Exists | — | — |
| tests/integration/auth*.test.js | NO | MISSING | No auth integration test exists | Full round-trip register → login → access protected route not tested | — |

## 3.2 M01 Auth — Feature Coverage Matrix

| Feature | Implemented | Partial | Missing | Notes |
|---|---|---|---|---|
| Local register | ✅ | | | bcrypt, dedup check, role validation |
| Local login | ✅ | | | Password verify, JWT issue |
| Logout | ✅ | | | Client-side only (stateless) |
| Google OAuth (real) | | | ❌ | oauthStubAdapter only — no real PKCE/token exchange |
| GitHub OAuth (real) | | | ❌ | oauthStubAdapter stub — no real flow |
| JWT issuance with role claims | ✅ | | | sub, email, role in payload |
| Token expiry (7 days) | ✅ | | | signToken expiresIn='7d' |
| Token refresh | | | ❌ | No /api/auth/refresh route, no refresh token concept |
| Role claims: teacher/student/parent | ✅ | | | VALID_ROLES enforced |
| Admin role | | | ❌ | Not in VALID_ROLES |
| Protected routes via middleware | | ✅ | | Middleware exists but must be called per-handler, not auto |
| Parent-child link enforcement | | | ❌ | parentLinks.json exists but no auth layer enforcement |
| Rate limiting | | | ❌ | Only global API GW throttle (2/s dev, 10/s prod) |
| Multi-provider account linking | | | ❌ | Not designed |
| Cognito adapter (prod) | | | ❌ | Throws "not yet implemented" |
| Auth integration test | | | ❌ | No integration test file for auth |
| Email normalization | ✅ | | | toLowerCase().trim() on register and login |
| CORS on all responses | ✅ | | | corsHeaders added to all responses |

## 3.3 M03 Generator — File-by-File Audit

| File | Exists | Status | What It Does | Missing / Incomplete | Rewrite Needed? |
|---|---|---|---|---|---|
| backend/handlers/generateHandler.js | YES | PARTIAL | Full handler: S3 upload, SSM API key fetch, lazy imports, error codes, CORS, request logging | No auth enforcement (unauthenticated). No teacherId extraction. No quota check. | No — extend |
| src/ai/assembler.js | YES | DONE | Bank-first pipeline: bank query → selection → AI gap fill → validate → store → reuse track → merge and renumber | solve-data.json write — documented but needs end-to-end verification | No — verify solve-data write |
| src/ai/generator.js | YES | DONE | Core generation logic, validateQuestion, extractJSON, coerceTypes | — | No |
| src/ai/client.js | YES | DONE | Anthropic API client, model constants | — | No |
| src/ai/promptBuilder.js | YES | DONE | System + user prompts, strict retry prompt | — | No |
| src/ai/modelRouter.js | YES | DONE | Model tier selection (haiku/sonnet/premium) | — | No |
| src/ai/topics.js | YES | DONE | Curriculum topics by grade/subject | — | No |
| src/exporters/index.js | YES | DONE | Export dispatch for PDF/HTML/DOCX | — | No |
| src/exporters/answerKey.js | YES | DONE | Answer key export | — | No |
| tests/unit/assembler.test.js | YES | DONE | Exists | — | — |
| tests/unit/generateHandler.test.js | YES | DONE | Exists | — | — |
| tests/unit/generator.test.js | YES | DONE | Exists | — | — |
| tests/unit/modelRouter.test.js | YES | DONE | Exists | — | — |
| tests/integration/generate*.test.js | NO | MISSING | No generator integration test for bank-first flow | Full flow: POST generate → bank → AI → S3 → response not tested end-to-end | — |

## 3.4 M03 Generator — Feature Coverage Matrix

| Feature | Implemented | Partial | Missing | Notes |
|---|---|---|---|---|
| POST /api/generate backward compat | ✅ | | | Response shape preserved |
| Bank-first assembly | ✅ | | | assembler.js full pipeline |
| AI question generation (gap fill) | ✅ | | | withRetry, model selection |
| Question validation before bank store | ✅ | | | validateQuestion per question |
| Question reuse tracking | ✅ | | | recordQuestionReuse called |
| solve-data.json storage | | ✅ | | Documented in assembler — needs end-to-end verification |
| Provenance metadata | | ✅ | | Partial — source field on some questions |
| Auth enforcement on /api/generate | | | ❌ | No validateToken call in generateHandler |
| Per-role access restriction | | | ❌ | No assertRole in generateHandler |
| Per-user/role quota | | | ❌ | Not implemented |
| Teacher-worksheet association | | | ❌ | No teacherId in metadata |
| S3 upload (worksheet + answer key) | ✅ | | | uploadToS3 function present |
| SSM API key loading | ✅ | | | loadApiKey() with module-scope cache |
| Error response contract | ✅ | | | { success, error, errorCode, errorStage, requestId } |
| Input validation | ✅ | | | validateGenerateBody from middleware/validator.js |
| Generator integration test | | | ❌ | No integration test for full bank-first flow |
| Question bank adapter config | | ✅ | | QB_ADAPTER=local works; QB_ADAPTER=dynamodb not implemented |

---

# PART 4 — DEVOPS: IaC Audit

## 4.1 CDK Stack — Lambda Inventory

| Function Name | Handler File | Memory | Timeout | Key Env Vars | Auth Routes Wired | Notes |
|---|---|---|---|---|---|---|
| learnfyra-{env}-lambda-generate | generateHandler.js | 512MB(dev)/1024MB(prod) | 60s | WORKSHEET_BUCKET_NAME, CLAUDE_MODEL, SSM_PARAM_NAME, MAX_RETRIES, QB_ADAPTER=local | POST /api/generate | X86_64 (Chromium/PDF), SSM key wired, S3 grantPut+grantRead |
| learnfyra-{env}-lambda-auth | authHandler.js | 256MB | 15s | AUTH_MODE=mock, APP_RUNTIME=local, JWT_SECRET (from SSM) | POST /api/auth/register, login, logout, oauth/{provider}, GET callback/{provider} | **AUTH_MODE=mock hardcoded — real auth bypassed in AWS** |
| learnfyra-{env}-lambda-download | downloadHandler.js | 256MB | 30s | WORKSHEET_BUCKET_NAME | GET /api/download | S3 grantRead |
| learnfyra-{env}-lambda-solve | solveHandler.js | 128MB | 10s | WORKSHEET_BUCKET_NAME | GET /api/solve/{worksheetId} | S3 grantRead |
| learnfyra-{env}-lambda-submit | submitHandler.js | 256MB | 15s | WORKSHEET_BUCKET_NAME | POST /api/submit | S3 grantRead |
| learnfyra-{env}-lambda-progress | progressHandler.js | 256MB | 15s | AUTH_MODE=mock | GET/POST /api/progress/* | No S3 |
| learnfyra-{env}-lambda-analytics | analyticsHandler.js | 256MB | 15s | AUTH_MODE=mock | GET /api/analytics/class/{id} | No S3 |
| learnfyra-{env}-lambda-class | classHandler.js | 128MB | 10s | AUTH_MODE=mock | GET/POST /api/class/* | No S3 |
| learnfyra-{env}-lambda-rewards | rewardsHandler.js | 128MB | 10s | AUTH_MODE=mock | GET /api/rewards/* | No S3 |
| learnfyra-{env}-lambda-student | studentHandler.js | 128MB | 10s | AUTH_MODE=mock | GET/POST /api/student/* | No S3 |
| learnfyra-{env}-lambda-admin | questionBankHandler.js | 256MB | 15s | QB_ADAPTER=local | GET/POST /api/qb/questions/* | No S3 |

## 4.2 M01 Auth — IaC Gap Analysis

| Component | Exists in CDK | Missing | Notes |
|---|---|---|---|
| Auth Lambda function | ✅ YES | — | learnfyra-{env}-lambda-auth |
| All 5 auth API routes wired | ✅ YES | — | register, login, logout, oauth/{provider}, callback/{provider} |
| JWT_SECRET from SSM | ✅ YES (SSM read) | — | /learnfyra/{env}/jwt-secret — but AUTH_MODE=mock skips real usage |
| Cognito User Pool | ❌ NO | Full Cognito User Pool + App Client + Identity Provider config | Required for real OAuth and production auth |
| Real OAuth secrets (Google/GitHub client IDs) | ❌ NO | AWS Secrets Manager or SSM params for OAuth client IDs/secrets | Required for real Google/GitHub OAuth flows |
| OAUTH_CALLBACK_BASE_URL env var on auth Lambda | ❌ NO | Needs env var pointing to CloudFront domain per environment | Currently hardcoded localhost:3000 in oauthStubAdapter |
| API Gateway Lambda Authorizer | ❌ NO | JWT authorizer to protect routes at API GW level | Currently only handler-level validation |
| Per-route throttling on auth endpoints | ❌ NO | Throttle overrides for /auth/register and /auth/login specifically | Only global API GW throttle: 2/s (dev), 10/s (prod) |
| AUTH_MODE env var for real mode | ❌ NO (set to 'mock') | AUTH_MODE=cognito for staging/prod environments | Currently hardcoded to 'mock' in CDK for ALL environments |
| APP_RUNTIME env var for real mode | ❌ NO (set to 'local') | Remove or update APP_RUNTIME for Lambda deployments | Set to 'local' which may affect internal logic |
| CloudWatch alarm for auth errors | ✅ YES | — | Error + duration + error-rate alarms defined |

## 4.3 M03 Generator — IaC Gap Analysis

| Component | Exists in CDK | Missing | Notes |
|---|---|---|---|
| Generate Lambda function | ✅ YES | — | Correct memory, timeout, arch (X86_64 for Chromium) |
| S3 worksheet bucket | ✅ YES | — | learnfyra-{env}-s3-worksheets, private, 7-day lifecycle |
| S3 grantPut + grantRead on generate Lambda | ✅ YES | — | Correctly configured |
| SSM param for ANTHROPIC_API_KEY | ✅ YES | — | /learnfyra/{env}/anthropic-api-key, SSM grantRead on Lambda |
| CLAUDE_MODEL env var | ✅ YES | — | claude-sonnet-4-20250514 |
| QB_ADAPTER env var | ✅ YES | — | QB_ADAPTER=local — DynamoDB adapter not wired |
| DynamoDB table for question bank | ❌ NO | Full DynamoDB table definition for production question bank | Currently local JSON only |
| DynamoDB IAM permissions for generate Lambda | ❌ NO | grantReadWriteData on question bank table | Required when QB_ADAPTER=dynamodb |
| LOW_COST_MODEL env var | ❌ NO | Optional: LOW_COST_MODEL and PREMIUM_MODEL env vars for model overrides | Falls back to hardcoded defaults in assembler.js |
| S3 solve-data.json path IAM | ✅ YES (grantPut) | — | grantPut covers solve-data.json write path |
| CloudWatch alarm for generate errors | ✅ YES | — | Errors + duration + error-rate alarms |

## 4.4 CI/CD Audit

| Workflow File | Trigger | What It Does | Gaps |
|---|---|---|---|
| ci.yml | PR/push to main/develop/staging | npm test + coverage gate (≥80%) + CDK synth + CDK tests | No integration test step; coverage gate uses string not JSON |
| deploy-dev.yml | workflow_dispatch (manual) | Tests → AWS OIDC → SSM write API key → CDK bootstrap → CDK deploy → S3 frontend sync | AUTH_MODE=mock deployed to AWS dev; no JWT_SECRET SSM write step; no smoke tests after deploy |
| deploy-staging.yml | (not read — assumed exists) | Similar to dev | Needs audit |
| deploy-prod.yml | (not read — assumed exists) | Manual approval gate → prod deploy | Needs audit |

## 4.5 Critical IaC Blockers (M01 + M03)

| BLOCKER | Description | Impact | Priority |
|---|---|---|---|
| AUTH_MODE=mock hardcoded in CDK for ALL environments | Even in staging/prod Lambda, AUTH_MODE=mock means only the mock adapter runs — real auth never executes on AWS | Auth never works as real system on AWS | P0 CRITICAL |
| APP_RUNTIME=local in Lambda env | Some code may branch on APP_RUNTIME; set to 'local' in Lambda environment | Undefined behavior in cloud | P0 |
| No Cognito User Pool in CDK | Cannot do real OAuth without Cognito Hosted UI or direct PKCE | Real OAuth impossible on AWS | P0 |
| No OAuth secrets in Secrets Manager | Google/GitHub client IDs/secrets not stored anywhere in AWS | Real OAuth flows cannot authenticate | P0 |
| OAUTH_CALLBACK_BASE_URL not wired | Callback URL hardcoded to localhost:3000 in oauthStubAdapter | OAuth callbacks fail in AWS | P0 |
| Question bank is local JSON only | QB_ADAPTER=local in Lambda — reads from data-local/ which doesn't exist in Lambda /tmp | Question bank features non-functional in AWS | P1 |
| No API Gateway authorizer | Protected routes have no gateway-level enforcement | Unauthorized traffic reaches Lambda | P1 |
| No per-route auth endpoint throttling | Auth endpoints shared with global 10/s limit — brute force risk | Security gap | P1 |
| deploy-dev.yml writes Anthropic SSM param but NOT JWT_SECRET SSM param | JWT_SECRET SSM param must be pre-populated manually or added to deploy workflow | JWT signing fails on cold Lambda if param missing | P0 |

---

# PART 5 — TASK BOARDS

## 5.1 Task Items — M01 Authentication & Authorization

| Task ID | Title | Priority | Status | Depends On | Acceptance Hook | Owner Agent |
|---|---|---|---|---|---|---|
| TASK-AUTH-001 | Define real OAuth contract (Google + GitHub): PKCE flow, callback URL strategy, env var design | P0 | todo | — | Contract document approved, redirect URI strategy decided for all envs | architect-agent |
| TASK-AUTH-002 | Define Cognito vs custom JWT decision: token refresh strategy, access/refresh token lifecycle | P0 | todo | — | Decision recorded in GAP table, approach chosen | architect-agent |
| TASK-AUTH-003 | Add admin role: extend VALID_ROLES, add 'admin' to register, authHandler, and assertRole tests | P0 | todo | DEC-AUTH-005 | admin role accepted in register; assertRole(['admin']) blocks non-admin; tests pass | dev-agent |
| TASK-AUTH-004 | Implement real Google OAuth flow: real PKCE, token exchange, user lookup/create from Google profile | P0 | todo | TASK-AUTH-001, TASK-AUTH-013 (Cognito IaC) | POST /api/auth/oauth/google returns real Google consent URL; callback issues real JWT; integration test passes | dev-agent |
| TASK-AUTH-005 | Implement real GitHub OAuth flow: real token exchange, user lookup/create from GitHub profile | P1 | todo | TASK-AUTH-001, TASK-AUTH-013 (Cognito IaC) | POST /api/auth/oauth/github returns real consent URL; callback works; integration test passes | dev-agent |
| TASK-AUTH-006 | Implement token refresh endpoint: POST /api/auth/refresh | P1 | todo | TASK-AUTH-002 | Valid refresh token → new access token; expired refresh token → 401; tests pass | dev-agent |
| TASK-AUTH-007 | Add parent-child link enforcement: validate parentLinks before parent accesses student data | P1 | todo | — | Parent with no linked child → 403 with link guidance; linked parent → access granted; tests pass | dev-agent |
| TASK-AUTH-008 | Write auth integration test: full register → login → access protected route → logout flow | P0 | todo | — | Integration test covers register, login, token use on protected route, logout; all pass | qa-agent |
| TASK-AUTH-009 | Implement multi-provider account linking: same email, Google + GitHub | P2 | todo | TASK-AUTH-004, TASK-AUTH-005 | Same email via second provider links to existing account; no duplicate user created; tests pass | dev-agent |
| TASK-AUTH-010 | Remove AUTH_MODE=mock and APP_RUNTIME=local from CDK Lambda env for non-dev environments | P0 | todo | TASK-AUTH-013 | Staging/prod Lambda env: AUTH_MODE=cognito (or appropriate real mode); dev: mock kept | devops-agent |
| TASK-AUTH-011 | Add OAUTH_CALLBACK_BASE_URL env var to auth Lambda in CDK per environment | P0 | todo | TASK-AUTH-001 | dev: localhost:3000, staging: CloudFront staging URL, prod: CloudFront prod URL | devops-agent |
| TASK-AUTH-012 | Set up JWT_SECRET SSM parameter write in deploy workflows (all envs) | P0 | todo | — | deploy-dev.yml, deploy-staging.yml, deploy-prod.yml each write JWT_SECRET to SSM before CDK deploy | devops-agent |
| TASK-AUTH-013 | Add Cognito User Pool + App Client + Google/GitHub identity providers to CDK | P0 | todo | TASK-AUTH-002 | CDK synth passes; Cognito User Pool defined; Google + GitHub IdP configured; App Client with correct OAuth flow | devops-agent |
| TASK-AUTH-014 | Store OAuth client IDs and secrets in AWS Secrets Manager and wire to auth Lambda | P0 | todo | TASK-AUTH-013 | Google and GitHub OAuth credentials in Secrets Manager; auth Lambda has IAM read access | devops-agent |
| TASK-AUTH-015 | Add API Gateway Lambda Authorizer for protected routes | P1 | todo | TASK-AUTH-013 | API GW blocks unauthenticated requests before Lambda invoke on protected routes; CDK updated | devops-agent |
| TASK-AUTH-016 | Add per-route throttle overrides on auth endpoints (/register, /login) in CDK | P0 | todo | — | /auth/register and /auth/login have stricter throttle than global (e.g. 1/s burst 2) | devops-agent |
| TASK-AUTH-017 | Implement Cognito auth adapter: src/auth/cognitoAdapter.js — token verify, user sync | P0 | todo | TASK-AUTH-013 | AUTH_MODE=cognito routes to cognitoAdapter; verifyToken validates Cognito JWT; createUser syncs with User Pool |dev-agent |
| TASK-AUTH-018 | Security review: review entire auth flow for OWASP Top 10 gaps | P0 | todo | TASK-AUTH-003 through TASK-AUTH-009 | Security review report produced; all critical findings resolved before staging deploy | code-reviewer-agent |

## 5.2 Task Items — M03 Worksheet Generator

| Task ID | Title | Priority | Status | Depends On | Acceptance Hook | Owner Agent |
|---|---|---|---|---|---|---|
| TASK-GEN-001 | Add auth enforcement to POST /api/generate: validateToken + assertRole(['teacher','admin']) | P0 | todo | TASK-AUTH-003 | Unauthenticated generate → 401; student JWT → 403; teacher JWT → proceeds; tests updated | dev-agent |
| TASK-GEN-002 | Verify solve-data.json write: trace through assembler.js to confirm solve-data.json is always written in local dev | P0 | todo | — | Integration test or trace confirms solve-data.json exists after POST /api/generate; location: worksheets-local/{uuid}/solve-data.json | qa-agent |
| TASK-GEN-003 | Audit provenance metadata: confirm every question in assembled worksheet has source field (banked vs generated) | P1 | todo | — | Assembler output inspection — all questions have { source: 'bank' } or { source: 'ai' } field | qa-agent |
| TASK-GEN-004 | Add teacherId to metadata.json and solve-data.json from JWT payload after validateToken | P1 | todo | TASK-GEN-001 | metadata.json contains teacherId: userId from JWT; solve-data.json also updated; tests pass | dev-agent |
| TASK-GEN-005 | Define generation quota contract: per-teacher daily limit, quota enforcement approach decision | P1 | todo | — | Architecture decision recorded: API GW usage plan vs DynamoDB counter — quota contract spec written | architect-agent + ba-agent |
| TASK-GEN-006 | Write generator bank-first integration test: full flow POST /api/generate → bank query → AI fill → S3 → response | P0 | todo | — | Integration test in tests/integration/ covers all assembler stages; bank hit and AI fill both tested | qa-agent |
| TASK-GEN-007 | Input validation hardening: add max length constraints to topic, studentName, worksheetDate fields | P1 | todo | — | Oversized inputs rejected with 400; tests cover boundary values | dev-agent |
| TASK-GEN-008 | Resolve QB_ADAPTER strategy for production: define DynamoDB table schema and wiring plan (no code) | P1 | todo | — | DynamoDB single-table design documented; CDK task items created for IaC; QB adapter interface defined | architect-agent |
| TASK-GEN-009 | Add DynamoDB table for question bank to CDK stack | P1 | todo | TASK-GEN-008 | CDK synth passes; DynamoDB table defined; generate Lambda has grantReadWriteData; CDK tests updated | devops-agent |
| TASK-GEN-010 | Add LOW_COST_MODEL and PREMIUM_MODEL env vars to generate Lambda in CDK | P2 | todo | — | CDK env vars set; assembler.js reads them; model selection tests verify env override works | devops-agent |
| TASK-GEN-011 | Add generator integration test to CI pipeline | P0 | todo | TASK-GEN-006 | ci.yml runs integration tests (mocked S3, mocked AI) as part of PR gate | devops-agent |
| TASK-GEN-012 | Security review: input sanitization, S3 key injection risks, API key exposure | P0 | todo | TASK-GEN-001 | Review report; all critical findings resolved; no user-controlled values in S3 key paths | code-reviewer-agent |

---

# PART 6 — GAPS & OPEN DECISIONS

| GAP-NNN | Decision Needed | Blocking Tasks | Priority |
|---|---|---|---|
| GAP-001 | **OAuth redirect URL final values per env**: What are the exact CloudFront URLs for dev/staging/prod? Must be set before Cognito app client created. | TASK-AUTH-011, TASK-AUTH-013 | P0 |
| GAP-002 | **Cognito vs custom JWT for production**: Use Cognito Hosted UI + PKCE (simpler, managed) vs build full PKCE flow with custom JWT (more control)? | TASK-AUTH-002, TASK-AUTH-013, TASK-AUTH-017 | P0 |
| GAP-003 | **Token refresh strategy**: Short-lived access (1h) + long-lived refresh (30d) vs extend existing 7-day JWT? Cognito handles this natively if Cognito chosen. | TASK-AUTH-006 | P1 |
| GAP-004 | **Admin role provisioning**: How are admin users created? Self-registration with promo code? Seeded user in DB? Manual AWS console? | TASK-AUTH-003 | P0 |
| GAP-005 | **Rate limiting approach for auth**: API GW per-route throttle (simple, no infra) vs WAF rate-based rule (more powerful, adds cost) vs app-level Redis counter (most granular, most complex)? | TASK-AUTH-016 | P0 |
| GAP-006 | **Worksheet ownership model in storage**: teacherId in metadata.json only, or also in S3 key prefix? S3 key: worksheets/{teacherId}/{date}/{uuid}/ for tenant isolation? | TASK-GEN-004, TASK-GEN-009 | P1 |
| GAP-007 | **Question bank production storage**: DynamoDB confirmed as the right choice? Or PostgreSQL via RDS? DynamoDB preferred — decide table design (single-table vs per-entity). | TASK-GEN-008, TASK-GEN-009 | P1 |
| GAP-008 | **Generation quota enforcement**: Per-teacher per-day counter in DynamoDB? Or API Gateway Usage Plan with per-key throttle? | TASK-GEN-005 | P2 |
| GAP-009 | **Second OAuth provider selection**: GitHub or Microsoft? Affects Cognito IdP configuration. | TASK-AUTH-005 | P1 |
| GAP-010 | **Parent-child link UX**: What happens when parent has no linked child? Redirect to link page? Error? In-app guided flow? Needed before TASK-AUTH-007 can proceed. | TASK-AUTH-007 | P1 |

---

# PART 7 — OUT OF SCOPE (This Pass)

### M01 Auth — Out of Scope
- LMS SSO (Google Classroom, Clever, Canvas integration)
- Multi-tenant school federation / district-level accounts
- MFA / 2FA enforcement
- Account recovery / forgot-password flow (can email reset link)
- Social login beyond Google + GitHub (Facebook, Apple, etc.)
- Passwordless login (magic link, passkeys)
- Audit logging of auth events to CloudWatch / DynamoDB
- SCIM provisioning for bulk user import

### M03 Generator — Out of Scope
- Frontend changes to the generate form
- Exporter rendering changes (PDF/DOCX/HTML layout)
- Solve/submit scoring changes (separate module M04)
- Any AWS deployment of new question bank DynamoDB table (IaC task planned, not in this pass)
- Worksheet sharing between teachers
- Batch worksheet generation
- Curriculum standard tagging UI (tags exist in JSON, no management UI)
- AI model fine-tuning or custom model training

---

# PART 8 — PRIORITIZED EXECUTION ORDER

Based on dependencies and blockers:

**Wave 1 — Unblock everything (no code):**
1. GAP-001: Get final CloudFront URLs for all environments
2. GAP-002: Decide Cognito vs custom JWT
3. GAP-004: Decide admin role provisioning
4. GAP-009: Choose GitHub or Microsoft as second OAuth provider
5. TASK-AUTH-001: OAuth contract document
6. TASK-AUTH-002: Token refresh strategy decision

**Wave 2 — IaC foundation (devops-agent, no app code):**
7. TASK-AUTH-012: JWT_SECRET SSM write in deploy workflows
8. TASK-AUTH-016: Per-route throttle on auth endpoints
9. TASK-AUTH-013: Cognito User Pool + IdPs in CDK
10. TASK-AUTH-014: OAuth secrets in Secrets Manager
11. TASK-AUTH-010: Remove AUTH_MODE=mock from non-dev envs
12. TASK-AUTH-011: Add OAUTH_CALLBACK_BASE_URL to CDK
13. TASK-GEN-009: DynamoDB question bank table in CDK (if approved)

**Wave 3 — Application code (dev-agent):**
14. TASK-AUTH-003: Add admin role
15. TASK-AUTH-017: Cognito adapter
16. TASK-AUTH-004: Real Google OAuth
17. TASK-AUTH-005: Real GitHub OAuth
18. TASK-GEN-001: Auth enforcement on POST /api/generate
19. TASK-GEN-004: teacherId in metadata
20. TASK-AUTH-006: Token refresh endpoint
21. TASK-AUTH-007: Parent-child link enforcement

**Wave 4 — Tests and review:**
22. TASK-AUTH-008: Auth integration test
23. TASK-GEN-002: Verify solve-data.json write
24. TASK-GEN-003: Provenance metadata audit
25. TASK-GEN-006: Generator bank-first integration test
26. TASK-AUTH-018: Auth security review
27. TASK-GEN-012: Generator security review
