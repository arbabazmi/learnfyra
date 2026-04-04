# Module 5 — Technical Design Document
## Teacher & Parent Roles

| Field | Value |
|---|---|
| Document | 02-technical-design.md |
| Module | M05 — Teacher & Parent Roles |
| Version | 1.0 |
| Date | 2026-04-03 |
| Prepared By | Technical Designer |
| Source Documents | 01-requirements-analysis.md, MODULE_5_FRD_Teacher_Parent.md v1.0 |
| Audience | DEV Agent, QA Agent, IaC Agent, DevOps Agent |

---

## 1. System Architecture

### 1.1 Overview

M05 extends the existing Learnfyra backend with five new Lambda-compatible handler files, six new DynamoDB tables, shared RBAC utility functions, and new Express routes in server.js. The architecture follows the same patterns already established in existing handlers (classHandler.js, submitHandler.js, etc.).

```
                     ┌─────────────────────────────────────────────┐
                     │  API Gateway (prod) / Express server.js (dev)│
                     └────────────────┬────────────────────────────┘
                                      │ JWT Bearer token on all /api/* routes
                     ┌────────────────▼─────────────────────────────┐
                     │  Lambda Authorizer (M01 — already deployed)   │
                     │  - Validates JWT signature                    │
                     │  - Extracts role claim (student/teacher/parent)│
                     │  - Rejects wrong-role requests with 403       │
                     └────────────────┬─────────────────────────────┘
                                      │ Passes { sub, role, email } context
          ┌──────────────────┬─────────┴──────────┬──────────────────┐
          ▼                  ▼                     ▼                  ▼
 classHandler.js   assignmentHandler.js  reviewQueueHandler.js  parentHandler.js
 (teacher CRUD)    (assignment + roster)  (score correction)   (parent linking)
          └──────────────────┴─────────┬──────────┴──────────────────┘
                                       ▼
                             analyticsHandler.js
                             (read-only aggregation)
          │
          ├── src/utils/rbac.js            (shared RBAC checks)
          ├── src/db/dynamoDbAdapter.js    (existing — extended with new tables)
          └── DynamoDB tables              (6 new + 2 modified)
```

### 1.2 New Handler Files

| Handler File | Routes Covered | Lambda Config |
|---|---|---|
| `backend/handlers/classHandler.js` | POST /classes, GET /classes, GET /classes/:id, PATCH /classes/:id, DELETE /classes/:id/archive, POST /classes/:id/invite | 256 MB, 15 s |
| `backend/handlers/assignmentHandler.js` | POST /assignments, GET /assignments/:id, GET /classes/:id/assignments, PATCH /assignments/:id, DELETE /assignments/:id/close, GET /classes/:id/students, DELETE /classes/:id/students/:sid, POST /classes/:id/students/:sid/parent-invite | 256 MB, 15 s |
| `backend/handlers/reviewQueueHandler.js` | GET /classes/:id/review-queue, POST /review-queue/:id/resolve | 256 MB, 15 s |
| `backend/handlers/analyticsHandler.js` | GET /classes/:id/analytics, GET /classes/:id/analytics/heatmap, GET /classes/:id/students/:sid/progress | 512 MB, 30 s |
| `backend/handlers/parentHandler.js` | POST /parent/link, GET /parent/children, DELETE /parent/children/:sid, GET /parent/children/:sid/progress, GET /parent/children/:sid/assignments, POST /student/parent-invite, POST /student/classes/join, GET /student/assignments, GET /student/assignments/:id | 256 MB, 15 s |

The existing `classHandler.js` file (which currently implements only POST /api/class/create and GET /api/class/:id/students) must be superseded by the new M05 classHandler. The old endpoints are folded into the new design under Section 5.

### 1.3 Shared Utilities

A new file `src/utils/rbac.js` centralises the three repeating RBAC checks to prevent copy-paste divergence across handlers:

- `verifyTeacherOwnsClass(db, classId, teacherId)` — fetches Class record, returns it if teacherId matches, throws 403 NOT_CLASS_OWNER otherwise.
- `verifyParentChildLink(db, parentId, childId)` — reads ParentChildLink, returns it if status = "active", throws 403 CHILD_NOT_LINKED otherwise.
- `verifyStudentInClass(db, classId, studentId)` — reads ClassMembership record, returns it if status = "active", throws 403 or 404 per endpoint contract.

### 1.4 Frontend Contexts

The React frontend (`learnfyra-app/`) requires two new React contexts:

- `TeacherContext` — holds the teacher's class list, selected class, assignment list, review queue count, and analytics state. Provides actions: createClass, archiveClass, createAssignment, closeAssignment, resolveReviewItem.
- `ParentContext` — holds the list of linked children, the selected child, child's assignment status list, and child's progress summary. Provides actions: linkChild, unlinkChild, switchChild.

These contexts are loaded lazily based on the user's role claim decoded from the JWT on login. A student role does not load TeacherContext or ParentContext.

---

## 2. Database Schema

### 2.1 LearnfyraClasses-{env}

**Primary key:** PK (String), SK (String)
- PK format: `CLASS#{classId}`
- SK value: `METADATA`

| Attribute | Type | Required | Notes |
|---|---|---|---|
| PK | S | Yes | `CLASS#{classId}` |
| SK | S | Yes | `METADATA` |
| classId | S | Yes | UUID v4 |
| teacherId | S | Yes | Cognito sub of owning teacher — denormalized on record |
| className | S | Yes | 1–100 characters |
| gradeLevel | N | No | Integer 1–10 |
| subjects | L (SS) | No | Enum values: Math, ELA, Science, Social Studies, Health |
| inviteCode | S | Yes | 6-char alphanumeric, uppercase, excludes O, 0, I, 1 — must be unique across active classes |
| inviteCodeExpiresAt | S | No | ISO-8601, reserved for Phase 2 forced rotation — null in Phase 1 |
| status | S | Yes | Enum: `active`, `archived` |
| accuracyThreshold | N | Yes | Integer 0–100, default 60 |
| studentCount | N | Yes | Atomic counter — maintained via DynamoDB UpdateItem ADD |
| createdAt | S | Yes | ISO-8601 |
| archivedAt | S | No | ISO-8601, null until archived |

**GSI 1 — TeacherIndex**
- PK attribute: `teacherId`
- SK attribute: `createdAt`
- Projection: ALL
- Access pattern: `GET /classes` — query all classes for the authenticated teacher, sorted newest-first.

**GSI 2 — InviteCodeIndex**
- PK attribute: `inviteCode`
- SK: (none)
- Projection: ALL
- Access pattern: `POST /student/classes/join` — look up a class by its 6-character code without a table scan. Also used during code generation to check uniqueness.

**Key access patterns:**
- GetItem by `PK = CLASS#{classId}, SK = METADATA` — ownership check, class detail.
- Query TeacherIndex PK = teacherId — list teacher's classes.
- Query InviteCodeIndex PK = inviteCode — join flow.
- UpdateItem PK/SK — archive, update invite code, increment/decrement studentCount.

**Existing bootstrap status:** LearnfyraClasses-{env} already exists in `scripts/bootstrap-local-db.js` with a `joinCode-index` GSI. The bootstrap script must be updated to match the FRD schema: rename `joinCode` attribute to `inviteCode` and rename the GSI to `InviteCodeIndex`. The `TeacherIndex` GSI is present as `teacherId-index` and must be renamed to `TeacherIndex` for consistency.

---

### 2.2 LearnfyraAssignments-{env}

**Primary key:** PK (String), SK (String)
- PK format: `ASSIGNMENT#{assignmentId}`
- SK value: `METADATA`

| Attribute | Type | Required | Notes |
|---|---|---|---|
| PK | S | Yes | `ASSIGNMENT#{assignmentId}` |
| SK | S | Yes | `METADATA` |
| assignmentId | S | Yes | UUID v4 |
| classId | S | Yes | References Class record |
| worksheetId | S | Yes | References Worksheet record |
| teacherId | S | Yes | Denormalized from Class — avoids Class lookup on every assignment ownership check |
| title | S | Yes | Copied from Worksheet.title at assignment creation time |
| mode | S | Yes | Enum: `practice`, `test` |
| timeLimit | N | No | Integer seconds — null means no limit |
| dueDate | S | No | ISO-8601 — null means no due date |
| openAt | S | No | ISO-8601 — null means open immediately |
| closeAt | S | No | ISO-8601, must be after openAt if both present |
| retakePolicy | S | Yes | Enum: `unlimited`, `limited`, `once` |
| retakeLimit | N | Conditional | Integer >= 1, required only when retakePolicy = "limited" |
| status | S | Yes | Enum: `active`, `closed`, `archived` |
| createdAt | S | Yes | ISO-8601 |
| closedAt | S | No | ISO-8601, set when teacher explicitly closes |

**GSI 1 — ClassIndex**
- PK attribute: `classId`
- SK attribute: `createdAt`
- Projection: ALL
- Access pattern: `GET /classes/{classId}/assignments` — retrieve all assignments for a class.

**GSI 2 — ClassDueDateIndex**
- PK attribute: `classId`
- SK attribute: `dueDate`
- Projection: ALL
- Access pattern: same endpoint, sorted by due date ascending — overdue assignments float to top when sorted.

**Key access patterns:**
- GetItem by `PK = ASSIGNMENT#{assignmentId}` — ownership check, assignment detail.
- Query ClassIndex PK = classId — list assignments for a class.
- Query ClassDueDateIndex PK = classId SortKey ascending — due-date-sorted list.
- UpdateItem — close assignment, update fields before openAt.

---

### 2.3 LearnfyraStudentAssignmentStatus-{env}

This is the most critical new table in M05. It is a first-class join record connecting students to assignments with per-student status, score, and attempt linkage. It must not be derived at query time from the WorksheetAttempt table — doing so requires O(n) scans. Both GSIs must be provisioned from the first CDK deploy.

**Primary key:** PK (String), SK (String)
- PK format: `ASSIGNMENT#{assignmentId}`
- SK format: `STUDENT#{studentId}`

| Attribute | Type | Required | Notes |
|---|---|---|---|
| PK | S | Yes | `ASSIGNMENT#{assignmentId}` |
| SK | S | Yes | `STUDENT#{studentId}` |
| assignmentId | S | Yes | UUID v4 — denormalized for GSI |
| studentId | S | Yes | Cognito sub — denormalized for GSI |
| classId | S | Yes | Denormalized — enables ClassAssignmentIndex queries |
| status | S | Yes | Enum: `not-started`, `in-progress`, `submitted`, `overdue` |
| attemptId | S | No | UUID v4 — set when a WorksheetAttempt is created for this assignment |
| score | N | No | Integer — set on submission |
| totalPoints | N | No | Integer — copied from Worksheet at assignment creation |
| submittedAt | S | No | ISO-8601 — set on submission |
| updatedAt | S | Yes | ISO-8601 — set on every write |

**GSI 1 — StudentIndex**
- PK attribute: `studentId`
- SK attribute: `assignmentId`
- Projection: ALL
- Access patterns:
  - `GET /student/assignments` — all assignments for authenticated student.
  - `GET /parent/children/{studentId}/assignments` — parent views child's assignment status.

**GSI 2 — ClassAssignmentIndex**
- PK attribute: `classId`
- SK attribute: `assignmentId`
- Projection: ALL
- Access pattern: `GET /classes/{classId}/analytics` — aggregate all StudentAssignmentStatus records for a class across all assignments in a single Query, no scan.

**Key access patterns:**
- GetItem by `PK = ASSIGNMENT#{assignmentId}, SK = STUDENT#{studentId}` — solve engine checks status before starting session.
- Query by PK = `ASSIGNMENT#{assignmentId}`, SK begins_with `STUDENT#` — teacher views all students for a single assignment.
- Query StudentIndex PK = studentId — student views their own assignments.
- Query ClassAssignmentIndex PK = classId — analytics aggregation.
- PutItem — assignment creation (one record per enrolled student).
- UpdateItem — status transitions, score updates from submission and review cascade.

**Status lifecycle:**
```
  [on assignment creation]       -> not-started
  [on solve session start]       -> in-progress
  [on submission]                -> submitted  (score set)
  [dueDate passed, lazy eval]    -> overdue    (if not submitted)
  [teacher closes assignment]    -> overdue    (eager, for not-started and in-progress)
```

---

### 2.4 LearnfyraParentChildLinks-{env}

**Primary key:** PK (String), SK (String)
- PK format: `USER#{parentId}`
- SK format: `CHILD#{childId}`

| Attribute | Type | Required | Notes |
|---|---|---|---|
| PK | S | Yes | `USER#{parentId}` |
| SK | S | Yes | `CHILD#{childId}` |
| parentId | S | Yes | Cognito sub of the parent |
| childId | S | Yes | Cognito sub of the linked student |
| linkedAt | S | Yes | ISO-8601 |
| linkMethod | S | Yes | Enum: `student-invite`, `teacher-invite` |
| status | S | Yes | Enum: `active`, `revoked` |
| revokedAt | S | No | ISO-8601 — set when parent unlinks |
| childPK | S | Yes | `USER#{childId}` — stored explicitly for InvertedIndex GSI PK |
| parentSK | S | Yes | `PARENT#{parentId}` — stored explicitly for InvertedIndex GSI SK |

**GSI 1 — InvertedIndex (ChildToParentIndex)**
- PK attribute: `childPK` (value: `USER#{childId}`)
- SK attribute: `parentSK` (value: `PARENT#{parentId}`)
- Projection: ALL
- Access pattern: query all parents linked to a given child — required for teacher-initiated invite validation and future notification targeting.

**Key access patterns:**
- GetItem by `PK = USER#{parentId}, SK = CHILD#{childId}` — RBAC check in parent endpoints.
- Query by `PK = USER#{parentId}` — `GET /parent/children` returns all children for a parent.
- Query InvertedIndex `PK = USER#{childId}` — find all parents for a child.
- UpdateItem — set status = "revoked" on unlink.

**RBAC note:** A revoked ParentChildLink is treated identically to no link for RBAC purposes. verifyParentChildLink must check both existence and `status = "active"`. It must return 403 CHILD_NOT_LINKED for revoked links — never 404.

---

### 2.5 LearnfyraParentInviteCodes-{env}

**Primary key:** PK (String), SK (String)
- PK format: `INVITE#{code}`
- SK value: `METADATA`

| Attribute | Type | Required | Notes |
|---|---|---|---|
| PK | S | Yes | `INVITE#{code}` |
| SK | S | Yes | `METADATA` |
| code | S | Yes | The raw invite code string (also extractable from PK) |
| initiatedBy | S | Yes | userId of the student or teacher who generated the code |
| targetStudentId | S | Yes | Cognito sub of the student this invite will link to |
| linkMethod | S | Yes | Enum: `student-invite`, `teacher-invite` |
| createdAt | S | Yes | ISO-8601 |
| expiresAt | S | Yes | ISO-8601 — for display and application-level expiry check |
| ttl | N | Yes | Unix epoch integer — DynamoDB TTL attribute. Set to createdAt + 172800 seconds (48 hours). Sole cleanup mechanism for unconsumed codes. |
| used | BOOL | Yes | Set to `true` atomically on successful consumption via conditional UpdateItem |

**No GSIs.** All access is by primary key `INVITE#{code}`. Invite code lookup is always by code value.

**Key access patterns:**
- GetItem by `PK = INVITE#{code}` — validate invite before linking.
- PutItem — create new invite code.
- UpdateItem with ConditionExpression `used = :false` — atomic consumption (race condition prevention).
- UpdateItem set `used = true` — invalidate a student's prior unused code before writing a new one.

**DynamoDB TTL configuration:** the `ttl` attribute must be configured as the TTL attribute on the table in CDK. DynamoDB TTL expiry is eventually consistent (typically within 48 hours of expiry). The application must not rely on TTL absence to detect expiry — the application-level check on `expiresAt` is mandatory.

---

### 2.6 LearnfyraReviewQueueItems-{env}

**Primary key:** PK (String), SK (String)
- PK format: `REVIEW#{reviewId}`
- SK value: `METADATA`

| Attribute | Type | Required | Notes |
|---|---|---|---|
| PK | S | Yes | `REVIEW#{reviewId}` |
| SK | S | Yes | `METADATA` |
| reviewId | S | Yes | UUID v4 |
| classId | S | Yes | Denormalized — for ClassPendingIndex GSI |
| assignmentId | S | Yes | The assignment under which this attempt was submitted |
| attemptId | S | Yes | References WorksheetAttempt record |
| studentId | S | Yes | Cognito sub of the student |
| questionNumber | N | Yes | Integer — question index within the worksheet |
| questionText | S | Yes | The question text, copied at queue creation time |
| studentAnswer | S | Yes | The student's raw answer string |
| expectedAnswer | S | Yes | The correct answer from the worksheet |
| systemConfidenceScore | N | Yes | Float 0.0–1.0 — the fuzzy match confidence from the scorer |
| currentScore | N | Yes | Integer — system-assigned score at time of flagging (typically 0) |
| pointsPossible | N | Yes | Integer — max points for this question |
| status | S | Yes | Enum: `pending`, `resolved` |
| resolvedBy | S | No | teacherId who resolved the item |
| resolvedAction | S | No | Enum: `approve`, `override` |
| overrideScore | N | No | Integer — present only when resolvedAction = "override" |
| resolvedAt | S | No | ISO-8601 |
| createdAt | S | Yes | ISO-8601 |

**GSI 1 — ClassPendingIndex**
- PK attribute: `classId`
- SK attribute: `createdAt`
- Projection: ALL
- Access pattern: `GET /classes/{classId}/review-queue` — query all review items for a class sorted by creation date. The handler filters on `status = "pending"` after querying.

**Key access patterns:**
- GetItem by `PK = REVIEW#{reviewId}` — ownership check and resolve operation.
- Query ClassPendingIndex PK = classId — teacher views their review queue.
- PutItem — M03 scorer creates an item when confidence < 0.75.
- UpdateItem — resolve operation (mark resolved, record action and score).

---

### 2.7 Modifications to Existing Tables

**LearnfyraWorksheetAttempt-{env} (M04)**

The `assignmentId` attribute must be added to WorksheetAttempt records. This field is:
- `null` for non-assignment attempts (free practice — existing behavior is unchanged).
- Set to the assignment UUID when the solve session is started via an assignment link.

The attribute is used by the review queue cascade to join from ReviewQueueItem back to the correct WorksheetAttempt record, and by StudentAssignmentStatus to link to the attempt.

No schema migration is required for existing records — DynamoDB is schemaless. New attempts written after M05 deployment will include `assignmentId` when applicable.

**LearnfyraUserProgress-{env} (M04)**

DynamoDB Streams must be enabled on this table. This is required for the future M06 event-driven analytics pipeline (Phase 2). M05 reads this table directly via BatchGetItem for analytics — no Streams dependency in Phase 1. However, enabling Streams retroactively requires a table replacement (CDK will destroy and recreate the table unless a manual migration is performed). Streams must be enabled at table creation in M04's CDK deploy. If M04 has already deployed without Streams, the IaC agent must coordinate a migration before M05 ships.

---

## 3. API Endpoints

### 3.1 Teacher Endpoints — Class Management

---

**POST /api/classes**

| Field | Value |
|---|---|
| Method | POST |
| Path | /api/classes |
| Auth | Bearer JWT, role = teacher |
| Handler | classHandler.js |

Request body:
```json
{
  "className": "string (required, 1-100 chars)",
  "gradeLevel": "number (optional, 1-10)",
  "subjects": ["string (optional, enum values)"]
}
```

DynamoDB ops:
1. Query InviteCodeIndex to check uniqueness of generated code (loop up to 20 times on collision).
2. PutItem to LearnfyraClasses with new class record.

Response 201:
```json
{
  "classId": "uuid",
  "className": "string",
  "inviteCode": "string",
  "gradeLevel": "number|null",
  "subjects": [],
  "status": "active",
  "studentCount": 0,
  "createdAt": "ISO-8601"
}
```

Error codes: 400 VALIDATION_ERROR, 403 INSUFFICIENT_ROLE.

---

**GET /api/classes**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | classHandler.js |

DynamoDB ops:
1. Query TeacherIndex GSI PK = JWT sub.
2. For each class, query ClassPendingIndex GSI on LearnfyraReviewQueueItems PK = classId — count pending items. This is a batch of parallel queries (one per class).

Response 200:
```json
{
  "classes": [{
    "classId": "uuid",
    "className": "string",
    "gradeLevel": "number|null",
    "subjects": [],
    "inviteCode": "string",
    "status": "active|archived",
    "studentCount": 0,
    "createdAt": "ISO-8601",
    "pendingReviewCount": 0
  }]
}
```

Error codes: 403 INSUFFICIENT_ROLE.

---

**GET /api/classes/:classId**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | classHandler.js |

DynamoDB ops:
1. GetItem LearnfyraClasses PK = `CLASS#{classId}`.
2. verifyTeacherOwnsClass (inline check — no extra query).

Response 200:
```json
{
  "classId": "uuid",
  "className": "string",
  "gradeLevel": "number|null",
  "subjects": [],
  "inviteCode": "string",
  "status": "active|archived",
  "studentCount": 0,
  "accuracyThreshold": 60,
  "createdAt": "ISO-8601",
  "archivedAt": "ISO-8601|null"
}
```

Error codes: 403 NOT_CLASS_OWNER, 403 INSUFFICIENT_ROLE, 404 CLASS_NOT_FOUND.

---

**PATCH /api/classes/:classId**

| Field | Value |
|---|---|
| Method | PATCH |
| Auth | Bearer JWT, role = teacher |
| Handler | classHandler.js |

Request body (all optional):
```json
{
  "className": "string (1-100 chars)",
  "accuracyThreshold": "number (0-100)"
}
```

DynamoDB ops:
1. GetItem to verify ownership.
2. UpdateItem with only the provided fields.

Response 200:
```json
{ "classId": "uuid", "updatedFields": ["className", "accuracyThreshold"] }
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND.

---

**DELETE /api/classes/:classId/archive**

| Field | Value |
|---|---|
| Method | DELETE |
| Auth | Bearer JWT, role = teacher |
| Handler | classHandler.js |

DynamoDB ops:
1. GetItem — verify ownership, check current status.
2. UpdateItem — set status = "archived", archivedAt = now. No cascades.

Response 200:
```json
{ "classId": "uuid", "status": "archived", "archivedAt": "ISO-8601" }
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND, 409 CLASS_ALREADY_ARCHIVED.

---

**POST /api/classes/:classId/invite**

| Field | Value |
|---|---|
| Method | POST |
| Auth | Bearer JWT, role = teacher |
| Handler | classHandler.js |

DynamoDB ops:
1. GetItem — verify ownership.
2. Loop: generate code, Query InviteCodeIndex for uniqueness, break when unique.
3. UpdateItem — set inviteCode = newCode.

Response 200:
```json
{ "classId": "uuid", "inviteCode": "string", "updatedAt": "ISO-8601" }
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND.

---

### 3.2 Teacher Endpoints — Roster Management

---

**GET /api/classes/:classId/students**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |
| SLA | 200 ms for 200 students |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify ownership.
2. Query LearnfyraClassMemberships PK = classId (all students, active and removed).
3. BatchGetItem LearnfyraUsers for displayName (batches of 100).
4. Query StudentIndex GSI on LearnfyraStudentAssignmentStatus for each student — aggregate assignmentsSummary.

Response 200:
```json
{
  "students": [{
    "studentId": "uuid",
    "displayName": "string",
    "joinedAt": "ISO-8601",
    "status": "active|removed",
    "assignmentsSummary": { "total": 5, "submitted": 3, "overdue": 1 },
    "lastActiveAt": "ISO-8601|null",
    "overallAccuracy": 72
  }]
}
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND.

---

**DELETE /api/classes/:classId/students/:studentId**

| Field | Value |
|---|---|
| Method | DELETE |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify ownership.
2. GetItem LearnfyraClassMemberships PK = classId, SK = studentId — verify enrollment.
3. UpdateItem ClassMembership — set status = "removed".
4. UpdateItem LearnfyraClasses — atomic ADD studentCount -1.

No cascade deletes on StudentAssignmentStatus or WorksheetAttempt.

Response 200:
```json
{ "message": "Student removed", "studentId": "uuid", "classId": "uuid" }
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND, 404 STUDENT_NOT_IN_CLASS.

---

**POST /api/classes/:classId/students/:studentId/parent-invite**

| Field | Value |
|---|---|
| Method | POST |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify teacher ownership.
2. GetItem LearnfyraClassMemberships — verify student is enrolled (status = "active").
3. For teacher-generated codes, no prior-code invalidation is required — a teacher may generate a code even if a student-generated code is still valid.
4. PutItem LearnfyraParentInviteCodes — new code with linkMethod = "teacher-invite", TTL = now + 172800.

Response 201:
```json
{
  "inviteCode": "string",
  "targetStudentId": "uuid",
  "expiresAt": "ISO-8601",
  "linkMethod": "teacher-invite"
}
```

Error codes: 403 NOT_CLASS_OWNER, 403 STUDENT_NOT_IN_CLASS, 404 CLASS_NOT_FOUND.

---

### 3.3 Teacher Endpoints — Assignment Management

---

**POST /api/assignments**

| Field | Value |
|---|---|
| Method | POST |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |

Request body:
```json
{
  "classId": "string (required)",
  "worksheetId": "string (required)",
  "mode": "practice|test (required)",
  "dueDate": "ISO-8601|null",
  "openAt": "ISO-8601|null",
  "closeAt": "ISO-8601|null",
  "timeLimit": "number|null (seconds, min 60)",
  "retakePolicy": "unlimited|limited|once (required)",
  "retakeLimit": "number (required if retakePolicy = limited)"
}
```

DynamoDB ops (all in sequence — compensating writes if steps 4+ fail):
1. GetItem LearnfyraClasses — verify teacher owns class, class is active.
2. GetItem LearnfyraWorksheets — verify worksheet exists, fetch title and totalPoints.
3. PutItem LearnfyraAssignments — new assignment record with teacherId denormalized from JWT sub.
4. Query LearnfyraClassMemberships PK = classId, FilterExpression status = "active" — get all enrolled studentIds.
5. BatchWriteItem LearnfyraStudentAssignmentStatus — one PutRequest per enrolled student, status = "not-started".

The StudentAssignmentStatus writes (step 5) are not atomic with the Assignment PutItem (step 3). If step 5 fails partially, the handler must complete the remaining writes on retry. Partial failure is logged with the assignmentId and the list of studentIds that were not written.

Response 201:
```json
{
  "assignmentId": "uuid",
  "classId": "uuid",
  "worksheetId": "uuid",
  "mode": "practice|test",
  "status": "active",
  "createdAt": "ISO-8601",
  "studentCount": 25
}
```

Error codes: 400 VALIDATION_ERROR, 403 NOT_CLASS_OWNER, 403 INSUFFICIENT_ROLE, 404 CLASS_NOT_FOUND, 404 WORKSHEET_NOT_FOUND.

---

**GET /api/assignments/:assignmentId**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |

DynamoDB ops:
1. GetItem LearnfyraAssignments PK = `ASSIGNMENT#{assignmentId}` — verify teacherId = JWT sub.

Response 200: full Assignment record.

Error codes: 403 NOT_CLASS_OWNER, 404 ASSIGNMENT_NOT_FOUND.

---

**GET /api/classes/:classId/assignments**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify ownership.
2. Query ClassDueDateIndex GSI PK = classId — all assignments sorted by dueDate ascending.
3. For each assignment, Query LearnfyraStudentAssignmentStatus PK = `ASSIGNMENT#{assignmentId}` — count submitted records (submissionCount).

Response 200:
```json
{
  "assignments": [{
    "assignmentId": "uuid",
    "title": "string",
    "mode": "practice|test",
    "dueDate": "ISO-8601|null",
    "status": "active|closed|archived",
    "submissionCount": 18,
    "totalStudents": 25
  }]
}
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND.

---

**PATCH /api/assignments/:assignmentId**

| Field | Value |
|---|---|
| Method | PATCH |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |

Validation: openAt must be in the future. If `assignment.openAt <= now`, return 409 ASSIGNMENT_ALREADY_OPEN.

DynamoDB ops:
1. GetItem LearnfyraAssignments — verify teacherId = JWT sub.
2. Check openAt timestamp — reject if already open.
3. UpdateItem — update only provided fields.

Response 200:
```json
{ "assignmentId": "uuid", "updatedFields": ["dueDate", "timeLimit"] }
```

Error codes: 403 NOT_CLASS_OWNER, 404 ASSIGNMENT_NOT_FOUND, 409 ASSIGNMENT_ALREADY_OPEN.

---

**DELETE /api/assignments/:assignmentId/close**

| Field | Value |
|---|---|
| Method | DELETE |
| Auth | Bearer JWT, role = teacher |
| Handler | assignmentHandler.js |

DynamoDB ops:
1. GetItem LearnfyraAssignments — verify teacherId, check status != "closed".
2. UpdateItem LearnfyraAssignments — set status = "closed", closedAt = now.
3. Query LearnfyraStudentAssignmentStatus PK = `ASSIGNMENT#{assignmentId}` — get all items where status IN ["not-started", "in-progress"].
4. BatchWriteItem — UpdateItem each found record to status = "overdue".

Steps 3 and 4 are synchronous and must complete before the 200 response is returned.

Response 200:
```json
{
  "assignmentId": "uuid",
  "status": "closed",
  "closedAt": "ISO-8601",
  "studentsMarkedOverdue": 7
}
```

Error codes: 403 NOT_CLASS_OWNER, 404 ASSIGNMENT_NOT_FOUND, 409 ASSIGNMENT_ALREADY_CLOSED.

---

### 3.4 Teacher Endpoints — Review Queue

---

**GET /api/classes/:classId/review-queue**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | reviewQueueHandler.js |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify teacherId = JWT sub. Archived classes are permitted (OQ-3 resolution).
2. Query ClassPendingIndex GSI PK = classId — all items, handler filters status = "pending".

Response 200:
```json
{
  "pendingCount": 3,
  "items": [{
    "reviewId": "uuid",
    "studentName": "string",
    "questionNumber": 3,
    "questionText": "string",
    "studentAnswer": "string",
    "expectedAnswer": "string",
    "systemConfidenceScore": 0.62,
    "currentScore": 0,
    "pointsPossible": 1,
    "attemptId": "uuid",
    "createdAt": "ISO-8601"
  }]
}
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND.

---

**POST /api/review-queue/:reviewId/resolve**

| Field | Value |
|---|---|
| Method | POST |
| Auth | Bearer JWT, role = teacher |
| Handler | reviewQueueHandler.js |

Request body:
```json
{
  "action": "approve|override (required)",
  "overrideScore": "number (required if action = override, 0 to pointsPossible)"
}
```

DynamoDB ops (cascade — all four must succeed):
1. GetItem LearnfyraReviewQueueItems PK = `REVIEW#{reviewId}` — verify item exists, status = "pending", fetch classId and attemptId.
2. GetItem LearnfyraClasses PK = classId — verify teacherId = JWT sub.
3. UpdateItem LearnfyraReviewQueueItems — set status = "resolved", resolvedBy, resolvedAction, overrideScore, resolvedAt.
4. GetItem LearnfyraWorksheetAttempt — fetch current totalScore.
5. UpdateItem LearnfyraWorksheetAttempt — recalculate totalScore.
6. GetItem LearnfyraUserProgress — fetch topic record.
7. UpdateItem LearnfyraUserProgress — recalculate accuracy for the affected topic.
8. UpdateItem LearnfyraStudentAssignmentStatus — update score field.

Steps 3–8 are all UpdateItem operations. If any step fails after step 3 has succeeded, the handler logs the inconsistency with all relevant IDs so a compensating write can be applied manually or by a future retry job.

Response 200:
```json
{
  "reviewId": "uuid",
  "action": "approve|override",
  "overrideScore": 1,
  "updatedAttemptScore": 9,
  "updatedStudentAssignmentStatus": { "status": "submitted", "score": 9 }
}
```

Error codes: 400 VALIDATION_ERROR, 403 NOT_CLASS_OWNER, 404 REVIEW_ITEM_NOT_FOUND, 409 REVIEW_ALREADY_RESOLVED.

---

### 3.5 Teacher Endpoints — Analytics

---

**GET /api/classes/:classId/analytics**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | analyticsHandler.js |
| SLA | 300 ms for 200 students |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify ownership, fetch accuracyThreshold.
2. Query ClassAssignmentIndex GSI PK = classId — all StudentAssignmentStatus records for the class (single Query).
3. In-memory aggregation: group by assignmentId, compute averageScore and completionRate per assignment; compute overallCompletionRate.
4. Query LearnfyraClassMemberships PK = classId — get all active studentIds.
5. BatchGetItem LearnfyraUserProgress for each studentId (batches of 100, two parallel batches for 200 students via Promise.all).
6. In-memory: aggregate topic accuracy across all students, find weakest 5 topics; find students below accuracyThreshold.

Response 200:
```json
{
  "classId": "uuid",
  "assignmentBreakdown": [{
    "assignmentId": "uuid",
    "title": "string",
    "averageScore": 82,
    "completionRate": 88
  }],
  "overallCompletionRate": 84,
  "weakestTopics": [{ "topic": "Fractions", "classAverageAccuracy": 52 }],
  "studentsBelowThreshold": [{ "studentId": "uuid", "displayName": "string", "accuracy": 43 }],
  "accuracyThreshold": 60
}
```

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND.

---

**GET /api/classes/:classId/analytics/heatmap**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | analyticsHandler.js |
| SLA | 300 ms for 200 students |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify ownership.
2. Query LearnfyraClassMemberships PK = classId — active students.
3. BatchGetItem LearnfyraUserProgress per studentId — collect all topic accuracy maps.
4. In-memory: build topic list (union of all topics seen), build cell matrix.

Response 200:
```json
{
  "classId": "uuid",
  "students": [{ "studentId": "uuid", "displayName": "string" }],
  "topics": ["Fractions", "Multiplication", "Division"],
  "cells": {
    "studentId-1": { "Fractions": 45, "Multiplication": 88, "Division": null },
    "studentId-2": { "Fractions": 91, "Multiplication": null, "Division": 72 }
  }
}
```

`null` means no attempts for that topic by that student.

Error codes: 403 NOT_CLASS_OWNER, 404 CLASS_NOT_FOUND.

---

**GET /api/classes/:classId/students/:studentId/progress**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = teacher |
| Handler | analyticsHandler.js |

DynamoDB ops:
1. GetItem LearnfyraClasses — verify teacher owns class (403 NOT_CLASS_OWNER on mismatch).
2. GetItem LearnfyraClassMemberships PK = classId, SK = studentId — verify enrollment (404 STUDENT_NOT_IN_CLASS if not found or status = "removed").
3. GetItem LearnfyraUserProgress PK = studentId — fetch progress record.

Response 200: identical structure to GET /student/progress from M04.

Error codes: 403 NOT_CLASS_OWNER, 404 STUDENT_NOT_IN_CLASS, 404 CLASS_NOT_FOUND.

---

### 3.6 Parent Endpoints

---

**POST /api/parent/link**

| Field | Value |
|---|---|
| Method | POST |
| Auth | Bearer JWT, role = parent |
| Handler | parentHandler.js |

Request body:
```json
{ "inviteCode": "string (required)" }
```

Five-step validation sequence (must be performed in this order):
1. GetItem LearnfyraParentInviteCodes PK = `INVITE#{code}` — if not found, return 404 INVITE_CODE_NOT_FOUND.
2. Check `expiresAt < now` — if true, return 410 INVITE_CODE_EXPIRED. Do not rely on item absence.
3. Check `used = true` — if true, return 409 INVITE_CODE_ALREADY_USED.
4. UpdateItem ConditionExpression `used = :false` — if ConditionalCheckFailedException, return 409 INVITE_CODE_ALREADY_USED.
5. PutItem LearnfyraParentChildLinks — write new link record including both childPK and parentSK attributes for the InvertedIndex GSI.

Response 201:
```json
{
  "parentId": "uuid",
  "childId": "uuid",
  "displayName": "string",
  "gradeLevel": "number|null",
  "linkMethod": "student-invite|teacher-invite",
  "linkedAt": "ISO-8601"
}
```

Error codes: 403 INSUFFICIENT_ROLE, 404 INVITE_CODE_NOT_FOUND, 409 INVITE_CODE_ALREADY_USED, 410 INVITE_CODE_EXPIRED.

---

**GET /api/parent/children**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = parent |
| Handler | parentHandler.js |

DynamoDB ops:
1. Query LearnfyraParentChildLinks PK = `USER#{parentId}` — all items with status = "active".
2. BatchGetItem LearnfyraUsers — fetch displayName and gradeLevel for each childId.

Response 200:
```json
{
  "children": [{
    "studentId": "uuid",
    "displayName": "string",
    "gradeLevel": "number|null",
    "linkMethod": "student-invite|teacher-invite",
    "linkedAt": "ISO-8601"
  }]
}
```

Error codes: 403 INSUFFICIENT_ROLE.

---

**DELETE /api/parent/children/:studentId**

| Field | Value |
|---|---|
| Method | DELETE |
| Auth | Bearer JWT, role = parent |
| Handler | parentHandler.js |

DynamoDB ops:
1. GetItem LearnfyraParentChildLinks PK = `USER#{parentId}`, SK = `CHILD#{studentId}` — verify active link (403 CHILD_NOT_LINKED if not found or revoked).
2. UpdateItem — set status = "revoked", revokedAt = now.

Response 200:
```json
{
  "parentId": "uuid",
  "childId": "uuid",
  "status": "revoked",
  "revokedAt": "ISO-8601"
}
```

Error codes: 403 CHILD_NOT_LINKED, 403 INSUFFICIENT_ROLE.

---

**GET /api/parent/children/:studentId/progress**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = parent |
| Handler | parentHandler.js |
| SLA | 200 ms |

DynamoDB ops:
1. verifyParentChildLink — GetItem by PK/SK, check status = "active". Return 403 CHILD_NOT_LINKED if not found or revoked.
2. GetItem LearnfyraUserProgress PK = studentId — fetch accuracy and topic data.
3. Query LearnfyraWorksheetAttempt — fetch attempts for last 7 and 30 days.

needsAttention computed in-memory: topics where accuracy < 60% and attemptCount >= 3.

Response 200:
```json
{
  "studentId": "uuid",
  "displayName": "string",
  "last7Days": {
    "worksheetsAttempted": 3,
    "averageScore": 72,
    "totalTimeSpentSeconds": 4200
  },
  "last30Days": {
    "worksheetsAttempted": 12,
    "averageScore": 68,
    "totalTimeSpentSeconds": 18000
  },
  "overallAccuracy": 71,
  "needsAttention": [{ "topic": "Fractions", "currentAccuracy": 45, "attemptCount": 4 }]
}
```

Error codes: 403 CHILD_NOT_LINKED, 403 INSUFFICIENT_ROLE.

---

**GET /api/parent/children/:studentId/assignments**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = parent |
| Handler | parentHandler.js |

DynamoDB ops:
1. verifyParentChildLink — same as above. Return 403 CHILD_NOT_LINKED if not active.
2. Query StudentIndex GSI on LearnfyraStudentAssignmentStatus PK = studentId — all assignment status records.
3. BatchGetItem LearnfyraAssignments — fetch title, className, teacherName, dueDate for each assignmentId.
4. In-memory: apply lazy overdue evaluation (dueDate < now AND status != "submitted") — write updated status back to DynamoDB for any newly-detected overdue items.

Response 200:
```json
{
  "studentId": "uuid",
  "assignments": [{
    "assignmentId": "uuid",
    "title": "string",
    "className": "string",
    "teacherName": "string",
    "dueDate": "ISO-8601|null",
    "status": "not-started|in-progress|submitted|overdue",
    "score": "number|null",
    "submittedAt": "ISO-8601|null"
  }]
}
```

Error codes: 403 CHILD_NOT_LINKED, 403 INSUFFICIENT_ROLE.

---

### 3.7 Student Endpoints — Class Participation

---

**POST /api/student/parent-invite**

| Field | Value |
|---|---|
| Method | POST |
| Auth | Bearer JWT, role = student |
| Handler | parentHandler.js |

DynamoDB ops:
1. PutItem a tracking record at `PK = STUDENTINVITE#{studentId}` that stores the current code string. If a prior record exists, fetch the current code and mark it `used = true` on the corresponding ParentInviteCode record before writing the new one.
2. PutItem LearnfyraParentInviteCodes — new code with targetStudentId = JWT sub, TTL = now + 172800.

Response 201:
```json
{ "inviteCode": "string", "expiresAt": "ISO-8601", "linkMethod": "student-invite" }
```

Error codes: 403 INSUFFICIENT_ROLE.

---

**POST /api/student/classes/join**

| Field | Value |
|---|---|
| Method | POST |
| Auth | Bearer JWT, role = student |
| Handler | parentHandler.js |

Request body:
```json
{ "inviteCode": "string (required, 6-char alphanumeric)" }
```

DynamoDB ops:
1. Query InviteCodeIndex GSI on LearnfyraClasses PK = inviteCode — find class. If not found, return 404 INVALID_JOIN_CODE. If class status = "archived", return 404 INVALID_JOIN_CODE.
2. GetItem LearnfyraClassMemberships PK = classId, SK = studentId — check for existing record.
   - If found with status = "active": return 409 ALREADY_ENROLLED.
   - If found with status = "removed": UpdateItem to status = "active", joinedAt = now — then proceed to step 4.
   - If not found: PutItem new ClassMembership record.
3. UpdateItem LearnfyraClasses — atomic ADD studentCount 1. Validate studentCount < 300 (soft cap) using ConditionExpression `studentCount < :cap`.
4. Query ClassIndex GSI on LearnfyraAssignments PK = classId, FilterExpression status = "active" — get all active assignments.
5. BatchWriteItem LearnfyraStudentAssignmentStatus — PutRequest for each active assignment, status = "not-started".

Response 200:
```json
{
  "classId": "uuid",
  "className": "string",
  "teacherName": "string",
  "gradeLevel": "number|null",
  "joinedAt": "ISO-8601",
  "activeAssignmentCount": 3
}
```

Error codes: 400 VALIDATION_ERROR, 403 INSUFFICIENT_ROLE, 404 INVALID_JOIN_CODE, 409 ALREADY_ENROLLED, 422 CLASS_AT_CAPACITY.

---

**GET /api/student/assignments**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = student |
| Handler | parentHandler.js |
| SLA | 150 ms |

DynamoDB ops:
1. Query StudentIndex GSI on LearnfyraStudentAssignmentStatus PK = JWT sub.
2. BatchGetItem LearnfyraAssignments — fetch title, mode, timeLimit, openAt, closeAt, retakePolicy for each assignmentId.
3. In-memory: apply lazy overdue evaluation — write back any newly-detected overdue records.

Response 200:
```json
{
  "assignments": [{
    "assignmentId": "uuid",
    "title": "string",
    "className": "string",
    "mode": "practice|test",
    "dueDate": "ISO-8601|null",
    "openAt": "ISO-8601|null",
    "closeAt": "ISO-8601|null",
    "timeLimit": "number|null",
    "retakePolicy": "unlimited|limited|once",
    "status": "not-started|in-progress|submitted|overdue",
    "score": "number|null",
    "submittedAt": "ISO-8601|null"
  }]
}
```

Error codes: 403 INSUFFICIENT_ROLE.

---

**GET /api/student/assignments/:assignmentId**

| Field | Value |
|---|---|
| Method | GET |
| Auth | Bearer JWT, role = student |
| Handler | parentHandler.js |

DynamoDB ops:
1. GetItem LearnfyraStudentAssignmentStatus PK = `ASSIGNMENT#{assignmentId}`, SK = `STUDENT#{JWT sub}` — verify record exists (403 ASSIGNMENT_NOT_FOUND if not). Enumeration prevention: return 403, not 404.
2. GetItem LearnfyraAssignments — fetch configuration for availability window check.
3. If openAt and current time is before openAt, return 403 ASSIGNMENT_NOT_AVAILABLE.
4. If closeAt and current time is after closeAt, return 403 ASSIGNMENT_NOT_AVAILABLE.

Response 200: full assignment configuration plus student's current status.

Error codes: 403 ASSIGNMENT_NOT_FOUND (enumeration prevention), 403 ASSIGNMENT_NOT_AVAILABLE, 403 INSUFFICIENT_ROLE.

---

## 4. Frontend Architecture

### 4.1 React Context Design

**TeacherContext** (`learnfyra-app/src/contexts/TeacherContext.jsx`)

State:
- `classes: Class[]` — list of teacher's active classes
- `selectedClassId: string|null`
- `selectedClass: Class|null`
- `assignments: Assignment[]` — for selected class
- `students: Student[]` — roster for selected class
- `reviewQueue: ReviewQueueItem[]` — pending items for selected class
- `pendingReviewCount: number` — badge count
- `analytics: AnalyticsResponse|null`
- `heatmap: HeatmapResponse|null`
- `loading: boolean`
- `error: string|null`

Actions:
- `loadClasses()` — GET /api/classes
- `selectClass(classId)` — sets selectedClassId, triggers dependent loads
- `createClass(data)` — POST /api/classes
- `archiveClass(classId)` — DELETE /api/classes/:id/archive
- `regenerateInviteCode(classId)` — POST /api/classes/:id/invite
- `loadAssignments(classId)` — GET /api/classes/:id/assignments
- `createAssignment(data)` — POST /api/assignments
- `closeAssignment(assignmentId)` — DELETE /api/assignments/:id/close
- `loadReviewQueue(classId)` — GET /api/classes/:id/review-queue
- `resolveReviewItem(reviewId, action, overrideScore)` — POST /api/review-queue/:id/resolve
- `loadAnalytics(classId)` — GET /api/classes/:id/analytics
- `loadHeatmap(classId)` — GET /api/classes/:id/analytics/heatmap

**ParentContext** (`learnfyra-app/src/contexts/ParentContext.jsx`)

State:
- `children: LinkedChild[]` — all linked children
- `selectedChildId: string|null`
- `selectedChild: LinkedChild|null`
- `childProgress: ProgressSummary|null`
- `childAssignments: Assignment[]`
- `loading: boolean`
- `error: string|null`

Actions:
- `loadChildren()` — GET /api/parent/children
- `selectChild(studentId)` — sets selectedChildId, triggers dependent loads
- `linkChild(inviteCode)` — POST /api/parent/link
- `unlinkChild(studentId)` — DELETE /api/parent/children/:id
- `loadChildProgress(studentId)` — GET /api/parent/children/:id/progress
- `loadChildAssignments(studentId)` — GET /api/parent/children/:id/assignments

### 4.2 Component Tree — Teacher Dashboard

```
TeacherDashboardPage
├── ClassSwitcher (top bar — maps over TeacherContext.classes)
├── ReviewQueueBadge (badge count from TeacherContext.pendingReviewCount)
├── [if no class selected]
│   └── EmptyClassPlaceholder -> CreateClassButton
├── [if class selected]
│   ├── ClassHeader (className, inviteCode, Regenerate button)
│   ├── TabNav [Overview | Assignments | Roster | Review Queue | Analytics]
│   ├── OverviewTab
│   │   └── AssignmentSummaryCards
│   ├── AssignmentsTab
│   │   ├── AssignmentList
│   │   └── CreateAssignmentModal
│   ├── RosterTab
│   │   ├── StudentTable (displayName, summary, accuracy)
│   │   ├── RemoveStudentButton (per row)
│   │   └── GenerateParentInviteButton (per row)
│   ├── ReviewQueueTab
│   │   └── ReviewQueueItemCard (per item — studentAnswer, expectedAnswer, overrideScore input)
│   └── AnalyticsTab
│       ├── AssignmentBreakdownChart
│       ├── WeakestTopicsList
│       ├── StudentsBelowThresholdList
│       └── HeatmapGrid (topic x student — cell = accuracy%, null = grey)
```

Accessibility requirements:
- HeatmapGrid cells must include a tooltip or accessible label with the numeric accuracy value (not conveyed by color alone).
- ReviewQueueBadge must be readable by screen readers (not conveyed exclusively through a visual badge color).
- ClassSwitcher must be keyboard-navigable.

### 4.3 Component Tree — Parent Dashboard

```
ParentDashboardPage
├── ChildSwitcher (top level — not in settings — maps over ParentContext.children)
├── LinkChildButton (always accessible)
├── [if child selected]
│   ├── ChildProgressSummary (last7Days, last30Days, overallAccuracy)
│   ├── NeedsAttentionList (topics below 60% with 3+ attempts)
│   └── AssignmentStatusList
│       └── AssignmentStatusRow (title, className, dueDate, status badge)
└── LinkChildModal (inviteCode input -> POST /parent/link)
```

### 4.4 Component Tree — Student Class Participation

```
StudentDashboardPage (existing M04 dashboard — extended)
├── [existing tabs]
├── AssignmentsTab (NEW)
│   ├── AssignmentList (from GET /student/assignments)
│   └── AssignmentRow (title, mode, dueDate, status, score)
└── ProfileSettingsPage (existing)
    └── GenerateParentInviteSection
        └── GenerateParentInviteButton -> POST /student/parent-invite
```

JoinClassModal is accessible from the StudentDashboardPage header or an empty-assignments state prompt.

### 4.5 API Service Layer

Each context is backed by an API service module:

- `learnfyra-app/src/api/teacherApi.js` — wraps all teacher endpoint calls with auth headers
- `learnfyra-app/src/api/parentApi.js` — wraps all parent endpoint calls
- `learnfyra-app/src/api/studentClassApi.js` — wraps student class-participation endpoint calls

All API calls attach the JWT from the auth state: `Authorization: Bearer {token}`. Errors are decoded from the response JSON and mapped to user-facing messages via an `errorMessageMap` keyed by error code.

---

## 5. Backend Handler Architecture

### 5.1 Handler-to-Route Mapping

| HTTP Method | Path | Handler File |
|---|---|---|
| POST | /api/classes | classHandler.js |
| GET | /api/classes | classHandler.js |
| GET | /api/classes/:classId | classHandler.js |
| PATCH | /api/classes/:classId | classHandler.js |
| DELETE | /api/classes/:classId/archive | classHandler.js |
| POST | /api/classes/:classId/invite | classHandler.js |
| POST | /api/assignments | assignmentHandler.js |
| GET | /api/assignments/:assignmentId | assignmentHandler.js |
| GET | /api/classes/:classId/assignments | assignmentHandler.js |
| PATCH | /api/assignments/:assignmentId | assignmentHandler.js |
| DELETE | /api/assignments/:assignmentId/close | assignmentHandler.js |
| GET | /api/classes/:classId/students | assignmentHandler.js |
| DELETE | /api/classes/:classId/students/:studentId | assignmentHandler.js |
| POST | /api/classes/:classId/students/:studentId/parent-invite | assignmentHandler.js |
| GET | /api/classes/:classId/review-queue | reviewQueueHandler.js |
| POST | /api/review-queue/:reviewId/resolve | reviewQueueHandler.js |
| GET | /api/classes/:classId/analytics | analyticsHandler.js |
| GET | /api/classes/:classId/analytics/heatmap | analyticsHandler.js |
| GET | /api/classes/:classId/students/:studentId/progress | analyticsHandler.js |
| POST | /api/parent/link | parentHandler.js |
| GET | /api/parent/children | parentHandler.js |
| DELETE | /api/parent/children/:studentId | parentHandler.js |
| GET | /api/parent/children/:studentId/progress | parentHandler.js |
| GET | /api/parent/children/:studentId/assignments | parentHandler.js |
| POST | /api/student/parent-invite | parentHandler.js |
| POST | /api/student/classes/join | parentHandler.js |
| GET | /api/student/assignments | parentHandler.js |
| GET | /api/student/assignments/:assignmentId | parentHandler.js |

Each handler file exports a single `handler(event, context)` function following the existing Lambda-compatible pattern. Route dispatch within each handler is performed by reading `event.httpMethod` and `event.path` or `event.pathParameters`.

### 5.2 Handler Internal Structure

Each handler follows this skeleton (mirroring existing handlers):

```javascript
/**
 * @file backend/handlers/classHandler.js
 * @description Lambda-compatible handler for teacher class management routes.
 */

import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { verifyTeacherOwnsClass } from '../../src/utils/rbac.js';
import { randomUUID } from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

function errorResponse(statusCode, errorCode, message) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify({ error: errorCode, message }) };
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  try {
    const decoded = await validateToken(event);
    requireRole(decoded, 'teacher');
    const db = getDbAdapter();
    const path = event.path || '';
    const method = event.httpMethod;
    // Route dispatch ...
  } catch (err) {
    const status = err.statusCode || 500;
    return errorResponse(status, err.errorCode || 'INTERNAL_ERROR', err.message);
  }
};
```

### 5.3 Shared RBAC Utilities (`src/utils/rbac.js`)

```javascript
/**
 * @file src/utils/rbac.js
 * @description Shared RBAC check functions for M05 handlers.
 */

/**
 * Verifies the authenticated teacher owns the specified class.
 * @param {Object} db - Database adapter
 * @param {string} classId - UUID of the class
 * @param {string} teacherId - JWT sub of the authenticated teacher
 * @returns {Promise<Object>} The class record
 * @throws {Error} 403 NOT_CLASS_OWNER or 404 CLASS_NOT_FOUND
 */
export async function verifyTeacherOwnsClass(db, classId, teacherId) { }

/**
 * Verifies the authenticated parent has an active link to the specified child.
 * Returns 403 CHILD_NOT_LINKED for both missing and revoked links.
 * @param {Object} db - Database adapter
 * @param {string} parentId - JWT sub of the authenticated parent
 * @param {string} childId - studentId being accessed
 * @returns {Promise<Object>} The ParentChildLink record
 * @throws {Error} 403 CHILD_NOT_LINKED
 */
export async function verifyParentChildLink(db, parentId, childId) { }

/**
 * Verifies the specified student is actively enrolled in the specified class.
 * @param {Object} db - Database adapter
 * @param {string} classId - UUID of the class
 * @param {string} studentId - Cognito sub of the student
 * @returns {Promise<Object>} The ClassMembership record
 * @throws {Error} 404 STUDENT_NOT_IN_CLASS
 */
export async function verifyStudentInClass(db, classId, studentId) { }
```

### 5.4 DynamoDB Adapter Extensions

Five new logical table names must be added to `TABLE_CONFIG` in `src/db/dynamoDbAdapter.js`:

| Logical Name | envVar | suffix | pk | sk |
|---|---|---|---|---|
| `assignments` | `ASSIGNMENTS_TABLE_NAME` | `Assignments` | `PK` | `SK` |
| `studentassignmentstatus` | `STUDENT_ASSIGNMENT_STATUS_TABLE_NAME` | `StudentAssignmentStatus` | `PK` | `SK` |
| `parentchildlinks` | `PARENT_CHILD_LINKS_TABLE_NAME` | `ParentChildLinks` | `PK` | `SK` |
| `parentinvitecodes` | `PARENT_INVITE_CODES_TABLE_NAME` | `ParentInviteCodes` | `PK` | `SK` |
| `reviewqueueitems` | `REVIEW_QUEUE_ITEMS_TABLE_NAME` | `ReviewQueueItems` | `PK` | `SK` |

The existing `classes` entry stays but note the bootstrap script must be updated to use `PK/SK` composite keys to match the FRD schema.

---

## 6. Security Design

### 6.1 Two-Layer RBAC

Every request is validated at two independent layers:

**Layer 1 — Lambda Authorizer (M01, existing)**
- Validates JWT signature against Cognito public keys.
- Extracts role claim from the JWT custom attribute.
- Rejects requests whose role claim does not match the required role for the route.
- Returns 403 INSUFFICIENT_ROLE before any handler is invoked.
- The Lambda Authorizer cannot check resource-level ownership — it only validates identity and role.

**Layer 2 — Handler-level resource ownership check**
- Every handler that touches a class-scoped resource calls `verifyTeacherOwnsClass`.
- Every handler that touches a child-scoped resource calls `verifyParentChildLink`.
- Every handler that touches a student's own data checks `JWT sub === studentId`.
- These checks happen after the Lambda Authorizer passes — they validate the user's relationship to the specific resource being requested.

The two-layer model ensures that even if a valid teacher JWT is used to access a class owned by a different teacher, the handler-level check will reject the request with 403 NOT_CLASS_OWNER.

### 6.2 Enumeration Prevention

Three endpoint categories must return 403 instead of 404 to prevent probing for valid IDs:

1. **Parent accessing any studentId via `/parent/children/{studentId}/*`:** return 403 CHILD_NOT_LINKED whether or not the studentId exists in DynamoDB. The RBAC check runs first; if it fails, the handler returns 403 without checking whether the student record exists.

2. **Student accessing an assignmentId not assigned to them via `/student/assignments/{assignmentId}`:** return 403 ASSIGNMENT_NOT_FOUND (not 404). The StudentAssignmentStatus lookup by `ASSIGNMENT#{assignmentId}#STUDENT#{studentId}` will find nothing — this is treated as 403, not 404.

3. **Teacher accessing a class they do not own:** return 403 NOT_CLASS_OWNER. The class record may exist — the ownership mismatch is a 403, not a 404.

### 6.3 Atomic Invite Code Consumption

The five-step sequence in POST /parent/link prevents two race conditions:

**Race condition 1 — Concurrent consumption:** Two parents simultaneously submit the same valid code. The conditional UpdateItem with `ConditionExpression: "used = :false"` ensures only one request succeeds. The losing request receives a ConditionalCheckFailedException, which maps to 409 INVITE_CODE_ALREADY_USED. A naive GetItem-then-PutItem pattern would allow both requests to see `used = false` and both write a ParentChildLink.

**Race condition 2 — TTL timing gap:** A code has expired (expiresAt in the past) but DynamoDB TTL has not yet deleted it. The application-level check against the ISO-8601 `expiresAt` attribute at step 2 catches this. If `expiresAt < now`, return 410 INVITE_CODE_EXPIRED regardless of item existence.

### 6.4 Atomic Counter Safety

Two operations require atomic student count management on LearnfyraClasses:

- **Increment on join:** `UpdateItem ADD studentCount 1` with `ConditionExpression: studentCount < :cap` (where :cap = 300). If the condition fails (class at capacity), return 422 CLASS_AT_CAPACITY.
- **Decrement on removal:** `UpdateItem ADD studentCount -1`. No condition needed — count should never go below zero in normal operation.

### 6.5 COPPA Compliance Constraints

M05 storage must comply with the following data minimisation constraints:

- No student email addresses are stored in M05 tables. Email is only in the M01 Cognito User Pool.
- displayName (set by the student at registration) is the only PII stored in M05 table records.
- No student PII may appear in CloudWatch Logs. All log entries use only opaque identifiers: `userId`, `classId`, `assignmentId`, `reviewId`.
- All records for a given studentId must be deletable by a targeted delete-by-studentId operation across: LearnfyraClassMemberships (query by studentId-index GSI), LearnfyraStudentAssignmentStatus (query by StudentIndex GSI), LearnfyraParentChildLinks (query by InvertedIndex GSI). This is a design constraint for Phase 1 purge capability.
- The teacher-initiated parent invite flow must function without the student's direct involvement. The student need only have a Cognito account — they do not need to log in or take any action.

### 6.6 Logging Constraints

All M05 handler log entries must conform to:
```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "handler": "classHandler",
  "action": "createClass",
  "teacherId": "opaque-uuid",
  "classId": "opaque-uuid",
  "requestId": "opaque-uuid"
}
```

Fields that must never appear in logs: displayName, email, studentName, className, questionText, studentAnswer. These fields may contain PII or educational content that must stay private.

---

## 7. Key Design Decisions

### 7.1 StudentAssignmentStatus as First-Class Record

StudentAssignmentStatus is modelled as a pre-written join record rather than derived at query time. This means:
- When an assignment is created, a record is written for every enrolled student immediately.
- When a student joins a class, records are written for every active assignment immediately.
- Query time has O(1) complexity per student per assignment — no scans or joins.
- The cost is storage (one record per student-assignment pair) and write amplification at assignment creation and class join. This is the correct tradeoff for the 300ms SLA requirement.

### 7.2 TTL Cleanup for Invite Codes

Unconsumed invite codes are cleaned up exclusively via DynamoDB TTL. No scheduled Lambda, no EventBridge cron. The TTL fires within 48 hours of expiry (DynamoDB SLA). The application always checks `expiresAt` at the application level — it does not rely on TTL deletion to validate expiry. This design keeps the system simple and eliminates an ops dependency.

### 7.3 Lazy Overdue Evaluation

Student assignment status is not pushed to "overdue" in real time when a due date passes. Instead, the status is evaluated lazily when GET /student/assignments or GET /parent/children/{studentId}/assignments is called:
- If `dueDate < now AND status NOT IN ["submitted"]`, the record is treated as "overdue" and a write-back is issued.
- The first caller after the due date triggers the write-back; subsequent callers see the correct status.
- Teacher-initiated close (DELETE /assignments/:id/close) remains synchronous and eager — all affected records are updated to "overdue" before the 200 response is returned.

Phase 2 will introduce an EventBridge-scheduled Lambda for batch overdue updates.

### 7.4 Review Queue Storage in DynamoDB

Review queue items are stored as DynamoDB records (not S3 objects, not an in-memory queue) because:
- They are written by the M03 scorer and read by the teacher dashboard — two different Lambda invocations.
- They require atomic status updates (pending to resolved).
- They need to be queryable by classId for the teacher queue view.
- The expected volume is low (only short-answer questions with confidence < 0.75 create items).

### 7.5 Score Cascade on Review Resolution

When a teacher overrides a score, four records must be updated in sequence:
1. ReviewQueueItem — marked resolved.
2. WorksheetAttempt — totalScore recalculated.
3. UserProgress — topic accuracy recalculated.
4. StudentAssignmentStatus — score updated.

These four writes are not wrapped in a DynamoDB transaction (TransactWriteItems) because they span different table partitions and the combined item count can exceed the 25-item transaction limit. Instead, the cascade is implemented as sequential UpdateItem calls. Partial failure is logged with all relevant IDs for manual recovery. The handler returns 200 after all four succeed.

### 7.6 Analytics SLA Strategy

The 300ms SLA for GET /classes/{classId}/analytics is achieved by:
1. A single Query on ClassAssignmentIndex GSI — fetches all StudentAssignmentStatus records for the class in one round trip (up to 2,000 items for 200 students x 10 assignments).
2. In-memory aggregation of scores and completion rates from the result set.
3. Two BatchGetItem calls to UserProgress (100 items per batch) — parallel execution via Promise.all.
4. In-memory topic accuracy aggregation.

The analyticsHandler Lambda is provisioned at 512 MB specifically for this in-memory aggregation pattern. No Scan operations are used. The SLA applies to classes with up to 200 students. Classes between 201 and 300 students will receive responses but without a latency guarantee.

### 7.7 Denormalized TeacherId on Assignment Records

`teacherId` is stored directly on each Assignment record (denormalized from the Class record). This avoids a Class lookup on every assignment ownership check. The cost is that if a class were transferred between teachers (not a Phase 1 feature), existing Assignment records would hold a stale teacherId. For Phase 1, this is acceptable — classes are not transferred.

---

## 8. Integration Points

### 8.1 M01 — Authentication and Authorization

**Dependencies on M01 (all already deployed):**
- Lambda Authorizer: validates JWT and enforces role claim before handler invocation. M05 requires role values "teacher" and "parent" in addition to "student". Confirm these roles are already supported in the M01 Cognito custom attributes and the Lambda Authorizer role-check logic.
- POST /user/role/upgrade: allows an existing student to upgrade to "teacher" or "parent" role. This endpoint is required by FR-T-001 and FR-P-002. If not yet implemented in M01, it must be added as an M01 task before M05 ships.
- `validateToken` and `requireRole` from `backend/middleware/authMiddleware.js` are used in every M05 handler. No changes needed to these utilities.

### 8.2 M03 — Scoring Engine

**Required modifications to M03 (not yet done):**
- The scorer must accept optional assignment context: `{ classId, assignmentId }` passed from the submit request.
- For short-answer questions, the scorer must output a `confidenceScore` (float 0.0–1.0) in addition to the boolean correct/incorrect result.
- When `confidenceScore < 0.75` (configurable, read from Config table — not hardcoded), the scorer must write a ReviewQueueItem record to LearnfyraReviewQueueItems.
- When no `classId` or `assignmentId` is present (free practice mode), the scorer must behave identically to its current production behavior — no ReviewQueueItem is written, no StudentAssignmentStatus is updated.
- The confidence threshold (0.75) must be stored in LearnfyraConfig under a key such as `review_queue.confidence_threshold`. The scorer reads this at invocation time, not at module load time.

### 8.3 M04 — Solve Session and Submit

**Required modifications to M04 (not yet done):**

solveHandler modifications:
- Accept an optional `assignmentId` query parameter (`?assignmentId=uuid`).
- When `assignmentId` is present: fetch the Assignment record from LearnfyraAssignments, enforce mode (practice vs. test), timeLimit, and retakePolicy before creating the WorksheetAttempt.
- Retake policy enforcement:
  - `once`: if a submitted WorksheetAttempt exists for this student and worksheet under this assignment, return 403 RETAKE_NOT_PERMITTED.
  - `limited`: if attempt count >= retakeLimit, return 403 RETAKE_NOT_PERMITTED.
  - `unlimited`: no restriction.
- After creating the WorksheetAttempt, update StudentAssignmentStatus to status = "in-progress" and set `attemptId`.

submitHandler modifications:
- Accept an optional `assignmentId` in the request body.
- When `assignmentId` is present: after scoring, update StudentAssignmentStatus to status = "submitted", set `score` and `submittedAt`.
- The `assignmentId` must be stored on the WorksheetAttempt record for the review queue cascade.

Both modifications must be backward-compatible. Requests without `assignmentId` use the existing code path unchanged.

### 8.4 M04 — UserProgress Table

The UserProgress table is read by analyticsHandler (heatmap, analytics overview), parentHandler (needs-attention), and analyticsHandler (student drill-down). The table must be created before M05 ships. DynamoDB Streams must be enabled from the first deploy (cannot be added retroactively without a table migration).

### 8.5 M06 — CDK Infrastructure

**Required M06 actions for M05 (all deferred to M06 sprint):**
- Add all five new DynamoDB tables to the CDK stack with correct GSIs, TTL configuration, and Streams settings.
- Add five new Lambda functions to the CDK stack using NodejsFunction with ARM_64.
- Add all five new Lambda functions to API Gateway with correct route/method bindings.
- Add new environment variables to each Lambda function (see Section 8.6).
- Update `scripts/bootstrap-local-db.js` with all five new table definitions for local development.
- Enable DynamoDB Streams on UserProgress table (coordinate with M04 CDK).

### 8.6 New Environment Variables

| Variable | Handler(s) | Value |
|---|---|---|
| `CLASSES_TABLE_NAME` | classHandler, assignmentHandler, analyticsHandler, parentHandler | `LearnfyraClasses-{env}` |
| `ASSIGNMENTS_TABLE_NAME` | assignmentHandler, analyticsHandler, parentHandler | `LearnfyraAssignments-{env}` |
| `STUDENT_ASSIGNMENT_STATUS_TABLE_NAME` | assignmentHandler, analyticsHandler, parentHandler | `LearnfyraStudentAssignmentStatus-{env}` |
| `PARENT_CHILD_LINKS_TABLE_NAME` | parentHandler | `LearnfyraParentChildLinks-{env}` |
| `PARENT_INVITE_CODES_TABLE_NAME` | parentHandler, assignmentHandler | `LearnfyraParentInviteCodes-{env}` |
| `REVIEW_QUEUE_ITEMS_TABLE_NAME` | reviewQueueHandler, M03 scorer | `LearnfyraReviewQueueItems-{env}` |
| `CLASS_MEMBERSHIPS_TABLE_NAME` | classHandler, assignmentHandler, analyticsHandler, parentHandler | `LearnfyraClassMemberships-{env}` |

IaC agent: inject all of the above into the relevant Lambda function environments in the CDK stack.

---

## 9. Express Routes

All new M05 routes are wired into `server.js` following the existing lazy-import handler pattern. The handler reference must be declared at the top of the lazy-load section alongside existing handlers.

### 9.1 Handler Loader Functions

Add the following lazy loaders to server.js immediately after the existing handler loaders:

```javascript
let _assignmentHandler;
let _reviewQueueHandler;
let _parentHandler;

const getAssignmentHandler = async () => {
  if (!_assignmentHandler) {
    const mod = await import('./backend/handlers/assignmentHandler.js');
    _assignmentHandler = mod.handler;
  }
  return _assignmentHandler;
};

const getReviewQueueHandler = async () => {
  if (!_reviewQueueHandler) {
    const mod = await import('./backend/handlers/reviewQueueHandler.js');
    _reviewQueueHandler = mod.handler;
  }
  return _reviewQueueHandler;
};

const getParentHandler = async () => {
  if (!_parentHandler) {
    const mod = await import('./backend/handlers/parentHandler.js');
    _parentHandler = mod.handler;
  }
  return _parentHandler;
};
```

The existing `_classHandler` and `getClassHandler` remain and are updated to point at the new classHandler.js implementation.

### 9.2 Route Registrations

Add the following route registrations to server.js. Each route uses the same adapter pattern as the existing solve and auth routes. Note that `event.path` must be set to `req.path` and `event.pathParameters` must map Express param names to the object that handlers read from `event.pathParameters`:

```javascript
// ── Class Management (Teacher) ─────────────────────────────────────────────────
app.post('/api/classes', async (req, res) => {
  const fn = await getClassHandler();
  const result = await fn(
    { httpMethod: 'POST', path: '/api/classes', headers: req.headers, body: JSON.stringify(req.body) },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/classes', async (req, res) => {
  const fn = await getClassHandler();
  const result = await fn(
    { httpMethod: 'GET', path: '/api/classes', headers: req.headers, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/classes/:classId', async (req, res) => {
  const fn = await getClassHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.patch('/api/classes/:classId', async (req, res) => {
  const fn = await getClassHandler();
  const result = await fn(
    { httpMethod: 'PATCH', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: JSON.stringify(req.body) },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.delete('/api/classes/:classId/archive', async (req, res) => {
  const fn = await getClassHandler();
  const result = await fn(
    { httpMethod: 'DELETE', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.post('/api/classes/:classId/invite', async (req, res) => {
  const fn = await getClassHandler();
  const result = await fn(
    { httpMethod: 'POST', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

// ── Assignment Management (Teacher) ───────────────────────────────────────────
app.post('/api/assignments', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'POST', path: '/api/assignments', headers: req.headers, body: JSON.stringify(req.body) },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/assignments/:assignmentId', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { assignmentId: req.params.assignmentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.patch('/api/assignments/:assignmentId', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'PATCH', path: req.path, headers: req.headers, pathParameters: { assignmentId: req.params.assignmentId }, body: JSON.stringify(req.body) },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.delete('/api/assignments/:assignmentId/close', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'DELETE', path: req.path, headers: req.headers, pathParameters: { assignmentId: req.params.assignmentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/classes/:classId/assignments', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/classes/:classId/students', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.delete('/api/classes/:classId/students/:studentId', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'DELETE', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId, studentId: req.params.studentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.post('/api/classes/:classId/students/:studentId/parent-invite', async (req, res) => {
  const fn = await getAssignmentHandler();
  const result = await fn(
    { httpMethod: 'POST', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId, studentId: req.params.studentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

// ── Review Queue (Teacher) ─────────────────────────────────────────────────────
app.get('/api/classes/:classId/review-queue', async (req, res) => {
  const fn = await getReviewQueueHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.post('/api/review-queue/:reviewId/resolve', async (req, res) => {
  const fn = await getReviewQueueHandler();
  const result = await fn(
    { httpMethod: 'POST', path: req.path, headers: req.headers, pathParameters: { reviewId: req.params.reviewId }, body: JSON.stringify(req.body) },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

// ── Analytics (Teacher) ────────────────────────────────────────────────────────
app.get('/api/classes/:classId/analytics', async (req, res) => {
  const fn = await getAnalyticsHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/classes/:classId/analytics/heatmap', async (req, res) => {
  const fn = await getAnalyticsHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/classes/:classId/students/:studentId/progress', async (req, res) => {
  const fn = await getAnalyticsHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { classId: req.params.classId, studentId: req.params.studentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

// ── Parent Routes ──────────────────────────────────────────────────────────────
app.post('/api/parent/link', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'POST', path: '/api/parent/link', headers: req.headers, body: JSON.stringify(req.body) },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/parent/children', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: '/api/parent/children', headers: req.headers, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.delete('/api/parent/children/:studentId', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'DELETE', path: req.path, headers: req.headers, pathParameters: { studentId: req.params.studentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/parent/children/:studentId/progress', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { studentId: req.params.studentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/parent/children/:studentId/assignments', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { studentId: req.params.studentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

// ── Student Class Participation Routes ────────────────────────────────────────
app.post('/api/student/parent-invite', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'POST', path: '/api/student/parent-invite', headers: req.headers, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.post('/api/student/classes/join', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'POST', path: '/api/student/classes/join', headers: req.headers, body: JSON.stringify(req.body) },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/student/assignments', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: '/api/student/assignments', headers: req.headers, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/api/student/assignments/:assignmentId', async (req, res) => {
  const fn = await getParentHandler();
  const result = await fn(
    { httpMethod: 'GET', path: req.path, headers: req.headers, pathParameters: { assignmentId: req.params.assignmentId }, body: null },
    {},
  );
  res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
});
```

All routes must be registered before the catch-all OPTIONS handler at the end of server.js. The Access-Control-Allow-Methods header on the global OPTIONS handler must be updated to include `DELETE`:

```javascript
'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
```

Note: the global CORS middleware at the top of server.js already sets this on all /api responses. The OPTIONS handler must also include DELETE.

---

## 10. Acceptance Criteria

### 10.1 Authentication and Role Management

| FR ID | Acceptance Criterion | Test Type |
|---|---|---|
| FR-T-001 | Given a user with role = "student", when POST /user/role/upgrade with body { role: "teacher" }, then the Users record role is updated to "teacher" and subsequent JWTs carry the teacher role claim. | Integration |
| FR-T-003 | Given a user with role = "teacher", when POST /user/role/upgrade with body { role: "student" }, then response is 403 ROLE_DOWNGRADE_NOT_PERMITTED and the role is unchanged. | Unit |
| FR-T-004 | Given a valid JWT with role = "student", when the request targets a teacher-only endpoint, then the Lambda Authorizer returns 403 INSUFFICIENT_ROLE before the handler is invoked. | Integration |
| FR-P-001 | Given a new user registers with role = "parent", then the Users record has role = "parent". | Integration |
| FR-P-004 | Given a parent JWT, when GET /parent/children/{studentId}/progress is called with an unlinked studentId, then response is 403 CHILD_NOT_LINKED regardless of whether the studentId exists. | Unit |

### 10.2 Class Management

| FR ID | Acceptance Criterion | Test Type |
|---|---|---|
| FR-T-010 | Given a teacher submits POST /classes with a valid className, then a Class record is created with a UUID classId and a unique 6-character invite code excluding O, 0, I, 1. Response 201 includes classId and inviteCode. | Unit |
| FR-T-011 | Given an invite code collision occurs during generation, then automatic regeneration happens transparently without surfacing an error. The final code is unique. | Unit (mock GSI responses) |
| FR-T-012 | Given a teacher calls POST /classes/:id/invite, then the existing invite code is immediately replaced. A subsequent POST /student/classes/join with the old code returns 404 INVALID_JOIN_CODE. | Integration |
| FR-T-013 | Given Teacher A calls GET /classes/{classId} where classId belongs to Teacher B, then response is 403 NOT_CLASS_OWNER. | Unit |
| FR-T-014 | Given a teacher calls DELETE /classes/:id/archive on an active class, then the class status = "archived", it does not appear in GET /classes, and all child records (memberships, assignments, StudentAssignmentStatus, WorksheetAttempt) are preserved. | Integration |
| FR-T-015 | Given a teacher has 3 active classes, when GET /classes, then all 3 classes are returned ordered by createdAt descending with a pendingReviewCount field. | Unit |
| FR-T-016 | Given a student submits POST /student/classes/join with a valid invite code, then a ClassMembership record is created immediately, the class studentCount is incremented atomically, and StudentAssignmentStatus records are created for all active assignments. | Integration |
| FR-T-017 | Given a student is already enrolled in a class, when POST /student/classes/join with the same class invite code, then response is 409 ALREADY_ENROLLED. | Unit |
| FR-T-018 | Given a student has been removed from a class, when POST /student/classes/join with the current invite code, then the existing ClassMembership status is updated to "active" and no duplicate record is created. | Unit |

### 10.3 Assignment Management

| FR ID | Acceptance Criterion | Test Type |
|---|---|---|
| FR-T-030 | Given a teacher submits POST /assignments with classId, worksheetId, mode = "test", retakePolicy = "limited", retakeLimit = 2, then an Assignment record is created with all fields. Response 201 includes studentCount matching enrolled students. | Unit |
| FR-T-031 | Given 25 students are enrolled in the class when POST /assignments is called, then exactly 25 StudentAssignmentStatus records are written with status = "not-started" before the 201 response. | Integration |
| FR-T-032 | Given a student joins a class that already has 2 active assignments, then 2 StudentAssignmentStatus records are created for that student with status = "not-started". | Integration |
| FR-T-033 | Given an assignment has mode = "test", when the student starts a solve session, then the solve engine returns no per-question feedback until full submission. | Integration (M04 boundary) |
| FR-T-035 | Given an assignment has openAt in the future, when a student calls GET /student/assignments/:id, then response is 403 ASSIGNMENT_NOT_AVAILABLE. | Unit |
| FR-T-036 | Given an assignment's openAt has passed, when the teacher calls PATCH /assignments/:id, then response is 409 ASSIGNMENT_ALREADY_OPEN. | Unit |
| FR-T-037 | Given a teacher calls DELETE /assignments/:id/close, then Assignment status = "closed", all StudentAssignmentStatus records with status "not-started" or "in-progress" are updated to "overdue" synchronously, and studentsMarkedOverdue count in response matches the actual updates. | Integration |
| FR-T-039 | Given retakePolicy = "once" and a submitted attempt exists, when the student attempts to start a new solve session for the same assignment, then the solve engine returns 403 RETAKE_NOT_PERMITTED. | Integration (M04 boundary) |

### 10.4 Review Queue

| FR ID | Acceptance Criterion | Test Type |
|---|---|---|
| FR-T-040 | Given the M03 scorer processes a short-answer response with confidence = 0.62 (below 0.75 threshold), then a ReviewQueueItem is written with status = "pending", systemConfidenceScore = 0.62, currentScore = 0. | Unit (M03 scorer) |
| FR-T-041 | Given a teacher calls GET /classes/:id/review-queue, then the response includes all pending items with required fields (reviewId, studentName, questionText, studentAnswer, expectedAnswer, systemConfidenceScore, currentScore, pointsPossible, attemptId). | Unit |
| FR-T-042 | Given a teacher calls POST /review-queue/:id/resolve with action = "override" and overrideScore = 1, then the ReviewQueueItem is marked resolved with overrideScore = 1. | Unit |
| FR-T-043 | Given a review is resolved with overrideScore = 1 (was 0), then WorksheetAttempt totalScore is incremented by 1, UserProgress topic accuracy is recalculated, and StudentAssignmentStatus score is updated — all four writes complete before the 200 response. | Integration |
| FR-T-044 | Given Teacher A calls POST /review-queue/:id/resolve where the item belongs to Teacher B's class, then response is 403 NOT_CLASS_OWNER. | Unit |
| FR-T-045 | Given a ReviewQueueItem has status = "resolved", when POST /review-queue/:id/resolve is called again, then response is 409 REVIEW_ALREADY_RESOLVED. | Unit |

### 10.5 Analytics

| FR ID | Acceptance Criterion | Test Type |
|---|---|---|
| FR-T-050 | Given a class with 3 assignments and 20 students, when GET /classes/:id/analytics, then response includes averageScorePerAssignment array, completionRate, weakestTopics (up to 5), and studentsBelowThreshold using the class accuracyThreshold. | Unit |
| FR-T-051 | Given a class with 20 students across 8 topics, when GET /classes/:id/analytics/heatmap, then response cells matrix has an entry for every student-topic pair, with null for topics with no attempts. | Unit |
| FR-T-052 | Given a class with 200 students, the analytics and heatmap endpoints must respond within 300 ms. No Scan operations used. | Performance (load test) |
| FR-T-053 | Given a teacher updates accuracyThreshold to 70 via PATCH /classes/:id, when GET /classes/:id/analytics, then studentsBelowThreshold reflects the new 70% threshold. | Unit |
| FR-T-054 | Given a teacher calls GET /classes/:id/students/:sid/progress where :sid is enrolled, then response is identical to GET /student/progress from M04. Given :sid is not enrolled, then response is 404 STUDENT_NOT_IN_CLASS. | Unit |

### 10.6 Parent Linking

| FR ID | Acceptance Criterion | Test Type |
|---|---|---|
| FR-P-010 | Given a student calls POST /student/parent-invite, then a ParentInviteCode record is written with linkMethod = "student-invite", used = false, TTL = now + 48 hours. Prior unused code for the same student is invalidated. | Unit |
| FR-P-012 | Given a valid unused invite code that has not expired, when POST /parent/link, then a ParentChildLink record is written and the invite code is marked used = true atomically. Response 201 includes linked child's displayName. | Integration |
| FR-P-013 | Given an invite code that has already been used, when POST /parent/link, then response is 409 INVITE_CODE_ALREADY_USED. No ParentChildLink is written. | Unit |
| FR-P-014 | Given an invite code where expiresAt is in the past but the DynamoDB item still exists (TTL not yet fired), when POST /parent/link, then response is 410 INVITE_CODE_EXPIRED. | Unit |
| FR-P-015 | Given an invite code that does not exist, when POST /parent/link, then response is 404 INVITE_CODE_NOT_FOUND. | Unit |
| FR-P-016 | Given Parent A and Parent B both call POST /parent/link simultaneously with the same valid invite code, then exactly one succeeds with 201 and the other receives 409 INVITE_CODE_ALREADY_USED. Only one ParentChildLink record is written. | Concurrency test |
| FR-P-017 | Given an active ParentChildLink, when DELETE /parent/children/:studentId, then the link status = "revoked" and subsequent GET /parent/children/:studentId/progress returns 403 CHILD_NOT_LINKED. | Integration |

### 10.7 Parent Dashboard

| FR ID | Acceptance Criterion | Test Type |
|---|---|---|
| FR-P-020 | Given an active ParentChildLink, when GET /parent/children/:id/progress, then response includes last7Days, last30Days, overallAccuracy, and needsAttention for topics with accuracy < 60% and 3+ attempts. | Unit |
| FR-P-021 | Given a child has 3 active assignments, when GET /parent/children/:id/assignments, then all 3 are returned with correct status, className, and dueDate. | Unit |
| FR-P-022 | Given a child's accuracy in "Fractions" is 45% across 4 attempts, then the needsAttention list includes Fractions with currentAccuracy = 45 and attemptCount = 4. | Unit |
| FR-P-023 | Given a parent endpoint receives a request body with a score modification field, then the field is silently ignored and no records are modified. | Unit |
| FR-P-032 | Given a revoked ParentChildLink, when GET /parent/children/:id/progress, then response is 403 CHILD_NOT_LINKED (not 404). | Unit |

---

*End of Technical Design Document — Module 5, Teacher & Parent Roles*
