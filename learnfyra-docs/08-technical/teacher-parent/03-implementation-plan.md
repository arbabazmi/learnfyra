# Module 5 — Implementation Plan
## Teacher & Parent Roles

| Field | Value |
|---|---|
| Document | 03-implementation-plan.md |
| Module | M05 — Teacher & Parent Roles |
| Version | 1.0 |
| Date | 2026-04-03 |
| Prepared By | DEV Agent |
| Source Documents | 01-requirements-analysis.md, 02-technical-design.md, MODULE_5_TaskTracker.md v1.0, MODULE_5_SprintPlan.md v1.0 |
| Audience | DEV Agent, QA Agent, IaC Agent |

---

## 1. Current Codebase State

### What Exists

**backend/handlers/classHandler.js**
Partially implemented. Handles two routes only:
- `POST /api/class/create` — creates a class. Stores a flat record with keys `classId`, `teacherId`, `className`, `grade`, `subject`, `inviteCode`, `createdAt`. No `PK`/`SK` composite, no `status`, no `studentCount`, no `accuracyThreshold`, no `archivedAt`.
- `GET /api/class/:id/students` — queries memberships and returns a basic student list. No `assignmentsSummary`, no `lastActiveAt`, no `overallAccuracy`.

The invite code character set is `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (includes O, 0, I, 1). The FRD character set is `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes O, 0, I, 1). The existing handler must be corrected.

**backend/handlers/studentHandler.js**
Has `GET /api/student/profile`, `PATCH /api/student/profile`, and a stub for `POST /api/student/join-class`. The join flow currently queries `memberships` by `inviteCode` field — there is no GSI-backed lookup. The FRD requires an `InviteCodeIndex` GSI query on `LearnfyraClasses`.

**backend/handlers/analyticsHandler.js**
Handles `GET /api/analytics/class/:id` and `GET /api/analytics/student/:id`. These are existing pre-M05 routes based on scanning membership and attempt records. They must be preserved unchanged. M05 will add three new endpoints to this file without removing the existing two routes.

**backend/handlers/solveHandler.js** and **backend/handlers/submitHandler.js**
Both exist from M03/M04. Neither accepts an `assignmentId`. Both must be extended non-destructively — all existing code paths for non-assignment sessions must remain unaffected.

**scripts/bootstrap-local-db.js**
Contains `LearnfyraClasses-local` with a flat PK (`classId`) and a `joinCode-index` GSI. The FRD specifies a composite PK design (`PK = CLASS#{classId}`, `SK = METADATA`) and an `InviteCodeIndex` GSI keyed on `inviteCode` (not `joinCode`). This is a hard conflict that must be resolved before any M05 local testing begins. The existing table definition must be replaced — not patched.

`LearnfyraClassMemberships-local` exists as a separate table (`classId` hash + `studentId` range). The FRD design embeds ClassMembership records in `LearnfyraClasses` as `SK = MEMBER#{studentId}` items in the same table. This is the second hard conflict.

The following M05 tables are absent from the bootstrap script and must be added:
- `LearnfyraAssignments-local`
- `LearnfyraStudentAssignmentStatus-local`
- `LearnfyraParentChildLinks-local`
- `LearnfyraParentInviteCodes-local`
- `LearnfyraReviewQueueItems-local`

**server.js**
Existing M05-adjacent Express routes: `POST /api/class/create`, `GET /api/class/:id/students`, `GET /api/analytics/class/:id`, `GET /api/analytics/student/:id`, `POST /api/student/join-class`. All other M05 routes are absent.

The FRD API paths use a different URL scheme from what is currently wired. The FRD uses `/api/classes` (plural), `/api/assignments`, `/api/parent`, `/api/student/classes/join`. The existing server uses `/api/class/create` and `/api/student/join-class`. New routes must be added using the FRD-specified paths. Existing paths must not be removed until a deprecation decision is made.

**backend/handlers/ — files that do not exist:**
- `assignmentHandler.js`
- `reviewQueueHandler.js`
- `parentHandler.js`

**backend/utils/ — files that do not exist:**
- `rbacUtils.js`
- `inviteCodeUtils.js`

**WorksheetAttempt table**
Schema currently uses `userId` (HASH) + `sortKey` (RANGE) composite key with no `assignmentId` field. The `assignmentId` field must be added as a nullable attribute. No PK change is required — this is an additive schema extension that does not require a table migration.

**Worksheet table (M02/M03)**
The `savedBy` and `savedAt` fields are absent. A GSI on `savedBy` for `GET /teacher/library` is absent. These must be confirmed and added (M5-BE-012 confirmation task).

### Conflicts Summary

| Conflict | File | Existing State | FRD Requirement | Resolution |
|---|---|---|---|---|
| Classes table PK format | bootstrap-local-db.js | Flat PK: `classId` | Composite: `PK = CLASS#{classId}`, `SK = METADATA` | Replace table definition in bootstrap script |
| ClassMembership location | bootstrap-local-db.js | Separate `LearnfyraClassMemberships` table | Same-table records with `SK = MEMBER#{studentId}` | Migrate to single-table design; remove `LearnfyraClassMemberships` table |
| Invite code field name | bootstrap-local-db.js | GSI on `joinCode` | GSI on `inviteCode` | Rename in bootstrap and handler |
| Invite code character set | classHandler.js | Includes O, 0, I, 1 | Excludes O, 0, I, 1 | Update `generateInviteCode()` character set |
| PATCH/DELETE methods | server.js CORS | CORS allows `GET,POST,PATCH,OPTIONS` | M05 needs DELETE | Add DELETE to CORS methods in corsHeaders |

---

## 2. Prioritized Task List

### P0 — Critical Foundation (blocks everything else)

These tasks must complete before any handler code can be written or tested locally.

**P0-1: Bootstrap script replacement (M5-INF-008)**
Replace the `LearnfyraClasses-local` table definition in `scripts/bootstrap-local-db.js` to match the FRD composite PK design. Remove the separate `LearnfyraClassMemberships-local` table (ClassMembership records are now stored in the Classes table with `SK = MEMBER#{studentId}`). Add the five missing M05 tables: `LearnfyraAssignments-local`, `LearnfyraStudentAssignmentStatus-local`, `LearnfyraParentChildLinks-local`, `LearnfyraParentInviteCodes-local`, `LearnfyraReviewQueueItems-local`. All GSIs must be defined exactly as specified in the technical design (Section 2).

**P0-2: RBAC utilities (M5-AUTH-002, M5-AUTH-003)**
Create `backend/utils/rbacUtils.js` with two exported functions: `verifyTeacherOwnsClass(classId, teacherId, db)` and `verifyParentChildLink(parentId, childId, db)`. These functions are called by every M05 handler that operates on class-scoped or child-scoped resources. Implementing them first prevents duplication across five handler files.

**P0-3: Invite code utilities (M5-BE-001 prerequisite)**
Create `backend/utils/inviteCodeUtils.js` exporting `generateInviteCode()` with the corrected 32-character set (excluding O, 0, I, 1) and `generateUniqueInviteCode(db)` with collision detection via `InviteCodeIndex` GSI query.

**P0-4: Lambda Authorizer role update (M5-AUTH-001)**
Update the Lambda Authorizer in `backend/handlers/apiAuthorizerHandler.js` to accept `teacher` and `parent` as valid role claim values. Verify that route-level role restrictions propagate correctly for all M05 endpoints.

**P0-5: DynamoDB adapter M05 table operations**
Update `src/db/dynamoDbAdapter.js` (and the local adapter if separate) to support the composite PK query patterns introduced by M05: `queryByPKPrefix(table, pk, skPrefix)` for ClassMembership queries, and single-item `getByCompositeKey(table, pk, sk)` where the SK is a constant like `METADATA`.

---

### P1 — Core Features (dependency order)

#### Group 1: Class Management

**classHandler.js — full rewrite to FRD spec**
- `POST /classes` (M5-BE-001): composite PK write, corrected invite code generation, `InviteCodeIndex` collision check
- `GET /classes` (M5-BE-002): `TeacherIndex` GSI query, `pendingReviewCount` join from `ClassPendingIndex`
- `GET /classes/{classId}` (M5-BE-003): GetItem by `CLASS#{classId}` + `METADATA`, ownership check
- `DELETE /classes/{classId}/archive` (M5-BE-005): conditional UpdateItem, status check
- `POST /classes/{classId}/invite` (M5-BE-006): new invite code generation, `InviteCodeIndex` collision check, UpdateItem
- `GET /classes/{classId}/students` (M5-BE-007): query `SK begins_with MEMBER#`, aggregate `assignmentsSummary` from `StudentAssignmentStatus`, read `overallAccuracy` from `UserProgress`
- `DELETE /classes/{classId}/students/{studentId}` (M5-BE-008): membership UpdateItem, atomic `studentCount` decrement
- `POST /classes/{classId}/students/{studentId}/parent-invite` (M5-BE-009): generate `ParentInviteCode` record, TTL = now + 172800s

**Student join flow (assignmentHandler.js or studentHandler.js)**
- `POST /student/classes/join` (M5-BE-010): `InviteCodeIndex` GSI lookup, ClassMembership write (create or reactivate), atomic `studentCount` increment, `StudentAssignmentStatus` batch write for all active assignments

**Wire Express routes in server.js (Group 1 routes)**

#### Group 2: Assignment and Library

**classHandler.js additions**
- `POST /teacher/library` (M5-BE-011): UpdateItem on Worksheet record, set `savedBy`, `savedAt`
- `GET /teacher/library` (M5-BE-012): GSI query on `savedBy` (confirm GSI exists, add if absent)

**assignmentHandler.js — new file**
- `POST /assignments` (M5-BE-014): create Assignment record, verify worksheet exists (GetItem — no AI call), validate all configuration fields, batch-write `StudentAssignmentStatus` records for all enrolled students
- `GET /assignments/{assignmentId}` (M5-BE-015): GetItem, ownership check
- `GET /classes/{classId}/assignments` (M5-BE-016): `ClassDueDateIndex` GSI query, aggregate `submissionCount`/`totalStudents` from `StudentAssignmentStatus`
- `DELETE /assignments/{assignmentId}/close` (M5-BE-018): UpdateItem assignment status, batch UpdateItem `StudentAssignmentStatus` for all not-started/in-progress records to `overdue`
- `GET /student/assignments` (M5-BE-019): `StudentIndex` GSI query, join with Assignment records
- `GET /student/assignments/{assignmentId}` (M5-BE-020): GetItem `StudentAssignmentStatus`, enforce `openAt`/`closeAt`

**Wire Express routes in server.js (Group 2 routes)**

#### Group 3: M04 Integration

**solveHandler.js modifications (M5-BE-021)**
- Accept optional `assignmentId` query parameter
- When present: read Assignment record, enforce `mode`, `timeLimit`, `retakePolicy`
- Count prior submitted attempts for retake enforcement
- Update `StudentAssignmentStatus` to `in-progress` at session start
- Non-assignment paths: zero change

**submitHandler.js modifications (M5-BE-022)**
- When submission carries `assignmentId`: update `StudentAssignmentStatus` to `submitted` with `score` and `submittedAt`
- Pass `classId` and `assignmentId` to scoring engine for `ReviewQueueItem` creation
- Non-assignment paths: zero change

**WorksheetAttempt schema extension (M5-BE-036)**
- Confirm or add `assignmentId` nullable String field to `WorksheetAttempt` records

#### Group 4: Review Queue

**scorer.js modifications (M5-BE-025)**
- When `short-answer` fuzzy-match confidence < 0.75 (configurable from `LearnfyraConfig`): write a `ReviewQueueItem` record to `LearnfyraReviewQueueItems`
- Requires `classId` and `assignmentId` in scoring context — only written when assignment context is present

**reviewQueueHandler.js — new file (M5-BE-023, M5-BE-024)**
- `GET /classes/{classId}/review-queue`: `ClassPendingIndex` GSI query (KEYS_ONLY), `BatchGetItem` for full attributes, ownership check
- `POST /review-queue/{reviewId}/resolve`: validate action (`approve`/`override`), ownership check via `ReviewQueueItem.classId`, reject if `status = "resolved"` (409), execute four-write cascade using `TransactWriteItems`: ReviewQueueItem resolved + WorksheetAttempt score recalculated + UserProgress topic accuracy updated + StudentAssignmentStatus score updated

**Wire Express routes in server.js (Group 4 routes)**

#### Group 5: Analytics

**analyticsHandler.js modifications (M5-BE-026, M5-BE-027, M5-BE-028)**
- Preserve existing `GET /api/analytics/class/:id` and `GET /api/analytics/student/:id` routes unchanged
- Add `GET /classes/{classId}/analytics`: `ClassAssignmentIndex` GSI query, in-memory aggregation for `averageScorePerAssignment`, `completionRate`, `weakestTopics` (from `UserProgress`), `studentsBelowThreshold`. No scans. 300ms SLA.
- Add `GET /classes/{classId}/analytics/heatmap`: roster query + `UserProgress` per-student reads, 2D accuracy matrix construction. 300ms SLA.
- Add `GET /classes/{classId}/students/{studentId}/progress`: ownership + enrollment check, delegate to M04 progress data model

**Wire Express routes in server.js (Group 5 routes)**

#### Group 6: Parent Backend

**parentHandler.js — new file (M5-BE-029 through M5-BE-033)**
- `POST /parent/link`: four-step validation sequence (exists, expired, used, conditional update), write `ParentChildLink` record
- `GET /parent/children`: primary key query by `USER#{parentId}`
- `DELETE /parent/children/{studentId}`: conditional UpdateItem `status = "revoked"`, return 403 if no active link
- `GET /parent/children/{studentId}/progress`: `verifyParentChildLink`, aggregate `last7Days`/`last30Days` from `WorksheetAttempt`, `needsAttention` from `UserProgress`
- `GET /parent/children/{studentId}/assignments`: `verifyParentChildLink`, `StudentIndex` GSI on `StudentAssignmentStatus`, join with Assignment records, lazy overdue evaluation

**studentHandler.js modifications (M5-BE-034)**
- Add `POST /student/parent-invite`: read `activeParentInviteCode` from Users record, conditionally invalidate prior code, write new `ParentInviteCode` record, update Users record

**Wire Express routes in server.js (Group 6 routes)**

#### Group 7: Role Management

**authHandler.js or new roleHandler.js (M5-BE-035)**
- `POST /user/role/upgrade`: validate new role is `teacher` or `parent`, reject downgrade from teacher to student (403 `ROLE_DOWNGRADE_NOT_PERMITTED`), UpdateItem on Users table, update Cognito custom attribute if applicable

---

### P2 — Non-blocking (implement after P1 passes all tests)

- `PATCH /classes/{classId}` (M5-BE-004): update `accuracyThreshold` or `className`
- `PATCH /assignments/{assignmentId}` (M5-BE-017): reject if `openAt` has passed (409 `ASSIGNMENT_ALREADY_OPEN`)
- `DELETE /teacher/library/{worksheetId}` (M5-BE-013): clear `savedBy`/`savedAt` fields
- `M5-INF-016`: CloudWatch alarms for all five M05 Lambda functions
- CDK Lambda function definitions for all five M05 handlers
- CDK API Gateway route additions for all M05 endpoints

---

## 3. File and Folder Structure

```
NEW FILES:
backend/handlers/assignmentHandler.js     — POST/GET/DELETE /assignments, GET/DELETE /student/assignments
backend/handlers/reviewQueueHandler.js    — GET /classes/{id}/review-queue, POST /review-queue/{id}/resolve
backend/handlers/parentHandler.js         — all /parent/* endpoints
backend/utils/rbacUtils.js                — verifyTeacherOwnsClass, verifyParentChildLink
backend/utils/inviteCodeUtils.js          — generateInviteCode, generateUniqueInviteCode

MODIFIED FILES:
backend/handlers/classHandler.js          — full rewrite: composite PK, all FRD endpoints, corrected invite code
backend/handlers/studentHandler.js        — add POST /student/classes/join (FRD path), POST /student/parent-invite
backend/handlers/analyticsHandler.js      — add three new M05 endpoints, preserve existing two routes
backend/handlers/solveHandler.js          — add assignmentId support, retake enforcement, StudentAssignmentStatus update
backend/handlers/submitHandler.js         — add StudentAssignmentStatus update, pass assignment context to scorer
src/solve/scorer.js                       — add ReviewQueueItem write for low-confidence short-answer responses
server.js                                 — add all M05 Express routes, add DELETE to CORS methods
scripts/bootstrap-local-db.js             — replace LearnfyraClasses definition, remove LearnfyraClassMemberships, add 5 new tables
src/db/dynamoDbAdapter.js                 — add composite PK query helpers for M05 single-table patterns

FRONTEND (blocked on UI template from product owner):
learnfyra-app/src/pages/teacher/TeacherDashboard.tsx
learnfyra-app/src/pages/teacher/ClassRoster.tsx
learnfyra-app/src/pages/teacher/AssignmentList.tsx
learnfyra-app/src/pages/teacher/WorksheetLibrary.tsx
learnfyra-app/src/pages/teacher/ReviewQueue.tsx
learnfyra-app/src/pages/teacher/AnalyticsOverview.tsx
learnfyra-app/src/pages/teacher/TopicHeatmap.tsx
learnfyra-app/src/pages/student/AssignmentList.tsx
learnfyra-app/src/pages/student/JoinClass.tsx
learnfyra-app/src/pages/parent/ParentDashboard.tsx
learnfyra-app/src/pages/parent/ChildProgress.tsx
learnfyra-app/src/pages/parent/LinkToChild.tsx
learnfyra-app/src/contexts/TeacherContext.tsx
learnfyra-app/src/contexts/ParentContext.tsx
learnfyra-app/src/services/api/teacherService.ts
learnfyra-app/src/services/api/parentService.ts
learnfyra-app/src/services/api/studentService.ts  (extend for assignment endpoints)
learnfyra-app/src/components/teacher/ClassSwitcher.tsx
learnfyra-app/src/components/teacher/ReviewQueueBadge.tsx
learnfyra-app/src/components/parent/ChildSwitcher.tsx

TESTS:
tests/unit/classHandler.test.js
tests/unit/assignmentHandler.test.js
tests/unit/reviewQueueHandler.test.js
tests/unit/analyticsHandler.test.js
tests/unit/parentHandler.test.js
tests/unit/rbacUtils.test.js
tests/unit/inviteCodeUtils.test.js
tests/unit/solveHandlerAssignment.test.js    — new M05-specific solve tests (supplement existing)
tests/unit/submitHandlerAssignment.test.js   — new M05-specific submit tests (supplement existing)
tests/unit/scorerReviewQueue.test.js         — ReviewQueueItem creation in scorer
tests/integration/teacherFlow.test.js
tests/integration/parentFlow.test.js
tests/integration/reviewQueueFlow.test.js
```

---

## 4. Implementation Order (Step by Step)

### Phase 1: Infrastructure and Foundation

**Step 1 — Bootstrap script (M5-INF-008)**
Read `scripts/bootstrap-local-db.js` in full. Replace the `LearnfyraClasses-local` table definition: change PK to `PK` (String, HASH) and `SK` (String, RANGE); update `TeacherIndex` GSI to key on `teacherId` (HASH) + `createdAt` (RANGE) with ALL projection; update `InviteCodeIndex` GSI to key on `inviteCode` (HASH) with ALL projection. Remove the `LearnfyraClassMemberships-local` table definition entirely (ClassMembership records now live in the Classes table). Run `node scripts/bootstrap-local-db.js --delete` to verify the script executes without error.

**Step 2 — Add LearnfyraAssignments-local table (M5-INF-002)**
Add to `TABLE_DEFINITIONS`: PK = `PK` (HASH, String), SK = `SK` (RANGE, String). GSI 1: `ClassIndex` — PK `classId` (HASH) + SK `createdAt` (RANGE), ALL projection. GSI 2: `ClassDueDateIndex` — PK `classId` (HASH) + SK `dueDate` (RANGE), ALL projection.

**Step 3 — Add LearnfyraStudentAssignmentStatus-local table (M5-INF-003)**
PK = `PK` (HASH), SK = `SK` (RANGE). GSI 1: `StudentIndex` — PK `studentId` (HASH) + SK `assignmentId` (RANGE), ALL projection. GSI 2: `ClassAssignmentIndex` — PK `classId` (HASH) + SK `assignmentId` (RANGE), ALL projection. Both GSIs are mandatory from day one — do not defer.

**Step 4 — Add LearnfyraParentChildLinks-local table (M5-INF-004)**
PK = `PK` (HASH, value: `USER#{parentId}`), SK = `SK` (RANGE, value: `CHILD#{childId}`). GSI 1: `ChildToParentIndex` — PK `childPK` (HASH, value: `USER#{childId}`) + SK `parentSK` (RANGE, value: `PARENT#{parentId}`), ALL projection.

**Step 5 — Add LearnfyraParentInviteCodes-local table (M5-INF-005)**
PK = `PK` (HASH), SK = `SK` (RANGE). No GSIs. Configure `ttl` as the TTL attribute (DynamoDB TTL configuration is set at the table-level in CDK; the bootstrap script creates the attribute but TTL activation is a CDK/production concern).

**Step 6 — Add LearnfyraReviewQueueItems-local table (M5-INF-015)**
PK = `PK` (HASH), SK = `SK` (RANGE). GSI 1: `ClassPendingIndex` — PK `classId` (HASH) + SK `status` (RANGE), KEYS_ONLY projection.

**Step 7 — Run bootstrap and verify (M5-INF-008 verification)**
Run `node scripts/bootstrap-local-db.js --delete` and confirm all tables are created without error. Run `node --check scripts/bootstrap-local-db.js`.

**Step 8 — Create backend/utils/rbacUtils.js (M5-AUTH-002, M5-AUTH-003)**
Export `verifyTeacherOwnsClass(classId, teacherId, db)`: performs GetItem on `LearnfyraClasses` with `PK = CLASS#{classId}`, `SK = METADATA`; throws with `statusCode = 403` and `error = "NOT_CLASS_OWNER"` if `record.teacherId !== teacherId` or record not found. Export `verifyParentChildLink(parentId, childId, db)`: performs GetItem on `LearnfyraParentChildLinks` with `PK = USER#{parentId}`, `SK = CHILD#{childId}`; throws with `statusCode = 403` and `error = "CHILD_NOT_LINKED"` if record absent or `status !== "active"`. Run `node --check backend/utils/rbacUtils.js`.

**Step 9 — Create backend/utils/inviteCodeUtils.js**
Export `generateInviteCode(length = 6)`: uses character set `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars, no O/0/I/1), cryptographically random via `randomBytes`. Export `generateUniqueInviteCode(db, maxAttempts = 20)`: queries `InviteCodeIndex` GSI via `db.queryByIndex('classes', 'InviteCodeIndex', { inviteCode: code })`; retries on collision; throws after `maxAttempts`. Run `node --check backend/utils/inviteCodeUtils.js`.

**Step 10 — Lambda Authorizer role update (M5-AUTH-001)**
Read `backend/handlers/apiAuthorizerHandler.js` in full. Add `teacher` and `parent` to the set of accepted role values. Verify the role extraction logic reads from the JWT custom attribute (typically `custom:role`). Confirm that route-level restrictions (`requireRole`) will work for all M05 endpoints. Run `node --check backend/handlers/apiAuthorizerHandler.js`.

**Step 11 — DynamoDB adapter composite PK helpers**
Read `src/db/dynamoDbAdapter.js` in full. Add `getByCompositeKey(table, pk, sk)` for direct METADATA record reads. Add `queryByPKPrefix(table, pk, skPrefix)` for ClassMembership queries using `begins_with`. These additions are additive and must not change any existing method signatures. Run `node --check src/db/dynamoDbAdapter.js`.

---

### Phase 2: Class Management Backend

**Step 12 — Rewrite classHandler.js (M5-BE-001 through M5-BE-009)**
Read the existing `backend/handlers/classHandler.js` in full before writing. Replace both existing handler functions. Implement all nine endpoints using the composite PK scheme (`CLASS#{classId}` / `METADATA` and `CLASS#{classId}` / `MEMBER#{studentId}`). Import `verifyTeacherOwnsClass` from `rbacUtils.js` and `generateUniqueInviteCode` from `inviteCodeUtils.js`. The handler dispatcher must route on `event.httpMethod` and the path pattern. Add DELETE to `corsHeaders.Access-Control-Allow-Methods`. Run `node --check backend/handlers/classHandler.js`.

**Step 13 — Wire class routes in server.js**
Read `server.js` from line 939 onward to see the existing `/api/class/*` routes. Add new FRD-spec routes alongside the existing ones (do not remove existing routes yet):
- `POST /api/classes`
- `GET /api/classes`
- `GET /api/classes/:classId`
- `PATCH /api/classes/:classId`
- `DELETE /api/classes/:classId/archive`
- `POST /api/classes/:classId/invite`
- `GET /api/classes/:classId/students`
- `DELETE /api/classes/:classId/students/:studentId`
- `POST /api/classes/:classId/students/:studentId/parent-invite`
- `POST /api/teacher/library`
- `GET /api/teacher/library`
- `DELETE /api/teacher/library/:worksheetId`

Add DELETE to the CORS methods string in `corsHeaders` at the top of `server.js`.

---

### Phase 3: Assignment and Library Backend

**Step 14 — Create assignmentHandler.js (M5-BE-010, M5-BE-014 through M5-BE-020)**
New file. The handler covers both teacher assignment management and student assignment views. Implement all endpoints in dependency order: student join first (M5-BE-010) because assignment creation (M5-BE-014) requires the join flow to be defined. Key implementation notes:
- `POST /student/classes/join`: query `InviteCodeIndex` GSI, handle `ALREADY_ENROLLED` (409), handle removed-student rejoin (UpdateItem existing membership, do not create duplicate), batch-write `StudentAssignmentStatus` for all active assignments in the class.
- `POST /assignments`: verify class ownership, verify `worksheetId` exists via GetItem (no AI call — hard constraint from FR-T-023), validate `openAt` before `closeAt`, validate `retakeLimit` when `retakePolicy = "limited"`, batch-write `StudentAssignmentStatus` records for all enrolled students.
- `DELETE /assignments/{assignmentId}/close`: batch UpdateItem for all `not-started` and `in-progress` `StudentAssignmentStatus` records.

Run `node --check backend/handlers/assignmentHandler.js`.

**Step 15 — Wire assignment and student routes in server.js**
Add:
- `POST /api/student/classes/join`
- `GET /api/student/assignments`
- `GET /api/student/assignments/:assignmentId`
- `POST /api/assignments`
- `GET /api/assignments/:assignmentId`
- `PATCH /api/assignments/:assignmentId`
- `GET /api/classes/:classId/assignments`
- `DELETE /api/assignments/:assignmentId/close`

**Step 16 — Confirm or add savedBy GSI on Worksheet table (M5-BE-012)**
Read the Worksheet table definition in the bootstrap script and the DynamoDB adapter. If `savedBy-index` GSI is absent, add it to the bootstrap script. Add `POST /teacher/library` and `GET /teacher/library` logic to `classHandler.js` (these operate on the Worksheet table, not the Classes table, but the handler file was designated in the technical design for these routes).

---

### Phase 4: M04 Integration

**Step 17 — Confirm WorksheetAttempt assignmentId field (M5-BE-036)**
Read the WorksheetAttempt write path in `submitHandler.js` and the bootstrap script. Confirm whether `assignmentId` is already written to `WorksheetAttempt` records. If absent, add it as a nullable field to the write path.

**Step 18 — Extend solveHandler.js (M5-BE-021)**
Read `backend/handlers/solveHandler.js` in full before writing. Add the following at the top of the request handling path (before the existing logic):
1. Check for `assignmentId` in `event.queryStringParameters`.
2. If present: GetItem on `LearnfyraAssignments`, verify `status = "active"`, enforce `openAt`/`closeAt` window.
3. Enforce retake policy: query `WorksheetAttempt` by `studentId` + `assignmentId` to count prior submitted attempts.
4. GetItem `StudentAssignmentStatus` by `ASSIGNMENT#{assignmentId}` / `STUDENT#{studentId}`.
5. UpdateItem `StudentAssignmentStatus` to `status = "in-progress"`, `attemptId = newAttemptId`.
6. Pass `mode` and `timeLimit` from Assignment record to the solve session response.
All existing logic for sessions without `assignmentId` must be entirely unchanged. Run `node --check backend/handlers/solveHandler.js`.

**Step 19 — Extend submitHandler.js (M5-BE-022)**
Read `backend/handlers/submitHandler.js` in full before writing. After the existing scoring call, check if the `WorksheetAttempt` record carries an `assignmentId`. If it does:
1. UpdateItem `StudentAssignmentStatus`: `status = "submitted"`, `score = totalScore`, `submittedAt = now`.
2. Pass `classId` and `assignmentId` to the scoring engine for `ReviewQueueItem` creation.
Existing non-assignment submission path must be entirely unchanged. Run `node --check backend/handlers/submitHandler.js`.

---

### Phase 5: Review Queue

**Step 20 — Extend scorer.js (M5-BE-025)**
Read `src/solve/scorer.js` in full before writing. Add a post-scoring step that checks each `short-answer` result. If `systemConfidenceScore < REVIEW_CONFIDENCE_THRESHOLD` (default 0.75, configurable via `LearnfyraConfig` GetItem) and assignment context (`classId`, `assignmentId`) is present in the scoring context parameter, write a `ReviewQueueItem` record to `LearnfyraReviewQueueItems`. The item includes: `reviewId` (UUID), `classId`, `assignmentId`, `studentId`, `attemptId`, `questionNumber`, `questionText`, `studentAnswer`, `expectedAnswer`, `systemConfidenceScore`, `currentScore`, `pointsPossible`, `status = "pending"`, `createdAt`. Run `node --check src/solve/scorer.js`.

**Step 21 — Create reviewQueueHandler.js (M5-BE-023, M5-BE-024)**
New file. Two endpoints:
- `GET /classes/{classId}/review-queue`: query `ClassPendingIndex` GSI (KEYS_ONLY), then `BatchGetItem` for full attributes. Verify class ownership before returning. Include `pendingCount`.
- `POST /review-queue/{reviewId}/resolve`: GetItem `ReviewQueueItem` by `REVIEW#{reviewId}` / `METADATA`. Verify `ReviewQueueItem.classId` is owned by the teacher (delegate to `verifyTeacherOwnsClass`). Check `status !== "resolved"` — return 409 if already resolved. Execute `TransactWriteItems` with all four writes: (1) ReviewQueueItem resolved, (2) WorksheetAttempt score updated, (3) UserProgress topic accuracy recalculated, (4) StudentAssignmentStatus score updated.

Run `node --check backend/handlers/reviewQueueHandler.js`.

**Step 22 — Wire review queue routes in server.js**
Add:
- `GET /api/classes/:classId/review-queue`
- `POST /api/review-queue/:reviewId/resolve`

---

### Phase 6: Analytics

**Step 23 — Extend analyticsHandler.js (M5-BE-026, M5-BE-027, M5-BE-028)**
Read `backend/handlers/analyticsHandler.js` in full before writing. The existing handler routes (`GET /api/analytics/class/:id` and `GET /api/analytics/student/:id`) must be preserved exactly as-is. Add three new endpoint handlers in the same file:

- `handleClassAnalytics(classId, decoded, db)`: query `ClassAssignmentIndex` GSI for all `StudentAssignmentStatus` records in the class. Compute `averageScorePerAssignment` by grouping on `assignmentId`. Compute `completionRate` as `submitted / (total - overdue)`. Read `UserProgress` records per student for `weakestTopics` (topics ranked by lowest class-average accuracy). Compute `studentsBelowThreshold` using `class.accuracyThreshold` (default 60). No scans anywhere in this code path.

- `handleHeatmap(classId, decoded, db)`: query ClassMembership records for all active students. For each student, GetItem `UserProgress`. Build 2D matrix: rows = `studentId`, columns = unique curriculum topics from `UserProgress` records, cells = accuracy percentage or `null`. Include `studentNames` map for display.

- `handleStudentDrillDown(classId, studentId, decoded, db)`: verify teacher owns class, verify student is enrolled (GetItem ClassMembership), delegate to the M04 `UserProgress` read path.

Update the handler dispatcher to route to the new functions for the new paths. Run `node --check backend/handlers/analyticsHandler.js`.

**Step 24 — Wire analytics routes in server.js**
Add:
- `GET /api/classes/:classId/analytics`
- `GET /api/classes/:classId/analytics/heatmap`
- `GET /api/classes/:classId/students/:studentId/progress`

---

### Phase 7: Parent Backend

**Step 25 — Create parentHandler.js (M5-BE-029 through M5-BE-033)**
New file. Five endpoints. Key implementation details:
- `POST /parent/link`: follow the four-step validation sequence exactly as defined in Technical Design Section 2.5. Use `UpdateItem` with `ConditionExpression: attribute_exists(PK) AND used = :false` — not a GetItem followed by PutItem (race condition risk).
- `GET /parent/children`: primary key query `PK = USER#{parentId}`, filter `status = "active"`.
- `DELETE /parent/children/{studentId}`: verify active link exists first (return 403 not 404), then UpdateItem `status = "revoked"`.
- `GET /parent/children/{studentId}/progress`: call `verifyParentChildLink` first (always return 403 CHILD_NOT_LINKED — never 404). Aggregate `WorksheetAttempt` records for `last7Days`/`last30Days`. Read `UserProgress` for `needsAttention` (topics with accuracy < 60% across 3+ attempts).
- `GET /parent/children/{studentId}/assignments`: call `verifyParentChildLink` first. Query `StudentIndex` GSI on `StudentAssignmentStatus`. Evaluate overdue lazily (dueDate < now AND status != submitted).

Run `node --check backend/handlers/parentHandler.js`.

**Step 26 — Extend studentHandler.js (M5-BE-034)**
Read `backend/handlers/studentHandler.js` in full before writing. Add `handleGenerateParentInvite(decoded, db)`:
1. GetItem Users record for `decoded.sub` to read `activeParentInviteCode`.
2. If non-null and prior code exists: conditional UpdateItem on `INVITE#{old_code}` to set `used = true`.
3. Write new `ParentInviteCode` record with `ttl = Math.floor(Date.now() / 1000) + 172800`.
4. UpdateItem Users record with new `activeParentInviteCode` string.
Return code string and `expiresAt`. Run `node --check backend/handlers/studentHandler.js`.

**Step 27 — Add role upgrade endpoint (M5-BE-035)**
Read `backend/handlers/authHandler.js` in full. If a `POST /user/role/upgrade` route does not exist, add it to `authHandler.js` (or create a thin `roleHandler.js` if `authHandler.js` is too large). Logic: validate new role is `teacher` or `parent`. Check current role: if current role is `teacher` and requested role is `student`, return 403 `ROLE_DOWNGRADE_NOT_PERMITTED`. UpdateItem Users table. Update Cognito custom attribute via `AdminUpdateUserAttributes` if `APP_RUNTIME=aws`. Run `node --check` on the modified file.

**Step 28 — Wire parent and role routes in server.js**
Add:
- `POST /api/parent/link`
- `GET /api/parent/children`
- `DELETE /api/parent/children/:studentId`
- `GET /api/parent/children/:studentId/progress`
- `GET /api/parent/children/:studentId/assignments`
- `POST /api/student/parent-invite`
- `POST /api/user/role/upgrade`

---

### Phase 8: Tests

**Step 29 — rbacUtils.test.js and inviteCodeUtils.test.js (M5-TEST-011)**
Unit tests for both utility files. Mock the DynamoDB adapter. Test ownership check with matching teacher (pass), non-matching teacher (403), and non-existent class (403). Test parent-child link with active link (pass), revoked link (403), no link (403). Test invite code generation: assert character set contains no O, 0, I, 1 characters. Test collision detection regenerates on conflict. Test 403 (not 404) for all unlinked child access paths.

**Step 30 — classHandler.test.js (M5-TEST-001)**
Test all eight implemented endpoints. Use mock Lambda events. Key assertions: POST /classes returns `classId` and `inviteCode`; invite code contains only characters from the 32-char set; collision on first attempt triggers regeneration. GET /classes returns only active classes for the authenticated teacher. Archive returns 409 if class already archived. Non-owner returns 403 NOT_CLASS_OWNER. Test className boundary: 1 char (pass), 100 chars (pass), 101 chars (400).

**Step 31 — assignmentHandler.test.js (M5-TEST-004) and student join tests (M5-TEST-002)**
Test all assignment configuration combinations. Test validation: `openAt` after `closeAt` rejected, `timeLimit` below 60s rejected, `retakeLimit` required when `retakePolicy = "limited"`. Test `StudentAssignmentStatus` batch write on assignment creation. Test `POST /student/classes/join`: valid join, invalid code (404), already enrolled (409), removed student rejoin (200, updates existing record). Test `StudentAssignmentStatus` records created for all active assignments on join.

**Step 32 — solveHandlerAssignment.test.js and submitHandlerAssignment.test.js (M5-TEST-005)**
Test assignment-scoped solve: mode = "test" hides per-question feedback. Test `timeLimit` enforcement. Test `retakePolicy = "once"` rejects second submission. Test `retakePolicy = "limited"` rejects after `retakeLimit` reached. Test `openAt`/`closeAt` enforcement. Test non-assignment paths are entirely unchanged. Test `StudentAssignmentStatus` transitions: `not-started` → `in-progress` on solve start, `in-progress` → `submitted` on submit.

**Step 33 — reviewQueueHandler.test.js and scorerReviewQueue.test.js (M5-TEST-006, M5-TEST-007)**
Test `ReviewQueueItem` is written when confidence < 0.75. Test no item written when confidence >= 0.75. Test no item written when assignment context is absent. Test review queue listing returns only pending items for owned class. Test approve action: ReviewQueueItem resolved, no score change in WorksheetAttempt. Test override action: four-write cascade is complete — verify WorksheetAttempt total, UserProgress accuracy, and StudentAssignmentStatus score are all updated. Test 403 for non-owner class item. Test 409 for already-resolved item.

**Step 34 — analyticsHandler.test.js (M5-TEST-008)**
Test class overview: correct `averageScore`, `completionRate`, `weakestTopics` (ranked lowest first), `studentsBelowThreshold` at default 60% threshold and at a custom threshold. Test heatmap: correct matrix dimensions, null cells for topics with no data. Test 403 for non-owner. Test boundary: 1 student class (minimum), 200 student class (SLA assertion — mock 200 DynamoDB items, assert response time < 300ms in test environment).

**Step 35 — parentHandler.test.js (M5-TEST-009)**
Test POST /parent/link: valid code success, expired code (410 — must return 410 even if item still in DynamoDB), already-used code (409), not-found code (404). Test concurrent consumption simulation (mock `ConditionalCheckFailedException` → 409). Test 403 CHILD_NOT_LINKED for all unlinked studentId requests — verify response body is identical for existing-but-unlinked vs non-existent IDs (enumeration prevention). Test revoked link treated as no link.

**Step 36 — integration tests (M5-TEST-013, M5-TEST-014, M5-TEST-015)**
- `teacherFlow.test.js`: teacher creates class, student joins via invite code, teacher creates assignment, student starts assignment-scoped solve session, student submits, verify `StudentAssignmentStatus` transitions end-to-end, teacher views analytics with correct `completionRate`.
- `reviewQueueFlow.test.js`: student submits short-answer below confidence threshold, `ReviewQueueItem` created, teacher resolves with override, verify cascade is complete and consistent across all four tables.
- `parentFlow.test.js`: student-initiated and teacher-initiated invite flows, parent consumes code, `ParentChildLink` written, parent views assignments and progress, verify 403 on revoked link, verify expired code returns 410.

**Step 37 — Security boundary tests (M5-TEST-018)**
Verify GET /parent/children/{studentId}/progress, GET /parent/children/{studentId}/assignments, and GET /student/assignments/{assignmentId} all return 403 (not 404) for IDs that exist in DynamoDB but are not linked to the authenticated user. Assert the response body is identical for existing-but-unlinked vs non-existent IDs.

**Step 38 — Run full test suite and coverage check**
Run `npm test` and `npm run test:coverage`. Coverage must remain at or above 80% overall. Fix any regressions in existing M01–M04 tests caused by the solveHandler and submitHandler changes.

---

### Phase 9: Frontend (blocked on UI template)

**Step 39 — Frontend scaffolding (unblock when UI template received)**
When the product owner delivers the UI template, implement all M5-FE-001 through M5-FE-016 tasks in this order: role upgrade flow → teacher dashboard shell → class creation → student join → assignment creation → student assignment list → worksheet library → class assignments list → review queue → analytics overview → topic heatmap → student drill-down → parent dashboard shell → parent link form → parent child progress dashboard → student parent invite code generation.

**Step 40 — CDK Lambda and API Gateway additions (M5-INF-009 through M5-INF-016)**
After all local acceptance criteria pass, notify the IaC agent to add the five new Lambda function definitions to the CDK stack. Required new environment variables for Lambda functions: `CLASSES_TABLE_NAME`, `ASSIGNMENTS_TABLE_NAME`, `STUDENT_ASSIGNMENT_STATUS_TABLE_NAME`, `PARENT_CHILD_LINKS_TABLE_NAME`, `PARENT_INVITE_CODES_TABLE_NAME`, `REVIEW_QUEUE_ITEMS_TABLE_NAME`. Wire all M05 API Gateway routes to their respective Lambda functions. Enable `StreamSpecification` on `LearnfyraUserProgress` table if not already present (M5-INF-006).

---

## 5. Gaps, Conflicts, and Missing Pieces

### 5.1 Classes Table PK Format Conflict

**Severity: Blocker.**

The existing `LearnfyraClasses-local` bootstrap definition uses a flat `classId` hash key. The FRD specifies a composite `PK = CLASS#{classId}` / `SK = METADATA` design. The existing `classHandler.js` writes flat records with key `classId`. Every class record currently in DynamoDB local (dev data) will be inaccessible after the table is replaced.

**Resolution:** The bootstrap script must be updated in Phase 1, Step 1, before any other M05 work. After the bootstrap script is updated, run `--delete` to drop and recreate all tables. Inform the team that local DynamoDB dev data will be cleared. This is acceptable at the pre-production stage.

### 5.2 ClassMembership Separate Table vs Single-Table Design Conflict

**Severity: Blocker.**

The existing bootstrap script creates `LearnfyraClassMemberships-local` as a separate table. The `studentHandler.js` join flow queries `memberships` as a collection name. The `classHandler.js` queries `memberships` by `classId`. The FRD places ClassMembership records inside `LearnfyraClasses` using `SK = MEMBER#{studentId}`.

**Resolution:** Remove `LearnfyraClassMemberships-local` from the bootstrap script (Phase 1, Step 1). Update the `classHandler.js` rewrite (Phase 2, Step 12) and the `assignmentHandler.js` join flow (Phase 3, Step 14) to use the single-table `begins_with MEMBER#` query pattern. Any existing handler code that queries the `memberships` collection must be replaced.

### 5.3 WorksheetAttempt assignmentId Field

**Severity: High.**

The existing bootstrap script defines `LearnfyraWorksheetAttempt-local` with `userId` (HASH) + `sortKey` (RANGE) and no `assignmentId` field. The field is required for `StudentAssignmentStatus` integration (M5-BE-022) and the review queue cascade (M5-BE-024). This is an additive write — no PK change required, no migration needed. However, if the production `WorksheetAttempt` table in DynamoDB was created without this attribute, the attribute simply needs to start being written in the `submitHandler.js` code path. DynamoDB's schema-less design means no table migration is required.

**Resolution:** Confirm in Phase 4, Step 17. If the field is absent from the write path, add it as a nullable string in the `submitHandler.js` WorksheetAttempt write. No bootstrap change is required for DynamoDB (attributes are not declared at creation time for non-key fields).

### 5.4 Worksheet savedBy GSI

**Severity: Medium.**

`GET /teacher/library` requires a GSI on the Worksheet table keyed on `savedBy`. The technical design notes this as a "confirm or add" task (M5-BE-012). If the M02/M03 CDK construct did not provision this GSI, adding it retroactively requires a CDK redeploy and DynamoDB GSI backfill in production (which causes a brief performance degradation window).

**Resolution:** Check the M02/M03 bootstrap script for `LearnfyraWorksheets` table definition. If the GSI is absent, add it to the bootstrap script in Phase 3, Step 16. Notify the IaC agent to add the GSI to the CDK construct before the next production deploy. For local dev, re-run the bootstrap script with `--delete` to pick up the new GSI.

### 5.5 UserProgress DynamoDB Streams for Review Queue Cascade

**Severity: Medium (Phase 2 concern).**

M5-INF-006 requires `StreamViewType: NEW_AND_OLD_IMAGES` on `LearnfyraUserProgress`. This is needed for Phase 2 email notifications (out of scope for M05 Phase 1) but must be enabled now to avoid a table migration later. Enabling Streams on an existing table does not require data migration and does not degrade performance. However, if the M04 CDK construct did not include `StreamSpecification`, the CDK redeploy must happen before the Phase 2 notification feature begins development.

**Resolution:** Confirm with the IaC agent whether `StreamSpecification` is already present in the M04 CDK construct. If absent, add it in the Sprint 1 CDK work. This is a zero-risk change for Phase 1 functionality.

### 5.6 ReviewQueueItem Storage — Scorer Context Requirement

**Severity: Medium.**

`src/solve/scorer.js` currently does not receive `classId` or `assignmentId` as input parameters. Adding `ReviewQueueItem` creation requires the scoring context to include these fields. The scorer function signature must be extended with an optional `assignmentContext: { classId, assignmentId }` parameter. When absent (non-assignment submissions), no `ReviewQueueItem` is written. This is an additive change but the exact function signature must be confirmed by reading the scorer in Phase 5, Step 20 before modifying.

### 5.7 CORS Methods Gap

**Severity: Low but blocks testing.**

`server.js` `corsHeaders` currently only allows `GET,POST,PATCH,OPTIONS`. M05 introduces `DELETE /classes/{classId}/archive`, `DELETE /classes/{classId}/students/{studentId}`, `DELETE /assignments/{assignmentId}/close`, and `DELETE /parent/children/{studentId}`. All `DELETE` requests from the browser will be blocked by CORS preflight until `DELETE` is added to `corsHeaders.Access-Control-Allow-Methods`.

**Resolution:** Add `DELETE` to the `corsHeaders` object at the top of `server.js` in Phase 2, Step 13 when class routes are wired.

### 5.8 Prior Invite Code Invalidation — Users Table Dependency

**Severity: Low.**

The recommended approach for student-initiated parent invite invalidation (Technical Design Section 2.5) requires storing `activeParentInviteCode` on the Users record. The existing Users table schema (from bootstrap) may not have this field. As with `assignmentId` on `WorksheetAttempt`, DynamoDB does not require field pre-declaration — the field simply needs to be written when the first code is generated. However, the `verifyParentChildLink` reads a Users record; confirm the `getItem('users', userId)` path is compatible with the DynamoDB adapter.

---

## 6. Risk Assessment

### Risk 1: Single-Table Migration Breaks Existing Local Dev Data

**Probability:** High — the bootstrap change is mandatory and destructive to existing local data.
**Impact:** Medium — dev data loss causes inconvenience but no production impact.
**Mitigation:** Document the `--delete` flag requirement prominently. Add a note to the bootstrap script header that the M05 version is incompatible with pre-M05 local data. Provide seed data scripts for the most common dev scenarios (one teacher with one class and two students) so developers can repopulate quickly after the table reset. This seed data script can be created alongside the bootstrap update in Phase 1, Step 1.

### Risk 2: Analytics 300ms SLA Failure at Scale

**Probability:** Medium — the heatmap requires per-student `UserProgress` reads that can become N+1 queries for 200-student classes without careful batching.
**Impact:** High — SLA breach is a FRD Must requirement. Failure here blocks release.
**Mitigation:** The analytics handler must use `BatchGetItem` (max 100 items per call) for `UserProgress` reads, not individual GetItem calls per student. For 200 students this requires two `BatchGetItem` calls. DynamoDB local has no latency modelling, so performance testing must be run against actual DynamoDB (dev environment) before Sprint 4 ends. If the 300ms SLA is at risk, consider adding an `analyticsCache` field to the Class record updated by a background write-through on every `StudentAssignmentStatus` change (Phase 2 optimization).

### Risk 3: Atomic Invite Code Consumption Race Condition

**Probability:** Low in production (requires two simultaneous requests with the same code) but a test-critical case.
**Impact:** High — data corruption if two `ParentChildLink` records are written for the same code.
**Mitigation:** Use `TransactWriteItems` or `UpdateItem` with `ConditionExpression: used = :false` (not GetItem + PutItem) as specified in Technical Design Section 3.2. Write a unit test that mocks `ConditionalCheckFailedException` to verify the 409 response path. Do not accept a code review that uses GetItem + conditional PutItem — only the conditional UpdateItem is acceptable.

### Risk 4: Review Queue Cascade Partial Failure

**Probability:** Low — DynamoDB Transactions are reliable but have a 25-item limit and a cost multiplier.
**Impact:** High — partial cascade leaves student score data inconsistent across four tables.
**Mitigation:** Use `TransactWriteItems` for the four-write cascade as recommended in Technical Design Section 2.6. This provides all-or-nothing atomicity at the cost of 2x read/write capacity units. For Phase 1 with four records per transaction, this is well within the 25-item limit and cost is acceptable. Document in code comments that this is the reason for using transactions. If the TransactWriteItems call fails, return 500 with `error = "OVERRIDE_FAILED"` — do not return 200 with a partial cascade.

### Risk 5: Frontend Blocked on UI Template

**Probability:** High — the sprint plan explicitly notes all frontend tasks are blocked until the UI template is received from the product owner.
**Impact:** Medium — blocks frontend delivery but does not block backend or test delivery.
**Mitigation:** The backend-first approach means all API endpoints are complete and tested before any frontend work begins. The frontend engineer works on backend integration tests (M5-TEST-001, M5-TEST-002, M5-AUTH-001) during the block period. API contracts must be agreed and documented (Section 9 of FRD) before Week 3 so the frontend engineer can begin as soon as the template arrives. If the template is delayed beyond Sprint 3, consider building the teacher dashboard with a temporary design to unblock QA end-to-end testing.

---

## 7. Definition of Done

Module 5 is complete when all of the following are true:

### Backend
- All P1 endpoints listed in Section 2 respond correctly to valid requests with the exact status codes, error codes, and response shapes specified in the technical design API section.
- All P1 endpoints return 403 (not 404) for enumeration-prevention cases: non-owned class access, unlinked child access, unassigned student assignment access.
- Invite code character set contains no O, 0, I, 1 characters. Verified by unit test asserting all generated codes match `/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/`.
- `POST /parent/link` uses DynamoDB conditional update with `ConditionExpression: used = :false`. Concurrent consumption returns 409 for the second request. Verified by unit test mocking `ConditionalCheckFailedException`.
- Review queue cascade (Step 21) uses `TransactWriteItems`. All four records are updated atomically on override. Verified by integration test (M5-TEST-014).
- `GET /classes/{classId}/analytics` and `GET /classes/{classId}/analytics/heatmap` return correct data for a class with 1 student (boundary) and a mocked class with 200 students. Response time assertion passes in the test suite.
- No DynamoDB Scan operations in any M05 handler. Verified by code review: every DynamoDB call uses GetItem, Query (with KeyConditionExpression), BatchGetItem, UpdateItem, PutItem, or TransactWriteItems.
- `solveHandler.js` and `submitHandler.js`: all existing non-assignment tests pass without modification. New assignment-path tests pass.
- `node --check` passes on all modified and created files.

### Data
- Bootstrap script creates all M05 tables including `LearnfyraReviewQueueItems-local` with `ClassPendingIndex` GSI (KEYS_ONLY projection).
- `LearnfyraStudentAssignmentStatus-local` has both `StudentIndex` and `ClassAssignmentIndex` GSIs provisioned at table creation.
- `LearnfyraParentInviteCodes-local` has `ttl` as the designated TTL attribute (confirmed via CDK for production; noted in bootstrap comments for local).
- `WorksheetAttempt` records written by the updated `submitHandler.js` include the `assignmentId` field when an assignment context is present.
- Worksheet records updated by `POST /teacher/library` include `savedBy` and `savedAt` fields.

### Tests
- All unit tests in `tests/unit/` pass: `npm test`.
- Integration tests pass: `teacherFlow.test.js`, `reviewQueueFlow.test.js`, `parentFlow.test.js`.
- Coverage at or above 80%: `npm run test:coverage`.
- Security boundary tests (M5-TEST-018) pass: 403 returned (not 404) for all enumeration-prevention cases.
- No existing M01–M04 tests are broken.

### Security
- No student PII (name, email, grade) appears in CloudWatch Logs. All log entries use opaque identifiers only (userId, classId, assignmentId).
- All parent endpoints return 403 CHILD_NOT_LINKED for revoked links — identical response to no link.
- Role downgrade from teacher to student returns 403 ROLE_DOWNGRADE_NOT_PERMITTED.

### API Contracts
- API contracts for all M05 endpoints documented and agreed before Week 3 of Sprint 2 (per sprint plan pre-condition).
- All Express routes in `server.js` and Lambda handler dispatchers respond to the FRD-specified paths.

### Frontend
- All M5-FE-001 through M5-FE-016 tasks complete and passing (contingent on UI template delivery).
- Heatmap cells include tooltip or accessible label with numeric accuracy value (WCAG 2.1 AA — FR-NFR from requirements analysis Section 3.3).
- Review queue pending count badge is screen-reader accessible.
- Child-switcher is keyboard-navigable.

### Infrastructure (P2 — required before production deploy, not required for local-done)
- CDK stack defines all five M05 Lambda functions with correct memory, timeout, and environment variables.
- All five M05 DynamoDB tables provisioned in CDK with correct GSIs, TTL attribute, and PITR enabled on prod.
- DynamoDB Streams enabled on `LearnfyraUserProgress` table.
- CloudWatch alarms defined for all five M05 Lambda functions (error rate > 1%, p99 latency > 500ms, analytics > 2s).
- `cdk synth` passes with zero warnings.
