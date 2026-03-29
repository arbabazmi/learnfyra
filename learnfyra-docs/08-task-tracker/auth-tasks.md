# Auth Tasks — M01

## Requirements Traceability

| Req ID | Requirement | Task IDs | Status |
|---|---|---|---|
| REQ-AUTH-001 | Google OAuth Sign-In | M01-BE-01, M01-FE-03 | Backend DONE, FE TODO |
| REQ-AUTH-002 | Email/Password Sign-In | M01-BE-01 | DONE |
| REQ-AUTH-003 | Role Assignment | M01-BE-01 | DONE |
| REQ-AUTH-004 | JWT Access Tokens | M01-BE-01 | DONE |
| REQ-AUTH-005 | Refresh Tokens | M01-BE-01 | DONE |
| REQ-AUTH-006 | Lambda Authorizer | M01-BE-01 | DONE |
| REQ-AUTH-007 | Guest Mode | M01-BE-01 | DONE |
| REQ-AUTH-008 | Role-Based Route Protection | M01-BE-01 | DONE |
| REQ-AUTH-009 | Token Revocation on Logout | M01-BE-01 | DONE |
| REQ-AUTH-010 | Local Mode Compatibility | M01-BE-01 | DONE |
| REQ-AUTH-011 | Rate Limiting on Auth Endpoint | CDK-005 | DONE (API GW WAF rule) |
| REQ-AUTH-012 | Password Requirements | CDK-005 (Cognito policy) | DONE |
| REQ-AUTH-013 | PII Data Minimization | M01-BE-01 (Users table schema) | DONE |
| REQ-AUTH-014 | Multi-Environment Cognito Isolation | CDK-005 per env | DONE |
| REQ-AUTH-015 | No Admin Self-Registration | M01-BE-01 (validation in handler) | DONE |

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

### M01-FE-02 (TODO)
**Scope:** register.html with role selection

**Notes:**
- Role selection: Student / Teacher / Parent radio buttons
- Show school name field only for teachers (optional)
- After registration, redirect to role-appropriate onboarding (or index.html for Phase 1)

### M01-FE-03 (TODO)
**Scope:** Google OAuth PKCE client-side code

**Notes:**
- Generate code_verifier (random 64-byte base64url string)
- Compute code_challenge = base64url(SHA256(code_verifier))
- Store code_verifier in sessionStorage (not localStorage — single page use)
- Build Cognito Hosted UI URL with response_type=code, code_challenge, scope
- On redirect back, extract code from URL, call POST /api/auth/token with code + code_verifier

### M01-FE-04 (TODO)
**Scope:** Token storage + auto-refresh

**Notes:**
- Store access token in localStorage
- Store refresh token in localStorage (secure enough for Phase 1 — httpOnly cookie planned for Phase 2)
- Before each API call: check token expiry (JWT exp claim), refresh if expired
- On 401 response: try refresh once, retry original request, then redirect to login

### M01-FE-05 (TODO)
**Scope:** Logout button + handler

**Notes:**
- Call POST /api/auth/logout
- Clear localStorage (accessToken, refreshToken)
- Redirect to landing page
