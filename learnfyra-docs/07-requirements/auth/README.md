# M01 Auth Requirements

## Requirement Summary

Full auth spec for M01. Canonical source for all auth acceptance criteria.

## Functional Requirements

### REQ-AUTH-001: Google OAuth Sign-In
**Priority:** P0
The system SHALL support Google OAuth via Cognito Hosted UI using PKCE flow. The browser must never hold a client secret.

### REQ-AUTH-002: Email/Password Sign-In
**Priority:** P0
The system SHALL support email/password authentication via Cognito User Pool AdminInitiateAuth.

### REQ-AUTH-003: Role Assignment
**Priority:** P0
Every registered user SHALL have exactly one role: student, teacher, parent, or admin. Role is assigned at registration and stored in the JWT `role` claim.

### REQ-AUTH-004: JWT Access Tokens
**Priority:** P0
Access tokens SHALL be HS256-signed JWTs with 1-hour expiry. Payload must include: sub (userId), role, email, iat, exp.

### REQ-AUTH-005: Refresh Tokens
**Priority:** P0
Refresh tokens SHALL be opaque, stored in Cognito, and have 30-day expiry. POST /api/auth/refresh returns a new access token.

### REQ-AUTH-006: Lambda Authorizer
**Priority:** P0
All protected API Gateway routes SHALL be gated by a Lambda Authorizer that validates JWT signature and expiry, and returns an IAM Allow/Deny policy.

### REQ-AUTH-007: Guest Mode
**Priority:** P1
POST /api/generate and GET /api/solve/:id SHALL be accessible without authentication. Guest submissions are scored but not persisted.

### REQ-AUTH-008: Role-Based Route Protection
**Priority:** P0
The Lambda Authorizer SHALL enforce role-based access. Teacher-only routes return 403 for students. Admin-only routes return 403 for all non-admin roles.

### REQ-AUTH-009: Token Revocation on Logout
**Priority:** P1
POST /api/auth/logout SHALL revoke the refresh token in Cognito. Subsequent calls to /api/auth/refresh with that token SHALL return 401.

### REQ-AUTH-010: Local Mode Compatibility
**Priority:** P0
When APP_RUNTIME=local, the auth handler SHALL use LOCAL_JWT_SECRET for JWT signing and verification, without calling Cognito APIs.

### REQ-AUTH-011: Rate Limiting on Auth Endpoint
**Priority:** P1
POST /api/auth/token SHALL be rate-limited to 10 requests per minute per IP at the API Gateway level.

### REQ-AUTH-012: Password Requirements
**Priority:** P1
Passwords SHALL meet minimum security requirements enforced by Cognito: 8+ characters, uppercase, lowercase, number, special character.

### REQ-AUTH-013: PII Data Minimization
**Priority:** P0
The DynamoDB Users table SHALL store only email, name, role, and OAuth subject ID. No address, phone, or sensitive PII.

### REQ-AUTH-014: Multi-Environment Cognito Isolation
**Priority:** P0
Each environment (dev/staging/prod) SHALL have a separate Cognito User Pool and Google OAuth client ID.

### REQ-AUTH-015: No Admin Self-Registration
**Priority:** P0
The admin role SHALL NOT be self-assignable. Admin accounts are provisioned out-of-band by Super Admin only.

## Non-Negotiable Rules (from auth-online-offline-reporting-spec)

1. Authentication is handled exclusively through Cognito User Pools + Hosted UI
2. No custom auth server — all token issuance goes through Cognito
3. All protected routes require a valid JWT in the Authorization header
4. The JWT `role` claim is the sole source of role truth — never the request body
5. Guest mode is for worksheet generation and solve only — no class/progress/admin routes
6. Parent-child links require student confirmation — parents cannot self-link without consent
7. Token blacklist (revoked tokens) uses DynamoDB TTL matching token expiry

## Acceptance Criteria (Given/When/Then)

**AC-AUTH-001:**
Given a user with a Google account,
When they complete the Cognito Hosted UI OAuth flow,
Then they receive an access token with the correct `role` claim and are redirected to their role-appropriate dashboard.

**AC-AUTH-002:**
Given a valid access token in the Authorization header,
When any protected API route is called,
Then the Lambda Authorizer returns an Allow IAM policy and the request proceeds.

**AC-AUTH-003:**
Given an expired access token,
When a protected route is called,
Then the Lambda Authorizer returns a Deny policy and API Gateway returns 401 with code TOKEN_EXPIRED.

**AC-AUTH-004:**
Given a student JWT,
When the student calls POST /api/classes (teacher-only route),
Then the response is 403 with code INSUFFICIENT_ROLE.

**AC-AUTH-005:**
Given an unauthenticated request,
When POST /api/generate is called,
Then the request succeeds (200) with a worksheetId and download links.

**AC-AUTH-006:**
Given a valid refresh token,
When POST /api/auth/refresh is called after the access token expires,
Then a new valid access token is returned without re-entering credentials.

**AC-AUTH-007:**
Given a user calls POST /api/auth/logout,
When a subsequent POST /api/auth/refresh is called with the same refresh token,
Then the response is 401 with code INVALID_REFRESH_TOKEN.

**AC-AUTH-008:**
Given APP_RUNTIME=local,
When the auth handler is invoked,
Then no Cognito API calls are made and JWT is signed/verified with LOCAL_JWT_SECRET.

**AC-AUTH-009:**
Given 11 POST /api/auth/token requests from the same IP within one minute,
When the 11th request is made,
Then API Gateway returns 429 with code RATE_LIMIT_EXCEEDED.

**AC-AUTH-010 (from auth spec AC-8 deployment criteria):**
Given a deployment to AWS,
When the CDK stack deploys,
Then the Cognito User Pool exists in the correct region, the Lambda Authorizer is attached to API Gateway, and the Google IdP is configured.

## Open Questions

- Q: Should we support magic link (email) login in addition to password login? — Deferred to Phase 2
- Q: Should parent-child confirmation be email or in-app? — Decision: email for Phase 1 (simpler)
- Q: Max parent accounts per student? — Decision: 2 parents per student in Phase 1
