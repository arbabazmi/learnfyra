# M01 Auth Requirements

## Requirement Summary

Full auth spec for M01. Canonical source for all auth acceptance criteria.

**Version 2.0 — COPPA-Compliant Authentication Architecture (April 2026)**

This version introduces COPPA (Children's Online Privacy Protection Act) compliance for Learnfyra. Since the platform serves Grades 1-10 (ages 6-16), children under 13 require verifiable parental consent before any personal data is collected.

---

## Functional Requirements

### Existing Requirements (unchanged)

### REQ-AUTH-001: Google OAuth Sign-In
**Priority:** P0
The system SHALL support Google OAuth via Cognito Hosted UI using PKCE flow. The browser must never hold a client secret. **COPPA update:** Google OAuth is available ONLY for users who pass the age gate as 13+.

### REQ-AUTH-002: Email/Password Sign-In
**Priority:** P0
The system SHALL support email/password authentication via Cognito User Pool AdminInitiateAuth. **COPPA update:** Email/password registration is available ONLY for users who pass the age gate as 13+.

### REQ-AUTH-003: Role Assignment
**Priority:** P0
Every registered user SHALL have exactly one role: student, teacher, parent, or admin. Role is assigned at registration and stored in the JWT `role` claim. **COPPA update:** Student accounts additionally carry an `ageGroup` claim (under13 / 13plus).

### REQ-AUTH-004: JWT Access Tokens
**Priority:** P0
Access tokens SHALL be HS256-signed JWTs with 1-hour expiry. Payload must include: sub (userId), role, email, ageGroup, parentId, iat, exp.

### REQ-AUTH-005: Refresh Tokens
**Priority:** P0
Refresh tokens SHALL be opaque, stored in Cognito, and have 30-day expiry. POST /api/auth/refresh returns a new access token.

### REQ-AUTH-006: Lambda Authorizer
**Priority:** P0
All protected API Gateway routes SHALL be gated by a Lambda Authorizer that validates JWT signature and expiry, and returns an IAM Allow/Deny policy.

### REQ-AUTH-007: Guest Mode
**Priority:** P1
POST /api/generate and GET /api/solve/:id SHALL be accessible without authentication. Guest submissions are scored but not persisted. **COPPA update:** Guest mode SHALL NOT collect any personal data, cookies, device fingerprints, or behavioral tracking data.

### REQ-AUTH-008: Role-Based Route Protection
**Priority:** P0
The Lambda Authorizer SHALL enforce role-based access. Teacher-only routes return 403 for students. Admin-only routes return 403 for all non-admin roles. Parent-only routes return 403 for non-parent roles.

### REQ-AUTH-009: Token Revocation on Logout
**Priority:** P1
POST /api/auth/logout SHALL revoke the refresh token in Cognito. Subsequent calls to /api/auth/refresh with that token SHALL return 401.

### REQ-AUTH-010: Local Mode Compatibility
**Priority:** P0
When APP_RUNTIME=local, the auth handler SHALL use LOCAL_JWT_SECRET for JWT signing and verification, without calling Cognito APIs. COPPA consent flows SHALL also work in local mode using the PendingConsent and ConsentLog local adapters.

### REQ-AUTH-011: Rate Limiting on Auth Endpoint
**Priority:** P1
POST /api/auth/token SHALL be rate-limited to 10 requests per minute per IP at the API Gateway level.

### REQ-AUTH-012: Password Requirements
**Priority:** P1
Passwords SHALL meet minimum security requirements enforced by Cognito: 8+ characters, uppercase, lowercase, number, special character.

### REQ-AUTH-013: PII Data Minimization
**Priority:** P0
The DynamoDB Users table SHALL store only email, name, role, and OAuth subject ID. No address, phone, or sensitive PII. **COPPA update:** For children under 13, email SHALL NOT be stored — only a nickname (optional) and parentId.

### REQ-AUTH-014: Multi-Environment Cognito Isolation
**Priority:** P0
Each environment (dev/staging/prod) SHALL have a separate Cognito User Pool and Google OAuth client ID.

### REQ-AUTH-015: No Admin Self-Registration
**Priority:** P0
The admin role SHALL NOT be self-assignable. Admin accounts are provisioned out-of-band by Super Admin only.

---

### COPPA Requirements (new)

### REQ-AUTH-016: Age Gate
**Priority:** P0
The registration page SHALL display an age gate ("Are you under 13?") as the FIRST interaction, BEFORE any form fields for personal data are rendered. The age gate CANNOT be bypassed. The response determines which registration flow is shown.

### REQ-AUTH-017: No Direct Signup for Children Under 13
**Priority:** P0 (COPPA MANDATORY)
Children under 13 SHALL NOT be able to:
- Sign up via Google OAuth directly
- Create an email/password account directly
- Receive a Cognito token immediately
The ONLY path to a child account is through the parent-gated consent flow (REQ-AUTH-018 through REQ-AUTH-022).

### REQ-AUTH-018: Child Consent Request
**Priority:** P0 (COPPA MANDATORY)
When a child under 13 selects "Yes" on the age gate, the system SHALL:
1. Display a minimal form accepting ONLY: parent email (required) and child nickname (optional)
2. NOT create any user account or Cognito identity
3. Store the request in the PendingConsent table (NOT the Users table)
4. Send a consent email to the parent email address
5. Show the child a message: "Ask your parent to check their email"

### REQ-AUTH-019: Consent Email
**Priority:** P0 (COPPA MANDATORY)
The consent email SHALL:
1. Clearly identify Learnfyra and explain that a child has requested an account
2. Include the child's nickname (if provided)
3. Include a unique, single-use consent link that expires in 72 hours
4. Explain what data will be collected and how it will be used
5. Explain the parent's rights (review, delete, revoke consent)

### REQ-AUTH-020: Verifiable Parental Consent (VPC) — Email Plus Method
**Priority:** P0 (COPPA MANDATORY)
When a parent clicks the consent link, the system SHALL:
1. Display a consent page with:
   - Clear description of what data is collected from the child
   - How the data is used (worksheet generation and scoring only)
   - Parent's rights under COPPA (review, download, delete, revoke)
   - Link to the full Privacy Policy
   - An affirmative "I Consent" action button (NOT a pre-checked checkbox)
2. Require the parent to create an account (Google OAuth or email/password) if they don't have one
3. Record the consent in the ConsentLog table with: parentId, timestamp, IP address, policy version, consent method
4. Only AFTER consent is recorded: create the child account linked to the parent

### REQ-AUTH-021: PendingConsent Expiry
**Priority:** P0 (COPPA MANDATORY)
PendingConsent records SHALL:
1. Expire automatically after 72 hours via DynamoDB TTL
2. On expiry, ALL data associated with the pending request (parent email, child nickname) SHALL be deleted
3. No notification is sent on expiry — the data simply disappears
4. The consent token becomes invalid after expiry

### REQ-AUTH-022: Child Account Creation (Post-Consent)
**Priority:** P0 (COPPA MANDATORY)
After verifiable parental consent is obtained, the system SHALL:
1. Create a child account in the Users table with:
   - Unique userId (UUID v4)
   - role: "student"
   - ageGroup: "under13"
   - parentId: the consenting parent's userId
   - name: child's nickname (or "Student" if none provided)
   - email: NULL (children under 13 do not have email stored)
   - consentId: reference to the ConsentLog entry
2. Add the childId to the parent's `linkedChildIds` list
3. Optionally create a Cognito identity for the child (Phase 2 — Phase 1 uses parent-managed sessions)

### REQ-AUTH-023: Parent Dashboard — Child Data Management
**Priority:** P0 (COPPA MANDATORY)
Authenticated parents SHALL be able to:
1. **View** a list of all linked child accounts
2. **Review** all data collected for each child (worksheets, scores, profile)
3. **Download** all child data as a JSON export
4. **Delete** a child account (triggers cascading deletion of all child data)
5. **Revoke consent** for a child (same effect as deletion, with ConsentLog updated)

### REQ-AUTH-024: Consent Revocation and Data Deletion
**Priority:** P0 (COPPA MANDATORY)
When a parent revokes consent or deletes a child account, the system SHALL:
1. Delete the child's record from the Users table
2. Delete all child-associated worksheet/solve data from S3
3. Delete the child's Cognito identity (if one exists)
4. Update the ConsentLog entry with `revokedAt` and `revokedReason` (ConsentLog itself is NEVER deleted — FTC audit requirement)
5. Remove the childId from the parent's `linkedChildIds`
6. Return confirmation to the parent

### REQ-AUTH-025: Child Session Management (Phase 1 — Parent-Managed)
**Priority:** P1
In Phase 1, children under 13 access the platform via parent-managed sessions:
1. Parent logs in to their own account
2. Parent selects "Start [Child Name]'s Session" from Parent Dashboard
3. System issues a scoped JWT with the child's userId, role=student, ageGroup=under13, parentId
4. The child session has restricted permissions (can solve worksheets and view own scores only)
5. Parent can end the child session at any time
6. Child sessions auto-expire after 4 hours (configurable per parent)

### REQ-AUTH-026: Consent Audit Trail
**Priority:** P0 (COPPA MANDATORY)
The ConsentLog table SHALL maintain an immutable audit trail containing:
- Who gave consent (parentId)
- When consent was given (ISO-8601 timestamp)
- How consent was given (email_plus method in Phase 1)
- IP address at time of consent
- Version of Privacy Policy accepted
- Whether consent was later revoked (revokedAt, revokedReason)
Records in ConsentLog SHALL NEVER be deleted, even after consent revocation.

### REQ-AUTH-027: Data Minimization for Children Under 13
**Priority:** P0 (COPPA MANDATORY)
For children under 13, the system SHALL NOT collect:
- Email address
- Phone number
- Precise geolocation
- Date of birth (beyond the age gate yes/no)
- Device fingerprint or hardware identifiers
- Behavioral tracking data (analytics, heatmaps, etc.)
- Photos or voice recordings
The ONLY data collected is: nickname (optional), worksheet answers, and scores.

### REQ-AUTH-028: Privacy Policy Requirements
**Priority:** P0 (COPPA MANDATORY)
The Privacy Policy SHALL clearly state:
1. What personal information is collected from children
2. How the information is used
3. The operator's disclosure practices
4. That a parent can review, have deleted, and refuse to permit further collection
5. Contact information for the operator
6. The effective date and version number of the policy
The policy must be linked from the consent page and accessible from all authenticated pages.

---

## Non-Negotiable Rules

1. Authentication is handled exclusively through Cognito User Pools + Hosted UI
2. No custom auth server — all token issuance goes through Cognito
3. All protected routes require a valid JWT in the Authorization header
4. The JWT `role` claim is the sole source of role truth — never the request body
5. Guest mode is for worksheet generation and solve only — no class/progress/admin routes
6. Parent-child links require student confirmation — parents cannot self-link without consent
7. Token blacklist (revoked tokens) uses DynamoDB TTL matching token expiry
8. **COPPA: No Cognito identity or user account is created for a child under 13 until verifiable parental consent is recorded**
9. **COPPA: The age gate is mandatory and must appear before ANY registration form fields**
10. **COPPA: PendingConsent data is auto-deleted after 72 hours if no consent is given**
11. **COPPA: Parents can review, download, and delete all child data at any time**
12. **COPPA: ConsentLog records are NEVER deleted (immutable audit trail)**
13. **COPPA: Google OAuth and email/password self-registration are blocked for children under 13**

---

## User Type Authentication Matrix

| User Type | Auth Method | Cognito Token | Age Gate Response | Account Creation |
|---|---|---|---|---|
| Student (<13) | Parent-mediated session | AFTER parental consent only | "Yes, under 13" | Backend-only, post-consent |
| Student (13+) | Google OAuth / Email-Password | Immediate on registration | "No, 13 or older" | Standard self-registration |
| Parent | Google OAuth / Email-Password | Immediate on registration | "No, 13 or older" + role "Parent" | Standard self-registration |
| Teacher | Google OAuth / Email-Password | Immediate on registration | "No, 13 or older" + role "Teacher" | Standard self-registration |
| Admin | Invited only | Immediate on invitation | N/A | Out-of-band provisioning |

---

## Acceptance Criteria (Given/When/Then)

### Existing Criteria (unchanged)

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

**AC-AUTH-010:**
Given a deployment to AWS,
When the CDK stack deploys,
Then the Cognito User Pool exists in the correct region, the Lambda Authorizer is attached to API Gateway, and the Google IdP is configured.

### COPPA Criteria (new)

**AC-AUTH-011:**
Given a new user visits the registration page,
When the page loads,
Then an age gate ("Are you under 13?") is displayed before any personal data input fields, and the age gate cannot be dismissed without answering.

**AC-AUTH-012:**
Given a child selects "Yes, I am under 13" on the age gate,
When the child-request form is shown,
Then ONLY two fields are available: parent email (required) and nickname (optional). No email, password, or Google OAuth options are visible.

**AC-AUTH-013:**
Given a child submits a consent request with a parent email,
When POST /api/auth/child-request is called,
Then a PendingConsent record is created (NOT a Users record), a consent email is sent to the parent, and the response tells the child to ask their parent to check email.

**AC-AUTH-014:**
Given a consent email was sent to a parent,
When the parent clicks the consent link within 72 hours,
Then they see a consent page explaining data practices, their COPPA rights, and an "I Consent" button.

**AC-AUTH-015:**
Given a parent clicks "I Consent" and creates/logs into their account,
When the consent is submitted,
Then a ConsentLog record is created (parentId, timestamp, IP, policy version), a child account is created linked to the parent, and the parent sees the child on their Parent Dashboard.

**AC-AUTH-016:**
Given a PendingConsent record exists,
When 72 hours pass without parent action,
Then the record is automatically deleted via DynamoDB TTL and no child data remains in any table.

**AC-AUTH-017:**
Given a parent is on the Parent Dashboard,
When they click "Delete Account" for a child,
Then all child data is deleted (Users record, S3 worksheet data, Cognito identity), the ConsentLog is updated with revokedAt, and the child can no longer access the platform.

**AC-AUTH-018:**
Given a parent is on the Parent Dashboard,
When they click "Download Data" for a child,
Then a JSON file is returned containing all data associated with the child (profile, worksheets, scores).

**AC-AUTH-019:**
Given a parent starts a child session from the Parent Dashboard,
When POST /api/auth/child-session is called,
Then a scoped JWT is issued with the child's userId, role=student, ageGroup=under13, and the child can solve worksheets and view scores.

**AC-AUTH-020:**
Given a child under 13 somehow navigates to the Google OAuth flow,
When the system processes the age gate state,
Then the OAuth redirect is blocked and the child is shown the parent-gated flow instead.

**AC-AUTH-021:**
Given the ConsentLog contains a record for a child,
When consent is revoked,
Then the record is updated with revokedAt and revokedReason fields but is NEVER deleted from the table.

---

## Open Questions

- Q: Should we support magic link (email) login in addition to password login? — Deferred to Phase 2
- Q: Should parent-child confirmation be email or in-app? — Decision: email for Phase 1 (simpler)
- Q: Max parent accounts per student? — Decision: 2 parents per student in Phase 1
- Q: Should child sessions have a configurable daily time limit? — **Decision: Yes, 4 hours default, parent-configurable (1-8 hours range). Session auto-expires when limit reached.**
- Q: Phase 2 child login: individual child login codes or parent-managed only? — **Decision: Decide later in Phase 2 based on Phase 1 usage patterns. Phase 1 is parent-managed sessions only.**
- Q: Should VPC be upgraded to credit card verification in Phase 2? — **Decision: Yes, add credit card verification ($0.50 charge) in Phase 2 for stronger FTC compliance.**
- Q: FERPA implications for teacher-managed student data? — Needs legal review before class management feature
