# M01 — Auth & Identity

## Module Summary

M01 handles user authentication, authorization, and identity management across all roles (student, teacher, parent, admin). It integrates with AWS Cognito for Google OAuth and email/password accounts, and provides a Lambda Authorizer for protecting API Gateway routes.

## User Roles

| Role | Primary Actions | Can Self-Register |
|---|---|---|
| student | solve worksheets, view own progress | yes |
| teacher | generate worksheets, manage classes, view class analytics | yes |
| parent | view child progress, link to student account | yes |
| admin | full platform management (M07) | no (invited only) |

## Authentication Flows

### Google OAuth (Cognito Hosted UI + PKCE)

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

### Email/Password (Cognito User Pool)

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
  "iat": 1711641600,
  "exp": 1711645200,
  "iss": "learnfyra"
}
```

Refresh token: opaque string, 30-day expiry, stored in Cognito. Used to obtain new access tokens without re-login.

## Guest Mode

- No authentication required for POST /api/generate and GET /api/solve/:id
- Guest worksheet attempts are scored locally (client-side only, no server storage)
- Guest users see "Log in to save your progress" prompt after scoring
- Guest mode is enforced by Lambda Authorizer allowing these routes without a token

## Non-Negotiable Rules

1. All /api/* routes (except /api/health, /api/auth/token, /api/auth/refresh, and guest-allowed routes) require a valid JWT in the Authorization header.
2. The JWT is verified by the Lambda Authorizer — never in individual Lambda handlers.
3. Role is extracted from the JWT `role` claim — never from the request body.
4. Refresh tokens are never sent to the frontend except in the /api/auth/token response.
5. No PII beyond email and name is stored in Cognito or DynamoDB Users table.
6. Student usernames are never exposed in worksheet metadata or solve-data.json.

## DynamoDB Users Table Schema

```
Table: LearnfyraUsers-{env}
PK: userId (String, UUID v4)
```

| Attribute | Type | Description |
|---|---|---|
| userId | String | UUID v4, PK |
| email | String | User email (indexed for lookup) |
| role | String | student / teacher / parent / admin / suspended |
| name | String | Display name |
| createdAt | String | ISO-8601 timestamp |
| lastLoginAt | String | ISO-8601 timestamp |
| googleSub | String | Google OAuth subject (if Google login) |
| linkedStudentId | String | For parent accounts — student userId they are linked to |
| classIds | List | For students — class UUIDs enrolled in |

GSI on email: `email-index` (for lookup by email during auth).

## API Endpoints

See `04-api-contracts/auth-api.md` for full request/response schemas.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/token | None | Exchange OAuth code or email/password for tokens |
| POST | /api/auth/refresh | None | Refresh access token using refresh token |
| POST | /api/auth/logout | Bearer | Revoke refresh token |
| GET | /api/auth/me | Bearer | Get current user profile |
| PUT | /api/auth/me | Bearer | Update user profile (name only) |

## File Structure

```
src/auth/
  cognitoClient.js      — Cognito SDK wrapper (lazy import, APP_RUNTIME aware)
  tokenService.js       — JWT sign/verify (HS256 for local, RS256 for Cognito)
  userService.js        — DynamoDB Users table CRUD

backend/handlers/
  authHandler.js        — Lambda handler for /api/auth/* routes

backend/middleware/
  authorizer.js         — Lambda Authorizer (JWT validation + IAM policy generation)
```

## Acceptance Criteria

**AC-1:** Given a user with a Google account, when they click "Sign in with Google" and complete the OAuth flow, then they receive an access token with the correct role claim and are redirected to the appropriate dashboard.

**AC-2:** Given a valid access token, when a request is made to a protected route, then the Lambda Authorizer returns an Allow IAM policy and the request proceeds.

**AC-3:** Given an expired or invalid access token, when a request is made to a protected route, then the Lambda Authorizer returns a Deny IAM policy and API Gateway returns 401.

**AC-4:** Given a student token, when the student attempts to access a teacher-only route (POST /api/classes), then the authorizer returns 403 Forbidden with code INSUFFICIENT_ROLE.

**AC-5:** Given an unauthenticated user, when they call POST /api/generate, then the request succeeds (guest mode) and the response includes a worksheetId and download links.

**AC-6:** Given a user calls POST /api/auth/refresh with a valid refresh token, when the access token has expired, then they receive a new access token without re-entering credentials.

**AC-7:** Given a user calls POST /api/auth/logout, then the refresh token is revoked in Cognito and subsequent refresh calls with that token return 401.

**AC-8:** Given APP_RUNTIME=local, when the auth handler is invoked, then it uses the local adapter (no Cognito API calls) and verifies JWT with LOCAL_JWT_SECRET.

**AC-9:** Given APP_RUNTIME=aws, when the auth handler is invoked, then it calls Cognito AdminInitiateAuth and returns Cognito-issued tokens.

## Google OAuth Client Configuration

| Environment | Authorized Origins | Redirect URI |
|---|---|---|
| dev | https://web.dev.learnfyra.com | https://auth.dev.learnfyra.com/oauth2/idpresponse |
| staging | https://web.staging.learnfyra.com | https://auth.staging.learnfyra.com/oauth2/idpresponse |
| prod | https://web.learnfyra.com | https://auth.learnfyra.com/oauth2/idpresponse |

Note: localhost is NOT an authorized origin for any Google OAuth client (use test tokens for local dev instead).

## Security Notes

- PKCE (code_challenge / code_verifier) is used for Google OAuth — no client secret stored in browser
- JWT signing secret stored in Secrets Manager: `learnfyra/{env}/auth-config`
- In local mode: JWT signed with `LOCAL_JWT_SECRET` from .env (minimum 32 characters)
- Token blacklist: revoked tokens are tracked in DynamoDB (TTL = token expiry time)
- Rate limiting on /api/auth/token: 10 requests per minute per IP (API Gateway WAF rule)
