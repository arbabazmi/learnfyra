# Complete API Test Document (Manual + Postman)

## 1. Scope
This document defines complete manual API testing for the Learnfyra backend routes currently exposed by the local/dev server.

Covered domains:
- Worksheet lifecycle
- Authentication
- Student, class, progress, analytics
- Certificates, admin policies, rewards
- Question bank

Target environment:
- Local: `http://localhost:3000`
- Dev: deployed API URL (replace in Postman `baseUrl` variable)

## 2. Preconditions
- Node 18+ installed.
- Dependencies installed (`npm ci`).
- Server runs (`npm start` or project run command).
- Valid tokens available for:
  - Student
  - Teacher
  - Admin
- Test data exists for at least one:
  - Worksheet
  - Class
  - Student profile
  - Certificate
  - Question bank entry

## 3. Postman Setup
Use collection file:
- `postman/Learnfyra-Dev-API.postman_collection.json`

Required collection variables:
- `baseUrl`
- `studentToken`
- `teacherToken`
- `adminToken`
- `worksheetId`
- `classId`
- `studentId`
- `childId`
- `certificateId`
- `certificateDownloadToken`
- `questionId`

## 4. Global Validation Rules
For every endpoint validate:
1. Status code matches expected path.
2. Response is valid JSON.
3. CORS headers exist:
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Headers`
   - `Access-Control-Allow-Methods`
4. No internal path leakage in error messages.
5. Auth-protected endpoints reject missing/invalid tokens.

## 5. Endpoint-by-Endpoint Test Cases

## 5.1 Worksheet APIs

### POST /api/generate
Happy path:
1. Send valid payload.
2. Expect `200`.
3. Verify response has `success=true`, keys, and metadata.

Negative:
1. Invalid `grade` (`0`) -> expect `400`.
2. Invalid `generationMode` -> expect `400`.
3. Invalid `provenanceLevel` -> expect `400`.
4. Malformed JSON -> expect `400`.

### GET /api/download
Happy path:
1. Provide valid `key` query.
2. Expect `200` with downloadable content.

Negative:
1. Missing `key` -> expect `400` or `404` based on handler behavior.

### GET /api/solve/:worksheetId
Happy path:
1. Use valid worksheet id.
2. Expect `200`.
3. Verify questions render fields only.
4. Verify no `answer`, no `explanation` in question objects.

Negative:
1. Bad UUID -> expect `400`.
2. Encoded traversal payload -> expect `400`.
3. Unknown UUID -> expect `404`.

### POST /api/submit
Happy path:
1. Use valid worksheet and answers array.
2. Expect `200`.
3. Verify scoring fields: `totalScore`, `totalPoints`, `percentage`, `results`.

Negative:
1. Missing worksheetId -> `400`.
2. Invalid UUID -> `400`.
3. answers not array -> `400`.
4. Duplicate answer numbers -> `400`.
5. Unknown worksheet -> `404`.

## 5.2 Auth APIs

### POST /api/auth/register
Happy path:
1. Send unique email and valid password.
2. Expect success status.

Negative:
1. Duplicate email -> expect conflict/validation error.
2. Missing required fields -> `400`.

### POST /api/auth/login
Happy path:
1. Login with registered credentials.
2. Expect token in response.

Negative:
1. Wrong password -> `401`.
2. Unknown account -> `401/404`.

### POST /api/auth/logout
Happy path:
1. Send valid bearer token.
2. Expect success status.

Negative:
1. Missing token -> `401`.

### POST /api/auth/oauth/:provider and GET /api/auth/callback/:provider
Manual sanity:
1. Start oauth flow endpoint returns redirect/session metadata.
2. Callback with invalid code handled gracefully.

## 5.3 Student and Class APIs

### GET /api/student/profile
Happy path:
1. Send student token.
2. Expect profile object.
3. Validate active memberships only.

Negative:
1. Missing token -> `401`.

### POST /api/student/join-class
Happy path:
1. Join with valid invite code.
2. Expect class summary.

Negative:
1. Invalid invite format -> `400`.
2. Non-student token -> `403`.
3. Unknown invite -> `404`.
4. Already member -> `409`.

### POST /api/class/create
Happy path:
1. Teacher token and valid body.
2. Expect `201`, class id, invite code.

Negative:
1. Non-teacher token -> `403`.
2. Invalid grade/subject/className -> `400`.

### GET /api/class/:id/students
Happy path:
1. Owner teacher token.
2. Expect class and student list.

Negative:
1. Invalid class id format -> `400`.
2. Non-owner teacher -> `403`.
3. Missing token -> `401`.

## 5.4 Progress and Analytics APIs

### POST /api/progress/save
Happy path:
1. Student token + valid attempt payload.
2. Expect `201` with `attemptId`.

Negative:
1. Missing required fields -> `400`.
2. Invalid token -> `401`.

### GET /api/progress/history
Happy path:
1. Student token.
2. Expect paginated attempts.

Negative:
1. Invalid pagination values -> `400` if enforced.

### GET /api/progress/insights
Happy path:
1. Student token and limit.
2. Expect insights array and counts.

Negative:
1. Invalid limit (`0`) -> `400`.

### GET /api/progress/parent/:childId
Happy path:
1. Parent token with active link.
2. Expect child history and aggregates.

Negative:
1. Non-parent role -> `403`.
2. Parent without link -> `403`.

### GET /api/analytics/class/:id
Happy path:
1. Owner teacher token.
2. Expect topic breakdown and totals.

Negative:
1. Non-teacher -> `403`.
2. Non-owner teacher -> `403`.

### GET /api/analytics/student/:id
Happy path:
1. Teacher token.
2. Expect attempts and aggregates for student.

Negative:
1. Non-teacher -> `403`.
2. Invalid class scope ownership -> `403`.

## 5.5 Certificates APIs

### GET /api/certificates
Happy path:
1. Student token.
2. Expect certificate list and download tokens.

Negative:
1. Non-student role -> `403`.

### GET /api/certificates/:id/download
Happy path:
1. Student token with valid `token` query.
2. Expect certificate data and HTML content.

Negative:
1. Missing token query -> `400`.
2. Invalid/expired token -> `401`.
3. Certificate owned by other student -> `403`.

## 5.6 Admin APIs

### GET /api/admin/policies
Happy path:
1. Admin token.
2. Expect policy snapshot.

Negative:
1. Non-admin token -> `403`.

### PUT /api/admin/policies/model-routing
Happy path:
1. Admin token + `Idempotency-Key` + valid body.
2. Expect `200` and version increment.

Negative:
1. Missing `Idempotency-Key` -> `400`.
2. Reuse key with different payload -> `409`.
3. Invalid fallback order -> `400`.

### PUT /api/admin/policies/budget-usage
Happy path:
1. Valid limits and reason.
2. Expect `200`.

Negative:
1. soft limit > hard limit -> `400`.
2. invalid behavior enum -> `400`.

### PUT /api/admin/policies/validation-profile
Happy path:
1. Valid strictness profile + idempotency key.
2. Expect `200`.

Negative:
1. Invalid strictness combination -> `400`.
2. Missing idempotency key -> `400`.

### GET /api/admin/audit/events
Happy path:
1. Admin token.
2. Expect paginated events.

Negative:
1. Invalid limit/offset -> `400`.

## 5.7 Rewards APIs

### GET /api/rewards/student/:id
Happy path:
1. Student token and student id.
2. Expect rewards payload.

Negative:
1. Unauthorized role/id mismatch -> `403`.

### GET /api/rewards/class/:id
Happy path:
1. Teacher token, class id.
2. Expect class rewards summary.

Negative:
1. Non-teacher -> `403`.

## 5.8 Question Bank APIs

### GET /api/qb/questions
Happy path:
1. Use valid filters.
2. Expect list and count.

Negative:
1. Invalid subject/difficulty/type -> `400`.
2. Invalid grade -> `400`.

### POST /api/qb/questions
Happy path:
1. Send valid question payload.
2. Expect `201`, created question object and `questionId`.
3. Save `questionId` for next tests.

Negative:
1. Missing required fields -> `400`.
2. invalid options/answer format -> `400`.

### GET /api/qb/questions/:id
Happy path:
1. Use created `questionId`.
2. Expect `200`.

Negative:
1. Unknown id -> `404`.

### POST /api/qb/questions/:id/reuse
Happy path:
1. Post reuse increment.
2. Expect success response.

Negative:
1. Unknown id -> `404`.
2. Invalid body -> `400`.

## 6. Manual Execution Order
Recommended execution order for manual run:
1. Auth register/login to obtain tokens.
2. Class create (teacher).
3. Student join class.
4. Generate worksheet.
5. Solve and submit.
6. Save progress.
7. Verify history/insights/analytics/rewards.
8. Verify certificates list/download.
9. Admin policy update tests.
10. Question bank CRUD/reuse tests.

## 7. Exit Criteria (Manual QA Sign-off)
A test cycle is complete when:
1. All happy-path tests pass.
2. All listed negative tests return expected status codes.
3. No response leaks sensitive/internal path data.
4. Role boundaries are enforced consistently.
5. CORS headers are present across responses.

## 8. Evidence Capture
For each endpoint, capture:
1. Request payload.
2. Response status/body.
3. Screenshot or Postman run export.
4. Pass/fail and defect id (if failed).

Store run evidence under a dated folder in `docs/qa` or your QA system.
