# Online Solve & Answer Validation — Implementation Spec
# File: docs/specs/online-solve-spec.md
# Version: 1.0
# Author: BA Agent
# Date: 2026-03-24
# Branch: feature/online-solve

---

## Feature: Online Solve & Answer Validation

### User Story
As a student,
I want to solve a generated worksheet online, choose timed or untimed mode, and receive instant
scored feedback with explanations,
So that I can practice and self-study without printing.

As a teacher,
I want students to get immediate per-question feedback with correct answers and explanations,
So that the worksheet can serve as a self-grading practice tool.

### Acceptance Criteria

Given a worksheet has been generated and solve-data.json exists in worksheets-local/{uuid}/
When the student calls GET /api/solve/:worksheetId
Then the response is 200 with questions array stripped of answer and explanation fields
And the response includes worksheetId, grade, subject, topic, difficulty, estimatedTime,
timerSeconds, and totalPoints

Given the student is on solve.html in Timed Mode
When the page loads
Then a countdown timer displays starting from timerSeconds
And when the timer reaches zero the form auto-submits with whatever answers are filled in

Given the student is on solve.html in Untimed Mode
When the page loads
Then no timer is displayed
And the student may submit at any time by clicking "Submit Answers"

Given the student submits answers via POST /api/submit
When the handler reads solve-data.json and runs the scoring engine
Then the response is 200 with totalScore, totalPoints, percentage, timeTaken, timed, and a
results array with one entry per question containing correct, studentAnswer, correctAnswer,
explanation, pointsEarned, and pointsPossible

Given the student is logged in and solving in onsite mode
When POST /api/submit completes scoring successfully
Then the scored result is persisted and linked to that student identity for future reporting

Given a worksheetId that does not exist in worksheets-local/
When GET /api/solve/:worksheetId is called
Then the response is 404 with { error: "Worksheet not found." }

Given a worksheetId that does not exist in worksheets-local/
When POST /api/submit is called with that worksheetId
Then the response is 404 with { error: "Worksheet not found." }

Given a new worksheet is generated via POST /api/generate
When the generation and export steps complete
Then solve-data.json is written to worksheets-local/{uuid}/ containing the full worksheet JSON
with all questions including answer and explanation fields
And the generate response includes worksheetId in the metadata object

### AWS Services Involved
- Local dev: filesystem only (worksheets-local/{uuid}/solve-data.json)
- AWS (deferred): S3 GetObjectCommand on learnfyra-{env}-s3-worksheets bucket,
  key pattern worksheets/{year}/{month}/{day}/{uuid}/solve-data.json
- Local dev (logged-in onsite submissions): filesystem write for persisted results at
  worksheets-local/{worksheetId}/results/{studentId}/{resultId}.json
- AWS (deferred, logged-in onsite submissions): S3 PutObjectCommand to
  worksheets/{year}/{month}/{day}/{worksheetId}/results/{studentId}/{resultId}.json
- Lambda functions: learnfyra-solve (128 MB, 10s timeout), learnfyra-submit (256 MB, 15s timeout)
  — handlers are written Lambda-ready but NOT deployed in this phase

### Out of Scope
- Persisting results for guest users or offline mode attempts
- Teacher dashboard or result aggregation
- AWS Lambda deployment of solveHandler and submitHandler (Phase 5, separate branch)
- CDK stack changes (deferred)
- Implementing student authentication or login flows in this module (auth is handled by the auth module; this module consumes logged-in user context)
- Re-attempt tracking (the "Try Again" button simply reloads solve.html)
- Partial scoring for short-answer (either full points or zero — no partial credit)

### Dependencies
- worksheets-local/{uuid}/ directory written by the existing POST /api/generate route in server.js
- sampleWorksheet.json fixture must be used as the base for test fixtures
- express is already a devDependency and the dev server is in server.js
- No new npm dependencies are required

### Open Questions

OQ-1: RESOLVED — Multiple-choice answers are stored in "letter+text" format (for example,
"B. 56") based on the generation prompt example and existing fixtures. scorer.js must normalize
both the stored answer and student input via extractOptionLetter() so comparison is letter-only.
This keeps scoring dual-tolerant for stored values like "B. 56" and student inputs like "B" or
"B. 56". No migration is required for existing worksheets.

OQ-2: The matching question type is specified in CLAUDE.md but does not appear in
sampleWorksheet.json and has no fixture data. DEV should implement the scoring rule but QA
should create a hand-crafted fixture rather than waiting for a real Claude response.

OQ-3: timerSeconds is not currently included in the Claude-generated worksheet JSON — it must
be derived from estimatedTime. Agreed derivation: strip non-numeric characters, treat the
integer as minutes, multiply by 60. If estimatedTime is missing or unparseable, default to 1200
(20 minutes). DEV must apply this derivation when writing solve-data.json.

OQ-4: server.js currently places all exported files directly in worksheets-local/ (not in a
uuid subdirectory). POST /api/generate must be modified to write files to
worksheets-local/{uuid}/ so that solve-data.json has a stable home. DEV must verify this does
not break the existing /api/download route.

OQ-5: The generate response currently returns worksheetKey as "local/{filename}" but does not
return the worksheetId as a top-level field. solve.html needs the worksheetId to construct the
/api/solve/:id URL. DEV must add worksheetId as a top-level field on the generate response
alongside worksheetKey.

OQ-6: Auth context handoff for submit persistence must be finalised. Current proposal:
submitHandler reads student identity from event.requestContext.authorizer (Lambda) and from
req.user injected by auth middleware in local server mode. If no valid identity is present,
the submission is treated as guest for persistence purposes and no result record is written.

---

## Section 1: src/solve/scorer.js

### Purpose
Pure scoring logic. No file I/O. No HTTP. Accepts a single question object and a single student
answer string (or object for matching), returns a result object.

### File Location
src/solve/scorer.js

### Exports

```
scoreQuestion(question, studentAnswer) -> QuestionResult
extractOptionLetter(rawAnswer)         -> string   (module-internal helper, exported for testing)
normalizeText(str)                     -> string   (module-internal helper, exported for testing)
```

### Function: scoreQuestion

Signature:
```
scoreQuestion(question, studentAnswer)
```

Parameters:
- question: object — one element from worksheet.questions (includes number, type, answer,
  explanation, points, and optionally options)
- studentAnswer: string | object | null | undefined — the student's submitted answer.
  For matching type, this is an array of { left: string, right: string } objects.
  For all other types, this is a string. null and undefined are treated as blank (incorrect).

Returns: QuestionResult object (schema below)

Throws: nothing — all error conditions return a result with correct: false

### QuestionResult Schema

```json
{
  "number":         1,
  "correct":        true,
  "studentAnswer":  "B",
  "correctAnswer":  "B",
  "explanation":    "6 x 7 = 42",
  "pointsEarned":   1,
  "pointsPossible": 1
}
```

Fields:
- number: integer — copied from question.number
- correct: boolean
- studentAnswer: string — the normalised form of what the student submitted. For matching,
  serialised as "left1 -> right1, left2 -> right2" for display purposes.
- correctAnswer: string — the normalised form of the stored correct answer. Same serialisation
  rule for matching.
- explanation: string — copied from question.explanation
- pointsEarned: integer — question.points if correct, 0 if incorrect
- pointsPossible: integer — copied from question.points

### Scoring Rules Per Question Type

MULTIPLE-CHOICE
- Extract just the leading letter (A, B, C, or D) from both the stored answer field and the
  student answer using extractOptionLetter().
- Compare case-insensitively after extracting the letter.
- Valid stored answer formats: "B", "B.", "B. 56", "b"
- Valid student answer formats: "B", "b", "B. 56" (radio button value)
- correct = (extractOptionLetter(stored) === extractOptionLetter(student))
- extractOptionLetter("B. 56") returns "B"
- extractOptionLetter("") returns ""
- extractOptionLetter(null) returns ""

TRUE-FALSE
- Normalise both sides: trim, lowercase.
- Accepted stored values: "true", "false"
- Accepted student values: "true", "false" (radio buttons enforce this)
- correct = (normalizeText(stored) === normalizeText(student))

FILL-IN-THE-BLANK
- normalizeText: trim whitespace, collapse internal whitespace to single space, lowercase.
- correct = (normalizeText(stored) === normalizeText(student))
- Example: stored "24", student "  24  " -> correct

SHORT-ANSWER
- Keyword match: split the stored answer on spaces to get keywords. The student's answer must
  contain every keyword (normalizeText applied to both sides).
- Minimum 1 keyword. All keywords must be present.
- correct = every keyword in normalizeText(stored).split(' ') is a substring of normalizeText(student)
- Example: stored "photosynthesis", student "The process is photosynthesis" -> correct
- Example: stored "42 cookies", student "42" -> incorrect (missing "cookies")
- Blank student answer -> incorrect

MATCHING
- studentAnswer is an array of { left: string, right: string }
- question.answer is an array of { left: string, right: string } (the correct pairs)
- Score the whole matching question as one unit (not per pair)
- correct = every pair in the correct answer has an exact match (normalizeText on both sides)
  in the student's answer array
- If the arrays are different lengths -> incorrect
- pointsEarned = question.points if all pairs correct, 0 otherwise

SHOW-YOUR-WORK
- Score on the finalAnswer field only
- The student submits { workShown: string, finalAnswer: string }
- Apply fill-in-the-blank scoring rule to finalAnswer vs question.answer
- workShown is stored in studentAnswer for display but does not affect scoring
- studentAnswer in the result object is set to the finalAnswer string only
- If student submits a plain string instead of an object, treat the whole string as finalAnswer

WORD-PROBLEM
- Identical scoring rule to SHOW-YOUR-WORK

### Helper: extractOptionLetter

```
extractOptionLetter(rawAnswer) -> string
```

- Accepts a string, null, or undefined
- Returns the first uppercase letter A, B, C, or D found at the start of the trimmed string
  (after an optional leading space), ignoring trailing punctuation and text
- Regex: /^([A-Da-d])[.\s)]?/ applied to rawAnswer.trim()
- Returns uppercase result: "b" -> "B"
- Returns "" if no letter found or input is null/undefined/empty

### Helper: normalizeText

```
normalizeText(str) -> string
```

- Returns "" for null, undefined, or non-string input
- Trims leading and trailing whitespace
- Collapses all internal whitespace sequences to a single space
- Converts to lowercase
- Does NOT strip punctuation (so "42." does not equal "42" — DEV should note this when
  reviewing Claude-generated answers; if Claude includes trailing periods in stored answers
  that is an issue to surface as OQ-6)

---

## Section 2: src/solve/resultBuilder.js

### Purpose
Accepts a full worksheet object, an array of student answer entries, timeTaken in seconds, and
the timed flag. Calls scoreQuestion for each question. Returns the complete result object.

### File Location
src/solve/resultBuilder.js

### Exports

```
buildResult(worksheet, studentAnswers, timeTaken, timed) -> ResultObject
```

### Parameters

- worksheet: object — the full solve-data.json object (with questions including answers)
- studentAnswers: array of { number: integer, answer: string | object } — the answers array
  from the POST /api/submit request body. May be empty. May omit some question numbers.
- timeTaken: integer — seconds elapsed. Must be >= 0. If null/undefined, stored as null.
- timed: boolean — true if the student chose timed mode. If null/undefined, stored as false.

### Returns: ResultObject

```json
{
  "worksheetId":   "uuid-v4",
  "totalScore":    8,
  "totalPoints":   10,
  "percentage":    80,
  "timeTaken":     845,
  "timed":         true,
  "results": [
    {
      "number":         1,
      "correct":        true,
      "studentAnswer":  "B",
      "correctAnswer":  "B",
      "explanation":    "6 x 7 = 42",
      "pointsEarned":   1,
      "pointsPossible": 1
    }
  ]
}
```

### Build Logic

1. Build a lookup map from the studentAnswers array: { [number]: answer }
2. For each question in worksheet.questions (in order):
   a. Look up studentAnswer by question.number. If not present, use null.
   b. Call scoreQuestion(question, studentAnswer)
   c. Push the QuestionResult into results array
3. totalScore = sum of pointsEarned across all results
4. totalPoints = worksheet.totalPoints
5. percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0
6. worksheetId = worksheet.worksheetId

### Edge Cases

- studentAnswers is empty array: all questions scored as incorrect (null answers)
- worksheet.questions is empty: totalScore=0, totalPoints=0, percentage=0, results=[]
- timeTaken is null: stored as null in result (untimed mode where no elapsed time was captured)
- A student answer number that does not correspond to any question number: silently ignored

---

## Section 3: backend/handlers/solveHandler.js

### Purpose
Lambda-compatible GET handler. Reads solve-data.json and returns the worksheet with answers
and explanations stripped out.

### File Location
backend/handlers/solveHandler.js

### Lambda Configuration (deferred — for IaC agent reference)
- Function name: learnfyra-solve-{env}
- Method: GET
- Path: /api/solve/{worksheetId}
- Timeout: 10 seconds
- Memory: 128 MB
- Architecture: ARM_64

### Environment Variables Read
- WORKSHEET_BUCKET_NAME — S3 bucket name (prod only, not used in dev)
- NODE_ENV — when "development" or absent, uses local filesystem

### Request Format (API Gateway event)
```json
{
  "httpMethod": "GET",
  "pathParameters": { "worksheetId": "uuid-v4" }
}
```

For the local Express wrapper in server.js, pathParameters.worksheetId is populated from
req.params.id.

### Response: 200 Success
```json
{
  "worksheetId":    "uuid-v4",
  "grade":          3,
  "subject":        "Math",
  "topic":          "Multiplication Facts (1-10)",
  "difficulty":     "Medium",
  "estimatedTime":  "20 minutes",
  "timerSeconds":   1200,
  "totalPoints":    10,
  "questions": [
    {
      "number":   1,
      "type":     "fill-in-the-blank",
      "question": "4 x 6 = ___",
      "options":  null
    }
  ]
}
```

Fields stripped from each question: answer, explanation, points
Fields retained on each question: number, type, question, options (null if not present)

### Response: 404 Not Found
```json
{ "error": "Worksheet not found." }
```

### Response: 400 Bad Request
```json
{ "error": "worksheetId is required." }
```
Returned when pathParameters is null or pathParameters.worksheetId is missing or empty.

### Response: 500 Internal Server Error
```json
{ "error": "Failed to load worksheet. Please try again." }
```
Raw error message must NOT be exposed. Log with console.error.

### Local Filesystem Read
```
worksheets-local/{worksheetId}/solve-data.json
```
Path construction: join(__dirname, '../../worksheets-local', worksheetId, 'solve-data.json')
Use fs.readFileSync (synchronous is acceptable for the small JSON file).
If the file does not exist, catch the ENOENT error and return 404.

### Handler Internal Structure
```
handler(event, context)
  context.callbackWaitsForEmptyEventLoop = false
  if OPTIONS -> return 200 CORS preflight
  extract worksheetId from event.pathParameters.worksheetId
  if missing -> return 400
  try
    read solve-data.json (local or S3)
    parse JSON
    strip answer/explanation/points from each question
    return 200 with stripped payload
  catch ENOENT / NoSuchKey
    return 404
  catch other
    log error
    return 500
```

### CORS Headers
Same corsHeaders object pattern as generateHandler.js:
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};
```
All responses must include corsHeaders.

---

## Section 4: backend/handlers/submitHandler.js

### Purpose
Lambda-compatible POST handler. Validates the submission body, reads solve-data.json, calls
resultBuilder, and returns the scored result.

### File Location
backend/handlers/submitHandler.js

### Lambda Configuration (deferred — for IaC agent reference)
- Function name: learnfyra-submit-{env}
- Method: POST
- Path: /api/submit
- Timeout: 15 seconds
- Memory: 256 MB
- Architecture: ARM_64

### Environment Variables Read
- WORKSHEET_BUCKET_NAME — S3 bucket name (prod only)
- NODE_ENV — local filesystem when "development" or absent

### Request Body Schema
```json
{
  "worksheetId":  "uuid-v4",
  "studentName":  "optional string, max 80 chars",
  "answers": [
    { "number": 1, "answer": "B" },
    { "number": 2, "answer": "True" }
  ],
  "timeTaken": 845,
  "timed": true
}
```

Auth context requirement (not in JSON body):
- Logged-in onsite persistence requires authenticated user context.
- Lambda path: event.requestContext.authorizer contains user identity (studentId/userId).
- Local dev path: req.user is attached by auth middleware and forwarded into the handler event.

Validation rules:
- worksheetId: required, non-empty string
- answers: required, must be an array (may be empty)
- timeTaken: optional, integer >= 0 if provided; null if absent
- timed: optional boolean, defaults to false if absent
- studentName: optional string, trimmed, max 80 chars, stored nowhere (only echoed if needed)
- Each answers entry: number must be an integer >= 1, answer must be a string or object
- Result persistence rule: persist only when authenticated identity exists and solve mode is onsite.

### Response: 200 Success
Full ResultObject as defined in Section 2 plus persistence metadata. All CORS headers included.

Additional response fields:
- resultId: string | null
  - Populated for logged-in onsite submissions when persistence succeeds.
  - null for guest submissions or when onsite persistence is not applicable.

### Response: 400 Bad Request
```json
{ "success": false, "error": "worksheetId is required." }
```
or
```json
{ "success": false, "error": "answers must be an array." }
```

### Response: 404 Not Found
```json
{ "success": false, "error": "Worksheet not found." }
```

### Response: 500 Internal Server Error
```json
{ "success": false, "error": "Scoring failed. Please try again." }
```
Raw error must NOT be exposed.

### Handler Internal Structure
```
handler(event, context)
  context.callbackWaitsForEmptyEventLoop = false
  if OPTIONS -> return 200 CORS preflight
  parse body JSON -> return 400 on parse failure
  validate worksheetId present -> return 400 if missing
  validate answers is array -> return 400 if not
  try
    read solve-data.json (local or S3)
    parse JSON
    call buildResult(worksheet, answers, timeTaken, timed)
    derive auth identity from authorizer/req.user
    if identity exists and mode is onsite
      generate resultId
      persist result payload to local file or S3 by environment
      attach resultId to response
    else
      set resultId = null
    return 200 with result
  catch ENOENT / NoSuchKey
    return 404
  catch other
    log error
    return 500
```

### Lazy Imports
scorer.js and resultBuilder.js must be lazily imported (same pattern as generateHandler.js)
to optimise Lambda cold start:

```javascript
let _buildResult;
async function getBuildResult() {
  if (!_buildResult) {
    const mod = await import('../../src/solve/resultBuilder.js');
    _buildResult = mod.buildResult;
  }
  return _buildResult;
}
```

---

## Section 5: server.js Changes

### Change 1: Directory structure for generated files

CURRENT: exportWorksheet writes files directly to worksheets-local/ with a filename that
encodes metadata (grade, subject, etc.). There is no uuid subdirectory.

REQUIRED: files must be written to worksheets-local/{uuid}/ so that solve-data.json has a
stable home and solveHandler can construct a deterministic path.

DEV must change the outputDir passed to exportWorksheet and exportAnswerKey:
```
const worksheetDir = join(LOCAL_FILES_DIR, uuid);
mkdirSync(worksheetDir, { recursive: true });
const exportOpts = { ..., outputDir: worksheetDir };
```

The /local-files static route must continue to serve worksheets-local/ recursively:
```javascript
app.use('/local-files', express.static(LOCAL_FILES_DIR));
```
This already serves subdirectories so the download URLs become
/local-files/{uuid}/{filename} — update the worksheetKey returned to reflect this path.

New worksheetKey format: "local/{uuid}/{filename}"
The download route validates key.startsWith('local/') which still passes.
The URL construction becomes: /local-files/{uuid}/{filename} which the static serve handles.

### Change 2: Save solve-data.json after generation

After both exportWorksheet and exportAnswerKey complete, write solve-data.json:

```
const solveData = {
  worksheetId: uuid,
  generatedAt: new Date().toISOString(),
  grade,
  subject,
  topic,
  difficulty,
  estimatedTime:  worksheet.estimatedTime  || '20 minutes',
  timerSeconds:   deriveTimerSeconds(worksheet.estimatedTime),
  totalPoints:    worksheet.totalPoints,
  questions:      worksheet.questions,
};

writeFileSync(
  join(worksheetDir, 'solve-data.json'),
  JSON.stringify(solveData, null, 2)
);
```

deriveTimerSeconds function (write in server.js, not exported):
- Input: estimatedTime string e.g. "20 minutes"
- Extract first integer from string using parseInt(estimatedTime) or regex /(\d+)/
- Multiply by 60
- Return 1200 if result is NaN or <= 0

### Change 3: Add worksheetId to generate response

The metadata object returned by POST /api/generate must include worksheetId at the top level
of the response AND inside metadata:

```json
{
  "success":      true,
  "worksheetId":  "uuid-v4",
  "worksheetKey": "local/uuid/worksheet.html",
  "answerKeyKey": "local/uuid/answer-key.html",
  "metadata": {
    "id":          "uuid-v4",
    "worksheetId": "uuid-v4",
    ...
  }
}
```

app.js must read data.worksheetId from the response to pass to the "Solve Online" button.

### Change 4: New GET /api/solve/:id route

```javascript
app.get('/api/solve/:id', async (req, res) => {
  const { handler } = await import('./backend/handlers/solveHandler.js');
  const event = {
    httpMethod: 'GET',
    pathParameters: { worksheetId: req.params.id },
    headers: req.headers,
  };
  const mockContext = { callbackWaitsForEmptyEventLoop: false };
  const result = await handler(event, mockContext);
  res.status(result.statusCode).set(result.headers).send(result.body);
});
```

Note: import must be at the top of server.js alongside the other imports, not inside the route
handler, to avoid repeated module loading. DEV should use the same lazy-import pattern for
consistency but a top-level await import is acceptable given server.js already uses top-level
await for other imports.

### Change 5: New POST /api/submit route

```javascript
app.post('/api/submit', async (req, res) => {
  const { handler } = await import('./backend/handlers/submitHandler.js');
  const event = {
    httpMethod: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body),
    pathParameters: null,
    queryStringParameters: null,
  };
  const mockContext = { callbackWaitsForEmptyEventLoop: false };
  const result = await handler(event, mockContext);
  res.status(result.statusCode).set(result.headers).send(result.body);
});
```

### Change 6: Update SPA fallback

The current catch-all route `app.get('/{*path}', ...)` redirects all unknown paths to
index.html. solve.html must be served directly. Since Express static serve handles solve.html
before the fallback, no change is required here — but DEV must confirm solve.html is placed
directly in frontend/ (not in a subdirectory) so it is served by `express.static`.

---

## Section 6: frontend/solve.html, frontend/js/solve.js, frontend/css/solve.css

### solve.html — Page Structure

The page must reuse the same header, footer, font imports, and CSS variable theme as
index.html. Link both css/styles.css and css/solve.css.

Sections (all in a single .container inside main.main-content):

1. HEADER SECTION (.solve-header)
   - Worksheet title: h1 showing "{subject}: {topic}" — populated by solve.js after data loads
   - Metadata row: "Grade {n} | {difficulty} | {estimatedTime}" as pill badges
   - Timer display (hidden by default): div#timerDisplay showing MM:SS countdown

2. MODE SELECTION (.mode-selection) — shown before solve form
   - Heading: "Choose your mode"
   - Two radio buttons styled as large clickable cards:
     - id="modeUntimed" value="untimed" label="Untimed — solve at your own pace"
     - id="modeTimed" value="timed" label="Timed — countdown from {estimatedTime}"
   - Button: id="startSolveBtn" text "Start Solving" — disabled until mode is selected
   - Timer note (visible only when timed selected): "Your worksheet will auto-submit
     when time runs out."

3. SOLVE FORM (#solveForm) — hidden until Start is clicked
   - div#questionsContainer — questions rendered here by solve.js
   - div.solve-actions
     - Button: id="submitAnswersBtn" type="submit" class="btn btn--primary"
       text "Submit Answers"

4. LOADING OVERLAY (#solveLoading) — hidden by default
   - Spinner + text "Submitting your answers..."

5. RESULTS SECTION (#resultsSection) — hidden until submission succeeds
   - Score summary card (.score-summary):
     - Large score display: "{totalScore}/{totalPoints}"
     - Percentage badge: "{percentage}%"
     - Time taken: "{minutes}m {seconds}s" (hidden if timeTaken is null)
     - Pass/fail indicator: >= 70% shows "Good work!", < 70% shows "Keep practising!"
   - Per-question results list (#resultsList)
     - Each question rendered as .result-item with class result-item--correct or
       result-item--incorrect
     - Correct: green left border, checkmark icon, "Correct!" label
     - Incorrect: red left border, X icon, "Incorrect" label, correct answer line,
       explanation paragraph
   - Action buttons:
     - "Try Again" — reloads solve.html with same worksheetId
     - "Generate New Worksheet" — links to index.html

6. ERROR BOX (#solveError) — hidden by default
   - Same .error-box pattern as index.html
   - "Back to Generator" link

### solve.js — JavaScript Behaviour

File: frontend/js/solve.js
No framework. Vanilla JS, 'use strict'. Module-style organization with named functions.

Initialisation (runs on DOMContentLoaded):
1. Extract worksheetId from URL: new URLSearchParams(window.location.search).get('id')
2. If worksheetId is null or empty, show error "No worksheet ID found. Please generate a
   worksheet first." and stop.
3. Call loadWorksheet(worksheetId)

Function: loadWorksheet(worksheetId)
- Fetch GET /api/solve/{worksheetId}
- On success: store worksheet data in module-level variable, call renderModeSelection()
- On 404: show error "Worksheet not found or expired."
- On other error: show error "Failed to load worksheet. Please try again."

Function: renderModeSelection()
- Populate header section fields from worksheet data
- Show mode selection section
- Add click handler to startSolveBtn
- When startSolveBtn clicked: read selected mode, hide mode section, call startSolve(mode)

Function: startSolve(mode)
- If mode === 'timed': call startTimer(worksheet.timerSeconds)
- Call renderQuestions(worksheet.questions)
- Show solveForm
- Scroll to top

Function: renderQuestions(questions)
- For each question, call renderQuestion(question) and append to questionsContainer

Function: renderQuestion(question) -> HTMLElement
- Builds a .question-block div containing:
  - Question number and text
  - Input control based on question.type (see Input Rendering Rules below)
- Each input element has id="answer-{number}" and data-question-number="{number}"

Input Rendering Rules:
- multiple-choice: four radio inputs. Name="q{number}". Value = full option string
  (e.g. "A. 36"). Radio button label shows the full option text. Selecting sends the full
  option string so extractOptionLetter can parse it on the server.
- true-false: two radio inputs name="q{number}", values "True" and "False"
- fill-in-the-blank: text input, placeholder="Your answer", maxlength=200
- short-answer: textarea, rows=3, placeholder="Write your answer here..."
- matching: for each pair in question.options (format "Left | Right"), show the left side as
  a label and a select dropdown populated with all right-side values shuffled.
  Note: the matching question options field holds strings in "Left | Right" format.
  The correct answer field holds an array of { left, right } pairs.
  The shuffled select values must cover all right-side options.
- show-your-work: textarea (rows=4, id="work-{number}") for work shown, plus a text input
  (id="answer-{number}") for the final answer
- word-problem: same as show-your-work

Function: collectAnswers() -> Array of { number, answer }
- Iterate over all questions in the stored worksheet
- For each question, read the appropriate DOM element(s)
- For show-your-work and word-problem: answer = { workShown: textarea.value, finalAnswer: input.value }
  BUT since the server scorer only uses finalAnswer, the answer field should be the finalAnswer
  string. Include workShown as a separate field only if OQ-3 is resolved to store it. For now,
  send only the finalAnswer string as the answer value.
- For matching: collect array of { left, right } from each select element
- Return array with one entry per question; unanswered questions get answer: ""

Function: submitAnswers()
- If timer is running, stopTimer()
- Collect timeTaken = elapsed seconds (timerMode: timerSeconds - secondsRemaining;
  untimedMode: Date.now() - startTimestamp) / 1000 as integer
- Show loading overlay
- Fetch POST /api/submit with JSON body { worksheetId, answers, timeTaken, timed }
- On success: hide loading, call renderResults(data)
- On error: hide loading, show error box

Function: startTimer(seconds)
- Store secondsRemaining = seconds
- Store startTimestamp = Date.now()
- Set interval (1-second tick): decrement secondsRemaining, update timerDisplay
- timerDisplay format: MM:SS padded with leading zeros
- At secondsRemaining === 0: clearInterval, call submitAnswers() (auto-submit)
- timerDisplay turns red at <= 60 seconds remaining (add class timer--warning)

Function: renderResults(result)
- Hide solveForm
- Populate score-summary with totalScore, totalPoints, percentage, timeTaken
- For each entry in result.results, call renderResultItem(item) and append to resultsList
- Show resultsSection
- Scroll to top

Function: renderResultItem(item) -> HTMLElement
- Returns a .result-item div with correct/incorrect class
- Shows question number, student answer, correct answer (if incorrect), explanation

### solve.css — Visual Spec

File: frontend/css/solve.css
Import this after styles.css in solve.html. Extends the existing theme.

CSS variables available from styles.css to reuse:
--primary, --primary-dark, --primary-soft, --bg, --surface, --text, --text-muted,
--border, --error, --error-bg, --success, --success-bg, --radius, --shadow, --transition

New classes needed:

.mode-selection
  Card layout, centered content, two mode-card children side by side (grid on desktop,
  stacked on mobile)

.mode-card
  Border: 2px solid var(--border), border-radius: var(--radius), padding: 1.5rem,
  cursor: pointer. Selected state (.mode-card--selected): border-color: var(--primary),
  background: var(--primary-soft)

.question-block
  Padding: 1.5rem 0, border-bottom: 1px solid var(--border)
  Last child: no border

.question-number
  Font-weight: 700, color: var(--primary)

.timer-display
  Fixed position top-right on desktop, font-size: 1.5rem, font-weight: 700,
  font-family: var(--font-display), background: var(--surface),
  border: 2px solid var(--border), border-radius: var(--radius), padding: 0.5rem 1rem
  .timer--warning: border-color: var(--error), color: var(--error)

.score-summary
  Text-align center, large score display using font-size: 3rem, font-weight: 800
  Percentage badge: inline-block, background: var(--primary-soft), color: var(--primary),
  border-radius: 999px, padding: 0.25rem 1rem

.result-item
  Border-left: 4px solid var(--border), padding: 1rem 1rem 1rem 1.25rem,
  margin-bottom: 0.75rem, border-radius: 0 var(--radius) var(--radius) 0

.result-item--correct
  border-left-color: var(--success), background: var(--success-bg)

.result-item--incorrect
  border-left-color: var(--error), background: var(--error-bg)

.result-badge
  Inline-flex, align-items: center, gap: 0.25rem, font-weight: 700, font-size: 0.875rem
  Correct: color: var(--success)
  Incorrect: color: var(--error)

Responsive breakpoints: all multi-column layouts stack below 640px.

### app.js Change: Add "Solve Online" Button

After the existing download buttons in showResults(), inject a "Solve Online" button:

```javascript
const solveBtn = document.createElement('a');
solveBtn.href = `/solve.html?id=${data.worksheetId}`;
solveBtn.className = 'btn btn--primary solve-online-btn';
solveBtn.textContent = 'Solve Online';
downloadButtons.appendChild(solveBtn);
```

This requires data.worksheetId to be present in the generate response (see Section 5,
Change 3).

---

## Section 7: QA Handoff — Test Cases

All test files use the same ESM + jest.unstable_mockModule + aws-sdk-client-mock pattern
established in tests/unit/generateHandler.test.js. No new npm packages required.

### tests/unit/scorer.test.js

Import: scoreQuestion, extractOptionLetter, normalizeText from src/solve/scorer.js

Test fixture (define inline, not from sampleWorksheet.json as that has the "B. 56" format
issue — OQ-1):

```javascript
const mcQuestion  = { number:1, type:'multiple-choice', answer:'B', explanation:'7x8=56', points:1 };
const tfQuestion  = { number:2, type:'true-false', answer:'True', explanation:'5x9=45', points:1 };
const fibQuestion = { number:3, type:'fill-in-the-blank', answer:'24', explanation:'4x6=24', points:1 };
const saQuestion  = { number:4, type:'short-answer', answer:'photosynthesis', explanation:'...', points:2 };
const matchQ      = { number:5, type:'matching',
                      answer:[{left:'Dog',right:'Mammal'},{left:'Eagle',right:'Bird'}],
                      explanation:'...', points:2 };
const sywQuestion = { number:6, type:'show-your-work', answer:'63', explanation:'9x7=63', points:2 };
const wpQuestion  = { number:7, type:'word-problem', answer:'48', explanation:'6x8=48', points:2 };
```

Test cases (minimum — one describe block per question type):

EXTRACTOPTIONLETTER
- extractOptionLetter('B') returns 'B'
- extractOptionLetter('B. 56') returns 'B'
- extractOptionLetter('b') returns 'B'
- extractOptionLetter('') returns ''
- extractOptionLetter(null) returns ''
- extractOptionLetter(undefined) returns ''
- extractOptionLetter('X. 99') returns '' (X is not A/B/C/D)

NORMALIZETEXT
- normalizeText('  Hello  World  ') returns 'hello world'
- normalizeText('') returns ''
- normalizeText(null) returns ''
- normalizeText(undefined) returns ''
- normalizeText(42) returns ''

MULTIPLE-CHOICE
- correct when student answers 'B' and stored is 'B'
- correct when student answers 'B. 56' and stored is 'B'
- correct when student answers 'b' (lowercase) and stored is 'B'
- incorrect when student answers 'A' and stored is 'B'
- incorrect when student answer is null
- incorrect when student answer is ''
- pointsEarned is 1 on correct, 0 on incorrect
- pointsPossible is always question.points

TRUE-FALSE
- correct when student answers 'True' and stored is 'True'
- correct when student answers 'true' (lowercase) and stored is 'True'
- correct when student answers 'False' and stored is 'False'
- incorrect when student answers 'True' and stored is 'False'
- incorrect when student answer is null

FILL-IN-THE-BLANK
- correct when student answers '24' and stored is '24'
- correct when student answers '  24  ' (extra whitespace)
- correct when student answers '24' and stored is '24' (case mismatch edge — number so same)
- incorrect when student answers '25'
- incorrect when student answer is null
- incorrect when student answer is ''

SHORT-ANSWER
- correct when student answer contains the entire stored answer keyword
- correct when student answer is a longer sentence containing the keyword
- incorrect when student answer is missing one keyword (two-word stored answer test)
- incorrect when student answer is null
- incorrect when student answer is empty string

MATCHING
- correct when all pairs match exactly (case-insensitive)
- incorrect when one pair is wrong
- incorrect when arrays have different lengths
- incorrect when studentAnswer is null
- pointsEarned equals question.points on full correct, 0 on any mismatch

SHOW-YOUR-WORK
- correct when finalAnswer matches stored answer
- correct when student submits plain string equal to stored answer (fallback path)
- incorrect when finalAnswer does not match
- workShown content does not affect correctness

WORD-PROBLEM
- correct when finalAnswer matches
- incorrect when finalAnswer does not match
- behaves identically to show-your-work

BOUNDARY CASES
- question with points: 0 — pointsEarned is 0 even when correct (sampleWorksheet has this)
- question.points is undefined — pointsEarned should be 0 and pointsPossible should be 0

### tests/unit/resultBuilder.test.js

Import: buildResult from src/solve/resultBuilder.js
Mock: scoreQuestion via jest.unstable_mockModule

Fixtures (define inline):
```javascript
const worksheet = {
  worksheetId: 'test-uuid-1',
  totalPoints: 3,
  questions: [
    { number:1, type:'multiple-choice', answer:'B', explanation:'...', points:1 },
    { number:2, type:'true-false', answer:'True', explanation:'...', points:1 },
    { number:3, type:'fill-in-the-blank', answer:'24', explanation:'...', points:1 },
  ]
};
const allCorrect = [
  { number:1, answer:'B' },
  { number:2, answer:'True' },
  { number:3, answer:'24' },
];
const allWrong = [
  { number:1, answer:'A' },
  { number:2, answer:'False' },
  { number:3, answer:'99' },
];
```

Test cases:
STRUCTURE
- result has worksheetId equal to worksheet.worksheetId
- result has totalScore field
- result has totalPoints equal to worksheet.totalPoints
- result has percentage field
- result has timeTaken field
- result has timed field
- result has results array with length equal to questions length

TOTALS
- totalScore is sum of pointsEarned across all results (mock scoreQuestion)
- percentage is Math.round((totalScore/totalPoints)*100)
- all correct: totalScore equals totalPoints, percentage equals 100
- all wrong: totalScore is 0, percentage is 0

EDGE CASES
- empty studentAnswers array: all questions scored as if student answered null
- missing question answer: the result for that question has studentAnswer null
- empty questions array: results is [], totalScore 0, percentage 0
- totalPoints 0: percentage is 0 (no divide by zero)
- timed: false propagated to result when false passed in
- timed: true propagated to result when true passed in
- timeTaken: null propagated to result when null passed in

BOUNDARY
- 5 questions, all correct: correct totalScore and percentage
- 30 questions: same assertions hold (mock scoreQuestion to alternate correct/incorrect)

### tests/unit/solveHandler.test.js

Import pattern: same as generateHandler.test.js
Mock fs module with jest.unstable_mockModule
No AWS SDK calls in local dev path — no s3Mock needed for the local tests

Fixtures:
```javascript
const solveData = { /* full sampleWorksheet.json contents with worksheetId added */ };
```

Helper:
```javascript
function mockEvent(worksheetId, method = 'GET') {
  return {
    httpMethod: method,
    pathParameters: worksheetId ? { worksheetId } : null,
    headers: {},
  };
}
const mockContext = { callbackWaitsForEmptyEventLoop: true };
```

Test cases:

OPTIONS PREFLIGHT
- returns 200 for OPTIONS request
- returns CORS headers on OPTIONS response
- returns empty body on OPTIONS response

HAPPY PATH (mock fs.readFileSync to return JSON.stringify(solveData))
- returns 200 for valid worksheetId
- response body contains worksheetId
- response body contains questions array
- questions array does not contain answer field on any item
- questions array does not contain explanation field on any item
- questions array does not contain points field on any item
- questions array retains number, type, question fields
- questions array retains options field for multiple-choice questions
- response body contains totalPoints
- response body contains timerSeconds
- CORS headers present on 200 response

400 MISSING ID
- returns 400 when pathParameters is null
- returns 400 when worksheetId is empty string
- returns an error message when worksheetId missing
- CORS headers present on 400 response

404 NOT FOUND (mock fs.readFileSync to throw ENOENT)
- returns 404 when file does not exist
- response body error contains 'not found' (case-insensitive)
- CORS headers present on 404 response

500 READ ERROR (mock fs.readFileSync to throw generic Error)
- returns 500 for unexpected read error
- response body has an error field
- error message does not expose raw error text
- CORS headers present on 500 response

### tests/unit/submitHandler.test.js

Import pattern: same as generateHandler.test.js
Mock fs module AND src/solve/resultBuilder.js with jest.unstable_mockModule

Mock buildResult to return a canned ResultObject:
```javascript
const mockResult = {
  worksheetId: 'test-uuid-1',
  totalScore: 2,
  totalPoints: 3,
  percentage: 67,
  timeTaken: 300,
  timed: false,
  results: []
};
```

Helper:
```javascript
function mockEvent(body, method = 'POST') {
  return {
    httpMethod: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    pathParameters: null,
    queryStringParameters: null,
  };
}
const mockContext = { callbackWaitsForEmptyEventLoop: true };
const validBody = {
  worksheetId: 'test-uuid-1',
  answers: [{ number:1, answer:'B' }],
  timeTaken: 300,
  timed: false,
};
```

Test cases:

OPTIONS PREFLIGHT
- returns 200 for OPTIONS
- returns CORS headers
- returns empty body

HAPPY PATH (mock readFileSync to return solveData JSON, mock buildResult to return mockResult)
- returns 200 for valid request
- response body contains totalScore
- response body contains percentage
- response body contains results array
- CORS headers present on 200 response
- calls buildResult with correct arguments (worksheetId-loaded worksheet, answers, timeTaken, timed)

PERSISTENCE BRANCHING
- logged-in onsite context: returns 200 and response contains non-null resultId
- logged-in onsite context: persists one result record in expected local results path
- guest/no-auth context: returns 200 and response contains resultId as null
- guest/no-auth context: does not write persisted result record

400 VALIDATION
- returns 400 when worksheetId is missing from body
- returns 400 when answers field is absent
- returns 400 when answers is not an array (e.g. string)
- returns 400 for malformed JSON body
- returns success: false on 400 responses
- CORS headers present on 400 responses

404 NOT FOUND (mock readFileSync to throw ENOENT)
- returns 404 when worksheet file not found
- CORS headers present on 404 response

500 SERVER ERROR (mock buildResult to throw)
- returns 500 when resultBuilder throws
- error message does not expose raw error text
- CORS headers present on 500 response

BOUNDARY
- empty answers array: returns 200 (scoring produces all-incorrect result)
- answers array with 30 entries: returns 200

### tests/integration/solve.test.js

This test starts the Express server (or imports and calls the handlers directly) and verifies
the full local flow end-to-end. It does NOT call the real Anthropic API.

Test setup:
- Write a known solve-data.json to a temp directory worksheets-local/{TEST_UUID}/ before tests
- Clean up that directory after all tests complete

Test cases:
- GET /api/solve/{TEST_UUID} returns 200 with stripped questions
- GET /api/solve/{TEST_UUID} response questions have no answer field
- GET /api/solve/nonexistent-uuid returns 404
- POST /api/submit with valid body against TEST_UUID returns 200
- POST /api/submit response has totalScore, totalPoints, percentage, results
- POST /api/submit with logged-in onsite context persists a result and returns non-null resultId
- POST /api/submit without auth context returns resultId null and does not persist a result
- POST /api/submit with empty answers returns 200 with totalScore 0
- POST /api/submit with all correct answers returns percentage 100
- POST /api/submit with all wrong answers returns totalScore 0
- POST /api/submit with missing worksheetId returns 400
- POST /api/submit with nonexistent worksheetId returns 404

---

## Appendix: File Checklist for DEV Agent

Files to CREATE:
- src/solve/scorer.js
- src/solve/resultBuilder.js
- backend/handlers/solveHandler.js
- backend/handlers/submitHandler.js
- frontend/solve.html
- frontend/js/solve.js
- frontend/css/solve.css

Files to MODIFY:
- server.js (Changes 1-6 above)
- frontend/js/app.js (add worksheetId to response read + "Solve Online" button)

Files to NOT modify:
- backend/handlers/generateHandler.js (S3 path for prod — handled separately in Phase 5)
- backend/middleware/validator.js
- Any existing src/ files unless OQ-1 resolution requires normalisation in generator.js

## Appendix: File Checklist for QA Agent

Files to CREATE:
- tests/unit/scorer.test.js
- tests/unit/resultBuilder.test.js
- tests/unit/solveHandler.test.js
- tests/unit/submitHandler.test.js
- tests/integration/solve.test.js
- tests/fixtures/solveWorksheet.json (hand-crafted fixture with all 7 question types including
  matching, with answer fields in clean letter-only format pending OQ-1 resolution)

---

## Implementation Readiness References

1. Local and AWS parity strategy: [docs/technical/platform/LOCAL_DEV_STRATEGY.md](docs/technical/platform/LOCAL_DEV_STRATEGY.md)
2. Implementation checklist: [docs/IMPLEMENTATION_READINESS_CHECKLIST.md](docs/IMPLEMENTATION_READINESS_CHECKLIST.md)

## Appendix: Open Question Resolution Checklist

Before DEV begins implementation, the following must be decided:

OQ-1 (RESOLVED): Canonical stored format is "letter+text" (for example, "B. 56").
  scorer.js must call extractOptionLetter on BOTH stored answers and student answers.
  Backward compatibility: accept both "B" and "B. 56" as student input.

OQ-4 (BLOCKING): Confirm server.js directory structure change does not break /api/download.
  Resolution owner: DEV (local test before merging)

OQ-5 (BLOCKING): Confirm worksheetId is added to generate response before app.js can pass it
  to the "Solve Online" button.
  Resolution owner: DEV (server.js Change 3 above)

OQ-2 (NON-BLOCKING): Matching question fixture — QA can hand-craft this.

OQ-3 (NON-BLOCKING): timerSeconds derivation — formula specified above, DEV implements.

OQ-6 (BLOCKING): Finalize exact auth-to-handler identity contract for local and Lambda paths.
  Resolution owner: Architect + DEV (align with auth module contract before implementation)
