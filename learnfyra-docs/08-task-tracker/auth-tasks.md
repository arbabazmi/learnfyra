# Auth Tasks — M01

## Requirements Traceability

| Req ID | Requirement | Task IDs | Status |
|---|---|---|---|
| REQ-AUTH-001 | Google OAuth Sign-In (13+ only) | M01-BE-01, M01-FE-03 | Backend DONE, FE TODO |
| REQ-AUTH-002 | Email/Password Sign-In (13+ only) | M01-BE-01 | DONE |
| REQ-AUTH-003 | Role Assignment | M01-BE-01 | DONE |
| REQ-AUTH-004 | JWT Access Tokens (+ ageGroup, parentId) | M01-BE-01 | DONE (needs COPPA fields) |
| REQ-AUTH-005 | Refresh Tokens | M01-BE-01 | DONE |
| REQ-AUTH-006 | Lambda Authorizer | M01-BE-01 | DONE |
| REQ-AUTH-007 | Guest Mode (no tracking) | M01-BE-01 | DONE |
| REQ-AUTH-008 | Role-Based Route Protection | M01-BE-01 | DONE |
| REQ-AUTH-009 | Token Revocation on Logout | M01-BE-01 | DONE |
| REQ-AUTH-010 | Local Mode Compatibility | M01-BE-01 | DONE |
| REQ-AUTH-011 | Rate Limiting on Auth Endpoint | CDK-005 | DONE (API GW WAF rule) |
| REQ-AUTH-012 | Password Requirements | CDK-005 (Cognito policy) | DONE |
| REQ-AUTH-013 | PII Data Minimization (enhanced for <13) | M01-BE-01 (Users table schema) | DONE (needs COPPA update) |
| REQ-AUTH-014 | Multi-Environment Cognito Isolation | CDK-005 per env | DONE |
| REQ-AUTH-015 | No Admin Self-Registration | M01-BE-01 (validation in handler) | DONE |
| REQ-AUTH-016 | Age Gate | M01-FE-06 | TODO |
| REQ-AUTH-017 | No Direct Signup for Under 13 | M01-FE-02, M01-FE-06 | TODO |
| REQ-AUTH-018 | Child Consent Request | M01-BE-09, M01-FE-02 | TODO |
| REQ-AUTH-019 | Consent Email | M01-BE-09 | TODO |
| REQ-AUTH-020 | Verifiable Parental Consent (VPC) | M01-BE-09, M01-FE-07 | TODO |
| REQ-AUTH-021 | PendingConsent Expiry (72h TTL) | M01-BE-09, CDK | TODO |
| REQ-AUTH-022 | Child Account Creation (Post-Consent) | M01-BE-10, M01-BE-11 | TODO |
| REQ-AUTH-023 | Parent Dashboard — Child Data Mgmt | M01-BE-10, M01-FE-08 | TODO |
| REQ-AUTH-024 | Consent Revocation + Data Deletion | M01-BE-10 | TODO |
| REQ-AUTH-025 | Child Session Management | M01-BE-10, M01-FE-08 | TODO |
| REQ-AUTH-026 | Consent Audit Trail (ConsentLog) | M01-BE-09, M01-BE-11 | TODO |
| REQ-AUTH-027 | Data Minimization for Under 13 | M01-BE-11 | TODO |
| REQ-AUTH-028 | Privacy Policy Requirements | Legal / Content | TODO |

## Detailed Task Descriptions

### M01-BE-01 (DONE)
**Scope:** Cognito User Pool CDK, Lambda Authorizer, auth handler for token/refresh/logout/me

**Key decisions made:**
- JWT HS256 in local mode (faster, no key rotation needed for dev)
- Lambda Authorizer caches policy for 5 minutes (API Gateway TTL) — reduces Authorizer invocations
- Users table `email-index` GSI enables O(1) email lookup during auth

**Files created:**
- `src/auth/cognitoClient.js`
- `src/auth/tokenService.js`
- `src/auth/userService.js`
- `backend/handlers/authHandler.js`
- `backend/middleware/authorizer.js`
- `tests/unit/authHandler.test.js`
- `tests/unit/authorizer.test.js`

### M01-BE-02 (DONE)
**Scope:** Register endpoint, link-child endpoint

**Files modified:**
- `backend/handlers/authHandler.js` (added register, link-child routes)
- `src/auth/userService.js` (added createUser, linkChild)

### M01-FE-01 (TODO)
**Scope:** login.html + auth.js + auth.css

**Notes:**
- Use Cognito Hosted UI URL for Google OAuth button (not custom OAuth implementation)
- PKCE challenge generated client-side in auth.js
- Access token stored in localStorage (not httpOnly cookie — simpler for Phase 1)
- Redirect URL after login: read from `?return_to` query param, default to index.html

### M01-FE-02 (TODO) — UPDATED for COPPA
**Scope:** register.html with age gate + role selection + under-13 parent-gated flow

**Notes:**
- **Step 1 — Age Gate:** "Are you under 13?" displayed first, before any form fields
- **Step 2a (13+):** Role selection: Student / Teacher / Parent radio buttons
  - Show school name field only for teachers (optional)
  - After registration, redirect to role-appropriate onboarding (or index.html for Phase 1)
- **Step 2b (Under 13):** Only parent email + optional nickname fields
  - Calls POST /api/auth/child-request
  - Shows "Ask your parent to check their email" message
  - NO account created, NO Cognito token issued
- Age gate CANNOT be skipped or bypassed

### M01-FE-03 (TODO)
**Scope:** Google OAuth PKCE client-side code

**Notes:**
- Generate code_verifier (random 64-byte base64url string)
- Compute code_challenge = base64url(SHA256(code_verifier))
- Store code_verifier in sessionStorage (not localStorage — single page use)
- Build Cognito Hosted UI URL with response_type=code, code_challenge, scope
- On redirect back, extract code from URL, call POST /api/auth/token with code + code_verifier
- **COPPA:** Google OAuth button only shown for 13+ users (after age gate)

### M01-FE-04 (TODO)
**Scope:** Token storage + auto-refresh

**Notes:**
- Store access token in localStorage
- Store refresh token in localStorage (secure enough for Phase 1 — httpOnly cookie planned for Phase 2)
- Before each API call: check token expiry (JWT exp claim), refresh if expired
- On 401 response: try refresh once, retry original request, then redirect to login
- **COPPA:** Child session tokens (ageGroup=under13) stored in sessionStorage, not localStorage

### M01-FE-05 (TODO)
**Scope:** Logout button + handler

**Notes:**
- Call POST /api/auth/logout
- Clear localStorage (accessToken, refreshToken)
- Redirect to landing page

### M01-FE-06 (TODO) — NEW (COPPA)
**Scope:** Age gate component for register.html

**Notes:**
- Must be the first screen, blocking all other form elements
- Two options: "Yes, I am under 13" / "No, I am 13 or older"
- Determines which registration flow is rendered
- Cannot be dismissed without answering
- Accessible: keyboard-navigable, screen-reader friendly

### M01-FE-07 (TODO) — NEW (COPPA)
**Scope:** consent.html — Parental consent page

**Notes:**
- Reads `?token=` from URL query string
- Calls GET /api/auth/consent/:token to load consent details
- Shows data collection summary, parent rights, Privacy Policy link
- If parent not logged in: shows registration/login form inline
- "I Consent" button calls POST /api/auth/consent/:token
- On success: redirects to Parent Dashboard
- On expired token: shows "This link has expired" message

### M01-FE-08 (TODO) — NEW (COPPA)
**Scope:** parent-dashboard.html — Parent Dashboard for child management

**Notes:**
- Requires authentication (parent role) — uses requireAuth()
- Calls GET /api/auth/children to list child accounts
- Per child: "Start Session", "View Data", "Download Data", "Delete Account"
- "Start Session" calls POST /api/auth/child-session, redirects to index.html
- "Download Data" calls GET /api/auth/child-data/:childId, triggers JSON download
- "Delete Account" shows confirmation dialog, calls DELETE /api/auth/children/:childId
- "Revoke Consent" shows explanation dialog, calls POST /api/auth/revoke-consent/:childId

### M01-BE-09 (TODO) — NEW (COPPA)
**Scope:** consentHandler.js — Backend handler for consent flow

**Notes:**
- POST /api/auth/child-request: create PendingConsent record, send consent email
- GET /api/auth/consent/:token: return consent details for valid token
- POST /api/auth/consent/:token: record consent, create parent account (if new), create child account
- Consent email sent via SES (AWS) or nodemailer (local)

### M01-BE-10 (TODO) — NEW (COPPA)
**Scope:** parentHandler.js — Backend handler for parent dashboard endpoints

**Notes:**
- GET /api/auth/children: list children for authenticated parent
- GET /api/auth/child-data/:childId: export all child data
- DELETE /api/auth/children/:childId: cascading delete (Users + S3 + Cognito)
- POST /api/auth/revoke-consent/:childId: same as delete + update ConsentLog
- POST /api/auth/child-session: issue scoped child JWT
- POST /api/auth/child-account: create additional child under parent

### M01-BE-11 (TODO) — NEW (COPPA)
**Scope:** consentService.js + childAccountService.js — Service layer

**Notes:**
- consentService.js: PendingConsent CRUD, ConsentLog CRUD, consent token generation
- childAccountService.js: child account creation, parent-child linking, cascading deletion
- ageGate.js: validate age gate response, enforce flow routing
