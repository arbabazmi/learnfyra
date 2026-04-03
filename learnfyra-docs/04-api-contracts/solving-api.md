# Solve & Submit API Contracts (M04)

**Status: UPDATED — feat/my-worksheets-tracking (2026-04-03)**
**Previous freeze: RC-BE-01 (2026-03-26)**

Path traversal hardening applied per RC-BE-02 (2026-03-26): worksheetId validated as UUID v4 before any file system or S3 operation.

---

## GET /api/solve/:worksheetId

Fetch worksheet questions for online solve.

**Behavior varies by `mode` query parameter:**
- Default (no `mode` param): answers and explanations are stripped — used for exam/test mode
- `mode=practice`: answers and explanations are **included** — used for self-study and review

**Auth:** None (guest solve allowed)

**Path Parameter:**
- `worksheetId`: UUID v4

**Query Parameters:**
- `mode` (optional): `practice` — when present, includes `answer` and `explanation` fields on each question

**Response 200 (default — exam mode, no `mode` param):**
```json
{
  "worksheetId": "uuid-v4",
  "title": "Grade 3 Math — Multiplication",
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "estimatedTime": "20 minutes",
  "timerSeconds": 1200,
  "totalPoints": 10,
  "instructions": "Solve each problem. Show your work where indicated.",
  "questions": [
    {
      "number": 1,
      "type": "multiple-choice",
      "question": "What is 6 × 7?",
      "options": ["A. 36", "B. 42", "C. 48", "D. 54"],
      "points": 1
    },
    {
      "number": 2,
      "type": "fill-in-the-blank",
      "question": "8 × 9 = ___",
      "points": 1
    },
    {
      "number": 3,
      "type": "show-your-work",
      "question": "A baker makes 7 batches of 12 cookies. How many cookies total?",
      "points": 2
    }
  ]
}
```

**Response 200 (`mode=practice` — includes answers and explanations):**
```json
{
  "worksheetId": "uuid-v4",
  "title": "Grade 3 Math — Multiplication",
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "estimatedTime": "20 minutes",
  "timerSeconds": 1200,
  "totalPoints": 10,
  "instructions": "Solve each problem. Show your work where indicated.",
  "questions": [
    {
      "number": 1,
      "type": "multiple-choice",
      "question": "What is 6 × 7?",
      "options": ["A. 36", "B. 42", "C. 48", "D. 54"],
      "points": 1,
      "answer": "B",
      "explanation": "6 × 7 = 42"
    },
    {
      "number": 2,
      "type": "fill-in-the-blank",
      "question": "8 × 9 = ___",
      "points": 1,
      "answer": "72",
      "explanation": "8 × 9 = 72"
    }
  ]
}
```

**Question type field reference:**

| Type | Fields in exam mode | Additional fields in practice mode |
|---|---|---|
| multiple-choice | `number`, `type`, `question`, `options`, `points` | `answer`, `explanation` |
| true-false | `number`, `type`, `question`, `points` | `answer`, `explanation` |
| fill-in-the-blank | `number`, `type`, `question`, `points` | `answer`, `explanation` |
| short-answer | `number`, `type`, `question`, `points` | `answer`, `explanation` |
| matching | `number`, `type`, `question`, `leftItems`, `rightItems`, `points` | `answer`, `explanation` |
| show-your-work | `number`, `type`, `question`, `points` | `answer`, `explanation` |
| word-problem | `number`, `type`, `question`, `points` | `answer`, `explanation` |

For `matching`, the response exposes the left and right items as separate shuffled arrays so the student can draw connections — the correct pairings (`pairs`) are **never** sent to the client in either mode:
```json
{
  "number": 4,
  "type": "matching",
  "question": "Match each planet to its position from the Sun.",
  "leftItems": ["Mercury", "Venus", "Earth", "Mars"],
  "rightItems": ["1st", "4th", "2nd", "3rd"],
  "points": 4
}
```
The `rightItems` array is shuffled server-side on every request. The student's submit answer for matching is an array of `{ left, right }` pairs.

**Security invariants:**
- `answer` and `explanation` are NEVER included when `mode` is absent or any value other than `practice`
- `pairs` (the correct pairings for matching) are NEVER sent to the client in any mode — only `leftItems` and `rightItems`
- `options` is ONLY present for `type: "multiple-choice"`
- `worksheetId` is validated as UUID v4 format (rejects path traversal attempts)

**Error 404 — Worksheet not found:**
```json
{ "error": "Not Found", "code": "WORKSHEET_NOT_FOUND" }
```

**Error 404 — Worksheet expired:**
```json
{ "error": "Not Found", "code": "WORKSHEET_EXPIRED" }
```

**Error 400 — Invalid worksheetId format:**
```json
{ "error": "Bad Request", "code": "INVALID_WORKSHEET_ID" }
```

---

## POST /api/submit

Submit student answers and receive scored results with explanations.

**Auth:** Optional Bearer token. Guest submissions are scored but not persisted.

**Request:**
```json
{
  "worksheetId": "uuid-v4",
  "studentName": "Optional Student Name",
  "answers": [
    { "number": 1, "answer": "B" },
    { "number": 2, "answer": "72" },
    { "number": 3, "answer": "84", "workShown": "7 × 12 = 84" }
  ],
  "timeTaken": 845,
  "timed": true
}
```

**Field notes:**
- `answers`: array of answer objects, one per question attempted (unanswered questions can be omitted — they score 0)
- `number`: question number (1-indexed, matching the questions in the solve response)
- `answer`: the student's answer string
- `workShown`: optional — only captured for show-your-work and word-problem types, stored for teacher review but not scored
- `timeTaken`: seconds elapsed (integer)
- `timed`: whether the student was in timed mode

**Response 200:**
```json
{
  "worksheetId": "uuid-v4",
  "totalScore": 8,
  "totalPoints": 10,
  "percentage": 80,
  "timeTaken": 845,
  "timed": true,
  "attemptId": "userId#worksheetId#2026-03-28T12:00:00Z",
  "results": [
    {
      "number": 1,
      "correct": true,
      "studentAnswer": "B",
      "correctAnswer": "B",
      "explanation": "6 × 7 = 42",
      "pointsEarned": 1,
      "pointsPossible": 1
    },
    {
      "number": 2,
      "correct": false,
      "studentAnswer": "63",
      "correctAnswer": "72",
      "explanation": "8 × 9 = 72",
      "pointsEarned": 0,
      "pointsPossible": 1
    },
    {
      "number": 3,
      "correct": true,
      "studentAnswer": "84",
      "correctAnswer": "84",
      "explanation": "7 batches × 12 cookies = 84 cookies",
      "pointsEarned": 2,
      "pointsPossible": 2
    }
  ]
}
```

Note: `attemptId` is only present in the response when the student is authenticated (not guest).

**Error 400 — Missing worksheetId:**
```json
{ "error": "Bad Request", "code": "MISSING_WORKSHEET_ID" }
```

**Error 404 — Worksheet not found:**
```json
{ "error": "Not Found", "code": "WORKSHEET_NOT_FOUND" }
```

**Error 400 — No answers provided:**
```json
{ "error": "Bad Request", "code": "NO_ANSWERS_PROVIDED" }
```

**Error 400 — Answer number out of range:**
```json
{ "error": "Bad Request", "code": "INVALID_QUESTION_NUMBER", "details": "Question 15 does not exist in this worksheet" }
```

---

## GET /api/dashboard/stats

Get aggregate stats for the authenticated user's dashboard.

**Auth:** Bearer token required

**Lambda:** `learnfyra-dashboard`
**Expected latency:** p50 < 300ms, p99 < 1s

**Response 200:**
```json
{
  "totalWorksheets": 12,
  "newWorksheets": 4,
  "inProgress": 3,
  "worksheetsDone": 5,
  "avgScore": 78.5,
  "streak": 3,
  "lastActive": "2026-04-02T14:00:00Z"
}
```

**Field definitions:**
- `totalWorksheets`: total count of worksheets generated by this user (from `LearnfyraGenerationLog` via `createdBy-index`)
- `newWorksheets`: count of worksheets the user has generated but never attempted (status = `new`)
- `inProgress`: count of unique worksheets where the user's most recent attempt is in-progress (not yet fully scored)
- `worksheetsDone`: count of unique worksheets where the user has at least one completed (scored) attempt. Counts each worksheet once regardless of retake attempts.
- `avgScore`: mean percentage across all completed attempts
- `streak`: consecutive days with at least one completed attempt
- `lastActive`: ISO-8601 timestamp of the most recent attempt

**Counting rules:**
- `worksheetsDone` de-duplicates by worksheetId. If a user completes the same worksheet 3 times, it counts as 1 done.
- `inProgress` de-duplicates by worksheetId. Uses the most recent attempt per worksheetId.
- `newWorksheets` = `totalWorksheets` minus worksheets that have any attempt record.

**Error 401 — No token:**
```json
{ "error": "Unauthorized", "code": "MISSING_TOKEN" }
```

---

## GET /api/dashboard/recent-worksheets

Get recently generated worksheets for the authenticated user's dashboard feed.

**Auth:** Bearer token required

**Lambda:** `learnfyra-dashboard`
**Expected latency:** p50 < 300ms, p99 < 1s

**Response 200:**
```json
{
  "worksheets": [
    {
      "id": "uuid-v4",
      "title": "Grade 3 Math — Multiplication",
      "subject": "Math",
      "grade": 3,
      "topic": "Multiplication",
      "difficulty": "Medium",
      "questionCount": 10,
      "status": "completed",
      "score": 85,
      "createdAt": "2026-03-28T12:00:00Z"
    },
    {
      "id": "uuid-v4",
      "title": "Grade 5 Science — Ecosystems",
      "subject": "Science",
      "grade": 5,
      "topic": "Ecosystems",
      "difficulty": "Hard",
      "questionCount": 15,
      "status": "new",
      "score": null,
      "createdAt": "2026-04-01T09:00:00Z"
    }
  ]
}
```

**Behavior:**
- Returns generated worksheets (from `LearnfyraGenerationLog` queried via `createdBy-index`), sorted by `createdAt` descending
- `id` is the `worksheetId` (slug) — used as the URL identifier in the frontend
- `status` is derived from attempt data: `new` / `in-progress` / `completed` (same derivation rules as `GET /api/worksheets/mine`)
- `score` is the percentage from the most recent completed attempt, or null if status is `new`
- `createdAt` is the `generatedAt` timestamp from `LearnfyraGenerationLog`
- Returns up to 10 most recent worksheets (not paginated — for dashboard display only)

**Previous behavior (deprecated):** This endpoint previously returned attempt records only (worksheets that had been solved). It now returns all generated worksheets regardless of attempt status.

**Error 401 — No token:**
```json
{ "error": "Unauthorized", "code": "MISSING_TOKEN" }
```

---

## Scoring Rules by Question Type

| Type | Rule | Notes |
|---|---|---|
| multiple-choice | `studentAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase()` | Letter only (A/B/C/D) |
| true-false | `studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()` | "true" or "false" |
| fill-in-the-blank | `studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()` | Exact match, case-insensitive |
| short-answer | Any keyword from pipe-delimited `answer` field appears in student answer | `answer.split('\|')` → keyword list; case-insensitive containment check |
| matching | Student submits `[{ left, right }]`; each pair scored independently | Case-insensitive per pair; partial credit = pairs correct / total pairs |
| show-your-work | Score `finalAnswer` field only (same as fill-in-the-blank) | workShown stored but not scored |
| word-problem | Score `finalAnswer` field only (same as fill-in-the-blank) | workShown stored but not scored |

---

## Security: Path Traversal Hardening (RC-BE-02)

WorksheetId must match this pattern before any file or S3 operation:

```javascript
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateWorksheetId(id) {
  if (!id || !UUID_V4_PATTERN.test(id)) {
    throw new ValidationError('INVALID_WORKSHEET_ID');
  }
  return id;
}
```

This prevents path traversal attacks such as `worksheetId = "../../../etc/passwd"`.

---

## Integration Contracts

### solveHandler reads from:
- AWS: `S3: worksheets/{year}/{month}/{day}/{worksheetId}/solve-data.json`
- Local: `worksheets-local/{worksheetId}/solve-data.json`

The handler reconstructs the S3 prefix from the worksheetId by first reading:
`S3: worksheets-local/{worksheetId}/metadata.json` (contains `generatedAt` → used to construct the date path)

Or by looking up `worksheetId` in `LearnfyraGenerationLog` DynamoDB table (which stores the full `s3Prefix`).

### submitHandler reads from:
Same source as solveHandler, then compares submitted answers to `question.answer` fields in the stored JSON.

### submitHandler writes to (authenticated users only):
- DynamoDB: `LearnfyraWorksheetAttempt` (PK=userId, SK=worksheetId#{timestamp})
- DynamoDB: `LearnfyraUsers` (update precomputed progress aggregates)

### dashboardHandler reads from:
- DynamoDB: `LearnfyraGenerationLog` via `createdBy-index` GSI (PK=createdBy, SK=createdAt) — for `totalWorksheets`, `newWorksheets`, and `recent-worksheets`
- DynamoDB: `LearnfyraWorksheetAttempt` (Query by userId) — for `inProgress`, `worksheetsDone`, `avgScore`, `streak`
- DynamoDB: `LearnfyraUsers` — for precomputed aggregates (fallback / cross-check)
