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
| spec-ready | BA spec written — ready for DEV/QA to implement |
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
| REQ-AUTH-008 | JWT_SECRET must be injected securely in all non-development environments | P0 | [DONE] | Given CDK deploys Lambda, When JWT secret is resolved from Secrets Manager, Then JWT signing/verifying works without hardcoded secrets |
| REQ-AUTH-009 | System must support Google OAuth initiation — return real authorization URL | P0 | [DONE] | Given POST /api/auth/oauth/google in AUTH_MODE=cognito, When Cognito config is present, Then Cognito Hosted UI authorization URL with PKCE is returned |
| REQ-AUTH-010 | System must handle Google OAuth callback — exchange code for user, issue JWT | P0 | [DONE] | Given GET /api/auth/callback/google with valid code and state, When exchange succeeds, Then callback returns user identity + issued JWT |
| REQ-AUTH-011 | System must support a second OAuth provider (GitHub or Microsoft) | P1 | [MISSING] | Deferred to Phase 2. Start after TASK-AUTH-015 (API Gateway authorizer). Provider remains undecided. |
| REQ-AUTH-012 | Role claims must be limited to: student, teacher, parent | P0 | [DONE] | Given a register attempt with role='admin', When validated, Then 400 error — role must be one of student/teacher/parent |
| REQ-AUTH-013 | System must support an admin/super-admin role for platform operations | P0 | [MISSING] | Given an admin user, When they call admin-only endpoints, Then access is granted; non-admins receive 403 |
| REQ-AUTH-014 | All protected routes must enforce Bearer JWT validation via authMiddleware | P0 | [PARTIAL] | Given a request without Authorization header, When hitting a protected route, Then 401 returned — middleware exists but not universally applied |
| REQ-AUTH-015 | Role-based access control must be enforced via assertRole per route | P0 | [PARTIAL] | Given a student calls a teacher-only route, When assertRole(['teacher']) runs, Then 403 returned |
| REQ-AUTH-016 | System must implement a token refresh endpoint | P1 | [DONE] | Given POST /api/auth/refresh with valid refresh token, When not expired, Then new access token is returned; invalid/expired refresh token returns 401 |
| REQ-AUTH-017 | System must enforce rate limiting on auth endpoints (register, login, oauth) | P0 | [PARTIAL] | Given auth API traffic exceeds route policy, Then register/login are throttled by API Gateway; oauth-specific throttling remains to be completed |
| REQ-AUTH-018 | Parent users must have child-link state tracked and enforced | P1 | [PARTIAL] | Given a parent with no active link, When parent requests child progress, Then access is denied (403); enforcement should be standardized across all parent-scoped routes |
| REQ-AUTH-019 | System must handle multi-provider account linking (same email, Google + GitHub) [INFERRED] | P2 | [MISSING] | Given email X registered via Google, When same email X arrives via GitHub OAuth, Then accounts linked, not duplicated |
| REQ-AUTH-020 | OAuth redirect URIs must be environment-aware (localhost for dev, CloudFront domain for prod) [INFERRED] | P0 | [DONE] | Given CDK deploy per environment, When OAuth callback is configured, Then callback URLs are set per env-specific base domain |
| REQ-AUTH-021 | System must implement a production-grade auth adapter (Cognito) for AWS deployment | P0 | [DONE] | Given AUTH_MODE=cognito and Cognito config, When OAuth flow is used, Then cognitoAdapter performs PKCE/state flow and returns JWT-backed session response |
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
| REQ-GEN-010 | solve-data.json must be written alongside the worksheet on every generation | P0 | [DONE] | Given POST /api/generate succeeds, When storage is inspected, Then solve-data.json is written with worksheetId, teacherId, and full question/answer payload |
| REQ-GEN-011 | POST /api/generate must require a valid JWT (auth enforcement) | P0 | [DONE] | Given a request without Authorization header, When POST /api/generate is called, Then 401 is returned |
| REQ-GEN-012 | Only teacher/admin roles may call POST /api/generate [INFERRED] | P1 | [DONE] | Given a student JWT, When POST /api/generate is called, Then 403 is returned; teacher/admin are allowed |
| REQ-GEN-013 | System must enforce per-user/role generation quota [INFERRED] | P1 | [MISSING] | Given a teacher has generated 50 worksheets today, When they generate another, Then quota check runs and throttles if exceeded |
| REQ-GEN-014 | Generated worksheet must be associated with the requesting teacher's userId | P1 | [DONE] | Given a teacher with userId X generates a worksheet, When metadata/solve-data are written, Then teacherId: X is present |
| REQ-GEN-015 | System must return a structured error with errorCode on all failure paths | P0 | [DONE] | Given any generation failure, When error returned, Then body contains { success: false, error, errorCode, errorStage, requestId } |
| REQ-GEN-016 | CORS headers must be present on all generate responses including error paths | P0 | [DONE] | Given any generate response, Then Access-Control-Allow-Origin header is present |
| REQ-GEN-017 | Worksheet and answer-key files must be uploaded to S3 after generation | P0 | [DONE] | Given successful generation, When S3 inspected, Then worksheets/{date}/{uuid}/worksheet.{ext} and answer-key.{ext} present |
| REQ-GEN-018 | API key (ANTHROPIC_API_KEY) must be loaded from SSM Parameter Store on Lambda cold start | P0 | [DONE] | Given Lambda cold start, When SSM_PARAM_NAME env var set, Then API key fetched from SSM and cached in module scope |
| REQ-GEN-019 | System must have an integration test covering the full bank-first generation flow | P0 | [DONE] | Given integration test suite, When bank-first flow runs end-to-end, Then worksheet generation, auth paths, S3 writes, and response contract are validated |
| REQ-GEN-020 | Input validation must reject invalid grade, subject, topic, questionCount, format values | P0 | [DONE] | Given invalid request body, When validateGenerateBody runs, Then 400 returned with specific field error |
| REQ-GEN-021 | Question bank adapter must be configurable for local (JSON) vs production (future DB) use | P1 | [PARTIAL] | Given QB_ADAPTER=local env var, When question bank queried, Then local JSON adapter used; future QB_ADAPTER=dynamodb should route to DynamoDB |
| REQ-GEN-022 | System must support optional student name personalization on worksheet | P1 | [DONE] | Given studentName in request body, When worksheet generated, Then student name appears on the worksheet |
| REQ-GEN-023 | Worksheet expiry lifecycle (7 days) must be enforced at S3 level | P0 | [DONE] | Given a worksheet uploaded to S3, When 7+ days pass, Then S3 lifecycle rule expires the object |
| REQ-GEN-024 | System must prevent repeated questions within the same worksheet generation session | P0 | [MISSING] | Given a single generate request, When reusable-question candidates or AI candidates overlap with already selected questions, Then final worksheet assembly excludes duplicates and near-duplicates so the student receives only unique questions in that worksheet |
| REQ-GEN-025 | System must enforce a default future-session repeat cap of 10% for the same student at the same grade and difficulty | P0 | [MISSING] | Given a future worksheet session for the same student with matching grade and difficulty, When assembly selects candidates, Then no more than floor(questionCount * 0.10) questions may repeat from that student's prior exposure unless override applies |
| REQ-GEN-026 | Admin must be able to configure repeat-cap override policy by student, teacher, or parent scope with range 0% to 100% | P0 | [MISSING] | Given an admin updates repeat-cap policy for student/teacher/parent scope, When future worksheets are generated for applicable users, Then assembly enforces the configured cap within allowed range 0..100 |

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
| DEC-GEN-002 | Role restriction on generate | **teacher/admin roles** — assertRole(['teacher','admin']) after validateToken | Students should not generate custom worksheets; admin retains operational override. | REQ-GEN-012 |
| DEC-GEN-003 | Teacher-worksheet association | **teacherId added to metadata.json and solve-data.json** — extracted from JWT payload after validateToken | Does not change client-facing response shape. Teachership tracked in metadata only. | REQ-GEN-014 |
| DEC-GEN-004 | Question bank storage for production | **DynamoDB** — single-table design, keyed by grade+subject+topic | S3/JSON not viable at scale. Question bank needs filtering, dedup check, reuseCount updates. DynamoDB provides this with low cost. | REQ-GEN-021 |
| DEC-GEN-005 | Quota enforcement strategy | **DynamoDB counter per teacherId per day** OR **API Gateway Usage Plan per API key** — decision needed (see GAP-003) | App-level DynamoDB counter is more granular but adds complexity. API GW usage plan is simpler but less user-aware. | REQ-GEN-013 |
| DEC-GEN-006 | solve-data.json storage | **Always written to worksheets-local/{uuid}/solve-data.json (dev)** and **S3 key: worksheets/{date}/{uuid}/solve-data.json (prod)** | Implemented in generation flow and covered by unit/integration tests. | REQ-GEN-010 |
| DEC-GEN-007 | Session-level duplicate prevention during assembly | **Maintain a request-scoped exclusion set using questionId plus normalized text/answer fingerprints across bank selection and AI gap fill** | Insert-time bank dedupe alone is insufficient. The same worksheet request must filter reused and newly generated candidates against questions already chosen for that worksheet. | REQ-GEN-024 |
| DEC-GEN-008 | Future-session repeat cap policy resolution | **Use effectiveRepeatCapPercent with default 10%; resolve override precedence by scope (student > parent > teacher > default), and enforce range 0..100** | Supports product requirement for controlled repeat exposure and future payment-plan tiering while keeping deterministic backend behavior. | REQ-GEN-025, REQ-GEN-026 |

---

# PART 3 — DEV: Code Audit

## 3.1 M01 Auth — File-by-File Audit

| File | Exists | Status | What It Does | Missing / Incomplete | Rewrite Needed? |
|---|---|---|---|---|---|
| backend/handlers/authHandler.js | YES | PARTIAL | Routes: register, login, logout, refresh, oauth/:provider, callback/:provider. OAuth calls active adapter (stub in mock mode, Cognito in cognito mode). | Admin role not accepted in register VALID_ROLES. | No — extend |
| src/auth/index.js | YES | DONE | Auth adapter factory with mode-based selection for auth and OAuth adapters. | GitHub real OAuth provider not implemented in cognitoAdapter. | No — extend |
| src/auth/mockAuthAdapter.js | YES | DONE (local) | bcrypt user create/verify/token, local JSON DB, authType field | Production-only: no Cognito path | No — keep, add cognito adapter separately |
| src/auth/oauthStubAdapter.js | YES | PARTIAL (stub only) | Returns fake authorization URLs and mock users. Google + GitHub stub. CSRF state generated but not validated. | No real OAuth exchange. No real token exchange. No real user creation from OAuth profile. | No — keep for local dev, add real adapter |
| src/auth/tokenUtils.js | YES | DONE | JWT HS256 sign/verify, refresh token sign/verify, OAuth state token sign/verify | — | No |
| backend/middleware/authMiddleware.js | YES | DONE | validateToken (Bearer JWT) + assertRole (allowlist). Case-insensitive header read. | Not applied universally — each handler must call explicitly | No — keep as-is |
| tests/unit/authHandler.test.js | YES | PARTIAL | Exists — covers register, login, logout, oauth routes | Scope of coverage unknown without reading; needs audit | — |
| tests/unit/authMiddleware.test.js | YES | DONE | Exists | — | — |
| tests/unit/oauthStubAdapter.test.js | YES | DONE | Exists | — | — |
| tests/unit/tokenUtils.test.js | YES | DONE | Exists | — | — |
| tests/integration/auth*.test.js | YES | DONE | Auth integration flow test exists (register → login → validate token → logout) | Additional Cognito-mode integration test coverage can be expanded | — |

## 3.2 M01 Auth — Feature Coverage Matrix

| Feature | Implemented | Partial | Missing | Notes |
|---|---|---|---|---|
| Local register | ✅ | | | bcrypt, dedup check, role validation |
| Local login | ✅ | | | Password verify, JWT issue |
| Logout | ✅ | | | Client-side only (stateless) |
| Google OAuth (real) | ✅ | | | Implemented via Cognito Hosted UI + PKCE/state in cognitoAdapter |
| GitHub OAuth (real) | | | ❌ | oauthStubAdapter stub — no real flow |
| JWT issuance with role claims | ✅ | | | sub, email, role in payload |
| Token expiry (7 days) | ✅ | | | signToken expiresIn='7d' |
| Token refresh | ✅ | | | /api/auth/refresh implemented with refresh token verify + access token re-issue |
| Role claims: teacher/student/parent | ✅ | | | VALID_ROLES enforced |
| Admin role | | | ❌ | Not in VALID_ROLES |
| Protected routes via middleware | | ✅ | | Middleware exists but must be called per-handler, not auto |
| Parent-child link enforcement | | ✅ | | Enforced in parent progress path; helper middleware added for broader reuse |
| Rate limiting | | | ❌ | Only global API GW throttle (2/s dev, 10/s prod) |
| Multi-provider account linking | | | ❌ | Not designed |
| Cognito adapter (prod) | ✅ | | | src/auth/cognitoAdapter.js implemented |
| Auth integration test | ✅ | | | tests/integration/auth.test.js present |
| Email normalization | ✅ | | | toLowerCase().trim() on register and login |
| CORS on all responses | ✅ | | | corsHeaders added to all responses |

## 3.3 M03 Generator — File-by-File Audit

| File | Exists | Status | What It Does | Missing / Incomplete | Rewrite Needed? |
|---|---|---|---|---|---|
| backend/handlers/generateHandler.js | YES | PARTIAL | Full handler: auth enforcement, S3 upload, solve-data upload, SSM API key fetch, lazy imports, error codes, CORS, request logging | Quota enforcement not implemented yet. | No — extend |
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
| tests/integration/generate*.test.js | YES | DONE | Generator integration test covers bank-first flow, auth paths, solve-data upload, and response contract | Extend further if quota and DynamoDB adapter are added | — |

## 3.4 M03 Generator — Feature Coverage Matrix

| Feature | Implemented | Partial | Missing | Notes |
|---|---|---|---|---|
| POST /api/generate backward compat | ✅ | | | Response shape preserved |
| Bank-first assembly | ✅ | | | assembler.js full pipeline |
| AI question generation (gap fill) | ✅ | | | withRetry, model selection |
| Question validation before bank store | ✅ | | | validateQuestion per question |
| Question reuse tracking | ✅ | | | recordQuestionReuse called |
| solve-data.json storage | ✅ | | | Uploaded in generateHandler and validated in tests |
| Provenance metadata | | ✅ | | Partial — source field on some questions |
| Auth enforcement on /api/generate | ✅ | | | validateToken enforced in handler |
| Per-role access restriction | ✅ | | | assertRole(['teacher','admin']) enforced |
| Per-user/role quota | | | ❌ | Not implemented |
| Teacher-worksheet association | ✅ | | | teacherId included in metadata and solve-data |
| S3 upload (worksheet + answer key) | ✅ | | | uploadToS3 function present |
| SSM API key loading | ✅ | | | loadApiKey() with module-scope cache |
| Error response contract | ✅ | | | { success, error, errorCode, errorStage, requestId } |
| Input validation | ✅ | | | validateGenerateBody from middleware/validator.js |
| Generator integration test | ✅ | | | tests/integration/generateFlow.test.js present |
| Question bank adapter config | | ✅ | | QB_ADAPTER=local works; QB_ADAPTER=dynamodb not implemented |

---

# PART 4 — DEVOPS: IaC Audit

## 4.1 CDK Stack — Lambda Inventory

| Function Name | Handler File | Memory | Timeout | Key Env Vars | Auth Routes Wired | Notes |
|---|---|---|---|---|---|---|
| learnfyra-{env}-lambda-generate | generateHandler.js | 512MB(dev)/1024MB(prod) | 60s | WORKSHEET_BUCKET_NAME, CLAUDE_MODEL, SSM_PARAM_NAME, MAX_RETRIES, QB_ADAPTER=local | POST /api/generate | X86_64 (Chromium/PDF), SSM key wired, S3 grantPut+grantRead |
| learnfyra-{env}-lambda-auth | authHandler.js | 256MB | 15s | AUTH_MODE=cognito, JWT_SECRET (from Secrets Manager), OAUTH_CALLBACK_BASE_URL, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID, COGNITO_DOMAIN | POST /api/auth/register, login, logout, refresh, oauth/{provider}, GET callback/{provider} | Cognito-enabled route wiring present |
| learnfyra-{env}-lambda-download | downloadHandler.js | 256MB | 30s | WORKSHEET_BUCKET_NAME | GET /api/download | S3 grantRead |
| learnfyra-{env}-lambda-solve | solveHandler.js | 128MB | 10s | WORKSHEET_BUCKET_NAME | GET /api/solve/{worksheetId} | S3 grantRead |
| learnfyra-{env}-lambda-submit | submitHandler.js | 256MB | 15s | WORKSHEET_BUCKET_NAME | POST /api/submit | S3 grantRead |
| learnfyra-{env}-lambda-progress | progressHandler.js | 256MB | 15s | AUTH_MODE=cognito | GET/POST /api/progress/* | No S3 |
| learnfyra-{env}-lambda-analytics | analyticsHandler.js | 256MB | 15s | AUTH_MODE=cognito | GET /api/analytics/class/{id} | No S3 |
| learnfyra-{env}-lambda-class | classHandler.js | 128MB | 10s | AUTH_MODE=cognito | GET/POST /api/class/* | No S3 |
| learnfyra-{env}-lambda-rewards | rewardsHandler.js | 128MB | 10s | AUTH_MODE=cognito | GET /api/rewards/* | No S3 |
| learnfyra-{env}-lambda-student | studentHandler.js | 128MB | 10s | AUTH_MODE=cognito | GET/POST /api/student/* | No S3 |
| learnfyra-{env}-lambda-admin | questionBankHandler.js | 256MB | 15s | QB_ADAPTER=local | GET/POST /api/qb/questions/* | No S3 |

## 4.2 M01 Auth — IaC Gap Analysis

| Component | Exists in CDK | Missing | Notes |
|---|---|---|---|
| Auth Lambda function | ✅ YES | — | learnfyra-{env}-lambda-auth |
| All auth API routes wired (including refresh) | ✅ YES | — | register, login, logout, refresh, oauth/{provider}, callback/{provider} |
| JWT_SECRET from Secrets Manager | ✅ YES | — | /learnfyra/{env}/jwt-secret resolved via SecretValue.secretsManager() |
| Cognito User Pool | ✅ YES | — | User pool + app client + Google IdP + user pool domain configured |
| Real OAuth secrets (Google/GitHub client IDs) | ✅ YES (Google) | GitHub IdP secret wiring | Google client secret resolved from Secrets Manager; GitHub deferred |
| OAUTH_CALLBACK_BASE_URL env var on auth Lambda | ✅ YES | — | Injected via CDK with environment-specific domain |
| API Gateway Lambda Authorizer | ✅ YES | — | Custom token authorizer is wired for protected API methods |
| Per-route throttling on auth endpoints | ✅ YES | OAuth-specific throttling policy | /auth/register and /auth/login set to 1/s burst 2 |
| AUTH_MODE env var for real mode | ✅ YES | Optional dev-specific fallback strategy | AUTH_MODE=cognito configured in CDK Lambda env |
| APP_RUNTIME env var for real mode | ✅ YES (removed) | — | APP_RUNTIME=local no longer injected |
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
| ci.yml | PR/push to main/develop/staging | npm test (unit + integration) + coverage gate (≥80%) + CDK synth + CDK tests | Add explicit split reporting for unit/integration jobs if needed |
| deploy-dev.yml | workflow_dispatch (manual) | Tests → AWS OIDC → Secrets Manager writes (Anthropic/JWT/Google secret) → CDK bootstrap → CDK deploy → S3 frontend sync | Add post-deploy smoke tests |
| deploy-staging.yml | workflow_dispatch (manual) | Same pattern as dev, with staging secrets + deploy | Add post-deploy smoke tests |
| deploy-prod.yml | workflow_dispatch (manual) | Manual approval + tests + production secrets write + deploy | Add post-deploy smoke tests |

## 4.5 Critical IaC Blockers (M01 + M03)

| BLOCKER | Description | Impact | Priority |
|---|---|---|---|
| Admin role not fully implemented end-to-end | TASK-AUTH-003 marked done earlier but register VALID_ROLES still excludes admin | Admin provisioning and route contracts remain inconsistent | P0 |
| Question bank is local JSON only | QB_ADAPTER=local in Lambda — reads from data-local/ which doesn't exist in Lambda /tmp | Question bank features non-functional in AWS | P1 |
| OAuth second provider (GitHub/Microsoft) still not implemented | Cognito/user-flow is Google-only currently | Multi-provider requirement remains open | P1 |

---

# PART 5 — TASK BOARDS

## 5.1 Task Items — M01 Authentication & Authorization

| Task ID | Title | Priority | Status | Depends On | Acceptance Hook | Owner Agent |
|---|---|---|---|---|---|---|
| TASK-AUTH-001 | Define real OAuth contract (Google + GitHub): PKCE flow, callback URL strategy, env var design | P0 | done | — | Contract document approved, redirect URI strategy decided for all envs | architect-agent |
| TASK-AUTH-002 | Define Cognito vs custom JWT decision: token refresh strategy, access/refresh token lifecycle | P0 | done | — | Decision recorded in GAP table, approach chosen | architect-agent |
| TASK-AUTH-003 | Add admin role: extend VALID_ROLES, add 'admin' to register, authHandler, and assertRole tests | P0 | in-progress | DEC-AUTH-005 | assertRole admin coverage is in place, but authHandler VALID_ROLES still excludes admin; complete register contract + tests | dev-agent |
| TASK-AUTH-004 | Implement real Google OAuth flow: real PKCE, token exchange, user lookup/create from Google profile | P0 | done | TASK-AUTH-001, TASK-AUTH-013 (Cognito IaC) | POST /api/auth/oauth/google returns real Google consent URL; callback issues real JWT; integration test passes | dev-agent |
| TASK-AUTH-005 | Implement second OAuth provider flow (Phase 2): real token exchange, user lookup/create | P1 | todo | TASK-AUTH-001, TASK-AUTH-013, TASK-AUTH-015 | Deferred to Phase 2. Provider TBD (GitHub or Microsoft) and starts after API Gateway authorizer completion. | dev-agent |
| TASK-AUTH-006 | Implement token refresh endpoint: POST /api/auth/refresh | P1 | done | TASK-AUTH-002 | Valid refresh token → new access token; expired refresh token → 401; tests pass | dev-agent |
| TASK-AUTH-007 | Add parent-child link enforcement: validate parentLinks before parent accesses student data | P1 | done | — | Parent with no linked child → 403 with link guidance; linked parent → access granted; tests pass | dev-agent |
| TASK-AUTH-008 | Write auth integration test: full register → login → access protected route → logout flow | P0 | done | — | Integration test covers register, login, token use on protected route, logout; all pass | qa-agent |
| TASK-AUTH-009 | Implement multi-provider account linking: same email, Google + GitHub | P2 | todo | TASK-AUTH-004, TASK-AUTH-005 | Same email via second provider links to existing account; no duplicate user created; tests pass | dev-agent |
| TASK-AUTH-010 | Remove AUTH_MODE=mock and APP_RUNTIME=local from CDK Lambda env for non-dev environments | P0 | done | TASK-AUTH-013 | CDK Lambda envs now use AUTH_MODE=cognito and APP_RUNTIME=local is removed | devops-agent |
| TASK-AUTH-011 | Add OAUTH_CALLBACK_BASE_URL env var to auth Lambda in CDK per environment | P0 | done | TASK-AUTH-001 | dev: CloudFront domain, staging: CloudFront staging URL, prod: CloudFront prod URL | devops-agent |
| TASK-AUTH-012 | Set up JWT_SECRET in Secrets Manager + write step in deploy workflows (all envs) | P0 | done | — | deploy-dev.yml, deploy-staging.yml, deploy-prod.yml each write JWT_SECRET to Secrets Manager before CDK deploy; CDK uses SecretValue.secretsManager() | devops-agent |
| TASK-AUTH-013 | Add Cognito User Pool + App Client + Google identity provider to CDK | P0 | done | TASK-AUTH-002 | CDK synth passes; Cognito User Pool defined; Google IdP configured; App Client with authorizationCodeGrant + PKCE | devops-agent |
| TASK-AUTH-014 | Store OAuth client IDs and secrets in AWS Secrets Manager and wire to auth Lambda | P0 | done | TASK-AUTH-013 | Google OAuth credentials in Secrets Manager; auth Lambda has Cognito env vars injected | devops-agent |
| TASK-AUTH-015 | Add API Gateway Lambda Authorizer for protected routes | P1 | done | TASK-AUTH-013 | Custom token authorizer is wired in CDK and applied to protected API methods, blocking unauthorized calls before integration invoke | devops-agent |
| TASK-AUTH-016 | Add per-route throttle overrides on auth endpoints (/register, /login) in CDK | P0 | done | — | /auth/register and /auth/login have stricter throttle than global (1/s burst 2) | devops-agent |
| TASK-AUTH-017 | Implement Cognito auth adapter: src/auth/cognitoAdapter.js — PKCE, token exchange, JWT issue | P0 | done | TASK-AUTH-013 | AUTH_MODE=cognito routes to cognitoAdapter; PKCE + signed state CSRF protection; email_verified check; 1277 tests passing | dev-agent |
| TASK-AUTH-018 | Security review: review entire auth flow for OWASP Top 10 gaps | P0 | done | TASK-AUTH-003 through TASK-AUTH-009 | Security review completed; all 4 CRITICAL findings resolved (PKCE, CSRF state, JWT SecureString, /refresh API GW route); HIGH-1/2/4/5 also fixed | code-reviewer-agent |

## 5.2 Task Items — M03 Worksheet Generator

| Task ID | Title | Priority | Status | Depends On | Acceptance Hook | Owner Agent |
|---|---|---|---|---|---|---|
| TASK-GEN-001 | Add auth enforcement to POST /api/generate: validateToken + assertRole(['teacher','admin']) | P0 | done | TASK-AUTH-003 | Unauthenticated generate → 401; student JWT → 403; teacher JWT → proceeds; 7 auth tests pass | dev-agent |
| TASK-GEN-002 | Add solve-data.json upload to S3 in generateHandler (Lambda path) | P0 | done | — | solve-data.json uploaded as 2nd S3 PutObjectCommand with worksheetId + teacherId + questions; 5 tests pass; server.js local path was already implemented | qa-agent |
| TASK-GEN-003 | Audit provenance metadata: confirm every question in assembled worksheet has source field (banked vs generated) | P1 | spec-ready | — | BA spec in Part 9.1. Assembler output: every question has `source: 'bank'` or `source: 'ai'`; provenanceLevel controls whether bankEntryId is appended; QA tests in assembler.test.js and generateFlow.test.js | qa-agent |
| TASK-GEN-004 | Add teacherId to metadata.json and solve-data.json from JWT payload after validateToken | P1 | done | TASK-GEN-001 | metadata contains teacherId from decoded.sub; solve-data.json also contains teacherId; tests pass | dev-agent |
| TASK-GEN-005 | Define generation quota contract: per-teacher daily limit, quota enforcement approach decision | P1 | spec-ready | — | BA spec in Part 9.2. Decision: DynamoDB counter (PK=QUOTA#TEACHER#{id}, SK=DATE#{date}). Default 50/day. 429 with WG_QUOTA_EXCEEDED + quotaResetAt. Check runs before AI at stage 'quota:check'. Best-effort failure (non-blocking). Open: architect to confirm blocking vs best-effort. | architect-agent + ba-agent |
| TASK-GEN-006 | Write generator bank-first integration test: full flow POST /api/generate → bank query → AI fill → S3 → response | P0 | done | — | tests/integration/generateFlow.test.js — 75 tests covering full/partial/empty bank, auth 401/403, solve-data.json, teacherId, backward compat, S3 failure | qa-agent |
| TASK-GEN-007 | Input validation hardening: add max length constraints to topic, studentName, worksheetDate fields | P1 | done | — | topic: max 200 chars + prompt-injection char block (", newline, null); studentName/teacherName: max 80 chars; period: max 40; className: max 80; worksheetDate: YYYY-MM-DD format; all enforced in validateGenerateBody | dev-agent |
| TASK-GEN-008 | Resolve QB_ADAPTER strategy for production: define DynamoDB table schema and wiring plan (no code) | P1 | spec-ready | — | BA spec in Part 9.3. Canonical table schema: PK=QUESTION#{uuid}/SK=METADATA. GSI1=CurriculumQuery, GSI2=DifficultyQuery, GSI3=HashIndex. Interface: getQuestionsForCriteria, addIfNotExists, recordQuestionReuse. Adapter factory routes QB_ADAPTER=dynamodb|local. | architect-agent |
| TASK-GEN-009 | Add DynamoDB table for question bank to CDK stack | P1 | spec-ready | TASK-GEN-008 | BA spec in Part 9.4. CDK construct spec with GSI1/GSI2/GSI3 definitions. QB_TABLE_NAME env var injected. grantReadWriteData. RETAIN/DESTROY policy per env. CloudWatch alarms for SystemErrors/UserErrors. CDK assertion test required. | devops-agent |
| TASK-GEN-010 | Add LOW_COST_MODEL and PREMIUM_MODEL env vars to generate Lambda in CDK | P2 | todo | — | CDK env vars set; assembler.js reads them; model selection tests verify env override works | devops-agent |
| TASK-GEN-011 | Add generator integration test to CI pipeline | P0 | done | TASK-GEN-006 | ci.yml "Run all tests" step runs npm test which includes tests/integration/; ANTHROPIC_API_KEY placeholder set in CI env | devops-agent |
| TASK-GEN-012 | Security review: input sanitization, S3 key injection risks, API key exposure | P0 | done | TASK-GEN-001 | Two-pass code-reviewer-agent review completed (2026-03-28). CRITICAL: C1 prompt-injection via topic (fixed — char block + quote escape); C2 teacherId unsanitized in S3 (fixed — format validation + removed from response). HIGH: H1 local file path in logs (fixed); H2 bucket name in logs (fixed); H3 CORS wildcard (fixed — prod guard); H4 clientRequestId header injection (fixed — sanitize on read). MEDIUM: M1 stack traces in prod logs (fixed — prod-gated); M2 worksheet spread in solve-data (fixed — explicit field list); M4 MAX_RETRIES unbounded (fixed — clamped to 5). All fixes committed to branch security/gen-012-fixes. | code-reviewer-agent |
| TASK-GEN-013 | Define and verify request-scoped uniqueness contract for worksheet generation | P0 | todo | TASK-GEN-006 | Contract documents exclusion-set behavior for bank + AI assembly, and QA proves a single worksheet request cannot return duplicate or near-duplicate questions | architect-agent + qa-agent |
| TASK-GEN-014 | Define backend contract for future-session repeat cap (default 10%) and override precedence/validation | P0 | todo | TASK-GEN-013 | Contract defines matching key for same student+grade+difficulty sessions, cap calculation, scope precedence (student>parent>teacher>default), and validation range 0..100 | architect-agent + ba-agent |
| TASK-GEN-015 | Add QA coverage plan for repeat-cap enforcement and admin override scopes | P0 | todo | TASK-GEN-014 | QA verifies default 10%, 0%, 100%, and mixed scope precedence cases against future-session generation behavior | qa-agent |

---

# PART 6 — GAPS & OPEN DECISIONS

| GAP-NNN | Decision Needed | Blocking Tasks | Priority |
|---|---|---|---|
| GAP-001 | **Admin role provisioning**: How are admin users created and managed if self-registration remains blocked? | TASK-AUTH-003 | P0 |
| GAP-003 | **Rate limiting completion for OAuth endpoints**: Keep method throttle as-is or add oauth-specific caps/WAF rate rules? | TASK-AUTH-016 | P1 |
| GAP-006 | **Worksheet ownership model in storage**: teacherId in metadata.json only, or also in S3 key prefix? S3 key: worksheets/{teacherId}/{date}/{uuid}/ for tenant isolation? | TASK-GEN-004, TASK-GEN-009 | P1 |
| GAP-007 | **Question bank production storage**: DynamoDB confirmed as the right choice? Or PostgreSQL via RDS? DynamoDB preferred — decide table design (single-table vs per-entity). | TASK-GEN-008, TASK-GEN-009 | P1 |
| GAP-008 | **Generation quota enforcement**: Per-teacher per-day counter in DynamoDB? Or API Gateway Usage Plan with per-key throttle? | TASK-GEN-005 | P2 |
| GAP-009 | **Second OAuth provider selection**: GitHub or Microsoft? Affects Cognito IdP configuration. Decision: deferred to Phase 2; provider still TBD. | TASK-AUTH-005 | P1 |
| GAP-010 | **Parent-child link UX**: What is the standard response/UX contract when a parent has no linked child? | TASK-AUTH-007 | P1 |
| GAP-011 | **Repeat-cap policy storage and resolution strategy**: Where do default and overrides live (global config vs per-entity table), and how are teacher/parent/student conflicts resolved? | TASK-GEN-014, TASK-GEN-015 | P0 |

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

**Wave 1 — Remaining decisions:**
1. GAP-001: Decide admin provisioning model
2. GAP-009: Keep second provider decision open for Phase 2 (GitHub vs Microsoft)
3. GAP-007: Finalize production question bank data model
4. GAP-008: Finalize generation quota strategy

**Wave 2 — Security and platform hardening: ✅ COMPLETE**
5. TASK-AUTH-015: API Gateway authorizer for protected routes ✅ done
6. GAP-003: Finalize OAuth endpoint throttling strategy ✅ done (per-route throttle set)
7. TASK-GEN-012: Generator security review ✅ done (2026-03-28, branch security/gen-012-fixes)

**Wave 3 — Feature completion on open work:**
8. TASK-AUTH-003: Finish admin role end-to-end implementation
9. TASK-AUTH-005: Implement second OAuth provider (Phase 2, post-TASK-AUTH-015)
10. TASK-AUTH-009: Implement multi-provider account linking
11. TASK-GEN-003: Provenance metadata audit (BA spec → Part 9.1)
12. TASK-GEN-005: Generation quota contract (BA spec → Part 9.2)
13. TASK-GEN-008: QB_ADAPTER DynamoDB schema decision (BA spec → Part 9.3)
14. TASK-GEN-009: Add DynamoDB table + IAM for question bank (BA spec → Part 9.4)
15. TASK-GEN-010: Add LOW_COST_MODEL and PREMIUM_MODEL env vars
16. TASK-GEN-013: Publish and validate request-scoped uniqueness contract
17. TASK-GEN-014: Publish repeat-cap policy contract and precedence rules
18. TASK-GEN-015: Add repeat-cap QA matrix and validation plan

---

## PART 5 — New Tasks: DynamoDB Migration + Cognito Upgrade (2026-03-27)

These tasks extend M01 Auth and M02/M03 Generator work for full production readiness.
They do not duplicate any tasks in Parts 1–4 above.
All new tasks start at status: **not-started**.

---

### 5.3 M01 Auth — DynamoDB Migration + Cognito Integration

| Task ID | Title | Priority | Status | Depends On | Owner Agent |
|---|---|---|---|---|---|
| TASK-AUTH-019 | Migrate auth storage from in-memory/JSON to DynamoDB Users table | P0 | not-started | TASK-AUTH-020 (CDK table must exist first) | dev-agent |
| TASK-AUTH-020 | Add DynamoDB Users table to CDK + wire grantReadWriteData to auth Lambda | P0 | not-started | — | devops-agent |
| TASK-AUTH-021 | Integrate Cognito User Pool with existing authHandler for production path | P0 | not-started | TASK-AUTH-013, TASK-AUTH-019 | dev-agent |
| TASK-AUTH-022 | Promote Lambda Authorizer to standalone function replacing handler-level JWT checks | P1 | not-started | TASK-AUTH-015 | dev-agent + devops-agent |

**Acceptance criteria:**

- **TASK-AUTH-019:** POST /api/auth/register writes user record to DynamoDB Users table (PK=USER#{userId}, SK=PROFILE). POST /api/auth/login reads from DynamoDB. data-local/users.json is no longer the authoritative store on production path. All existing auth tests pass with aws-sdk-client-mock replacing JSON file mock.
- **TASK-AUTH-020:** CDK synth passes zero warnings. Users table: PK=USER#{userId}, SK=PROFILE. GSI1: PK=ROLE#{role}, SK=CREATED#{createdAt}. Prod RemovalPolicy.RETAIN. Dev/staging RemovalPolicy.DESTROY. CDK assertion test confirms table + GSI.
- **TASK-AUTH-021:** AUTH_MODE=cognito routes register/login through cognitoAdapter. cognitoAdapter.registerUser() creates user in Cognito pool AND writes profile to DynamoDB. AUTH_MODE=mock keeps mockAuthAdapter. Integration test passes with Cognito mock.
- **TASK-AUTH-022:** Lambda Authorizer deployed as standalone NodejsFunction in CDK. All protected API Gateway routes use it. Individual handlers no longer call validateToken() themselves. Existing protected route tests updated. CORS on 401/403 from authorizer confirmed.

---

### 5.4 M02 Question Bank — DynamoDB Migration

| Task ID | Title | Priority | Status | Depends On | Owner Agent |
|---|---|---|---|---|---|
| TASK-QB-003 | Add DynamoDB QuestionBank table to CDK with curriculum query GSIs | P1 | not-started | — | devops-agent |
| TASK-QB-004 | Migrate question bank from local JSON adapter to DynamoDB adapter | P1 | not-started | TASK-QB-003 | dev-agent |
| TASK-QB-005 | Wire QB_ADAPTER=dynamodb to generate Lambda in CDK for staging/prod | P1 | not-started | TASK-QB-003, TASK-QB-004 | devops-agent |

**Acceptance criteria:**

- **TASK-QB-003:** CDK synth passes zero warnings. QuestionBank table: PK=QUESTION#{questionId}, SK=METADATA. GSI1: PK=GRADE#{grade}#SUBJECT#{subject}, SK=TOPIC#{topic}#DIFF#{difficulty}. GSI2: PK=DIFFICULTY#{difficulty}, SK=SUBJECT#{subject}#GRADE#{grade}. Generate Lambda: grantReadWriteData. CDK assertion test confirms table + GSIs.
- **TASK-QB-004:** QB_ADAPTER=dynamodb routes all reads/writes to DynamoDB. getQuestionsForCriteria(), addIfNotExists() (conditional write for dedup), recordQuestionReuse() (UpdateItem increment) all work against DynamoDB. All existing questionBank unit tests pass with aws-sdk-client-mock.
- **TASK-QB-005:** CDK sets QB_ADAPTER=dynamodb on generate Lambda in staging and prod. QB_ADAPTER=local remains in dev. CDK assertion test confirms env-specific value.

---

### 5.5 Agent Prompt Pack — New DynamoDB Migration Tasks

#### TASK-AUTH-019
```text
Agent: dev-agent
Mode: standard
Task ID: TASK-AUTH-019
Goal: Migrate auth user storage from local JSON file to DynamoDB Users table.
Inputs:
  - docs/tasks/backend/M01-M03-REQUIREMENTS-AND-TASKS.md Part 5.3
  - src/auth/mockAuthAdapter.js (read before modifying — reads/writes data-local/users.json)
  - backend/handlers/authHandler.js (read before modifying)
  - DynamoDB Users table schema: PK=USER#{userId}, SK=PROFILE (from TASK-AUTH-020 output)
  - tests/unit/authHandler.test.js (read — these must all keep passing)
Deliverables:
  - src/auth/dynamoAuthAdapter.js: new adapter implementing same interface as mockAuthAdapter
    (getUserByEmail, createUser, updateUser) using DynamoDB PutItem/GetItem/Query
  - src/auth/index.js updated: AUTH_MODE=cognito|dynamodb → dynamoAuthAdapter; AUTH_MODE=mock → mockAuthAdapter
  - All existing auth handler tests pass with aws-sdk-client-mock substituted for JSON file mock
  - No data-local/users.json reads in production code paths
Constraints: mockAuthAdapter must remain functional for AUTH_MODE=mock. No real AWS calls in tests.
Output: files changed, test results, migration notes.
```

#### TASK-AUTH-020
```text
Agent: devops-agent
Mode: standard
Task ID: TASK-AUTH-020
Goal: Add DynamoDB Users table to CDK stack.
Inputs:
  - infra/cdk/lib/learnfyra-stack.ts (read before modifying)
  - docs/requirements/platform/Database.md
  - docs/requirements/platform/learnfyra_auth_module.md
  - docs/tasks/backend/M01-M03-REQUIREMENTS-AND-TASKS.md Part 5.3
Deliverables:
  - Users table: PK=USER#{userId}, SK=PROFILE
  - Attributes: userId, email, name, role, provider, createdAt, lastLogin, activeFlag, linkedChildIds
  - GSI1: PK=ROLE#{role}, SK=CREATED#{createdAt} (for admin user listing by role)
  - Auth Lambda: grantReadWriteData
  - Prod: RemovalPolicy.RETAIN; Dev/staging: RemovalPolicy.DESTROY
  - CDK synth passes zero warnings
  - CDK assertion test in infra/test/ confirms table name and GSI
Constraints: IaC only. No handler code in this task. No hardcoded ARNs.
Output: CDK diff, table/GSI inventory, synth evidence.
```

#### TASK-QB-003
```text
Agent: devops-agent
Mode: standard
Task ID: TASK-QB-003
Goal: Add DynamoDB QuestionBank table to CDK with curriculum query GSIs.
Inputs:
  - infra/cdk/lib/learnfyra-stack.ts (read before modifying)
  - docs/requirements/platform/Database.md
  - docs/tasks/backend/M01-M03-REQUIREMENTS-AND-TASKS.md Part 5.4
Deliverables:
  - QuestionBank table: PK=QUESTION#{questionId}, SK=METADATA
  - Attributes: questionId, subject, grade, topic, difficulty, questionText, options,
    correctAnswer, explanation, modelUsed, createdAt, tags, reuseCount, status (ACTIVE/FLAGGED/APPROVED), hash
  - GSI1: PK=GRADE#{grade}#SUBJECT#{subject}, SK=TOPIC#{topic}#DIFF#{difficulty}
  - GSI2: PK=DIFFICULTY#{difficulty}, SK=SUBJECT#{subject}#GRADE#{grade}
  - Generate Lambda: grantReadWriteData
  - Prod: RemovalPolicy.RETAIN; Dev/staging: RemovalPolicy.DESTROY
  - CDK synth passes zero warnings
  - CDK assertion test confirms table, GSI1, GSI2
Constraints: IaC only. No handler code in this task.
Output: CDK diff, table/GSI inventory, synth evidence.
```

#### TASK-QB-004
```text
Agent: dev-agent
Mode: standard
Task ID: TASK-QB-004
Goal: Implement DynamoDB adapter for question bank to replace local JSON adapter in production.
Inputs:
  - docs/tasks/backend/M01-M03-REQUIREMENTS-AND-TASKS.md Part 5.4
  - src/ai/questionBank.js (read current state before modifying)
  - QuestionBank DynamoDB table schema from TASK-QB-003
  - tests/unit/assembler.test.js and any question bank unit tests (read — must keep passing)
Deliverables:
  - src/ai/questionBankDynamoAdapter.js implementing:
    - getQuestionsForCriteria(grade, subject, topic, difficulty, limit) → queries GSI1
    - addIfNotExists(question) → conditional PutItem using hash attribute for dedup
    - recordQuestionReuse(questionId) → UpdateItem to increment reuseCount
  - src/ai/questionBank.js factory updated: QB_ADAPTER=dynamodb routes to DynamoDB adapter; QB_ADAPTER=local keeps existing JSON adapter
  - All existing assembler and question bank tests pass with aws-sdk-client-mock
  - No data-local/questions.json reads in QB_ADAPTER=dynamodb code path
Constraints: Local JSON adapter must remain working for QB_ADAPTER=local. No real AWS calls in tests.
Output: files changed, adapter interface doc, test results.
```

---

# PART 9 — BA Specs: Pending M03 Tasks (2026-03-28)

**Author:** BA Agent | **Date:** 2026-03-28 | **Status:** Ready for DEV + QA

---

## 9.1 TASK-GEN-003 — Provenance Metadata Audit

### Feature: Per-Question Source Attribution (banked vs AI-generated)

**User Story**
As a **teacher** reviewing a generated worksheet, I want to know which questions came from the bank and which were AI-generated, so that I can trust the content provenance and understand question reuse history.

**Context**
REQ-GEN-009 requires every question to include a `source` field. The assembler (`src/ai/assembler.js`) sets `source: 'bank'` on selected banked questions and is expected to set `source: 'ai'` on generated questions before the merge step. This task confirms that behavior is complete, consistent, and tested — it does not add new features.

**Acceptance Criteria**

| # | Given | When | Then |
|---|---|---|---|
| AC-003-01 | A full-bank worksheet (all from bank) | Assembler merges and returns worksheet | Every question object has `source: 'bank'` |
| AC-003-02 | An empty-bank worksheet (all AI-generated) | Assembler merges and returns worksheet | Every question object has `source: 'ai'` |
| AC-003-03 | A partial-bank worksheet (mixed) | Assembler merges and returns worksheet | Banked questions have `source: 'bank'`; AI questions have `source: 'ai'`; no question is missing the field |
| AC-003-04 | provenanceLevel='full' | Assembler returns worksheet | Each question also has a `bankEntryId` or `null` — bank questions carry their original `questionId`, AI questions carry `null` |
| AC-003-05 | provenanceLevel='summary' | Assembler returns worksheet | Questions have `source` only; no `bankEntryId` appended |
| AC-003-06 | provenanceLevel='none' | Assembler returns worksheet | Questions do NOT have `source` or `bankEntryId` |
| AC-003-07 | Assembled worksheet saved as solve-data.json | S3 JSON inspected | `source` field is present on each question (stripped by explicit field list if provenanceLevel='none') |

**Out of Scope**
- Displaying provenance in the worksheet PDF/HTML (frontend concern)
- Changing the question bank schema or add new fields

**QA Test Locations**
- `tests/unit/assembler.test.js` — add describe block "provenance metadata per question"
- `tests/integration/generateFlow.test.js` — add assertion on question[n].source for each bank scenario

**Open Questions**
- Does provenanceLevel='none' strip `source` before returning worksheet, or does it just omit the bankEntryId summary? **Decision needed from architect before QA writes tests.**

---

## 9.2 TASK-GEN-005 — Generation Quota Contract

### Feature: Per-Teacher Daily Worksheet Generation Quota

**User Story**
As a **platform operator**, I want to enforce a daily limit on worksheet generation per teacher, so that I can prevent runaway API cost from a single account and support future billing tiers.

**As a **teacher**, I want a clear error message when I hit my daily quota, so that I understand why generation was blocked and when it will reset.

**Architecture Decision Required (GAP-008)**

| Option | How | Pros | Cons |
|---|---|---|---|
| **A — DynamoDB counter** | Lambda reads/writes `QuotaCounters` DynamoDB table: PK=QUOTA#TEACHER#{teacherId}, SK=DATE#{YYYY-MM-DD}, count AtomicAdd | Granular per-teacher, per-day; admin-configurable tiers; consistent | Adds DynamoDB read/write on every generate call; slightly higher latency |
| **B — API GW Usage Plan** | Each teacher API key gets usage plan; Lambda not involved | No Lambda cost for quota check; enforced at edge | API GW keys ≠ JWTs; requires separate key management; not user-aware without extra mapping; poor UX (429 from GW with no friendly message) |
| **Recommendation:** Option A — DynamoDB counter | Consistent with DynamoDB-first data strategy; supports future admin config UI and billing tiers; user-friendly 429 with reset timestamp |

**Quota Contract (Option A)**

| Field | Value |
|---|---|
| Default daily limit | 50 worksheets per teacher |
| Admin override | Configurable per teacherId via QuotaConfig table (or GSI on Users table) |
| Quota window | UTC day (00:00:00Z to 23:59:59Z) |
| Counter key | `PK=QUOTA#TEACHER#{teacherId} SK=DATE#{YYYY-MM-DD}` |
| Counter update | Atomic `ADD count 1` via DynamoDB UpdateItem with ConditionExpression `count < limit` |
| Response on limit | HTTP 429 `{ success: false, error: 'Daily generation limit reached.', errorCode: 'QUOTA_EXCEEDED', code: 'WG_QUOTA_EXCEEDED', quotaResetAt: '<next UTC midnight ISO>' }` |

**Acceptance Criteria**

| # | Given | When | Then |
|---|---|---|---|
| AC-005-01 | Teacher has generated 49 worksheets today | They call POST /api/generate | Request proceeds normally (count → 50) |
| AC-005-02 | Teacher has generated 50 worksheets today | They call POST /api/generate | 429 returned with `WG_QUOTA_EXCEEDED`, `quotaResetAt` field is next UTC midnight |
| AC-005-03 | Admin has set teacher quota to 100 | Teacher calls POST /api/generate on 51st call | Request proceeds (custom limit honored) |
| AC-005-04 | Quota DynamoDB write fails (non-blocking) | Generation completes | Request is NOT blocked; error logged as warn; best-effort behavior |
| AC-005-05 | Quota DynamoDB read fails | Before generation | 500 returned only if quota is mandatory; if quota is best-effort, log warn and proceed |
| AC-005-06 | Teacher has not generated any worksheet today | First generate of the day | Counter is created with count=1; no quota error |
| AC-005-07 | Teacher hits quota at 11:59:59 PM UTC | Next call at 00:00:01 AM UTC next day | New day counter created; quota not exceeded |
| AC-005-08 | Quota check runs before AI generation | Handler stage order | Quota block at stage 'quota:check' before any AI, S3, or SSM calls |

**Out of Scope**
- Frontend quota indicator / warning UI
- Quota reset via admin API endpoint (Phase 2)
- Per-student or per-parent quota enforcement
- Billing tier enforcement (Phase 2)

**QA Test Locations**
- `tests/unit/generateHandler.test.js` — add describe block "quota enforcement" (mock DynamoDB)
- `tests/integration/generateFlow.test.js` — add scenario: quota exceeded → 429

**Dependencies**
- TASK-QB-003 (QuestionBank DynamoDB table already planned — QuotaCounters can share the same CDK construct pattern)
- Architect must confirm: is quota check blocking or best-effort?

---

## 9.3 TASK-GEN-008 — QB_ADAPTER DynamoDB Schema Decision

### Feature: Production Question Bank Storage Contract

**User Story**
As a **developer building the DynamoDB adapter**, I need a fully specified table schema (key structure, GSI definitions, attribute names, access patterns) so that I can implement the adapter without design ambiguity.

**Canonical Table Schema: QuestionBank**

```
Table: learnfyra-{env}-question-bank
Billing mode: PAY_PER_REQUEST (on-demand)
Removal policy: RETAIN (prod), DESTROY (dev/staging)

Primary Key:
  PK (string)  = QUESTION#{questionId}
  SK (string)  = METADATA

Attributes:
  questionId     (string)   UUID v4 — generated by adapter
  subject        (string)   Math | ELA | Science | Social Studies | Health
  grade          (number)   1–10
  topic          (string)   curriculum topic string (max 200 chars)
  difficulty     (string)   Easy | Medium | Hard | Mixed
  questionText   (string)   full question text
  questionType   (string)   multiple-choice | fill-in-the-blank | short-answer | true-false | matching | show-your-work | word-problem
  options        (list)     only present for multiple-choice; exactly 4 strings ["A. …", "B. …", "C. …", "D. …"]
  correctAnswer  (string)   correct answer string
  explanation    (string)   explanation for answer key
  points         (number)   1 or 2
  source         (string)   'ai' | 'admin' | 'imported'
  modelUsed      (string)   Claude model ID that generated this question (or 'admin' if manually created)
  hash           (string)   SHA-256 of normalized questionText+subject+grade+difficulty — dedup key
  reuseCount     (number)   starts at 0; incremented on each bank selection
  status         (string)   ACTIVE | FLAGGED | RETIRED
  createdAt      (string)   ISO-8601 UTC timestamp
  lastUsedAt     (string)   ISO-8601 UTC timestamp — updated on each selection
  tags           (list)     optional CCSS/NGSS standard code strings
```

**GSI Definitions**

```
GSI1: CurriculumQuery (primary lookup — by grade, subject, topic, difficulty)
  PK = GRADE#{grade}#SUBJECT#{subject}
  SK = TOPIC#{topic}#DIFF#{difficulty}
  Projection: ALL
  Purpose: getQuestionsForCriteria() — the main bank query on every generation call

GSI2: DifficultyQuery (secondary lookup — by difficulty across all grades/subjects)
  PK = DIFFICULTY#{difficulty}
  SK = SUBJECT#{subject}#GRADE#{grade}
  Projection: KEYS_ONLY
  Purpose: Admin queries; model router difficulty distribution checks

GSI3: HashIndex (deduplication)
  PK = HASH#{hash}
  SK = QUESTION#{questionId}
  Projection: KEYS_ONLY
  Purpose: addIfNotExists() condition check without full scan
```

**Access Patterns**

| Operation | Method | Key | Notes |
|---|---|---|---|
| `getQuestionsForCriteria(grade, subject, topic, difficulty, limit)` | GSI1 Query | PK=GRADE#N#SUBJECT#X, SK begins_with TOPIC#Y#DIFF#Z | Filter status=ACTIVE; limit=questionCount*3 for pool |
| `addIfNotExists(question)` | PutItem + ConditionExpression | PK=QUESTION#{uuid}, SK=METADATA | `attribute_not_exists(PK)` for UUID uniqueness; GSI3 check for hash dedup |
| `recordQuestionReuse(questionId)` | UpdateItem | PK=QUESTION#{uuid}, SK=METADATA | `ADD reuseCount 1, SET lastUsedAt = now` |
| `flagQuestion(questionId)` | UpdateItem | PK=QUESTION#{uuid}, SK=METADATA | `SET status = 'FLAGGED'` |
| `getQuestionById(questionId)` | GetItem | PK=QUESTION#{uuid}, SK=METADATA | Direct lookup for admin UI |

**QB Adapter Interface (unchanged)**
The DynamoDB adapter must implement the same interface as the local JSON adapter:
```javascript
getQuestionsForCriteria(grade, subject, topic, difficulty, limit) → Promise<Question[]>
addIfNotExists(question)                                          → Promise<void>
recordQuestionReuse(questionId)                                   → Promise<void>
```

**Acceptance Criteria**

| # | Given | When | Then |
|---|---|---|---|
| AC-008-01 | QuestionBank table exists in DynamoDB | GSI1 queried for grade=3, subject=Math, topic=Multiplication, difficulty=Medium | Returns all ACTIVE questions matching criteria |
| AC-008-02 | Question with identical hash already exists | `addIfNotExists()` called | No write occurs (ConditionExpression prevents duplicate) |
| AC-008-03 | Question with new hash inserted | `addIfNotExists()` called | New item written; reuseCount=0; status=ACTIVE |
| AC-008-04 | Question used in a worksheet | `recordQuestionReuse()` called | reuseCount incremented; lastUsedAt updated |
| AC-008-05 | QB_ADAPTER=local | Handler builds adapter | JSON adapter used; DynamoDB not called |
| AC-008-06 | QB_ADAPTER=dynamodb | Handler builds adapter | DynamoDB adapter used; all reads/writes to table |

**Out of Scope**
- Admin UI for flagging/approving questions
- Bulk import tooling
- Cross-teacher question ownership (all questions are platform-global)

**QA Test Locations**
- `tests/unit/questionBankDynamoAdapter.test.js` (new file) — mock DynamoDB with aws-sdk-client-mock
- `tests/unit/assembler.test.js` — QB_ADAPTER=dynamodb routing test

---

## 9.4 TASK-GEN-009 — DynamoDB Table for Question Bank (CDK)

### Feature: QuestionBank DynamoDB Table Infrastructure

**User Story**
As a **DevOps engineer**, I need the QuestionBank DynamoDB table defined in the CDK stack with correct key structure, GSIs, IAM grants, and removal policies so that the DynamoDB adapter can be deployed to staging and production.

**Acceptance Criteria**

| # | Given | When | Then |
|---|---|---|---|
| AC-009-01 | CDK synth runs for any env | `npx cdk synth` | Zero warnings; CloudFormation template includes QuestionBank table definition |
| AC-009-02 | Dev/staging environment | CDK deploys | RemovalPolicy.DESTROY so teardown works cleanly |
| AC-009-03 | Production environment | CDK deploys | RemovalPolicy.RETAIN so data is not lost on stack update |
| AC-009-04 | Generate Lambda deployed | Lambda environment | `QB_TABLE_NAME` env var set to actual table name (no hardcoded name) |
| AC-009-05 | Generate Lambda deployed | IAM | `grantReadWriteData` applied — Lambda has PutItem, GetItem, UpdateItem, Query on table + indexes |
| AC-009-06 | CDK assertion test runs | `cd infra/cdk && npm test` | Test confirms table exists, GSI1 (CurriculumQuery) defined, GSI2 (DifficultyQuery) defined, billing mode is PAY_PER_REQUEST |
| AC-009-07 | Staging deploy with QB_ADAPTER=dynamodb | Generation request | Lambda reads/writes to DynamoDB table successfully (smoke test) |

**CDK Construct Specification**

```typescript
// Table name pattern (no hardcoded name):
const questionBankTable = new dynamodb.Table(this, 'QuestionBankTable', {
  tableName: `learnfyra-${appEnv}-question-bank`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  pointInTimeRecovery: isProd,
});

// GSI1: CurriculumQuery
questionBankTable.addGlobalSecondaryIndex({
  indexName: 'CurriculumQuery',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// GSI2: DifficultyQuery
questionBankTable.addGlobalSecondaryIndex({
  indexName: 'DifficultyQuery',
  partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.KEYS_ONLY,
});

// GSI3: HashIndex (dedup)
questionBankTable.addGlobalSecondaryIndex({
  indexName: 'HashIndex',
  partitionKey: { name: 'HASH', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.KEYS_ONLY,
});

// IAM grant + env var injection
questionBankTable.grantReadWriteData(generateFn);
generateFn.addEnvironment('QB_TABLE_NAME', questionBankTable.tableName);
```

**CloudWatch Alarms (add to CDK)**
- `QuestionBankSystemErrors` — Sum of SystemErrors > 0 over 5 min → SNS alert
- `QuestionBankUserErrors` — Sum of UserErrors > 10 over 5 min → SNS alert (misconfigured adapter)

**Dependencies**
- TASK-GEN-008 schema decision (this task implements it)
- Must not break existing CDK synth for any environment

**Out of Scope**
- DynamoDB adapter code (TASK-QB-004)
- Data migration from local JSON to DynamoDB (separate migration task)
- Backups beyond point-in-time recovery
