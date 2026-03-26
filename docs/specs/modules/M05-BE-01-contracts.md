# M05-BE-01 — Progress & Reporting Backend Contracts
Status: implementation-ready
Task ID: M05-BE-01
Authors: architect-agent + backend-developer-agent
Updated: 2026-03-26

---

## Summary

Seven endpoints cover all M05 scope. Three are already implemented; four must be built.
All handlers share the same infrastructure: Bearer JWT via `authMiddleware.js`, `localDbAdapter`
for local dev (`APP_RUNTIME` unset), DynamoDB adapter for AWS (`APP_RUNTIME=aws`).

| Endpoint | Status | Handler File |
|---|---|---|
| POST /api/progress/save | Implemented — contract confirmed | progressHandler.js |
| GET /api/progress/history | Implemented — contract confirmed | progressHandler.js |
| GET /api/analytics/class/:id | Implemented — 1 security gap noted | analyticsHandler.js |
| GET /api/progress/insights | **Build** | progressHandler.js (extend) |
| GET /api/progress/parent/:childId | **Build** | progressHandler.js (extend) |
| GET /api/analytics/student/:id | **Build** | analyticsHandler.js (extend) |
| GET /api/certificates | **Build** | certificatesHandler.js (new) |
| GET /api/certificates/:id/download | **Build** | certificatesHandler.js (new) |

---

## Standard Error Model

All M05 endpoints return the same envelope already present in the codebase:

```json
{ "error": "lowercase message, period-terminated." }
```

CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`,
`Access-Control-Allow-Methods`) are required on **every** response including errors.

| HTTP | Trigger condition |
|---|---|
| 400 | Missing required field, invalid type, constraint violation |
| 401 | Missing Authorization header, invalid/expired JWT, invalid download token |
| 403 | Valid JWT but role or ownership check fails |
| 404 | Referenced resource not found |
| 500 | Unhandled exception — sanitize to `"Internal server error."` |

---

## New Data Tables Required

Two tables must be added to `data-local/` (JSON) and documented for future DynamoDB migration.

### `certificates` table

Primary key field: `id` (UUID)

```json
{
  "id":          "uuid-v4",
  "studentId":   "uuid — JWT.sub of the student",
  "attemptId":   "uuid — the attempt that triggered issuance",
  "worksheetId": "uuid",
  "subject":     "Math|ELA|Science|Social Studies|Health",
  "topic":       "string",
  "grade":       "integer 1–10",
  "score":       "integer — totalScore from the attempt",
  "totalPoints": "integer",
  "percentage":  "integer 0–100",
  "issuedAt":    "ISO-8601",
  "createdAt":   "ISO-8601"
}
```

**Issuance rule:** A certificate is created inside `progressHandler.handleSave` when:
1. `isFirstAttempt === true` (already computed in the save handler)
2. `percentage >= CERTIFICATE_THRESHOLD` (env var, default `80`)

The issuance block uses the same non-fatal `try/catch` pattern as the rewards engine. A failed
certificate write must NOT prevent the attempt save from returning 201.

### `parentLinks` table

Primary key field: `id` (composite string)

```json
{
  "id":        "{parentId}#{childId}",
  "parentId":  "uuid — JWT.sub of the parent user",
  "childId":   "uuid — userId of the linked student",
  "status":    "active | pending | revoked",
  "linkedAt":  "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

The API for **creating** parent-child links is out of scope for M05. For local dev and QA,
seed `data-local/parentLinks.json` with test fixtures. Production link management belongs to
a future admin/onboarding module.

---

## Endpoint Contracts

---

### POST /api/progress/save
**Role:** student (any authenticated user; student role not enforced today — see open questions)
**Auth:** Bearer JWT required
**Status:** Implemented — confirm additional validation rules below

#### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| worksheetId | string | yes | UUID v4 |
| grade | integer | yes | 1–10 |
| subject | string | yes | `Math\|ELA\|Science\|Social Studies\|Health` |
| topic | string | yes | non-empty, max 200 chars |
| difficulty | string | yes | `Easy\|Medium\|Hard\|Mixed` |
| totalScore | number | yes | >= 0, finite |
| totalPoints | number | yes | > 0, finite |
| percentage | number | yes | 0–100 |
| answers | array | yes | min 1 item, each: `{ number: int >= 1, answer: string }` |
| classId | string | no | UUID v4 when provided |
| timeTaken | integer | no | seconds >= 0, default 0 |
| timed | boolean | no | default false |

**Cross-field constraints:**
- `totalScore <= totalPoints`
- Server-side: recompute `round((totalScore / totalPoints) * 100)` and store server value; reject request (400) if the client value differs by more than 1 (rounding tolerance only)

#### Success Response — HTTP 201

```json
{
  "attemptId": "uuid-v4",
  "message":   "Saved.",
  "rewards":   null
}
```

`rewards` is `null` when no rewards are earned; otherwise an object from the rewards engine
(shape owned by M06 — M05 passes it through opaquely). Non-fatal: rewards failure does not
fail the save.

#### Error Responses

| HTTP | condition |
|---|---|
| 400 | Any required field missing, wrong type, or constraint violation |
| 401 | Missing or invalid JWT |
| 500 | Unhandled exception |

#### Aggregation Rules

- After persisting the attempt, read `aggregates` by key `{studentId}#{subject}`
- If no aggregate: create with `attemptCount=1`, `totalScore`, `totalPoints`, `averagePercentage`
- If aggregate exists: increment `attemptCount`, add raw scores, recompute
  `averagePercentage = round((newTotalScore / newTotalPoints) * 100)` (weighted-point average, not average of percentages)
- After aggregate update: if `isFirstAttempt && percentage >= CERTIFICATE_THRESHOLD`, write certificate record (non-fatal)

---

### GET /api/progress/history
**Role:** any authenticated user (returns caller's own attempts)
**Auth:** Bearer JWT required
**Status:** Implemented — contract confirmed

#### Query Parameters

| name | type | required | default | constraints |
|---|---|---|---|---|
| limit | integer | no | 50 | 1–100 |
| offset | integer | no | 0 | >= 0 |
| subject | string | no | — | enum filter |

#### Success Response — HTTP 200

```json
{
  "attempts": [
    {
      "attemptId":   "uuid-v4",
      "worksheetId": "uuid-v4",
      "grade":       3,
      "subject":     "Math",
      "topic":       "Multiplication",
      "difficulty":  "Medium",
      "totalScore":  8,
      "totalPoints": 10,
      "percentage":  80,
      "timeTaken":   300,
      "timed":       false,
      "createdAt":   "2026-03-25T10:00:00.000Z"
    }
  ]
}
```

- `answers` is intentionally excluded from history entries (reduce payload)
- Sorted `createdAt` descending (newest first)
- `studentId` always equals `JWT.sub` — caller cannot request another student's history

#### Error Responses

| HTTP | condition |
|---|---|
| 401 | Missing or invalid JWT |

---

### GET /api/analytics/class/:id
**Role:** teacher only
**Auth:** Bearer JWT required
**Status:** Implemented — **security gap must be patched** (see validation rules)

#### Path Parameters

| name | type | required |
|---|---|---|
| id | UUID string | yes |

#### Success Response — HTTP 200

```json
{
  "classId": "uuid-v4",
  "topicBreakdown": [
    {
      "topic":        "Multiplication",
      "attempts":     12,
      "averageScore": 65,
      "weakFlag":     true
    }
  ],
  "totalStudents": 5,
  "totalAttempts": 60
}
```

Empty `topicBreakdown: []` returned when class has no enrolled students or no attempts.
Sorted alphabetically by topic name.

#### Error Responses

| HTTP | condition |
|---|---|
| 400 | Class ID missing |
| 401 | Missing or invalid JWT |
| 403 | Role is not `teacher` |
| 403 | Class exists but `classRecord.teacherId !== JWT.sub` |
| 404 | Class not found |

**Security gap to patch:** The current implementation does NOT verify
`classRecord.teacherId === decoded.sub`. Any teacher can read any class.
Add this ownership check after the 404 guard. Return 403 (not 404) on ownership failure to
make the error reason explicit.

#### Aggregation Rules

- Scope: all attempts where `attempt.studentId` is in the set of `active` memberships for the class
- Group by `attempt.topic`
- `averageScore = round((sum totalScore / sum totalPoints) * 100)` across all attempts in the group
- `weakFlag = averageScore < 70` (exactly 70 is NOT weak)
- `attempts` = count of individual attempt records
- Topics with zero `totalPoints` are excluded

---

### GET /api/progress/insights
**Role:** student (or any authenticated user — returns caller's own data)
**Auth:** Bearer JWT required
**Status:** Not yet implemented

#### Query Parameters

| name | type | required | default | constraints |
|---|---|---|---|---|
| subject | string | no | — | enum filter; unrecognised value returns empty array, not 400 |
| limit | integer | no | 20 | 1–50 |

#### Success Response — HTTP 200

```json
{
  "studentId":       "uuid-v4",
  "generatedAt":     "2026-03-26T10:00:00.000Z",
  "insights": [
    {
      "subject":           "Math",
      "topic":             "Fractions",
      "attemptCount":      4,
      "averageScore":      62,
      "weakFlag":          true,
      "trend":             "improving",
      "recentScores":      [55, 58, 62, 68],
      "lastAttemptAt":     "2026-03-25T14:00:00.000Z"
    }
  ],
  "weakTopicCount":  1,
  "totalTopicCount": 2
}
```

Empty `insights: []` is valid when the student has no attempts.

#### Error Responses

| HTTP | condition |
|---|---|
| 400 | `limit` outside 1–50 |
| 401 | Missing or invalid JWT |

#### Aggregation Rules

**Data source:** Query all attempts where `attempt.studentId === JWT.sub`. Group by
`(subject, topic)` pair in application code (the `aggregates` table is per-subject only —
topic-level grouping requires scanning `attempts`).

- `averageScore = round((sum totalScore / sum totalPoints) * 100)` across all attempts in the group
- `weakFlag = averageScore < 70`
- `recentScores`: the `percentage` from the 3 most recent attempts for this topic, sorted
  oldest-to-newest. Fewer than 3 attempts: include all available. Max 3 entries.
- **Trend calculation** (requires ≥ 2 attempts per topic):
  - Split attempts into `recent` (last 3) and `prior` (all before those 3), both sorted ascending by `createdAt`
  - `recentAvg = mean(recent.percentage)`
  - `priorAvg = mean(prior.percentage)`; if no prior exists, `priorAvg = recent[0].percentage`
  - `recentAvg > priorAvg + 5` → `"improving"`
  - `recentAvg < priorAvg - 5` → `"declining"`
  - Otherwise → `"stable"`
  - Single attempt: `"stable"`
- **Sort order:** `weakFlag` descending first (weak topics at top), then `averageScore` ascending (worst weak topics first)
- `subject` query param filters after computation (consistent counts)

---

### GET /api/progress/parent/:childId
**Role:** parent only
**Auth:** Bearer JWT required
**Status:** Not yet implemented

#### Path Parameters

| name | type | required |
|---|---|---|
| childId | UUID string | yes |

#### Query Parameters

| name | type | required | default | constraints |
|---|---|---|---|---|
| subject | string | no | — | enum filter |
| limit | integer | no | 50 | 1–200 |
| offset | integer | no | 0 | >= 0 |

#### Success Response — HTTP 200

```json
{
  "childId":     "uuid-v4",
  "displayName": "Alex Smith",
  "history": [
    {
      "attemptId":   "uuid-v4",
      "worksheetId": "uuid-v4",
      "grade":       3,
      "subject":     "Math",
      "topic":       "Multiplication",
      "difficulty":  "Medium",
      "totalScore":  8,
      "totalPoints": 10,
      "percentage":  80,
      "timeTaken":   300,
      "timed":       false,
      "createdAt":   "2026-03-25T10:00:00.000Z"
    }
  ],
  "aggregates": [
    {
      "subject":           "Math",
      "attemptCount":      5,
      "averagePercentage": 78,
      "lastAttemptAt":     "2026-03-25T10:00:00.000Z"
    }
  ],
  "totalAttempts": 5,
  "pagination": {
    "limit":    50,
    "offset":   0,
    "returned": 5
  }
}
```

`answers` is excluded from history entries. `aggregates` is always returned in full (not paginated).

#### Error Responses

| HTTP | condition |
|---|---|
| 400 | `childId` missing or `limit` out of range |
| 401 | Missing or invalid JWT |
| 403 | Role is not `parent` |
| 403 | No active `parentLinks` record for `(JWT.sub, childId)` |
| 404 | Student not found |

#### Authorization Logic

```
1. Verify decoded.role === 'parent'                                  → 403 if not
2. Construct key = `{decoded.sub}#{childId}`
3. db.getItem('parentLinks', key)                                    → 403 if null
4. Verify link.status === 'active'                                   → 403 if not active
5. db.getItem('users', childId) to resolve displayName              → 404 if not found
6. Proceed to read attempts and aggregates for childId
```

Return 403 (not 404) when link is absent — avoids child UUID enumeration.

---

### GET /api/analytics/student/:id
**Role:** teacher only
**Auth:** Bearer JWT required
**Status:** Not yet implemented

#### Path Parameters

| name | type | required |
|---|---|---|
| id | UUID string | yes — the student's userId |

#### Query Parameters

| name | type | required | default | constraints |
|---|---|---|---|---|
| classId | UUID string | no | — | scope to one class; triggers ownership check |
| subject | string | no | — | enum filter |
| limit | integer | no | 100 | 1–500 |
| offset | integer | no | 0 | >= 0 |

#### Success Response — HTTP 200

```json
{
  "studentId":   "uuid-v4",
  "displayName": "Alex Smith",
  "attempts": [
    {
      "attemptId":   "uuid-v4",
      "worksheetId": "uuid-v4",
      "classId":     "uuid-v4",
      "grade":       3,
      "subject":     "Math",
      "topic":       "Multiplication",
      "difficulty":  "Medium",
      "totalScore":  8,
      "totalPoints": 10,
      "percentage":  80,
      "timeTaken":   300,
      "timed":       false,
      "answers":     [...],
      "createdAt":   "2026-03-25T10:00:00.000Z"
    }
  ],
  "topicBreakdown": [
    {
      "subject":      "Math",
      "topic":        "Multiplication",
      "attempts":     3,
      "averageScore": 77,
      "weakFlag":     false
    }
  ],
  "aggregates": [
    {
      "subject":           "Math",
      "attemptCount":      5,
      "averagePercentage": 78,
      "lastAttemptAt":     "2026-03-25T10:00:00.000Z"
    }
  ],
  "totalAttempts": 5,
  "pagination": {
    "limit":    100,
    "offset":   0,
    "returned": 5
  }
}
```

`answers` **IS** included in each attempt entry (teacher-facing view — teachers review individual responses).

#### Error Responses

| HTTP | condition |
|---|---|
| 400 | Student ID missing |
| 401 | Missing or invalid JWT |
| 403 | Role is not `teacher` |
| 403 | `classId` provided but `classRecord.teacherId !== JWT.sub` |
| 404 | Student not found |

#### Authorization Logic

```
1. Verify decoded.role === 'teacher'                                 → 403 if not
2. If classId provided:
     classRecord = db.getItem('classes', classId)                   → 404 if not found
     Verify classRecord.teacherId === decoded.sub                   → 403 if not
     Filter attempts to attempt.classId === classId
3. If classId not provided:
     No ownership check in MVP — documented as a known gap.
     (Future: restrict unscoped queries to students in teacher's classes)
4. db.getItem('users', studentId) to resolve displayName            → 404 if not found
```

#### Aggregation Rules

- `topicBreakdown` is computed from the **filtered attempts subset** (not all-time data):
  `round((sumScore / sumPoints) * 100)` per topic, `weakFlag = averageScore < 70`
- `aggregates` are pulled from the `aggregates` table (all-time per-subject, regardless of classId filter)

---

### GET /api/certificates
**Role:** student only
**Auth:** Bearer JWT required
**Status:** Not yet implemented

#### Query Parameters

| name | type | required | default | constraints |
|---|---|---|---|---|
| limit | integer | no | 20 | 1–100 |
| offset | integer | no | 0 | >= 0 |

#### Success Response — HTTP 200

```json
{
  "studentId": "uuid-v4",
  "certificates": [
    {
      "certificateId": "uuid-v4",
      "worksheetId":   "uuid-v4",
      "subject":       "Math",
      "topic":         "Multiplication",
      "grade":         3,
      "score":         9,
      "totalPoints":   10,
      "percentage":    90,
      "issuedAt":      "2026-03-25T14:00:00.000Z",
      "downloadToken": "opaque-signed-string"
    }
  ],
  "total": 3,
  "pagination": {
    "limit":    20,
    "offset":   0,
    "returned": 3
  }
}
```

Empty `certificates: []` is valid. Sorted by `issuedAt` descending.

#### Error Responses

| HTTP | condition |
|---|---|
| 401 | Missing or invalid JWT |
| 403 | Role is not `student` |

#### Download Token

`downloadToken` is a short-lived signed token computed at list time (NOT stored):

```
token = base64url( `{certificateId}:{studentId}:{expiresAt}` + "." + hmac )
hmac  = HMAC-SHA256( `{certificateId}:{studentId}:{expiresAt}`, process.env.JWT_SECRET )
expiresAt = now + 15 minutes (ISO-8601 or Unix ms — implementation choice, must be consistent)
```

`JWT_SECRET` is already required by `authMiddleware.js` — no new secret needed.
If `JWT_SECRET` is absent: return 500 and log; never issue invalid tokens silently.

---

### GET /api/certificates/:id/download
**Role:** student only
**Auth:** Bearer JWT required
**Status:** Not yet implemented

#### Path Parameters

| name | type | required |
|---|---|---|
| id | UUID string | yes — certificateId |

#### Query Parameters

| name | type | required |
|---|---|---|
| token | string | yes — downloadToken from the list endpoint |

#### Success Response — HTTP 200

```json
{
  "certificateId": "uuid-v4",
  "studentId":     "uuid-v4",
  "displayName":   "Alex Smith",
  "subject":       "Math",
  "topic":         "Multiplication",
  "grade":         3,
  "percentage":    90,
  "issuedAt":      "2026-03-25T14:00:00.000Z",
  "htmlContent":   "<html>...</html>"
}
```

`htmlContent` is certificate HTML for client-side rendering and printing. A template file
`src/templates/certificate.html.js` should be created (similar pattern to `worksheet.html.js`).

Future AWS: replace `htmlContent` with `downloadUrl` (S3 presigned URL). The field name
change is intentional — do not add `downloadUrl` now.

#### Error Responses

| HTTP | condition |
|---|---|
| 400 | Certificate ID missing |
| 400 | `token` query param absent |
| 401 | Missing or invalid JWT |
| 401 | "Download token is invalid or expired." |
| 403 | Role is not `student` |
| 403 | `certificate.studentId !== JWT.sub` |
| 404 | Certificate not found |

#### Authorization Logic (must execute in this order)

```
1. Verify decoded.role === 'student'                                 → 403 if not
2. Parse and verify download token:
     a. base64url-decode token
     b. Split on last "." to separate payload and HMAC
     c. Re-compute HMAC; compare (constant-time comparison)          → 401 on mismatch
     d. Parse expiresAt; verify > now                                → 401 on expiry
     e. Verify payload.certificateId === path.id                     → 401 on mismatch
     f. Verify payload.studentId === decoded.sub                     → 401 on mismatch
3. db.getItem('certificates', path.id)                               → 404 if not found
4. Verify certificate.studentId === decoded.sub                      → 403 (defense-in-depth)
5. Render and return htmlContent
```

---

## Validation Rules Reference

### Field-level rules (reusable across handlers)

Add these to `backend/middleware/validator.js` as exported helpers:

```
validateUUID(value)         → must match UUID v4 regex
validateGrade(value)        → integer, 1–10
validateSubject(value)      → enum: Math | ELA | Science | Social Studies | Health
validateDifficulty(value)   → enum: Easy | Medium | Hard | Mixed
validatePercentage(value)   → number, 0–100
validatePositiveInt(value)  → integer > 0
validateNonNegInt(value)    → integer >= 0
validateLimit(value, max)   → integer 1–max
```

### Percentage cross-validation in /save

```javascript
const expectedPct = Math.round((totalScore / totalPoints) * 100);
if (Math.abs(expectedPct - percentage) > 1) {
  return errorResponse(400, 'percentage does not match totalScore / totalPoints.');
}
// Always store server-computed value
attempt.percentage = expectedPct;
```

---

## DB Adapter Notes

The `localDbAdapter` supports: `putItem`, `getItem`, `deleteItem`, `queryByField`, `listAll`, `updateItem`.

**There is no compound query.** Multi-field filtering must be done in application code:
```javascript
// Example: get all aggregates for a student (needed by parent and insights endpoints)
const allAggregates = await db.listAll('aggregates');
const studentAggregates = allAggregates.filter(a => a.studentId === studentId);
```

**Primary key resolution** uses `item.id ?? item.userId ?? item.classId ?? item.attemptId`.
All new tables (`certificates`, `parentLinks`) must use field name `id` for their primary key.

**No transaction support.** Attempt save + aggregate update + certificate write are three
separate writes. If any write fails after a prior one succeeds, the data is inconsistent.
This is acceptable for local dev MVP. Flag for DynamoDB `TransactWrite` in the AWS adapter.

---

## Open Questions (Orchestrator Decisions Required)

| # | Question | Default if not decided |
|---|---|---|
| 1 | Should `POST /api/progress/save` be restricted to `student` role only? | Unrestricted (any authenticated user) |
| 2 | Teacher cross-class restriction for `/analytics/student/:id` with no `classId` — enforce or defer? | Defer (known gap, add CloudWatch metric) |
| 3 | Certificate HTML template — extend `src/templates/worksheet.html.js` or new `certificate.html.js`? | New `src/templates/certificate.html.js` |
| 4 | `downloadToken` passed as query param (visible in logs) — acceptable for MVP? | Acceptable for MVP |
| 5 | Who creates `parentLinks` records — which module, which actor? | Out of scope for M05; seed manually for testing |
| 6 | Percentage server-override vs rejection on mismatch? | Server-override (silent correction) |
| 7 | Analytics class route 403 vs 404 on teacher ownership failure? | 403 (explicit error) |

---

## Implementation Sequence (Local Dev — Phase 1)

1. Add validation helpers to `backend/middleware/validator.js`
2. Add certificate issuance block to `progressHandler.handleSave` (non-fatal try/catch)
3. Add `GET /api/progress/insights` route to `progressHandler.js`
4. Add `GET /api/progress/parent/:childId` route to `progressHandler.js`
5. Patch teacher-ownership check in `analyticsHandler.handleClassAnalytics`
6. Add `GET /api/analytics/student/:id` route to `analyticsHandler.js`
7. Create `backend/handlers/certificatesHandler.js` (list + download)
8. Create `src/templates/certificate.html.js`
9. Wire all new routes in `server.js`
10. Seed `data-local/parentLinks.json` with QA test fixtures
11. Run full test suite — no regressions

Phase 2 (AWS) is a separate branch after all local tests pass.
