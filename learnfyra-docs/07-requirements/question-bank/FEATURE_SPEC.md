# Question Bank Repeat Cap — Feature Specification

**Module:** M02 / M03 Cross-cutting Policy
**Feature ID:** RCAP
**Priority:** P0 / High
**Owner:** Platform / Admin / Worksheet Generation
**Status:** Ready for Implementation
**Version:** 1.0
**Date:** 2026-04-04
**Author:** BA Agent

---

## 1. Feature Summary

Learnfyra generates AI-powered worksheets for US students in Grades 1–10. When the same
student generates multiple worksheets on the same topic, the question bank pipeline
(M02/M03) may serve previously seen questions as fill for the assembled worksheet.

This feature makes the maximum percentage of "repeat" questions per worksheet fully
configurable by Platform Admin / Super Admin. The current assembly logic in
`src/ai/assembler.js` contains a hardcoded 80/20 rule (Step 2.5) that is independent of
the admin-configured repeat cap in `src/ai/repeatCapPolicy.js`. This disconnect must be
resolved so that a single admin-managed value drives all repeat-question decisions end to
end, from policy resolution through worksheet assembly.

### What Changes

1. The hardcoded `minUnseen = Math.ceil(questionCount * 0.8)` constant in
   `src/ai/assembler.js` (Step 2.5) is replaced with a dynamic value derived from the
   effective admin-configured `repeatCapPercent`.
2. The effective cap is resolved once per generation request by calling
   `resolveEffectiveRepeatCap` and is passed into `assembleWorksheet` as the authoritative
   `repeatCapPercent` parameter.
3. Super Admin / Platform Admin can view and change the global cap and create
   scope-specific overrides via the existing admin API, which is already partially
   implemented in `backend/handlers/adminHandler.js`.
4. All cap changes are persisted in the DynamoDB Config table and logged to the audit
   trail with actor, before/after values, and a mandatory reason string.

---

## 2. User Stories

### US-RCAP-001 — Global Repeat Cap Configuration (Super Admin)
As a Super Admin,
I want to set the platform-wide maximum percentage of repeated questions allowed per
worksheet,
So that I can control question variety across all students without touching application
code.

### US-RCAP-002 — Scope Override for a Specific Student (Super Admin)
As a Super Admin,
I want to create a student-specific override that raises or lowers the repeat cap for one
learner,
So that I can accommodate a student who needs more repetition for reinforcement or one
who must always receive fresh questions.

### US-RCAP-003 — Override Precedence Transparency (Super Admin)
As a Super Admin,
I want to see which override level (student, parent, teacher, or global default) is
currently controlling a student's worksheet generation,
So that I can diagnose unexpected question behavior without inspecting raw database
records.

### US-RCAP-004 — Dynamic Worksheet Assembly (Student)
As a student,
I want the worksheets I receive to contain as many questions I have never seen before as
the configured policy allows,
So that practice sessions expose me to the breadth of the curriculum rather than
repeating the same questions.

### US-RCAP-005 — Graceful Low-Inventory Handling (Student)
As a student using a narrow topic with limited question bank inventory,
I want worksheet generation to succeed even when there are not enough unseen questions,
So that I am not blocked from practicing just because the bank is small.

### US-RCAP-006 — Audit Trail for Policy Changes (Compliance Admin)
As a Compliance Admin,
I want every repeat cap change to produce a tamper-evident audit log entry that records
who made the change, what the previous value was, and why it was changed,
So that the platform can satisfy compliance and review requirements without manual record
keeping.

### US-RCAP-007 — RBAC Enforcement (Teacher / Parent)
As a teacher or parent,
I want to be certain that I cannot accidentally or deliberately alter the repeat cap
policy,
So that the integrity of platform-wide quality standards cannot be undermined by
non-admin users.

### US-RCAP-008 — Temporary Override with Expiry (Super Admin)
As a Super Admin,
I want to create an override that automatically expires at a specified date and time,
So that temporary accommodations (e.g., test-prep periods) revert to the global default
without requiring a manual follow-up action.

---

## 3. Functional Requirements

Requirements are grouped by the system layer they govern.

---

### 3A. Global Configuration

#### FR-RCAP-001 — Global Repeat Cap Default Value
**Priority:** P0
**Description:** The system must store a `repeatCapPolicy.defaultPercent` integer (0–100
inclusive) in the `adminPolicies` record under key `global` in the DynamoDB Config table
(or the local JSON adapter equivalent). This value represents the maximum percentage of
previously served questions allowed in any newly assembled worksheet when no more-specific
override exists.

**Current state:** The value is stored and reads correctly in
`backend/handlers/adminHandler.js` `DEFAULT_POLICY.repeatCapPolicy.defaultPercent = 10`.
The bug is that `src/ai/assembler.js` Step 2.5 ignores it and hard-codes 0.8 (80%
unseen).

**Acceptance Criteria:**
Given the global policy has `repeatCapPolicy.defaultPercent = 20`
When `resolveEffectiveRepeatCap` is called with no matching overrides
Then the returned `capPercent` equals 20 and `appliedBy` equals `"default"`.

---

#### FR-RCAP-002 — Global Policy Enable/Disable Toggle
**Priority:** P0
**Description:** The `repeatCapPolicy.enabled` boolean in the global policy controls
whether the cap is enforced at all. When `enabled = false`, the system must treat the
effective cap as 100% (all questions, including repeats, are allowed). When `enabled = true`
(default), the `defaultPercent` value governs.

**Acceptance Criteria:**
Given `repeatCapPolicy.enabled = false`
When `resolveEffectiveRepeatCap` is called
Then the returned object is `{ capPercent: 100, appliedBy: "disabled", sourceId: null }`.

---

#### FR-RCAP-003 — Cap Value Range Constraint
**Priority:** P0
**Description:** The `defaultPercent` value must be an integer from 0 to 100 inclusive.
A value of 0 means no repeated questions are ever allowed. A value of 100 means there is
no cap. The admin API must reject any value outside this range with HTTP 400.

**Acceptance Criteria:**
Given a Super Admin submits `defaultPercent = 101`
When `PUT /api/admin/policies/repeat-cap` is called
Then the response is HTTP 400 with `"defaultPercent must be an integer between 0 and 100"`.

Given a Super Admin submits `defaultPercent = -1`
When `PUT /api/admin/policies/repeat-cap` is called
Then the response is HTTP 400.

---

### 3B. Override Scopes

#### FR-RCAP-004 — Supported Override Scopes
**Priority:** P0
**Description:** The system must support three override scopes beyond the global default:
`student`, `parent`, and `teacher`. Each override record in the `repeatCapOverrides`
collection carries: `scope`, `scopeId`, `repeatCapPercent` (0–100 integer), `isActive`
(boolean, default `true`), and an optional `expiresAt` (ISO-8601 datetime string).

**Acceptance Criteria:**
Given an admin creates a teacher override with `scope = "teacher"` and
`repeatCapPercent = 30`
When `resolveEffectiveRepeatCap` is called for a student under that teacher
And no student or parent override exists
Then `capPercent` returns 30 and `appliedBy` returns `"teacher"`.

---

#### FR-RCAP-005 — Override Precedence Order
**Priority:** P0
**Description:** When multiple overrides are active for the identity chain of a generation
request, the system must apply the most specific one using this precedence (highest to
lowest): student > parent > teacher > global default. The first match in this order wins
and no further overrides are evaluated.

**Acceptance Criteria:**
Given active overrides exist for both `student:S1` (repeatCapPercent = 5) and
`teacher:T1` (repeatCapPercent = 40)
When `resolveEffectiveRepeatCap` is called with `studentId = "S1"` and
`teacherId = "T1"`
Then `capPercent` returns 5 and `appliedBy` returns `"student"`.

---

#### FR-RCAP-006 — Override Expiry
**Priority:** P1
**Description:** If an override record has a non-null `expiresAt` datetime and the current
server time is at or past that datetime, the override must be treated as inactive and
skipped during precedence resolution. The record is NOT deleted; it persists in the
database for audit purposes but is excluded from active resolution.

**Acceptance Criteria:**
Given a student override with `expiresAt` set to 1 hour in the past
When `resolveEffectiveRepeatCap` is called for that student
Then the expired override is skipped and the next applicable override (or global default)
is used instead.

---

#### FR-RCAP-007 — Override Deactivation
**Priority:** P1
**Description:** An admin may set `isActive = false` on an override to deactivate it
without deleting it. A deactivated override must be excluded from precedence resolution.
The record remains in the database and appears in audit log history.

**Acceptance Criteria:**
Given an override exists with `isActive = false`
When `resolveEffectiveRepeatCap` is called for the matching scope and scopeId
Then the deactivated override is skipped.

---

### 3C. Cap Resolution

#### FR-RCAP-008 — Single Resolution Call per Generation Request
**Priority:** P0
**Description:** The worksheet generation pipeline must call `resolveEffectiveRepeatCap`
exactly once per generation request, before `assembleWorksheet` is invoked. The resolved
`capPercent` must be passed into `assembleWorksheet` as the `repeatCapPercent` parameter.
No repeat-cap logic may exist inside `assembleWorksheet` that reads the database
independently.

**Acceptance Criteria:**
Given a generation request for studentId `S1`
When the generation handler processes the request
Then `resolveEffectiveRepeatCap` is called once with the student's identity context
And the returned `capPercent` is forwarded to `assembleWorksheet` as `repeatCapPercent`.

---

#### FR-RCAP-009 — Resolution Fallback on DB Failure
**Priority:** P1
**Description:** If `resolveEffectiveRepeatCap` throws due to a database error, the system
must log a warning and fall back to `DEFAULT_REPEAT_CAP_PERCENT` (currently 10) rather
than failing the entire generation request. The fallback must be indicated in the response
`bankStats.capResolutionFallback = true`.

**Acceptance Criteria:**
Given the DynamoDB table for `adminPolicies` is unreachable
When `resolveEffectiveRepeatCap` is called
Then the generation request continues using the hardcoded default
And the response includes `bankStats.capResolutionFallback = true`.

---

### 3D. Assembly Logic

#### FR-RCAP-010 — Remove Hardcoded 80/20 Rule
**Priority:** P0
**Description:** The block in `src/ai/assembler.js` at Step 2.5 that computes
`minUnseen = Math.ceil(questionCount * 0.8)` and applies a fixed 80% unseen threshold
must be replaced. The replacement logic must use the `repeatCapPercent` parameter that
is already accepted by `assembleWorksheet`. Specifically:

```
maxRepeatQuestions = Math.floor(questionCount * (repeatCapPercent / 100))
minUnseen          = questionCount - maxRepeatQuestions
```

This formula must be applied consistently in both the bank-selection step (Step 2 via
`selectWithRepeatCap`) and the questionId-based deduplication step (Step 2.5 via
`getUserQuestionHistory`). Both steps must use the same `maxRepeatQuestions` value.

**Acceptance Criteria:**
Given `repeatCapPercent = 20` and `questionCount = 10`
When `assembleWorksheet` is called
Then `maxRepeatQuestions = 2` and `minUnseen = 8`
And the worksheet contains no more than 2 previously seen questions.

Given `repeatCapPercent = 0` and `questionCount = 5`
When `assembleWorksheet` is called
Then `maxRepeatQuestions = 0`
And no previously seen questions are included regardless of bank inventory.

---

#### FR-RCAP-011 — Unified Repeat Tracking Across Both Dedup Steps
**Priority:** P0
**Description:** The assembler currently tracks repeat usage in two separate phases:
signature-based (`seenSignatures` set from `getSeenQuestionSignatures`) and
questionId-based (`seenQuestionIds` set from `getUserQuestionHistory`). Both phases must
share a single `repeatUsed` counter that increments whenever either phase includes a
previously seen question, and both phases must be gated by the same `maxRepeatQuestions`
ceiling. The combined total of repeats across both phases must not exceed
`maxRepeatQuestions`.

**Acceptance Criteria:**
Given `repeatCapPercent = 20` and `questionCount = 10`
When the bank contains 5 unseen questions and 5 previously seen questions (by questionId)
Then the assembler selects all 5 unseen questions plus 2 seen questions (cap = 2)
And the remaining 3 seen questions are excluded
And AI generation is triggered for the 3 missing questions.

---

#### FR-RCAP-012 — bankStats Must Reflect Effective Cap
**Priority:** P1
**Description:** The `bankStats` object returned by `assembleWorksheet` must include:
- `repeatCapPercent`: the effective cap percent applied (as received by the function)
- `maxRepeatQuestions`: the calculated ceiling
- `repeatUsed`: the actual count of repeated questions included
- `capAppliedBy`: the override level that produced this cap (`"student"`, `"parent"`,
  `"teacher"`, `"default"`, or `"disabled"`)

**Acceptance Criteria:**
Given `repeatCapPercent = 15` is passed into `assembleWorksheet` and 1 repeat is used
When the call returns
Then `bankStats.repeatCapPercent = 15`, `bankStats.maxRepeatQuestions = 1` (for 10 Qs),
and `bankStats.repeatUsed = 1`.

---

### 3E. Exposure Tracking

#### FR-RCAP-013 — Record Exposure on Every Successful Generation
**Priority:** P0
**Description:** After every successful worksheet assembly, the system must call
`recordExposureHistory` to persist the question signatures of all questions included in
the final worksheet. This enables future repeat cap checks to correctly identify questions
that have already been served to that learner.

**Acceptance Criteria:**
Given a worksheet with 10 questions is successfully generated for studentId `S1`
When the generation response is returned
Then `questionExposureHistory` contains 10 new records keyed to `S1`'s student key.

---

#### FR-RCAP-014 — Exposure Records Include Grade and Difficulty
**Priority:** P0
**Description:** Each exposure history record must include `grade` and `difficulty` so
that repeat cap lookups can scope seen-question sets accurately. Grade 3 Math questions
seen by a student must not affect Grade 4 Math worksheet generation for the same student.

**Acceptance Criteria:**
Given a student has seen Grade 3 Easy questions
When a Grade 4 Easy worksheet is generated for the same student
Then the Grade 3 exposure records do not reduce the unseen question pool for Grade 4.

---

#### FR-RCAP-015 — Guest User Exposure Tracking
**Priority:** P1
**Description:** For guest users (no authenticated userId), exposure tracking must use the
`guestId` as the identity key. The `getUserQuestionHistory` function already supports this
pattern. The generation handler must pass `guestId` whenever `userId` is absent.

**Acceptance Criteria:**
Given a guest user with `guestId = "guest-abc"` generates two worksheets on the same
topic
When the second worksheet is assembled
Then the second worksheet's repeat count respects the active global `repeatCapPercent`
And the exposure records are keyed to `GUEST#guest-abc`.

---

### 3F. Admin API

#### FR-RCAP-016 — GET Repeat Cap Policy Endpoint
**Priority:** P0
**Description:** `GET /api/admin/policies/repeat-cap` must return the current global
`repeatCapPolicy` object and all active and inactive override records. The endpoint is
already implemented in `handleGetRepeatCapPolicy`. This requirement documents the
contract and confirms the response shape is stable.

Response body shape:
```json
{
  "repeatCapPolicy": {
    "enabled": true,
    "defaultPercent": 20,
    "minPercent": 0,
    "maxPercent": 100
  },
  "overrides": [
    {
      "id": "student:S1",
      "scope": "student",
      "scopeId": "S1",
      "repeatCapPercent": 5,
      "isActive": true,
      "expiresAt": null,
      "updatedAt": "2026-04-01T12:00:00Z",
      "updatedBy": "admin-uuid"
    }
  ],
  "requestedBy": "admin-uuid"
}
```

**Acceptance Criteria:**
Given no overrides exist
When `GET /api/admin/policies/repeat-cap` is called by a Super Admin
Then the response is HTTP 200 with `overrides = []` and the global policy object.

Given `scope=student&scopeId=S1` query parameters are provided
When `GET /api/admin/policies/repeat-cap` is called
Then only the override matching that student is returned.

---

#### FR-RCAP-017 — PUT Global Repeat Cap Policy Endpoint
**Priority:** P0
**Description:** `PUT /api/admin/policies/repeat-cap` must accept `enabled` (boolean),
`defaultPercent` (integer 0–100), and `reason` (string, 10–300 characters). The handler
is already implemented in `handleUpdateRepeatCapPolicy`. An `Idempotency-Key` header is
required on every mutating call.

Request body:
```json
{
  "enabled": true,
  "defaultPercent": 20,
  "reason": "Reducing repeat allowance to improve question variety in Q2."
}
```

**Acceptance Criteria:**
Given a valid payload and a fresh `Idempotency-Key`
When `PUT /api/admin/policies/repeat-cap` is called by a Super Admin
Then the response is HTTP 200, the policy is persisted, the `version` increments by 1,
and an audit log entry is written.

Given the same `Idempotency-Key` is used in a second identical call
When `PUT /api/admin/policies/repeat-cap` is called again
Then the response is HTTP 200 with the cached response body and no second DB write or
audit entry occurs.

---

#### FR-RCAP-018 — PUT Repeat Cap Override Endpoint
**Priority:** P0
**Description:** `PUT /api/admin/policies/repeat-cap/overrides` (upsert semantics) must
accept `scope`, `scopeId`, `repeatCapPercent`, `reason`, optional `isActive`, and optional
`expiresAt`. The handler is already implemented in `handleUpsertRepeatCapOverride`.

Request body:
```json
{
  "scope": "student",
  "scopeId": "student-uuid-123",
  "repeatCapPercent": 5,
  "isActive": true,
  "expiresAt": "2026-06-30T23:59:59Z",
  "reason": "Student requires higher repetition for IEP accommodation."
}
```

**Acceptance Criteria:**
Given no override exists for `student:S1`
When a Super Admin calls the upsert endpoint
Then HTTP 200 is returned, the override record is created with the provided values,
and an audit event is written.

Given an override already exists for `student:S1`
When a Super Admin calls the upsert endpoint with updated `repeatCapPercent`
Then the existing record's `repeatCapPercent` and `updatedAt` are updated, `createdAt`
and `createdBy` are preserved, and an audit event is written with the before and after
values.

---

#### FR-RCAP-019 — Missing or Invalid Idempotency-Key Rejected
**Priority:** P0
**Description:** All mutating admin endpoints (PUT) must reject requests that omit the
`Idempotency-Key` header or provide an empty/whitespace value with HTTP 400 and error
code `ADMIN_INVALID_REQUEST`.

**Acceptance Criteria:**
Given no `Idempotency-Key` header is present
When `PUT /api/admin/policies/repeat-cap` is called
Then the response is HTTP 400 with `"Idempotency-Key header is required."`.

---

### 3G. Audit Logging

#### FR-RCAP-020 — Audit Record Written on Every Policy Mutation
**Priority:** P0
**Description:** Every successful mutation of the global repeat cap policy or any override
record must produce an audit record in `adminAuditEvents` containing:

| Field | Value |
|---|---|
| `eventType` | `"admin.policy.updated"` |
| `action` | `"update-repeat-cap-policy"` or `"upsert-repeat-cap-override"` |
| `actorId` | The authenticated admin's `sub` claim |
| `actorRole` | The admin's role (e.g., `"super-admin"`) |
| `target` | The DynamoDB path affected (e.g., `"adminPolicies.global.repeatCapPolicy"`) |
| `before` | Snapshot of the value before the change |
| `after` | Snapshot of the value after the change |
| `reason` | The reason string provided in the request body |
| `createdAt` | ISO-8601 timestamp of the mutation |

**Acceptance Criteria:**
Given a Super Admin updates `defaultPercent` from 10 to 25
When the PUT call succeeds
Then `adminAuditEvents` contains one new record with `before.defaultPercent = 10`,
`after.defaultPercent = 25`, `action = "update-repeat-cap-policy"`, and the provided
reason string.

---

#### FR-RCAP-021 — Audit Log Queryable by Action
**Priority:** P1
**Description:** `GET /api/admin/audit-events?action=update-repeat-cap-policy` must return
only repeat-cap-related audit events, supporting pagination via `limit` and `offset`
query parameters.

**Acceptance Criteria:**
Given 5 repeat-cap audit events and 10 other audit events exist
When `GET /api/admin/audit-events?action=update-repeat-cap-policy&limit=10` is called
Then exactly 5 events are returned.

---

### 3H. Failure Handling

#### FR-RCAP-022 — Low Inventory: Permit Repeats Up to Cap
**Priority:** P0
**Description:** When the question bank does not contain enough unseen questions to satisfy
a generation request, the system must use previously seen questions up to the configured
`maxRepeatQuestions` ceiling. It must not fail the request solely because unseen inventory
is exhausted, as long as the repeat cap is not yet reached.

**Acceptance Criteria:**
Given `repeatCapPercent = 20`, `questionCount = 10`, the bank has 6 unseen and 6 seen
questions for the student
When `assembleWorksheet` is called
Then the worksheet includes 6 unseen + 2 seen (repeat cap ceiling) = 8 banked questions
And AI generation is triggered for the remaining 2 questions.

---

#### FR-RCAP-023 — Insufficient Bank AND Repeat Cap Exhausted: Fall Back to AI
**Priority:** P0
**Description:** When the bank cannot satisfy the request even after using the full repeat
allowance, the system must fall back to AI generation for the remaining question count.
This is the existing Tier 1 fallback path in `assembleWorksheet` and must continue to
function correctly under the dynamic cap formula.

**Acceptance Criteria:**
Given `repeatCapPercent = 10`, `questionCount = 10`, the bank has 4 unseen and 3 seen
questions
When `assembleWorksheet` is called
Then 4 unseen + 1 seen (cap = 1) = 5 banked questions are used
And Claude AI is called to generate the remaining 5 questions.

---

#### FR-RCAP-024 — Total AI Failure with Partial Bank Coverage
**Priority:** P1
**Description:** When AI generation fails (Tier 2 fallback), the assembler must return
whatever banked questions it was able to select — unseen and permitted repeats — even if
fewer than `questionCount`. The response must include `fallbackMode = "partial"` and
`fallbackReason`.

**Acceptance Criteria:**
Given `repeatCapPercent = 20`, `questionCount = 10`, only 4 banked questions are
available, and Claude AI throws an error
When `assembleWorksheet` is called
Then the worksheet contains 4 questions, `fallbackMode = "partial"`, and
`fallbackReason` contains the AI error message.

---

## 4. Non-Functional Requirements

### 4A. Performance

| Requirement | Target |
|---|---|
| `resolveEffectiveRepeatCap` latency (DynamoDB) | p99 ≤ 50ms |
| `resolveEffectiveRepeatCap` latency (local JSON adapter) | p99 ≤ 5ms |
| Total overhead added to worksheet generation by cap resolution | ≤ 100ms at p99 |
| `GET /api/admin/policies/repeat-cap` response time | ≤ 500ms end-to-end at p95 |
| `PUT /api/admin/policies/repeat-cap` response time | ≤ 1s end-to-end at p95 |

Cap resolution adds one DynamoDB read (`adminPolicies.global`) and one DynamoDB scan
(`repeatCapOverrides`). The scan of `repeatCapOverrides` is acceptable because the number
of override records is bounded (one per student/teacher/parent) and expected to remain
in the hundreds, not millions.

---

### 4B. Data Integrity

- The `repeatCapPolicy.defaultPercent` value must always be an integer in [0, 100].
  The `clampPercent` function in `src/ai/repeatCapPolicy.js` already enforces this at
  resolution time. The admin API must enforce it at write time (FR-RCAP-003).
- Override records use composite IDs (`scope:scopeId`) ensuring one active record per
  scope entity. Upsert semantics prevent duplicate active overrides for the same
  entity.
- `recordExposureHistory` writes must not block the generation response path. They
  may be fire-and-forget (non-blocking) to preserve generation latency, but failures
  must be logged as warnings.
- Audit records must be written atomically with policy updates. If the audit write
  fails, the policy write must be rolled back (or the response must return 500 to
  signal the caller to retry with the same `Idempotency-Key`).

---

### 4C. Backwards Compatibility

- The `assembleWorksheet` function signature already accepts `repeatCapPercent` as a
  parameter; no breaking change is required.
- Existing worksheets already generated are not affected. The cap only governs future
  assembly calls.
- The `DEFAULT_REPEAT_CAP_PERCENT = 10` constant in `src/ai/repeatCapPolicy.js` remains
  the hardcoded code-level fallback used only when the database is unreachable.
- All existing admin API consumers that read `repeatCapPolicy` from the GET policies
  endpoint remain compatible: the response shape is not changing.
- The local JSON adapter (`APP_RUNTIME` not set to `aws`) must continue to work with no
  DynamoDB dependency for the repeat cap feature.

---

## 5. RBAC Matrix

| Action | Super Admin | Ops Admin | Support Admin | Data / Compliance Admin | Teacher | Parent | Student |
|---|---|---|---|---|---|---|---|
| GET global repeat cap policy | Yes | Yes | Yes (read-only) | Yes (read-only) | No | No | No |
| PUT global repeat cap policy | Yes | No | No | No | No | No | No |
| GET repeat cap overrides (all scopes) | Yes | Yes | Yes (read-only) | Yes (read-only) | No | No | No |
| PUT (upsert) repeat cap override | Yes | No | No | No | No | No | No |
| Deactivate / expire an override | Yes | No | No | No | No | No | No |
| View audit log for cap changes | Yes | Yes | No | Yes | No | No | No |
| View `bankStats.capAppliedBy` in generation response | Yes | Yes | No | No | Teacher (own class) | No | No |

**Enforcement point:** The `requireRole` middleware in `backend/middleware/authMiddleware.js`
must gate PUT endpoints so that only tokens with `role = "super-admin"` or
`role = "platform-admin"` are permitted. Any other role must receive HTTP 403 with error
code `ADMIN_FORBIDDEN`.

---

## 6. Acceptance Criteria

### AC-RCAP-01 — Global Admin Configuration (from requirements AC-01)
Given a Platform Admin updates the global repeat cap to `defaultPercent = 20`
When a worksheet is generated for a student with no scope overrides
Then the assembly logic allows at most 20% repeated questions
And `bankStats.repeatCapPercent = 20` appears in the generation response.

---

### AC-RCAP-02 — Dynamic Formula Correctness (from requirements AC-02)
Given `questionCount = 10` and effective `repeatCapPercent = 20`
When `assembleWorksheet` is called
Then `maxRepeatQuestions = Math.floor(10 * 0.20) = 2`
And the assembled worksheet contains at most 2 previously seen questions
And `bankStats.maxRepeatQuestions = 2` and `bankStats.repeatUsed <= 2`.

---

### AC-RCAP-03 — No Teacher or Parent Edit Access (from requirements AC-03)
Given a user with role `"teacher"` submits `PUT /api/admin/policies/repeat-cap`
When the request is processed by the admin handler
Then the response is HTTP 403 with error code `ADMIN_FORBIDDEN`
And no database write or audit record is created.

Given a user with role `"parent"` submits the same PUT endpoint
When the request is processed
Then the same HTTP 403 response is returned.

---

### AC-RCAP-04 — Override Precedence (from requirements AC-04)
Given a student-specific override of `repeatCapPercent = 5` exists for `studentId = "S1"`
And the global default is `defaultPercent = 20`
When a worksheet is generated for student S1
Then `bankStats.repeatCapPercent = 5` and `bankStats.capAppliedBy = "student"`
And the assembled worksheet contains at most 1 repeated question for a 10-question sheet
(floor(10 * 0.05) = 0, which rounds to 0).

---

### AC-RCAP-05 — Audit Log Written on Change (from requirements AC-05)
Given a Super Admin changes `defaultPercent` from 10 to 25 with reason
`"Test-prep season increase"`
When the PUT call returns HTTP 200
Then one new record exists in `adminAuditEvents` with:
- `action = "update-repeat-cap-policy"`
- `before.defaultPercent = 10`
- `after.defaultPercent = 25`
- `reason = "Test-prep season increase"`
- `actorId` matching the admin's sub claim.

---

### AC-RCAP-06 — Policy Disabled Means No Cap
Given `repeatCapPolicy.enabled = false` in the global policy
When a worksheet is generated for any student
Then `resolveEffectiveRepeatCap` returns `capPercent = 100`
And the assembler places no ceiling on repeated questions.

---

### AC-RCAP-07 — Zero Cap Enforced
Given `repeatCapPercent = 0` (either via global policy or a student override)
When `assembleWorksheet` is called with any `questionCount`
Then `maxRepeatQuestions = 0`
And no previously seen questions appear in the assembled worksheet
And AI generation covers any gap left by insufficient unseen bank inventory.

---

### AC-RCAP-08 — Expired Override Falls Through to Global Default
Given a student override with `expiresAt` set 2 hours in the past
And the global default is `defaultPercent = 15`
When `resolveEffectiveRepeatCap` is called for that student
Then the expired override is skipped
And the returned `capPercent = 15` with `appliedBy = "default"`.

---

### AC-RCAP-09 — Grade 1 Boundary
Given a Grade 1 ELA Phonics worksheet is requested for a student
And the student has previously seen 3 out of 5 available phonics questions in the bank
And `repeatCapPercent = 20` with `questionCount = 5`
When `assembleWorksheet` is called
Then `maxRepeatQuestions = Math.floor(5 * 0.20) = 1`
And the worksheet contains 2 unseen questions + 1 repeated question
And AI generates the remaining 2.

---

### AC-RCAP-10 — Grade 10 Boundary
Given a Grade 10 Math worksheet is requested with `questionCount = 30`
And `repeatCapPercent = 20`
When `assembleWorksheet` is called
Then `maxRepeatQuestions = Math.floor(30 * 0.20) = 6`
And at most 6 previously seen questions appear in the assembled worksheet.

---

### AC-RCAP-11 — Minimum Question Count (5 Questions)
Given a worksheet request with `questionCount = 5` and `repeatCapPercent = 20`
When `assembleWorksheet` is called
Then `maxRepeatQuestions = Math.floor(5 * 0.20) = 1`
And the worksheet contains at most 1 repeated question.

---

### AC-RCAP-12 — Maximum Question Count (30 Questions)
Given a worksheet request with `questionCount = 30` and `repeatCapPercent = 10`
When `assembleWorksheet` is called
Then `maxRepeatQuestions = Math.floor(30 * 0.10) = 3`
And the worksheet contains at most 3 repeated questions.

---

### AC-RCAP-13 — Cap Resolution Fallback on DB Error
Given the DynamoDB `adminPolicies` table is unavailable (simulated in tests)
When `resolveEffectiveRepeatCap` is called
Then the function does not throw
And it returns `capPercent = DEFAULT_REPEAT_CAP_PERCENT (10)` with a fallback indicator
And the generation response includes `bankStats.capResolutionFallback = true`.

---

### AC-RCAP-14 — AWS Lambda Deployment Contract
Given the admin handler is deployed as Lambda function `learnfyra-admin-{env}`
When `PUT /api/admin/policies/repeat-cap` is called through API Gateway
Then the Lambda responds within 1 second at p95
And the `adminPolicies` record is persisted in the DynamoDB Config table
(`LearnfyraConfig-{env}`)
And CORS headers (`Access-Control-Allow-Origin`) are present on every response
including error responses.

---

## 7. Business Rules

### BR-RCAP-001 — Cap Calculation Formula
The number of repeated questions permitted in a worksheet is computed as:

```
maxRepeatQuestions = Math.floor(questionCount * (repeatCapPercent / 100))
minUnseenTarget    = questionCount - maxRepeatQuestions
```

`Math.floor` is used (not `Math.round` or `Math.ceil`) to ensure the cap is never
exceeded by a rounding artefact. This means the effective repeat rate is always at or
below `repeatCapPercent`.

Examples:

| questionCount | repeatCapPercent | maxRepeatQuestions | minUnseenTarget |
|---|---|---|---|
| 5 | 0 | 0 | 5 |
| 5 | 20 | 1 | 4 |
| 10 | 10 | 1 | 9 |
| 10 | 20 | 2 | 8 |
| 10 | 50 | 5 | 5 |
| 15 | 20 | 3 | 12 |
| 30 | 20 | 6 | 24 |
| 30 | 100 | 30 | 0 |

---

### BR-RCAP-002 — Override Precedence Rules

When resolving the effective cap for a worksheet generation request:

1. If `repeatCapPolicy.enabled = false` → effective cap = 100% (no limit). Stop.
2. Evaluate student override: if an active, non-expired override exists for the
   requesting `studentId` → use its `repeatCapPercent`. Stop.
3. Evaluate parent override: if an active, non-expired override exists for the
   requesting `parentId` → use its `repeatCapPercent`. Stop.
4. Evaluate teacher override: if an active, non-expired override exists for the
   requesting `teacherId` → use its `repeatCapPercent`. Stop.
5. Use `repeatCapPolicy.defaultPercent` from the global policy record. Stop.

If the database is unreachable at any step → use `DEFAULT_REPEAT_CAP_PERCENT = 10`
and set `capResolutionFallback = true`.

---

### BR-RCAP-003 — Edge Case: repeatCapPercent = 0
When the effective cap is 0%, no previously seen questions may appear in the worksheet.
The assembler must fill the entire request with unseen bank questions and/or AI-generated
questions. If the bank has only seen questions, all questions must come from AI.

---

### BR-RCAP-004 — Edge Case: repeatCapPercent = 100
When the effective cap is 100%, the assembler may freely include any banked questions
regardless of prior exposure. This is equivalent to disabling the per-student deduplication
entirely. The `selectWithRepeatCap` function already handles this correctly because
`maxRepeatQuestions = questionCount` equals the full request.

---

### BR-RCAP-005 — Edge Case: questionCount = 1 with repeatCapPercent < 100
`Math.floor(1 * (repeatCapPercent / 100))` equals 0 for any `repeatCapPercent < 100`.
This means a single-question worksheet never allows a repeated question when any cap is
active. If the only available bank question for the topic has been seen, AI must be used.

---

### BR-RCAP-006 — Repeat Tracking Scope
Repeat decisions are scoped to the tuple (studentKey, grade, difficulty). A question
seen by a student in Grade 3 Easy does NOT count as a repeat when the same student
requests a Grade 3 Medium worksheet, or a Grade 4 Easy worksheet. Subject and topic are
not included in the exposure scope key, meaning a question seen in one topic for the
same grade/difficulty combination does affect the seen-question pool if the question
happens to appear in the bank under a different topic (cross-topic reuse via bank
deduplication).

---

### BR-RCAP-007 — Admin Reason String Requirement
Every mutating admin call to the repeat cap endpoints must include a `reason` field of
between 10 and 300 characters. This requirement exists to ensure audit records capture
human-readable context, not just machine state transitions. The API enforces this with
HTTP 400 if the reason is absent or outside the character bounds.

---

### BR-RCAP-008 — Idempotency Window
Idempotency records for admin mutations expire after 24 hours. A second call with the
same `Idempotency-Key` after 24 hours is treated as a new, independent request. This
window is sufficient for retry logic in API consumers.

---

## 8. Out of Scope

- **Student-facing UI for repeat cap visibility.** Students do not see the cap setting
  or any indication of which questions are repeats vs. new. This is an internal platform
  control.
- **Teacher-facing override management.** Teachers cannot create or view overrides.
  Only Super Admin / Platform Admin can manage overrides.
- **Per-subject or per-topic cap granularity.** Overrides are scoped to
  student/parent/teacher identity, not to curriculum dimensions.
- **Automated cap adjustment based on bank inventory levels.** The cap is purely
  admin-managed. No machine-learning or dynamic tuning.
- **Bulk import or export of override records.** Overrides are managed one at a time
  via the admin API.
- **Cap enforcement for worksheet downloads (PDF/DOCX).** The cap only applies to
  worksheet assembly during generation. Pre-generated worksheets already stored in S3
  are not re-evaluated.
- **Cross-student repeat tracking.** The feature tracks repeats per individual student.
  If two different students see the same question, that does not affect either student's
  repeat count.
- **Question-level override.** Specific questions cannot be individually pinned or
  excluded; only the percentage ceiling is configurable.
- **UI for the admin console** to manage repeat cap overrides. This spec covers the API
  contract only. Admin console UI work is tracked separately.

---

## 9. Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `src/ai/repeatCapPolicy.js` — `resolveEffectiveRepeatCap` | Exists | Function is complete; bug is in assembler not reading its output |
| `src/ai/assembler.js` — `assembleWorksheet` | Exists | Step 2.5 hardcoded 80/20 rule must be replaced (FR-RCAP-010) |
| `backend/handlers/adminHandler.js` — repeat-cap handlers | Partially exists | `handleGetRepeatCapPolicy`, `handleUpdateRepeatCapPolicy`, `handleUpsertRepeatCapOverride` are all implemented; routing wiring must be verified |
| `backend/handlers/generateHandler.js` | Exists | Must be updated to call `resolveEffectiveRepeatCap` and pass result to `assembleWorksheet` (FR-RCAP-008) |
| DynamoDB `adminPolicies` table / local `adminPolicies` collection | Exists | Stores global policy including `repeatCapPolicy` node |
| DynamoDB `repeatCapOverrides` table / local `repeatCapOverrides` collection | Exists | Stores all scope overrides; `db.listAll('repeatCapOverrides')` already used |
| DynamoDB `adminAuditEvents` table / local collection | Exists | Audit log destination |
| DynamoDB `questionExposureHistory` table | Exists | Used by `getSeenQuestionSignatures` |
| `getUserQuestionHistory` in `src/ai/repeatCapPolicy.js` | Exists | Used by Step 2.5 in assembler; reads from `UserQuestionHistory` DynamoDB table or local file |
| M02 Question Bank adapter (`src/questionBank/`) | Exists | Provides bank candidates for `selectWithRepeatCap` |
| `backend/middleware/authMiddleware.js` — `requireRole` | Exists | Enforces RBAC on admin endpoints |
| `src/admin/auditLogger.js` — `writeAuditLog` | Exists | Called by admin handler on every mutation |

---

## 10. Open Questions

### OQ-RCAP-001 — Exposure Tracking Write Strategy: Fire-and-Forget vs. Awaited
**Question:** Should `recordExposureHistory` be awaited on the generation response path
or executed as fire-and-forget?
**Impact:** If awaited, a slow DynamoDB write adds latency to every worksheet generation.
If fire-and-forget, a write failure goes unnoticed and the student could receive repeat
questions beyond the configured cap on the very next generation.
**Recommendation:** Fire-and-forget with structured warning log. Confirm with platform
owner before implementation begins.

---

### OQ-RCAP-002 — Shared `repeatUsed` Counter Across Both Dedup Steps
**Question:** FR-RCAP-011 requires a unified `repeatUsed` counter spanning both the
signature-based dedup (Step 2) and the questionId-based dedup (Step 2.5). Currently these
are separate passes with separate counters. DEV must confirm whether this is achievable
without a full refactor of the assembler or whether Step 2.5 should simply be merged
into Step 2 using a combined seen-question set.
**Decision needed by:** DEV agent before implementation starts.

---

### OQ-RCAP-003 — Default Value Change: 10% vs. Requirements Example of 20%
**Question:** The current code default is `DEFAULT_REPEAT_CAP_PERCENT = 10` in
`src/ai/repeatCapPolicy.js` and `DEFAULT_POLICY.repeatCapPolicy.defaultPercent = 10` in
`adminHandler.js`. The business requirements document uses 20% as its example. Is 20%
the intended default for newly provisioned environments, or should 10% remain?
**Decision needed by:** Product Owner before first deployment.

---

### OQ-RCAP-004 — RepeatCapOverrides Scan Performance at Scale
**Question:** `resolveEffectiveRepeatCap` calls `db.listAll('repeatCapOverrides')` which
performs a full table scan in production DynamoDB. With hundreds or thousands of
overrides, this could become a latency concern. Should a GSI be added to
`repeatCapOverrides` on `(scope, scopeId)` to convert this to a targeted query?
**Impact:** Low risk in early phases with few overrides. Becomes a concern if the platform
scales to tens of thousands of teacher/student overrides.
**Recommendation:** Defer GSI addition until override count exceeds 500 records, at which
point the IaC agent should add the GSI to the CDK stack.

---

### OQ-RCAP-005 — Exposure History Scope: Should Subject Be Included?
**Question:** BR-RCAP-006 scopes repeat tracking to (studentKey, grade, difficulty), not
including subject or topic. This means a student who has seen a question in Math could
have it suppressed when requesting a Science worksheet if the same question somehow
appears in both topic buckets (unlikely but possible if the question bank has cross-subject
entries).
**Recommendation:** Add subject to the exposure tracking scope key to prevent this edge
case. Requires changing the schema in `recordExposureHistory` and `getSeenQuestionSignatures`.
Decision needed from DBA agent.

---

### OQ-RCAP-006 — Admin Console UI Ticket
**Question:** This spec covers the API only. A separate ticket is needed for the Admin
Console UI (learnfyra-admin React app) to surface the repeat cap setting and override
management. Has that ticket been created and assigned?
**Action:** Product Owner to create a UI spec ticket referencing this FRD.

---

### OQ-RCAP-007 — Compliance Admin Read Access
**Question:** The RBAC matrix grants read access to `GET /api/admin/policies/repeat-cap`
for Compliance Admin. Should Compliance Admin also be able to read the full `before`/`after`
diff in audit events (FR-RCAP-021), or only the summary fields (id, action, actorId,
target, createdAt)?
**Impact:** Exposing full before/after diffs to Compliance Admin could surface raw
configuration values that may be considered sensitive in some audit contexts.
**Decision needed by:** Security / Compliance owner.
