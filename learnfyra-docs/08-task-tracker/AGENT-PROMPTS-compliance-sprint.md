# Learnfyra — Agent Prompts for Compliance Sprint

**Document ID:** LFR-PROMPTS-COMPLIANCE-001
**Version:** 1.0
**Date:** April 3, 2026
**Usage:** Copy-paste one prompt at a time into Claude Code. Execute sequentially.
**Repository:** https://github.com/arbabazmi/learnfyra

---

## How to Use This Document

1. Execute prompts in order (T-1.1 → T-1.2 → ... → T-5.6)
2. After each prompt, verify the acceptance criteria before moving to the next
3. Run `npm test` after each task to catch regressions
4. Each prompt is self-contained — it includes all context the agent needs

---

## PHASE 1 — Age Gate & User Schema

---

### PROMPT T-1.1 — Age Utility Module

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create a new file `src/utils/ageUtils.js` with three exported functions for COPPA age compliance.

ARCHITECTURE CONTEXT:
- Project uses ES modules (type: "module" in package.json)
- All source files use `export` / `import` syntax
- No TypeScript in backend — pure JavaScript with JSDoc

CREATE FILE: src/utils/ageUtils.js

REQUIREMENTS:

1. `calculateAge(dateOfBirth)` — takes a string "YYYY-MM-DD", returns integer age.
   - Throw Error('Invalid date of birth') if input is not a valid date.
   - Handle edge case: if birthday is today, the person just turned that age.
   - Use UTC-safe comparison (avoid timezone bugs).

2. `getAgeGroup(age)` — takes integer age, returns string:
   - age < 13 → 'child'
   - 13 <= age < 18 → 'teen'
   - age >= 18 → 'adult'

3. `validateDateOfBirth(dateString)` — takes a string, returns object:
   - Validates format is YYYY-MM-DD (regex)
   - Validates it parses to a real date
   - Validates age >= 5 (minimum for Grade 1)
   - Validates age <= 120 (sanity)
   - Validates date is not in the future
   - Returns { valid: true, age: number, ageGroup: string } on success
   - Returns { valid: false, error: string } on failure

Add a JSDoc @file header: "@file src/utils/ageUtils.js" and "@description Age calculation and classification for COPPA compliance".

CONSTRAINTS:
- No external dependencies — use only built-in Date
- No PII handling — this is a pure calculation utility
- Export all three functions as named exports

VERIFY: After creating the file, run `node --check src/utils/ageUtils.js` to confirm no syntax errors.
```

---

### PROMPT T-1.2 — User Schema Expansion

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Expand the user record schema to support age verification and parental consent fields.

ARCHITECTURE CONTEXT:
- User records are stored in DynamoDB (prod) and JSON files via localDbAdapter (dev)
- DynamoDB is schemaless — no migration needed, just add fields
- The mock auth adapter at `src/auth/mockAuthAdapter.js` handles local user creation
- User creation function is `createUser({ email, password, role, displayName })`
- Public user responses strip `passwordHash` — we need to also strip new sensitive fields

MODIFY FILE: src/auth/mockAuthAdapter.js

CHANGES:

1. Update `createUser` to accept additional optional params:
   `{ email, password, role, displayName, dateOfBirth, ageGroup, parentEmail }`

2. In the user object stored to DB, add these fields:
   - dateOfBirth: dateOfBirth || null
   - ageGroup: ageGroup || 'adult'
   - accountStatus: (ageGroup === 'child') ? 'pending_consent' : 'active'
   - consentStatus: (ageGroup === 'child') ? 'pending' : 'not_required'
   - parentEmail: parentEmail || null

3. Find the function or pattern that strips passwordHash from returned user objects (likely a destructure or filter). Add `dateOfBirth` and `parentEmail` to the strip list — these are sensitive fields that must NEVER appear in API responses.

4. Ensure backward compatibility: existing callers that don't pass the new fields should get defaults (null for dateOfBirth/parentEmail, 'adult' for ageGroup, 'active' for accountStatus, 'not_required' for consentStatus).

CONSTRAINTS:
- Do NOT modify the function's behavior for existing callers — only extend it
- Do NOT add dateOfBirth or parentEmail to JWT token claims (they are not used in tokenUtils.js — verify this)
- Read the file first to understand the existing patterns before modifying

VERIFY:
- Run `node --check src/auth/mockAuthAdapter.js`
- Run `npm test` to ensure no existing tests break
```

---

### PROMPT T-1.3 — Registration Age Gate Logic

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Modify the registration endpoint to require dateOfBirth, calculate age, and block under-13 users from receiving a token (routing them to parental consent instead).

ARCHITECTURE CONTEXT:
- Auth handler is at `backend/handlers/authHandler.js`
- Registration is handled by `handleRegister(body)` function
- Current required fields: { email, password, role, displayName }
- The handler returns Lambda-compatible responses: { statusCode, headers: corsHeaders, body: JSON.stringify(...) }
- corsHeaders are defined at the top of the file
- The adapter's `createUser()` was already updated (T-1.2) to accept dateOfBirth, ageGroup, parentEmail
- Age utility is at `src/utils/ageUtils.js` with `validateDateOfBirth(dateString)`

MODIFY FILE: backend/handlers/authHandler.js

CHANGES:

1. Add import at top of file:
   `import { validateDateOfBirth } from '../../src/utils/ageUtils.js';`
   (Adjust relative path based on actual file location)

2. In `handleRegister(body)`, after existing field validation (email, password, role, displayName), add:

   a. Validate dateOfBirth is present — if missing, return 400:
      `{ error: 'dateOfBirth is required' }`

   b. Call `validateDateOfBirth(body.dateOfBirth)` — if invalid, return 400 with the error message.

   c. Pass `ageGroup` to `adapter.createUser({ ...body, ageGroup })`

   d. If ageGroup === 'child':
      - Do NOT call adapter.generateToken() or signToken()
      - Return 200 with: `{ userId: user.userId, accountStatus: 'pending_consent', requiresConsent: true, message: 'Parental consent required before account activation.' }`

   e. If ageGroup is 'teen' or 'adult':
      - Continue with existing token generation and response (no changes)

3. Do NOT modify any other handler functions (handleLogin, handleGuest, etc.)

CONSTRAINTS:
- dateOfBirth must NOT appear in the response body (it's stored but never returned)
- dateOfBirth must NOT be added to JWT claims
- The 'child' path must NOT issue any token — the client cannot access protected routes
- Do NOT break the OPTIONS/CORS preflight handler

VERIFY:
- Run `node --check backend/handlers/authHandler.js`
- Run `npm test` — existing tests should still pass (they don't send dateOfBirth, so they should get 400 now — if existing tests fail because they don't include dateOfBirth, update them to include a valid adult dateOfBirth like '1990-01-15')
```

---

### PROMPT T-1.4 — OAuth Age Verification Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create a PATCH /api/auth/verify-age endpoint for Google OAuth users who need to provide their date of birth after first login. Modify the OAuth callback to redirect new users to the age verification page.

ARCHITECTURE CONTEXT:
- Auth handler: `backend/handlers/authHandler.js`
- OAuth callback handler: `handleOAuthCallback(provider, queryStringParameters)` in same file
- Currently, new OAuth users get accountStatus='active' and redirect to `/auth/callback?token=...&user=...`
- The frontend at `learnfyra-app/src/pages/AuthCallbackPage.tsx` reads these params
- Token signing: `signToken({ sub, email, role }, expiresIn)` from `src/auth/tokenUtils.js`
- Auth middleware: `validateToken(event)` in `backend/middleware/authMiddleware.js`
- Express routes are wired in `server.js`

MODIFY FILES:
1. `backend/handlers/authHandler.js` — add handleVerifyAge, modify handleOAuthCallback for new users
2. `server.js` — add PATCH /api/auth/verify-age route
3. `backend/middleware/authMiddleware.js` — add check to reject limited-scope tokens on normal endpoints

CHANGES:

1. In authHandler.js, add new function `handleVerifyAge(body, decoded)`:
   - Import validateDateOfBirth from ageUtils
   - Validate body.dateOfBirth
   - Fetch user by decoded.sub
   - If user already has a dateOfBirth set, return 400 "Age already verified" (prevent replay)
   - Update user: dateOfBirth, ageGroup, accountStatus, consentStatus
   - If child: return { accountStatus: 'pending_consent', requiresConsent: true }
   - If teen/adult: sign a new FULL token (no scope limit), return { accountStatus: 'active', token }

2. In handleOAuthCallback, for NEW users (first-time):
   - Set accountStatus to 'pending_age_verification' (instead of 'active')
   - Sign a limited-scope token: signToken({ sub, email, role, scope: 'age_verification_only' }, '1h')
   - Redirect to: `${FRONTEND_URL}/auth/age-verification?token=${limitedToken}&user=${encodeURIComponent(JSON.stringify(userObj))}`
   - For RETURNING users (already have dateOfBirth): continue with existing redirect to /auth/callback

3. In authMiddleware.js `validateToken`:
   - After verifying the JWT, check if decoded.scope === 'age_verification_only'
   - If yes, AND the request path is NOT '/api/auth/verify-age', throw 403 "Age verification required"
   - This ensures limited-scope tokens cannot access /api/dashboard, /api/generate, etc.

4. In server.js, add:
   ```javascript
   app.patch('/api/auth/verify-age', async (req, res) => {
     const decoded = await validateToken(/* construct event from req */);
     const result = await handleVerifyAge(req.body, decoded);
     res.status(result.statusCode).set(result.headers).json(JSON.parse(result.body));
   });
   ```
   Follow the existing pattern in server.js for how other auth routes are wired.

CONSTRAINTS:
- Limited-scope token MUST be rejected by all endpoints except /api/auth/verify-age
- Once DOB is set, /api/auth/verify-age must reject further calls (prevent manipulation)
- Do NOT break existing OAuth flow for returning users

VERIFY:
- Run `node --check backend/handlers/authHandler.js`
- Run `node --check backend/middleware/authMiddleware.js`
- Run `node --check server.js`
- Run `npm test`
```

---

### PROMPT T-1.5 — DOB Field in AuthModal Signup

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend.

TASK: Add a Date of Birth selector (Month/Day/Year dropdowns) to the email signup form in AuthModal, and handle the consent-required response.

ARCHITECTURE CONTEXT:
- Frontend is in `learnfyra-app/`
- AuthModal: `learnfyra-app/src/components/AuthModal.tsx`
- Email auth library: `learnfyra-app/src/lib/emailAuth.ts`
- The signup step is 'email-signup' in AuthModal
- Current signup fields: displayName, email, password, confirmPassword, role
- signUp() in emailAuth.ts calls POST /api/auth/register
- Design system: Tailwind CSS 4, theme vars from src/styles/theme.css
- Colors: primary #3D9AE8 (blue), secondary #6DB84B (green), accent #F5C534 (yellow)
- Font: Nunito, border-radius: 10px base

STEP 1 — Create shared DateOfBirthSelect component:

CREATE FILE: learnfyra-app/src/components/ui/DateOfBirthSelect.tsx

Props: { month, day, year, onMonthChange, onDayChange, onYearChange, error?: string }

- Three styled <select> elements in a row (Month, Day, Year)
- Month: "Month" placeholder + January through December
- Day: "Day" placeholder + 1 through 28/29/30/31 (adjust dynamically based on selected month+year for leap year correctness)
- Year: "Year" placeholder + (currentYear - 5) down to (currentYear - 120) — most recent first
- Match the existing input styling in AuthModal (read it to see className patterns for inputs)
- Show error message below if error prop is provided
- Do NOT display calculated age anywhere

STEP 2 — Modify AuthModal.tsx:

- Add state: dobMonth, dobDay, dobYear (strings, initially '')
- In the 'email-signup' step JSX, add the DateOfBirthSelect BEFORE the email field
- Add label: "Date of Birth"
- Client validation: all three dropdowns must be filled before form submit is enabled
- On form submit, construct dateOfBirth string: `${dobYear}-${dobMonth.padStart(2,'0')}-${dobDay.padStart(2,'0')}`
- Pass dateOfBirth to signUp()
- Handle response: if result.requiresConsent is true:
  - Store result.userId in sessionStorage key 'lf_pending_child_id'
  - Navigate to '/auth/consent-pending' using useNavigate()
  - Call onClose() to close the modal
  - Return early (don't call signIn)
- If no requiresConsent (adult/teen): continue with existing signIn + navigate to /dashboard flow

STEP 3 — Modify emailAuth.ts:

- Update signUp function signature to accept dateOfBirth
- Include dateOfBirth in the POST body to /api/auth/register

CONSTRAINTS:
- Do NOT store DOB in localStorage (only sessionStorage for childUserId, and only the ID, not the DOB)
- Do NOT display calculated age to the user
- Do NOT modify any other AuthModal steps (role, signin, etc.)
- Preserve all existing validation (password strength, email format, etc.)

VERIFY:
- Build: cd learnfyra-app && npm run build (must succeed with no TS errors)
- Visual: the DOB dropdowns should match the existing form's styling
```

---

### PROMPT T-1.6 — AgeVerificationPage for OAuth

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend.

TASK: Create a new page at /auth/age-verification for Google OAuth users who need to provide their DOB on first login.

ARCHITECTURE CONTEXT:
- Frontend: learnfyra-app/
- Router: learnfyra-app/src/App.tsx uses React Router 7 with <Route> elements
- Auth context: useAuth() from learnfyra-app/src/contexts/AuthContext.tsx
- Auth helpers: getAuthToken() from learnfyra-app/src/lib/auth.ts
- API base URL: import { apiUrl } from env config (check existing pages for the pattern)
- DateOfBirthSelect component was created in T-1.5 at learnfyra-app/src/components/ui/DateOfBirthSelect.tsx
- Logo component: learnfyra-app/src/components/ui/Logo.tsx

CREATE FILE: learnfyra-app/src/pages/AgeVerificationPage.tsx

IMPLEMENTATION:
- Centered layout with Learnfyra Logo at top
- Heading: "One more step!"
- Subheading: "Please enter your date of birth to continue."
- DateOfBirthSelect component for DOB input
- "Continue" button (primary variant)
- On submit: PATCH /api/auth/verify-age with { dateOfBirth } and Authorization header
- On success with token (adult/teen): call auth.signIn(token, user), navigate to /dashboard
- On requiresConsent (child): store userId in sessionStorage, navigate to /auth/consent-pending
- On error: display error message below form
- If no token in URL params or localStorage, redirect to / (page requires a limited-scope token)

MODIFY FILE: learnfyra-app/src/App.tsx
- Add route: <Route path="/auth/age-verification" element={<AgeVerificationPage />} />
- Import AgeVerificationPage

CONSTRAINTS:
- Page must work with the limited-scope token from OAuth callback
- DOB must NOT appear in URL parameters
- Follow existing page patterns in the codebase (check DashboardPage or SettingsPage for layout/style patterns)

VERIFY:
- cd learnfyra-app && npm run build (no TS errors)
```

---

### PROMPT T-1.7 — Unit Tests for Age Gate

```
You are working on Learnfyra, a Node.js 18+ ESM project with Jest for testing.

TASK: Write unit tests for the age utility module and the age-gated registration flow.

ARCHITECTURE CONTEXT:
- Test runner: Jest with ESM (run via: node --experimental-vm-modules node_modules/jest-cli/bin/jest.js)
- Test location: tests/unit/
- Existing test pattern: see any file in tests/unit/ for import style and mocking patterns
- Age utils: src/utils/ageUtils.js
- Registration handler: backend/handlers/authHandler.js — handleRegister function
- Auth adapter mock pattern: check existing tests in tests/unit/ for how the DB adapter is mocked

CREATE FILE: tests/unit/ageUtils.test.js

TEST CASES:
1. calculateAge with a DOB that makes someone 10 → returns 10
2. calculateAge with a DOB that makes someone exactly 13 today → returns 13
3. calculateAge with a DOB that makes someone 12 (birthday tomorrow) → returns 12
4. calculateAge with invalid string → throws 'Invalid date of birth'
5. getAgeGroup(12) → 'child', getAgeGroup(13) → 'teen', getAgeGroup(17) → 'teen', getAgeGroup(18) → 'adult'
6. validateDateOfBirth with valid adult DOB → { valid: true, age: N, ageGroup: 'adult' }
7. validateDateOfBirth with future date → { valid: false }
8. validateDateOfBirth with age < 5 → { valid: false }
9. validateDateOfBirth with 'invalid' → { valid: false }
10. validateDateOfBirth with wrong format '01-15-1990' → { valid: false }

CREATE FILE: tests/unit/ageGateRegistration.test.js

TEST CASES (mock the DB adapter, test handleRegister logic):
1. Register with child DOB (e.g., 8 years ago) → 200 + requiresConsent: true, no token
2. Register with adult DOB (e.g., 25 years ago) → 200 + token present
3. Register without dateOfBirth → 400
4. Register with future dateOfBirth → 400
5. Register with invalid dateOfBirth → 400
6. Response body for child does NOT contain 'token' key
7. Response body for child contains accountStatus: 'pending_consent'
8. User stored in DB has correct ageGroup and accountStatus fields

CONSTRAINTS:
- Use dynamic DOB calculation (don't hardcode '2018-01-01' — calculate relative to today)
- Mock DB adapter — no real DynamoDB calls
- Follow existing test file patterns in the project

VERIFY:
- Run: npm test -- tests/unit/ageUtils.test.js (all pass)
- Run: npm test -- tests/unit/ageGateRegistration.test.js (all pass)
```

---

## PHASE 2 — Consent System

---

### PROMPT T-2.1 — ConsentRecords DynamoDB Table

```
You are working on Learnfyra, a Node.js platform with AWS CDK (TypeScript) for infrastructure.

TASK: Add a new DynamoDB table for storing parental consent records. Update both CDK stack and local bootstrap.

ARCHITECTURE CONTEXT:
- CDK stack: infra/cdk/lib/learnfyra-stack.ts
- The stack has a helper method `this.createTable(suffix, pk, sk?, options?)` — read the file to find it
- Existing tables follow pattern: LearnfyraXxx-{env}
- Bootstrap script: scripts/bootstrap-local-db.js — read it to see how tables are created locally
- DB adapter config: src/db/dynamoDbAdapter.js has a TABLE_CONFIG mapping logical names to table names — add entry there too
- Environment variables are added to Lambda functions in the CDK stack

CHANGES:

1. MODIFY: infra/cdk/lib/learnfyra-stack.ts
   - Add a new table using the existing createTable helper:
     - Suffix: 'ConsentRecords'
     - PK: 'consentId' (String)
     - No SK
     - Point-in-time recovery: true (ALWAYS — these are legal compliance records, non-negotiable)
     - TTL attribute: 'expiresAt'
   - Add two GSIs:
     - 'childUserId-index' with PK: childUserId (String)
     - 'parentEmail-index' with PK: parentEmail (String)
   - Add environment variable CONSENT_RECORDS_TABLE_NAME to the auth Lambda function
     (find where other table names are injected and follow the same pattern)

2. MODIFY: scripts/bootstrap-local-db.js
   - Add 'consentrecords' to the tables that get created locally
   - Follow the exact pattern used for other tables in the script

3. MODIFY: src/db/dynamoDbAdapter.js (or wherever TABLE_CONFIG is defined)
   - Add entry: 'consentrecords' mapping to the table name pattern
   - PK: 'consentId'
   - Follow the existing config pattern

CONSTRAINTS:
- Point-in-time recovery MUST be enabled (legal requirement, COPPA 312.10)
- TTL attribute name must be 'expiresAt' (DynamoDB convention)
- Do NOT set removalPolicy to DESTROY on prod — follow existing prod/dev conditional pattern
- Read each file before modifying to understand existing patterns

VERIFY:
- cd infra/cdk && npm run build (TypeScript compiles)
- cd infra/cdk && npx cdk synth (synthesizes without errors)
- npm run db:bootstrap (local tables created, including consentrecords)
```

---

### PROMPT T-2.2 — Consent Store Module

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create a data access module for consent records used by auth handlers.

ARCHITECTURE CONTEXT:
- DB adapter: import { getDbAdapter } from '../db/index.js'
- The adapter exposes: putItem(table, item), getItem(table, id), deleteItem(table, id), queryByField(table, field, value), updateItem(table, id, updates), listAll(table)
- Table logical name: 'consentrecords' (added in T-2.1)
- UUIDs: import { randomUUID } from 'crypto'
- ConsentRecords table schema: consentId (PK), consentToken, childUserId, childEmail, parentEmail, parentName, parentRelationship, status, method, requestedAt, grantedAt, revokedAt, expiresAt (TTL), retainUntil, ipAddress, userAgent, privacyPolicyVersion

CREATE FILE: src/consent/consentStore.js

EXPORT FUNCTIONS:

1. createConsentRequest({ childUserId, childEmail, parentEmail })
   - Generate consentId (UUID) and consentToken (UUID)
   - Set status: 'pending', method: 'email_plus'
   - Set expiresAt: 48 hours from now (Unix seconds)
   - Set requestedAt: ISO-8601 now
   - All other fields: null
   - Set privacyPolicyVersion: '1.0'
   - putItem to DB, return full record

2. getConsentByToken(consentToken)
   - listAll('consentrecords'), filter by consentToken
   - Return first match or null
   - (Note: In production, add a GSI for consentToken. For MVP, scan+filter is acceptable with small dataset)

3. grantConsent(consentId, { parentName, parentRelationship, ipAddress, userAgent })
   - updateItem: status='granted', grantedAt=now, parentName, parentRelationship, ipAddress, userAgent
   - CRITICAL: delete expiresAt field (or set to 3 years from now) so DynamoDB TTL does NOT delete this record
   - Set retainUntil: 3 years from now (Unix seconds)
   - Return updated record

4. denyConsent(consentId)
   - updateItem: status='denied'
   - Delete expiresAt so record is retained for audit
   - Return updated record

5. revokeConsent(childUserId, { reason, revokedBy })
   - Query consentrecords by childUserId (use queryByField or filter)
   - Find the record with status='granted'
   - updateItem: status='revoked', revokedAt=now
   - Return updated record

6. getConsentsByChild(childUserId)
   - queryByField('consentrecords', 'childUserId', childUserId)

7. getConsentsByParent(parentEmail)
   - queryByField('consentrecords', 'parentEmail', parentEmail)

CONSTRAINTS:
- consentToken is a secret (like a password reset token) — never log it
- When consent is granted, the expiresAt TTL MUST be removed/extended so DynamoDB doesn't auto-delete the record
- All functions must work with both localDbAdapter and dynamoDbAdapter
- Add JSDoc @file header

VERIFY:
- node --check src/consent/consentStore.js
```

---

### PROMPT T-2.3 — Request-Consent Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Add POST /api/auth/request-consent endpoint that sends a parental consent email.

ARCHITECTURE CONTEXT:
- Auth handler: backend/handlers/authHandler.js
- Express routes: server.js
- Consent store: src/consent/consentStore.js (createConsentRequest)
- Email sending: nodemailer is in package.json. Check if there's an existing email utility (look at handleForgotPassword in authHandler.js for the email pattern — it likely uses nodemailer)
- DB adapter: used throughout authHandler via adapter or db variable
- corsHeaders: defined at top of authHandler.js
- The frontend URL: process.env.ALLOWED_ORIGIN or process.env.FRONTEND_URL or similar env var

MODIFY FILES:
1. backend/handlers/authHandler.js — add handleRequestConsent(body) function
2. server.js — add POST /api/auth/request-consent route

IMPLEMENTATION for handleRequestConsent(body):

1. Extract childUserId and parentEmail from body
2. Validate both are present — 400 if missing
3. Look up child user by childUserId — 404 if not found
4. Validate child.accountStatus === 'pending_consent' — 400 if not
5. Validate parentEmail format (basic regex) — 400 if invalid
6. Validate parentEmail !== child.email — 400 "Parent and child cannot share the same email"
7. Rate limit: count consent records for this childUserId with requestedAt in last hour. If >= 3, return 429 "Too many consent requests. Try again later."
8. Call createConsentRequest({ childUserId, childEmail: child.email, parentEmail })
9. Update child user's parentEmail field
10. Send email to parentEmail:
    - Use the same nodemailer pattern as handleForgotPassword (read it first)
    - Subject: "Learnfyra — Parental Consent Required for [child.displayName]"
    - Body: Plain text explaining Learnfyra collects email, display name, grade level, worksheet answers, scores. Include consent link: {FRONTEND_URL}/auth/parental-consent?token={consentToken}
    - Do NOT include child's email or DOB in the email
11. Return 200: { consentRequestId: record.consentId, message: 'Consent email sent', expiresAt: ISO-8601 string of 48h from now }

Wire in server.js following the existing route pattern.

CONSTRAINTS:
- This endpoint does NOT require JWT auth (the child has no token — their account is pending)
- But it DOES require a valid childUserId that exists and is in pending_consent state
- Consent token must be UUID v4 (handled by consentStore)
- Email must NOT contain child's DOB, email, or any PII beyond display name

VERIFY:
- node --check backend/handlers/authHandler.js
- node --check server.js
- npm test
```

---

### PROMPT T-2.4 — Verify-Consent Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Add POST /api/auth/verify-consent endpoint called when a parent grants consent.

ARCHITECTURE CONTEXT:
- Auth handler: backend/handlers/authHandler.js
- server.js for route wiring
- Consent store: src/consent/consentStore.js (getConsentByToken, grantConsent)
- Parent links table: 'parentlinks' — existing table, records have { id, parentId, childId, status, linkedAt, updatedAt }
- DB adapter: for updating user records and creating parent links
- IP extraction: from Express req.ip or from Lambda event.requestContext.identity.sourceIp
- User-Agent: from req.headers['user-agent'] or event.headers['User-Agent']

MODIFY FILES:
1. backend/handlers/authHandler.js — add handleVerifyConsent(body, event)
2. server.js — add POST /api/auth/verify-consent route

IMPLEMENTATION for handleVerifyConsent(body, event):

1. Extract consentToken, parentName, parentRelationship from body
2. Validate all three present — 400 if missing
3. Validate parentRelationship is 'parent' or 'legal_guardian' — 400 if not
4. Call getConsentByToken(consentToken)
5. If not found — 404 "Invalid consent token"
6. If record.status !== 'pending' — 409 "Consent already processed"
7. If record.expiresAt < now (Unix seconds) — 410 "Consent link has expired"
8. Extract IP and User-Agent from event/req
9. Call grantConsent(record.consentId, { parentName, parentRelationship, ipAddress, userAgent })
10. Update child user: accountStatus='active', consentStatus='granted'. Also DELETE the pendingExpiresAt field so TTL doesn't delete the now-active user.
11. Create parent-child link in parentlinks table:
    { id: `${parentEmail}#${childUserId}`, parentId: parentEmail, childId: record.childUserId, status: 'active', linkedAt: now, updatedAt: now }
    (Use parentEmail as parentId since parent may not have an account)
12. Return 200: { childUserId: record.childUserId, accountStatus: 'active', message: 'Consent verified. Your child can now use Learnfyra.' }

CONSTRAINTS:
- This endpoint requires NO JWT authentication — the consent token IS the authorization
- The consent token must be single-use (status check at step 6 prevents reuse)
- Capture real IP and User-Agent for the audit trail
- Removing pendingExpiresAt after consent is CRITICAL — without this, DynamoDB TTL will delete the now-active user

VERIFY:
- node --check backend/handlers/authHandler.js
- node --check server.js
- npm test
```

---

### PROMPT T-2.5 — Deny-Consent Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Add POST /api/auth/deny-consent endpoint. When a parent denies consent, the child's pending data is immediately deleted.

ARCHITECTURE CONTEXT:
- Same files as T-2.4
- Consent store: denyConsent(consentId)
- DB adapter: deleteItem('users', userId)

MODIFY FILES:
1. backend/handlers/authHandler.js — add handleDenyConsent(body)
2. server.js — add POST /api/auth/deny-consent route

IMPLEMENTATION:

1. Extract consentToken from body — 400 if missing
2. Call getConsentByToken(consentToken) — 404 if not found
3. If record.status !== 'pending' — 409 "Consent already processed"
4. If expired — 410 "Consent link has expired"
5. Call denyConsent(record.consentId) — marks record as 'denied'
6. Delete the child user: db.deleteItem('users', record.childUserId)
7. Return 200: { message: 'Consent denied. All data for this account has been deleted.' }

CONSTRAINTS:
- No JWT auth required (token-based)
- Consent record is NOT deleted — only its status changes to 'denied' (retained for audit)
- The child user record IS deleted (COPPA: must delete data when consent is denied)

VERIFY: node --check on both files, npm test
```

---

### PROMPT T-2.6 — Consent Email Template

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create an HTML email template for parental consent requests.

ARCHITECTURE CONTEXT:
- Check backend/handlers/authHandler.js handleForgotPassword for existing email patterns
- Nodemailer is already a dependency

CREATE FILE: src/consent/consentEmailTemplate.js

EXPORT: buildConsentEmail({ childDisplayName, consentUrl, denyUrl, privacyPolicyUrl })

RETURNS: { subject: string, html: string, text: string }

EMAIL CONTENT:
- Subject: "Learnfyra — Parental Consent Required for [childDisplayName]"
- Professional, plain-language HTML email
- Learnfyra branding (use #3D9AE8 blue as accent color)
- Body explains:
  - "[childDisplayName] wants to use Learnfyra, an educational worksheet platform."
  - "What we collect:" bullet list (email address for login, display name (first name), grade level, worksheet answers and scores)
  - "What we do NOT do:" bullet list (never sell data, never show ads, never share personal data with AI, data encrypted at all times)
  - "Your rights as a parent:" bullet list (view data, download data, delete account, revoke consent anytime)
- Prominent blue "I Consent" button linking to consentUrl
- Smaller "I Do Not Consent" text link linking to denyUrl
- "Read our full Privacy Policy" link to privacyPolicyUrl
- Footer: "This link expires in 48 hours. If you did not expect this email, you can safely ignore it."
- Plain text fallback version

CONSTRAINTS:
- Do NOT include child's email, DOB, or any data beyond display name
- HTML must be email-client safe (inline styles, table layout, no CSS classes)
- Keep it under 50KB

VERIFY: node --check src/consent/consentEmailTemplate.js
```

---

### PROMPT T-2.7 — ConsentPendingPage (Frontend)

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend in learnfyra-app/.

TASK: Create the consent-pending page shown to children after registration while awaiting parental consent.

ARCHITECTURE CONTEXT:
- Router: App.tsx
- API calls: use fetch with apiUrl from env config (check existing pages)
- Session storage key for child ID: 'lf_pending_child_id' (set during registration)
- Request consent API: POST /api/auth/request-consent body: { childUserId, parentEmail }

CREATE FILE: learnfyra-app/src/pages/ConsentPendingPage.tsx

MODIFY FILE: learnfyra-app/src/App.tsx — add route /auth/consent-pending

IMPLEMENTATION:
- On mount: read 'lf_pending_child_id' from sessionStorage. If missing, redirect to /
- Centered layout with Logo
- Heading: "Almost there!"
- Message: "We sent an email to your parent at p****@email.com" (masked email — if parent email is available, show first char + **** + @ + domain)
- If parent email not available, show generic "Please ask your parent to check their email"
- "Resend Email" button — calls POST /api/auth/request-consent, shows success toast, disabled for 60 seconds after click
- "Use a Different Email" text button — reveals an email input. On submit, calls request-consent with new parentEmail
- Countdown: "This link expires in XX hours" — count down from 48h since registration
- No access to dashboard — this page is the only thing the child can see
- Friendly, kid-appropriate language and colors

CONSTRAINTS:
- Do NOT store or display full parent email
- Do NOT allow navigation to protected routes
- Follow existing page styling patterns (check other pages like SettingsPage for layout patterns)

VERIFY: cd learnfyra-app && npm run build
```

---

### PROMPT T-2.8 — ParentalConsentPage (Frontend)

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend in learnfyra-app/.

TASK: Create the parental consent form page that parents see when they click the consent link in the email.

ARCHITECTURE CONTEXT:
- Router: App.tsx
- This page is visited by parents who may NOT have a Learnfyra account — no auth required
- URL format: /auth/parental-consent?token={consentToken}
- API endpoints:
  - POST /api/auth/verify-consent body: { consentToken, parentName, parentRelationship }
  - POST /api/auth/deny-consent body: { consentToken }

CREATE FILE: learnfyra-app/src/pages/ParentalConsentPage.tsx

MODIFY FILE: learnfyra-app/src/App.tsx — add route /auth/parental-consent

IMPLEMENTATION:

States: 'form' | 'granted' | 'denied' | 'error' | 'expired'

Form state:
- Logo at top
- Heading: "Parental Consent for Learnfyra"
- "Your child wants to use Learnfyra, an educational worksheet platform."
- Section "What we collect:" — bulleted list (email for login, display name first name only, grade level, worksheet answers and scores for progress)
- Section "What we do NOT do:" — bulleted list (never sell data, never show ads, never share personal data with AI, data encrypted)
- Section "Your rights:" — bulleted list (view data anytime, download data, delete account, revoke consent)
- Link: "Read our full Privacy Policy" → /privacy (opens new tab)
- Form fields:
  - "Your Name" text input (required)
  - "Your Relationship" select: Parent / Legal Guardian (required)
  - Checkbox: "I have read the Privacy Policy and consent to Learnfyra collecting the data described above for my child's educational use." (required)
- "I Consent" primary button (disabled until all fields valid)
- "I Do Not Consent" secondary/ghost button
- On "I Consent": POST /api/auth/verify-consent → show granted state
- On "I Do Not Consent": confirm dialog → POST /api/auth/deny-consent → show denied state
- Handle 410 (expired) and 409 (already processed) errors

Granted state: Green checkmark + "Consent granted! Your child can now use Learnfyra."
Denied state: "Consent denied. All account data has been deleted."
Error/Expired state: Appropriate message + "Contact support@learnfyra.com"

CONSTRAINTS:
- No auth required — page must work for unauthenticated visitors
- Token from URL is the sole authorization
- Must be mobile-responsive (parents will likely open email on phone)
- Professional, trustworthy appearance

VERIFY: cd learnfyra-app && npm run build
```

---

### PROMPT T-2.9 — Pending Account TTL Cleanup

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform with AWS CDK.

TASK: Add automatic cleanup of child accounts that never receive parental consent after 48 hours.

ARCHITECTURE CONTEXT:
- CDK stack: infra/cdk/lib/learnfyra-stack.ts
- The Users table is already defined — find it (likely named with 'Users' suffix)
- DynamoDB TTL: setting a numeric Unix timestamp attribute, DynamoDB auto-deletes items when the timestamp passes
- authHandler.js handleRegister: creates child users with accountStatus='pending_consent'

CHANGES:

1. MODIFY: backend/handlers/authHandler.js
   - In handleRegister, when ageGroup === 'child', add to the user object:
     pendingExpiresAt: Math.floor(Date.now() / 1000) + (48 * 60 * 60)
   - This is a Unix timestamp 48 hours in the future

2. MODIFY: infra/cdk/lib/learnfyra-stack.ts
   - Find the Users table definition
   - Add TTL configuration: timeToLiveAttribute: 'pendingExpiresAt'
   - (If using the createTable helper, check if it supports TTL options. If not, add it after creation with usersTable.addTimeToLive or the CDK equivalent)

3. MODIFY: backend/handlers/authHandler.js (or wherever verify-consent is)
   - When consent is granted (handleVerifyConsent), REMOVE the pendingExpiresAt field from the user record:
     await db.updateItem('users', childUserId, { pendingExpiresAt: null, accountStatus: 'active' })
   - This prevents DynamoDB from deleting the now-active user

4. OPTIONAL for local dev: In server.js startup, add a simple cleanup:
   - On server start, scan users where accountStatus='pending_consent' and createdAt < 48h ago
   - Delete those users
   - Log: "Cleaned up N expired pending accounts"

CONSTRAINTS:
- ONLY pending_consent accounts have pendingExpiresAt — active accounts do NOT
- When consent is granted, pendingExpiresAt MUST be removed
- TTL deletion is eventually consistent (can take up to 48h after expiry) — this is acceptable

VERIFY:
- cd infra/cdk && npx cdk synth (no errors)
- node --check backend/handlers/authHandler.js
- npm test
```

---

### PROMPT T-2.10 — Unit Tests for Consent Flow

```
You are working on Learnfyra, a Node.js 18+ ESM project with Jest.

TASK: Write unit tests for the consent store module and consent endpoints.

ARCHITECTURE CONTEXT:
- Test location: tests/unit/
- Follow existing test patterns (check any existing test file for mocking approach)
- Consent store: src/consent/consentStore.js
- Auth handler consent functions: in backend/handlers/authHandler.js

CREATE FILE: tests/unit/consentStore.test.js
TEST CASES:
1. createConsentRequest → record has status 'pending', valid consentToken (UUID), expiresAt ~48h from now
2. getConsentByToken → returns record for valid token, null for invalid
3. grantConsent → status='granted', grantedAt set, expiresAt removed/extended, retainUntil set to ~3 years
4. denyConsent → status='denied', expiresAt removed
5. revokeConsent → status='revoked', revokedAt set

CREATE FILE: tests/unit/consentEndpoints.test.js
TEST CASES:
1. request-consent with valid childUserId + parentEmail → 200, consent record created
2. request-consent with invalid childUserId → 404
3. request-consent where child is not pending_consent → 400
4. request-consent where parentEmail === childEmail → 400
5. request-consent 4th time in 1 hour → 429
6. verify-consent with valid token → child activated, parent link created
7. verify-consent with expired token → 410
8. verify-consent with already-used token → 409
9. deny-consent with valid token → child user deleted, consent record status='denied'
10. deny-consent with already-used token → 409

VERIFY: npm test -- tests/unit/consentStore.test.js tests/unit/consentEndpoints.test.js
```

---

## PHASE 3 — Deletion & Parent Dashboard

---

### PROMPT T-3.1 — Cascade Deletion Module

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create a module that completely deletes a user and ALL associated data across every database table and S3 bucket.

ARCHITECTURE CONTEXT:
- DB adapter: import { getDbAdapter } from '../db/index.js'
- Methods: deleteItem(table, id), queryByField(table, field, value)
- DynamoDB tables (logical names used by adapter):
  users, attempts, worksheets, aggregates, certificates, parentlinks, memberships, feedback, guestsessions, userquestionhistory, consentrecords (DO NOT DELETE), adminauditevents (DO NOT DELETE)
- S3: worksheets are stored under worksheets/{worksheetId}/ prefix in the worksheet bucket
  - Check existing code for S3 delete patterns (look at downloadHandler.js or generateHandler.js for S3 client usage)
  - Env var: WORKSHEET_BUCKET_NAME

CREATE FILE: src/account/accountDeletion.js

EXPORT: cascadeDeleteUser(userId, options = {})

IMPLEMENTATION:
1. Delete user record from 'users' table
2. Query 'attempts' by studentId=userId, delete each
3. Query 'worksheets' by createdBy=userId, delete each from DB + delete S3 files (worksheets/{worksheetId}/)
4. Query 'aggregates' — filter for records where id starts with userId (format: {userId}#{subject})
5. Query 'certificates' by studentId=userId, delete each
6. Query 'parentlinks' by parentId=userId AND by childId=userId, delete all (both directions)
7. Query 'memberships' by studentId=userId, delete each
8. Query 'feedback' — look for userId field or similar, delete matches
9. Query 'guestsessions' for PK starting with userId pattern
10. Query 'userquestionhistory' for PK=userId, delete matches

DO NOT DELETE from: consentrecords (legal retention 3 years), adminauditevents (compliance)

Log each table operation: console.log(JSON.stringify({ action: 'cascade_delete', userId, table, recordsDeleted: N }))

Return: { success: true, tablesProcessed: number, totalRecordsDeleted: number }

Make it idempotent: if a record doesn't exist, skip without error.

CONSTRAINTS:
- This function must NEVER be callable directly from an API — only from other handler functions
- Must work with both localDbAdapter and dynamoDbAdapter
- S3 deletion is best-effort (if bucket name env var is missing, skip S3 and log warning)
- Do NOT use batch operations that could fail partially — delete one at a time for reliability

VERIFY: node --check src/account/accountDeletion.js
```

---

### PROMPT T-3.2 — DELETE /api/account Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create account deletion endpoint with 7-day cooling-off period.

ARCHITECTURE CONTEXT:
- Auth middleware: validateToken, requireRole from backend/middleware/authMiddleware.js
- Cascade deletion: cascadeDeleteUser from src/account/accountDeletion.js (T-3.1)
- Email: use same nodemailer pattern as forgot-password flow
- server.js for route wiring

CREATE FILE: backend/handlers/accountHandler.js

EXPORT: handler(event, context) — Lambda-compatible, same pattern as authHandler.js

IMPLEMENT three route handlers:

1. handleDeleteAccount(body, decoded):
   - Validate body.confirmEmail matches decoded.email — 400 if mismatch
   - Fetch user, verify accountStatus is not already 'pending_deletion' — 409 if already pending
   - Update user: accountStatus='pending_deletion', deletionScheduledAt=7 days from now (Unix), deletionRequestedAt=ISO now
   - Send confirmation email: "Your account is scheduled for deletion on [date]. Click here to cancel: {FRONTEND_URL}/settings?cancel-deletion=true"
   - Return 200: { deletionId: UUID, scheduledAt: ISO date, message: '...', cancelUrl: '/settings?cancel-deletion=true' }

2. handleCancelDeletion(decoded):
   - Fetch user, verify accountStatus === 'pending_deletion' — 400 if not
   - Update: accountStatus='active', remove deletionScheduledAt
   - Return 200: { accountStatus: 'active', message: 'Deletion cancelled.' }

3. handleDeleteChildAccount(childUserId, body, decoded):
   - assertParentLink(decoded, childUserId) — will throw 403 if not authorized
   - Validate body.confirmChildEmail matches child's email
   - Call cascadeDeleteUser(childUserId) immediately (no cooling-off for parent-initiated COPPA deletion)
   - Call revokeConsent(childUserId) from consent store
   - Return 200: { message: 'Child account and all data deleted.' }

MODIFY FILE: server.js — add routes:
- DELETE /api/account → handleDeleteAccount
- POST /api/account/cancel-deletion → handleCancelDeletion
- DELETE /api/account/child/:childUserId → handleDeleteChildAccount
All three require JWT auth (use validateToken middleware pattern from existing routes)

CONSTRAINTS:
- DELETE /api/account requires confirmEmail in body (prevents accidental/CSRF deletion)
- Child deletion by parent is IMMEDIATE (COPPA requires prompt action)
- Self-deletion has 7-day cooling-off
- User can still log in during cooling-off (just sees a banner)

VERIFY: node --check on all files, npm test
```

---

### PROMPT T-3.3 through T-3.6 and PROMPT T-4.1 through T-4.5

These tasks follow the exact same prompt structure. Due to document size, I will provide condensed versions:

---

### PROMPT T-3.5 — SettingsPage Deletion UI

```
You are working on Learnfyra, a React 18 + TypeScript + Tailwind CSS 4 frontend in learnfyra-app/.

TASK: Wire the existing "Delete Account" button in SettingsPage to the real deletion API with a confirmation modal.

FILE: learnfyra-app/src/pages/SettingsPage.tsx (lines ~696-712 have the existing TODO button)

CHANGES:
1. Add state: showDeleteModal (boolean), confirmEmail (string), deleteLoading (boolean), deleteError (string)
2. Replace the TODO button with one that opens the modal
3. Create a modal (can be inline JSX or a component) with:
   - Warning: "This will permanently delete your account and all data. This cannot be undone."
   - Bulleted list of what gets deleted: profile, worksheets, scores, certificates
   - Email input: "Type your email to confirm"
   - "Delete Everything" button (destructive/red, disabled until email matches auth.email)
   - "Cancel" button
4. On confirm: call DELETE /api/account with { confirmEmail } and Authorization header
5. On success: close modal, show toast "Account scheduled for deletion in 7 days", sign out after 3 seconds
6. On error: show error message in modal
7. Also wire the "Export My Data" button to trigger a GET /api/parent/children/{userId}/export (or /api/account/export) and download as JSON file

CONSTRAINTS:
- Email must exactly match the logged-in user's email
- Do NOT auto-close modal on error
- Follow existing toast pattern (SaveToast component already exists in this file)

VERIFY: cd learnfyra-app && npm run build
```

---

### PROMPT T-4.1 — Parent Children List Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create GET /api/parent/children endpoint returning linked children with stats.

CREATE FILE: backend/handlers/parentHandler.js

EXPORT: handler(event, context) — Lambda-compatible

IMPLEMENT handleListChildren(decoded):
1. requireRole(decoded, ['parent'])
2. Query parentlinks by parentId=decoded.sub (or decoded.email) where status='active'
3. For each child link: fetch user record, count attempts, get last active date
4. Return 200: { children: [{ childUserId, displayName, email, grade, accountStatus, consentGrantedAt, stats: { worksheetsCompleted, totalAttempts, lastActiveAt } }] }

MODIFY: server.js — add GET /api/parent/children route with JWT auth

CONSTRAINTS: Only return children linked to the authenticated parent. Non-parent role → 403.

VERIFY: node --check, npm test
```

---

### PROMPT T-4.2 — Child Data Export Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create GET /api/parent/children/:childUserId/export endpoint returning all child data as JSON.

MODIFY FILE: backend/handlers/parentHandler.js — add handleExportChildData(childUserId, decoded)

IMPLEMENT:
1. assertParentLink(decoded, childUserId)
2. Gather all data: user profile (strip passwordHash), worksheets, attempts, certificates, aggregates
3. Return 200 with Content-Type: application/json and Content-Disposition: attachment; filename="learnfyra-data-export.json"
4. Response body: { exportedAt, child: {...}, worksheets: [...], attempts: [...], certificates: [...] }

MODIFY: server.js — add route with JWT auth

CONSTRAINTS: Only data belonging to that child. No data from other users. assertParentLink enforces authorization.

VERIFY: node --check, npm test
```

---

### PROMPT T-4.3 — Revoke Consent Endpoint

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Create POST /api/parent/children/:childUserId/revoke-consent endpoint.

MODIFY FILE: backend/handlers/parentHandler.js — add handleRevokeConsent(childUserId, body, decoded)

IMPLEMENT:
1. assertParentLink(decoded, childUserId)
2. Call revokeConsent(childUserId, { reason: body.reason, revokedBy: decoded.sub }) from consent store
3. Update child user: accountStatus='suspended'
4. Set child deletionScheduledAt to 72 hours from now (COPPA requires prompt action)
5. Return 200: { message: 'Consent revoked. Account will be deactivated and data deleted within 72 hours.' }

MODIFY: server.js — add route with JWT auth

CONSTRAINTS: Parent authorization via assertParentLink. Child cannot log in after suspension.

VERIFY: node --check, npm test
```

---

### PROMPT T-4.4 — ParentDashboardPage (Frontend)

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend in learnfyra-app/.

TASK: Create a Parent Privacy Dashboard page showing linked children with data management controls.

CREATE FILE: learnfyra-app/src/pages/ParentDashboardPage.tsx
MODIFY FILE: learnfyra-app/src/App.tsx — add auth-guarded route /parent/children

IMPLEMENTATION:
- On mount: GET /api/parent/children with auth header
- Render a card for each child:
  - Avatar (initials), display name, email, grade, status badge, consent date
  - Stats: worksheets completed, total attempts, last active
  - Action buttons: "View Data" (expand inline), "Download Data" (trigger export JSON download), "Revoke Consent" (confirmation modal → POST revoke-consent), "Delete Account" (confirmation modal → DELETE child account)
- Empty state: "No linked children. When your child registers and you grant consent, they will appear here."
- Add navigation: In the main sidebar/navbar, if user role is 'parent', show a "My Children" link to /parent/children
- Page should only be accessible to parent role users

CONSTRAINTS:
- All destructive actions require confirmation modal
- Download triggers browser file save (create blob URL from JSON response)
- Follow existing page/card patterns from DashboardPage or SettingsPage
- Mobile-responsive

VERIFY: cd learnfyra-app && npm run build
```

---

## PHASE 4 — Quick Wins

---

### PROMPT T-5.1 — Privacy Policy Page

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend in learnfyra-app/.

TASK: Create the Privacy Policy page at /privacy with COPPA and CCPA required sections.

CREATE FILE: learnfyra-app/src/pages/legal/PrivacyPolicyPage.tsx
MODIFY FILE: learnfyra-app/src/App.tsx — add route /privacy

CONTENT SECTIONS (render as structured, readable HTML with Tailwind prose styling):
1. Header: "Privacy Policy" + "Last Updated: April 2026" + "Version 1.0"
2. "Information We Collect" — list: email, display name, grade level, worksheet answers, scores, IP (for security)
3. "How We Use Your Information" — educational content generation, progress tracking, account security
4. "How We Share Your Information" — "We do NOT sell your data. We do NOT show targeted ads." AI provider receives only grade/subject (no PII).
5. **"Children's Privacy"** (COPPA section — most important):
   - We comply with COPPA
   - We collect data from children under 13 only with verifiable parental consent
   - Data collected from children: email, first name, grade, worksheet answers
   - Parents' rights: review, download, delete, revoke consent
   - Contact: privacy@learnfyra.com
6. "Data Retention" — active accounts: duration of account. Worksheets: 7 days. Logs: 3 years. Deleted accounts: purged within 30 days.
7. "Your Rights" (CCPA) — right to know, right to delete, right to opt-out, right to non-discrimination
8. "Security" — encryption at rest and in transit, access controls, regular audits
9. "Changes to This Policy" — notification via email for material changes
10. "Contact Us" — privacy@learnfyra.com

Use Tailwind's prose classes for readable typography. Add a table of contents at the top.

CONSTRAINTS:
- This is placeholder content for engineering — legal counsel must review before launch
- Add a banner: "This privacy policy is pending legal review"
- No legal jargon — plain language (COPPA requires this for children's notices)
- Page must be accessible without authentication

VERIFY: cd learnfyra-app && npm run build
```

---

### PROMPT T-5.2 — Terms of Service Page

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend in learnfyra-app/.

TASK: Create Terms of Service page at /terms.

CREATE FILE: learnfyra-app/src/pages/legal/TermsOfServicePage.tsx
MODIFY FILE: learnfyra-app/src/App.tsx — add route /terms

CONTENT SECTIONS:
1. Header: "Terms of Service" + last updated + version
2. "Acceptance of Terms"
3. "Description of Service" — AI-powered educational worksheet platform for K-12
4. "AI-Generated Content" — IMPORTANT: "Worksheet content is generated by artificial intelligence and may contain errors. Scores provided by Learnfyra are for self-assessment and practice purposes only. They do not constitute official academic records, grades, or evaluations."
5. "User Accounts" — responsibilities, one account per person, accurate information
6. "Acceptable Use" — educational purposes only, no misuse
7. "Intellectual Property" — Learnfyra owns the platform, users retain rights to their input data
8. "Limitation of Liability" — standard limitation clause
9. "Termination" — either party can terminate, data deletion policy
10. "Governing Law" — United States
11. "Contact" — support@learnfyra.com

Same styling as PrivacyPolicyPage. Add "pending legal review" banner. Public access.

VERIFY: cd learnfyra-app && npm run build
```

---

### PROMPT T-5.3 — "Do Not Sell" Link + Page

```
You are working on Learnfyra, a React 18 + TypeScript + Vite + Tailwind CSS 4 frontend in learnfyra-app/.

TASK: Add CCPA-required "Do Not Sell My Personal Information" footer link and page.

CREATE FILE: learnfyra-app/src/pages/legal/DoNotSellPage.tsx

MODIFY FILES:
1. learnfyra-app/src/App.tsx — add route /do-not-sell
2. learnfyra-app/src/components/layout/Footer.tsx — add link in bottom bar

Read Footer.tsx first to see the existing bottom bar links (Privacy, Terms, Accessibility). Add:
<Link to="/do-not-sell">Do Not Sell My Personal Information</Link>

Page content: Simple centered page stating "Learnfyra does not sell, rent, or share your personal information with third parties for monetary or other valuable consideration. We do not engage in targeted advertising. For questions: privacy@learnfyra.com"

VERIFY: cd learnfyra-app && npm run build
```

---

### PROMPT T-5.4 — AI Transparency Label

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Add "Generated with AI assistance" disclosure to all worksheet outputs (California AB 2013).

MODIFY FILES:
1. src/ai/generator.js — After the worksheet JSON is assembled (after validation), add field:
   worksheet.aiDisclosure = { generated: true, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514', provider: 'Anthropic', label: 'Questions generated with AI assistance' }

2. src/exporters/htmlExporter.js — Read this file, find where the HTML is constructed. Add a footer element BEFORE the closing </body> or at the end of the worksheet content:
   <footer style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.75rem;">Questions generated with AI assistance | Learnfyra</footer>

3. src/exporters/pdfExporter.js — Read this file, find where PDF content is generated. Add the same footer text to the bottom of the last page. Follow existing Puppeteer/PDF generation patterns.

4. learnfyra-app/src/pages/SolvePage.tsx (or the equivalent page that renders worksheets for online solving) — Read it first. Add a subtle info banner: a light blue (#EBF5FF) bar with an info icon and text "Questions generated with AI assistance by Learnfyra". Place at the top or bottom of the worksheet content area. Not dismissible.

CONSTRAINTS:
- The label must be visible on every output format: HTML, PDF, and online solve
- Do NOT modify the worksheet JSON schema validation (the aiDisclosure field is additive)
- Read each file before modifying to understand existing patterns

VERIFY:
- node --check src/ai/generator.js
- node --check src/exporters/htmlExporter.js
- node --check src/exporters/pdfExporter.js
- cd learnfyra-app && npm run build
- npm test
```

---

### PROMPT T-5.5 — Audit Log Retention 3 Years

```
You are working on Learnfyra's AWS CDK infrastructure in infra/cdk/.

TASK: Change all CloudWatch log retention from 1 month to 3 years (COPPA 312.10 compliance).

FILE: infra/cdk/lib/learnfyra-stack.ts

CHANGES:
1. Search for all occurrences of RetentionDays.ONE_MONTH in the file
2. Replace each with RetentionDays.THREE_YEARS
3. This includes Lambda function log groups and API Gateway access log groups
4. Import RetentionDays from aws-cdk-lib/aws-logs if not already imported

Do NOT change anything else — no Lambda configs, no table configs, no bucket configs. ONLY log retention.

VERIFY:
- cd infra/cdk && npm run build (TypeScript compiles)
- cd infra/cdk && npx cdk synth (synthesizes without errors)
- Verify: grep for "ONE_MONTH" in the synthesized template — should find zero occurrences
```

---

### PROMPT T-5.6 — Data Minimization for Child Users

```
You are working on Learnfyra, a Node.js 18+ ESM EdTech platform.

TASK: Strip optional PII fields from requests made by child users and restrict display name to first name only.

ARCHITECTURE CONTEXT:
- Validator: backend/middleware/validator.js — lines 128-134 define optional fields: studentName, teacherName, className, period
- Auth middleware: validateToken returns { sub, email, role, ageGroup }
- DB adapter: to look up user's ageGroup if not in token
- Registration: authHandler.js handleRegister
- Existing user fields in token: sub, email, role (ageGroup is NOT in the token currently)

CHANGES:

1. MODIFY: backend/middleware/validator.js
   Add exported function:
   ```javascript
   export function stripChildPII(body, ageGroup) {
     if (ageGroup === 'child') {
       delete body.studentName;
       delete body.teacherName;
       delete body.className;
       delete body.period;
     }
     return body;
   }
   ```

2. MODIFY: server.js (or the generate route handler)
   After authentication and before passing body to the generator:
   - Look up the user's ageGroup (either from token claims if added, or by fetching the user record)
   - Call stripChildPII(body, user.ageGroup)
   - Pass the stripped body to the handler

3. MODIFY: backend/handlers/authHandler.js handleRegister
   When ageGroup === 'child', truncate displayName to first word only:
   ```javascript
   if (ageGroup === 'child') {
     body.displayName = body.displayName.split(' ')[0];
   }
   ```

CONSTRAINTS:
- Adult and teen users are NOT affected — their fields pass through unchanged
- The strip happens BEFORE the AI prompt builder (which already excludes these fields, but this is defense-in-depth)
- Read server.js to understand how the generate route is wired before modifying

VERIFY:
- node --check backend/middleware/validator.js
- node --check server.js
- node --check backend/handlers/authHandler.js
- npm test
```

---

## Execution Checklist

After completing all prompts, run the full verification suite:

```bash
# Backend
npm test                          # All tests pass
npm run test:coverage             # Coverage stays above 80%

# Frontend
cd learnfyra-app && npm run build # Zero TS errors

# Infrastructure
cd infra/cdk && npx cdk synth     # Zero warnings

# Manual smoke test
npm run dev                       # Start backend on :3000
cd learnfyra-app && npm run dev   # Start frontend on :5173
# Test: Register with child DOB → consent-pending page
# Test: Register with adult DOB → dashboard
# Test: Delete account flow
# Test: Privacy policy page renders at /privacy
# Test: "Do Not Sell" link in footer
```

---

*Total: 34 prompts across 5 epics. Each prompt is self-contained and can be executed sequentially by a Claude Code agent.*
