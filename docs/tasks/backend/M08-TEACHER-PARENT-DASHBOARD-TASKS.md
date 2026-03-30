# M08: Teacher & Parent Dashboard API — Requirements and Task Board

**Document ID:** LFR-M08-TASKS-001
**Date:** 2026-03-27
**Status:** Requirements Specification — Ready for Implementation
**Effort Mode:** Standard
**Sources:** Teacher & Parent Dashboard.md, module-breakdown-phase1.md, M05-progress-reporting-spec.md, M06-class-relationship-spec.md

---

## Status Legend

| Symbol | Meaning |
|---|---|
| [DONE] | Fully implemented |
| [PARTIAL] | Exists but incomplete |
| [MISSING] | Not implemented |
| not-started | Task not yet begun |

---

## PART 1 — Requirement Baseline

| REQ-DASH-NNN | Requirement | Priority | Status | Acceptance Criteria |
|---|---|---|---|---|
| REQ-DASH-001 | Teacher dashboard must return a summary of all classes the teacher owns | P0 | [MISSING] | Given teacher JWT, When GET /api/dashboard/teacher, Then response contains classes[] with classId, name, grade, studentCount, averageScore, weakTopics[], completionRate for each class |
| REQ-DASH-002 | Teacher dashboard must include upcoming and past assignments per class | P0 | [MISSING] | Given teacher JWT, When GET /api/dashboard/teacher, Then response contains assignments[] per class with worksheetId, dueDate, completedCount, totalStudents, status (UPCOMING/PAST) |
| REQ-DASH-003 | Teacher dashboard must identify weak topics at class level and per student | P1 | [MISSING] | Given teacher JWT, When GET /api/dashboard/teacher, Then each class has weakTopics[] where class accuracy < 60% and each student entry has studentWeakTopics[] |
| REQ-DASH-004 | Parent dashboard must return progress summary for a specific linked child | P0 | [MISSING] | Given parent JWT and linked childId, When GET /api/dashboard/parent/:childId, Then response contains child's recentAttempts[], weakTopics[], averageScore, subjectBreakdown[], progressTimeline[] |
| REQ-DASH-005 | Parent dashboard must enforce parent-child link verification before returning any data | P0 | [MISSING] | Given parent JWT and childId not linked to that parent, When GET /api/dashboard/parent/:childId, Then 403 with "Not authorized to view this student's data" |
| REQ-DASH-006 | Teacher must be able to assign a worksheet to a class via the dashboard API | P0 | [MISSING] | Given teacher JWT, When POST /api/dashboard/teacher/assign { classId, worksheetId, dueDate }, Then Assignment records created for all students in the class and { assignmentId, studentCount } returned |
| REQ-DASH-007 | Teacher dashboard must show per-student completion status for each assignment | P1 | [MISSING] | Given teacher JWT and assignmentId, When GET /api/dashboard/teacher/assignment/:assignmentId, Then each student's status (COMPLETED/IN_PROGRESS/NOT_STARTED) with score if completed |
| REQ-DASH-008 | Parent may optionally assign a worksheet to their linked child | P2 | [MISSING] | Given parent JWT and linked childId, When POST /api/dashboard/parent/:childId/assign { worksheetId, dueDate }, Then Assignment record created; 403 if child not linked |
| REQ-DASH-009 | Teacher cannot see another teacher's class data | P0 | [MISSING] | Given teacher A's JWT, When GET /api/dashboard/teacher, Then only teacher A's classes returned; a classId belonging to teacher B returns 403 if accessed directly |
| REQ-DASH-010 | Dashboard data must reflect WorksheetAttempts from M04 submit flow within 30 seconds | P0 | [MISSING] | Given student completes worksheet via POST /api/submit, When teacher views dashboard within 30 seconds, Then completion count is updated |
| REQ-DASH-011 | Teacher dashboard must support subject-level filtering | P1 | [MISSING] | Given teacher JWT, When GET /api/dashboard/teacher?subject=Math, Then only Math-related class analytics returned |
| REQ-DASH-012 | Parent dashboard must show child progress trend for last 7 days | P1 | [MISSING] | Given parent JWT and linked childId, When GET /api/dashboard/parent/:childId, Then progressTimeline[] contains one entry per day for past 7 days with date and dailyAverageScore |

---

## PART 2 — Design Decisions

| DEC-DASH-NNN | Decision | Chosen Approach | Rationale | Blocking REQs |
|---|---|---|---|---|
| DEC-DASH-001 | Data assembly strategy | Real-time DynamoDB queries for Phase 1. No pre-computed caching. | Acceptable volume in Phase 1. Pre-computed summaries added in Phase 2. | REQ-DASH-001 through REQ-DASH-007 |
| DEC-DASH-002 | Separate dashboardHandler vs extending progressHandler | New backend/handlers/dashboardHandler.js — does not extend progressHandler.js | Dashboard aggregates Classes + Assignments + Attempts in one response. Separate handler = separate IAM scope, independent scaling. | REQ-DASH-001, REQ-DASH-004 |
| DEC-DASH-003 | Assignments table location | Defined in M06 Class management (Assignments table). Dashboard Lambda gets grantReadData. Class Lambda gets grantReadWriteData. | Single source of truth for assignments. Dashboard only reads, never writes assignment records. | REQ-DASH-002, REQ-DASH-006 |
| DEC-DASH-004 | Weak topic threshold | Same as M05: accuracy < 60% and attempt count >= 3 per (studentId, subject, topic) grouping | Consistent definition across all views. Admin-configurable threshold via Config table. | REQ-DASH-003 |
| DEC-DASH-005 | progressTimeline computation | Query WorksheetAttempts GSI1 for student, group by submittedAt date (truncated to day), average percentage per day for last 7 days | In-Lambda aggregation. Manageable at Phase 1 attempt volumes. | REQ-DASH-012 |

---

## PART 3 — Code Audit

### Existing Files

| File | Exists | Status | Notes |
|---|---|---|---|
| backend/handlers/dashboardHandler.js | Unknown | [MISSING] | Not confirmed to exist. Must be created. |

### Missing Files

| File | Reason Needed |
|---|---|
| backend/handlers/dashboardHandler.js | All dashboard endpoints |
| Dashboard Lambda in CDK | REQ-DASH-009 isolation |
| DynamoDB Assignments table in CDK | REQ-DASH-002, REQ-DASH-006 |
| tests/unit/dashboardHandler.test.js | QA coverage |
| tests/integration/dashboard.test.js | End-to-end evidence |

---

## PART 4 — API Contracts

### GET /api/dashboard/teacher
Headers: `Authorization: Bearer {teacherJWT}`
Optional query: `?subject=Math`

Success Response (200):
```json
{
  "teacherId": "uuid",
  "classes": [
    {
      "classId": "uuid",
      "name": "5th Grade Math Period 1",
      "grade": 5,
      "subject": "Math",
      "studentCount": 24,
      "averageScore": 78,
      "completionRate": 85,
      "weakTopics": ["Fractions", "Long Division"],
      "activeAssignments": 2
    }
  ],
  "assignments": [
    {
      "assignmentId": "uuid",
      "classId": "uuid",
      "worksheetId": "uuid",
      "dueDate": "2026-04-01",
      "status": "UPCOMING",
      "completedCount": 10,
      "totalStudents": 24
    }
  ]
}
```

### GET /api/dashboard/parent/:childId
Headers: `Authorization: Bearer {parentJWT}`

Success Response (200):
```json
{
  "child": { "userId": "uuid", "displayName": "Alex", "grade": 5 },
  "averageScore": 74,
  "recentAttempts": [
    {
      "worksheetId": "uuid",
      "subject": "Math",
      "topic": "Fractions",
      "score": 7,
      "totalPoints": 10,
      "percentage": 70,
      "submittedAt": "2026-03-25T14:00:00Z"
    }
  ],
  "weakTopics": ["Fractions", "Decimals"],
  "subjectBreakdown": [
    { "subject": "Math", "averageScore": 72, "attempts": 8 }
  ],
  "progressTimeline": [
    { "date": "2026-03-21", "dailyAverageScore": 65 },
    { "date": "2026-03-22", "dailyAverageScore": 70 }
  ]
}
```

### POST /api/dashboard/teacher/assign
Headers: `Authorization: Bearer {teacherJWT}`

Request:
```json
{ "classId": "uuid", "worksheetId": "uuid", "dueDate": "2026-04-01" }
```

Success Response (200):
```json
{ "assignmentId": "uuid", "studentCount": 24 }
```

Error responses: 401 (no token), 403 (wrong role or unlinked child / not class owner), 404 (child/class not found).

---

## PART 5 — Task Board

| Task ID | Title | Agent | Inputs | Deliverables | Depends On | Priority | Status |
|---|---|---|---|---|---|---|---|
| TASK-DASH-001 | Define teacher dashboard API contract | ba-agent + architect-agent | M08-TEACHER-PARENT-DASHBOARD-TASKS.md, Teacher & Parent Dashboard.md, M05 contract | GET /api/dashboard/teacher schema, assignment sub-contract, subject filter spec, authz rules | TASK-PROG-001 | P0 | not-started |
| TASK-DASH-002 | Define parent dashboard API contract | ba-agent + architect-agent | M08-TEACHER-PARENT-DASHBOARD-TASKS.md, Teacher & Parent Dashboard.md, M05/M06 contracts | GET /api/dashboard/parent/:childId schema, parent-child verification rule, progressTimeline spec | TASK-PROG-001, TASK-CLASS-001 | P0 | not-started |
| TASK-DASH-003 | Implement teacher dashboard handler | dev-agent | TASK-DASH-001 contract, Classes/Assignments/WorksheetAttempts tables | GET /api/dashboard/teacher aggregating classes + assignments + attempt data; weak topic computation; subject filter; assertRole(['teacher']); CORS | TASK-DASH-001, TASK-PROG-003, TASK-CLASS-002 | P0 | not-started |
| TASK-DASH-004 | Implement parent dashboard handler | dev-agent | TASK-DASH-002 contract, ParentStudentLinks, WorksheetAttempts GSI1 | GET /api/dashboard/parent/:childId with parent-child link check (403 if absent); recentAttempts, weakTopics, subjectBreakdown, progressTimeline; assertRole(['parent']); CORS | TASK-DASH-002, TASK-PROG-007, TASK-CLASS-007 | P0 | not-started |
| TASK-DASH-005 | Implement worksheet assignment flow via dashboard API | dev-agent | TASK-DASH-001 contract, Assignments table, ClassMemberships table | POST /api/dashboard/teacher/assign: lookup class membership, create one Assignment record per student, return { assignmentId, studentCount }; GET /api/dashboard/teacher/assignment/:assignmentId: per-student status | TASK-DASH-001, TASK-CLASS-005, TASK-SOLVE-009 | P0 | not-started |
| TASK-DASH-006 | Add DynamoDB Assignments table to CDK | devops-agent | M06 Part 4 Assignments schema, M08 Part 4 contracts, learnfyra-stack.ts | Assignments table: PK=ASSIGNMENT#{id}, SK=STUDENT#{id}, GSI1 on CLASS#{classId}+DUE#{dueDate}. Dashboard Lambda: grantReadData. Class Lambda: grantReadWriteData. CDK synth passes zero warnings. | TASK-DASH-001 | P0 | not-started |
| TASK-DASH-007 | Add dashboard Lambda functions to CDK | devops-agent | learnfyra-stack.ts, dashboardHandler.js | Teacher dashboard Lambda (128MB, 10s, ARM_64) + Parent dashboard Lambda (128MB, 10s, ARM_64). IAM: grantReadData on Classes, Assignments, WorksheetAttempts, ParentStudentLinks, Users. CDK synth passes. | TASK-DASH-006 | P0 | not-started |
| TASK-DASH-008 | Write teacher dashboard unit tests | qa-agent | dashboardHandler.js, CLAUDE.md QA checklist | tests/unit/dashboardHandler.test.js — teacher sees own classes only, 403 on other teacher's class, subject filter correct, weakTopics computed, CORS | TASK-DASH-003 | P0 | not-started |
| TASK-DASH-009 | Write parent dashboard unit tests | qa-agent | dashboardHandler.js | tests/unit/dashboardHandler.test.js (parent path) — parent-child link 403, linked child returns full schema, progressTimeline 7-day window, CORS | TASK-DASH-004 | P0 | not-started |
| TASK-DASH-010 | Write dashboard integration test | qa-agent | dashboardHandler.js, mock DynamoDB via aws-sdk-client-mock | tests/integration/dashboard.test.js — teacher creates class, assigns worksheet, student submits, dashboard reflects completion; parent without link gets 403; parent with link gets full child view | TASK-DASH-003, TASK-DASH-004 | P0 | not-started |

---

## PART 6 — Agent Prompt Pack

### TASK-DASH-001
```text
Agent: ba-agent + architect-agent
Mode: standard
Task ID: TASK-DASH-001
Goal: Define complete teacher dashboard API contract.
Inputs:
  - docs/tasks/backend/M08-TEACHER-PARENT-DASHBOARD-TASKS.md (this file)
  - docs/requirements/platform/Teacher & Parent Dashboard.md
  - docs/tasks/backend/M05-PROGRESS-REPORTING-TASKS.md (M05 progress contract output)
  - docs/tasks/backend/M06-CLASS-RELATIONSHIPS-TASKS.md (M06 class + assignment contracts)
Deliverables:
  - GET /api/dashboard/teacher full response schema with types and example values
  - GET /api/dashboard/teacher?subject filter behavior
  - POST /api/dashboard/teacher/assign request/response schema
  - GET /api/dashboard/teacher/assignment/:assignmentId response schema
  - Role enforcement rules (teacher-only, own classes only)
  - Error model (401, 403, 404, 500)
Constraints: Teacher cannot see another teacher's class data. Data assembled from Classes + Assignments + WorksheetAttempts only.
Output: implementation-ready contract.
```

### TASK-DASH-002
```text
Agent: ba-agent + architect-agent
Mode: standard
Task ID: TASK-DASH-002
Goal: Define complete parent dashboard API contract.
Inputs:
  - docs/tasks/backend/M08-TEACHER-PARENT-DASHBOARD-TASKS.md (this file)
  - docs/requirements/platform/Teacher & Parent Dashboard.md
  - docs/tasks/backend/M05-PROGRESS-REPORTING-TASKS.md
  - docs/tasks/backend/M06-CLASS-RELATIONSHIPS-TASKS.md (ParentStudentLinks schema)
Deliverables:
  - GET /api/dashboard/parent/:childId full response schema
  - POST /api/dashboard/parent/:childId/assign contract (P2)
  - Parent-child link verification: exact check against ParentStudentLinks table, 403 if absent or inactive
  - progressTimeline[] specification: 7-day window, daily average, missing days included as null or omitted
  - Role enforcement: parent role only
  - Error model (401, 403, 404, 500)
Constraints: Parent can only access linked children. No data from other students returned under any path.
Output: implementation-ready contract.
```

### TASK-DASH-003
```text
Agent: dev-agent
Mode: standard
Task ID: TASK-DASH-003
Goal: Implement teacher dashboard handler.
Inputs:
  - docs/tasks/backend/M08-TEACHER-PARENT-DASHBOARD-TASKS.md TASK-DASH-001 approved contract
  - backend/handlers/dashboardHandler.js (create if not exists)
  - DynamoDB table schemas: Classes, ClassMemberships, Assignments, WorksheetAttempts
  - CLAUDE.md Lambda coding standards
Deliverables:
  - GET /api/dashboard/teacher: query Classes by teacherId, for each class query Assignments GSI1 + WorksheetAttempts GSI2, aggregate averageScore + completionRate + weakTopics
  - Subject filter via query param ?subject=X
  - assertRole(['teacher']) + validateToken enforced first
  - Teacher ownership check: only own classIds returned
  - CORS headers on all responses, OPTIONS 200
  - Lambda-compatible handler shape (context.callbackWaitsForEmptyEventLoop = false)
Constraints: No cross-teacher data leakage. All DynamoDB calls mocked in tests.
Output: files changed, test evidence.
```

### TASK-DASH-004
```text
Agent: dev-agent
Mode: standard
Task ID: TASK-DASH-004
Goal: Implement parent dashboard handler.
Inputs:
  - docs/tasks/backend/M08-TEACHER-PARENT-DASHBOARD-TASKS.md TASK-DASH-002 approved contract
  - backend/handlers/dashboardHandler.js (extend existing or add new export)
  - DynamoDB table schemas: ParentStudentLinks, WorksheetAttempts, Users
  - CLAUDE.md Lambda coding standards
Deliverables:
  - GET /api/dashboard/parent/:childId
  - Parent-child link check: query ParentStudentLinks GSI for parentId+childId; 403 if not found
  - recentAttempts (last 10), weakTopics (< 60% accuracy, >= 3 attempts), subjectBreakdown, progressTimeline (7 days)
  - assertRole(['parent'])
  - CORS + OPTIONS 200
Constraints: No data from unlinked students ever returned. Separate role check from teacher path.
Output: files changed, test evidence.
```

### TASK-DASH-005
```text
Agent: dev-agent
Mode: standard
Task ID: TASK-DASH-005
Goal: Implement worksheet assignment flow via teacher dashboard API.
Inputs:
  - TASK-DASH-001 contract, TASK-CLASS-005 ClassMemberships table schema
  - backend/handlers/dashboardHandler.js (read before modifying)
  - CLAUDE.md Lambda coding standards
Deliverables:
  - POST /api/dashboard/teacher/assign: verify teacher owns classId (403 if not), query ClassMemberships for all studentIds, BatchWriteItem Assignments table (one record per student), return { assignmentId, studentCount }
  - GET /api/dashboard/teacher/assignment/:assignmentId: query Assignments GSI1 by assignmentId, join with WorksheetAttempts to get per-student COMPLETED/IN_PROGRESS/NOT_STARTED status
  - assertRole(['teacher']) on both
  - CORS + OPTIONS 200
Constraints: No assignment records for students not enrolled in the class.
Output: files changed, test evidence.
```

### TASK-DASH-006
```text
Agent: devops-agent
Mode: standard
Task ID: TASK-DASH-006
Goal: Add DynamoDB Assignments table to CDK.
Inputs:
  - infra/cdk/lib/learnfyra-stack.ts (read before modifying)
  - docs/tasks/backend/M06-CLASS-RELATIONSHIPS-TASKS.md Part 4 Assignments schema
  - docs/tasks/backend/M08-TEACHER-PARENT-DASHBOARD-TASKS.md
Deliverables:
  - Assignments table: PK=ASSIGNMENT#{assignmentId}, SK=STUDENT#{studentId}
  - GSI1: PK=CLASS#{classId}, SK=DUE#{dueDate} (for class assignment list ordered by due date)
  - Dashboard Lambda: grantReadData
  - Class Lambda: grantReadWriteData
  - CDK synth passes zero warnings
  - CDK assertion test in infra/test/
Constraints: IaC only. Prod RemovalPolicy.RETAIN. Dev/staging RemovalPolicy.DESTROY.
Output: CDK diff, table/GSI inventory, synth evidence.
```

### TASK-DASH-010
```text
Agent: qa-agent
Mode: standard
Task ID: TASK-DASH-010
Goal: Write end-to-end dashboard integration test.
Inputs:
  - backend/handlers/dashboardHandler.js (after TASK-DASH-003 and TASK-DASH-004)
  - aws-sdk-client-mock for all DynamoDB calls
  - CLAUDE.md QA checklist
Deliverables:
  - tests/integration/dashboard.test.js covering:
    1. Teacher creates class → assigns worksheet → student submits → dashboard completedCount increments
    2. Teacher A cannot see teacher B's class (403)
    3. Parent with no link to childId gets 403
    4. Parent with valid link gets full child view including progressTimeline
    5. Subject filter returns only matching subject classes
    6. Grade 1 (5 questions) and Grade 10 (30 questions) attempt data handled correctly
    7. CORS headers present on all responses
    8. OPTIONS 200 on both endpoints
Constraints: No real AWS calls. No real DynamoDB. Clean up any local state after each test.
Output: test file, all tests passing, coverage evidence.
```

---

## PART 7 — Out of Scope

- Dashboard frontend UI (Angular — separate project)
- Pre-computed analytics reports (Phase 2)
- AI-driven personalized homework recommendations
- School district roll-up analytics
- Notification delivery (email/push) on assignment creation
- PDF/CSV export of dashboard data
- Gamification: leaderboards, badges, streaks

---

## PART 8 — Open Questions

| OQ-NNN | Question | Blocking Tasks | Decision Needed By |
|---|---|---|---|
| OQ-DASH-001 | Should the teacher dashboard return all-time analytics or only the current academic year? | TASK-DASH-001 | Before TASK-DASH-001 starts |
| OQ-DASH-002 | Should progressTimeline missing days be included as null entries or omitted from the array? | TASK-DASH-002 | Before TASK-DASH-002 starts |
| OQ-DASH-003 | Should the parent assign feature (REQ-DASH-008, P2) require teacher approval before the assignment becomes active for the student? | TASK-DASH-002 | Before TASK-DASH-002 starts |
