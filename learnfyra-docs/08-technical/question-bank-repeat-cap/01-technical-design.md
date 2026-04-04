# Question Bank Repeat Cap — Technical Design

**Status:** Draft
**Author:** Architect Agent
**Date:** 2026-04-04
**Requirement:** `learnfyra_document/QUESTION-BANK-REPEAT-CAP-ADMIN-REQUIREMENT.md`
**FRD:** `learnfyra-docs/07-requirements/question-bank/FEATURE_SPEC.md`

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│ WORKSHEET ASSEMBLY PIPELINE (with Dynamic Repeat Cap)                │
│                                                                      │
│  POST /api/generate { grade, subject, topic, difficulty, count }     │
│   │                                                                  │
│   ▼                                                                  │
│  ┌──────────────────────────────┐                                   │
│  │ repeatCapPolicy.js (REFACTOR)│                                   │
│  │  1. Resolve effective cap:   │                                   │
│  │     student → parent →       │                                   │
│  │     teacher → global default │                                   │
│  │  2. Calculate allocation:    │                                   │
│  │     maxRepeat = ceil(count   │                                   │
│  │       * capPercent / 100)    │                                   │
│  │     minUnseen = count -      │                                   │
│  │       maxRepeat              │                                   │
│  └──────────────────────────────┘                                   │
│   │                                                                  │
│   ▼                                                                  │
│  ┌──────────────────────────────┐                                   │
│  │ Question Exposure Lookup      │                                   │
│  │  DynamoDB: get questionIds   │                                   │
│  │  previously served to this   │                                   │
│  │  userId for this grade/      │                                   │
│  │  subject/topic               │                                   │
│  └──────────────────────────────┘                                   │
│   │                                                                  │
│   ▼                                                                  │
│  ┌──────────────────────────────┐                                   │
│  │ assembler.js (REFACTOR)       │                                   │
│  │  1. Query bank for unseen    │                                   │
│  │     questions (up to         │                                   │
│  │     minUnseen target)        │                                   │
│  │  2. If unseen < minUnseen,   │                                   │
│  │     add repeat questions     │                                   │
│  │     (up to maxRepeat cap)    │                                   │
│  │  3. If still short, call AI  │                                   │
│  │     for remaining questions  │                                   │
│  │  4. Record exposure          │                                   │
│  └──────────────────────────────┘                                   │
│   │                                                                  │
│   ▼                                                                  │
│  Return assembled worksheet                                          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ ADMIN CONTROL PLANE (Super Admin / Platform Admin only)              │
│                                                                      │
│  GET    /api/admin/repeat-cap           → global + all overrides     │
│  PUT    /api/admin/repeat-cap           → update global default      │
│  POST   /api/admin/repeat-cap/override  → create scope override      │
│  DELETE /api/admin/repeat-cap/override/:id → remove override         │
│                                                                      │
│  All changes → LearnfyraAuditLog (existing table)                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Design

### 2.1 Repeat Cap Configuration Store

**Table:** `LearnfyraConfig-{env}` (existing)

**Global default entry:**

| configKey (PK) | Value |
|---|---|
| `repeatCap:global` | `{ "value": 20, "updatedAt": "...", "updatedBy": "..." }` |

**Override entries (scope-specific):**

| configKey (PK) | Value |
|---|---|
| `repeatCap:override:student:{userId}` | `{ "value": 10, "scope": "student", "scopeId": "{userId}", "reason": "...", "expiresAt": "...", "updatedAt": "...", "updatedBy": "..." }` |
| `repeatCap:override:teacher:{userId}` | `{ "value": 25, "scope": "teacher", "scopeId": "{userId}", "reason": "...", "updatedAt": "...", "updatedBy": "..." }` |
| `repeatCap:override:parent:{userId}` | `{ "value": 15, "scope": "parent", "scopeId": "{userId}", "reason": "...", "updatedAt": "...", "updatedBy": "..." }` |

**Cache strategy:** Read global default on Lambda cold start, cache in module-level variable. Override lookups are per-request (student-specific). Cache TTL: 5 minutes for global default.

### 2.2 Cap Resolution Engine

**File:** `src/ai/repeatCapPolicy.js` (REFACTOR — replace hardcoded 80/20)

```javascript
/**
 * Resolve the effective repeat cap for a given generation context.
 * Precedence: student override → parent override → teacher override → global default.
 *
 * @param {Object} context
 * @param {string} [context.studentId] - Student userId (for student override lookup)
 * @param {string} [context.parentId]  - Parent userId (for parent override lookup)
 * @param {string} [context.teacherId] - Teacher userId (for teacher override lookup)
 * @returns {Promise<number>} Effective repeat cap percentage (0-100)
 */
export async function resolveRepeatCap(context) { ... }

/**
 * Calculate question allocation from cap percentage.
 *
 * @param {number} questionCount - Total questions requested
 * @param {number} capPercent    - Effective repeat cap (0-100)
 * @returns {{ maxRepeat: number, minUnseen: number }}
 */
export function calculateAllocation(questionCount, capPercent) {
  const maxRepeat = Math.ceil(questionCount * capPercent / 100);
  const minUnseen = questionCount - maxRepeat;
  return { maxRepeat, minUnseen };
}
```

**Resolution algorithm:**

```
1. If studentId provided:
   a. Query configKey = "repeatCap:override:student:{studentId}"
   b. If found and not expired → return override.value
2. If parentId provided:
   a. Query configKey = "repeatCap:override:parent:{parentId}"
   b. If found and not expired → return override.value
3. If teacherId provided:
   a. Query configKey = "repeatCap:override:teacher:{teacherId}"
   b. If found and not expired → return override.value
4. Query configKey = "repeatCap:global"
   a. If found → return global.value
5. Fallback → return 20 (hardcoded safety default if DynamoDB fails)
```

**DynamoDB read cost:** 1-4 GetItem calls per generation (worst case: check student, parent, teacher, global). All are consistent reads on the Config table PK.

### 2.3 Question Exposure Tracker

**Approach:** Extract exposure data from existing `LearnfyraWorksheetAttempt-{env}` table.

The attempt table already stores `answers` (a map of questionNumber → submittedAnswer) and `topic`/`subject`/`grade` per attempt. However, it does not directly store `questionId` values — it stores question numbers within a worksheet.

**Design decision:** Create a new lightweight table for exposure tracking rather than retrofitting the attempt table.

**New table:** `LearnfyraQuestionExposure-{env}`

| Attribute | Type | Role | Notes |
|---|---|---|---|
| userId | S | PK | Student's userId |
| exposureKey | S | SK | `{grade}#{subject}#{topic}#{questionId}` |
| questionId | S | Yes | Reference to QuestionBank |
| servedAt | S | Yes | ISO-8601 when first served |
| servedCount | N | Yes | How many times served (incremented) |

**Access pattern:** "Get all questionIds seen by userId for grade/subject/topic"

```
Query: PK = userId, SK begins_with("{grade}#{subject}#{topic}#")
```

This returns all questionIds the student has been served for a specific topic, enabling the assembler to exclude them when selecting unseen questions.

**Write pattern:** After worksheet assembly, batch-write exposure records for all questions included in the worksheet. Use `fire-and-forget` async DynamoDB puts (non-blocking).

**Guest users:** Use guest session ID as userId. Exposure resets when guest converts to registered user (acceptable — fresh start).

### 2.4 Assembly Logic Refactor

**File:** `src/ai/assembler.js` (REFACTOR)

**Current (hardcoded):**
```javascript
// Line ~347 (approximate) — THIS MUST CHANGE
const minUnseen = Math.ceil(questionCount * 0.8);
```

**Refactored flow:**

```javascript
export async function assembleWorksheet(options) {
  const { grade, subject, topic, difficulty, questionCount, studentId, parentId, teacherId } = options;

  // Step 1: Resolve effective repeat cap
  const capPercent = await resolveRepeatCap({ studentId, parentId, teacherId });
  const { maxRepeat, minUnseen } = calculateAllocation(questionCount, capPercent);

  // Step 2: Get exposure history for this student + topic
  const seenQuestionIds = await getExposedQuestionIds(studentId, grade, subject, topic);

  // Step 3: Query bank for unseen questions
  const unseenQuestions = await queryQuestionBank({
    grade, subject, topic, difficulty,
    excludeIds: seenQuestionIds,
    limit: minUnseen
  });

  let assembled = [...unseenQuestions];
  let remainingCount = questionCount - assembled.length;

  // Step 4: If short on unseen, fill with repeat questions (up to cap)
  if (remainingCount > 0 && maxRepeat > 0) {
    const repeatQuestions = await queryQuestionBank({
      grade, subject, topic, difficulty,
      includeOnlyIds: seenQuestionIds,
      limit: Math.min(remainingCount, maxRepeat)
    });
    assembled = [...assembled, ...repeatQuestions];
    remainingCount = questionCount - assembled.length;
  }

  // Step 5: If still short, generate via AI
  if (remainingCount > 0) {
    const aiQuestions = await generateQuestions({
      grade, subject, topic, difficulty,
      count: remainingCount
    });
    assembled = [...assembled, ...aiQuestions];
  }

  // Step 6: Record exposure (fire-and-forget)
  recordExposure(studentId, grade, subject, topic, assembled.map(q => q.questionId));

  return {
    questions: assembled,
    bankStats: {
      fromBankUnseen: unseenQuestions.length,
      fromBankRepeat: assembled.length - unseenQuestions.length - (remainingCount > 0 ? remainingCount : 0),
      fromAi: Math.max(0, questionCount - unseenQuestions.length - (assembled.length - unseenQuestions.length)),
      effectiveCapPercent: capPercent,
      maxRepeatAllowed: maxRepeat
    }
  };
}
```

**Edge cases:**

| Scenario | Behavior |
|---|---|
| Cap = 0% | All questions must be unseen. If bank doesn't have enough, AI generates remainder. |
| Cap = 100% | Repeats allowed without limit. Bank query doesn't filter by exposure. |
| New student (no exposure) | All bank questions are "unseen." Normal flow. |
| Empty bank | All questions generated by AI. |
| All questions seen | Up to maxRepeat from bank, remainder from AI. |

### 2.5 Admin API Extensions

**File:** `backend/handlers/adminHandler.js` (EXTEND existing routes)

| Endpoint | Method | RBAC | Description |
|---|---|---|---|
| `/api/admin/repeat-cap` | GET | Super Admin, Platform Admin | Get global default + list all overrides |
| `/api/admin/repeat-cap` | PUT | Super Admin, Platform Admin | Update global default |
| `/api/admin/repeat-cap/override` | POST | Super Admin, Platform Admin | Create scope override |
| `/api/admin/repeat-cap/override/:scope/:scopeId` | DELETE | Super Admin, Platform Admin | Remove override |

**GET /api/admin/repeat-cap response:**
```json
{
  "global": { "value": 20, "updatedAt": "...", "updatedBy": "..." },
  "overrides": [
    {
      "scope": "student",
      "scopeId": "student-uuid",
      "value": 10,
      "reason": "Remedial student needs more variety",
      "expiresAt": "2026-06-01T00:00:00Z",
      "updatedAt": "...",
      "updatedBy": "..."
    }
  ]
}
```

**PUT /api/admin/repeat-cap request:**
```json
{
  "value": 25,
  "reason": "Increasing cap due to limited question inventory in Science"
}
```

**Validation rules:**
- `value` must be integer 0-100
- `reason` required on all changes
- `scope` must be one of: `student`, `parent`, `teacher`
- `scopeId` must be valid UUID

---

## 3. Data Design

### 3.1 DynamoDB Config Entries

See Section 2.1 above for configKey patterns. Summary:

| configKey Pattern | Purpose |
|---|---|
| `repeatCap:global` | Global default cap (e.g., 20) |
| `repeatCap:override:student:{userId}` | Student-specific override |
| `repeatCap:override:parent:{userId}` | Parent-specific override |
| `repeatCap:override:teacher:{userId}` | Teacher-specific override |

### 3.2 Question Exposure Table (NEW)

**Table:** `LearnfyraQuestionExposure-{env}`

| Attribute | Type | Key | Notes |
|---|---|---|---|
| userId | S | PK | Student userId or guest session ID |
| exposureKey | S | SK | `{grade}#{subject}#{topic}#{questionId}` |
| questionId | S | — | QuestionBank reference |
| servedAt | S | — | ISO-8601 first served |
| servedCount | N | — | Times served |

**Billing:** PAY_PER_REQUEST (same as all tables).
**Deletion:** When user is deleted (GDPR), delete all exposure records for that userId.
**TTL:** Optional — exposure records older than 1 year can be auto-deleted (configurable).

### 3.3 Audit Log Entries

**Admin cap change event (written to LearnfyraAuditLog):**

```javascript
{
  auditId: "uuid",
  timestamp: "2026-04-04T10:00:00Z",
  eventType: "admin.repeat_cap_updated",
  actorId: "admin-user-id",
  actorRole: "SUPER_ADMIN",
  action: "repeat_cap_global_updated",
  target: { type: "config", id: "repeatCap:global" },
  details: {
    previousValue: 20,
    newValue: 25,
    reason: "Increasing cap due to limited Science inventory"
  },
  status: "success"
}
```

**Override created:**

```javascript
{
  auditId: "uuid",
  timestamp: "2026-04-04T10:05:00Z",
  eventType: "admin.repeat_cap_override_created",
  actorId: "admin-user-id",
  actorRole: "PLATFORM_ADMIN",
  action: "repeat_cap_override_created",
  target: { type: "config", id: "repeatCap:override:student:student-uuid" },
  details: {
    scope: "student",
    scopeId: "student-uuid",
    value: 10,
    reason: "Remedial student needs more question variety",
    expiresAt: "2026-06-01T00:00:00Z"
  },
  status: "success"
}
```

---

## 4. API Contracts (Summary)

See Section 2.5 for full endpoint definitions.

### PUT /api/admin/repeat-cap

```
Request:  { "value": 25, "reason": "..." }
Response: { "success": true, "global": { "value": 25, ... }, "auditId": "uuid" }
Errors:   400 (invalid value), 403 (not admin)
```

### POST /api/admin/repeat-cap/override

```
Request:  { "scope": "student", "scopeId": "uuid", "value": 10, "reason": "...", "expiresAt": "..." }
Response: { "success": true, "override": { ... }, "auditId": "uuid" }
Errors:   400 (invalid scope/value), 403 (not admin), 409 (override already exists)
```

### DELETE /api/admin/repeat-cap/override/:scope/:scopeId

```
Response: { "success": true, "auditId": "uuid" }
Errors:   404 (not found), 403 (not admin)
```

---

## 5. File Structure

### New Files

```
src/ai/exposure/
  exposureTracker.js              Track + query question exposure per student

tests/unit/
  repeatCapPolicy.test.js         (EXTEND existing)
  exposureTracker.test.js
  assembler.repeat-cap.test.js    Assembly logic with dynamic cap

tests/integration/
  repeat-cap-admin.test.js        Admin API for repeat cap CRUD
  repeat-cap-assembly.test.js     End-to-end: configure cap → generate → verify allocation
```

### Existing Files to Modify

```
src/ai/repeatCapPolicy.js         Replace hardcoded 80/20 with DynamoDB-driven resolution
src/ai/assembler.js                Replace hardcoded minUnseen with calculateAllocation()
backend/handlers/adminHandler.js   Add repeat-cap admin endpoints
server.js                          Add Express routes for repeat-cap admin
src/admin/auditLogger.js           Add repeat_cap audit event types
```

### CDK (Phase 3)

```
infra/cdk/lib/learnfyra-stack.ts   Add LearnfyraQuestionExposure table
                                    Seed repeatCap:global config entry
                                    Grant Lambda read/write on exposure table
```

---

## 6. Performance Considerations

| Operation | Latency | Notes |
|---|---|---|
| Resolve cap (1-4 DynamoDB gets) | 5-20ms | Consistent reads, <1KB items |
| Exposure lookup (DynamoDB query) | 10-50ms | Depends on exposure history size |
| Bank query (unseen filter) | 20-100ms | GSI-1 query with exclusion set |
| Exposure write (batch, async) | 0ms blocking | Fire-and-forget DynamoDB batch writes |
| **Total added to assembly** | **35-170ms** | Acceptable within 60s handler timeout |

**Scale concern:** Students who have been served thousands of questions will have large exposure sets. Mitigation: exposure query uses `begins_with` on SK, filtered to specific topic. Expected cardinality: <500 questions per student per topic.

---

## 7. Edge Cases & Failure Modes

| Scenario | Behavior |
|---|---|
| DynamoDB config read fails | Fallback to hardcoded default (20%) |
| Exposure table read fails | Treat all questions as unseen (no cap enforcement) |
| Cap = 0% (all unseen required) | Only unseen from bank + AI backfill for remainder |
| Cap = 100% | No exposure filtering, all bank questions eligible |
| New student (no exposure) | All bank questions are unseen, normal flow |
| Very small bank (<5 questions for topic) | Fill from bank, AI generates remainder |
| Override expired | Resolution skips it, falls through to next scope |
| Admin sets global to 0% | Aggressive AI generation, may increase Claude API cost |

---

## 8. Dependencies & Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Exposure table grows large | Low | TTL-based cleanup (1 year), partition by userId |
| Override scan slow with many overrides | Medium | Overrides are point-reads (specific configKey), not scans |
| Hardcoded 80/20 missed in other code paths | Medium | Grep for `0.8` and `0.2` in all assembler-related files |
| Guest user exposure lost on conversion | Low | Acceptable — fresh start on registration |
| Fire-and-forget exposure writes lost | Low | DynamoDB is durable; retry on next generation |

**Hard dependencies:** DynamoDB Config table (existing), Question Bank table (existing).
**New infrastructure:** LearnfyraQuestionExposure table (DynamoDB, PAY_PER_REQUEST).

---

## 9. Rollout Plan

1. **Phase 1 (Local):** Refactor `repeatCapPolicy.js` and `assembler.js`. Implement `exposureTracker.js`. Mock DynamoDB config in local adapter. Test with `localDbAdapter.js`.
2. **Phase 2 (Admin API):** Add repeat-cap admin endpoints to `adminHandler.js`. Wire into `server.js`. Test via Postman.
3. **Phase 3 (AWS):** Create `LearnfyraQuestionExposure` table in CDK. Seed `repeatCap:global` config. Deploy to dev.
4. **Phase 4 (Migration):** Backfill exposure data from existing attempt records (optional, low priority).
