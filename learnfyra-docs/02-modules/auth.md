# M01 — Auth & Identity

## Module Summary

M01 handles user authentication, authorization, and identity management across all roles (student, teacher, parent, admin). It integrates with AWS Cognito for Google OAuth and email/password accounts, and provides a Lambda Authorizer for protecting API Gateway routes.

**COPPA Compliance (v2.0):** Learnfyra serves students in Grades 1-10, which includes children under 13. All authentication flows MUST comply with the Children's Online Privacy Protection Act (COPPA). Students under 13 cannot create accounts directly — they require verifiable parental consent before any personal data is collected or any Cognito identity is issued.

## User Roles

| Role | Primary Actions | Can Self-Register | COPPA Restriction |
|---|---|---|---|
| student (13+) | solve worksheets, view own progress | yes | Standard registration |
| student (<13) | solve worksheets, view own progress | NO — parent-gated only | Requires verifiable parental consent |
| teacher | generate worksheets, manage classes, view class analytics | yes | None |
| parent | view child progress, manage child accounts, consent management | yes | Must consent before child account creation |
| admin | full platform management (M07) | no (invited only) | None |

## COPPA Compliance Overview

### Regulatory Requirements

COPPA (15 U.S.C. 6501-6506) applies when:
- The service is directed at children under 13, OR
- The operator has actual knowledge of collecting data from children under 13

Learnfyra serves Grades 1-10, which includes children ages 6-12. Therefore COPPA applies.

### COPPA Obligations

1. **No direct data collection from children under 13** without verifiable parental consent
2. **Age gate** required as the first interaction before any data collection
3. **Verifiable Parental Consent (VPC)** must be obtained before creating a child account
4. **Data minimization** — collect only what is strictly necessary for the service
5. **Parental access** — parents must be able to review, modify, and delete child data
6. **Parental revocation** — parents can revoke consent at any time, triggering data deletion

### VPC Methods (in order of implementation priority)

| Phase | Method | Description |
|---|---|---|
| Phase 1 (MVP) | Email Plus | Parent email verification + consent checkbox + signed consent form + audit log |
| Phase 2 | Credit Card Verification | Small charge ($0.50) verified to confirm parent identity |
| Phase 3 | Government ID Upload | Photo ID verification via third-party service |

**Note:** The FTC accepts "Email Plus" for the initial launch provided there is a meaningful consent step beyond a simple checkbox — the parent must take an affirmative action (clicking a consent link in a verification email AND confirming on a consent page that explains data practices).

## Authentication Flows

### Flow 1: Age Gate (First Screen — All Users)

```
Browser                         Server
   │                               │
   │── User visits /register.html  │
   │                               │
   │   ┌───────────────────────┐   │
   │   │   Are you under 13?   │   │
   │   │   [Yes]  [No]         │   │
   │   └───────────────────────┘   │
   │                               │
   │── If "No" (13+) ────────────► │  → Standard registration flow
   │── If "Yes" (<13) ───────────► │  → Parent-gated flow (no data collected yet)
```

**Critical:** The age gate MUST appear before ANY form fields are shown. No personal data (name, email, device info) is collected until the age-appropriate flow is determined.

### Flow 2: Student Under 13 — Parent-Gated Registration

```
Browser (Child)                  Server                        Parent Email
   │                               │                               │
   │── Clicks "I am under 13"     │                               │
   │                               │                               │
   │── Step 1: Minimal Input ─────►│                               │
   │   { nickname (optional),      │                               │
   │     parentEmail }             │                               │
   │                               │                               │
   │   ❌ NO account created       │                               │
   │   ❌ NO Cognito token         │                               │
   │                               │                               │
   │◄── "Ask your parent to        │                               │
   │     check their email"        │                               │
   │                               │── Step 2: Consent Email ──────►│
   │                               │   { consentLink, dataUsage,   │
   │                               │     childNickname }           │
   │                               │                               │
   │                               │◄── Step 3: Parent clicks ─────│
   │                               │    consent link               │
   │                               │                               │
   │                               │   Consent page shows:         │
   │                               │   - What data is collected     │
   │                               │   - How it is used            │
   │                               │   - Parent rights (review,    │
   │                               │     delete, revoke)           │
   │                               │   - [I Consent] button        │
   │                               │                               │
   │                               │◄── Step 4: Parent signs up ───│
   │                               │   Parent creates own account  │
   │                               │   (Google or email/password)  │
   │                               │                               │
   │                               │── Step 5: Child account ──────│
   │                               │   created UNDER parent        │
   │                               │   - Linked via parentId       │
   │                               │   - Restricted permissions    │
   │                               │   - Parent-managed session    │
   │                               │                               │
   │◄── Step 6: Child can now ─────│                               │
   │    access via parent session  │                               │
   │    or child login code        │                               │
```

**Key constraints:**
- NO Cognito identity for the child until AFTER parental consent is verified
- Pending consent requests expire after 72 hours
- Parent email is stored in a `PendingConsent` table (NOT the Users table) until consent is given
- If consent is not given within 72 hours, the pending record is deleted (no data retained)

### Flow 3: Parent Registration — Standard but Auditable

```
Browser (Parent)                 Server                        Cognito
   │                               │                               │
   │── Age gate: "No, I am 13+"   │                               │
   │── Selects role: "Parent"      │                               │
   │                               │                               │
   │── POST /api/auth/register ───►│                               │
   │   { email, password, name,    │── Cognito signup ────────────►│
   │     role: "parent" }          │                               │
   │                               │                               │
   │   Must accept:                │                               │
   │   ☑ Privacy Policy            │                               │
   │   ☑ COPPA Consent Agreement   │                               │
   │                               │                               │
   │   Audit log stores:           │                               │
   │   - Consent timestamp         │                               │
   │   - IP address                │                               │
   │   - Policy version accepted   │                               │
   │                               │                               │
   │◄── { accessToken, role }      │                               │
```

### Flow 4: Teacher Registration — Standard (No COPPA Issue)

```
Browser (Teacher)                Server                        Cognito
   │                               │                               │
   │── Age gate: "No, I am 13+"   │                               │
   │── Selects role: "Teacher"     │                               │
   │                               │                               │
   │── Standard Cognito flow ─────►│──────────────────────────────►│
   │   Google OAuth or email/pass  │                               │
   │                               │                               │
   │◄── { accessToken, role }      │                               │
```

**Note:** If teachers manage student data in classes, FERPA considerations apply. Teachers do NOT need COPPA consent themselves but must not expose student PII.

### Flow 5: Google OAuth (Cognito Hosted UI + PKCE) — 13+ Only

```
Browser                          Cognito Hosted UI              Google
   │                               │                               │
   │── Redirect to Hosted UI ──────►│                               │
   │   (includes code_challenge)    │── OAuth redirect ─────────────►│
   │                               │◄── auth code ─────────────────│
   │                               │── exchange code for tokens    │
   │◄── redirect with auth code ───│                               │
   │── POST /api/auth/token ────────────────────────────────────────►
   │   {code, codeVerifier}         (Lambda auth handler)
   │◄── {accessToken, refreshToken, idToken, role}
```

**COPPA restriction:** Google OAuth is ONLY available for users who pass the age gate as 13+. Children under 13 never interact with Google OAuth directly.

### Flow 6: Email/Password (Cognito User Pool) — 13+ Only

```
Browser                         Lambda Auth Handler             Cognito
   │                               │                               │
   │── POST /api/auth/token ───────►│                               │
   │   {email, password}            │── AdminInitiateAuth ──────────►│
   │                               │◄── tokens ────────────────────│
   │◄── {accessToken, refreshToken, role}
```

### Protected Route Authorization (Lambda Authorizer)

```
Browser                         API Gateway              Lambda Authorizer
   │                               │                               │
   │── GET /api/progress/me ───────►│                               │
   │   Authorization: Bearer JWT   │── invoke authorizer ──────────►│
   │                               │                   verify JWT  │
   │                               │                   extract role│
   │                               │◄── IAM Allow/Deny policy ─────│
   │                               │ (Allow → forward to Lambda)   │
   │◄── 200 / 401 / 403 ───────────│
```

## JWT Token Schema

```json
// Access Token payload (HS256, 1h expiry)
{
  "sub": "user-uuid-v4",
  "email": "user@example.com",
  "role": "student | teacher | parent | admin",
  "ageGroup": "under13 | 13plus | adult",
  "parentId": "parent-uuid-v4 | null",
  "iat": 1711641600,
  "exp": 1711645200,
  "iss": "learnfyra"
}
```

Refresh token: opaque string, 30-day expiry, stored in Cognito. Used to obtain new access tokens without re-login.

**Child accounts (under 13):** `parentId` is always populated. `email` may be null (child may not have an email). Session duration is shorter (4 hours max per day, configurable by parent).

## Guest Mode

- No authentication required for POST /api/generate and GET /api/solve/:id
- Guest worksheet attempts are scored locally (client-side only, no server storage)
- Guest users see "Log in to save your progress" prompt after scoring
- Guest mode is enforced by Lambda Authorizer allowing these routes without a token
- **COPPA Note:** Guest mode does NOT collect any personal data. No cookies, device fingerprinting, or behavioral tracking in guest mode.

## Cognito User Pool Design

```
Cognito User Pool: learnfyra-{env}-users
│
├── Group: Parents
│   - Full identity (email, name)
│   - Can manage linked child accounts
│   - Consent audit trail linked
│
├── Group: Teachers
│   - Full identity (email, name)
│   - Institutional context (optional school name)
│
├── Group: Students-13Plus
│   - Full identity (email, name)
│   - Standard self-registration
│
└── Group: Students-Under13
    - Minimal identity (nickname only, no email required)
    - Created ONLY via backend after parental consent verified
    - Linked to parent account via parentId
    - No direct login credentials (Phase 1: parent-managed session)
    - Optional: child login code (Phase 2)
```

## Non-Negotiable Rules

1. All /api/* routes (except /api/health, /api/auth/token, /api/auth/refresh, and guest-allowed routes) require a valid JWT in the Authorization header.
2. The JWT is verified by the Lambda Authorizer — never in individual Lambda handlers.
3. Role is extracted from the JWT `role` claim — never from the request body.
4. Refresh tokens are never sent to the frontend except in the /api/auth/token response.
5. No PII beyond email and name is stored in Cognito or DynamoDB Users table.
6. Student usernames are never exposed in worksheet metadata or solve-data.json.
7. **COPPA: No account or Cognito identity is created for a child under 13 until verifiable parental consent is recorded in the ConsentLog table.**
8. **COPPA: The age gate must appear before any registration form fields. No personal data is collected before age determination.**
9. **COPPA: Parent email collected during child registration is stored in PendingConsent table only, and deleted after 72 hours if consent is not given.**
10. **COPPA: Parents can review, download, and delete all child data at any time via the Parent Dashboard.**

## DynamoDB Tables

### Users Table

```
Table: LearnfyraUsers-{env}
PK: userId (String, UUID v4)
```

| Attribute | Type | Description |
|---|---|---|
| userId | String | UUID v4, PK |
| email | String | User email (indexed for lookup). NULL for children under 13 |
| role | String | student / teacher / parent / admin / suspended |
| ageGroup | String | under13 / 13plus / adult |
| name | String | Display name (nickname for under-13 students) |
| parentId | String | For child accounts — parent userId. NULL for others |
| createdAt | String | ISO-8601 timestamp |
| lastLoginAt | String | ISO-8601 timestamp |
| googleSub | String | Google OAuth subject (if Google login) |
| linkedChildIds | List | For parent accounts — list of child userIds |
| classIds | List | For students — class UUIDs enrolled in |
| consentId | String | Reference to ConsentLog entry (for under-13 students) |

GSI on email: `email-index` (for lookup by email during auth).
GSI on parentId: `parent-index` (for looking up all children of a parent).

### PendingConsent Table

```
Table: LearnfyraPendingConsent-{env}
PK: consentRequestId (String, UUID v4)
TTL: expiresAt (auto-delete after 72 hours)
```

| Attribute | Type | Description |
|---|---|---|
| consentRequestId | String | UUID v4, PK |
| parentEmail | String | Email to send consent request to |
| childNickname | String | Optional nickname provided by child |
| consentToken | String | Unique token embedded in consent email link |
| status | String | pending / consented / expired / revoked |
| createdAt | String | ISO-8601 timestamp |
| expiresAt | Number | Unix timestamp for DynamoDB TTL (72 hours from creation) |
| ipAddress | String | IP address of the child's request (audit) |

### ConsentLog Table (Immutable Audit Trail)

```
Table: LearnfyraConsentLog-{env}
PK: consentId (String, UUID v4)
```

| Attribute | Type | Description |
|---|---|---|
| consentId | String | UUID v4, PK |
| parentId | String | Parent userId who gave consent |
| childId | String | Child userId created after consent |
| consentMethod | String | email_plus / credit_card / gov_id |
| consentGivenAt | String | ISO-8601 timestamp |
| ipAddress | String | IP address at time of consent |
| policyVersion | String | Version of privacy policy accepted (e.g., "v1.0") |
| revokedAt | String | ISO-8601 timestamp (NULL if active) |
| revokedReason | String | Reason for revocation (NULL if active) |

**Critical:** ConsentLog records are NEVER deleted. Even if consent is revoked, the record is updated with `revokedAt` and `revokedReason`. This is required for FTC compliance auditing.

## API Endpoints

See `04-api-contracts/auth-api.md` for full request/response schemas.

### Existing Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/token | None | Exchange OAuth code or email/password for tokens |
| POST | /api/auth/refresh | None | Refresh access token using refresh token |
| POST | /api/auth/logout | Bearer | Revoke refresh token |
| GET | /api/auth/me | Bearer | Get current user profile |
| PUT | /api/auth/me | Bearer | Update user profile (name only) |
| POST | /api/auth/link-child | Bearer (parent) | Link parent to existing student account |

### New COPPA Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/child-request | None | Child submits parent email for consent (no account created) |
| GET | /api/auth/consent/:token | None | Parent opens consent page via email link |
| POST | /api/auth/consent/:token | None | Parent submits consent + creates their account |
| POST | /api/auth/child-account | Bearer (parent) | Parent creates child account after consent |
| GET | /api/auth/children | Bearer (parent) | List all children linked to parent |
| DELETE | /api/auth/children/:childId | Bearer (parent) | Delete child account and all associated data |
| POST | /api/auth/revoke-consent/:childId | Bearer (parent) | Revoke consent for a child (triggers data deletion) |
| GET | /api/auth/child-data/:childId | Bearer (parent) | Download all data collected for a child |
| POST | /api/auth/child-session | Bearer (parent) | Start a child session from parent account |

## File Structure

```
src/auth/
  cognitoClient.js      — Cognito SDK wrapper (lazy import, APP_RUNTIME aware)
  tokenService.js       — JWT sign/verify (HS256 for local, RS256 for Cognito)
  userService.js        — DynamoDB Users table CRUD
  consentService.js     — NEW: PendingConsent + ConsentLog table operations
  childAccountService.js— NEW: child account creation, linking, deletion
  ageGate.js            — NEW: age verification logic

backend/handlers/
  authHandler.js        — Lambda handler for /api/auth/* routes
  consentHandler.js     — NEW: Lambda handler for consent flow endpoints
  parentHandler.js      — NEW: Lambda handler for parent dashboard endpoints

backend/middleware/
  authorizer.js         — Lambda Authorizer (JWT validation + IAM policy generation)

backend/templates/
  consent-email.html    — NEW: consent request email template
  consent-page.html     — NEW: consent landing page template
```

## Acceptance Criteria

### Existing (unchanged)

**AC-1:** Given a user with a Google account, when they click "Sign in with Google" and complete the OAuth flow, then they receive an access token with the correct role claim and are redirected to the appropriate dashboard.

**AC-2:** Given a valid access token, when a request is made to a protected route, then the Lambda Authorizer returns an Allow IAM policy and the request proceeds.

**AC-3:** Given an expired or invalid access token, when a request is made to a protected route, then the Lambda Authorizer returns a Deny IAM policy and API Gateway returns 401.

**AC-4:** Given a student token, when the student attempts to access a teacher-only route (POST /api/classes), then the authorizer returns 403 Forbidden with code INSUFFICIENT_ROLE.

**AC-5:** Given an unauthenticated user, when they call POST /api/generate, then the request succeeds (guest mode) and the response includes a worksheetId and download links.

**AC-6:** Given a user calls POST /api/auth/refresh with a valid refresh token, when the access token has expired, then they receive a new access token without re-entering credentials.

**AC-7:** Given a user calls POST /api/auth/logout, then the refresh token is revoked in Cognito and subsequent refresh calls with that token return 401.

**AC-8:** Given APP_RUNTIME=local, when the auth handler is invoked, then it uses the local adapter (no Cognito API calls) and verifies JWT with LOCAL_JWT_SECRET.

**AC-9:** Given APP_RUNTIME=aws, when the auth handler is invoked, then it calls Cognito AdminInitiateAuth and returns Cognito-issued tokens.

### COPPA Compliance (new)

**AC-10:** Given a user visits the registration page, when the page loads, then an age gate ("Are you under 13?") is displayed BEFORE any form fields for personal data.

**AC-11:** Given a child under 13 selects "Yes" on the age gate, when they submit the form, then ONLY a parent email and optional nickname are accepted, NO Cognito identity is created, and a consent email is sent to the parent.

**AC-12:** Given a consent email is sent to a parent, when the parent clicks the consent link within 72 hours, then they see a consent page explaining data collection practices, their rights, and a clear "I Consent" action.

**AC-13:** Given a parent completes the consent flow, when they create their account and consent, then a child account is created linked to the parent, a ConsentLog record is written with timestamp/IP/policy version, and the child can access the platform.

**AC-14:** Given a consent request is pending, when 72 hours pass without parent action, then the PendingConsent record is automatically deleted via DynamoDB TTL and no child data is retained.

**AC-15:** Given a parent is logged in, when they access the Parent Dashboard, then they can view all linked child accounts, review child data, and delete any child account.

**AC-16:** Given a parent revokes consent for a child, when POST /api/auth/revoke-consent/:childId is called, then the child's Cognito identity is deleted, all child data in DynamoDB is deleted, the ConsentLog is updated with revokedAt timestamp, and the child can no longer access the platform.

**AC-17:** Given a parent requests child data export, when GET /api/auth/child-data/:childId is called, then a JSON file containing all data associated with the child is returned.

**AC-18:** Given a child under 13 attempts to use Google OAuth directly, when the system detects the age gate response, then the OAuth flow is blocked and the child is redirected to the parent-gated flow.

**AC-19:** Given guest mode is active, when an unauthenticated user generates or solves a worksheet, then NO cookies, device fingerprints, or behavioral tracking data are collected.

## Google OAuth Client Configuration

| Environment | Authorized Origins | Redirect URI |
|---|---|---|
| dev | https://web.dev.learnfyra.com | https://auth.dev.learnfyra.com/oauth2/idpresponse |
| staging | https://web.staging.learnfyra.com | https://auth.staging.learnfyra.com/oauth2/idpresponse |
| prod | https://web.learnfyra.com | https://auth.learnfyra.com/oauth2/idpresponse |

Note: localhost is NOT an authorized origin for any Google OAuth client (use test tokens for local dev instead).

**COPPA Note:** Google OAuth is only available to users who pass the age gate as 13+. The "Sign in with Google" button is never shown on the under-13 registration flow.

## Data Minimization (COPPA Requirement)

### Data Collected Per User Type

| Data Field | Parent | Teacher | Student 13+ | Student <13 |
|---|---|---|---|---|
| Email | Yes | Yes | Yes | NO |
| Full Name | Yes | Yes | Yes | NO (nickname only) |
| Password (hashed) | Yes | Yes | Yes | NO (parent-managed) |
| Google Sub | Optional | Optional | Optional | NO |
| Phone Number | NO | NO | NO | NO |
| Date of Birth | NO | NO | NO | NO |
| Location | NO | NO | NO | NO |
| Device Info | NO | NO | NO | NO |
| Behavioral Tracking | NO | NO | NO | NO |

**Critical:** For children under 13, the platform collects ONLY:
- Nickname (optional, provided by parent)
- Worksheet answers and scores (functional data required for the service)
- No IP addresses stored beyond the ConsentLog audit entry

## Parental Dashboard Requirements

Parents with linked child accounts MUST have access to:

1. **View Child Data** — See all data collected for each child (worksheets completed, scores, profile info)
2. **Download Child Data** — Export all child data as JSON (GET /api/auth/child-data/:childId)
3. **Delete Child Account** — Permanently delete the child account and all associated data
4. **Revoke Consent** — Withdraw consent, which triggers full data deletion
5. **Manage Child Sessions** — Start/stop child access sessions
6. **View Consent History** — See when consent was given and the policy version accepted

## Security Notes

- PKCE (code_challenge / code_verifier) is used for Google OAuth — no client secret stored in browser
- JWT signing secret stored in Secrets Manager: `learnfyra/{env}/auth-config`
- In local mode: JWT signed with `LOCAL_JWT_SECRET` from .env (minimum 32 characters)
- Token blacklist: revoked tokens are tracked in DynamoDB (TTL = token expiry time)
- Rate limiting on /api/auth/token: 10 requests per minute per IP (API Gateway WAF rule)
- Consent tokens are single-use, cryptographically random, and expire after 72 hours
- ConsentLog table is append-only — records are never deleted (FTC audit requirement)
- Child data deletion (on consent revocation) is cascading: Users table + all worksheet/solve data in S3
