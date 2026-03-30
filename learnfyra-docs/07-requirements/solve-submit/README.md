# M04 Online Solve & Submit — Requirements Spec
**Module:** M04
**Status:** Pending Implementation
**Version:** 1.1
**Last Updated:** 2026-03-28

---

## Overview

M04 enables students and guests to solve worksheets online without printing. It covers the interactive solve page (`solve.html`), timed and untimed mode, input rendering for all seven question types, the client-side submission flow, the server-side scoring engine, and the results display. Authenticated student attempts are persisted to DynamoDB; guest attempts are scored and returned but not stored. The backend handlers are designed to be Lambda-compatible for future AWS deployment but are first wired into the local Express dev server.

---

## User Stories

### US-M04-001: Solve a Worksheet Online
**As a** student or guest
**I want to** open a worksheet in an interactive browser form and type or select my answers
**So that** I can complete the worksheet without printing it
**Priority:** P0

### US-M04-002: Choose Timed or Untimed Mode
**As a** student
**I want to** select whether to solve under a countdown timer or at my own pace
**So that** I can practice under test conditions or study without pressure
**Priority:** P0

### US-M04-003: Receive Instant Scored Feedback
**As a** student
**I want to** see my score and which answers were correct or incorrect immediately after submitting
**So that** I can learn from my mistakes without waiting for a teacher to grade the work
**Priority:** P0

### US-M04-004: View Explanations for Incorrect Answers
**As a** student
**I want to** see the correct answer and an explanation for every question I got wrong
**So that** I understand the reasoning behind the correct answer
**Priority:** P0

### US-M04-005: Solve as a Guest Without an Account
**As a** visitor without a Learnfyra account
**I want to** solve a worksheet and receive a score
**So that** I can evaluate the platform before registering
**Priority:** P1

### US-M04-006: Auto-Submit on Timer Expiry
**As a** student in timed mode
**I want** the worksheet to be submitted automatically when the countdown reaches zero
**So that** the attempt is recorded honestly within the time limit
**Priority:** P0

---

## Functional Requirements

### REQ-M04-001: Solve Handler (GET /api/solve/:worksheetId)
**Priority:** P0
**Tasks:** M04-BE-01

`backend/handlers/solveHandler.js` SHALL be a Lambda-compatible handler that:
1. Validates `worksheetId` against the UUID v4 pattern `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (case-insensitive). Any non-matching value SHALL return 400 with code `INVALID_WORKSHEET_ID`.
2. Reads `solve-data.json` from storage: `worksheets-local/{worksheetId}/solve-data.json` (local, `APP_RUNTIME=local`) or S3 key `worksheets/{year}/{month}/{day}/{worksheetId}/solve-data.json` (AWS). The S3 date path is obtained by querying `LearnfyraGenerationLog` DynamoDB table for the `s3Prefix` field.
3. If the file does not exist, returns 404 with code `WORKSHEET_NOT_FOUND`.
4. Strips the `answer` and `explanation` fields from every question object before responding.
5. Strips the `options` field from all non-`multiple-choice` question types.
6. Returns the sanitized worksheet JSON per the response schema in `04-api-contracts/solving-api.md`.

The handler SHALL support `event.httpMethod === 'OPTIONS'` and return CORS headers for preflight requests. Auth is not required on this endpoint (guest solve is allowed).

Expected latency: under 500 ms for local reads; under 1 second for S3 reads.
Lambda configuration (future AWS): `learnfyra-solve`, timeout 10 s, memory 128 MB, ARM_64.

### REQ-M04-002: Submit Handler (POST /api/submit)
**Priority:** P0
**Tasks:** M04-BE-02

`backend/handlers/submitHandler.js` SHALL be a Lambda-compatible handler that:
1. Validates the request body: `worksheetId` must be a UUID v4; `answers` must be a non-empty array; each answer object must have a valid `number` (1-indexed integer within the question range) and an `answer` field.
2. Reads `solve-data.json` from the same storage as REQ-M04-001 to retrieve the authoritative answer key.
3. Passes the submitted answers and the loaded worksheet to `src/solve/scorer.js`.
4. Passes the scoring result to `src/solve/resultBuilder.js` to construct the response payload.
5. If the `Authorization` header contains a valid JWT (per the existing Lambda Authorizer): writes a `WorksheetAttempt` record to DynamoDB and calls `src/reporting/aggregator.js` to update the user's precomputed progress fields.
6. If no valid JWT is present (guest mode): returns the score without any DynamoDB writes.
7. Returns the full result JSON per the response schema in `04-api-contracts/solving-api.md`. The `attemptId` field is included only for authenticated users.

Expected latency: under 1 second for local reads; under 2 seconds for S3 reads + DynamoDB writes.
Lambda configuration (future AWS): `learnfyra-submit`, timeout 15 s, memory 256 MB, ARM_64.

### REQ-M04-003: Scoring Engine (src/solve/scorer.js)
**Priority:** P0
**Tasks:** M04-BE-03

`src/solve/scorer.js` SHALL export a single function `scoreWorksheet(worksheet, submittedAnswers)` that returns an array of per-question result objects. The scoring logic per question type SHALL be exactly:

| Type | Rule |
|---|---|
| multiple-choice | `studentAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase()` |
| true-false | `studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()` |
| fill-in-the-blank | `studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()` |
| short-answer | Case-insensitive: `keywords.some(kw => studentAnswer.toLowerCase().includes(kw.toLowerCase()))` where `keywords` is the `correctAnswer` split on `|` delimiter |
| matching | All pairs: `studentAnswers[i].trim().toLowerCase() === pair.answer.trim().toLowerCase()` for every pair |
| show-your-work | Score the `answer` subfield (final answer) only: `studentAnswer.answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()` |
| word-problem | Same as show-your-work: score the `answer` subfield only |

For unanswered questions (question number absent from `submittedAnswers`), the score SHALL be 0 points with `correct: false` and `studentAnswer: ""`.

Each result object SHALL include: `number`, `correct` (boolean), `studentAnswer` (string), `correctAnswer` (string), `explanation` (string, copied from solve-data.json), `pointsEarned` (integer), `pointsPossible` (integer).

### REQ-M04-004: Result Builder (src/solve/resultBuilder.js)
**Priority:** P0
**Tasks:** M04-BE-04

`src/solve/resultBuilder.js` SHALL export a function `buildResult(worksheet, perQuestionResults, submissionMeta)` that returns the complete response object:

```
{
  worksheetId,
  totalScore,        // sum of pointsEarned across all questions
  totalPoints,       // sum of pointsPossible
  percentage,        // Math.round((totalScore / totalPoints) * 100)
  timeTaken,         // from submissionMeta.timeTaken
  timed,             // from submissionMeta.timed
  attemptId,         // present only when submissionMeta.userId is set
  results            // array from scorer
}
```

`percentage` SHALL be computed as `Math.round((totalScore / totalPoints) * 100)` and capped at 100. If `totalPoints` is 0 (should not occur but must be handled), `percentage` SHALL be 0.

### REQ-M04-005: Path Traversal Guard
**Priority:** P0
**Tasks:** M04-BE-05

Both `solveHandler.js` and `submitHandler.js` SHALL validate `worksheetId` before any file system or S3 operation using the pattern specified in `04-api-contracts/solving-api.md` (RC-BE-02). Any `worksheetId` that does not match UUID v4 format SHALL return 400 with code `INVALID_WORKSHEET_ID` immediately, before any file path is constructed.

### REQ-M04-006: Express Routes in server.js
**Priority:** P0
**Tasks:** M04-BE-06

`server.js` SHALL be updated to add two routes that wrap the handlers in the same adapter pattern used by the existing `/api/generate` route:
- `GET /api/solve/:worksheetId` → calls `solveHandler.handler` with a synthetic Lambda event.
- `POST /api/submit` → calls `submitHandler.handler` with a synthetic Lambda event.

Both routes SHALL pass the `Authorization` header through to the handler so that guest vs. authenticated behavior works correctly on the local dev server.

### REQ-M04-007: Solve Page (frontend/solve.html)
**Priority:** P0
**Tasks:** M04-FE-01

`frontend/solve.html` SHALL render an interactive worksheet solve form. The page SHALL:
- Accept `?id={worksheetId}` as a query parameter and call `GET /api/solve/{worksheetId}` on load.
- Display the worksheet title, grade, subject, topic, and instructions.
- Present a mode selection screen before rendering questions: "Timed Mode" and "Untimed Mode" radio options, and a "Start" button.
- Render each question with the correct input type per REQ-M04-008.
- Include a "Submit" button that is always visible and calls `POST /api/submit`.
- On a 404 response from GET /api/solve, display "Worksheet not found or has expired."
- After submit, replace the question form with the results display per REQ-M04-009.

### REQ-M04-008: Question Type to Input Mapping
**Priority:** P0
**Tasks:** M04-FE-01, M04-FE-02

`frontend/js/solve.js` SHALL render the following input controls per question type:

| Question Type | UI Input Control | Answer Captured As |
|---|---|---|
| multiple-choice | Four radio buttons labeled A, B, C, D | Selected letter (e.g., "B") |
| true-false | Two radio buttons labeled "True" and "False" | Selected string ("True" or "False") |
| fill-in-the-blank | Single `<input type="text">` | Trimmed string |
| short-answer | `<textarea>` (4 rows) | String value |
| matching | One `<select>` dropdown per left-hand item, options from the right-hand items | Array of selected values in order |
| show-your-work | `<textarea>` for work (labeled "Show your work") + `<input type="text">` for final answer | Object `{ workShown, answer }` |
| word-problem | `<textarea>` for work + `<input type="text">` for final answer | Object `{ workShown, answer }` |

The `workShown` field for show-your-work and word-problem SHALL be included in the `POST /api/submit` request body but SHALL NOT be scored (per the scoring rules in REQ-M04-003).

### REQ-M04-009: Timer (Timed Mode)
**Priority:** P0
**Tasks:** M04-FE-02

When the student selects "Timed Mode" and clicks "Start":
- A visible countdown timer SHALL start from `timerSeconds` (returned by GET /api/solve).
- The timer SHALL display remaining time in MM:SS format.
- When the timer reaches 00:00, `POST /api/submit` SHALL be called automatically with the current state of all input fields, including unanswered questions (recorded as empty strings).
- The timer SHALL be implemented using `setInterval` with 1-second ticks. The elapsed time at submission SHALL be calculated as `timerSeconds - remainingSeconds`.

When the student selects "Untimed Mode":
- No timer is shown.
- The elapsed time recorded in the submission SHALL be the wall-clock time from clicking "Start" to clicking "Submit", measured in seconds using `Date.now()`.

### REQ-M04-010: Results Display
**Priority:** P0
**Tasks:** M04-FE-02

After a successful `POST /api/submit` response, `solve.js` SHALL replace the question form with a results view showing:
- Total score (e.g., "8 / 10") and percentage (e.g., "80%") displayed prominently.
- Time taken (displayed in MM:SS format).
- Per-question breakdown: question text, the student's answer, correct/incorrect indicator, correct answer (shown only for incorrect), and the explanation.
- A "Try Again" button that reloads `solve.html?id={worksheetId}` without the mode selection.
- A "Generate New Worksheet" button that navigates to `index.html`.

### REQ-M04-011: Guest Mode Behavior
**Priority:** P1
**Tasks:** M04-BE-02, M04-FE-01

When a guest (unauthenticated) user submits answers:
- The score SHALL be computed and returned identically to an authenticated submission.
- No `WorksheetAttempt` record SHALL be written to DynamoDB.
- The results page SHALL display a prompt: "Log in to save your progress and track your improvement."
- The `attemptId` field SHALL be absent from the API response.

---

## Acceptance Criteria

### AC-M04-001: GET /api/solve Strips Answer Fields
**Given** a worksheetId exists in storage
**When** `GET /api/solve/{worksheetId}` is called
**Then** the response contains all question fields except `answer` and `explanation`, and the HTTP status is 200

### AC-M04-002: options Field Absent on Non-Multiple-Choice Questions
**Given** a worksheet contains a `fill-in-the-blank` question
**When** `GET /api/solve/{worksheetId}` is called
**Then** the returned question object for that fill-in-the-blank item does NOT contain an `options` field

### AC-M04-003: Invalid worksheetId Returns 400
**Given** a request with `worksheetId = "../etc/passwd"` or any non-UUID string
**When** `GET /api/solve/{worksheetId}` is called
**Then** the response is 400 with code `INVALID_WORKSHEET_ID` and no file system operation is attempted

### AC-M04-004: Worksheet Not Found Returns 404
**Given** a valid UUID v4 worksheetId that has no corresponding solve-data.json in storage
**When** `GET /api/solve/{worksheetId}` is called
**Then** the response is 404 with code `WORKSHEET_NOT_FOUND`

### AC-M04-005: Timed Mode — Auto-Submit at Zero
**Given** a student is on `solve.html` in timed mode
**When** the countdown timer reaches 00:00
**Then** `POST /api/submit` is called automatically with the current values of all answer inputs and `timed: true`

### AC-M04-006: Untimed Mode — No Timer Displayed
**Given** a student selects "Untimed Mode" and clicks "Start"
**When** the question form renders
**Then** no countdown timer is visible on the page

### AC-M04-007: Submit Returns Full Scored Result
**Given** a student submits answers for a 10-question worksheet
**When** `POST /api/submit` returns 200
**Then** the response includes `totalScore`, `totalPoints`, `percentage`, `timeTaken`, `timed`, and a `results` array with exactly 10 items, each containing `correct`, `studentAnswer`, `correctAnswer`, `explanation`, `pointsEarned`, and `pointsPossible`

### AC-M04-008: Scoring — fill-in-the-blank Case Insensitive
**Given** a `fill-in-the-blank` question with `correctAnswer: "Photosynthesis"`
**When** the student submits `"photosynthesis"` (all lowercase)
**Then** the result for that question has `correct: true` and `pointsEarned` equals `points`

### AC-M04-009: Scoring — short-answer Keyword Match
**Given** a `short-answer` question with `correctAnswer: "osmosis|membrane|diffusion"`
**When** the student submits an answer that contains the word "osmosis"
**Then** the result for that question has `correct: true`

### AC-M04-010: Scoring — Unanswered Question Scores Zero
**Given** a worksheet with 10 questions and the student omits question 3 entirely from the submission
**When** scoring completes
**Then** question 3 appears in the results with `correct: false`, `studentAnswer: ""`, `pointsEarned: 0`

### AC-M04-011: Authenticated Attempt Persisted to DynamoDB
**Given** an authenticated student (valid JWT) submits answers
**When** scoring completes
**Then** a `WorksheetAttempt` record is written to `LearnfyraWorksheetAttempt-{env}` with PK=userId, SK=`{worksheetId}#{completedAt}`, and the `attemptId` field is present in the API response

### AC-M04-012: Guest Attempt Not Persisted
**Given** a guest (no Authorization header) submits answers
**When** scoring completes
**Then** no `WorksheetAttempt` record is written to DynamoDB, the results are returned in the API response, and the `attemptId` field is absent from the response

### AC-M04-013: Results Page Shows Per-Question Breakdown
**Given** a student receives a scored result
**When** the results view renders in `solve.html`
**Then** each question shows the student's answer, a correct/incorrect indicator, the correct answer for incorrect items, and the explanation

### AC-M04-014: Grade Boundary — Grade 1 Worksheet (5 Questions)
**Given** a Grade 1 worksheet with 5 questions (minimum question count)
**When** the full solve flow runs (GET /api/solve → answer form → POST /api/submit)
**Then** all 5 questions render with correct input types, scoring returns 5 result items, and the percentage is computed correctly

### AC-M04-015: Grade Boundary — Grade 10 Worksheet (30 Questions)
**Given** a Grade 10 worksheet with 30 questions (maximum question count)
**When** the full solve flow runs
**Then** all 30 questions render, scoring returns 30 result items, and no performance degradation occurs (submit handler completes in under 2 seconds)

### AC-M04-016: AWS Lambda Deployment — CORS Headers Present
**Given** the solve and submit handlers are deployed to API Gateway
**When** an OPTIONS preflight request is made to either endpoint
**Then** the response includes `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, and `Access-Control-Allow-Methods` headers and returns HTTP 200

---

## Local Development Requirements

This section applies before any AWS work begins. All acceptance criteria above MUST pass on `http://localhost:3000` before any Lambda deployment or CDK work begins for M04.

### Local Runtime Control
- `APP_RUNTIME=local` in `.env` switches `solveHandler` and `submitHandler` to read `solve-data.json` from `worksheets-local/{uuid}/solve-data.json`.
- No additional environment variables are needed to start local M04 development. The `solve-data.json` files are already being written by the generator (M03-BE-07 is DONE).

### No New Storage Setup Required
`solve-data.json` is already written to `worksheets-local/{uuid}/solve-data.json` by the existing `generateHandler.js` pipeline. The local solve flow works immediately after routes are wired in `server.js`. No Docker container, no DynamoDB table, and no seeding scripts are needed to start backend M04 work.

### Local Submit — Guest Mode for All Submissions
When `APP_RUNTIME=local`, the `submitHandler` SHALL operate in guest mode for all submissions regardless of whether an Authorization header is present. This means:
- Scoring runs normally.
- No `WorksheetAttempt` record is written to DynamoDB (DynamoDB is not required locally for M04).
- No call to `src/reporting/aggregator.js` is made locally.
- The full scored result is returned in the response body.

This guest-mode behavior applies only when `APP_RUNTIME=local`. When `APP_RUNTIME` is absent or set to `aws`, the handler reverts to the full authenticated/guest decision logic based on the JWT.

### Environment Variables for Local M04 Development
```
APP_RUNTIME=local          # Master switch for local mode
NODE_ENV=development       # General development flag
```
No `DB_ENDPOINT`, no `QB_ADAPTER`, and no DynamoDB table are required to run the M04 backend locally.

### Local Test Sequence
Before any AWS work begins, verify the following end-to-end sequence on `http://localhost:3000`:
1. Generate a worksheet via `POST /api/generate` — confirm `worksheets-local/{uuid}/solve-data.json` exists.
2. Call `GET /api/solve/{uuid}` — confirm 200 response, no `answer` or `explanation` fields in questions.
3. Call `GET /api/solve/not-a-uuid` — confirm 400 with `INVALID_WORKSHEET_ID`.
4. Call `GET /api/solve/00000000-0000-4000-8000-000000000000` — confirm 404 with `WORKSHEET_NOT_FOUND`.
5. Submit answers via `POST /api/submit` — confirm scored result with all 7 question-type scoring rules exercised.
6. Run `npm test` — all M04 unit tests pass.

### Frontend Template Note
**Awaiting UI template from product owner — do not implement M04-FE-01 through M04-FE-04 until UI template is received and M04 backend sprint is complete.**

---

## AWS Services Involved

| Service | Role |
|---|---|
| Lambda (`learnfyra-solve-{env}`) | Handles `GET /api/solve/{id}`. Timeout: 10 s, memory: 128 MB, ARM_64. Not yet deployed — code is Lambda-ready for Phase 2. |
| Lambda (`learnfyra-submit-{env}`) | Handles `POST /api/submit`. Timeout: 15 s, memory: 256 MB, ARM_64. Not yet deployed. |
| S3 (`learnfyra-{env}-s3-worksheets`) | Source of `solve-data.json` for both handlers. |
| DynamoDB (`LearnfyraWorksheetAttempt-{env}`) | Target for authenticated attempt writes from `submitHandler`. Task M05-CDK-001. |
| DynamoDB (`LearnfyraUsers-{env}`) | Updated by `src/reporting/aggregator.js` after each authenticated attempt (precomputed progress fields). |
| DynamoDB (`LearnfyraGenerationLog-{env}`) | Read by `solveHandler` to reconstruct the S3 date-path prefix from worksheetId. |
| API Gateway | Routes `GET /api/solve/{id}` and `POST /api/submit`. No auth required on either route (guest mode). |
| CloudFront / S3 frontend | Serves `solve.html`, `js/solve.js`, `css/solve.css`. |

---

## File Structure

```
src/solve/
  scorer.js           — scoreWorksheet(worksheet, submittedAnswers) → results[]
  resultBuilder.js    — buildResult(worksheet, results, submissionMeta) → response

backend/handlers/
  solveHandler.js     — Lambda handler for GET /api/solve/:worksheetId
  submitHandler.js    — Lambda handler for POST /api/submit

frontend/
  solve.html          — interactive solve page
  js/solve.js         — timer, input rendering, answer capture, submit, results
  css/solve.css       — solve page styles extending the main teal/orange theme

server.js             — ADD: GET /api/solve/:id and POST /api/submit routes

tests/unit/
  scorer.test.js       — all 7 question types, unanswered, boundary cases
  resultBuilder.test.js
  solveHandler.test.js — mock Lambda events, mock S3 reads
  submitHandler.test.js — mock Lambda events, mock S3, mock DynamoDB

tests/integration/
  solve.test.js        — full flow: generate → GET /api/solve → POST /api/submit → score
```

---

## Out of Scope
- Guided mode (hints available during solve) — deferred to Phase 2.
- Teacher review of student `workShown` content — stored in the attempt record but no UI exists in Phase 1.
- Re-attempt locking or maximum attempt limits per worksheet — Phase 2.
- Real-time collaborative solve sessions — not planned.
- Partial credit for short-answer questions (keyword match is all-or-nothing in Phase 1).
- Certificate auto-generation on submit — the frontend can call `POST /api/certificates/generate` explicitly after a qualifying score; `submitHandler` does not trigger it automatically.

---

## Dependencies

| Dependency | Status |
|---|---|
| M03-BE-07 (`solve-data.json` written on generation) | DONE |
| `04-api-contracts/solving-api.md` (frozen RC-BE-01, RC-BE-02) | FROZEN |
| M05 `src/reporting/aggregator.js` | TODO — `submitHandler` calls this; must be built in parallel with M04-BE-02 |
| M05-CDK-001 (`LearnfyraWorksheetAttempt` DynamoDB table) | TODO — required before AWS deploy of `submitHandler` |
| `LearnfyraGenerationLog-{env}` DynamoDB table | TODO (CDK-010) — required by `solveHandler` on AWS to resolve S3 prefix from worksheetId |
| `frontend/js/auth.js` (M01-FE-04) | TODO — `solve.js` calls `getAccessToken()` and `getAuthHeaders()` to attach JWT to submit requests |

---

## Open Questions

1. The `solveHandler` must reconstruct the S3 path (`worksheets/{year}/{month}/{day}/{uuid}/`) from a `worksheetId`. The spec proposes reading `LearnfyraGenerationLog` for the `s3Prefix`. In local mode, the worksheetId is used directly as the directory name (`worksheets-local/{uuid}/`). Is this the agreed approach, or should `solve-data.json` also be stored at a flat S3 key (`worksheets/{uuid}/solve-data.json`) to avoid the date-path lookup?
2. For `short-answer` scoring, the keyword delimiter `|` (pipe) is assumed but not currently documented in the stored schema. Should the `correctAnswer` field for short-answer questions use a pipe-delimited keyword list, or should a separate `keywords` array field be added to the worksheet JSON schema?
3. The matching question type: what is the exact format of a matching question in `solve-data.json`? The current schema shows `answer` as a string. Matching requires pairs. Does the `question` text encode the pairs, or is a `pairs` array field needed in the schema? This must be resolved before `scorer.js` and the matching input renderer can be implemented.
4. Should `solve.html` allow re-submission (multiple attempts) on the same worksheetId, or should a second submission on the same worksheetId for the same authenticated user be blocked?
