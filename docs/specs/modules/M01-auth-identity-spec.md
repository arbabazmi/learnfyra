# M01: Auth and Identity Spec
Status: draft
Priority: P0
Owner: Auth Team

## Scope
- Teacher, student, parent login.
- Google OAuth plus one additional public OAuth provider.
- Local email/password fallback.
- JWT sessions and role-based API access.

## Functional Requirements
1. Support Google OAuth.
2. Support second provider (GitHub or Microsoft).
3. Support local account register/login.
4. Enforce role claims: teacher, student, parent.
5. Block protected endpoints without valid token.
6. Parent access requires child link state.

## API Surface
- `POST /api/auth/oauth/google`
- `POST /api/auth/oauth/github` (or Microsoft)
- `GET /api/auth/callback/:provider`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

## Acceptance Criteria
Given a teacher signs in with Google
When OAuth succeeds
Then teacher session is issued with correct role claims.

Given a guest user opens online solve
When submit is attempted
Then request is blocked until authentication succeeds.

Given a parent logs in
When no child link exists
Then parent sees guided link state instead of student data.

## Out of Scope (This Module)
- LMS SSO.
- Multi-tenant school federation.
