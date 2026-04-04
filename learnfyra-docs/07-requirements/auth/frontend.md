# M01 Auth Frontend — Requirements Spec
**Module:** M01
**Status:** Pending Implementation
**Version:** 2.0 — COPPA-Compliant Authentication
**Last Updated:** 2026-04-03

---

## Overview

M01 Frontend covers all client-side authentication surfaces for Learnfyra: the login page, the registration page with role selection and **COPPA-compliant age gate**, the Google OAuth PKCE redirect flow, secure token storage with auto-refresh, protected route enforcement, the **parent-gated child registration flow**, the **parental consent page**, and the **Parent Dashboard for child account management**. These pages are served as static files from `learnfyra-{env}-s3-frontend` via CloudFront. All token exchange calls target the auth API contracts in `04-api-contracts/auth-api.md`. The backend auth handlers (M01-BE-01 through M01-BE-08) are already deployed and are not touched by this module.

**COPPA Compliance:** Since Learnfyra serves children under 13, the frontend MUST implement an age gate, prevent direct signup for children under 13, and provide a parent-gated consent flow. See `02-modules/auth.md` and `07-requirements/auth/README.md` for the full COPPA architecture.

---

## User Stories

### US-FE-AUTH-001: Sign In with Email and Password
**As a** returning teacher, student, or parent
**I want to** enter my email and password on a login page
**So that** I receive a JWT access token and am redirected to my role-appropriate dashboard
**Priority:** P0

### US-FE-AUTH-002: Sign In with Google
**As a** user with a Google account
**I want to** click "Sign in with Google" and complete the Cognito Hosted UI OAuth flow
**So that** I can authenticate without managing a separate password
**Priority:** P0

### US-FE-AUTH-003: Register a New Account with Role Selection
**As a** new user (teacher, student, or parent)
**I want to** fill in a registration form that includes my role
**So that** my account is created with the correct role and I land on the correct dashboard immediately
**Priority:** P0

### US-FE-AUTH-004: Stay Logged In Without Re-entering Credentials
**As an** authenticated user
**I want** my session to remain active across page navigations and be silently refreshed before my access token expires
**So that** I am not interrupted while generating or solving worksheets
**Priority:** P0

### US-FE-AUTH-005: Log Out
**As an** authenticated user
**I want to** click a logout button in the navigation
**So that** my session is terminated securely and my refresh token is revoked
**Priority:** P1

### US-FE-AUTH-006: Access Control on Protected Pages
**As an** unauthenticated visitor
**I want to** be redirected to the login page when I attempt to access a protected page
**So that** unauthorized access to student, teacher, or parent features is prevented and my original destination is preserved for after login
**Priority:** P0

### US-FE-AUTH-007: Role-Appropriate Post-Login Redirect
**As a** newly authenticated user
**I want to** land on the dashboard that matches my role after signing in
**So that** I see only the features relevant to me immediately after authentication
**Priority:** P1

### US-FE-AUTH-008: Age Gate Before Registration (COPPA)
**As a** new visitor
**I want to** see an age verification question before any registration form
**So that** I am directed to the correct registration flow (standard or parent-gated)
**Priority:** P0

### US-FE-AUTH-009: Parent-Gated Child Registration (COPPA)
**As a** child under 13
**I want to** provide my parent's email to request an account
**So that** my parent can consent and create my account securely
**Priority:** P0

### US-FE-AUTH-010: Parental Consent Page (COPPA)
**As a** parent
**I want to** review what data will be collected about my child and give explicit consent
**So that** I can make an informed decision about my child's use of the platform
**Priority:** P0

### US-FE-AUTH-011: Parent Dashboard — Child Management (COPPA)
**As a** parent
**I want to** view, manage, and delete my children's accounts from a dashboard
**So that** I maintain control over my children's data as required by COPPA
**Priority:** P0

### US-FE-AUTH-012: Start Child Session (COPPA)
**As a** parent
**I want to** start a supervised session for my child from my dashboard
**So that** my child can use the platform with restricted permissions
**Priority:** P1

---

## Functional Requirements

### REQ-FE-AUTH-001: Login Page (login.html)
**Priority:** P0
**Tasks:** M01-FE-01

The system SHALL provide a login page served at `/login.html` and stored at `frontend/login.html`. The page SHALL contain:
- A "Sign in with Google" button that initiates the PKCE OAuth redirect (see REQ-FE-AUTH-003).
- An email input field, a password input field, and a "Sign In" submit button.
- On submit, the page SHALL call `POST /api/auth/token` with `{ provider: "email", email, password }`.
- On a 200 response, it SHALL store tokens per REQ-FE-AUTH-004 and redirect per REQ-FE-AUTH-007.
- On a 401 INVALID_CREDENTIALS response, it SHALL display "Incorrect email or password." inline without page reload.
- On a 429 RATE_LIMIT_EXCEEDED response, it SHALL display "Too many attempts. Please wait 60 seconds." and disable the submit button for 60 seconds.
- On any 5xx or network error, it SHALL display "Something went wrong. Please try again."
- If a valid in-memory or refreshable access token already exists, the page SHALL redirect to the role-appropriate dashboard without rendering the form.
- A link to `/register.html` SHALL be present.

### REQ-FE-AUTH-002: Register Page with Age Gate (register.html)
**Priority:** P0
**Tasks:** M01-FE-02, M01-FE-06 (new — age gate)

The system SHALL provide a registration page at `/register.html` and stored at `frontend/register.html`. The page SHALL implement a multi-step flow:

**Step 1 — Age Gate (COPPA):**
- The FIRST screen shown SHALL be an age gate: "Are you under 13?"
- Two clear buttons: "Yes, I am under 13" and "No, I am 13 or older"
- NO personal data input fields are visible at this step
- The age gate CANNOT be skipped or dismissed — it blocks all further interaction

**Step 2a — If "No, I am 13 or older" (standard registration):**
- Full name, email, password, and confirm-password inputs
- A role selector offering exactly three options: Student, Teacher, Parent. The Admin role SHALL NOT appear
- Client-side validation: passwords must match, password must be at least 8 characters with at least one uppercase letter, one number, and one special character. Errors SHALL be shown adjacent to the relevant field
- On submission with valid inputs, the page SHALL initiate the Cognito registration flow
- A link back to `/login.html` SHALL be present

**Step 2b — If "Yes, I am under 13" (parent-gated flow):**
- The page SHALL display ONLY two fields:
  - Parent email (required) — with help text: "Enter your parent's or guardian's email address"
  - Your nickname (optional) — with help text: "What should we call you?"
- NO email, password, Google OAuth, or role selector fields are shown
- On submission, the page SHALL call `POST /api/auth/child-request` with `{ parentEmail, childNickname }`
- On 202 response, show a child-friendly message: "We sent an email to your parent. Ask them to check their inbox!"
- On 429 response, show: "Too many requests. Please try again tomorrow."
- NO account is created. NO Cognito interaction occurs. NO token is issued.

### REQ-FE-AUTH-002a: Parental Consent Page (consent.html) — NEW (COPPA)
**Priority:** P0
**Tasks:** M01-FE-07 (new)

The system SHALL provide a consent page at `/consent.html` and stored at `frontend/consent.html`. This page is accessed via the consent link in the parent email. The page SHALL:

1. Read the `token` parameter from the URL query string
2. Call `GET /api/auth/consent/:token` to retrieve consent details
3. If the token is invalid/expired, show: "This consent link has expired. Your child can request a new one."
4. If valid, display:
   - Child's nickname (if provided)
   - Clear description of what data is collected
   - Parent's COPPA rights (review, download, delete, revoke)
   - Link to the full Privacy Policy
   - If parent is NOT logged in: registration/login form (email/password or Google OAuth)
   - An affirmative "I Consent and Create Account" button (NOT a pre-checked checkbox)
5. On clicking "I Consent", call `POST /api/auth/consent/:token` with consent and parent account data
6. On 201 response, redirect parent to the Parent Dashboard showing the newly created child account

### REQ-FE-AUTH-002b: Parent Dashboard (parent-dashboard.html) — NEW (COPPA)
**Priority:** P0
**Tasks:** M01-FE-08 (new)

The system SHALL provide a Parent Dashboard at `/parent-dashboard.html`. This page requires authentication (parent role). The page SHALL:

1. Call `GET /api/auth/children` to list all linked child accounts
2. For each child, display:
   - Child name/nickname
   - Account creation date
   - Last active date
   - Actions: "Start Session", "View Data", "Download Data", "Delete Account"
3. **Start Session:** Call `POST /api/auth/child-session`, then redirect to `index.html` with the child's scoped token
4. **View Data:** Call `GET /api/auth/child-data/:childId` and display a summary of worksheets and scores
5. **Download Data:** Call `GET /api/auth/child-data/:childId` and trigger a JSON file download
6. **Delete Account:** Show a confirmation dialog ("This will permanently delete [child name]'s account and all their data. This cannot be undone."), then call `DELETE /api/auth/children/:childId`
7. **Revoke Consent:** Show a dialog explaining revocation, accept an optional reason, then call `POST /api/auth/revoke-consent/:childId`

### REQ-FE-AUTH-003: Google OAuth PKCE Client-Side Flow
**Priority:** P0
**Tasks:** M01-FE-03

`frontend/js/auth.js` SHALL implement the complete PKCE flow:
1. Generate a cryptographically random `codeVerifier` (43–128 characters, URL-safe base64) using `crypto.getRandomValues`.
2. Compute `codeChallenge = BASE64URL(SHA256(codeVerifier))` using the Web Crypto API (`SubtleCrypto.digest`).
3. Store `codeVerifier` in `sessionStorage` under the key `pkce_verifier`. It SHALL NOT be stored in `localStorage` or appear in any URL.
4. Redirect the browser to the environment-specific Cognito Hosted UI authorize endpoint (injected via `window.LEARNFYRA_CONFIG.cognitoAuthorizeUrl`) with query parameters: `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`.
5. On the OAuth callback: read `code` from the URL query string and `codeVerifier` from `sessionStorage`. Call `POST /api/auth/token` with `{ provider: "google", code, codeVerifier }`.
6. Delete `pkce_verifier` from `sessionStorage` immediately after the token exchange call (regardless of success or failure).
7. On a 200 response, store tokens per REQ-FE-AUTH-004 and redirect per REQ-FE-AUTH-007.

### REQ-FE-AUTH-004: Token Storage and Auto-Refresh
**Priority:** P0
**Tasks:** M01-FE-04

`auth.js` SHALL manage token lifecycle as follows.

**Storage:**
- `accessToken`: held as a module-level JavaScript variable only. Never written to `localStorage`, `sessionStorage`, or any cookie.
- `refreshToken`: written to `localStorage` under key `learnfyra_refresh_token`. Persists across browser sessions.
- `userId`, `role`, `name`: written to `localStorage` under key `learnfyra_user` as a JSON string. Used for UI rendering only and SHALL never be used for security decisions.

**Auto-refresh:**
- On every page load, if `learnfyra_refresh_token` is present in `localStorage`, `auth.js` SHALL call `POST /api/auth/refresh` before any protected API call is allowed.
- A proactive refresh timer SHALL be set for `(expiresIn - 60)` seconds (default: fires at 59 minutes) to call `POST /api/auth/refresh`.
- If `POST /api/auth/refresh` returns 401, `auth.js` SHALL call `clearSession()` (see below) and redirect to `/login.html`.

**Exported interface:**
- `getAccessToken()` — returns the current in-memory access token string, or `null`.
- `getCurrentUser()` — returns `{ userId, role, name }` from `localStorage`, or `null`.
- `isAuthenticated()` — returns `true` if an in-memory access token is present.
- `getAuthHeaders()` — returns `{ Authorization: 'Bearer <token>' }`.
- `clearSession()` — removes `learnfyra_refresh_token` and `learnfyra_user` from `localStorage`, nulls the in-memory token.
- `requireAuth()` — calls `isAuthenticated()`; if `false`, saves `window.location.href` to `sessionStorage` under `post_login_redirect` and redirects to `/login.html`.

### REQ-FE-AUTH-005: Protected Route Guard
**Priority:** P0
**Tasks:** M01-FE-04

Every HTML page that requires authentication SHALL invoke `requireAuth()` at the top of its page-initialization script before any protected content is rendered or any authenticated API call is made. Pages that are always public and SHALL NOT call `requireAuth()`: `index.html` (worksheet generator — guest mode allowed), `login.html`, `register.html`, and `solve.html` (guest solve allowed).

After a successful login, `auth.js` SHALL read `post_login_redirect` from `sessionStorage`, clear it, and redirect to that URL. If `post_login_redirect` is absent, fall through to the role-based route in REQ-FE-AUTH-007.

### REQ-FE-AUTH-006: Role-Based Post-Login Redirect
**Priority:** P1
**Tasks:** M01-FE-01, M01-FE-02

After any successful authentication, `auth.js` SHALL route the user based on the `role` field in the token response:
- `student` → `/index.html`
- `teacher` → `/index.html`
- `parent` → `/index.html` (fallback until M05 dashboard page exists)
- `admin` → `/index.html` (fallback until M07 admin console exists)

The `post_login_redirect` value in `sessionStorage` takes precedence over role-based routing when present.

### REQ-FE-AUTH-007: Logout UI
**Priority:** P1
**Tasks:** M01-FE-05

Every authenticated page's navigation SHALL include a "Sign Out" button or link. Activating it SHALL:
1. Call `POST /api/auth/logout` with the `Authorization: Bearer <token>` header.
2. Call `clearSession()` regardless of the API response (network failures SHALL NOT prevent local logout).
3. Redirect to `/login.html`.

### REQ-FE-AUTH-008: Environment-Aware Configuration Injection
**Priority:** P0
**Tasks:** M01-FE-03

`auth.js` SHALL NOT contain any hardcoded Cognito URLs, client IDs, or redirect URIs. All environment-specific values SHALL be read from `window.LEARNFYRA_CONFIG`, which is embedded into the `<head>` of each HTML page by the CI/CD deployment step. The config object SHALL include at minimum: `cognitoAuthorizeUrl`, `clientId`, `redirectUri`, and `apiBaseUrl`.

---

## Acceptance Criteria

### AC-FE-AUTH-001: Email Login Happy Path
**Given** a registered user is on `login.html`
**When** they enter correct email and password and click "Sign In"
**Then** `POST /api/auth/token` is called with `{ provider: "email", email, password }`, the `accessToken` is held in memory, the `refreshToken` is stored in `localStorage`, and the browser redirects to the role-appropriate page within 2 seconds.

### AC-FE-AUTH-002: Invalid Credentials Display
**Given** a user on `login.html` enters a wrong password
**When** `POST /api/auth/token` returns 401 with code `INVALID_CREDENTIALS`
**Then** the message "Incorrect email or password." appears inline below the form, the password field is cleared, and no redirect occurs.

### AC-FE-AUTH-003: Google PKCE Redirect Contains Challenge
**Given** a user clicks "Sign in with Google" on `login.html`
**When** the click handler runs
**Then** a `codeVerifier` is stored in `sessionStorage` under `pkce_verifier`, and the browser is redirected to the Cognito Hosted UI with `code_challenge` and `code_challenge_method=S256` present in the URL query string.

### AC-FE-AUTH-004: Google OAuth Callback Completes Token Exchange
**Given** the Cognito Hosted UI redirects back to the redirect URI with an authorization `code`
**When** `auth.js` processes the callback
**Then** `codeVerifier` is read from `sessionStorage`, `POST /api/auth/token` is called with `{ provider: "google", code, codeVerifier }`, `pkce_verifier` is deleted from `sessionStorage`, and on a 200 response the user is redirected to their dashboard.

### AC-FE-AUTH-005: Auto-Refresh Runs on Page Load
**Given** a user has a valid `learnfyra_refresh_token` in `localStorage` and opens a new tab
**When** `auth.js` initializes
**Then** `POST /api/auth/refresh` is called before any protected API request, and on a 200 response the in-memory `accessToken` is populated without any user interaction.

### AC-FE-AUTH-006: Expired Refresh Token Forces Re-Login
**Given** a user's refresh token has expired
**When** `POST /api/auth/refresh` returns 401 with code `INVALID_REFRESH_TOKEN`
**Then** `clearSession()` is called, `localStorage` no longer contains `learnfyra_refresh_token` or `learnfyra_user`, and the browser is on `/login.html`.

### AC-FE-AUTH-007: Protected Page Redirect
**Given** a user with no token in `localStorage` navigates directly to a protected page
**When** `requireAuth()` runs
**Then** the original URL is saved in `sessionStorage` as `post_login_redirect` and the browser is immediately redirected to `/login.html` before any protected content renders.

### AC-FE-AUTH-008: Post-Login Redirect Restores Original Destination
**Given** a user was redirected to `login.html` from a protected page URL `/dashboard.html`
**When** they successfully authenticate
**Then** they are sent to `/dashboard.html`, not the default dashboard for their role.

### AC-FE-AUTH-009: Role Selector on Registration
**Given** a new user on `register.html` selects role "Teacher"
**When** registration completes and the user is logged in
**Then** the resulting JWT `role` claim is `teacher` and the user is redirected to the teacher destination.

### AC-FE-AUTH-010: Admin Role Absent from Registration
**Given** a user inspects the role selector on `register.html`
**When** all options are rendered
**Then** the "Admin" option does not exist in the DOM and cannot be submitted.

### AC-FE-AUTH-011: Logout Clears Storage Regardless of API Failure
**Given** an authenticated user clicks "Sign Out" and the `POST /api/auth/logout` call fails due to a network error
**When** the error is caught
**Then** `clearSession()` is still called, `localStorage` is cleared of auth keys, and the browser is on `/login.html`.

### AC-FE-AUTH-012: AWS Deployment — Auth Pages Accessible via CloudFront
**Given** the CI/CD deploy workflow runs for any environment
**When** `aws s3 sync frontend/ s3://learnfyra-{env}-s3-frontend/ --delete` completes
**Then** `https://web.{env}.learnfyra.com/login.html` returns HTTP 200 with `Content-Type: text/html`, and the embedded `window.LEARNFYRA_CONFIG` contains the correct `cognitoAuthorizeUrl` for that environment.

### AC-FE-AUTH-013: PKCE Code Verifier Not Persisted After Use
**Given** the Google OAuth callback has been processed
**When** `auth.js` completes the token exchange
**Then** `sessionStorage` does NOT contain a `pkce_verifier` key.

### AC-FE-AUTH-014: Rate Limit Error — Submit Button Disabled
**Given** a user receives a 429 `RATE_LIMIT_EXCEEDED` response
**When** the error is displayed
**Then** the submit button is disabled for 60 seconds and the message "Too many attempts. Please wait 60 seconds." is visible.

### COPPA Acceptance Criteria (new)

### AC-FE-AUTH-015: Age Gate Displays First
**Given** a new visitor navigates to `register.html`
**When** the page loads
**Then** an age gate ("Are you under 13?") is the first and only interactive element visible — no name, email, or password fields are rendered.

### AC-FE-AUTH-016: Age Gate Cannot Be Bypassed
**Given** a visitor is on the age gate step of `register.html`
**When** they attempt to proceed without selecting an age option (e.g., via URL manipulation or form injection)
**Then** no registration form is rendered and no API calls are made.

### AC-FE-AUTH-017: Under-13 Flow Shows Minimal Fields Only
**Given** a visitor selects "Yes, I am under 13"
**When** the form updates
**Then** only two fields are shown: parent email (required) and nickname (optional). No email, password, Google sign-in, or role selector appears.

### AC-FE-AUTH-018: Under-13 Submission Does Not Create Account
**Given** a child enters a parent email and submits
**When** `POST /api/auth/child-request` returns 202
**Then** no token is stored in localStorage or memory, no redirect occurs, and a message says "We sent an email to your parent."

### AC-FE-AUTH-019: Consent Page Displays Data Practices
**Given** a parent clicks the consent link in their email
**When** `consent.html` loads with a valid token
**Then** the page displays: what data is collected, how it is used, parent rights under COPPA, and a link to the Privacy Policy.

### AC-FE-AUTH-020: Consent Page Requires Affirmative Action
**Given** a parent is on the consent page
**When** they have not clicked the "I Consent" button
**Then** no account creation or data collection occurs — the consent checkbox (if any) is NOT pre-checked.

### AC-FE-AUTH-021: Parent Dashboard Lists Children
**Given** a parent is logged in and navigates to `parent-dashboard.html`
**When** `GET /api/auth/children` returns a list
**Then** each child is shown with name, creation date, last active date, and action buttons.

### AC-FE-AUTH-022: Child Account Deletion Requires Confirmation
**Given** a parent clicks "Delete Account" for a child on the Parent Dashboard
**When** the confirmation dialog appears
**Then** the dialog clearly states that deletion is permanent and includes the child's name, and deletion only proceeds after explicit confirmation.

### AC-FE-AUTH-023: Child Session Starts with Scoped Token
**Given** a parent clicks "Start Session" for a child
**When** `POST /api/auth/child-session` returns 200
**Then** the page redirects to `index.html` with a scoped child token that has `ageGroup: under13` and limited permissions.

### AC-FE-AUTH-024: Expired Consent Token Shows Clear Message
**Given** a parent clicks a consent link that has expired (72+ hours)
**When** `GET /api/auth/consent/:token` returns 404
**Then** the page shows "This consent link has expired. Your child can request a new one." with no form fields.

---

## Local Development Requirements

This section applies before any AWS work begins. All acceptance criteria above MUST pass on `http://localhost:3000` before any CloudFront or S3 deployment is attempted.

### Local Runtime Control
- `APP_RUNTIME=local` in `.env` switches all adapters to local mode.
- `LOCAL_JWT_SECRET` in `.env` is used by M01-BE-08 (already done) in place of Cognito token verification. `auth.js` does not need to know about this — it only calls the API.
- Local API base URL is `http://localhost:3000`, served by Express `server.js`.

### Configuration Injection — Local vs AWS
`auth.js` reads all environment-specific values from `window.LEARNFYRA_CONFIG`. The injection mechanism differs by environment:

- **Local (`APP_RUNTIME=local`):** `server.js` injects a `<script>` block into every served HTML response:
  ```
  window.LEARNFYRA_CONFIG = {
    apiBase: 'http://localhost:3000',
    cognitoAuthorizeUrl: '',
    clientId: 'local',
    redirectUri: 'http://localhost:3000'
  };
  ```
  When `cognitoAuthorizeUrl` is empty, the "Sign in with Google" button SHALL be hidden or replaced with a "Local dev: Google OAuth not available" notice. This prevents broken redirects during local development.

- **AWS (dev/staging/prod):** `window.LEARNFYRA_CONFIG` is injected by the CI/CD pipeline (DevOps task — see Open Questions item 3). `cognitoAuthorizeUrl` is the actual Cognito Hosted UI URL for the environment.

### Google OAuth Redirect URI
- Local redirect URI: `http://localhost:3000` — already configured in Google Cloud Console.
- `auth.js` reads `window.LEARNFYRA_CONFIG.redirectUri` for all redirect URI values. No hardcoding.
- The OAuth callback handler in `auth.js` detects the authorization `code` query parameter on page load. This works on both `http://localhost:3000` (served by Express) and on the CloudFront URL, because both serve the same `login.html` or dedicated callback page.
- When `APP_RUNTIME=local`, Express `server.js` serves `login.html` (or the callback page) at `GET /` and `GET /login.html` so that the OAuth redirect to `http://localhost:3000` lands on a page that can process the `?code=` parameter.

### DynamoDB Local — Not Required for M01 Frontend
M01 Frontend does not interact with DynamoDB directly. The backend auth handlers (already done) handle DynamoDB via the local adapter when `APP_RUNTIME=local`. No DynamoDB setup is required before M01-FE implementation starts.

### Local Test Sequence
Before any AWS work begins, verify the following sequence on `http://localhost:3000`:
1. Open `http://localhost:3000/login.html` — login form renders, no errors in console.
2. Submit email/password — `POST http://localhost:3000/api/auth/token` returns 200, `learnfyra_refresh_token` present in `localStorage`, redirect to `index.html`.
3. Open a protected page — `requireAuth()` redirects to `/login.html` with `post_login_redirect` set in `sessionStorage`.
4. After login, verify redirect returns to the originally requested page.
5. Click "Sign Out" — `clearSession()` called, `localStorage` cleared, redirected to `/login.html`.
6. Simulate 401 on refresh — `clearSession()` called, user on `/login.html`.

### Frontend Template Note
**Awaiting UI template from product owner — do not implement M01-FE-01 through M01-FE-05 until UI template is received.**

---

## AWS Services Involved

| Service | Role |
|---|---|
| S3 (`learnfyra-{env}-s3-frontend`) | Hosts `login.html`, `register.html`, `js/auth.js`, `css/auth.css` |
| CloudFront | Delivers static auth pages over HTTPS with HSTS; CDK task CDK-004 already deployed |
| Cognito Hosted UI | Handles Google consent screen, issues authorization code; CDK-005 already deployed |
| API Gateway | Routes `POST /api/auth/token`, `POST /api/auth/refresh`, `POST /api/auth/logout`; CDK-003 already deployed |
| Lambda (`learnfyra-auth-{env}`) | Processes all token exchange calls; M01-BE-03 through M01-BE-08 already done |
| WAF | Rate-limits `POST /api/auth/token` at 10 req/min/IP; already configured |

---

## Out of Scope
- Magic link (passwordless email) login — deferred to Phase 2.
- "Remember me" toggle — refresh token persistence is always on in Phase 1.
- Social login providers other than Google — Phase 2.
- Password reset / forgot password flow — not in the frozen auth-api.md contracts; requires a new endpoint.
- Admin console authentication UI — provisioned out-of-band only.
- Two-factor authentication — Phase 2.
- In-app notification for parent-child link confirmation — email handled by M01-BE-07.
- Individual child login codes (children log in via parent session in Phase 1) — Phase 2.
- Credit card or government ID verification for parental consent — Phase 2 (Email Plus method in Phase 1).
- Child session daily time limits (configurable by parent) — Phase 2.
- FERPA compliance for teacher-managed student data — separate legal review needed.

---

## Dependencies

| Dependency | Status |
|---|---|
| M01-BE-01 through M01-BE-08 (auth backend handlers) | DONE |
| `04-api-contracts/auth-api.md` (frozen RC-BE-01) | FROZEN |
| CDK-002 (S3 frontend bucket) | DONE |
| CDK-003 (API Gateway) | DONE |
| CDK-004 (CloudFront) | DONE |
| CDK-005 (Cognito User Pool + Hosted UI) | DONE |
| `window.LEARNFYRA_CONFIG` injection in CI/CD | TODO — DevOps must implement before M01-FE-03 |
| UI template from product owner | TODO — blocks all M01-FE tasks |

---

## Open Questions

1. The frozen `auth-api.md` documents `POST /api/auth/token` for token exchange but does not document a Cognito sign-up endpoint. Does `register.html` call Cognito's hosted UI sign-up page, or call the Cognito Identity SDK directly (`signUp`), or is a new `POST /api/auth/register` endpoint needed? This must be decided before task M01-FE-02 begins.
2. The OAuth callback destination: is it handled on `login.html` itself (via URL `?code=` query string detection), or on a dedicated `frontend/callback.html`? This determines the `redirect_uri` registered in Cognito and Google Cloud Console and must be decided before task M01-FE-03 begins.
3. `window.LEARNFYRA_CONFIG` injection mechanism: embedded by the CI/CD pipeline as a generated `config.js` file included in each HTML page, or injected by a CloudFront Function? This is a DevOps decision that blocks M01-FE-03 and M01-FE-08.
4. Should the "Sign Out" button appear on `solve.html` (guest-accessible)? Clarification needed on which pages conditionally show auth UI vs always show it.
5. **(COPPA)** Should the age gate persist the response in sessionStorage to avoid re-asking on page reload during registration? — **Decision: Yes, persist in sessionStorage. Store 'under13' or '13plus' in sessionStorage during registration flow.**
6. **(COPPA)** Should `consent.html` support the parent creating an account via Google OAuth as part of the consent flow? — **Decision: Yes, support Google OAuth on consent page. One-step consent + account creation reduces friction.**
7. **(COPPA)** Should the Parent Dashboard be a separate page or a section within a unified dashboard? — **Decision: Separate page (`parent-dashboard.html`). Cleaner separation of concerns.**
8. **(COPPA)** Should child session tokens be stored in sessionStorage rather than localStorage? — **Decision: Yes, child tokens in sessionStorage. Cleared when tab/browser closes. More secure — prevents persistent child access without parent starting a new session.**
