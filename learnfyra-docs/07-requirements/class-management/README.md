# M06 Class Management — Requirements Spec
**Module:** M06
**Status:** Pending Implementation
**Version:** 1.1
**Last Updated:** 2026-03-28

---

## Overview

M06 manages the relationships between teachers, students, and parents on Learnfyra. It enables teachers to create named classes, generate 6-character join codes, assign worksheets to classes with due dates, and view class rosters with performance summaries. Students join classes using a join code and can see their pending assignments. Parents link to a student account (with student confirmation) to access the child's progress dashboard. M06 is a pure backend module; frontend UI for classes and dashboards is planned for a subsequent phase.

---

## User Stories

### US-M06-001: Teacher Creates a Class
**As a** teacher
**I want to** create a named class with an optional grade and subject focus
**So that** I have a roster to which I can add students and assign worksheets
**Priority:** P0

### US-M06-002: Student Joins a Class Using a Join Code
**As a** student
**I want to** enter a 6-character join code provided by my teacher
**So that** I am added to that class and can receive assignments
**Priority:** P0

### US-M06-003: Teacher Assigns a Worksheet to a Class
**As a** teacher
**I want to** select a generated worksheet and assign it to one of my classes with a due date
**So that** all enrolled students see it as a pending assignment
**Priority:** P0

### US-M06-004: Student Views Pending Assignments
**As a** student
**I want to** see a list of worksheets my teachers have assigned to my classes
**So that** I know what I need to complete and by when
**Priority:** P0

### US-M06-005: Teacher Views Class Roster and Performance
**As a** teacher
**I want to** see each student's name, average score, last active date, and assignment completion status
**So that** I can identify students who need additional support and track participation
**Priority:** P0

### US-M06-006: Parent Links to Student Account
**As a** parent
**I want to** link my account to my child's student account by providing their email
**So that** after the student confirms, I can view their progress dashboard
**Priority:** P1

### US-M06-007: Teacher Removes a Student from a Class
**As a** teacher
**I want to** remove a student from a class roster
**So that** the student no longer receives assignments from that class
**Priority:** P1

### US-M06-008: Teacher Archives a Class
**As a** teacher
**I want to** archive a class at the end of a term
**So that** it no longer appears in active views while historical data is preserved
**Priority:** P2

---

## Functional Requirements

### REQ-M06-001: Create Class (POST /api/classes)
**Priority:** P0
**Tasks:** M06-BE-01

`backend/handlers/classHandler.js` SHALL handle `POST /api/classes`. Auth: Bearer token, teacher role required.

The handler SHALL:
1. Validate the request: `name` is required (string, 1–100 characters). `grade` (integer 1–10) and `subject` (enum: Math / ELA / Science / Social Studies / Health) are optional.
2. Generate a UUID v4 `classId`.
3. Generate a 6-character alphanumeric join code (`joinCode`) using uppercase letters and digits (A–Z, 0–9). The code SHALL be unique — the handler SHALL check `LearnfyraClasses-{env}` for an existing class with the same `joinCode` before writing, regenerating if a collision occurs (collision is statistically rare but must be handled).
4. Write a record to `LearnfyraClasses-{env}` with `teacherId` set from the JWT `userId` claim, `studentCount: 0`, and `archivedAt` absent.
5. Return the response per `04-api-contracts/reporting-api.md`.

The Lambda Authorizer enforces the `teacher` role. If the JWT role is not `teacher`, API Gateway returns 403 before the handler is invoked.

### REQ-M06-002: List My Classes (GET /api/classes/me)
**Priority:** P0
**Tasks:** M06-BE-02

`classHandler.js` SHALL handle `GET /api/classes/me`. Auth: Bearer token, student or teacher role.

For a **teacher**: Query `LearnfyraClasses-{env}` using `teacherId-index` GSI with `teacherId = JWT.userId`. Return all non-archived classes sorted by `createdAt` descending.

For a **student**: Query `LearnfyraClassMemberships-{env}` using `studentId-index` GSI with `studentId = JWT.userId`, filtering on `status = "active"`. Batch-fetch the corresponding `LearnfyraClasses-{env}` records. For each class, compute `pendingAssignments` by counting assignments where `dueDate > now` that the student has not yet submitted a `WorksheetAttempt` for. Return the response per `04-api-contracts/reporting-api.md`.

### REQ-M06-003: Join Class by Code (POST /api/classes/join)
**Priority:** P0
**Tasks:** M06-BE-03

`classHandler.js` SHALL handle `POST /api/classes/join`. Auth: Bearer token, student role required.

The handler SHALL:
1. Validate the request: `joinCode` is required (6-character alphanumeric string, uppercase).
2. Scan or query `LearnfyraClasses-{env}` for a class with the matching `joinCode` that is not archived.
3. If no match: return 404 with code `INVALID_JOIN_CODE`.
4. Check `LearnfyraClassMemberships-{env}` for an existing active membership record (PK=classId, SK=studentId). If found: return 409 with code `ALREADY_ENROLLED`.
5. Write a `ClassMembership` record with `status: "active"` and `joinedAt: ISO-8601`.
6. Increment `studentCount` on the class record using a DynamoDB `UpdateItem` atomic counter.
7. Add `classId` to the student's `classIds` StringSet in `LearnfyraUsers-{env}`.
8. Return the response per `04-api-contracts/reporting-api.md`.

The `joinCode` lookup currently requires a Scan or a table-level filter since there is no GSI on `joinCode`. See Open Questions.

### REQ-M06-004: Get Class Roster (GET /api/classes/:classId/students)
**Priority:** P0
**Tasks:** M06-BE-04

`classHandler.js` SHALL handle `GET /api/classes/:classId/students`. Auth: Bearer token, teacher role, must own the class.

The handler SHALL:
1. Verify the class exists and `teacherId` matches the JWT `userId`. Return 403 with code `NOT_CLASS_OWNER` if not.
2. Query `LearnfyraClassMemberships-{env}` for all active members.
3. Batch-fetch `LearnfyraUsers-{env}` records for all students to retrieve `name`, `email`, `avgScore`, and `lastActive`.
4. For each student, compute `completedAssignments` and `totalAssignments` from assignment records for this class cross-referenced with `WorksheetAttempt` records.
5. Return the response per `04-api-contracts/reporting-api.md`.

### REQ-M06-005: Assign Worksheet to Class (POST /api/classes/:classId/assignments)
**Priority:** P0
**Tasks:** M06-BE-05

`classHandler.js` SHALL handle `POST /api/classes/:classId/assignments`. Auth: Bearer token, teacher role, must own the class.

The handler SHALL:
1. Validate the request: `worksheetId` (UUID v4, required) and `dueDate` (ISO-8601 string, required, must be in the future).
2. Verify class ownership.
3. Verify the `worksheetId` exists in `LearnfyraGenerationLog-{env}` (to ensure the worksheet has not expired or been deleted).
4. Generate a UUID v4 `assignmentId`.
5. Write an assignment record. Because there is no dedicated Assignments table in the current DynamoDB design, assignments SHALL be stored as items in `LearnfyraClasses-{env}` using a composite sort key pattern OR in a new `LearnfyraAssignments-{env}` table. See Open Questions for the pending decision.
6. Return the response per `04-api-contracts/reporting-api.md`.

### REQ-M06-006: Remove Student from Class (DELETE /api/classes/:classId/students/:studentId)
**Priority:** P1
**Tasks:** M06-BE-01 (extends classHandler.js)

The handler SHALL:
1. Verify class ownership (teacher role, `teacherId` matches JWT `userId`). Return 403 if not.
2. Update the `ClassMembership` record to `status: "removed"`, set `removedAt: ISO-8601`.
3. Decrement `studentCount` on the class record.
4. Remove `classId` from the student's `classIds` StringSet in `LearnfyraUsers-{env}`.
5. Preserve all existing `WorksheetAttempt` records for the student — historical data is not deleted.
6. Return 200 with `{ message: "Student removed from class" }`.

### REQ-M06-007: Archive Class
**Priority:** P2
**Tasks:** (not yet in master-task-list; to be added when prioritized)

The handler SHALL accept `PATCH /api/classes/:classId` with body `{ archived: true }`. Auth: Bearer token, teacher role, must own class. It SHALL set `archivedAt` to the current ISO-8601 timestamp. Archived classes SHALL be excluded from `GET /api/classes/me` for both teachers and students. Historical `WorksheetAttempt` and `ClassMembership` records are preserved.

### REQ-M06-008: Parent-Child Link (POST /api/auth/link-child)
**Priority:** P1
**Tasks:** M01-BE-07 (DONE — this requirement documents the cross-module behavior that M06 depends on)

This endpoint is implemented in `authHandler.js` (M01-BE-07, already done). The M06 requirement is that after confirmation:
- The parent's `LearnfyraUsers-{env}` record has `linkedStudentId` set to the student's `userId`.
- The student's `LearnfyraUsers-{env}` record has the parent's `userId` added to the `linkedParentIds` StringSet.
- A student can have at most 2 linked parents in Phase 1.
- If the student already has 2 linked parents, the link request SHALL return 409 with code `MAX_PARENTS_REACHED`.

### REQ-M06-009: joinCode Generation Rules
**Priority:** P0
**Tasks:** M06-BE-01

Join codes SHALL:
- Be exactly 6 characters long.
- Use only uppercase letters (A–Z) and digits (0–9) — no ambiguous characters (no O, 0, I, 1 by convention to reduce student input errors; see Open Questions).
- Be unique across all non-archived classes in the same environment.
- Be stored as a plain string in DynamoDB (not hashed).
- Not be reused when a class is archived (a new class always gets a freshly generated code).

---

## Acceptance Criteria

### AC-M06-001: Teacher Creates Class and Receives Join Code
**Given** an authenticated teacher calls `POST /api/classes` with `{ name: "Period 3 Math", grade: 5, subject: "Math" }`
**When** the handler processes the request
**Then** a `classId` (UUID v4) and a 6-character alphanumeric `joinCode` are returned, a record exists in `LearnfyraClasses-{env}`, and `studentCount` is 0

### AC-M06-002: Student Joins Class with Valid Code
**Given** a class exists with `joinCode: "AB3X7K"` and a student calls `POST /api/classes/join` with `{ joinCode: "AB3X7K" }`
**When** the handler processes the request
**Then** a `ClassMembership` record is written with `status: "active"`, the class's `studentCount` is incremented by 1, and the response includes `classId`, `className`, and `teacherName`

### AC-M06-003: Duplicate Enrollment Rejected
**Given** a student is already enrolled in class X
**When** the same student calls `POST /api/classes/join` with the same join code again
**Then** the response is 409 with code `ALREADY_ENROLLED` and no duplicate membership record is created

### AC-M06-004: Invalid Join Code Returns 404
**Given** a student calls `POST /api/classes/join` with a code that matches no active class
**When** the handler processes the request
**Then** the response is 404 with code `INVALID_JOIN_CODE`

### AC-M06-005: Teacher Assigns Worksheet to Class
**Given** a teacher owns a class with 3 enrolled students and calls `POST /api/classes/{classId}/assignments` with a valid `worksheetId` and future `dueDate`
**When** the assignment is created
**Then** an assignment record is written, an `assignmentId` is returned, and `GET /api/classes/me` for each enrolled student returns `pendingAssignments: 1`

### AC-M06-006: Teacher Cannot Manage Another Teacher's Class
**Given** teacher A calls any management endpoint for a class owned by teacher B
**When** the ownership check runs
**Then** the response is 403 with code `NOT_CLASS_OWNER`

### AC-M06-007: Student Removed — Historical Data Preserved
**Given** a teacher removes student S from class C
**When** `DELETE /api/classes/{C}/students/{S}` completes
**Then** the student's `ClassMembership` record has `status: "removed"`, the student no longer appears in `GET /api/classes/me`, and all existing `WorksheetAttempt` records for that student remain in DynamoDB

### AC-M06-008: Archived Class Not Visible to Students
**Given** a teacher archives class C
**When** an enrolled student calls `GET /api/classes/me`
**Then** class C is absent from the `classes` array in the response

### AC-M06-009: Non-Teacher Cannot Create a Class
**Given** a student JWT is used to call `POST /api/classes`
**When** the Lambda Authorizer checks the role
**Then** the response is 403 with code `INSUFFICIENT_ROLE` before the handler is invoked

### AC-M06-010: Parent-Child Link — Maximum 2 Parents Per Student
**Given** a student already has 2 linked parents
**When** a third parent calls `POST /api/auth/link-child` referencing that student
**Then** the response is 409 with code `MAX_PARENTS_REACHED`

### AC-M06-011: Join Code Is Unique at Creation
**Given** a join code is randomly generated and collides with an existing active class's `joinCode`
**When** the `POST /api/classes` handler detects the collision
**Then** a new code is generated and the new class is created successfully (no error returned to the caller)

### AC-M06-012: AWS Deployment — DynamoDB Tables Provisioned
**Given** `M06-CDK-001` completes and provisions `LearnfyraClasses-{env}` and `LearnfyraClassMemberships-{env}`
**When** `POST /api/classes`, `POST /api/classes/join`, and `GET /api/classes/me` are called in the dev environment
**Then** all three endpoints return correct responses and DynamoDB records are verifiable via the AWS Console

---

## Local Development Requirements

This section applies before any AWS work begins. All acceptance criteria above MUST pass on `http://localhost:3000` with `dynamodb-local` before any Lambda deployment or CDK work begins for M06.

### Prerequisite: M01 Auth Backend (Already Done)
M06 requires valid teacher and student JWTs. The M01 auth backend is already done, including the local auth adapter (`APP_RUNTIME=local`). Local JWTs are signed with `LOCAL_JWT_SECRET` — no Cognito calls are needed.

### APP_RUNTIME=local — Cognito and IAM Skipped
When `APP_RUNTIME=local`:
- The Lambda Authorizer middleware uses `LOCAL_JWT_SECRET` to verify JWTs, skipping all Cognito user lookups.
- Role enforcement (teacher vs. student vs. parent) still applies — the JWT `role` claim is checked against `LOCAL_JWT_SECRET`-signed tokens.
- Handlers that reference DynamoDB point to `dynamodb-local` at `http://localhost:8000` when `DB_ENDPOINT` is set.

### DynamoDB Local — Required Before M06 Backend Implementation
Start `dynamodb-local`:
```
docker run -p 8000:8000 amazon/dynamodb-local
```

Create the `LearnfyraClasses` table:
```
aws dynamodb create-table \
  --table-name LearnfyraClasses-local \
  --attribute-definitions \
    AttributeName=classId,AttributeType=S \
    AttributeName=teacherId,AttributeType=S \
  --key-schema AttributeName=classId,KeyType=HASH \
  --global-secondary-indexes '[{
    "IndexName": "teacherId-index",
    "KeySchema": [{"AttributeName": "teacherId", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

Create the `LearnfyraClassMemberships` table:
```
aws dynamodb create-table \
  --table-name LearnfyraClassMemberships-local \
  --attribute-definitions \
    AttributeName=classId,AttributeType=S \
    AttributeName=studentId,AttributeType=S \
  --key-schema \
    AttributeName=classId,KeyType=HASH \
    AttributeName=studentId,KeyType=RANGE \
  --global-secondary-indexes '[{
    "IndexName": "studentId-index",
    "KeySchema": [{"AttributeName": "studentId", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

Both table creation commands are also encapsulated in `scripts/bootstrap-local-db.js` (SETUP-002).

### Environment Variables for Local M06 Development
```
APP_RUNTIME=local
NODE_ENV=development
DB_ENDPOINT=http://localhost:8000
LOCAL_JWT_SECRET=local-dev-secret-change-me
CLASSES_TABLE_NAME=LearnfyraClasses-local
CLASS_MEMBERSHIPS_TABLE_NAME=LearnfyraClassMemberships-local
USERS_TABLE_NAME=LearnfyraUsers-local
```

### Local Test Sequence
Before any AWS work begins, verify the following on `http://localhost:3000`:
1. Start `dynamodb-local` and run `scripts/bootstrap-local-db.js`.
2. Sign in as a teacher (using local JWT) and call `POST /api/classes` — confirm `classId` and `joinCode` returned.
3. Sign in as a student (using local JWT) and call `POST /api/classes/join` with the join code — confirm `status: "active"` in the membership record.
4. Call `GET /api/classes/me` as the student — confirm the class appears with `pendingAssignments: 0`.
5. Call `POST /api/classes/{classId}/assignments` as the teacher — confirm assignment record written.
6. Call `GET /api/classes/me` as the student — confirm `pendingAssignments: 1`.
7. Run `npm test` — all M06 unit tests pass.

### Frontend Template Note
**Awaiting UI template from product owner — do not implement any M06 frontend pages until UI template is received and M06 backend sprint is complete.**

---

## AWS Services Involved

| Service | Role |
|---|---|
| DynamoDB (`LearnfyraClasses-{env}`) | Stores class records. GSI: `teacherId-index` on `teacherId`. Task M06-CDK-001. |
| DynamoDB (`LearnfyraClassMemberships-{env}`) | Stores enrollment records. GSI: `studentId-index` on `studentId`. Task M06-CDK-001. |
| DynamoDB (`LearnfyraUsers-{env}`) | Updated on join (append to `classIds`) and on parent-child link (`linkedStudentId`, `linkedParentIds`). |
| DynamoDB (`LearnfyraGenerationLog-{env}`) | Queried by the assignment handler to verify a `worksheetId` is valid and not expired. |
| Lambda (`learnfyra-class-{env}`) | Handles all `/api/classes/*` endpoints. Timeout: 10 s, memory: 128 MB, ARM_64. |
| API Gateway | Routes M06 endpoints. Lambda Authorizer enforces roles: POST /api/classes requires teacher; POST /api/classes/join requires student. |

---

## File Structure

```
backend/handlers/
  classHandler.js        — all /api/classes/* endpoints

tests/unit/
  classHandler.test.js   — all CRUD operations, join code uniqueness, role enforcement

tests/integration/
  class.test.js          — full flow: create class → student joins → teacher assigns → student sees pending
```

---

## Out of Scope
- Frontend class management UI — API-only in Phase 1.
- Class-level analytics on the student dashboard — that is surfaced through M05 teacher dashboard only.
- Class transfer (changing a class's teacher) — not planned.
- Bulk enrollment (e.g., CSV upload of student emails) — Phase 2.
- Class templates or copying a class from a prior term — Phase 2.
- Student self-removal from a class — teacher-initiated removal only in Phase 1.
- Assignment extensions or per-student due date overrides — Phase 2.
- Notification to students when a new assignment is created — Phase 2.

---

## Dependencies

| Dependency | Status |
|---|---|
| M01-BE-07 (parent-child link endpoint) | DONE |
| M01-BE-01 through M01-BE-06 (auth, JWT authorizer) | DONE |
| `04-api-contracts/reporting-api.md` (frozen M06 endpoints RC-BE-01) | FROZEN |
| CDK-010 (DynamoDB table provisioning) | TODO — M06-CDK-001 blocks Lambda deploy |
| M05-BE-03 (`dashboardHandler`) — reads class and membership tables | TODO — M06 tables must exist before M05 teacher dashboard works |
| `LearnfyraGenerationLog-{env}` table | TODO (CDK-010) — required by assignment handler to validate worksheetId |

---

## Open Questions

1. There is no dedicated GSI on `joinCode` in the current DynamoDB design. The `POST /api/classes/join` lookup must either Scan `LearnfyraClasses-{env}` or use a `FilterExpression` on a Query, both of which are inefficient at scale. Should a `joinCode-index` GSI be added to `LearnfyraClasses-{env}` to make join-code lookup O(1)? Decision needed before M06-CDK-001 is provisioned.
2. Assignments are not yet represented in the DynamoDB design (`03-data-design/dynamodb-design.md`). Three options exist: (a) add a `LearnfyraAssignments-{env}` table (new table, cleanest), (b) store assignments as items in `LearnfyraClasses-{env}` using a composite key, or (c) store them as a list attribute on the class record (limited scalability). A decision is needed before M06-BE-05 can be implemented. This decision also blocks M05-BE-03 (teacher dashboard completion rates).
3. The join code generation convention excludes ambiguous characters (O, 0, I, 1) to reduce student input errors. Should this exclusion be enforced, and if so, what is the exact allowed character set? This affects both the code generator in M06-BE-01 and any frontend input mask built later.
4. Should a student who has been removed from a class (status=removed) be able to re-join the same class using the join code? If yes, the handler must update the existing membership record to `status: "active"` rather than writing a duplicate. If no, the handler must check for removed records and return 409.
5. The `pendingAssignments` count in `GET /api/classes/me` for students requires crossing two tables: the Assignments table (M06 question above) and `LearnfyraWorksheetAttempt`. How should this count be computed efficiently — precomputed on the class membership record, derived at read time, or a separate DynamoDB item per student per assignment?
