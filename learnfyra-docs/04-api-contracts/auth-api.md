# Auth API Contracts (M01)

**Status: FROZEN — RC-BE-01 (2026-03-26)** (original endpoints)
**Status: DRAFT — COPPA Endpoints (2026-04-03)** (new endpoints below)

All original endpoints below are immutable. Additive fields are permitted in responses. Removing, renaming, or changing types of existing fields requires API versioning.

New COPPA endpoints (marked with "NEW — COPPA") are in DRAFT status and subject to review.

---

## POST /api/auth/token

Exchange OAuth authorization code or email/password for tokens.

**Auth:** None

**Request (Google OAuth):**
```json
{
  "provider": "google",
  "code": "authorization-code-from-cognito",
  "codeVerifier": "pkce-code-verifier-string"
}
```

**Request (Email/Password):**
```json
{
  "provider": "email",
  "email": "user@example.com",
  "password": "UserPassword123!"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "opaque-refresh-token",
  "idToken": "eyJhbGci...",
  "role": "student | teacher | parent | admin",
  "userId": "uuid-v4",
  "name": "User Name",
  "expiresIn": 3600
}
```

**Error 400 — Invalid request:**
```json
{ "error": "Bad Request", "code": "INVALID_REQUEST", "details": "..." }
```

**Error 401 — Wrong credentials:**
```json
{ "error": "Unauthorized", "code": "INVALID_CREDENTIALS" }
```

**Error 429 — Rate limited:**
```json
{ "error": "Too Many Requests", "code": "RATE_LIMIT_EXCEEDED", "retryAfter": 60 }
```

---

## POST /api/auth/refresh

Exchange a refresh token for a new access token.

**Auth:** None

**Request:**
```json
{
  "refreshToken": "opaque-refresh-token"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGci...",
  "expiresIn": 3600
}
```

**Error 401:**
```json
{ "error": "Unauthorized", "code": "INVALID_REFRESH_TOKEN" }
```

---

## POST /api/auth/logout

Revoke the user's refresh token.

**Auth:** Bearer token required

**Request:** Empty body `{}`

**Response 200:**
```json
{ "message": "Logged out" }
```

**Error 401:**
```json
{ "error": "Unauthorized", "code": "NO_TOKEN" }
```

---

## GET /api/auth/me

Get the authenticated user's profile.

**Auth:** Bearer token required

**Response 200:**
```json
{
  "userId": "uuid-v4",
  "email": "user@example.com",
  "name": "User Name",
  "role": "student | teacher | parent | admin",
  "createdAt": "2026-01-15T10:00:00Z",
  "lastLoginAt": "2026-03-28T12:00:00Z"
}
```

---

## PUT /api/auth/me

Update the authenticated user's profile (name only).

**Auth:** Bearer token required

**Request:**
```json
{
  "name": "New Display Name"
}
```

**Response 200:**
```json
{
  "userId": "uuid-v4",
  "name": "New Display Name"
}
```

**Error 400 — Name too long (> 100 chars):**
```json
{ "error": "Bad Request", "code": "INVALID_NAME" }
```

---

## POST /api/auth/link-child

Link a parent account to a student account.

**Auth:** Bearer token required (parent role only)

**Request:**
```json
{
  "childEmail": "student@school.com",
  "relationship": "parent"
}
```

**Response 200:**
```json
{
  "linkedStudentId": "uuid-v4",
  "studentName": "Student Name",
  "status": "pending_confirmation"
}
```

The student receives a notification to confirm. The link becomes active after confirmation.

**Error 404 — Student not found:**
```json
{ "error": "Not Found", "code": "STUDENT_NOT_FOUND" }
```

**Error 409 — Already linked:**
```json
{ "error": "Conflict", "code": "ALREADY_LINKED" }
```

**Error 403 — Not a parent account:**
```json
{ "error": "Forbidden", "code": "INSUFFICIENT_ROLE" }
```

---

## Lambda Authorizer — IAM Policy Format

The Lambda Authorizer returns an IAM policy to API Gateway. This is internal (not a public endpoint) but documented for testing:

```json
{
  "principalId": "user-uuid",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": "execute-api:Invoke",
        "Effect": "Allow | Deny",
        "Resource": "arn:aws:execute-api:REGION:ACCOUNT:API_ID/STAGE/METHOD/RESOURCE"
      }
    ]
  },
  "context": {
    "userId": "user-uuid",
    "role": "student | teacher | parent | admin",
    "email": "user@example.com"
  }
}
```

The `context` object is passed to downstream Lambda functions as `event.requestContext.authorizer`.

---

---

## POST /api/auth/child-request — NEW (COPPA)

Submit a consent request for a child under 13. No account is created.

**Auth:** None

**Request:**
```json
{
  "parentEmail": "parent@example.com",
  "childNickname": "Alex"
}
```

**Response 202 (Accepted):**
```json
{
  "message": "Consent request sent. Please ask your parent to check their email.",
  "consentRequestId": "uuid-v4",
  "expiresIn": 259200
}
```

**Error 400 — Missing parent email:**
```json
{ "error": "Bad Request", "code": "INVALID_REQUEST", "details": "parentEmail is required" }
```

**Error 429 — Rate limited (max 3 requests per parent email per day):**
```json
{ "error": "Too Many Requests", "code": "CONSENT_RATE_LIMITED", "retryAfter": 86400 }
```

---

## GET /api/auth/consent/:token — NEW (COPPA)

Render the parental consent page. The token is from the consent email link.

**Auth:** None

**Response 200:**
```json
{
  "consentRequestId": "uuid-v4",
  "childNickname": "Alex",
  "dataCollectionSummary": "Learnfyra collects your child's nickname, worksheet answers, and scores to provide educational worksheets.",
  "parentRights": [
    "Review all data collected about your child",
    "Download your child's data at any time",
    "Delete your child's account and all associated data",
    "Revoke consent at any time"
  ],
  "privacyPolicyUrl": "https://learnfyra.com/privacy",
  "policyVersion": "v1.0"
}
```

**Error 404 — Token expired or invalid:**
```json
{ "error": "Not Found", "code": "CONSENT_TOKEN_INVALID" }
```

---

## POST /api/auth/consent/:token — NEW (COPPA)

Parent submits consent. If the parent does not have an account, they must create one first (included in this request).

**Auth:** None (parent creates account as part of consent) OR Bearer (existing parent)

**Request (new parent):**
```json
{
  "consent": true,
  "parentAccount": {
    "provider": "email",
    "email": "parent@example.com",
    "password": "ParentPass123!",
    "name": "Jane Doe"
  }
}
```

**Request (existing parent, authenticated):**
```json
{
  "consent": true
}
```

**Response 201 (Created):**
```json
{
  "message": "Consent recorded. Child account created.",
  "parentUserId": "uuid-v4",
  "childUserId": "uuid-v4",
  "childName": "Alex",
  "consentId": "uuid-v4",
  "accessToken": "eyJhbGci...",
  "refreshToken": "opaque-refresh-token",
  "role": "parent",
  "expiresIn": 3600
}
```

**Error 400 — Consent not given:**
```json
{ "error": "Bad Request", "code": "CONSENT_REQUIRED", "details": "consent must be true" }
```

**Error 404 — Token expired:**
```json
{ "error": "Not Found", "code": "CONSENT_TOKEN_INVALID" }
```

**Error 409 — Consent already processed:**
```json
{ "error": "Conflict", "code": "CONSENT_ALREADY_PROCESSED" }
```

---

## POST /api/auth/child-account — NEW (COPPA)

Parent creates an additional child account (after initial consent is already established).

**Auth:** Bearer token required (parent role only)

**Request:**
```json
{
  "childNickname": "Sam",
  "ageGroup": "under13"
}
```

**Response 201:**
```json
{
  "childUserId": "uuid-v4",
  "childName": "Sam",
  "consentId": "uuid-v4",
  "parentId": "parent-uuid-v4"
}
```

**Error 403 — Not a parent:**
```json
{ "error": "Forbidden", "code": "INSUFFICIENT_ROLE" }
```

---

## GET /api/auth/children — NEW (COPPA)

List all children linked to the authenticated parent.

**Auth:** Bearer token required (parent role only)

**Response 200:**
```json
{
  "children": [
    {
      "childId": "uuid-v4",
      "name": "Alex",
      "ageGroup": "under13",
      "createdAt": "2026-04-01T10:00:00Z",
      "consentId": "uuid-v4",
      "lastActiveAt": "2026-04-03T14:30:00Z"
    }
  ]
}
```

---

## GET /api/auth/child-data/:childId — NEW (COPPA)

Download all data collected for a specific child (COPPA parental right).

**Auth:** Bearer token required (parent role, must own the child account)

**Response 200:**
```json
{
  "childId": "uuid-v4",
  "profile": {
    "name": "Alex",
    "ageGroup": "under13",
    "createdAt": "2026-04-01T10:00:00Z"
  },
  "consent": {
    "consentId": "uuid-v4",
    "givenAt": "2026-04-01T09:55:00Z",
    "method": "email_plus",
    "policyVersion": "v1.0"
  },
  "worksheetActivity": [
    {
      "worksheetId": "uuid-v4",
      "subject": "Math",
      "topic": "Multiplication",
      "solvedAt": "2026-04-02T11:00:00Z",
      "score": 8,
      "totalPoints": 10
    }
  ]
}
```

**Error 403 — Not the child's parent:**
```json
{ "error": "Forbidden", "code": "NOT_CHILD_PARENT" }
```

**Error 404 — Child not found:**
```json
{ "error": "Not Found", "code": "CHILD_NOT_FOUND" }
```

---

## DELETE /api/auth/children/:childId — NEW (COPPA)

Permanently delete a child account and all associated data.

**Auth:** Bearer token required (parent role, must own the child account)

**Response 200:**
```json
{
  "message": "Child account and all associated data deleted.",
  "childId": "uuid-v4",
  "deletedAt": "2026-04-03T16:00:00Z"
}
```

**Error 403:**
```json
{ "error": "Forbidden", "code": "NOT_CHILD_PARENT" }
```

**Error 404:**
```json
{ "error": "Not Found", "code": "CHILD_NOT_FOUND" }
```

---

## POST /api/auth/revoke-consent/:childId — NEW (COPPA)

Revoke parental consent for a child. Same effect as account deletion, but explicitly records the revocation reason.

**Auth:** Bearer token required (parent role, must own the child account)

**Request:**
```json
{
  "reason": "No longer want my child using the service"
}
```

**Response 200:**
```json
{
  "message": "Consent revoked. Child account and all data deleted.",
  "childId": "uuid-v4",
  "consentId": "uuid-v4",
  "revokedAt": "2026-04-03T16:00:00Z"
}
```

---

## POST /api/auth/child-session — NEW (COPPA)

Start a scoped child session from a parent account.

**Auth:** Bearer token required (parent role, must own the child account)

**Request:**
```json
{
  "childId": "uuid-v4"
}
```

**Response 200:**
```json
{
  "childAccessToken": "eyJhbGci...",
  "childUserId": "uuid-v4",
  "childName": "Alex",
  "role": "student",
  "ageGroup": "under13",
  "parentId": "parent-uuid-v4",
  "expiresIn": 14400,
  "permissions": ["solve_worksheet", "view_own_scores"]
}
```

**Error 403 — Not the child's parent:**
```json
{ "error": "Forbidden", "code": "NOT_CHILD_PARENT" }
```

---

## Error Code Reference

| Code | HTTP Status | Meaning |
|---|---|---|
| NO_TOKEN | 401 | Authorization header missing |
| INVALID_TOKEN | 401 | Token signature invalid or malformed |
| TOKEN_EXPIRED | 401 | Access token has expired |
| TOKEN_REVOKED | 401 | Token has been revoked (after logout) |
| INSUFFICIENT_ROLE | 403 | User role does not have permission |
| INVALID_CREDENTIALS | 401 | Wrong email or password |
| INVALID_REFRESH_TOKEN | 401 | Refresh token invalid or expired |
| RATE_LIMIT_EXCEEDED | 429 | Too many auth requests |
| STUDENT_NOT_FOUND | 404 | Child account not found |
| ALREADY_LINKED | 409 | Accounts already linked |
| CONSENT_TOKEN_INVALID | 404 | Consent token expired or not found |
| CONSENT_REQUIRED | 400 | Consent flag must be true |
| CONSENT_ALREADY_PROCESSED | 409 | Consent has already been given for this request |
| CONSENT_RATE_LIMITED | 429 | Too many consent requests for this email |
| NOT_CHILD_PARENT | 403 | Authenticated user is not the parent of this child |
| CHILD_NOT_FOUND | 404 | Child account not found or not linked to parent |
| AGE_GATE_REQUIRED | 400 | Age gate response missing from registration request |
| UNDER13_DIRECT_SIGNUP | 403 | Direct signup not allowed for children under 13 |
