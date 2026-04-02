# Solve & Submit API Contracts (M04)

**Status: UPDATED — April 2, 2026**

- Path traversal hardening applied per RC-BE-02 (2026-03-26): worksheetId validated before any operation.
- **April 2, 2026:** Solve endpoint now accepts SEO-friendly slugs in addition to UUIDs. Data source changed from S3 `solve-data.json` to DynamoDB `LearnfyraWorksheets` table.

---

## GET /api/solve/:identifier

Fetch worksheet questions for online solve. Answers and explanations are stripped from the response.

**Auth:** Bearer JWT required

**Path Parameter:**
- `identifier`: UUID v4 **or** SEO-friendly slug (e.g. `grade-3-math-multiplication-easy-a1b2c3`)

**Identifier Resolution:**
- If the identifier matches UUID v4 format → DynamoDB GetItem on `worksheetId` PK
- If the identifier matches slug format (lowercase alphanumeric + hyphens, 10-80 chars) → DynamoDB Query on `slug-index` GSI
- Otherwise → 400 Bad Request

**Response 200:**
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

**Question type field reference:**

| Type | Fields present in response | Fields absent |
|---|---|---|
| multiple-choice | `number`, `type`, `question`, `options`, `points` | `answer`, `explanation`, `pairs` |
| true-false | `number`, `type`, `question`, `points` | `answer`, `explanation`, `options`, `pairs` |
| fill-in-the-blank | `number`, `type`, `question`, `points` | `answer`, `explanation`, `options`, `pairs` |
| short-answer | `number`, `type`, `question`, `points` | `answer`, `explanation`, `options`, `pairs` |
| matching | `number`, `type`, `question`, `leftItems`, `rightItems`, `points` | `answer`, `explanation`, `pairs` (server-side only) |
| show-your-work | `number`, `type`, `question`, `points` | `answer`, `explanation`, `options`, `pairs` |
| word-problem | `number`, `type`, `question`, `points` | `answer`, `explanation`, `options`, `pairs` |

For `matching`, the response exposes the left and right items as separate shuffled arrays so the student can draw connections — the correct pairings (`pairs`) are **never** sent to the client:
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

**Invariants:**
- `answer` field is NEVER included in any question in this response
- `explanation` field is NEVER included in any question in this response
- `pairs` (the correct pairings) are NEVER sent to the client — only `leftItems` and `rightItems`
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
- **AWS:** DynamoDB `LearnfyraWorksheets-{env}` table — by UUID (PK) or slug (slug-index GSI)
- **Local:** `worksheets-local/{worksheetId}/solve-data.json` (filesystem)

### submitHandler reads from:
- **AWS:** DynamoDB `LearnfyraWorksheets-{env}` table — by UUID (PK only, submit always receives UUID)
- **Local:** `worksheets-local/{worksheetId}/solve-data.json` (filesystem)

Compares submitted answers to `question.answer` fields in the stored record.

### submitHandler writes to (authenticated users only):
- DynamoDB: `LearnfyraWorksheetAttempt` (PK=userId, SK=worksheetId#{timestamp})
- DynamoDB: `LearnfyraUsers` (update precomputed progress aggregates)

### generateHandler writes to:
- DynamoDB: `LearnfyraWorksheets-{env}` — full worksheet record with questions, answers, metadata, slug
- S3: `worksheets/{date}/{uuid}/worksheet.html` — rendered worksheet for download
- S3: `worksheets/{date}/{uuid}/answer-key.html` — rendered answer key for download
- ~~S3: `worksheets/{date}/{uuid}/solve-data.json`~~ — **REMOVED** (April 2, 2026, replaced by DynamoDB)

### SEO URL Format
```
Before: /solve/88b4e517-2cd7-4c34-a889-7885014d73d0
After:  /solve/grade-3-math-multiplication-easy-88b4e5
```
Both formats work. The generate endpoint returns `slug` in its response for building shareable URLs.
