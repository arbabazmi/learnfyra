# Learnfyra — MUST HAVE Compliance: Implementation Specification

**Document ID:** LFR-IMPL-COMPLIANCE-001
**Version:** 1.0
**Date:** April 3, 2026
**Source:** LFR-AUDIT-001 (MUST HAVE classification)
**Validated Against:** Codebase commit `45050ef`
**Author:** Product Manager / System Architect
**Audience:** Engineering (DEV, QA, DevOps), Product

---

## Table of Contents

1. [Feature 1 — Age Gate at Registration](#feature-1--age-gate-at-registration)
2. [Feature 2 — Parental Consent Workflow (VPC)](#feature-2--parental-consent-workflow-vpc)
3. [Feature 3 — Consent Record Storage](#feature-3--consent-record-storage)
4. [Feature 4 — Account Deletion (Full Stack)](#feature-4--account-deletion-full-stack)
5. [Feature 5 — Privacy Dashboard for Parents](#feature-5--privacy-dashboard-for-parents)
6. [Feature 6 — Privacy Policy and Terms of Service Pages](#feature-6--privacy-policy-and-terms-of-service-pages)
7. [Feature 7 — "Do Not Sell" Link (CCPA)](#feature-7--do-not-sell-link-ccpa)
8. [Feature 8 — AI Transparency Label](#feature-8--ai-transparency-label)
9. [Feature 9 — Audit Log Retention (3 Years)](#feature-9--audit-log-retention-3-years)
10. [Feature 10 — Data Minimization Enforcement for Children](#feature-10--data-minimization-enforcement-for-children)
11. [Implementation Dependency Graph](#implementation-dependency-graph)
12. [New DynamoDB Tables Summary](#new-dynamodb-tables-summary)
13. [New API Endpoints Summary](#new-api-endpoints-summary)

---

## Feature 1 — Age Gate at Registration

**Source Requirement:** FR-02, COPPA-01
**Priority:** P0 — Build first (all other COPPA features depend on this)
**Estimated Effort:** 2-3 days

### Product Feature

When a user registers (email signup OR Google OAuth), the system collects date of birth and routes users into age-appropriate flows:

| Age | Flow |
|---|---|
| Under 13 | Block account activation. Route to Parental Consent (Feature 2). Collect minimal data only. |
| 13-17 | Standard registration with simplified privacy notice. |
| 18+ | Standard registration. |

### Backend Requirements

#### 1.1 Modify User Schema

**File:** `src/auth/mockAuthAdapter.js` (local) + DynamoDB `LearnfyraUsers-{env}` table

Add fields to user record:

```javascript
{
  // ... existing fields (userId, email, passwordHash, role, displayName, authType, createdAt, lastActiveAt)
  dateOfBirth: '2015-06-15',          // ISO date string, encrypted at rest
  ageGroup: 'child',                   // 'child' (<13) | 'teen' (13-17) | 'adult' (18+)
  accountStatus: 'active',             // 'pending_consent' | 'active' | 'suspended' | 'deleted'
  consentStatus: 'not_required',       // 'not_required' | 'pending' | 'granted' | 'revoked'
  parentEmail: null,                   // string — only set for child accounts
}
```

#### 1.2 Modify Registration Endpoint

**File:** `backend/handlers/authHandler.js` — `handleRegister(body)`

**Current signature:** `{ email, password, role, displayName }`
**New signature:** `{ email, password, role, displayName, dateOfBirth }`

```javascript
// Pseudocode for age gate logic in handleRegister
const dob = new Date(body.dateOfBirth);
const age = calculateAge(dob); // utility function

if (age < 13) {
  // Create user with accountStatus: 'pending_consent'
  // Do NOT issue JWT token yet
  // Return { userId, accountStatus: 'pending_consent', requiresConsent: true }
  // Trigger parental consent flow (Feature 2)
} else if (age < 18) {
  // Create user with accountStatus: 'active', ageGroup: 'teen'
  // Issue token normally
  // Return standard { userId, email, role, displayName, token }
} else {
  // Create user with accountStatus: 'active', ageGroup: 'adult'
  // Issue token normally
}
```

**Validation rules:**
- `dateOfBirth` is REQUIRED for all new registrations
- Format: `YYYY-MM-DD` (validated with regex + Date parse)
- Must be a date in the past (not future)
- Minimum age: 5 years (Grade 1 is ~6 years old)
- Maximum age: 120 years (sanity check)

**API Response change:**

```javascript
// NEW response for under-13:
{
  userId: 'uuid',
  accountStatus: 'pending_consent',
  requiresConsent: true,
  message: 'Parental consent required. Please ask your parent to check their email.'
}

// Existing response for 13+:
{
  userId: 'uuid',
  email: 'user@example.com',
  role: 'student',
  displayName: 'John',
  token: 'jwt...'
}
```

#### 1.3 Modify OAuth Callback

**File:** `backend/handlers/authHandler.js` — `handleOAuthCallback(provider, queryParams)`

Google OAuth does not provide date of birth. After OAuth callback:

1. Create user record with `accountStatus: 'pending_age_verification'`
2. Issue a limited-scope token (claim: `scope: 'age_verification_only'`)
3. Redirect to `/auth/age-verification` (new frontend page)
4. User enters DOB on the age verification page
5. `PATCH /api/auth/verify-age` completes the flow

**New endpoint:**

```
PATCH /api/auth/verify-age
Authorization: Bearer <limited-scope-token>
Body: { dateOfBirth: '2015-06-15' }

Response (under 13):
  { accountStatus: 'pending_consent', requiresConsent: true }

Response (13+):
  { accountStatus: 'active', token: '<full-access-jwt>' }
```

#### 1.4 Age Calculation Utility

**New file:** `src/utils/ageUtils.js`

```javascript
/**
 * Calculate age from date of birth.
 * Uses UTC to avoid timezone edge cases.
 */
export function calculateAge(dob) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function getAgeGroup(age) {
  if (age < 13) return 'child';
  if (age < 18) return 'teen';
  return 'adult';
}
```

### Frontend Requirements

#### 1.5 Modify AuthModal Signup Step

**File:** `learnfyra-app/src/components/AuthModal.tsx` — step `'email-signup'`

**Current fields:** displayName, email, password, confirmPassword, role
**Add field:** Date of Birth

```
┌──────────────────────────────────────┐
│  Create Your Account                  │
│                                       │
│  Full Name  [________________]        │
│  Email      [________________]        │
│  Date of Birth                        │
│  [Month ▾] [Day ▾] [Year ▾]         │  ← 3 dropdowns (NOT a free text input)
│  Password   [________________]        │
│  Confirm    [________________]        │
│  Role       ○ Student ○ Teacher ○ Parent │
│                                       │
│  [Create Account]                     │
└──────────────────────────────────────┘
```

**UX decisions:**
- Use three dropdown selects (Month, Day, Year) instead of a date picker — prevents typos, works on all devices, and is the FTC-recommended pattern for age gates
- Year dropdown range: current year minus 5 → current year minus 120
- Month names in English (January, February, ...) — not numbers
- Do NOT display the calculated age back to the user (prevents children from lying)
- DOB field appears BEFORE email/password fields (collect age first per COPPA)

#### 1.6 New Page: Age Verification (OAuth)

**New file:** `learnfyra-app/src/pages/AgeVerificationPage.tsx`
**Route:** `/auth/age-verification`

Simple page with:
- Learnfyra logo
- "One more step! Please enter your date of birth."
- Same 3-dropdown DOB selector
- Submit button → `PATCH /api/auth/verify-age`
- On success (13+): redirect to `/dashboard`
- On under-13: redirect to `/auth/parental-consent-pending`

### Data Requirements

| Field | Table | Column | Type | Encryption | Index |
|---|---|---|---|---|---|
| dateOfBirth | LearnfyraUsers | dateOfBirth | String (YYYY-MM-DD) | DynamoDB default AES-256 | None (never queried by DOB) |
| ageGroup | LearnfyraUsers | ageGroup | String enum | No | None |
| accountStatus | LearnfyraUsers | accountStatus | String enum | No | New GSI: `accountStatus-index` (PK: accountStatus) for admin queries |
| consentStatus | LearnfyraUsers | consentStatus | String enum | No | None |
| parentEmail | LearnfyraUsers | parentEmail | String | DynamoDB default AES-256 | None |

---

## Feature 2 — Parental Consent Workflow (VPC)

**Source Requirement:** FR-01, COPPA-01
**Priority:** P0 — Depends on Feature 1
**Estimated Effort:** 3-5 days

### Product Feature

When a child under 13 registers, the system:
1. Collects the parent's email address
2. Sends a consent verification email to the parent
3. Parent clicks the link, lands on a consent page
4. Parent reviews what data is collected, confirms consent
5. Child's account is activated
6. If no consent within 48 hours, child's data is auto-deleted

### Backend Requirements

#### 2.1 New Endpoint: Request Parental Consent

```
POST /api/auth/request-consent
Body: {
  childUserId: 'uuid',         // the child's pending account
  parentEmail: 'parent@email.com'
}

Response (200):
{
  consentRequestId: 'uuid',
  message: 'Consent email sent to parent@email.com',
  expiresAt: '2026-04-05T12:00:00Z'  // 48 hours from now
}
```

**Logic:**
1. Validate `childUserId` exists and has `accountStatus: 'pending_consent'`
2. Generate a consent token (UUID v4, NOT a JWT — one-time use)
3. Store consent request in new `LearnfyraConsentRecords` table (see Feature 3)
4. Send email via nodemailer (already a dependency) with link: `{FRONTEND_URL}/auth/parental-consent?token={consentToken}`
5. Set TTL on consent record: 48 hours

**Email template content:**
- Subject: "Learnfyra — Parental Consent Required for [childDisplayName]"
- Body: Plain language description of what data is collected (email, display name, grade level, worksheet answers, scores)
- Clear "I Consent" button/link
- Link to full Privacy Policy

#### 2.2 New Endpoint: Verify Parental Consent

```
POST /api/auth/verify-consent
Body: {
  consentToken: 'uuid',
  parentName: 'Jane Doe',           // parent's full name (required for record)
  parentRelationship: 'parent'      // 'parent' | 'legal_guardian'
}

Response (200):
{
  childUserId: 'uuid',
  accountStatus: 'active',
  message: 'Consent verified. Your child can now use Learnfyra.'
}
```

**Logic:**
1. Look up consent record by `consentToken`
2. Validate token is not expired (48-hour TTL)
3. Validate token has not been used (one-time use)
4. Update child's user record: `accountStatus: 'active'`, `consentStatus: 'granted'`
5. Create parent-child link in `LearnfyraParentLinks` table
6. Update consent record: `status: 'granted'`, `grantedAt`, `parentName`, `parentRelationship`
7. Mark consent token as used

#### 2.3 Cleanup Job: Delete Expired Pending Accounts

**File:** `backend/handlers/consentCleanupHandler.js`
**Trigger:** CloudWatch Events rule (run every 6 hours) OR DynamoDB TTL

Option A (recommended): Use DynamoDB TTL on `LearnfyraUsers` table with a `pendingExpiresAt` field. When TTL expires, DynamoDB auto-deletes the record. No Lambda needed.

Option B: Lambda triggered by EventBridge every 6 hours:
- Scan `LearnfyraUsers` where `accountStatus = 'pending_consent'` AND `createdAt < (now - 48h)`
- Delete user record
- Delete consent record
- Log deletion

### Frontend Requirements

#### 2.4 New Page: Consent Pending (Child View)

**New file:** `learnfyra-app/src/pages/ConsentPendingPage.tsx`
**Route:** `/auth/consent-pending`

```
┌──────────────────────────────────────────┐
│  [Learnfyra Logo]                         │
│                                           │
│  Almost there!                            │
│                                           │
│  We sent an email to your parent at       │
│  p****@email.com                          │
│                                           │
│  Ask them to check their email and click  │
│  "I Consent" so you can start learning!   │
│                                           │
│  [Resend Email]        [Use Different Email] │
│                                           │
│  This link expires in 47 hours.           │
└──────────────────────────────────────────┘
```

- "Resend Email" → `POST /api/auth/request-consent` (rate limited: max 3 per hour)
- "Use Different Email" → shows input to change parent email, then resends
- Countdown timer showing remaining hours
- No access to dashboard or worksheets until consent is granted

#### 2.5 New Page: Parental Consent Form (Parent View)

**New file:** `learnfyra-app/src/pages/ParentalConsentPage.tsx`
**Route:** `/auth/parental-consent?token={consentToken}`

```
┌──────────────────────────────────────────────────┐
│  [Learnfyra Logo]                                 │
│                                                   │
│  Parental Consent for Learnfyra                   │
│                                                   │
│  Your child [childDisplayName] wants to use       │
│  Learnfyra, an educational worksheet platform.    │
│                                                   │
│  What we collect:                                 │
│  * Email address (for account login)              │
│  * Display name (first name only)                 │
│  * Grade level (to align worksheets)              │
│  * Worksheet answers and scores (for progress)    │
│                                                   │
│  What we DO NOT do:                               │
│  * We never sell your child's data                │
│  * We never show ads to your child                │
│  * We never share personal data with the AI       │
│  * Your child's data is encrypted at all times    │
│                                                   │
│  Your rights:                                     │
│  * View all of your child's data at any time      │
│  * Download your child's data                     │
│  * Delete your child's account and all data       │
│  * Revoke this consent at any time                │
│                                                   │
│  [Read Full Privacy Policy]                       │
│                                                   │
│  Your Name     [________________]                 │
│  Relationship  [Parent ▾ / Legal Guardian ▾]      │
│                                                   │
│  ☐ I have read the Privacy Policy and consent     │
│    to Learnfyra collecting the data described     │
│    above for my child's educational use.          │
│                                                   │
│  [I Consent]                    [I Do Not Consent]│
│                                                   │
│  If you do not consent, your child's pending      │
│  account will be automatically deleted.           │
└──────────────────────────────────────────────────┘
```

- "I Consent" → `POST /api/auth/verify-consent`
- "I Do Not Consent" → `POST /api/auth/deny-consent` → immediately deletes child data
- "Read Full Privacy Policy" → opens `/privacy` in new tab

### Data Requirements

See Feature 3 (Consent Record Storage) for the full table schema.

---

## Feature 3 — Consent Record Storage

**Source Requirement:** COPPA-09, FR-08
**Priority:** P0 — Required by Feature 2
**Estimated Effort:** 1-2 days

### Product Feature

Every parental consent action is recorded in an immutable, auditable log retained for 3 years.

### Backend Requirements

#### 3.1 New DynamoDB Table: `LearnfyraConsentRecords-{env}`

| Attribute | Type | Description |
|---|---|---|
| `consentId` (PK) | String (UUID v4) | Unique consent record ID |
| `consentToken` | String (UUID v4) | One-time use token sent in email |
| `childUserId` | String | Child's user ID |
| `childEmail` | String | Child's email (for audit trail) |
| `parentEmail` | String | Parent's email (where consent was sent) |
| `parentName` | String | Parent's name (entered at consent) |
| `parentRelationship` | String | 'parent' or 'legal_guardian' |
| `status` | String | 'pending' / 'granted' / 'denied' / 'revoked' / 'expired' |
| `requestedAt` | String (ISO-8601) | When consent was first requested |
| `grantedAt` | String (ISO-8601) | When consent was granted (null if not) |
| `revokedAt` | String (ISO-8601) | When consent was revoked (null if not) |
| `expiresAt` | Number (Unix) | TTL for pending records (48 hours) |
| `method` | String | 'email_plus' (FTC-approved method) |
| `ipAddress` | String | IP of the parent who consented (for audit) |
| `userAgent` | String | Browser info of consenting parent |
| `privacyPolicyVersion` | String | Version of privacy policy shown at consent time |
| `retainUntil` | Number (Unix) | 3 years from grantedAt — DO NOT TTL delete before this |

**GSIs:**
- `childUserId-index` (PK: childUserId) — look up consent by child
- `parentEmail-index` (PK: parentEmail) — look up all consents by parent

**Retention:** Records with `status: 'granted'` or `'revoked'` are retained for 3 years (COPPA 312.10). Pending records expire via DynamoDB TTL after 48 hours.

#### 3.2 Consent Record API (Internal)

These are used by other handlers, not exposed as public endpoints:

```javascript
// src/consent/consentStore.js
export async function createConsentRequest({ childUserId, childEmail, parentEmail }) → consentRecord
export async function getConsentByToken(consentToken) → consentRecord | null
export async function grantConsent(consentId, { parentName, parentRelationship, ipAddress, userAgent }) → updatedRecord
export async function revokeConsent(childUserId, { reason, revokedBy }) → updatedRecord
export async function getConsentsByChild(childUserId) → consentRecord[]
export async function getConsentsByParent(parentEmail) → consentRecord[]
```

### Data Requirements

**CDK changes in `learnfyra-stack.ts`:**

```typescript
const consentRecordsTable = this.createTable('ConsentRecords', 'consentId', undefined, {
  // GSIs
  globalSecondaryIndexes: [
    { indexName: 'childUserId-index', partitionKey: { name: 'childUserId', type: AttributeType.STRING } },
    { indexName: 'parentEmail-index', partitionKey: { name: 'parentEmail', type: AttributeType.STRING } },
  ],
  timeToLiveAttribute: 'expiresAt',
  pointInTimeRecovery: true,    // ALWAYS — these are legal compliance records
});
```

**Environment variable:** `CONSENT_RECORDS_TABLE_NAME` — injected into auth handler Lambda.

---

## Feature 4 — Account Deletion (Full Stack)

**Source Requirement:** FR-07, CCPA-02, COPPA-03, COPPA-06
**Priority:** P0
**Estimated Effort:** 2-3 days

### Product Feature

Any user (or parent of a child) can delete their account. All personal data is permanently removed within 30 days, with a 7-day cooling-off period to cancel.

### Backend Requirements

#### 4.1 New Endpoint: Request Account Deletion

```
DELETE /api/account
Authorization: Bearer <token>
Body: { confirmEmail: 'user@email.com' }  // must match authenticated email

Response (200):
{
  deletionId: 'uuid',
  scheduledAt: '2026-04-10T12:00:00Z',  // 7 days from now
  message: 'Account scheduled for deletion. You have 7 days to cancel.',
  cancelUrl: '/settings?cancel-deletion=true'
}
```

**Logic:**
1. Validate token + confirm email matches authenticated user
2. Set user `accountStatus: 'pending_deletion'`, `deletionScheduledAt: <7 days from now>`
3. Create deletion request record (for audit)
4. Send confirmation email: "Your Learnfyra account is scheduled for deletion on [date]. Click here to cancel."
5. User can still log in during 7-day period but sees a banner

#### 4.2 New Endpoint: Cancel Account Deletion

```
POST /api/account/cancel-deletion
Authorization: Bearer <token>

Response (200):
{
  accountStatus: 'active',
  message: 'Account deletion cancelled.'
}
```

#### 4.3 New Endpoint: Delete Child Account (Parent)

```
DELETE /api/account/child/:childUserId
Authorization: Bearer <parent-token>
Body: { confirmChildEmail: 'child@email.com' }

Response (200):
{
  message: 'Child account and all associated data will be deleted within 72 hours.'
}
```

**Logic:**
1. `assertParentLink(decoded, childUserId)` — verify parent-child link
2. Mark child `accountStatus: 'deleted'`
3. Trigger cascade deletion (below)
4. Revoke consent record
5. No cooling-off for parent-initiated child deletion (COPPA requires prompt action)

#### 4.4 Cascade Deletion Logic

**New file:** `src/account/accountDeletion.js`

When an account is deleted, purge ALL data across ALL tables:

```javascript
export async function cascadeDeleteUser(userId) {
  const db = getDbAdapter();

  // 1. Delete from LearnfyraUsers
  await db.deleteItem('users', userId);

  // 2. Delete all attempts by this user
  const attempts = await db.queryByField('attempts', 'studentId', userId);
  for (const a of attempts) await db.deleteItem('attempts', a.attemptId);

  // 3. Delete all worksheets created by this user
  const worksheets = await db.queryByField('worksheets', 'createdBy', userId);
  for (const w of worksheets) {
    await db.deleteItem('worksheets', w.worksheetId);
    // Also delete S3 files if they exist
    await deleteS3Prefix(`worksheets/${w.worksheetId}/`);
  }

  // 4. Delete aggregates
  const aggregates = await db.queryByField('aggregates', 'id', userId); // prefix match
  for (const a of aggregates) await db.deleteItem('aggregates', a.id);

  // 5. Delete certificates
  const certs = await db.queryByField('certificates', 'studentId', userId);
  for (const c of certs) await db.deleteItem('certificates', c.id);

  // 6. Delete parent links (both directions)
  const parentLinks = await db.queryByField('parentlinks', 'parentId', userId);
  const childLinks = await db.queryByField('parentlinks', 'childId', userId);
  for (const l of [...parentLinks, ...childLinks]) await db.deleteItem('parentlinks', l.id);

  // 7. Delete memberships
  const memberships = await db.queryByField('memberships', 'studentId', userId);
  for (const m of memberships) await db.deleteItem('memberships', m.id);

  // 8. Delete feedback
  const feedback = await db.queryByField('feedback', 'userId', userId);
  for (const f of feedback) await db.deleteItem('feedback', f.feedbackId);

  // 9. Delete guest sessions
  const guests = await db.queryByField('guestsessions', 'PK', `GUEST#${userId}`);
  for (const g of guests) await db.deleteItem('guestsessions', g.PK);

  // 10. Delete question history
  const qHistory = await db.queryByField('userquestionhistory', 'PK', userId);
  for (const q of qHistory) await db.deleteItem('userquestionhistory', q.PK);

  // 11. DO NOT delete consent records (retained 3 years for COPPA compliance)
  // 12. DO NOT delete admin audit events (retained for compliance)

  // 13. Log the deletion
  await logDeletionEvent(userId);
}
```

#### 4.5 Scheduled Deletion Processor

**Option A (recommended):** DynamoDB TTL on `deletionScheduledAt` field in Users table. When TTL fires, a DynamoDB Stream triggers a Lambda that runs `cascadeDeleteUser()`.

**Option B:** EventBridge rule runs every hour, scans for `accountStatus: 'pending_deletion'` AND `deletionScheduledAt < now`.

### Frontend Requirements

#### 4.6 Modify SettingsPage Delete Account Section

**File:** `learnfyra-app/src/pages/SettingsPage.tsx` (lines 696-712)

Replace the TODO button with a working flow:

```
┌──────────────────────────────────────────┐
│  Danger Zone                              │
│                                           │
│  [Export My Data]  (downloads JSON)       │
│                                           │
│  Delete Account                           │
│  This will permanently delete your        │
│  account and all associated data.         │
│  This action cannot be undone.            │
│                                           │
│  [Delete My Account]  (red button)        │
└──────────────────────────────────────────┘

→ Click triggers confirmation modal:

┌──────────────────────────────────────────┐
│  Are you sure?                            │
│                                           │
│  This will permanently delete:            │
│  * Your profile and login                 │
│  * All worksheets you created             │
│  * All scores and progress data           │
│  * All certificates earned                │
│                                           │
│  Type your email to confirm:              │
│  [________________________]               │
│                                           │
│  [Cancel]          [Delete Everything]    │
│                                           │
│  You will have 7 days to change your mind.│
└──────────────────────────────────────────┘
```

### Data Requirements

**New fields on LearnfyraUsers table:**

| Field | Type | Description |
|---|---|---|
| `deletionScheduledAt` | Number (Unix) | When account will be auto-deleted (7 days from request) |
| `deletionRequestedAt` | String (ISO-8601) | When user requested deletion |

---

## Feature 5 — Privacy Dashboard for Parents

**Source Requirement:** FR-03, COPPA-03
**Priority:** P0 — Depends on Features 1 and 2
**Estimated Effort:** 3-5 days

### Product Feature

Authenticated parents see a "My Children" section in their dashboard. For each linked child, they can:
- View all data collected
- Download data as JSON
- Delete child's account
- Revoke consent

### Backend Requirements

#### 5.1 New Endpoint: Get Child Data Summary

```
GET /api/parent/children
Authorization: Bearer <parent-token>

Response (200):
{
  children: [
    {
      childUserId: 'uuid',
      displayName: 'Alex',
      email: 'alex@email.com',
      grade: '3',
      accountStatus: 'active',
      consentGrantedAt: '2026-03-15T10:00:00Z',
      stats: {
        worksheetsCompleted: 15,
        totalAttempts: 23,
        lastActiveAt: '2026-04-01T14:30:00Z'
      }
    }
  ]
}
```

**Logic:**
1. `assertRole(decoded, ['parent'])`
2. Query `parentLinks` by `parentId` where `status === 'active'`
3. For each linked child, fetch user record + aggregate stats

#### 5.2 New Endpoint: Export Child Data

```
GET /api/parent/children/:childUserId/export
Authorization: Bearer <parent-token>

Response (200): application/json
{
  exportedAt: 'ISO-8601',
  child: { userId, displayName, email, grade, createdAt },
  worksheets: [ { worksheetId, title, subject, grade, createdAt } ],
  attempts: [ { attemptId, worksheetId, score, percentage, completedAt } ],
  certificates: [ { id, title, earnedAt } ]
}
```

**Logic:**
1. `assertParentLink(decoded, childUserId)`
2. Gather all child data from all tables
3. Return as JSON (no PII from other users)

#### 5.3 New Endpoint: Revoke Consent

```
POST /api/parent/children/:childUserId/revoke-consent
Authorization: Bearer <parent-token>
Body: { reason: 'optional string' }

Response (200):
{
  message: 'Consent revoked. Your child's account will be deactivated and data deleted within 72 hours.'
}
```

**Logic:**
1. `assertParentLink(decoded, childUserId)`
2. Update consent record: `status: 'revoked'`, `revokedAt: now`
3. Set child `accountStatus: 'suspended'`
4. Schedule cascade deletion (72 hours)

### Frontend Requirements

#### 5.4 New Page: Parent Privacy Dashboard

**New file:** `learnfyra-app/src/pages/ParentDashboardPage.tsx`
**Route:** `/parent/children` (add to router, guarded by `role === 'parent'`)

```
┌──────────────────────────────────────────────────┐
│  My Children                                      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Alex (alex@email.com)          Grade 3     │ │
│  │  Status: Active                              │ │
│  │  Consent given: March 15, 2026              │ │
│  │  Worksheets: 15  |  Last active: Apr 1      │ │
│  │                                              │ │
│  │  [View Data] [Download Data] [Revoke Consent]│ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [Link Another Child]                             │
└──────────────────────────────────────────────────┘
```

- "View Data" → expands inline detail panel showing worksheets, scores, attempts
- "Download Data" → `GET /api/parent/children/:id/export` → browser downloads JSON file
- "Revoke Consent" → confirmation modal → `POST /api/parent/children/:id/revoke-consent`

### Data Requirements

No new tables. Uses existing `parentLinks`, `users`, `attempts`, `worksheets`, `certificates` tables.

New environment variable for Lambda: `CONSENT_RECORDS_TABLE_NAME`.

---

## Feature 6 — Privacy Policy and Terms of Service Pages

**Source Requirement:** COPPA-02, CCPA-05
**Priority:** P0
**Estimated Effort:** 1-2 days (engineering) + legal review (parallel)

### Product Feature

Static legal pages accessible from the footer. Must include a dedicated Children's Privacy section.

### Backend Requirements

None. These are static frontend pages. Content can be served as React components or fetched from a CMS/S3 (React components recommended for MVP).

### Frontend Requirements

#### 6.1 Privacy Policy Page

**New file:** `learnfyra-app/src/pages/legal/PrivacyPolicyPage.tsx`
**Route:** `/privacy`

**Required sections (COPPA + CCPA):**
1. Information We Collect
2. How We Use Your Information
3. How We Share Your Information (answer: we don't sell it)
4. **Children's Privacy** (dedicated section — COPPA requirement)
   - What data we collect from children
   - Parental consent process
   - Parents' rights (review, delete, revoke)
   - How to contact us about your child's data
5. Data Retention
6. Your Rights (CCPA: right to know, delete, opt-out)
7. Security
8. Changes to This Policy
9. Contact Us (privacy@learnfyra.com)

**Version tracking:** Display `Last updated: [date]` and `Version: [number]` at top. Store version string for consent records.

#### 6.2 Terms of Service Page

**New file:** `learnfyra-app/src/pages/legal/TermsOfServicePage.tsx`
**Route:** `/terms`

**Required sections:**
1. Acceptance of Terms
2. Description of Service (AI-powered educational worksheets)
3. User Accounts and Responsibilities
4. AI-Generated Content Disclaimer ("Content is generated by AI and may contain errors. Scores are for self-assessment only and do not constitute official academic records.")
5. Intellectual Property
6. Limitation of Liability
7. Termination
8. Governing Law
9. Contact

### Data Requirements

None. Static content. Privacy Policy version string is stored in consent records (Feature 3).

---

## Feature 7 — "Do Not Sell" Link (CCPA)

**Source Requirement:** CCPA-03
**Priority:** P0
**Estimated Effort:** 0.5 days

### Product Feature

A "Do Not Sell or Share My Personal Information" link appears in the footer of every page.

### Backend Requirements

None. Learnfyra does not sell data. The link leads to a static page.

### Frontend Requirements

#### 7.1 Add Link to Footer

**File:** `learnfyra-app/src/components/layout/Footer.tsx`

Add to the bottom bar (alongside existing Privacy / Terms / Accessibility links):

```typescript
<Link to="/do-not-sell">Do Not Sell My Personal Information</Link>
```

#### 7.2 New Page: Do Not Sell

**New file:** `learnfyra-app/src/pages/legal/DoNotSellPage.tsx`
**Route:** `/do-not-sell`

Content:
```
Learnfyra does not sell, rent, or share your personal information
with third parties for monetary or other valuable consideration.

We do not engage in targeted advertising.

If you have questions about our data practices, contact us at
privacy@learnfyra.com.
```

### Data Requirements

None.

---

## Feature 8 — AI Transparency Label

**Source Requirement:** AI-01 (California AB 2013)
**Priority:** P0
**Estimated Effort:** 0.5 days

### Product Feature

Every AI-generated worksheet displays a visible label indicating AI involvement.

### Backend Requirements

#### 8.1 Add Metadata to Generated Worksheets

**File:** `src/ai/generator.js`

After worksheet JSON is generated, add field:

```javascript
worksheet.aiDisclosure = {
  generated: true,
  model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  provider: 'Anthropic',
  label: 'Questions generated with AI assistance'
};
```

This field is persisted in `solve-data.json` and worksheet metadata.

#### 8.2 Add Label to HTML Exporter

**File:** `src/exporters/htmlExporter.js`

Add to the worksheet footer:

```html
<footer class="ai-disclosure">
  <small>Questions generated with AI assistance | Learnfyra</small>
</footer>
```

#### 8.3 Add Label to PDF Exporter

**File:** `src/exporters/pdfExporter.js`

Add footer text to the last page of every generated PDF.

### Frontend Requirements

#### 8.4 Display Label on Solve Page

**File:** `learnfyra-app/src/pages/SolvePage.tsx` (or equivalent)

Display at the top or bottom of the worksheet:

```
┌─────────────────────────────────────────┐
│  [i] Questions generated with AI        │
│      assistance by Learnfyra            │
└─────────────────────────────────────────┘
```

Use a subtle info banner — not dismissible, not intrusive.

### Data Requirements

New field on worksheet JSON: `aiDisclosure` object. No schema migration needed — it's a new additive field.

---

## Feature 9 — Audit Log Retention (3 Years)

**Source Requirement:** FR-08, COPPA-09
**Priority:** P0
**Estimated Effort:** 0.5 days (CDK config change)

### Product Feature

All API Gateway access logs and consent records are retained for 3 years to satisfy COPPA 312.10 record-keeping requirements.

### Backend Requirements

#### 9.1 CDK: Extend CloudWatch Log Retention

**File:** `infra/cdk/lib/learnfyra-stack.ts`

Change ALL Lambda log group retention from `RetentionDays.ONE_MONTH` to `RetentionDays.THREE_YEARS`:

```typescript
// BEFORE:
logRetention: RetentionDays.ONE_MONTH,

// AFTER:
logRetention: RetentionDays.THREE_YEARS,
```

Also change API Gateway access log group:
```typescript
const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
  logGroupName: `/aws/apigateway/learnfyra-${appEnv}-access-logs`,
  retention: logs.RetentionDays.THREE_YEARS,  // was ONE_MONTH
  removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
});
```

**Cost impact:** CloudWatch Logs cost ~$0.50/GB ingested + $0.03/GB/month stored. At early scale this is negligible. At high scale, consider archiving to S3 Glacier after 90 days.

### Frontend Requirements

None.

### Data Requirements

No table changes. Consent records (Feature 3) already have `retainUntil` field set to 3 years.

---

## Feature 10 — Data Minimization Enforcement for Children

**Source Requirement:** NFR-03, COPPA-04
**Priority:** P0
**Estimated Effort:** 1 day

### Product Feature

When a child under 13 is using the platform, the system blocks collection of optional PII fields that are not necessary for the educational purpose.

### Backend Requirements

#### 10.1 Modify Input Validator for Child Users

**File:** `backend/middleware/validator.js`

The following optional fields (lines 128-134) must be blocked for child users:

| Field | Current | Child Policy |
|---|---|---|
| `studentName` | Optional (max 80 chars) | BLOCKED — strip from request if user ageGroup === 'child' |
| `teacherName` | Optional (max 80 chars) | BLOCKED for child-initiated requests |
| `className` | Optional (max 80 chars) | BLOCKED for child-initiated requests |
| `period` | Optional (max 40 chars) | BLOCKED for child-initiated requests |
| `parentId` | Optional (max 128 chars) | ALLOWED (needed for parent-child linking) |
| `studentId` | Optional (max 128 chars) | ALLOWED (internal reference) |

**Implementation:**

```javascript
// In validator.js, after existing validation:
export function stripChildPII(body, userAgeGroup) {
  if (userAgeGroup === 'child') {
    delete body.studentName;
    delete body.teacherName;
    delete body.className;
    delete body.period;
  }
  return body;
}
```

Call this in the generate handler BEFORE passing body to the generator:

```javascript
// In generateHandler.js or server.js route:
const decoded = await validateToken(event);
const user = await getUser(decoded.sub);
if (user.ageGroup === 'child') {
  body = stripChildPII(body, user.ageGroup);
}
```

#### 10.2 Display Name Restriction for Children

When a child registers, only store first name (not full name):

```javascript
if (ageGroup === 'child') {
  displayName = body.displayName.split(' ')[0]; // first name only
}
```

### Frontend Requirements

#### 10.3 Hide Optional Fields for Child Users

In the worksheet generation form, if the authenticated user has `ageGroup === 'child'`:
- Hide "Student Name" field
- Hide "Teacher Name" field
- Hide "Class Name" and "Period" fields
- These fields simply don't render — no error message needed

### Data Requirements

No new tables. The `ageGroup` field added in Feature 1 is used to gate data collection.

---

## Implementation Dependency Graph

```
Feature 1: Age Gate
    │
    ├──→ Feature 2: Parental Consent (depends on age gate)
    │       │
    │       ├──→ Feature 3: Consent Records (used by consent flow)
    │       │
    │       └──→ Feature 5: Privacy Dashboard (depends on consent + parent links)
    │
    └──→ Feature 10: Data Minimization (uses ageGroup from age gate)

Feature 4: Account Deletion ──→ (independent, can build in parallel)

Feature 6: Privacy Policy / ToS ──→ (independent, legal review in parallel)

Feature 7: "Do Not Sell" Link ──→ (independent, trivial)

Feature 8: AI Label ──→ (independent, trivial)

Feature 9: Log Retention ──→ (independent, CDK config change)
```

**Recommended parallel tracks:**

```
Track A (Sequential — COPPA Core):
  Week 1: Feature 1 (Age Gate) → Feature 2 (Consent) → Feature 3 (Consent Storage)
  Week 2: Feature 5 (Privacy Dashboard) → Feature 10 (Data Minimization)

Track B (Parallel — Independent):
  Week 1: Feature 4 (Account Deletion)
  Week 1: Feature 9 (Log Retention — 30 min CDK change)
  Week 1: Feature 8 (AI Label — 2 hours)
  Week 1: Feature 7 ("Do Not Sell" — 2 hours)

Track C (Parallel — Legal):
  Week 1-3: Feature 6 (Privacy Policy + ToS — legal drafts in parallel, engineering builds pages in Week 2)
```

---

## New DynamoDB Tables Summary

| Table | PK | SK | GSIs | TTL | Purpose |
|---|---|---|---|---|---|
| `LearnfyraConsentRecords-{env}` | consentId | — | childUserId-index, parentEmail-index | expiresAt (pending records only) | COPPA consent audit trail (3-year retention) |

**Modified tables:**

| Table | New Fields | Purpose |
|---|---|---|
| `LearnfyraUsers-{env}` | dateOfBirth, ageGroup, accountStatus, consentStatus, parentEmail, deletionScheduledAt, deletionRequestedAt | Age gate, consent tracking, account deletion |

---

## New API Endpoints Summary

| Method | Path | Auth | Handler | Feature | Purpose |
|---|---|---|---|---|---|
| PATCH | `/api/auth/verify-age` | Limited JWT | authHandler | F1 | Complete age verification for OAuth users |
| POST | `/api/auth/request-consent` | None (child pending) | authHandler | F2 | Send consent email to parent |
| POST | `/api/auth/verify-consent` | None (token-based) | authHandler | F2 | Parent grants consent |
| POST | `/api/auth/deny-consent` | None (token-based) | authHandler | F2 | Parent denies consent (triggers data deletion) |
| DELETE | `/api/account` | JWT | accountHandler (new) | F4 | Request account deletion (7-day cooling off) |
| POST | `/api/account/cancel-deletion` | JWT | accountHandler | F4 | Cancel pending deletion |
| DELETE | `/api/account/child/:childUserId` | JWT (parent) | accountHandler | F4 | Parent deletes child account (immediate) |
| GET | `/api/parent/children` | JWT (parent) | parentHandler (new) | F5 | List linked children with stats |
| GET | `/api/parent/children/:id/export` | JWT (parent) | parentHandler | F5 | Export child data as JSON |
| POST | `/api/parent/children/:id/revoke-consent` | JWT (parent) | parentHandler | F5 | Revoke consent and deactivate child |

**New frontend routes:**

| Path | Component | Auth | Feature |
|---|---|---|---|
| `/auth/age-verification` | AgeVerificationPage | Limited JWT | F1 |
| `/auth/consent-pending` | ConsentPendingPage | None | F2 |
| `/auth/parental-consent` | ParentalConsentPage | Token param | F2 |
| `/parent/children` | ParentDashboardPage | JWT (parent) | F5 |
| `/privacy` | PrivacyPolicyPage | None | F6 |
| `/terms` | TermsOfServicePage | None | F6 |
| `/do-not-sell` | DoNotSellPage | None | F7 |

---

*This specification is implementation-ready. Each feature can be handed to a DEV agent with the exact file paths, function signatures, API contracts, and UI wireframes needed to build without ambiguity.*
