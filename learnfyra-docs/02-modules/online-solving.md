# M04 — Online Solve & Submit

## Module Summary

M04 enables students to solve worksheets online without printing. It handles:
- Fetching worksheet questions (without answers)
- Rendering an interactive solve form
- Timed and untimed modes
- Submitting answers and receiving instant scored feedback with explanations

## Solve Flow

```
Teacher / Student / Parents generates worksheet → worksheetId returned
     │
     └── "Solve Online" button in UI
           │
           ▼
     GET /api/solve/{worksheetId}
           │
           └── returns questions ONLY (no answers, no explanations)
                     │
                     ▼
             solve.html renders interactive form
                     │
             Student chooses:
               [x] Timed mode  → countdown timer from estimatedTime
               [ ] Untimed mode → no timer
                     │
             Student fills answers → clicks Submit
             (or timer expires — auto-submit)
                     │
                     ▼
     POST /api/submit
     {worksheetId, answers[], timeTaken, timed, studentName?}
                     │
                     ▼
     Server scores answers → returns result JSON
                     │
                     ▼
             Results page:
               Total score (e.g., 8/10 — 80%)
               Per-question: correct/incorrect + explanation
               Time taken
               "Try Again" / "Generate New" buttons
```

## Question Type → Input Mapping

| Question Type | UI Input | Scoring Rule |
|---|---|---|
| multiple-choice | Radio buttons (A/B/C/D) | Exact match on option letter |
| true-false | Radio buttons (True/False) | Exact match |
| fill-in-the-blank | Text input | Case-insensitive, trimmed string match |
| short-answer | Textarea | Case-insensitive keyword match |
| matching | Dropdown selects for each pair | Exact match per pair |
| show-your-work | Textarea + final answer input | Score final answer field only |
| word-problem | Textarea + final answer input | Score final answer field only |

## Scoring Rules (src/solve/scorer.js)

```javascript
// multiple-choice: normalize to uppercase letter
studentAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase()

// fill-in-the-blank: case-insensitive trim
studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()

// short-answer: keyword match (any key keyword present)
keywords.some(kw => studentAnswer.toLowerCase().includes(kw.toLowerCase()))

// true-false: normalize casing
['true', 'false'].includes(studentAnswer.trim().toLowerCase()) &&
studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()

// matching: exact per pair
pairs.every((pair, i) => studentAnswers[i].toLowerCase() === pair.answer.toLowerCase())

// show-your-work / word-problem: score only the finalAnswer field
finalAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
```

## GET /api/solve/{worksheetId} — Response

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
    }
  ]
}
```

The `answer` and `explanation` fields are stripped from every question before returning to the client.

## POST /api/submit — Request

```json
{
  "worksheetId": "uuid-v4",
  "studentName": "optional string",
  "answers": [
    { "number": 1, "answer": "B" },
    { "number": 2, "answer": "72" }
  ],
  "timeTaken": 845,
  "timed": true
}
```

## POST /api/submit — Response

```json
{
  "worksheetId": "uuid-v4",
  "totalScore": 8,
  "totalPoints": 10,
  "percentage": 80,
  "timeTaken": 845,
  "timed": true,
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
    }
  ]
}
```

## Attempt Modes

| Mode | Description | Timer |
|---|---|---|
| practice | Untimed, see explanations immediately | None |
| test | Timed, no hints, auto-submit on expiry | Countdown from timerSeconds |
| guided | Hints available (Phase 2) | Optional |

## Attempt Storage (WorksheetAttempt)

Attempts are stored in DynamoDB for authenticated users only. Guest attempts are scored and returned but not persisted.

```
Table: LearnfyraWorksheetAttempt-{env}
PK: userId (String)
SK: worksheetId#{timestamp} (String)
```

| Attribute | Type | Description |
|---|---|---|
| userId | String | PK — student's user ID |
| sortKey | String | SK — `{worksheetId}#{ISO-8601}` |
| worksheetId | String | UUID of the worksheet |
| grade | Number | Worksheet grade |
| subject | String | Worksheet subject |
| topic | String | Worksheet topic |
| score | Number | Points earned |
| totalPoints | Number | Points possible |
| percentage | Number | score/totalPoints * 100 |
| timeTaken | Number | Seconds taken |
| timed | Boolean | Was timed mode used |
| answers | Map | Submitted answers per question number |
| completedAt | String | ISO-8601 timestamp |

## File Structure

```
src/solve/
  scorer.js          — answer comparison logic per question type
  resultBuilder.js   — builds score summary + per-question breakdown

backend/handlers/
  solveHandler.js    — Lambda handler for GET /api/solve/:worksheetId
  submitHandler.js   — Lambda handler for POST /api/submit

frontend/
  solve.html         — interactive solve page
  js/solve.js        — timer, answer capture, submit, results rendering
  css/solve.css      — solve page styles matching main theme
```

## Storage: solve-data.json

The authoritative worksheet JSON (with answers) is stored as `solve-data.json`:

- AWS: `s3://learnfyra-{env}-s3-worksheets/worksheets/{year}/{month}/{day}/{uuid}/solve-data.json`
- Local: `worksheets-local/{uuid}/solve-data.json`

The `solveHandler` reads this file and strips answers before returning to the client.
The `submitHandler` reads this file to score the submitted answers.

## Acceptance Criteria

**AC-1:** Given a worksheetId exists in storage, when GET /api/solve/{worksheetId} is called, then the response contains questions without `answer` or `explanation` fields.

**AC-2:** Given the student selects Timed Mode, when the page loads, then a countdown timer starts from `timerSeconds` and the form auto-submits when it reaches zero.

**AC-3:** Given the student selects Untimed Mode, when the page loads, then no timer is displayed and the submit button is always available.

**AC-4:** Given the student submits answers, when POST /api/submit is called, then the response includes `totalScore`, `percentage`, and per-question `correct`, `correctAnswer`, `explanation`, and `pointsEarned`.

**AC-5:** Given the student is logged in and submits, when scoring completes, then a WorksheetAttempt record is written to DynamoDB with the score and answers.

**AC-6:** Given the student is a guest, when scoring completes, then the score is returned in the response but no DynamoDB record is written.

**AC-7:** Given a `fill-in-the-blank` question with answer "Photosynthesis", when the student submits "photosynthesis" (lowercase), then the answer is marked correct.

**AC-8:** Given a `short-answer` question with keywords ["osmosis", "membrane", "diffusion"], when the student answer includes "osmosis", then the answer is marked correct.
