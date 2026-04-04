# Learnfyra — Compliance Sprint: Development Task Breakdown

**Document ID:** LFR-TASKS-COMPLIANCE-001
**Version:** 1.0
**Date:** April 3, 2026
**Source:** LFR-IMPL-COMPLIANCE-001 (MUST HAVE Implementation Spec)
**Author:** Senior Tech Lead
**Target:** Single developer, incremental delivery, Claude Code agent-ready

---

## Execution Order Overview

Tasks are numbered by execution order. Each task is self-contained and testable. A developer should complete them sequentially within each phase; phases can partially overlap where noted.

```
PHASE 1 — Foundation (Week 1, Days 1-3)
  EPIC-1: Age Gate & User Schema
    T-1.1  Age utility module
    T-1.2  User schema expansion (backend)
    T-1.3  Registration endpoint age logic
    T-1.4  OAuth callback age verification endpoint
    T-1.5  DOB field in AuthModal signup form (frontend)
    T-1.6  AgeVerificationPage for OAuth users (frontend)
    T-1.7  Unit tests for age gate

PHASE 2 — Consent System (Week 1-2, Days 3-6)
  EPIC-2: Parental Consent + Consent Storage
    T-2.1  ConsentRecords DynamoDB table (CDK + bootstrap)
    T-2.2  Consent store module (src/consent/consentStore.js)
    T-2.3  Request-consent endpoint
    T-2.4  Verify-consent endpoint
    T-2.5  Deny-consent endpoint
    T-2.6  Consent email template
    T-2.7  ConsentPendingPage (frontend)
    T-2.8  ParentalConsentPage (frontend)
    T-2.9  Pending account TTL cleanup
    T-2.10 Unit tests for consent flow

PHASE 3 — Deletion & Parent Dashboard (Week 2-3, Days 6-10)
  EPIC-3: Account Deletion
    T-3.1  Cascade deletion module
    T-3.2  DELETE /api/account endpoint
    T-3.3  Cancel-deletion endpoint
    T-3.4  Parent child-deletion endpoint
    T-3.5  SettingsPage deletion UI (frontend)
    T-3.6  Unit tests for deletion

  EPIC-4: Privacy Dashboard for Parents
    T-4.1  GET /api/parent/children endpoint
    T-4.2  GET /api/parent/children/:id/export endpoint
    T-4.3  POST /api/parent/children/:id/revoke-consent endpoint
    T-4.4  ParentDashboardPage (frontend)
    T-4.5  Unit tests for parent dashboard

PHASE 4 — Quick Wins (Week 3, Days 10-12) — can start anytime
  EPIC-5: Legal Pages, Labels & Config
    T-5.1  Privacy Policy page (frontend)
    T-5.2  Terms of Service page (frontend)
    T-5.3  "Do Not Sell" link + page (frontend)
    T-5.4  AI transparency label (backend + frontend)
    T-5.5  Audit log retention 3 years (CDK)
    T-5.6  Data minimization for child users
```

---

## EPIC-1: Age Gate & User Schema

**Goal:** Every new user provides a date of birth. Under-13 users are blocked from activation until parental consent is obtained.

---

### T-1.1 — Create Age Utility Module

**Description:** Create a shared utility module that calculates age from a date of birth string and returns an age group classification. This module is used by registration, OAuth callback, and validator.

**Files to create:**
- `src/utils/ageUtils.js`

**Files to modify:** None

**Implementation:**

```javascript
// src/utils/ageUtils.js
/**
 * @file src/utils/ageUtils.js
 * @description Age calculation and classification for COPPA compliance
 */

export function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) throw new Error('Invalid date of birth');
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function getAgeGroup(age) {
  if (age < 13) return 'child';
  if (age < 18) return 'teen';
  return 'adult';
}

export function validateDateOfBirth(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return { valid: false, error: 'Format must be YYYY-MM-DD' };
  const dob = new Date(dateString);
  if (isNaN(dob.getTime())) return { valid: false, error: 'Invalid date' };
  const age = calculateAge(dateString);
  if (age < 5) return { valid: false, error: 'Minimum age is 5 years' };
  if (age > 120) return { valid: false, error: 'Invalid date of birth' };
  if (new Date(dateString) > new Date()) return { valid: false, error: 'Date cannot be in the future' };
  return { valid: true, age, ageGroup: getAgeGroup(age) };
}
```

**Acceptance Criteria:**
- `calculateAge('2015-06-15')` returns correct age relative to today
- `getAgeGroup(10)` returns `'child'`, `getAgeGroup(15)` returns `'teen'`, `getAgeGroup(25)` returns `'adult'`
- `validateDateOfBirth('2030-01-01')` returns `{ valid: false }` (future date)
- `validateDateOfBirth('2023-01-01')` returns `{ valid: false }` (age < 5)
- `validateDateOfBirth('invalid')` returns `{ valid: false }`
- Edge case: birthday is today — age should be exactly correct

**API changes:** None
**Database changes:** None
**Frontend changes:** None
**Security:** No PII handled. Pure calculation utility.

---

### T-1.2 — Expand User Schema with Age and Consent Fields

**Description:** Add `dateOfBirth`, `ageGroup`, `accountStatus`, `consentStatus`, and `parentEmail` fields to the user record. Update the local mock adapter and bootstrap script. No CDK changes needed (DynamoDB is schemaless).

**Files to modify:**
- `src/auth/mockAuthAdapter.js` — update `createUser()` to accept and store new fields
- `scripts/bootstrap-local-db.js` — add new fields to seed data if any seed users exist

**Implementation details:**

In `mockAuthAdapter.js`, modify `createUser`:
```javascript
// Add to createUser params destructure:
async createUser({ email, password, role, displayName, dateOfBirth, ageGroup, parentEmail }) {
  // ... existing bcrypt + userId logic ...
  const user = {
    userId,
    email: normalizedEmail,
    passwordHash,
    role,
    displayName,
    authType: 'local:email',
    dateOfBirth: dateOfBirth || null,
    ageGroup: ageGroup || 'adult',
    accountStatus: ageGroup === 'child' ? 'pending_consent' : 'active',
    consentStatus: ageGroup === 'child' ? 'pending' : 'not_required',
    parentEmail: parentEmail || null,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  // ... rest of existing storage logic ...
}
```

Also update the public user shape (strip `dateOfBirth` and `parentEmail` from public returns — same as `passwordHash` is stripped):
```javascript
function toPublicUser(user) {
  const { passwordHash, dateOfBirth, parentEmail, ...publicUser } = user;
  return publicUser;
}
```

**Acceptance Criteria:**
- Creating a user with `ageGroup: 'child'` stores `accountStatus: 'pending_consent'`
- Creating a user with `ageGroup: 'adult'` stores `accountStatus: 'active'`
- `dateOfBirth` and `parentEmail` are NOT returned in public user responses
- Existing users without new fields continue to work (fields default to `null`)

**API changes:** None (schema is internal)
**Database changes:** New fields on `LearnfyraUsers` table (DynamoDB schemaless — no migration)
**Frontend changes:** None
**Security:** `dateOfBirth` and `parentEmail` are sensitive — must NOT appear in JWT claims, API responses, or logs. Strip from all public-facing outputs.

---

### T-1.3 — Add Age Gate Logic to Registration Endpoint

**Description:** Modify `handleRegister` in `authHandler.js` to require `dateOfBirth`, calculate age group, and route under-13 users to the pending consent state instead of issuing a token.

**Files to modify:**
- `backend/handlers/authHandler.js` — `handleRegister(body)` function

**Implementation details:**

At the top of `handleRegister`, after existing field validation:
```javascript
// 1. Validate dateOfBirth is present
if (!body.dateOfBirth) {
  return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'dateOfBirth is required' }) };
}

// 2. Validate and calculate age
const { valid, age, ageGroup, error } = validateDateOfBirth(body.dateOfBirth);
if (!valid) {
  return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error }) };
}

// 3. Pass ageGroup to createUser
const user = await adapter.createUser({ ...body, ageGroup });

// 4. Branch on age
if (ageGroup === 'child') {
  // Do NOT issue token
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      userId: user.userId,
      accountStatus: 'pending_consent',
      requiresConsent: true,
      message: 'Parental consent required before account activation.'
    })
  };
}

// 5. Standard flow for 13+ (existing code continues)
const token = adapter.generateToken(user);
// ... existing response ...
```

**Acceptance Criteria:**
- `POST /api/auth/register` with `dateOfBirth: '2018-01-01'` (age ~8) returns `{ requiresConsent: true }` and NO token
- `POST /api/auth/register` with `dateOfBirth: '2008-01-01'` (age ~18) returns token normally
- `POST /api/auth/register` without `dateOfBirth` returns 400
- `POST /api/auth/register` with future date returns 400
- User record in DB has correct `ageGroup` and `accountStatus`

**API changes:**
- `POST /api/auth/register` — new required field `dateOfBirth` (string, YYYY-MM-DD)
- New response shape for under-13 (no `token` field, has `requiresConsent: true`)

**Database changes:** User record gets new fields (handled by T-1.2)
**Frontend changes:** None (handled by T-1.5)
**Security:**
- `dateOfBirth` must NOT be logged in API Gateway access logs (it's in the request body, which is not logged by default — verify)
- `dateOfBirth` must NOT appear in JWT claims
- `dateOfBirth` must NOT appear in error messages

---

### T-1.4 — Add Age Verification Endpoint for OAuth Users

**Description:** Google OAuth does not provide date of birth. Create a `PATCH /api/auth/verify-age` endpoint that OAuth users call after their first login to provide their DOB. Modify the OAuth callback to redirect new users to the age verification page.

**Files to modify:**
- `backend/handlers/authHandler.js` — add `handleVerifyAge(body, decoded)` function, modify `handleOAuthCallback`

**Implementation details:**

New handler function:
```javascript
async function handleVerifyAge(body, decoded) {
  const { valid, age, ageGroup, error } = validateDateOfBirth(body.dateOfBirth);
  if (!valid) return { statusCode: 400, ... };

  // Update user record with DOB + ageGroup
  await db.updateItem('users', decoded.sub, {
    dateOfBirth: body.dateOfBirth,
    ageGroup,
    accountStatus: ageGroup === 'child' ? 'pending_consent' : 'active',
    consentStatus: ageGroup === 'child' ? 'pending' : 'not_required',
  });

  if (ageGroup === 'child') {
    return { statusCode: 200, ..., body: JSON.stringify({ accountStatus: 'pending_consent', requiresConsent: true }) };
  }

  // Issue full-access token
  const token = signToken({ sub: decoded.sub, email: decoded.email, role: decoded.role });
  return { statusCode: 200, ..., body: JSON.stringify({ accountStatus: 'active', token }) };
}
```

Modify OAuth callback for NEW users:
- When a new OAuth user is created (first-time login), set `accountStatus: 'pending_age_verification'`
- Issue a limited-scope token with claim `scope: 'age_verification_only'`
- Redirect to `{FRONTEND_URL}/auth/age-verification?token=...`

Add middleware check: endpoints that require full access should reject tokens with `scope: 'age_verification_only'` (add check in `validateToken` or `requireRole`).

**Route registration** in `server.js`:
```javascript
app.patch('/api/auth/verify-age', async (req, res) => { /* wire to handleVerifyAge */ });
```

**Acceptance Criteria:**
- New Google OAuth user is redirected to `/auth/age-verification` (not `/dashboard`)
- `PATCH /api/auth/verify-age` with child DOB returns `{ requiresConsent: true }`
- `PATCH /api/auth/verify-age` with adult DOB returns `{ accountStatus: 'active', token }`
- Limited-scope token cannot access `/api/dashboard` or other protected endpoints
- Returning Google OAuth user (already has DOB) goes to `/dashboard` normally

**API changes:**
- New: `PATCH /api/auth/verify-age` — body `{ dateOfBirth }`, auth: limited JWT
- Modified: OAuth callback redirect changes for new users

**Database changes:** Updates existing user record with DOB fields
**Frontend changes:** None (handled by T-1.6)
**Security:**
- Limited-scope token must only be accepted by `/api/auth/verify-age` — all other endpoints must reject it
- Prevent replay: once DOB is set, `verify-age` should reject subsequent calls

---

### T-1.5 — Add DOB Field to AuthModal Signup Form

**Description:** Add a Date of Birth selector (3 dropdowns: Month, Day, Year) to the email signup step in `AuthModal.tsx`. DOB field appears before email/password. On submit, include `dateOfBirth` in the registration API call. Handle the `requiresConsent` response by redirecting to a consent-pending page.

**Files to modify:**
- `learnfyra-app/src/components/AuthModal.tsx` — step `'email-signup'`
- `learnfyra-app/src/lib/emailAuth.ts` — update `signUp()` to accept and send `dateOfBirth`

**Implementation details:**

Add state variables in AuthModal:
```typescript
const [dobMonth, setDobMonth] = useState('');
const [dobDay, setDobDay] = useState('');
const [dobYear, setDobYear] = useState('');
```

Add DOB select fields BEFORE email in the signup form JSX:
```typescript
// Month: January-December options
// Day: 1-31 options (ideally adjust based on month)
// Year: (currentYear - 5) down to (currentYear - 120)
```

Modify the signup submit handler:
```typescript
const dateOfBirth = `${dobYear}-${dobMonth.padStart(2,'0')}-${dobDay.padStart(2,'0')}`;
const result = await signUp({ email, password, role, displayName, dateOfBirth });

if (result.requiresConsent) {
  // Store childUserId in sessionStorage for consent-pending page
  sessionStorage.setItem('lf_pending_child_id', result.userId);
  navigate('/auth/consent-pending');
  onClose();
  return;
}
// ... existing success flow (signIn, navigate to /dashboard) ...
```

Update `signUp()` in `emailAuth.ts`:
```typescript
export async function signUp({ email, password, role, displayName, dateOfBirth }) {
  const res = await fetch(`${apiUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role, displayName, dateOfBirth }),
  });
  // ... existing error handling ...
  return data; // may contain { requiresConsent: true } or { token }
}
```

**Acceptance Criteria:**
- Signup form shows Month/Day/Year dropdowns before email field
- Year dropdown starts at `currentYear - 5` (most recent) and goes to `currentYear - 120`
- Selecting February limits days to 28/29 (leap year aware)
- Cannot submit form with empty DOB fields (client-side validation)
- Submitting with child DOB navigates to `/auth/consent-pending` (not `/dashboard`)
- Submitting with adult DOB navigates to `/dashboard` (existing behavior)
- DOB value is NOT displayed back to the user after entry

**API changes:** None (backend already expects `dateOfBirth` from T-1.3)
**Database changes:** None
**Frontend changes:** AuthModal.tsx, emailAuth.ts
**Security:**
- Do NOT show calculated age to the user (prevents children from adjusting their answer)
- Do NOT store DOB in localStorage or sessionStorage (only send to backend)

---

### T-1.6 — Create AgeVerificationPage for OAuth Users

**Description:** Create a new page at `/auth/age-verification` that OAuth users see on first login. It collects DOB and calls `PATCH /api/auth/verify-age`.

**Files to create:**
- `learnfyra-app/src/pages/AgeVerificationPage.tsx`

**Files to modify:**
- `learnfyra-app/src/App.tsx` — add route

**Implementation details:**

Simple centered page:
- Learnfyra logo at top
- Heading: "One more step!"
- Subtext: "Please enter your date of birth to continue."
- Same 3-dropdown DOB selector component (extract shared component from T-1.5)
- Submit button
- On success (adult/teen): call `auth.signIn(token, user)`, navigate to `/dashboard`
- On under-13: navigate to `/auth/consent-pending`

Extract DOB selector into a shared component:
```
learnfyra-app/src/components/ui/DateOfBirthSelect.tsx
```
Use in both AuthModal (T-1.5) and this page.

**Acceptance Criteria:**
- Page renders at `/auth/age-verification`
- DOB selector works identically to AuthModal version
- Submitting calls `PATCH /api/auth/verify-age` with correct Authorization header
- Adult DOB → redirects to `/dashboard` with full token
- Child DOB → redirects to `/auth/consent-pending`
- Page is inaccessible without a valid limited-scope token (redirect to `/` if no token)

**API changes:** None
**Database changes:** None
**Frontend changes:** New page + new shared component
**Security:** Page must validate token presence before rendering. Do not expose DOB in URL params.

---

### T-1.7 — Unit Tests for Age Gate

**Description:** Write Jest unit tests for the age utility module and the modified registration handler.

**Files to create:**
- `tests/unit/ageUtils.test.js`
- `tests/unit/ageGateRegistration.test.js`

**Test cases for ageUtils:**
- `calculateAge` with various DOBs (child, teen, adult, edge: birthday today)
- `getAgeGroup` boundary values (12, 13, 17, 18)
- `validateDateOfBirth` with valid dates, future dates, too-young dates, invalid strings

**Test cases for registration handler:**
- Register with child DOB → 200 + `requiresConsent: true`, no token, `accountStatus: 'pending_consent'`
- Register with adult DOB → 200 + token, `accountStatus: 'active'`
- Register without DOB → 400
- Register with invalid DOB → 400
- User record in DB has correct ageGroup, accountStatus, consentStatus
- DOB is NOT in the returned response body

**Acceptance Criteria:**
- All tests pass
- Tests cover child/teen/adult age boundaries
- Tests verify DOB is stripped from public API responses
- Tests use mock DB adapter (no real DynamoDB calls)

---

## EPIC-2: Parental Consent + Consent Storage

**Goal:** Parents can grant or deny consent for their under-13 child. All consent actions are recorded immutably for 3 years.

---

### T-2.1 — Create ConsentRecords DynamoDB Table

**Description:** Add the `LearnfyraConsentRecords-{env}` table to the CDK stack and local bootstrap script.

**Files to modify:**
- `infra/cdk/lib/learnfyra-stack.ts` — add table definition with 2 GSIs and TTL
- `scripts/bootstrap-local-db.js` — add `consentrecords` to local bootstrap

**CDK implementation:**
```typescript
this.createTable('ConsentRecords', 'consentId', undefined, {
  pointInTimeRecovery: true, // ALWAYS — legal compliance data
});
// Add GSIs: childUserId-index, parentEmail-index
// TTL attribute: expiresAt
```

Add environment variable `CONSENT_RECORDS_TABLE_NAME` to auth Lambda function.

**Local bootstrap:** Add `consentrecords` table config to `localDbAdapter` TABLE_CONFIG in `src/db/dynamoDbAdapter.js` (or equivalent config file).

**Acceptance Criteria:**
- `cd infra && npx cdk synth` passes with no errors
- Table appears in synthesized CloudFormation template with correct PK, GSIs, TTL
- `npm run db:bootstrap` creates the local consentrecords table
- Auth Lambda has `CONSENT_RECORDS_TABLE_NAME` env var

**API changes:** None
**Database changes:** New table `LearnfyraConsentRecords-{env}`
**Frontend changes:** None
**Security:** Point-in-time recovery MUST be enabled (legal records). Table must not have TTL on granted/revoked records (only pending).

---

### T-2.2 — Create Consent Store Module

**Description:** Create `src/consent/consentStore.js` — a data access module for consent records. Used by auth handlers internally.

**Files to create:**
- `src/consent/consentStore.js`

**Implementation:**
```javascript
import { randomUUID } from 'crypto';
import { getDbAdapter } from '../db/index.js';

export async function createConsentRequest({ childUserId, childEmail, parentEmail }) {
  const db = getDbAdapter();
  const record = {
    consentId: randomUUID(),
    consentToken: randomUUID(),
    childUserId,
    childEmail,
    parentEmail,
    status: 'pending',
    method: 'email_plus',
    requestedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + (48 * 60 * 60), // 48h TTL
    grantedAt: null,
    revokedAt: null,
    parentName: null,
    parentRelationship: null,
    privacyPolicyVersion: '1.0',
  };
  await db.putItem('consentrecords', record);
  return record;
}

export async function getConsentByToken(consentToken) { /* query + filter */ }
export async function grantConsent(consentId, details) { /* update status, set grantedAt, remove expiresAt TTL */ }
export async function denyConsent(consentId) { /* update status to 'denied', delete child user */ }
export async function revokeConsent(childUserId, details) { /* update status to 'revoked' */ }
export async function getConsentsByChild(childUserId) { /* query GSI */ }
export async function getConsentsByParent(parentEmail) { /* query GSI */ }
```

**Key detail:** When consent is granted, REMOVE the `expiresAt` field (or set to a date 3 years in the future) so DynamoDB TTL does not auto-delete the record. Set `retainUntil` to 3 years from `grantedAt`.

**Acceptance Criteria:**
- `createConsentRequest()` creates a record with `status: 'pending'` and 48h TTL
- `grantConsent()` sets `status: 'granted'`, `grantedAt`, and removes short TTL
- `getConsentByToken()` returns the record or null
- `revokeConsent()` sets `status: 'revoked'`, `revokedAt`
- All functions work with both local and DynamoDB adapters

**API changes:** None (internal module)
**Database changes:** Uses table from T-2.1
**Frontend changes:** None
**Security:** `consentToken` is a secret — treat like a password reset token. Single-use only.

---

### T-2.3 — Create Request-Consent Endpoint

**Description:** `POST /api/auth/request-consent` — called when an under-13 user provides their parent's email. Creates a consent record and sends email to parent.

**Files to modify:**
- `backend/handlers/authHandler.js` — add `handleRequestConsent(body)`
- `server.js` — add route

**Implementation details:**
1. Validate `childUserId` exists with `accountStatus: 'pending_consent'`
2. Validate `parentEmail` format
3. Ensure `parentEmail !== child.email` (parent and child cannot share email)
4. Call `createConsentRequest()` from consent store
5. Update child user's `parentEmail` field
6. Send email via `nodemailer` (already a project dependency):
   - Subject: "Learnfyra — Parental Consent Required"
   - Body: plain language consent notice + link to `{FRONTEND_URL}/auth/parental-consent?token={consentToken}`
7. Return `{ consentRequestId, expiresAt }`

Rate limit: max 3 consent requests per `childUserId` per hour (prevent spam).

**Acceptance Criteria:**
- Valid request creates consent record + sends email
- Invalid `childUserId` returns 404
- User with `accountStatus !== 'pending_consent'` returns 400
- `parentEmail === childEmail` returns 400
- 4th request within 1 hour returns 429
- Email contains correct consent link with token

**API changes:** New `POST /api/auth/request-consent`
**Database changes:** Writes to consentrecords table, updates user's parentEmail
**Frontend changes:** None (called from frontend in T-2.7)
**Security:**
- Consent token in email link must be unguessable (UUID v4)
- Do NOT include child's email or DOB in the email body (only display name)
- Rate limit to prevent email bombing

---

### T-2.4 — Create Verify-Consent Endpoint

**Description:** `POST /api/auth/verify-consent` — called when parent clicks "I Consent" on the consent page. Activates the child's account and creates parent-child link.

**Files to modify:**
- `backend/handlers/authHandler.js` — add `handleVerifyConsent(body, event)`
- `server.js` — add route

**Implementation details:**
1. Look up consent record by `consentToken`
2. Validate: not expired, not already used, status === 'pending'
3. Call `grantConsent()` with parent details + IP + user agent from event
4. Update child user: `accountStatus: 'active'`, `consentStatus: 'granted'`
5. Create parent-child link in `LearnfyraParentLinks`:
   ```javascript
   {
     id: `${parentUserId || parentEmail}#${childUserId}`,
     parentId: parentUserId || parentEmail,  // parent may not have an account
     childId: childUserId,
     status: 'active',
     linkedAt: new Date().toISOString(),
     updatedAt: new Date().toISOString(),
   }
   ```
6. Return `{ childUserId, accountStatus: 'active' }`

**Acceptance Criteria:**
- Valid token + parent details → child account activated
- Expired token → 410 Gone
- Already-used token → 409 Conflict
- Parent-child link created in parentLinks table
- Consent record updated with `grantedAt`, `parentName`, `parentRelationship`, `ipAddress`, `userAgent`

**API changes:** New `POST /api/auth/verify-consent`
**Database changes:** Updates consentrecords + users + parentlinks tables
**Frontend changes:** None (called from frontend in T-2.8)
**Security:**
- No authentication required (parent may not have an account) — token IS the auth
- Capture IP and User-Agent for audit trail
- Token must be invalidated after use (one-time)

---

### T-2.5 — Create Deny-Consent Endpoint

**Description:** `POST /api/auth/deny-consent` — called when parent clicks "I Do Not Consent". Immediately deletes the child's pending data.

**Files to modify:**
- `backend/handlers/authHandler.js` — add `handleDenyConsent(body)`
- `server.js` — add route

**Implementation:**
1. Look up consent record by `consentToken`
2. Validate token is valid and pending
3. Update consent record: `status: 'denied'`
4. Delete child user record from `LearnfyraUsers`
5. Return `{ message: 'Consent denied. All data for this account has been deleted.' }`

**Acceptance Criteria:**
- Valid token → child user deleted, consent record marked 'denied'
- Child user no longer exists in users table after denial
- Consent record is NOT deleted (retained for audit — status: 'denied')

**API changes:** New `POST /api/auth/deny-consent`
**Database changes:** Deletes user record, updates consent record
**Frontend changes:** None (called from T-2.8)
**Security:** Same as T-2.4 — token-based auth, one-time use.

---

### T-2.6 — Create Consent Email Template

**Description:** Create an HTML email template sent to parents requesting consent. Uses nodemailer (already in `package.json`).

**Files to create:**
- `src/consent/consentEmailTemplate.js`

**Implementation:** Export a function `buildConsentEmail({ childDisplayName, consentUrl, privacyPolicyUrl })` that returns `{ subject, html, text }`.

Email content (plain language, COPPA-compliant):
- Identifies Learnfyra as the sender
- Names the child (display name only)
- Lists exactly what data is collected
- Explains what data is NOT collected/shared
- Contains a prominent "I Consent" button linking to `consentUrl`
- Contains a "I Do Not Consent" link
- Links to full Privacy Policy

**Acceptance Criteria:**
- Returns valid HTML email with consent link
- Plain text fallback included
- No child PII beyond first name in email body
- Consent link contains the correct token parameter

**API changes:** None
**Database changes:** None
**Frontend changes:** None
**Security:** Email must NOT contain the child's email, DOB, or any data beyond display name.

---

### T-2.7 — Create ConsentPendingPage (Frontend)

**Description:** Page shown to child after registration when parental consent is pending. Includes parent email input and resend functionality.

**Files to create:**
- `learnfyra-app/src/pages/ConsentPendingPage.tsx`

**Files to modify:**
- `learnfyra-app/src/App.tsx` — add route `/auth/consent-pending`

**Implementation:**
- Reads `childUserId` from sessionStorage (set during registration in T-1.5)
- Shows masked parent email (p****@email.com)
- "Resend Email" button → `POST /api/auth/request-consent`
- "Use Different Email" → reveals input to change parent email, then calls request-consent
- Countdown timer showing hours until expiry
- If no `childUserId` in session, redirect to `/`

**Acceptance Criteria:**
- Page renders at `/auth/consent-pending`
- Parent email is masked (only first char + domain visible)
- "Resend Email" calls API and shows success toast
- Countdown timer counts down from 48 hours
- Redirect to `/` if no pending child context

**API changes:** None (uses T-2.3 endpoint)
**Database changes:** None
**Frontend changes:** New page + route
**Security:** Do not expose full parent email on screen.

---

### T-2.8 — Create ParentalConsentPage (Frontend)

**Description:** Page shown to parents when they click the consent link in the email. Displays data collection notice and consent form.

**Files to create:**
- `learnfyra-app/src/pages/ParentalConsentPage.tsx`

**Files to modify:**
- `learnfyra-app/src/App.tsx` — add route `/auth/parental-consent`

**Implementation:**
- Reads `token` from URL query params
- On mount, validates token with a lightweight GET (or attempt to render and handle errors on submit)
- Displays: child's display name, what data is collected, parent rights, link to privacy policy
- Form fields: Parent Name (text), Relationship (dropdown: Parent / Legal Guardian), Consent checkbox
- "I Consent" → `POST /api/auth/verify-consent`
- "I Do Not Consent" → `POST /api/auth/deny-consent`
- Success state: "Consent granted! [childName] can now use Learnfyra."
- Denial state: "Account data has been deleted."

**Acceptance Criteria:**
- Page renders with correct child display name
- Cannot submit without filling parent name, selecting relationship, AND checking consent box
- "I Consent" activates child account (verify by checking response)
- "I Do Not Consent" deletes child data
- Invalid/expired token shows error message
- Page works without being logged in (parent may not have an account)

**API changes:** None
**Database changes:** None
**Frontend changes:** New page + route
**Security:** The consent token in the URL is the sole authentication. Page must work for unauthenticated visitors.

---

### T-2.9 — Add TTL Cleanup for Expired Pending Accounts

**Description:** Ensure pending child accounts that never receive consent are automatically deleted after 48 hours.

**Files to modify:**
- `src/auth/mockAuthAdapter.js` — add `pendingExpiresAt` field for child accounts
- `backend/handlers/authHandler.js` — set `pendingExpiresAt` in `handleRegister` for child accounts

**Implementation (DynamoDB approach):**
When creating a child user with `accountStatus: 'pending_consent'`, set:
```javascript
pendingExpiresAt: Math.floor(Date.now() / 1000) + (48 * 60 * 60) // 48 hours as Unix timestamp
```

DynamoDB TTL on the `pendingExpiresAt` attribute will auto-delete expired records. Enable TTL in CDK:
```typescript
// In learnfyra-stack.ts, on the Users table:
usersTable.addTimeToLive({ attribute: 'pendingExpiresAt' });
```

**Important:** Only pending accounts have `pendingExpiresAt`. Active accounts do NOT have this field, so TTL doesn't affect them.

For local dev (localDbAdapter), add a startup cleanup check that deletes expired pending users on server start.

**Acceptance Criteria:**
- Child user created with `pendingExpiresAt` 48 hours in the future
- CDK synth includes TTL config on Users table
- Active users are NOT affected by TTL (field absent)
- When consent is granted (T-2.4), `pendingExpiresAt` is removed from the user record

**API changes:** None
**Database changes:** TTL attribute on Users table
**Frontend changes:** None
**Security:** Automatic deletion of unconsented child data — this IS the security control.

---

### T-2.10 — Unit Tests for Consent Flow

**Description:** Write Jest tests for the consent store module and consent endpoints.

**Files to create:**
- `tests/unit/consentStore.test.js`
- `tests/unit/consentEndpoints.test.js`

**Test cases:**
- Create consent request → record created with pending status and 48h TTL
- Grant consent → status updated, child activated, parent link created, TTL removed
- Deny consent → child user deleted, consent record marked 'denied'
- Expired token → 410 response
- Reused token → 409 response
- Rate limit: 4th request-consent in 1 hour → 429
- Parent email === child email → 400

**Acceptance Criteria:**
- All tests pass
- Tests use mock DB adapter
- Tests cover happy path + all error paths

---

## EPIC-3: Account Deletion

**Goal:** Any user can delete their account. Parents can delete child accounts. All data is cascade-deleted.

---

### T-3.1 — Create Cascade Deletion Module

**Description:** Create `src/account/accountDeletion.js` that deletes a user and ALL associated data across every DynamoDB table and S3.

**Files to create:**
- `src/account/accountDeletion.js`

**Implementation:** See the cascade deletion logic in the implementation spec (Feature 4.4). Must delete from: users, attempts, worksheets (DynamoDB + S3), aggregates, certificates, parentlinks, memberships, feedback, guestsessions, userquestionhistory.

Must NOT delete: consentrecords (retained 3 years), adminauditeventss (retained for compliance).

Log every deletion action to console (structured JSON) for audit trail.

**Acceptance Criteria:**
- `cascadeDeleteUser(userId)` removes all records across all tables
- S3 worksheet files are deleted
- Consent records are NOT deleted
- Function is idempotent (calling twice doesn't error)
- Returns a summary: `{ tablesProcessed: 10, recordsDeleted: N }`

**API changes:** None (internal module)
**Database changes:** Deletes across multiple tables
**Frontend changes:** None
**Security:** This is a destructive operation. Must only be callable from authenticated, authorized endpoints. Never expose directly.

---

### T-3.2 — Create DELETE /api/account Endpoint

**Description:** Authenticated user requests their own account deletion. 7-day cooling-off period.

**Files to create:**
- `backend/handlers/accountHandler.js`

**Files to modify:**
- `server.js` — add routes

**Implementation:**
- Validate token, confirm email match
- Set `accountStatus: 'pending_deletion'`, `deletionScheduledAt`
- Send confirmation email with cancel link
- Return `{ deletionId, scheduledAt, cancelUrl }`

For the actual deletion after 7 days: use DynamoDB TTL on `deletionScheduledAt` field + DynamoDB Streams → Lambda trigger to call `cascadeDeleteUser()`. For local dev, check on server startup.

**Acceptance Criteria:**
- `DELETE /api/account` with matching email → 200, account marked for deletion
- Email confirmation sent
- User can still log in during 7-day period
- After 7 days, account and all data are deleted

**API changes:** New `DELETE /api/account`
**Database changes:** Updates user record with deletion fields
**Frontend changes:** None (handled by T-3.5)
**Security:** Require email confirmation in request body to prevent CSRF-style attacks.

---

### T-3.3 — Create Cancel-Deletion Endpoint

**Description:** `POST /api/account/cancel-deletion` — user cancels pending deletion.

**Files to modify:**
- `backend/handlers/accountHandler.js`
- `server.js` — add route

**Implementation:** Reset `accountStatus` to `'active'`, remove `deletionScheduledAt`.

**Acceptance Criteria:**
- Cancel before 7 days → account restored to active
- Cancel when no pending deletion → 400

---

### T-3.4 — Create Parent Child-Deletion Endpoint

**Description:** `DELETE /api/account/child/:childUserId` — parent deletes child account immediately (no cooling-off per COPPA).

**Files to modify:**
- `backend/handlers/accountHandler.js`
- `server.js` — add route

**Implementation:**
1. `assertParentLink(decoded, childUserId)`
2. Call `cascadeDeleteUser(childUserId)` immediately
3. Call `revokeConsent(childUserId)` in consent store
4. Return success

**Acceptance Criteria:**
- Parent with active link → child account deleted immediately
- Non-parent → 403
- Parent without link to child → 403
- Consent record updated to 'revoked'
- All child data removed from all tables

**API changes:** New `DELETE /api/account/child/:childUserId`
**Database changes:** Cascade delete across tables
**Frontend changes:** None (used from T-4.4 parent dashboard)
**Security:** `assertParentLink` is the authorization gate. Verify it works correctly.

---

### T-3.5 — Wire Up SettingsPage Deletion UI

**Description:** Connect the existing "Delete Account" button in `SettingsPage.tsx` (lines 696-712) to the real API. Add confirmation modal.

**Files to modify:**
- `learnfyra-app/src/pages/SettingsPage.tsx`

**Implementation:**
- Click "Delete My Account" → open confirmation modal
- Modal: warning text, email input, "Delete Everything" button (destructive variant)
- On confirm: `DELETE /api/account` with `{ confirmEmail }`
- On success: show toast "Account scheduled for deletion in 7 days", add cancellation banner
- Wire "Export My Data" button to `GET /api/parent/children/:id/export` (or a new `/api/account/export` endpoint — reuse the export logic from T-4.2)

**Acceptance Criteria:**
- Clicking delete opens modal
- Must type email to confirm
- API call succeeds → toast + cancellation info shown
- Cancel link works during 7-day period

---

### T-3.6 — Unit Tests for Account Deletion

**Files to create:**
- `tests/unit/accountDeletion.test.js`
- `tests/unit/accountHandler.test.js`

**Test cases:**
- Cascade delete removes data from all tables
- Consent records are NOT deleted
- S3 files are deleted
- DELETE /api/account with wrong email → 400
- Cancel deletion restores account
- Parent child deletion requires active parent link
- Parent child deletion revokes consent

---

## EPIC-4: Privacy Dashboard for Parents

**Goal:** Parents can view, export, and manage their linked children's data.

---

### T-4.1 — Create GET /api/parent/children Endpoint

**Description:** Returns list of parent's linked children with summary stats.

**Files to create:**
- `backend/handlers/parentHandler.js`

**Files to modify:**
- `server.js` — add route

**Implementation:**
1. `assertRole(decoded, ['parent'])`
2. Query `parentLinks` by `parentId` where `status === 'active'`
3. For each child: fetch user record + count attempts + get last active date
4. Return children array

**Acceptance Criteria:**
- Parent with 2 children → returns both with stats
- Parent with 0 children → returns empty array
- Non-parent role → 403
- Includes: displayName, email, grade, accountStatus, worksheetsCompleted, lastActiveAt

---

### T-4.2 — Create GET /api/parent/children/:id/export Endpoint

**Description:** Returns all data for a specific child as downloadable JSON.

**Files to modify:**
- `backend/handlers/parentHandler.js`
- `server.js` — add route

**Implementation:**
1. `assertParentLink(decoded, childUserId)`
2. Gather: user profile, worksheets, attempts, certificates, aggregates
3. Return as JSON with `Content-Disposition: attachment` header

**Acceptance Criteria:**
- Returns complete child data as JSON
- No data from other users included
- Browser triggers file download
- Non-linked parent → 403

---

### T-4.3 — Create POST /api/parent/children/:id/revoke-consent

**Description:** Parent revokes consent → child account deactivated and scheduled for deletion.

**Files to modify:**
- `backend/handlers/parentHandler.js`
- `server.js` — add route

**Implementation:**
1. `assertParentLink(decoded, childUserId)`
2. Call `revokeConsent(childUserId)` in consent store
3. Set child `accountStatus: 'suspended'`
4. Schedule cascade deletion in 72 hours
5. Return success message

**Acceptance Criteria:**
- Consent record updated to 'revoked' with timestamp
- Child cannot log in after revocation
- Data deleted within 72 hours
- Non-linked parent → 403

---

### T-4.4 — Create ParentDashboardPage (Frontend)

**Description:** New page at `/parent/children` showing linked children with action buttons.

**Files to create:**
- `learnfyra-app/src/pages/ParentDashboardPage.tsx`

**Files to modify:**
- `learnfyra-app/src/App.tsx` — add route (auth-guarded, parent role only)

**Implementation:**
- Fetch children on mount: `GET /api/parent/children`
- Render card for each child with stats
- "Download Data" → triggers export download
- "Revoke Consent" → confirmation modal → calls revoke endpoint
- "Delete Account" → confirmation modal → calls child deletion endpoint (T-3.4)
- Add navigation link in sidebar/navbar for parent role users

**Acceptance Criteria:**
- Page renders with child cards
- Download creates a JSON file in browser
- Revoke consent shows confirmation, then deactivates child
- Delete shows confirmation, then removes child data
- Page is only accessible to parent role

---

### T-4.5 — Unit Tests for Parent Dashboard

**Files to create:**
- `tests/unit/parentHandler.test.js`

**Test cases:**
- List children with correct stats
- Export returns complete data
- Revoke consent updates records correctly
- All endpoints enforce parent role + parent link
- Non-parent gets 403

---

## EPIC-5: Legal Pages, Labels & Config

**Goal:** Quick compliance wins that can be built independently of the COPPA core features.

---

### T-5.1 — Create Privacy Policy Page

**Description:** Static page at `/privacy` with all required COPPA/CCPA sections.

**Files to create:**
- `learnfyra-app/src/pages/legal/PrivacyPolicyPage.tsx`

**Files to modify:**
- `learnfyra-app/src/App.tsx` — add route

**Required sections:** Information We Collect, How We Use It, How We Share It, Children's Privacy (COPPA dedicated section), Data Retention, Your Rights (CCPA), Security, Changes, Contact (privacy@learnfyra.com).

Display `Last updated` date and `Version 1.0` at top.

**Acceptance Criteria:**
- Page renders at `/privacy`
- Contains dedicated "Children's Privacy" section
- Contains "Your Rights" section listing CCPA rights
- Contains contact email
- Version number displayed
- Accessible from footer link (already wired)

---

### T-5.2 — Create Terms of Service Page

**Description:** Static page at `/terms`.

**Files to create:**
- `learnfyra-app/src/pages/legal/TermsOfServicePage.tsx`

**Files to modify:**
- `learnfyra-app/src/App.tsx` — add route

**Required sections:** Acceptance, Service Description, AI Content Disclaimer ("Scores are for self-assessment only"), User Responsibilities, IP, Liability Limitation, Termination, Governing Law, Contact.

**Acceptance Criteria:**
- Page renders at `/terms`
- Contains AI disclaimer
- Accessible from footer link

---

### T-5.3 — Add "Do Not Sell" Link and Page

**Description:** CCPA-required footer link + simple static page.

**Files to create:**
- `learnfyra-app/src/pages/legal/DoNotSellPage.tsx`

**Files to modify:**
- `learnfyra-app/src/components/layout/Footer.tsx` — add link
- `learnfyra-app/src/App.tsx` — add route

**Implementation:** Add `<Link to="/do-not-sell">Do Not Sell My Personal Information</Link>` to footer bottom bar. Page states: "Learnfyra does not sell your personal information."

**Acceptance Criteria:**
- Link visible in footer on every page
- Page renders at `/do-not-sell`
- Page content accurately states Learnfyra's no-sale policy

---

### T-5.4 — Add AI Transparency Label

**Description:** Add "Generated with AI assistance" label to every worksheet output.

**Files to modify:**
- `src/ai/generator.js` — add `aiDisclosure` field to generated worksheet JSON
- `src/exporters/htmlExporter.js` — add footer label to HTML output
- `src/exporters/pdfExporter.js` — add footer label to PDF output
- `learnfyra-app/src/pages/SolvePage.tsx` (or equivalent) — add info banner

**Implementation:**

In `generator.js`, after worksheet JSON is assembled:
```javascript
worksheet.aiDisclosure = {
  generated: true,
  model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  provider: 'Anthropic',
  label: 'Questions generated with AI assistance'
};
```

In HTML exporter, add footer:
```html
<footer class="ai-disclosure"><small>Questions generated with AI assistance</small></footer>
```

In SolvePage, add info banner above or below questions.

**Acceptance Criteria:**
- Every generated worksheet JSON contains `aiDisclosure` field
- HTML export has visible footer label
- PDF export has visible footer label
- Solve page shows disclosure banner
- Label text: "Questions generated with AI assistance"

---

### T-5.5 — Extend Audit Log Retention to 3 Years

**Description:** Change CloudWatch log retention from 1 month to 3 years in CDK stack.

**Files to modify:**
- `infra/cdk/lib/learnfyra-stack.ts` — change all `RetentionDays.ONE_MONTH` to `RetentionDays.THREE_YEARS`

**Implementation:** Find and replace all instances of `RetentionDays.ONE_MONTH` with `RetentionDays.THREE_YEARS` in the stack file. This includes Lambda log groups and API Gateway access logs.

**Acceptance Criteria:**
- `cd infra && npx cdk synth` passes
- All log groups in synthesized template show 1096 days retention
- `npx cdk diff` shows only retention changes (no unintended modifications)

**API changes:** None
**Database changes:** None
**Frontend changes:** None
**Security:** This IS the security control — ensures COPPA compliance records are available for 3 years.

---

### T-5.6 — Enforce Data Minimization for Child Users

**Description:** Strip optional PII fields (studentName, teacherName, className, period) from requests made by child users. Restrict display name to first name only for children.

**Files to modify:**
- `backend/middleware/validator.js` — add `stripChildPII(body, ageGroup)` function
- `backend/handlers/authHandler.js` — truncate displayName to first name for children
- `server.js` (or generate handler) — call `stripChildPII` before processing

**Implementation:**

```javascript
// In validator.js:
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

In registration handler, for child accounts:
```javascript
if (ageGroup === 'child') {
  body.displayName = body.displayName.split(' ')[0]; // first name only
}
```

**Acceptance Criteria:**
- Child user generating a worksheet: studentName, teacherName, className, period are stripped even if provided
- Adult user: fields pass through normally
- Child registration with "Alex Johnson" stores "Alex" only
- Stripped fields do NOT reach the AI prompt (already enforced — verify no regression)

---

## Appendix: Complete New Files List

```
NEW FILES:
  src/utils/ageUtils.js                              (T-1.1)
  src/consent/consentStore.js                        (T-2.2)
  src/consent/consentEmailTemplate.js                (T-2.6)
  src/account/accountDeletion.js                     (T-3.1)
  backend/handlers/accountHandler.js                 (T-3.2)
  backend/handlers/parentHandler.js                  (T-4.1)
  learnfyra-app/src/components/ui/DateOfBirthSelect.tsx  (T-1.5/T-1.6)
  learnfyra-app/src/pages/AgeVerificationPage.tsx    (T-1.6)
  learnfyra-app/src/pages/ConsentPendingPage.tsx     (T-2.7)
  learnfyra-app/src/pages/ParentalConsentPage.tsx    (T-2.8)
  learnfyra-app/src/pages/ParentDashboardPage.tsx    (T-4.4)
  learnfyra-app/src/pages/legal/PrivacyPolicyPage.tsx    (T-5.1)
  learnfyra-app/src/pages/legal/TermsOfServicePage.tsx   (T-5.2)
  learnfyra-app/src/pages/legal/DoNotSellPage.tsx        (T-5.3)
  tests/unit/ageUtils.test.js                        (T-1.7)
  tests/unit/ageGateRegistration.test.js             (T-1.7)
  tests/unit/consentStore.test.js                    (T-2.10)
  tests/unit/consentEndpoints.test.js                (T-2.10)
  tests/unit/accountDeletion.test.js                 (T-3.6)
  tests/unit/accountHandler.test.js                  (T-3.6)
  tests/unit/parentHandler.test.js                   (T-4.5)

MODIFIED FILES:
  src/auth/mockAuthAdapter.js                        (T-1.2)
  backend/handlers/authHandler.js                    (T-1.3, T-1.4, T-2.3, T-2.4, T-2.5)
  backend/middleware/validator.js                     (T-5.6)
  backend/middleware/authMiddleware.js                (T-1.4 — limited-scope token check)
  server.js                                          (T-1.4, T-2.3-T-2.5, T-3.2-T-3.4, T-4.1-T-4.3)
  infra/cdk/lib/learnfyra-stack.ts                   (T-2.1, T-2.9, T-5.5)
  scripts/bootstrap-local-db.js                      (T-2.1)
  src/ai/generator.js                                (T-5.4)
  src/exporters/htmlExporter.js                      (T-5.4)
  src/exporters/pdfExporter.js                       (T-5.4)
  learnfyra-app/src/components/AuthModal.tsx          (T-1.5)
  learnfyra-app/src/lib/emailAuth.ts                  (T-1.5)
  learnfyra-app/src/pages/SettingsPage.tsx            (T-3.5)
  learnfyra-app/src/components/layout/Footer.tsx      (T-5.3)
  learnfyra-app/src/App.tsx                           (T-1.6, T-2.7, T-2.8, T-4.4, T-5.1-T-5.3)
  learnfyra-app/src/pages/SolvePage.tsx               (T-5.4)
```

---

*Each task is designed to be copy-pasted as a prompt to Claude Code. Include the task description, acceptance criteria, file paths, and implementation details in the prompt for best results.*
