# M04: Solve and Submit Spec
Status: implementation-ready contract
Priority: P1
Owner: Solve Team

## Purpose
Define the backend contract for the student solve flow so that:
- solve responses expose enough worksheet data to render the activity,
- answers and explanations are never leaked by the solve endpoint,
- submit responses return deterministic scoring and review data,
- M04-BE-02 can tighten validation without breaking the current local flow.

## Scope
- Timed and untimed solve flows.
- Worksheet retrieval for student solving.
- Submission payload contract.
- Deterministic scoring and result breakdown.
- Validation and error rules.
- No-answer-leakage guarantees.

## Out Of Scope
- Frontend timer UI implementation.
- Authentication and persistence of student attempt history.
- AWS storage wiring.
- Teacher analytics/reporting.
- Partial-credit rubric authoring beyond current scorer rules.

## API Surface
- GET /api/solve/:worksheetId
- POST /api/submit

## Security Principles
1. The solve endpoint must not return answer, explanation, or any equivalent correctness hint.
2. Worksheet lookup must reject malformed identifiers and path traversal attempts.
3. Submit must score only against stored authoritative worksheet data, never against client-supplied correct answers.
4. Optional student identity fields must not be required for scoring and must not weaken validation.

## GET /api/solve/:worksheetId

### Purpose
Return a worksheet payload suitable for online solving while stripping protected answer data.

### Path Parameters
- worksheetId: required UUID v4.

### Success Response

```json
{
	"worksheetId": "12345678-1234-4123-8123-123456789abc",
	"grade": 3,
	"subject": "Math",
	"topic": "Multiplication",
	"difficulty": "Medium",
	"estimatedTime": "20 minutes",
	"timerSeconds": 1200,
	"totalPoints": 10,
	"questions": [
		{
			"number": 1,
			"type": "multiple-choice",
			"question": "What is 6 x 7?",
			"options": ["A. 36", "B. 42", "C. 48", "D. 54"],
			"points": 1
		},
		{
			"number": 2,
			"type": "show-your-work",
			"question": "Solve 42 / 6.",
			"points": 1
		}
	]
}
```

Response rules:
- answer must not appear in any question object.
- explanation must not appear in any question object.
- All renderable fields needed by the frontend must be preserved.
- questions must preserve order and question numbers from stored solve-data.
- CORS headers are required on success and error responses.

### Error Responses

400:

```json
{
	"error": "Invalid worksheetId format.",
	"code": "SOLVE_INVALID_WORKSHEET_ID"
}
```

404:

```json
{
	"error": "Worksheet not found.",
	"code": "SOLVE_NOT_FOUND"
}
```

500:

```json
{
	"error": "Internal server error.",
	"code": "SOLVE_INTERNAL_ERROR"
}
```

### Validation Rules
- worksheetId is required.
- worksheetId must match UUID v4 format.
- worksheetId must resolve only within the solve-data storage root.
- Missing or unreadable solve-data for a valid ID returns 404.

## POST /api/submit

### Purpose
Accept a student submission, score it against stored solve-data, and return a complete review breakdown.

### Request Body

Stable required fields:

```json
{
	"worksheetId": "12345678-1234-4123-8123-123456789abc",
	"answers": [
		{ "number": 1, "answer": "B" },
		{ "number": 2, "answer": "24" }
	]
}
```

Optional fields already tolerated by current backend:

```json
{
	"timeTaken": 845,
	"timed": true,
	"studentName": "optional string"
}
```

Request rules:
- worksheetId is required.
- answers is required and must be an array.
- Each answer entry should contain number and answer.
- timeTaken is optional and defaults to 0 when omitted or invalid in current implementation.
- timed is optional and coerces to boolean in current implementation.
- studentName is optional and ignored by current scoring logic.

### Success Response

```json
{
	"worksheetId": "12345678-1234-4123-8123-123456789abc",
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
			"correctAnswer": "B. 42",
			"explanation": "6 x 7 = 42",
			"pointsEarned": 1,
			"pointsPossible": 1
		},
		{
			"number": 2,
			"correct": false,
			"studentAnswer": "25",
			"correctAnswer": "24",
			"explanation": "4 x 6 = 24",
			"pointsEarned": 0,
			"pointsPossible": 1
		}
	]
}
```

Response rules:
- The result must include one result entry per worksheet question, even when the student omitted answers.
- totalScore is the sum of pointsEarned across all result entries.
- totalPoints is the sum of question points when available, else worksheet.totalPoints fallback.
- percentage is rounded to the nearest integer and capped at 100.
- timeTaken and timed are echoed from normalized request input.
- correctAnswer and explanation are intentionally exposed in submit responses so students can review mistakes after submission.

### Error Responses

400:

```json
{
	"error": "answers must be an array.",
	"code": "SUBMIT_INVALID_REQUEST"
}
```

404:

```json
{
	"error": "Worksheet not found.",
	"code": "SUBMIT_NOT_FOUND"
}
```

500:

```json
{
	"error": "Internal server error.",
	"code": "SUBMIT_INTERNAL_ERROR"
}
```

### Validation Rules
- worksheetId is required.
- worksheetId must match UUID v4 format.
- answers must be an array.
- Missing solve-data for a valid worksheetId returns 404.
- Current backend tolerates omitted timeTaken and timed values.
- M04-BE-02 should add stricter per-entry validation without breaking existing valid request shapes.

## Scoring Rule Matrix

| Question Type | Student Input Shape | Comparison Rule | Points Rule |
|---|---|---|---|
| multiple-choice | string | Compare option letter only, normalized to uppercase | full points on exact letter match |
| true-false | string | case-insensitive normalized exact match | full points or 0 |
| fill-in-the-blank | string | case-insensitive, whitespace-normalized exact match | full points or 0 |
| short-answer | string | every keyword from stored answer must appear in normalized student text | full points or 0 |
| matching | array of `{ left, right }` | compare normalized pair mapping by left key | proportional partial credit, rounded, capped at question points |
| show-your-work | string or object with `finalAnswer` | score final answer only | full points or 0 |
| word-problem | string or object with `finalAnswer` | score final answer only | full points or 0 |
| unknown type | any | unsupported types score incorrect | 0 |

Additional scoring rules:
- Empty, null, undefined, or missing student answers score 0.
- Matching questions award partial credit based on the proportion of correct pairs.
- The authoritative correct answer comes from stored solve-data, not the client payload.

## Solve Data Contract

Stored solve-data.json must contain:
- worksheetId
- grade
- subject
- topic
- difficulty
- estimatedTime
- timerSeconds
- totalPoints
- questions[] with authoritative answer and explanation fields present for scoring

Solve response projection removes from each question:
- answer
- explanation

Submit scoring requires from each stored question:
- number
- type
- answer
- explanation
- points when available

## Compatibility Notes
- Current solveHandler and submitHandler return Lambda-compatible `{ statusCode, headers, body }` responses and must keep that shape.
- Current solve responses do not require authentication context.
- Current submit responses do not persist attempts or user identity.
- Optional machine-readable code fields are additive and should be introduced without removing existing error strings.
- M04-BE-02 should preserve all currently accepted valid request bodies.

## Edge Cases To Preserve
- Solve must return 404 for unknown worksheet IDs.
- Submit must return one result entry per question even when answers is an empty array.
- Grade 1 worksheets with 5 questions and Grade 10 worksheets with 30 questions must both be supported.
- Percentage must not exceed 100 even if worksheet.totalPoints is mismatched.
- OPTIONS must return 200 with CORS headers for both endpoints.

## Acceptance Criteria
Given a valid worksheetId
When GET /api/solve/:worksheetId is called
Then the response includes worksheet metadata and renderable questions without answer or explanation leakage.

Given a malformed or missing worksheetId
When GET /api/solve/:worksheetId is called
Then the response returns 400 with CORS headers.

Given a valid submission payload
When POST /api/submit is called
Then the response returns totalScore, totalPoints, percentage, timeTaken, timed, and one result entry per worksheet question.

Given a submission with empty or missing answers for some questions
When POST /api/submit is called
Then unanswered questions score 0 and still appear in the results array.

Given matching, multiple-choice, fill-in-the-blank, short-answer, show-your-work, and word-problem questions
When scoring runs
Then each question type is scored according to the rule matrix in this contract.

Given an unknown worksheetId
When either solve or submit is called
Then the response returns 404 with CORS headers and no internal path details.
