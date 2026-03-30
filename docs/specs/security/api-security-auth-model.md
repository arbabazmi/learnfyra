# API Security, Authentication, Authorization, and Guest Mode
# File: docs/specs/security/api-security-auth-model.md
# Version: 0.1
# Date: 2026-03-25
# Status: Consolidated technical source of truth

## Purpose
Provide one clear technical document for:
- how Learnfyra secures APIs
- how authentication works
- how authorization works
- how guest mode works
- which routes are public versus protected

This consolidates logic that was previously spread across product, UX, and QA docs.

## 1. Security Model Overview

Learnfyra uses a layered API security model:

1. Public routes are explicitly limited.
2. Protected routes require valid authentication.
3. Authorization is enforced server-side based on role and ownership.
4. Guest mode is allowed only for explicitly permitted workflows.
5. Client-side state never determines access; server-side token validation does.

## 2. Authentication Model

### Supported Authentication Methods
1. Google OAuth.
2. One additional public OAuth provider: GitHub or Microsoft.
3. Local email/password fallback.

### Session Model
1. Successful login issues a signed JWT.
2. JWT contains at minimum:
   - `sub` or `userId`
   - `role`
   - `email`
   - provider metadata when applicable
3. All protected backend routes validate JWT before business logic runs.
4. Invalid, missing, expired, or tampered tokens return `401` or `403` as appropriate.

### Planned AWS Production Auth Path
1. AWS Cognito user pool for OAuth + local auth.
2. Lambda authorizer or equivalent JWT validation on protected API routes.
3. OAuth secrets stored in managed secret/config systems, not hardcoded.

## 3. Authorization Model

Authorization is role-based and ownership-aware.

### Core Roles
1. Guest
2. Student
3. Teacher
4. Parent
5. Admin or super-admin where applicable

### Authorization Rules
1. Guests can access only explicitly public flows.
2. Students can access only their own solve history, profile, and linked classroom scope.
3. Teachers can access only their own classes, assigned students, and related analytics.
4. Parents can access only linked child data.
5. Admin-only routes require admin role validation on the server.

### Critical Rule
Role checks must always happen on the backend. UI visibility alone is never a security boundary.

## 4. Guest Mode Model

Guest mode is intentionally restricted.

### Guest Mode Allowed Actions
1. Browse and generate/download worksheets where product flow allows.
2. Offline practice using downloaded worksheets.
3. In some UX drafts, anonymous solve/result flow may exist as an ephemeral experience, but it must not create persistent student records unless explicitly linked after signup.

### Guest Mode Blocked Actions
1. Persistent online solve history.
2. Student dashboards and saved analytics.
3. Protected submission endpoints when policy is "online solve requires login".
4. Teacher, parent, or admin dashboards.

### Current Intended Policy
1. Online solve for tracked student workflows requires authentication.
2. Guest mode is offline-first and non-persistent.
3. If anonymous result viewing is allowed, data remains ephemeral and is not treated as authenticated student progress.

## 5. Public vs Protected Route Strategy

### Public or Semi-Public Routes
- `POST /api/generate` (if guest generation remains allowed)
- `GET /api/download`
- auth entry routes such as:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - OAuth initiation/callback routes

### Protected Routes
- `POST /api/submit` for tracked solve submissions
- student profile/history routes
- teacher analytics routes
- parent-linked child progress routes
- class management routes
- rewards and admin routes where persistence or cross-user access is involved

### Protection Mechanism
1. Validate JWT.
2. Resolve role from token or trusted auth provider context.
3. Re-check ownership or tenant/class relationship.
4. Reject unauthorized access with `403`.

## 6. API Security Controls

### Authentication Controls
1. JWT signature validation.
2. Expiration enforcement.
3. Reject token tampering and role escalation attempts.
4. Support fallback auth if one OAuth provider is unavailable.

### Authorization Controls
1. Role-based access control on every protected endpoint.
2. Object-level authorization for `studentId`, `classId`, `worksheetId`, and related resources.
3. Parent-child relationship enforcement.
4. Teacher-to-class membership enforcement.

### Input and Transport Controls
1. Validate request bodies and path parameters.
2. Keep CORS policy explicit.
3. Use HTTPS in deployed environments.
4. Do not trust client-sent role fields or user IDs without verification.

### Data Protection Controls
1. No guest PII persistence without explicit account creation/linking.
2. OAuth tokens and secrets stored securely.
3. Protected analytics results scoped to authorized viewers only.

## 7. Error Semantics

### `401 Unauthorized`
Use when:
1. No token is provided for a protected route.
2. Token is invalid or expired.

### `403 Forbidden`
Use when:
1. Token is valid but role is insufficient.
2. Token is valid but resource ownership check fails.

### Example Cases
1. Student changes `role=teacher` client-side -> `403`.
2. Parent requests non-linked child progress -> `403`.
3. Guest calls protected history endpoint -> `401` or auth-gated response.

## 8. Route Policy by User Type

### Guest
- allowed: auth entry, public generation/download, offline flows
- blocked: protected solve persistence, dashboards, analytics, class management

### Student
- allowed: own solve, own history, own dashboard, class-linked activities
- blocked: other students' data, teacher dashboards, admin routes

### Teacher
- allowed: class management, class analytics, assignment and score management for owned classes
- blocked: other teachers' classes, admin-only controls unless elevated role exists

### Parent
- allowed: linked child progress and permitted offline score actions
- blocked: non-linked child data, teacher class analytics, admin routes

## 9. Current Source Documents This Consolidates

Primary supporting docs:
1. `docs/specs/backend/auth-online-offline-reporting-spec.md`
2. `docs/design/platform/student-authentication-and-progress-tracking-spec.md`
3. `docs/design/frontend/auth-practice-reporting-ux-spec.md`
4. `docs/qa/backend/auth-mode-reporting-qa-spec.md`
5. `docs/specs/modules/M01-auth-identity-spec.md`

## 10. Recommended Next Step

After agreeing this document, the next technical follow-up should be:
1. exact protected/public endpoint matrix
2. JWT payload contract
3. auth middleware and Lambda authorizer behavior
4. guest-mode persistence policy finalization
