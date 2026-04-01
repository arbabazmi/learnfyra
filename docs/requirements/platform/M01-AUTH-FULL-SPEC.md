# M01: Authentication & Identity Management — Full Specification
# File: docs/requirements/platform/M01-AUTH-FULL-SPEC.md
# Module: M01
# Version: 1.0
# Date: 2026-03-27
# Status: Approved — Ready for DEV and QA
# Authors: BA Agent + Architect Agent
# Branch: backend-design-requirnment

---

## Table of Contents

1. Module Overview
2. User Roles and Access Matrix
3. User Stories
4. Functional Requirements
5. Non-Functional Requirements
6. Backend API Contracts
7. DynamoDB Data Model
8. Frontend Specification (Angular 17+)
9. Security Requirements
10. Integration Map
11. QA Hooks
12. Open Decisions

---

## 1. Module Overview

### Purpose

Module 01 provides authentication and identity for all Learnfyra users. It controls who can enter the platform, what role they carry, and which resources they may access. Every other module depends on a valid, role-bearing JWT produced by this module.

### What Is Already Built (Do Not Rebuild)

The following components exist in the codebase and are production-ready or local-ready. Spec them accurately; do not redesign them.

| Component | File | State |
|---|---|---|
| Auth handler (all routes) | `backend/handlers/authHandler.js` | Done |
| API Gateway Lambda Authorizer | `backend/handlers/apiAuthorizerHandler.js` | Done |
| Auth middleware (validateToken, assertRole, assertParentLink) | `backend/middleware/authMiddleware.js` | Done |
| Mock adapter (bcrypt + local JSON) | `src/auth/mockAuthAdapter.js` | Done |
| Cognito adapter (Google PKCE OAuth) | `src/auth/cognitoAdapter.js` | Done |
| OAuth stub adapter (local dev) | `src/auth/oauthStubAdapter.js` | Done |
| Adapter factory | `src/auth/index.js` | Done |
| JWT utilities (sign, verify, refresh, OAuth state) | `src/auth/tokenUtils.js` | Done |

### MVP Scope (Phase 1 — Current)

- Local email/password registration and login via `mockAuthAdapter` (dev/local only)
- Google OAuth via `cognitoAdapter` (staging and prod, `AUTH_MODE=cognito`)
- JWT HS256 access tokens (1h) and refresh tokens (30d)
- Roles: student, teacher, parent
- Token refresh endpoint
- Lambda Authorizer for API Gateway route protection
- Parent-child link enforcement via `assertParentLink`
- Rate limiting on auth endpoints via API Gateway Usage Plans

### Phase 2+ Scope (Deferred — Do Not Build Now)

- Second OAuth provider (GitHub or Microsoft — provider not yet decided)
- Admin role full wiring (role exists in code but admin-only route enforcement is incomplete)
- Multi-provider account linking (same email, Google + second provider)
- MFA / step-up authentication
- LMS SSO / multi-tenant school federation

### Success Metrics

The module is working well when all of the following are true:

1. 99.9% of valid login attempts return a token within 2 seconds (p99).
2. 100% of protected routes return 401 for missing token, 403 for wrong role — confirmed by automated QA gate.
3. JWT_SECRET is never present in any Lambda environment variable in plaintext — always resolved from AWS Secrets Manager.
4. Zero duplicate user accounts created for the same email across auth providers.
5. ALLOWED_ORIGIN is never `*` in staging or prod — confirmed by CDK synth check.
6. Auth endpoint error rate stays below 1% over any 5-minute window in CloudWatch.

---

## 2. User Roles and Access Matrix

### Role Definitions

| Role | Description | Registration Path | Token Claim |
|---|---|---|---|
| `student` | Primary learner. Solves worksheets, views own history and rewards. Default role for all OAuth sign-ins. | Self-register (local dev) or Google OAuth | `"role": "student"` |
| `teacher` | Generates worksheets, manages classes, views class analytics. | Self-register with `role: teacher` | `"role": "teacher"` |
| `parent` | Views progress of a linked child student. Cannot generate or view other students. | Self-register with `role: parent` | `"role": "parent"` |
| `admin` | Platform operations. Full access to admin endpoints. Not self-registerable. | Seeded by DevOps — see Open Decisions section 12. | `"role": "admin"` |

### Access Matrix

| Action / Resource | Guest (no token) | Student | Teacher | Parent | Admin |
|---|---|---|---|---|---|
| Register / Login | Yes | Yes | Yes | Yes | Yes |
| Google OAuth | Yes | Yes | Yes | Yes | Yes |
| Token Refresh | No (needs refresh token) | Yes | Yes | Yes | Yes |
| POST /api/generate (create worksheet) | No | No | Yes | No | Yes |
| GET /api/solve/:id | Yes (public) | Yes | Yes | Yes | Yes |
| POST /api/submit (tracked solve) | No | Yes | No | No | Yes |
| GET /api/progress/history | No | Own only | Class students only | Linked child only | Yes |
| POST /api/class/create | No | No | Yes | No | Yes |
| GET /api/analytics/class/:classId | No | No | Own classes only | No | Yes |
| GET /api/rewards/student/:studentId | No | Own only | Class students only | Linked child only | Yes |
| GET /api/student/profile | No | Own only | No direct access | No | Yes |
| Admin endpoints (/api/admin/*) | No | No | No | No | Yes |
| Parent access to child data | No | No | No | Active link required | Yes |

Note: "Guest" means no Authorization header is present. The Lambda Authorizer denies the request at API Gateway before Lambda is invoked for all protected routes.

---

## 3. User Stories

US-AUTH-001: As a teacher, I want to register with my email and password, so that I can create a secure account and start generating worksheets without needing a Google account.

US-AUTH-002: As a student, I want to sign in with my Google account, so that I do not need to remember a separate password and can get started quickly.

US-AUTH-003: As a teacher, I want my session to stay active for a day of classroom use without logging out repeatedly, so that I can generate multiple worksheets without interruption.

US-AUTH-004: As a student, I want my access token to expire after one hour and silently refresh, so that a stolen token from a shared school computer does not give long-term access to my account.

US-AUTH-005: As a parent, I want to register with the parent role and link to my child's account, so that I can view only my child's progress and nothing else.

US-AUTH-006: As a parent, I want to be shown a guided linking screen when I log in and no child link exists yet, so that I understand what to do next rather than seeing an error.

US-AUTH-007: As a student, I want the system to reject a tampered JWT claim attempting to escalate my role to teacher, so that I cannot access worksheet generation even if I modify my client-side token.

US-AUTH-008: As a teacher, I want to log out and have my session immediately invalidated on the client, so that the next person using a shared computer cannot access my account.

US-AUTH-009: As a developer, I want all auth endpoints to include CORS headers on every response including error paths, so that the Angular frontend deployed on CloudFront can call the API without browser-level CORS failures.

US-AUTH-010: As an admin, I want to be the only user who can access admin control-plane endpoints, so that student data, configuration, and AI model controls cannot be reached by teachers or parents.

US-AUTH-011: As a teacher, I want duplicate registration for the same email to be rejected with a clear error, so that I know to use the login form or password reset instead of creating a second account.

US-AUTH-012: As a developer on the platform team, I want the auth system to use a different adapter for local development versus AWS deployment, so that I can test the full auth flow locally without Cognito credentials.

---

## 4. Functional Requirements

Requirements use format FR-AUTH-NNN. Priority: P0 = must-have for any deployment, P1 = must-have before production traffic, P2 = deferred.

### Registration

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-001 | POST /api/auth/register must accept `{ email, password, role, displayName }` and return `{ userId, email, role, displayName, token }` on success | P0 | Access token only; refresh token not returned on register in current implementation |
| FR-AUTH-002 | Accepted roles for registration are: `student`, `teacher`, `parent` only | P0 | `admin` cannot be self-registered; 400 returned if attempted |
| FR-AUTH-003 | Email must be normalized to lowercase and trimmed before storage and all lookups | P0 | " User@Example.COM " must store and match as "user@example.com" |
| FR-AUTH-004 | Password must be hashed with bcrypt (10 rounds) before storage | P0 | Plain-text password must never appear in logs or response bodies |
| FR-AUTH-005 | Duplicate email registration must return 409 with message "An account with that email already exists." | P0 | Error code AUTH_CONFLICT |
| FR-AUTH-006 | Missing required fields must return 400 with a descriptive message | P0 | "email, password, role, and displayName are required." |
| FR-AUTH-007 | Registration is only available in `AUTH_MODE=mock` (local dev). In `AUTH_MODE=cognito`, POST /api/auth/register returns 503 directing users to Google sign-in | P0 | cognitoAdapter.createUser() throws 503 by design |

### Login

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-010 | POST /api/auth/login must accept `{ email, password }` and return `{ userId, email, role, displayName, token }` on success | P0 | |
| FR-AUTH-011 | Invalid email or invalid password must both return 401 with identical message "Invalid email or password." — never distinguish which field is wrong | P0 | Prevents email enumeration |
| FR-AUTH-012 | Successful login must issue a JWT HS256 access token with claims `{ sub, email, role, exp }` | P0 | Default expiry: 7d in local mock; 1h in Cognito mode |
| FR-AUTH-013 | Token expiry: access token = 1h in production (Cognito); 7d in local dev (mock adapter default) | P0 | tokenUtils.js `signToken` default is 7d; cognitoAdapter overrides to 1h |

### Token Refresh

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-020 | POST /api/auth/refresh must accept `{ refreshToken }` and return `{ token }` (new 1h access token) | P1 | |
| FR-AUTH-021 | Refresh tokens must expire after 30 days | P1 | `signRefreshToken` uses `expiresIn: '30d'` |
| FR-AUTH-022 | Refresh token must carry a `type: 'refresh'` claim to prevent access tokens from being used as refresh tokens | P1 | `verifyRefreshToken` enforces this check |
| FR-AUTH-023 | Invalid or expired refresh token must return 401 | P1 | |

### Logout

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-030 | POST /api/auth/logout must return 200 with `{ message: 'Logged out.' }` regardless of whether a token is present | P0 | MVP: client-side token discard only; no server-side token blocklist |
| FR-AUTH-031 | The Angular client must clear stored tokens from memory and localStorage on logout | P0 | Backend cannot enforce; frontend AuthService is responsible |

### Google OAuth

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-040 | POST /api/auth/oauth/google must return `{ authorizationUrl, state }` for the Cognito Hosted UI | P0 | PKCE code_challenge (S256) included in the URL |
| FR-AUTH-041 | The `state` parameter must be a signed, 10-minute JWT containing `{ nonce, code_verifier }` | P0 | `signOAuthState` from tokenUtils.js |
| FR-AUTH-042 | GET /api/auth/callback/google must verify the `state` JWT, extract `code_verifier`, exchange the code with Cognito, fetch userInfo, and issue an HS256 JWT | P0 | |
| FR-AUTH-043 | OAuth callback must reject unverified email addresses (`email_verified: false` from Cognito userInfo) | P0 | Returns 400 "Google account email is not verified." |
| FR-AUTH-044 | OAuth sign-in always assigns `role: 'student'` by default | P0 | Role upgrade (to teacher/parent) is a separate profile operation, not part of OAuth callback |
| FR-AUTH-045 | OAuth redirect URIs must be environment-specific: `https://dev.learnfyra.com/api/auth/callback/google` (dev), `https://qa.learnfyra.com/api/auth/callback/google` (staging), `https://www.learnfyra.com/api/auth/callback/google` (prod) | P0 | Configured via `OAUTH_CALLBACK_BASE_URL` env var injected by CDK |
| FR-AUTH-046 | In local dev (`AUTH_MODE=mock`), the OAuth stub adapter must accept any provider in `['google', 'github']` and return a mock authorization URL and mock user | P0 | Allows frontend to test OAuth flow without real Cognito credentials |

### Token Validation and Role Enforcement

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-050 | The API Gateway Lambda Authorizer (`apiAuthorizerHandler.js`) must validate the Bearer JWT on all protected routes before Lambda is invoked | P0 | Returns IAM Deny policy for invalid tokens; throws `'Unauthorized'` which API GW maps to 401 |
| FR-AUTH-051 | The Lambda Authorizer must inject `{ sub, email, role }` into the API Gateway request context for downstream handlers | P0 | Context fields available as `requestContext.authorizer.sub` etc. |
| FR-AUTH-052 | Handler-level `validateToken(event)` must be used for routes not covered by the Lambda Authorizer | P0 | Returns decoded `{ sub, email, role }` or throws with `.statusCode = 401` |
| FR-AUTH-053 | `assertRole(decoded, allowedRoles)` must be called in every handler that restricts by role | P0 | Throws `.statusCode = 403` when role is not in the allowed list |
| FR-AUTH-054 | A client-side attempt to escalate role by modifying the JWT payload must result in 401 (signature verification failure) | P0 | JWT HS256 signature validation enforces this |

### Parent-Child Link Enforcement

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-060 | `assertParentLink(decoded, childId)` must be called whenever a parent requests student-scoped data | P1 | Queries `parentLinks` table for an active link between `decoded.sub` and `childId` |
| FR-AUTH-061 | A parent with no active link accessing child data must receive 403 "Access denied: no active parent-child link for this student." | P1 | |
| FR-AUTH-062 | Non-parent roles bypass the parent-link check entirely | P0 | `assertParentLink` is a no-op for `role !== 'parent'` |

### Admin Role

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-070 | The system must support an `admin` role in JWT claims | P0 | `admin` added to VALID_ROLES in authHandler; not yet self-registerable |
| FR-AUTH-071 | Admin-only endpoints must use `assertRole(['admin'])` middleware | P0 | Any non-admin token returns 403 |
| FR-AUTH-072 | Admin users must be provisioned by the DevOps team via a seeding script — not self-registration | P0 | See Open Decision OD-001 |

### Rate Limiting

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-080 | POST /api/auth/register must be rate-limited to 5 requests per minute per IP | P0 | Enforced at API Gateway Usage Plan level |
| FR-AUTH-081 | POST /api/auth/login must be rate-limited to 10 requests per minute per IP | P0 | Enforced at API Gateway Usage Plan level |
| FR-AUTH-082 | POST /api/auth/oauth/google must be rate-limited to 10 requests per minute per IP | P0 | |
| FR-AUTH-083 | Rate-limited requests must return 429 Too Many Requests from API Gateway | P0 | |

### Cross-Cutting Auth Requirements

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-AUTH-090 | All auth endpoints must return CORS headers on every response, including error paths and OPTIONS preflight | P0 | `ALLOWED_ORIGIN` from env var — never `*` in prod |
| FR-AUTH-091 | OPTIONS preflight must return 200 with CORS headers and empty body | P0 | Handled in authHandler.js before routing |
| FR-AUTH-092 | All auth error responses must use the schema `{ "error": "message string" }` | P0 | No other error shape allowed from auth routes |
| FR-AUTH-093 | JWT_SECRET must be loaded from AWS Secrets Manager in staging/prod; local dev uses a fallback constant | P0 | tokenUtils.js enforces this: throws if `JWT_SECRET` is absent in AWS/prod runtimes |

---

## 5. Non-Functional Requirements

### 5.1 Security

- JWT algorithm: HS256 only. RS256 is not used. Algorithm must be explicitly specified on both sign and verify calls to prevent the `alg: none` attack.
- JWT claims required on every token: `sub` (userId), `email`, `role`, `exp`, `iat`.
- `JWT_SECRET` minimum entropy: 256 bits (32 bytes of cryptographically random data). Stored in AWS Secrets Manager at path `learnfyra/{env}/jwt-secret`. Never hardcoded.
- CORS `ALLOWED_ORIGIN` must be the exact CloudFront domain (`https://learnfyra.com` in prod). Wildcard `*` is forbidden in staging and prod. The CDK stack injects the correct value via environment variable.
- OAuth state parameter: must be a signed JWT (10-minute expiry) containing the PKCE `code_verifier` and a nonce. The callback handler must verify the state signature before exchanging the authorization code. Any invalid or expired state must reject the callback with 400.
- PKCE S256 method is required for all OAuth flows. Authorization code without PKCE is not accepted.
- Passwords must never appear in log output. `passwordHash` must be stripped from all user objects before they are returned or logged.
- Input sanitization: OAuth provider names must be stripped of all characters outside `[a-zA-Z0-9_-]` before use in URL construction or logging to prevent injection.

### 5.2 Performance

- Lambda Authorizer cold start target: under 800ms (p99). ARM_64 architecture and `NodejsFunction` with esbuild bundling achieve this.
- Token validation latency: under 50ms for a warm Lambda (pure in-memory HS256 verify with no external calls).
- Auth handler (`learnfyra-auth` Lambda) memory: 256MB, timeout: 10s. OAuth callback may call Cognito token endpoint — 10s provides adequate headroom.
- Lambda Authorizer memory: 128MB, timeout: 5s. Authorizer is stateless HS256 verify — no external calls.

### 5.3 Accessibility

- Login and register forms must conform to WCAG 2.1 AA.
- All form fields must have visible `<label>` elements associated via `for`/`id` attributes.
- Error messages must not rely on color alone. Use icon + text alongside color.
- The Google OAuth button must have a text label readable by screen readers (not icon-only).
- Keyboard navigation must work for the full login flow: tab through fields, submit with Enter.
- Focus management: after a failed login attempt, focus must return to the email field with an ARIA live region announcing the error.

### 5.4 Scalability

- Auth is stateless. JWT validation requires no database call — scales horizontally without coordination.
- The `parentLinks` check in `assertParentLink` makes one DynamoDB read per request. This is acceptable at current scale and can be cached with ElastiCache if latency becomes an issue.
- API Gateway Usage Plans provide rate limiting at the edge — no Lambda invocations are consumed by throttled requests.
- Cognito User Pool scales to millions of users without infrastructure changes.

---

## 6. Backend API Contracts

Base path: `/api/auth`

All responses include CORS headers:
```
Access-Control-Allow-Origin: {ALLOWED_ORIGIN}
Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization
Access-Control-Allow-Methods: GET,POST,OPTIONS
```

All error responses use:
```json
{ "error": "Human-readable message string" }
```

Lambda handler: `backend/handlers/authHandler.js` — handles all six routes listed below.
Lambda name in AWS: `learnfyra-auth-{env}` (to be defined in CDK — currently routed through a single auth handler).

---

### 6.1 POST /api/auth/register

Auth required: No

Request body:
```json
{
  "email": "teacher@school.edu",
  "password": "SecurePass1!",
  "role": "teacher",
  "displayName": "Ms. Rivera"
}
```

Field rules:
- `email`: required, string, normalized to lowercase and trimmed
- `password`: required, string, minimum 8 characters (enforcement is adapter responsibility)
- `role`: required, enum `["student", "teacher", "parent"]`
- `displayName`: required, string, non-empty

Success response (200):
```json
{
  "userId": "a3b4c5d6-e7f8-4a1b-9c2d-3e4f5a6b7c8d",
  "email": "teacher@school.edu",
  "role": "teacher",
  "displayName": "Ms. Rivera",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Note: refresh token is not returned on registration in the current implementation.

Error responses:

| Status | Error Code | Condition |
|---|---|---|
| 400 | AUTH_VALIDATION | Missing required field |
| 400 | AUTH_VALIDATION | Invalid role value |
| 409 | AUTH_CONFLICT | Email already registered |
| 503 | AUTH_UNAVAILABLE | Called in `AUTH_MODE=cognito` — email/password registration not supported |
| 500 | AUTH_INTERNAL | Unhandled server error |

---

### 6.2 POST /api/auth/login

Auth required: No

Request body:
```json
{
  "email": "teacher@school.edu",
  "password": "SecurePass1!"
}
```

Field rules:
- `email`: required, string
- `password`: required, string

Success response (200):
```json
{
  "userId": "a3b4c5d6-e7f8-4a1b-9c2d-3e4f5a6b7c8d",
  "email": "teacher@school.edu",
  "role": "teacher",
  "displayName": "Ms. Rivera",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Note: refresh token is not returned in the current login response. The Angular client must call POST /api/auth/refresh using the access token before expiry to obtain a new access token.

Error responses:

| Status | Error Code | Condition |
|---|---|---|
| 400 | AUTH_VALIDATION | Missing email or password |
| 401 | AUTH_UNAUTHORIZED | Invalid email or password (identical message for both cases) |
| 500 | AUTH_INTERNAL | Unhandled server error |

---

### 6.3 POST /api/auth/logout

Auth required: No (client sends whatever token it has; server always returns 200)

Request body: empty `{}` or any JSON

Success response (200):
```json
{
  "message": "Logged out."
}
```

No error responses. This endpoint is deliberately unconditional. Token invalidation is the client's responsibility.

---

### 6.4 POST /api/auth/refresh

Auth required: No (the refresh token itself is the credential)

Request body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Field rules:
- `refreshToken`: required, string — must be a JWT with `type: 'refresh'` claim

Success response (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

The returned token is a new access token with 1-hour expiry. The refresh token itself is not rotated in the current implementation.

Error responses:

| Status | Error Code | Condition |
|---|---|---|
| 400 | AUTH_VALIDATION | `refreshToken` field is missing |
| 401 | AUTH_UNAUTHORIZED | Refresh token is invalid, expired, or not of type `refresh` |

---

### 6.5 POST /api/auth/oauth/google

Auth required: No

Request body: empty `{}` (provider is determined by the URL path)

Success response (200):
```json
{
  "authorizationUrl": "https://learnfyra-dev.auth.us-east-1.amazoncognito.com/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid+email+profile&state=eyJ...&identity_provider=Google&code_challenge=...&code_challenge_method=S256",
  "state": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

The client must redirect the user's browser to `authorizationUrl`. The `state` value is a signed JWT. The Angular client should store it temporarily to cross-check against the value returned in the OAuth callback redirect (defence-in-depth, though the backend also verifies state signature independently).

In local dev (`AUTH_MODE` unset or `mock`):
```json
{
  "authorizationUrl": "https://stub-oauth.learnfyra.local/auth/google?state=...&redirect_uri=...",
  "state": "a1b2c3d4-uuid-stub"
}
```

Error responses:

| Status | Error Code | Condition |
|---|---|---|
| 400 | AUTH_VALIDATION | Unsupported provider name |
| 503 | AUTH_UNAVAILABLE | Cognito env vars missing (`COGNITO_DOMAIN`, `COGNITO_APP_CLIENT_ID`, `OAUTH_CALLBACK_BASE_URL`) |

---

### 6.6 GET /api/auth/callback/google

Auth required: No

Query parameters:
- `code`: required — authorization code returned by Google/Cognito
- `state`: required — the signed state JWT from the initiation step

Example URL:
```
GET /api/auth/callback/google?code=4/0AX4XfWh...&state=eyJhbGciOiJIUzI1NiJ9...
```

Success response (200):
```json
{
  "userId": "cognito-sub-abc123",
  "email": "student@gmail.com",
  "role": "student",
  "displayName": "Alex Student",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Note: `role` is always `"student"` for OAuth sign-ins. Role upgrade is a separate operation.

Error responses:

| Status | Error Code | Condition |
|---|---|---|
| 400 | AUTH_VALIDATION | `code` parameter is missing |
| 400 | AUTH_VALIDATION | `state` parameter is missing |
| 400 | AUTH_INVALID_STATE | State JWT is invalid or expired (possible CSRF attempt or stale link) |
| 400 | AUTH_UNVERIFIED_EMAIL | Google account email is not verified |
| 400 | AUTH_VALIDATION | Google account has no email address |
| 401 | AUTH_UNAUTHORIZED | Cognito token exchange failed |
| 400 | AUTH_VALIDATION | Unsupported OAuth provider |
| 503 | AUTH_UNAVAILABLE | Cognito env vars missing |

---

### Lambda Authorizer Contract

Used by API Gateway — not called directly by clients.

Input event:
```json
{
  "authorizationToken": "Bearer eyJhbGciOiJIUzI1NiJ9...",
  "methodArn": "arn:aws:execute-api:us-east-1:123456789:abc123/prod/GET/api/generate"
}
```

Allow response (token valid):
```json
{
  "principalId": "a3b4c5d6-e7f8-4a1b-9c2d-3e4f5a6b7c8d",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [{ "Action": "execute-api:Invoke", "Effect": "Allow", "Resource": "arn:aws:execute-api:..." }]
  },
  "context": {
    "sub": "a3b4c5d6-e7f8-4a1b-9c2d-3e4f5a6b7c8d",
    "email": "teacher@school.edu",
    "role": "teacher"
  }
}
```

Deny response (token missing or invalid): throws `new Error('Unauthorized')` — API Gateway maps this to 401.

---

## 7. DynamoDB Data Model

### Overview

Two tables are owned by M01:

1. `learnfyra-{env}-users` — User identity and profile
2. `learnfyra-{env}-parent-links` — Parent-to-student relationship tracking

Table naming convention: lowercase, hyphens, includes environment. Example: `learnfyra-dev-users`.

---

### 7.1 Users Table

Table name: `learnfyra-{env}-users`

#### Primary Key

| Key | Attribute | Format |
|---|---|---|
| Partition Key (PK) | `PK` | `USER#{userId}` |
| Sort Key (SK) | `SK` | `PROFILE` |

Example: `PK = "USER#a3b4c5d6-e7f8-4a1b-9c2d-3e4f5a6b7c8d"`, `SK = "PROFILE"`

#### Full Attribute List

| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | String | Yes | `USER#{userId}` — partition key |
| `SK` | String | Yes | Always `PROFILE` — sort key |
| `userId` | String | Yes | UUID v4 (local) or Cognito sub (OAuth) |
| `email` | String | Yes | Normalized lowercase email |
| `displayName` | String | Yes | User's display name |
| `role` | String | Yes | `student` / `teacher` / `parent` / `admin` |
| `authType` | String | Yes | `local:email` / `oauth:google` / `oauth:github` |
| `passwordHash` | String | Conditional | bcrypt hash — present only when `authType = local:email`. Never returned to clients. |
| `providers` | List | No | List of linked OAuth providers e.g. `["google"]`. Supports future multi-provider linking. |
| `createdAt` | String | Yes | ISO-8601 timestamp |
| `lastActiveAt` | String | Yes | ISO-8601 timestamp — updated on each login |
| `status` | String | No | `active` (default) / `suspended`. Suspended users are rejected by the auth layer. |
| `GSI1PK` | String | Yes | `EMAIL#{email}` — supports lookup by email |

#### Global Secondary Indexes

**GSI1: EmailIndex**

| | Attribute | Purpose |
|---|---|---|
| Partition Key | `GSI1PK` | `EMAIL#{email}` |
| Sort Key | `SK` | `PROFILE` |
| Projection | ALL | |

Access pattern served: Look up a user by email address. Used during login, OAuth first-sign-in upsert, and duplicate email check on registration.

Example query:
```
GSI1PK = "EMAIL#teacher@school.edu"
```

#### Local Dev vs DynamoDB

In local development (`DB_ADAPTER` unset), users are stored in `data-local/users.json` as a flat array. The `localDbAdapter` implements `queryByField('users', 'email', value)` which scans the array — functionally equivalent to GSI1 queries at small scale.

When `DB_ADAPTER=dynamodb`, all reads and writes go to the DynamoDB table using the key structure above.

---

### 7.2 ParentLinks Table

Table name: `learnfyra-{env}-parent-links`

This table records active and pending parent-to-child relationships. It is queried by `assertParentLink` in `authMiddleware.js` whenever a parent requests student-scoped data.

#### Primary Key

| Key | Attribute | Format |
|---|---|---|
| Partition Key (PK) | `PK` | `LINK#{linkId}` |
| Sort Key (SK) | `SK` | `METADATA` |

#### Full Attribute List

| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | String | Yes | `LINK#{linkId}` — partition key |
| `SK` | String | Yes | Always `METADATA` |
| `linkId` | String | Yes | UUID v4 |
| `parentId` | String | Yes | `userId` of the parent |
| `childId` | String | Yes | `userId` of the linked student |
| `status` | String | Yes | `active` / `pending` / `revoked` |
| `createdAt` | String | Yes | ISO-8601 |
| `updatedAt` | String | Yes | ISO-8601 |
| `GSI1PK` | String | Yes | `PARENT#{parentId}` — supports "all links for this parent" |
| `GSI2PK` | String | Yes | `CHILD#{childId}` — supports "all parents linked to this child" |

#### Global Secondary Indexes

**GSI1: ParentLinksIndex**

| | Attribute | Purpose |
|---|---|---|
| Partition Key | `GSI1PK` | `PARENT#{parentId}` |
| Sort Key | `SK` | `METADATA` |
| Projection | ALL | |

Access pattern served: "Fetch all links for a given parent." Used by `assertParentLink` to find whether parentId has an active link for the target childId.

Example query:
```
GSI1PK = "PARENT#parent-user-uuid"
```

Then filter in application code: `link.childId === targetChildId && link.status === 'active'`.

**GSI2: ChildLinksIndex**

| | Attribute | Purpose |
|---|---|---|
| Partition Key | `GSI2PK` | `CHILD#{childId}` |
| Sort Key | `SK` | `METADATA` |
| Projection | ALL | |

Access pattern served: "Fetch all parents linked to a given student." Used in parent management UI and admin operations.

#### Local Dev

In local development, parent links are stored in `data-local/parentLinks.json`. The `localDbAdapter.queryByField('parentLinks', 'parentId', id)` implementation scans the array — equivalent to GSI1 at local scale.

---

## 8. Frontend Specification (Angular 17+)

### 8.1 Routes

All auth routes live in the `features/auth` lazy-loaded module.

| Route Path | Component | Guard | Purpose |
|---|---|---|---|
| `/login` | `LoginComponent` | `PublicOnlyGuard` (redirect to `/dashboard` if already authenticated) | Login with email/password or Google OAuth |
| `/register` | `RegisterComponent` | `PublicOnlyGuard` | New account creation (local dev or teacher/parent self-register) |
| `/auth/callback` | `OAuthCallbackComponent` | None | Handles OAuth redirect; processes code + state params |
| `/auth/loading` | Inline redirect logic within `OAuthCallbackComponent` | None | Intermediate state shown while token exchange completes |
| `/logout` | No component — handled by `AuthService.logout()` + router redirect | `AuthGuard` | Clears tokens and redirects to `/login` |

Route configuration notes:
- `/login` and `/register` are in the `features/public` lazy module. They are not behind `AuthGuard`.
- `/auth/callback` is not behind `AuthGuard` — it is the landing point from the OAuth provider and has no token yet.
- `PublicOnlyGuard`: if a valid access token exists in memory, redirect to `/dashboard` to prevent logged-in users from seeing the login form.
- After successful login or OAuth callback, `AuthService` stores the token then navigates to the role-appropriate dashboard: `/student/dashboard` for students, `/teacher/dashboard` for teachers, `/parent/dashboard` for parents.

### 8.2 Screen Inventory

#### Login Screen (`/login`)

Purpose: Primary entry point for all returning users.

Key UI elements:
- Learnfyra logo and product name
- "Sign in with Google" button (primary CTA — uses Google brand guidelines, has text label for screen readers)
- Divider ("or")
- Email input field
- Password input field with show/hide toggle
- "Sign in" submit button
- "Don't have an account? Register" link
- Loading spinner overlay during API call

Form fields and validation:

| Field | Type | Validation | Error Message |
|---|---|---|---|
| Email | `email` input | Required, valid email format | "Please enter a valid email address." |
| Password | `password` input | Required, minimum 1 character (server validates length) | "Password is required." |

UX notes:
- Google OAuth button initiates POST /api/auth/oauth/google, then redirects browser to `authorizationUrl`.
- On failed login, display error inline below the form (not via alert or modal). Focus returns to the email field.
- While API call is in progress, disable the submit button and show spinner to prevent double submit.
- Form must not auto-complete passwords from a browser keychain in classroom/shared-computer scenarios — add `autocomplete="off"` as a hint (note: browsers may override this; it is advisory only).

#### Register Screen (`/register`)

Purpose: New account creation. Available in local dev and for teacher/parent self-registration.

Key UI elements:
- Display name input
- Email input
- Password input with show/hide toggle
- Password confirmation input
- Role selector (radio group or segmented control): Student / Teacher / Parent
- "Create account" submit button
- "Already have an account? Sign in" link
- Loading spinner overlay during API call

Form fields and validation:

| Field | Type | Validation | Error Message |
|---|---|---|---|
| Display name | text | Required, 2–60 characters | "Display name must be 2 to 60 characters." |
| Email | email | Required, valid email format | "Please enter a valid email address." |
| Password | password | Required, minimum 8 characters | "Password must be at least 8 characters." |
| Confirm password | password | Must match password field | "Passwords do not match." |
| Role | radio | Required, one of Student/Teacher/Parent | "Please select a role." |

UX notes:
- Role selector defaults to "Student" for OAuth users (role selection is not shown in the OAuth callback flow — role is set server-side to student automatically).
- On 409 response, display "An account with that email already exists. Sign in instead?" with a link to `/login`.

#### OAuth Callback Screen (`/auth/callback`)

Purpose: Landing page from the OAuth provider redirect. Processes `code` and `state` query parameters, calls the backend, stores the token, then redirects.

Key UI elements:
- Full-screen loading state with Learnfyra logo and "Signing you in..." message
- Error state if callback fails: "Sign-in failed. [error detail]. Try again." with a button linking to `/login`

Flow:
1. Component reads `code` and `state` from `ActivatedRoute.queryParams`.
2. Component calls `AuthService.handleOAuthCallback(code, state)`.
3. `AuthService` calls GET `/api/auth/callback/google?code=...&state=...`.
4. On success: stores token, sets auth signal state, navigates to role dashboard.
5. On failure: displays error message with retry link.

UX notes:
- This screen must handle the case where a user navigates directly to `/auth/callback` without query params (show "Invalid callback URL" error and redirect to `/login` after 3 seconds).
- Do not show raw error messages from the backend. Map known error codes to friendly messages:
  - `AUTH_INVALID_STATE`: "Your sign-in session expired. Please try signing in again."
  - `AUTH_UNVERIFIED_EMAIL`: "Your Google account does not have a verified email address."
  - Default: "Sign-in failed. Please try again."

#### Session Expired State

Purpose: When the access token expires and silent refresh fails, the user must be informed and redirected to `/login`.

Handled by: `AuthInterceptor` — on 401 response, attempts token refresh once, then redirects to `/login` with query param `?reason=session_expired`.

Login screen reads the `reason` parameter and shows a non-blocking informational banner: "Your session has expired. Please sign in again."

### 8.3 Angular Component Breakdown

#### AuthService (`core/services/auth.service.ts`)

Responsibilities:
- Store access token and user profile in Angular Signals (`authToken$`, `currentUser$`, `isAuthenticated$`)
- Expose `login(email, password): Observable<AuthResponse>`
- Expose `register(payload): Observable<AuthResponse>`
- Expose `initiateGoogleOAuth(): Observable<OAuthInitResponse>` — calls POST /api/auth/oauth/google, then redirects browser
- Expose `handleOAuthCallback(code, state): Observable<AuthResponse>` — calls GET /api/auth/callback/google
- Expose `refreshToken(): Observable<{ token: string }>` — calls POST /api/auth/refresh
- Expose `logout(): void` — clears tokens, resets signal state, navigates to /login
- Expose `getUserRole(): string | null` — reads from signal state
- Expose `hasRole(role: string): boolean`

#### AuthInterceptor (`core/interceptors/auth.interceptor.ts`)

Responsibilities:
- Attach `Authorization: Bearer {token}` header to all outgoing HTTP requests where a token is in memory
- On 401 response: attempt one silent token refresh via `AuthService.refreshToken()`
- If refresh succeeds: retry the original request once with the new token
- If refresh fails: call `AuthService.logout()` to redirect to `/login`
- Do not attach auth header to requests to `/api/auth/*` (login, register, OAuth, refresh)

#### AuthGuard (`core/guards/auth.guard.ts`)

Type: Functional guard (`CanActivateFn`)

Behavior:
- If `AuthService.isAuthenticated$()` is true: allow navigation
- If false: redirect to `/login` with `returnUrl` query parameter so the user is sent back after login

#### RoleGuard (`core/guards/role.guard.ts`)

Type: Functional guard (`CanActivateFn`)

Behavior:
- Checks `AuthService.getUserRole()` against the route's `data.requiredRoles` array
- If role is allowed: permit navigation
- If not allowed: redirect to the user's own dashboard (not to login) with a snackbar notification "You do not have access to that page."

#### PublicOnlyGuard (`core/guards/public-only.guard.ts`)

Type: Functional guard (`CanActivateFn`)

Behavior:
- If user is authenticated, redirect to the role-appropriate dashboard
- If not authenticated, allow the route to render

#### LoginComponent (`features/auth/login/login.component.ts`)

Type: Smart component (directly uses AuthService)

Responsibilities:
- Reactive form with email and password controls
- Calls `AuthService.login()` on submit
- Handles success (navigate to dashboard) and error (display inline error message)
- "Sign in with Google" button triggers `AuthService.initiateGoogleOAuth()`

#### RegisterComponent (`features/auth/register/register.component.ts`)

Type: Smart component

Responsibilities:
- Reactive form with displayName, email, password, confirmPassword, role
- Custom validator for password confirmation match
- Calls `AuthService.register()` on submit
- Handles 409 with inline message and link to login

#### OAuthCallbackComponent (`features/auth/callback/oauth-callback.component.ts`)

Type: Smart component

Responsibilities:
- On init: read `code` and `state` from query params
- Call `AuthService.handleOAuthCallback(code, state)`
- Show loading state during call
- Navigate on success, show mapped error on failure

### 8.4 State Management

#### Global Signals (in AuthService)

| Signal | Type | Description |
|---|---|---|
| `authToken` | `Signal<string \| null>` | The current access token. Set after login/register/OAuth. Cleared on logout. |
| `currentUser` | `Signal<UserProfile \| null>` | Decoded public user: `{ userId, email, role, displayName }`. |
| `isAuthenticated` | `computed Signal<boolean>` | Derived from `authToken !== null`. |

#### What Stays Local

- Form state in login/register components: local `FormGroup`
- Loading state during API calls: local boolean in each component
- OAuth callback intermediate state: local to `OAuthCallbackComponent`
- Error messages: local to each form component — not stored globally

### 8.5 Token Storage Strategy

#### Decision: localStorage for access token, memory for sensitive operations

| Token | Storage | Rationale |
|---|---|---|
| Access token (1h) | `localStorage` | Survives page refresh, required for Angular SPA. Acceptable risk given 1h expiry. |
| Refresh token (30d) | `localStorage` | Required for silent refresh across browser sessions. |

Trade-off note: httpOnly cookies are the more secure option but require same-origin or careful CORS cookie configuration with API Gateway, which adds complexity for the current CloudFront + API Gateway architecture. The 1h access token expiry and rate limiting on auth endpoints mitigate the XSS risk sufficiently for the current threat model. This decision must be revisited before Learnfyra stores any PII beyond email, role, and display name.

#### Refresh Token Rotation

In the current implementation, refresh tokens are not rotated on use. A single refresh token remains valid for 30 days from issuance. Token rotation (issue new refresh token on each use + invalidate old one) is a Phase 2 security hardening item and requires a token blocklist in DynamoDB.

#### Storage Keys

```
localStorage key: learnfyra_access_token
localStorage key: learnfyra_refresh_token
```

Keys are prefixed to avoid collisions with other libraries or apps sharing the same origin.

---

## 9. Security Requirements

### 9.1 PKCE Requirements

- All Google OAuth flows must use PKCE with `code_challenge_method=S256`.
- `code_verifier`: 32 cryptographically random bytes, base64url encoded (43 characters).
- `code_challenge`: `BASE64URL(SHA256(code_verifier))`.
- The `code_verifier` must be embedded in the signed `state` JWT and verified at callback. It must never be stored in `localStorage` or passed via URL.

### 9.2 JWT Claims

Every access token issued by Learnfyra must contain these claims:

| Claim | Type | Description |
|---|---|---|
| `sub` | string | The user's stable identifier (userId or Cognito sub) |
| `email` | string | The user's email address (normalized lowercase) |
| `role` | string | One of: `student`, `teacher`, `parent`, `admin` |
| `iat` | number | Issued-at timestamp (added automatically by jsonwebtoken) |
| `exp` | number | Expiry timestamp (1h from `iat` in prod; 7d in local dev mock) |

Refresh tokens additionally contain:

| Claim | Type | Description |
|---|---|---|
| `type` | string | Always `refresh` — used to prevent access tokens from being used as refresh tokens |

### 9.3 CORS Policy

| Environment | `ALLOWED_ORIGIN` value | Wildcard `*` allowed? |
|---|---|---|
| Local dev | `http://localhost:4200` (Angular dev server) or `*` | Yes — local dev only |
| Dev (AWS) | `https://dev.learnfyra.com` | No |
| Staging (AWS) | `https://qa.learnfyra.com` | No |
| Prod (AWS) | `https://www.learnfyra.com` | No |

CDK injects `ALLOWED_ORIGIN` into all Lambda functions at deploy time via the `ALLOWED_ORIGIN` environment variable. The CDK stack must fail synth if `ALLOWED_ORIGIN` is `*` and `appEnv` is `staging` or `prod`.

### 9.4 Rate Limiting

Enforced at API Gateway stage level via Usage Plans:

| Endpoint | Limit | Burst |
|---|---|---|
| POST /api/auth/register | 5 requests/minute/IP | 5 |
| POST /api/auth/login | 10 requests/minute/IP | 10 |
| POST /api/auth/oauth/google | 10 requests/minute/IP | 10 |
| GET /api/auth/callback/google | 20 requests/minute/IP | 20 |

Rate-limited requests receive 429 Too Many Requests from API Gateway without invoking the Lambda function.

### 9.5 Secrets Management

| Secret | Storage | Access |
|---|---|---|
| `JWT_SECRET` | AWS Secrets Manager: `learnfyra/{env}/jwt-secret` | Lambda IAM role `secretsmanager:GetSecretValue` |
| `ANTHROPIC_API_KEY` | AWS SSM Parameter Store (SecureString) | Lambda IAM role `ssm:GetParameter` |
| Google OAuth Client Secret | Cognito User Pool configuration (managed by CDK) | Not directly accessible to Lambda |

`JWT_SECRET` minimum length: 32 bytes of cryptographically random data. Generate with:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `tokenUtils.js` file enforces this contract: if `JWT_SECRET` is absent at runtime in any environment with `APP_RUNTIME=aws` or `NODE_ENV=production|staging`, it throws immediately rather than falling back to the development constant.

### 9.6 Input Security

- Email field: server normalizes (lowercase, trim). No injection risk — stored as a plain string, never executed.
- OAuth provider name: stripped to `[a-zA-Z0-9_-]` before use in URL construction or logging.
- Display name: stored as-is. Must be HTML-escaped when rendered in the Angular template (Angular's default binding `{{ }}` provides this — do not use `[innerHTML]` for display names).
- Password: never logged. The `passwordHash` field is stripped via object destructuring before any response or log output.

---

## 10. Integration Map

### Which Endpoints Use the Lambda Authorizer vs Handler-Level Middleware

| Route | Lambda Authorizer | Handler-Level validateToken | Notes |
|---|---|---|---|
| POST /api/auth/register | No | No | Public endpoint |
| POST /api/auth/login | No | No | Public endpoint |
| POST /api/auth/logout | No | No | Public endpoint |
| POST /api/auth/refresh | No | No | Credential is the refresh token itself |
| POST /api/auth/oauth/google | No | No | Public endpoint |
| GET /api/auth/callback/google | No | No | Public endpoint — no token at entry |
| POST /api/generate | Yes (API GW) | Yes (handler) | Double enforcement — Lambda Authorizer blocks at edge; handler also calls validateToken and assertRole |
| GET /api/solve/:id | No | No | Public endpoint — anyone with the worksheet ID can view |
| POST /api/submit | Yes (API GW) | Yes (handler) | Tracked submissions require authentication |
| GET /api/progress/history | Yes (API GW) | Yes (handler) | Student-scoped data |
| POST /api/class/create | Yes (API GW) | Yes (handler) | Teacher-only |
| GET /api/analytics/class/:classId | Yes (API GW) | Yes (handler) | Teacher-only, ownership check |
| GET /api/rewards/student/:studentId | Yes (API GW) | Yes (handler) | Student-scoped |
| GET /api/student/profile | Yes (API GW) | Yes (handler) | Student-scoped |
| POST /api/student/join-class | Yes (API GW) | Yes (handler) | Student-only |
| GET /api/qb/questions | Yes (API GW) | Yes (handler) | Teacher/admin-only |
| /api/admin/* | Yes (API GW) | Yes (handler) | Admin-only, double enforcement |

### Module Integration Points

| Module | Auth Dependency | How Auth Is Used |
|---|---|---|
| M03 Worksheet Generator | Required — teacher or admin role | `validateToken` + `assertRole(['teacher','admin'])` in generateHandler. `decoded.sub` stored as `teacherId` in metadata. |
| M04 Online Solve & Submit | Required for tracked submissions | `validateToken` in submitHandler. `decoded.sub` stored as `studentId` in attempt record. |
| M05 Progress Reporting | Required — student/teacher/parent scoped | `validateToken` + role-specific ownership check. Parent routes additionally call `assertParentLink`. |
| M06 Class Relationships | Required — teacher role for creation | `validateToken` + `assertRole(['teacher'])` in classHandler. |
| M07 Admin Control Plane | Required — admin role | `validateToken` + `assertRole(['admin'])` in adminHandler. |
| M08 Teacher/Parent Dashboard | Required | Role-based routing in both backend and Angular. |
| Rewards / Gamification | Required — student scope | `validateToken`, student-own-data enforcement. |

---

## 11. QA Hooks

Minimum 15 test cases in Given/When/Then format. These translate directly into Jest test files in `tests/unit/authHandler.test.js` and `tests/integration/auth.test.js`.

**TC-AUTH-001: Happy path — local registration**
Given a POST /api/auth/register with valid `{ email, password, role: 'teacher', displayName }`
When the handler runs
Then the response is 200 with `{ userId, email, role: 'teacher', displayName, token }`
And the token decodes to `{ sub, email, role: 'teacher' }`
And `passwordHash` is not present in the response body

**TC-AUTH-002: Duplicate email — conflict**
Given a POST /api/auth/register with an email already in the local DB
When the handler runs
Then the response is 409
And the body is `{ "error": "An account with that email already exists." }`

**TC-AUTH-003: Invalid role on registration**
Given a POST /api/auth/register with `role: 'admin'`
When the handler runs
Then the response is 400
And the body contains an error about valid roles

**TC-AUTH-004: Missing field on registration**
Given a POST /api/auth/register with email and password but no `displayName`
When the handler runs
Then the response is 400
And the body references the missing field

**TC-AUTH-005: Happy path — local login**
Given a registered user with known credentials
When POST /api/auth/login is called with correct email and password
Then the response is 200 with `{ userId, email, role, displayName, token }`

**TC-AUTH-006: Wrong password — no email enumeration**
Given a registered email
When POST /api/auth/login is called with the wrong password
Then the response is 401
And the error message is exactly "Invalid email or password."
And the message does not indicate which field is wrong

**TC-AUTH-007: Non-existent email — no email enumeration**
Given an email that does not exist in the DB
When POST /api/auth/login is called
Then the response is 401
And the error message is exactly "Invalid email or password."

**TC-AUTH-008: Logout — always succeeds**
Given any request to POST /api/auth/logout, with or without a token
When the handler runs
Then the response is 200 with `{ "message": "Logged out." }`

**TC-AUTH-009: Token refresh — valid refresh token**
Given a valid refresh token issued by the mock adapter
When POST /api/auth/refresh is called with that token
Then the response is 200 with a new access token
And the new access token decodes to the same `{ sub, email, role }` as the original

**TC-AUTH-010: Token refresh — expired refresh token**
Given a refresh token that has expired
When POST /api/auth/refresh is called
Then the response is 401
And the body is `{ "error": "Invalid or expired refresh token." }`

**TC-AUTH-011: Token refresh — access token submitted as refresh token**
Given a standard access token (which has `type` claim absent or `type != 'refresh'`)
When POST /api/auth/refresh is called with that token as the `refreshToken` body
Then the response is 401
And the error indicates the token is not a refresh token

**TC-AUTH-012: Lambda Authorizer — valid token allows request**
Given a valid HS256 JWT with `{ sub, email, role }`
When the Lambda Authorizer handler receives an event with `authorizationToken: 'Bearer {token}'`
Then the handler returns an IAM policy with `Effect: 'Allow'`
And the `context` object contains `{ sub, email, role }`

**TC-AUTH-013: Lambda Authorizer — invalid token denies request**
Given a tampered or malformed Bearer token
When the Lambda Authorizer handler processes the event
Then the handler throws `new Error('Unauthorized')`

**TC-AUTH-014: Lambda Authorizer — expired token denies request**
Given a valid JWT that has passed its `exp` timestamp
When the Lambda Authorizer handler processes the event
Then the handler throws `new Error('Unauthorized')`

**TC-AUTH-015: Role enforcement — student calling teacher route**
Given a valid JWT with `role: 'student'`
When `assertRole(decoded, ['teacher', 'admin'])` is called in the handler
Then an error is thrown with `.statusCode = 403`

**TC-AUTH-016: OAuth callback — invalid state parameter**
Given a GET /api/auth/callback/google where the `state` JWT has been tampered with
When the handler processes the request
Then the response is 400
And the error indicates an invalid or expired OAuth state parameter

**TC-AUTH-017: OAuth callback — missing authorization code**
Given a GET /api/auth/callback/google with no `code` query parameter
When the handler processes the request
Then the response is 400
And the error references the missing authorization code

**TC-AUTH-018: OPTIONS preflight — all auth routes**
Given an OPTIONS request to any /api/auth/* route
When the handler processes the request
Then the response is 200 with an empty body
And CORS headers are present: `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`

**TC-AUTH-019: Parent-child link — no active link**
Given a decoded token with `role: 'parent'` and `sub: 'parent-uuid'`
And a DB with no active link between `parent-uuid` and the target `childId`
When `assertParentLink(decoded, childId)` is called
Then an error is thrown with `.statusCode = 403`
And the message references "no active parent-child link"

**TC-AUTH-020: CORS — error responses include CORS headers**
Given a POST /api/auth/login with missing credentials (will return 400)
When the handler processes the request
Then the 400 response includes `Access-Control-Allow-Origin` header
And the header value matches the `ALLOWED_ORIGIN` environment variable

---

## 12. Open Decisions

### OD-001: Admin User Provisioning

How is the first admin user created? Options:

A. DevOps seeding script: a one-off script inserts a user record with `role: admin` directly into DynamoDB (bypassing registration) and sets a secure password.
B. Bootstrap endpoint: a one-time POST /api/admin/bootstrap that creates the first admin if no admin exists. Disabled after first use.
C. Cognito Group assignment: in `AUTH_MODE=cognito`, a Cognito User Pool group named `Admins` is created, and the Lambda Authorizer checks group membership to set `role: admin`.

Decision needed before: M07 Admin Control Plane implementation.
Current state: `admin` role is defined in VALID_ROLES in authHandler.js but admin users cannot be created through any current endpoint. Recommend Option A for simplicity.

### OD-002: Second OAuth Provider

The existing `oauthStubAdapter` lists `['google', 'github']` as supported providers in local dev. The `cognitoAdapter` (prod) currently supports only `['google']`. GitHub is stubbed locally but not wired to a real Cognito federated identity provider.

Decision needed: GitHub or Microsoft?

Implications:
- GitHub: better fit for teacher/developer users; requires GitHub OAuth App setup
- Microsoft: better for school districts using Microsoft 365; requires Azure AD App Registration
- This is deferred to Phase 2. The second provider is FR-AUTH-011 (P1 — MISSING per requirements tracker)

### OD-003: Anonymous Student Sessions for Online Solve

Current policy (`api-security-auth-model.md`): online tracked solve submissions require authentication (POST /api/submit is a protected route). However, the security spec notes that anonymous solve may exist as an "ephemeral experience" without persistent records.

Decision needed:
- Do students need a Learnfyra account to solve a worksheet online?
- If anonymous solve is allowed: what is returned — a local result that disappears, or a result stored under a guest session key?
- This affects the Angular routing for the solve flow and whether `AuthGuard` is applied to `/solve/:id`.

Current implementation: GET /api/solve/:id is public (no auth required). POST /api/submit is protected. This creates a gap: a student without an account can open the solve page but cannot submit for scoring.

Recommend: decide whether to allow anonymous submit with ephemeral results, or require sign-in before accessing the solve page. This decision gates M04 frontend routing.

### OD-004: Refresh Token Rotation

Current implementation: refresh tokens are not rotated on use. A 30-day refresh token, once issued, remains valid until it expires. There is no token blocklist.

This is a known security gap — a leaked refresh token provides 30 days of access. Rotation + blocklist is Phase 2 security hardening. The decision required now is whether to accept this for the initial production launch or implement basic rotation before first prod deploy.

### OD-005: Token Storage — localStorage vs httpOnly Cookie

Documented in section 8.5. The decision to use `localStorage` is documented but the trade-off is explicit. This should be formally reviewed by the security team before the platform handles any financial transactions or sensitive student PII beyond current scope.
