# M05 Progress & Reporting — Requirements Spec
**Module:** M05
**Status:** Pending Implementation
**Version:** 1.1
**Last Updated:** 2026-03-28

---

## Overview

M05 provides progress tracking and reporting for students, teachers, and parents. It aggregates worksheet attempt data written by M04 (`submitHandler`) and surfaces insights through role-specific API endpoints. Key data points — total attempts, average score, streak, weak areas, strong areas, and subject breakdowns — are precomputed and stored directly on the `LearnfyraUsers` DynamoDB record after each submission to keep dashboard queries fast (no aggregation at read time). M05 also issues completion certificates as PDF files stored in S3 when a student achieves 80% or higher on a worksheet.

---

## User Stories

### US-M05-001: Student Views Personal Progress
**As a** student
**I want to** see my scores, streak, weak areas, and strong areas in one place
**So that** I can understand which topics I need to study more
**Priority:** P0

### US-M05-002: Student Views Attempt History
**As a** student
**I want to** scroll through a paginated list of all my past worksheet attempts with scores and dates
**So that** I can track my improvement over time
**Priority:** P1

### US-M05-003: Teacher Views Class Analytics
**As a** teacher
**I want to** see each student's average score and flag students performing below 60%
**So that** I can identify who needs additional support
**Priority:** P0

### US-M05-004: Parent Views Child Progress
**As a** parent linked to a student account
**I want to** see the same progress dashboard my child sees
**So that** I can monitor their learning at home
**Priority:** P0

### US-M05-005: Student Earns a Completion Certificate
**As a** student who scores 80% or higher on a worksheet
**I want to** receive a downloadable PDF certificate for that achievement
**So that** I have a record of my accomplishment to share with parents or teachers
**Priority:** P1

### US-M05-006: Progress Aggregates Updated After Each Submission
**As a** developer
**I want** progress aggregates (totalAttempts, avgScore, streak, weakAreas, strongAreas) to be updated immediately after each scored submission
**So that** dashboards always reflect the student's most current performance without a separate batch job
**Priority:** P0

---

## Functional Requirements

### REQ-M05-001: Progress Handler — GET /api/progress/me
**Priority:** P0
**Tasks:** M05-BE-01

`backend/handlers/progressHandler.js` SHALL handle `GET /api/progress/me`. Auth: Bearer token, student role required (Lambda Authorizer enforces). The handler SHALL:
1. Read the `userId` from `event.requestContext.authorizer.userId`.
2. Fetch the user's record from `LearnfyraUsers-{env}` by `userId`.
3. Fetch the 5 most recent `WorksheetAttempt` records from `LearnfyraWorksheetAttempt-{env}` (PK=userId, sorted by SK descending) for the `recentAttempts` array.
4. Return the response per the contract in `04-api-contracts/reporting-api.md` (GET /api/progress/me).

The handler SHALL return 200 with all precomputed aggregate fields from the Users record. If a field has not yet been computed (e.g., brand-new user with no attempts), it SHALL return a sensible default: `totalAttempts: 0`, `avgScore: 0`, `streak: 0`, `weakAreas: []`, `strongAreas: []`, `subjectAvgScores: {}`, `recentAttempts: []`.

### REQ-M05-002: Progress Handler — GET /api/progress/history
**Priority:** P1
**Tasks:** M05-BE-02

`progressHandler.js` SHALL also handle `GET /api/progress/history`. Auth: Bearer token, student role. The handler SHALL:
- Accept query parameters `limit` (default 20, max 100) and `lastKey` (DynamoDB pagination cursor, optional).
- Query `LearnfyraWorksheetAttempt-{env}` using PK=userId with a DynamoDB `Query` in descending SK order.
- Return a response with `attempts` array, `count`, and `lastKey` per the contract in `04-api-contracts/reporting-api.md`.

### REQ-M05-003: Dashboard Handler — Teacher Class View
**Priority:** P0
**Tasks:** M05-BE-03

`backend/handlers/dashboardHandler.js` SHALL handle `GET /api/dashboard/class/:classId`. Auth: Bearer token, teacher role. The handler SHALL:
1. Verify the requesting teacher owns the class by checking `LearnfyraClasses-{env}` (`teacherId` field matches JWT `userId`). Return 403 with code `NOT_CLASS_OWNER` if not.
2. Fetch all active `ClassMembership` records for the classId from `LearnfyraClassMemberships-{env}`.
3. Batch-fetch `LearnfyraUsers-{env}` records for all enrolled students to read precomputed aggregate fields.
4. Fetch all assignments for the class from `LearnfyraGenerationLog` or a dedicated Assignments table (see Open Questions).
5. For each student, compute `needsIntervention: avgScore < 60`.
6. Return the class dashboard response per `04-api-contracts/reporting-api.md`.

`dashboardHandler.js` SHALL also handle `GET /api/dashboard/student/:studentId`. Auth: Bearer token, teacher role. The handler SHALL verify the student is enrolled in at least one of the teacher's classes before returning data. Return 403 if not.

`dashboardHandler.js` SHALL also handle `GET /api/dashboard/child`. Auth: Bearer token, parent role. The handler SHALL read `linkedStudentId` from the parent's Users record and return the same structure as GET /api/progress/me for that student. Return 404 with code `NO_CHILD_LINKED` if `linkedStudentId` is absent.

`dashboardHandler.js` SHALL also handle `GET /api/dashboard` (role-aware). For a teacher, return the list of their classes with summary stats. For a parent, proxy to the child dashboard logic.

### REQ-M05-004: Progress Aggregator (src/reporting/aggregator.js)
**Priority:** P0
**Tasks:** M05-BE-04

`src/reporting/aggregator.js` SHALL export a function `updateProgressAggregates(userId, attemptData)` that is called inline within `submitHandler` immediately after a `WorksheetAttempt` record is written. `attemptData` SHALL contain: `{ subject, topic, grade, difficulty, score, totalPoints, percentage, timeTaken, timed, completedAt }`.

The aggregator SHALL perform a single DynamoDB `UpdateItem` on `LearnfyraUsers-{env}` that atomically:
- Increments `totalAttempts` by 1.
- Recomputes `avgScore` using a running weighted average: `newAvg = ((oldAvg * (totalAttempts - 1)) + percentage) / totalAttempts`. Because DynamoDB does not support division in UpdateExpressions, the aggregator SHALL read the current record first, compute the new value in JavaScript, and write it back using a conditional write.
- Updates `lastActive` to `completedAt`.
- Updates `subjectAvgScores[subject]` using the same weighted-average approach restricted to attempts for that subject.
- Recomputes `weakAreas` and `strongAreas` by reading all topic averages (derived from the subjects map) and applying thresholds: weakAreas = topics with avgScore < 60, strongAreas = topics with avgScore > 85. Topic-level averages are maintained in a `topicAvgScores` map on the user record (not exposed in the API but stored as internal computation state).
- Updates `streak`: if `completedAt` is on the same calendar day as `lastActive`, the streak does not change; if it is the calendar day after `lastActive`, increment streak by 1; if more than one day has passed, reset streak to 1.

The aggregator SHALL NOT block the `submitHandler` response. It SHALL be awaited before the handler returns but SHALL use a try/catch that logs the error without failing the submit response if the aggregator itself fails.

### REQ-M05-005: Certificate Handler (POST /api/certificates/generate)
**Priority:** P1
**Tasks:** M05-BE-05

`backend/handlers/certificateHandler.js` SHALL handle `POST /api/certificates/generate`. Auth: Bearer token, student or teacher role. The handler SHALL:
1. Validate the request: `worksheetId` (UUID v4) and `attemptId` (string) are required.
2. Read the specified `WorksheetAttempt` record from DynamoDB to retrieve the `percentage`.
3. If `percentage < 80`, return 400 with code `SCORE_BELOW_THRESHOLD`, `requiredPercentage: 80`, and `achieved: <actual>`.
4. Check `LearnfyraCertificates-{env}` for an existing certificate for this `userId` + `worksheetId` combination (using the userId-index GSI). If one exists, return it immediately (idempotent — one certificate per student per worksheet).
5. Call `src/reporting/certificateBuilder.js` to generate the certificate PDF.
6. Write the PDF to S3 at `certificates/{userId}/{certificateId}.pdf`.
7. Write a `LearnfyraCertificates-{env}` record.
8. Return the response per `04-api-contracts/reporting-api.md`.

`certificateHandler.js` SHALL also handle `GET /api/certificates/:certificateId`. Auth: None (public verification). The handler reads the certificate record from DynamoDB and returns certificate metadata with a presigned S3 download URL (15-minute expiry).

### REQ-M05-006: Certificate Builder (src/reporting/certificateBuilder.js)
**Priority:** P1
**Tasks:** M05-BE-06

`src/reporting/certificateBuilder.js` SHALL export a function `buildCertificatePDF({ studentName, worksheetTitle, percentage, completedAt, certificateId })` that generates a PDF using Puppeteer (already in the dependency list) and returns the PDF as a Buffer. The certificate content SHALL include:
- Learnfyra logo/branding.
- "Certificate of Achievement" heading.
- Student name (from Users table, not from any request body).
- Worksheet title.
- Score achieved as a percentage.
- Date completed (formatted as `Month DD, YYYY`).
- Certificate ID (UUID) for basic verification.

The certificate template SHALL be a standalone HTML string rendered by Puppeteer with US Letter page size. It SHALL not depend on external fonts or images that cannot be bundled. Student name is read from DynamoDB; it is never taken from the POST request body.

---

## Acceptance Criteria

### AC-M05-001: GET /api/progress/me Returns All Aggregate Fields
**Given** a student has completed 5 worksheets across Math and Science
**When** they call `GET /api/progress/me`
**Then** the response includes `totalAttempts: 5`, a computed `avgScore`, a non-negative `streak`, populated `weakAreas` and `strongAreas` lists (may be empty if no topic has crossed a threshold), and a `recentAttempts` array with up to 5 items

### AC-M05-002: New Student with Zero Attempts Returns Default Values
**Given** an authenticated student has never submitted a worksheet
**When** they call `GET /api/progress/me`
**Then** the response includes `totalAttempts: 0`, `avgScore: 0`, `streak: 0`, `weakAreas: []`, `strongAreas: []`, `subjectAvgScores: {}`, and `recentAttempts: []` — no 500 error

### AC-M05-003: Aggregator Updates User Record After Submit
**Given** a student submits a worksheet with 80% score in Math Multiplication
**When** `updateProgressAggregates` completes
**Then** the `LearnfyraUsers-{env}` record for that student has `totalAttempts` incremented by 1, `lastActive` updated, `avgScore` updated, and `subjectAvgScores.Math` updated to reflect the new attempt

### AC-M05-004: Teacher Class Dashboard Flags Struggling Students
**Given** a class has 3 students: one with avgScore 90, one with avgScore 55, one with avgScore 45
**When** the teacher calls `GET /api/dashboard/class/{classId}`
**Then** the response includes `needsInterventionCount: 2` and the two students with avgScore < 60 have `needsIntervention: true`

### AC-M05-005: Teacher Cannot Access Another Teacher's Class
**Given** teacher A calls `GET /api/dashboard/class/{classId}` where the class belongs to teacher B
**When** the handler verifies ownership
**Then** the response is 403 with code `NOT_CLASS_OWNER`

### AC-M05-006: Parent Dashboard Returns Child's Data
**Given** a parent account is linked to a student account
**When** the parent calls `GET /api/dashboard/child`
**Then** the response contains the student's progress data in the same structure as `GET /api/progress/me`

### AC-M05-007: Parent Cannot Access Unlinked Child's Data
**Given** a parent account has no `linkedStudentId` set
**When** the parent calls `GET /api/dashboard/child`
**Then** the response is 404 with code `NO_CHILD_LINKED`

### AC-M05-008: Certificate Generated When Score >= 80%
**Given** a student has a `WorksheetAttempt` record with `percentage: 85`
**When** they call `POST /api/certificates/generate` with the matching `worksheetId` and `attemptId`
**Then** a certificate PDF is written to S3 at `certificates/{userId}/{certificateId}.pdf`, a `LearnfyraCertificates` record is created, and the response includes `downloadUrl` with a presigned URL

### AC-M05-009: Certificate Not Generated When Score < 80%
**Given** a student has a `WorksheetAttempt` with `percentage: 75`
**When** they call `POST /api/certificates/generate`
**Then** the response is 400 with code `SCORE_BELOW_THRESHOLD`, `requiredPercentage: 80`, `achieved: 75`

### AC-M05-010: Certificate Issuance Is Idempotent
**Given** a student already has a certificate for worksheetId X
**When** they call `POST /api/certificates/generate` again for worksheetId X
**Then** the existing certificate is returned (no new DynamoDB record, no new S3 write, same `certificateId`)

### AC-M05-011: History Pagination Works Correctly
**Given** a student has 45 worksheet attempts
**When** they call `GET /api/progress/history?limit=20`
**Then** the response contains exactly 20 attempts and a non-null `lastKey` for the next page

### AC-M05-012: AWS Services — DynamoDB Tables Must Exist Before Deploy
**Given** `M05-CDK-001` and `M05-CDK-002` CDK tasks are complete
**When** the Lambda functions for M05 are deployed to API Gateway
**Then** `GET /api/progress/me`, `POST /api/certificates/generate`, and `GET /api/dashboard/class/{id}` all return 200 for valid requests in the dev environment

### AC-M05-013: Streak Computation — Consecutive Days
**Given** a student completed a worksheet yesterday and completes one today
**When** `updateProgressAggregates` runs
**Then** the `streak` value is the previous streak value plus 1

### AC-M05-014: Streak Reset — Gap in Days
**Given** a student's `lastActive` is more than 1 calendar day in the past
**When** `updateProgressAggregates` runs after a new submission
**Then** the `streak` is reset to 1

---

## Local Development Requirements

This section applies before any AWS work begins. All acceptance criteria above MUST pass on `http://localhost:3000` with `dynamodb-local` before any Lambda deployment or CDK work begins for M05.

### Blocking Dependency on M04
M05 backend MUST NOT be started until the M04 backend sprint is complete and all M04 unit tests pass. The `updateProgressAggregates` function is called from `submitHandler.js` (M04-BE-02). This function must exist and be importable when M04-BE-02 is built, but it can be a stub that logs and returns immediately during M04 development. The full implementation is M05-BE-04.

### DynamoDB Local — Required Before M05 Backend Implementation
M05 requires two DynamoDB tables to be running in `dynamodb-local` before any M05 handler can be tested. Start `dynamodb-local` with:
```
docker run -p 8000:8000 amazon/dynamodb-local
```

Create the `LearnfyraWorksheetAttempt` table (also needed by M04-BE-02 for authenticated writes):
```
aws dynamodb create-table \
  --table-name LearnfyraWorksheetAttempt-local \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

Create the `LearnfyraCertificates` table:
```
aws dynamodb create-table \
  --table-name LearnfyraCertificates-local \
  --attribute-definitions \
    AttributeName=certificateId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=certificateId,KeyType=HASH \
  --global-secondary-indexes '[{
    "IndexName": "userId-index",
    "KeySchema": [{"AttributeName": "userId", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

Both table creation commands are also encapsulated in `scripts/bootstrap-local-db.js` (SETUP-002).

### Environment Variables for Local M05 Development
```
APP_RUNTIME=local
NODE_ENV=development
DB_ENDPOINT=http://localhost:8000
WORKSHEET_ATTEMPT_TABLE_NAME=LearnfyraWorksheetAttempt-local
CERTIFICATES_TABLE_NAME=LearnfyraCertificates-local
USERS_TABLE_NAME=LearnfyraUsers-local
```

### Certificate Builder — Puppeteer Available Locally
`certificateBuilder.js` uses Puppeteer, which is already installed as an npm dependency. No Lambda layer or Chromium setup is needed for local development. Puppeteer downloads Chromium automatically on `npm install`.

For AWS Lambda deployment, a Chromium Lambda layer (e.g., `@sparticuz/chromium`) will be required. This is a future CDK concern tracked as an Open Question. It does not affect local development.

### Local Test Sequence
Before any AWS work begins, verify the following on `http://localhost:3000`:
1. Start `dynamodb-local` Docker container and run `scripts/bootstrap-local-db.js`.
2. Generate a worksheet and submit answers as an authenticated user (use `APP_RUNTIME=local` with `LOCAL_JWT_SECRET`).
3. Call `GET /api/progress/me` — confirm aggregate fields are populated with the submission data.
4. Call `GET /api/progress/history?limit=20` — confirm the attempt appears.
5. Call `POST /api/certificates/generate` with percentage >= 80 — confirm PDF buffer is produced and local S3-equivalent path is written.
6. Run `npm test` — all M05 unit tests pass.

### Frontend Template Note
**Awaiting UI template from product owner — do not implement any M05 frontend pages until UI template is received and M05 backend sprint is complete.**

---

## AWS Services Involved

| Service | Role |
|---|---|
| DynamoDB (`LearnfyraUsers-{env}`) | Stores precomputed aggregate fields updated by `aggregator.js` after each attempt |
| DynamoDB (`LearnfyraWorksheetAttempt-{env}`) | Source of raw attempt data for history queries; Task M05-CDK-001 |
| DynamoDB (`LearnfyraCertificates-{env}`) | Certificate metadata store; Task M05-CDK-002 |
| DynamoDB (`LearnfyraClasses-{env}`, `LearnfyraClassMemberships-{env}`) | Read by dashboard handler to resolve class roster; Tasks M06-CDK-001 |
| S3 (`learnfyra-{env}-s3-worksheets`) | Stores certificate PDFs at `certificates/{userId}/{certificateId}.pdf` |
| Lambda (`learnfyra-progress-{env}`) | Handles `GET /api/progress/me` and `GET /api/progress/history` |
| Lambda (`learnfyra-dashboard-{env}`) | Handles all `GET /api/dashboard/*` endpoints |
| Lambda (`learnfyra-certificate-{env}`) | Handles `POST /api/certificates/generate` and `GET /api/certificates/:id` |
| API Gateway | Routes M05 endpoints; Lambda Authorizer enforces role on all except `GET /api/certificates/:id` |

---

## File Structure

```
backend/handlers/
  progressHandler.js     — GET /api/progress/me, GET /api/progress/history
  dashboardHandler.js    — GET /api/dashboard, /class/:id, /student/:id, /child
  certificateHandler.js  — POST /api/certificates/generate, GET /api/certificates/:id

src/reporting/
  aggregator.js          — updateProgressAggregates(userId, attemptData)
  certificateBuilder.js  — buildCertificatePDF(options) → Buffer

tests/unit/
  progressHandler.test.js
  dashboardHandler.test.js
  certificateHandler.test.js

tests/integration/
  (covered by M04 integration test: generate → solve → submit → progress update)
```

---

## Out of Scope
- Phase 2 gamification: points, badges, leaderboards — `timesUsed`, `streak`, and `badgeCount` fields are in the schema but not acted upon beyond streak in Phase 1.
- QR code on certificates — Phase 2 (public verification URL with QR is a Phase 2 feature).
- Email notifications when certificates are issued.
- Parent-facing certificate download separate from student download — the `GET /api/certificates/:id` endpoint is public and covers both.
- Teacher-generated certificates on behalf of students without a qualifying attempt.
- Real-time dashboard updates (WebSockets or server-sent events) — dashboards poll on page load only.

---

## Dependencies

| Dependency | Status |
|---|---|
| M04-BE-02 (`submitHandler`) — calls `aggregator.js` inline | TODO — M05-BE-04 must be ready when M04-BE-02 is built |
| M06 class and membership tables — read by `dashboardHandler` | TODO — M06-CDK-001 must be deployed before teacher dashboard works |
| M01-BE-07 (parent-child link) — `linkedStudentId` on parent records | DONE |
| CDK-010 (DynamoDB table provisioning for M05-CDK-001, M05-CDK-002) | TODO |
| `04-api-contracts/reporting-api.md` (frozen RC-BE-01) | FROZEN |
| Puppeteer (already in npm dependencies) | DONE — available for `certificateBuilder.js` |

---

## Open Questions

1. The aggregator computes `avgScore` using a read-then-write pattern (not a single atomic DynamoDB operation). Under concurrent submissions from the same student, a race condition could produce a slightly inaccurate `avgScore`. Is eventual consistency acceptable for progress aggregates, or must they be strictly accurate? If strict, a DynamoDB transaction or a different storage model is required.
2. Should topic-level averages (`topicAvgScores`) be stored as a top-level map on the Users record, or derived from the `WorksheetAttempt` history at read time? Storing them precomputed matches the pattern for `subjectAvgScores` but increases the UpdateItem complexity. Read-time derivation would be more accurate but slower.
3. The teacher dashboard `GET /api/dashboard/class/:classId` requires assignment completion rates. The Assignments data is referenced in M06 but there is no dedicated Assignments table in the current DynamoDB design. Should a `LearnfyraAssignments-{env}` table be added as part of M05 or M06? This blocks the completion rate calculation in the teacher dashboard.
4. `certificateBuilder.js` uses Puppeteer to generate PDFs. In a Lambda environment Puppeteer requires a Chromium layer (e.g., `@sparticuz/chromium`). Is the CDK stack already configured to provide this layer for the certificate Lambda, or does this need to be added as a new CDK construct? This could significantly increase the certificate Lambda's cold-start time and memory requirement.
