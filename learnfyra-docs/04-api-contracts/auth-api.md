# Auth API Contracts (M01)

**Status: FROZEN — RC-BE-01 (2026-03-26)**

All endpoints below are immutable. Additive fields are permitted in responses. Removing, renaming, or changing types of existing fields requires API versioning.

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
