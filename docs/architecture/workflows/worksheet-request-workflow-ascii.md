# Worksheet Request Workflow (ASCII)

This document shows the complete flow for what happens when a user requests a worksheet.

It reflects the current implementation in:
- frontend/js/app.js
- server.js (local dev flow)
- backend/handlers/generateHandler.js (AWS/Lambda flow)
- src/ai/generator.js
- src/exporters/index.js

## 1) High-Level End-to-End Flow

```text
+-------------------+        +-------------------+        +--------------------------------------+
| Teacher Frontend  |        | API Entry Point   |        | Generation Pipeline                  |
| (index.html/app)  | -----> | /api/generate     | -----> | Validate -> Bank Lookup + Uniqueness |
| POST payload      |        | (Express/Lambda)  |        | -> Claude Gap Fill -> Export ->      |
+-------------------+        +-------------------+        | Store -> Reply                        |
         ^                                                  +--------------------------------------+
         |                                                            |
         |                                                            v
         +-------------------- JSON success/error response -----------+
```

## 2) Sequence Diagram (Complete Request Path)

```text
Teacher Browser        Frontend JS          API Route            Generator            Anthropic API         Exporters            Storage
     |                     |                    |                    |                     |                    |                  |
1. Fill form               |                    |                    |                     |                    |                  |
2. Click Generate          |                    |                    |                     |                    |                  |
     |-------------------->|                    |                    |                     |                    |                  |
3. validateForm()          |                    |                    |                     |                    |                  |
4. build payload +         |                    |                    |                     |                    |                  |
   x-client-request-id     |                    |                    |                     |                    |                  |
5. POST /api/generate      |------------------->|                    |                     |                    |                  |
                           |                    | 6. validate body    |                     |                    |                  |
                           |                    | 7. stage=worksheet:generate             |                    |                  |
                           |                    |------------------->|                     |                    |                  |
                           |                    |                    | 8. build prompts     |                    |                  |
                           |                    |                    |--------------------->|                    |                  |
                           |                    |                    | 9. messages.create() |------------------->|                  |
                           |                    |                    |                     | 10. returns text JSON                |
                           |                    |                    |<---------------------|                    |                  |
                           |                    |                    | 11. parse + validate  |                    |                  |
                           |                    |<-------------------|                     |                    |                  |
                           |                    | 12. stage=worksheet:export               |                    |                  |
                           |                    |-------------------------------------------------------------->|                  |
                           |                    |                                               13. HTML/PDF/DOCX files         |
                           |                    |<--------------------------------------------------------------|                  |
                           |                    | 14. save solve-data.json                                     |---- local FS/S3 ->|
                           |                    | 15. optional answer-key export                               |                  |
                           |                    | 16. build metadata + keys                                    |                  |
                           |                    | 17. return success JSON <------------------------------------|                  |
     |<--------------------|                    |                    |                     |                    |                  |
18. showResults() + download buttons + Solve Online link                                                     |                  |
```

## 3) Detailed Stage Flow (Current Stage Names)

```text
request:start
  -> request:parse-body (Lambda only)
  -> request:validate-body
  -> worksheet:generate
      -> build request-scoped exclusion set (question ids + normalized fingerprints)
      -> select reusable questions excluding already chosen candidates for this request
      -> generate only missing unique question slots
      -> reject duplicate / near-duplicate candidates before assembly
      -> auth:load-api-key (Lambda only, from SSM when needed)
      -> generateWorksheet()
          -> validate inputs (grade/subject/questionCount)
          -> buildSystemPrompt() + buildUserPrompt()
          -> Anthropic messages.create(model, max_tokens, system, messages)
          -> parse response text -> extract JSON -> schema validation
  -> worksheet:export
      -> exportWorksheet() to HTML/PDF/DOCX in /tmp (Lambda) or worksheets-local/<id>/ (local)
  -> worksheet:upload (Lambda S3) OR local file key mapping (Express local)
  -> worksheet:write-solve-data (local) / solve-data persisted with worksheet id
  -> answer-key:export (if includeAnswerKey=true)
  -> answer-key:upload (Lambda)
  -> response:success
```

## 3.1) Request-Scoped Non-Repetition Guardrail

```text
For every worksheet generation request:
  -> start an empty exclusion set for this worksheet session
  -> add each selected reusable question id/hash/canonical text fingerprint to the set
  -> call AI only for the remaining slots that are still unique
  -> normalize every AI candidate and compare it against the exclusion set
  -> discard and regenerate or replace any duplicate / near-duplicate candidate
  -> run a final uniqueness check before export so the assembled worksheet contains no repeated questions
```

## 3.2) Future-Session Repeat Cap Policy

```text
For future worksheet sessions for the same student and same grade+difficulty profile:
  -> apply default repeat cap = 10% of total worksheet questions
  -> compute maxRepeatQuestions = floor(questionCount * effectiveRepeatCapPercent / 100)
  -> enforce this cap across historical question exposure for the student profile
  -> if admin override exists, use effectiveRepeatCapPercent from override (0..100)
  -> override scope can be student, teacher, or parent
  -> reject or regenerate candidates that exceed the repeat allowance before final assembly
```

## 4) Frontend Payload Sent to /api/generate

```text
{
  grade,
  subject,
  topic,
  difficulty,
  questionCount,
  format,
  includeAnswerKey,
  studentName,
  worksheetDate,
  teacherName,
  period,
  className
}
Headers:
  Content-Type: application/json
  x-client-request-id: <uuid>
```

## 5) Anthropic Sub-Flow Inside worksheet:generate

```text
generateWorksheet(options)
  -> validateGrade / validateSubject / validateQuestionCount
  -> systemPrompt = buildSystemPrompt()
  -> userPrompt   = buildUserPrompt() (or strict prompt on retry)
  -> anthropic.messages.create(
       {
         model,
         max_tokens,
         system,
         messages: [{ role: "user", content: userPrompt }]
       },
       { timeout }
     )
  -> if stop_reason == "max_tokens" => fail (truncated)
  -> rawText = message.content[0].text
  -> extractJSON(rawText)
  -> JSON.parse
  -> coerceTypes
  -> validate required top-level + questions schema + exact questionCount
  -> return worksheet JSON
```

## 6) Success Response Back to Frontend

```text
{
  success: true,
  worksheetKey,
  answerKeyKey,
  requestId,
  clientRequestId,
  metadata: {
    id,
    solveUrl,
    generatedAt,
    grade,
    subject,
    topic,
    difficulty,
    questionCount,
    format,
    studentDetails,
    expiresAt
  }
}
```

Frontend then:
- shows download buttons
- calls /api/download?key=<worksheetKey or answerKeyKey>
- opens returned downloadUrl
- shows Solve Online button using metadata.solveUrl

## 7) Error Workflow (What Happens on Failure)

```text
Failure point examples:
  A) request validation fails
  B) Anthropic timeout/refusal/malformed JSON
  C) export fails (PDF/DOCX/HTML)
  D) storage write/upload fails

API returns:
{
  success: false,
  error,
  errorCode,
  errorStage,
  requestId,
  clientRequestId
}

Frontend behavior:
  -> catch error
  -> show message to user
  -> include diagnostics (requestId, clientRequestId, errorStage when present)
```

## 8) Local vs AWS Differences

```text
LOCAL (server.js)
  - Endpoint: Express POST /api/generate
  - Files: worksheets-local/<uuid>/...
  - solve-data.json written locally
  - /api/download maps to local-files static route

AWS (generateHandler.js)
  - Endpoint: API Gateway -> Lambda handler
  - API key loaded from SSM (cached per warm container)
  - exports created in /tmp
  - files uploaded to S3 (worksheet and optional answer-key)
  - response returns S3 keys + metadata
```

## 9) One-Line Summary

```text
User submits form -> backend validates -> system selects only unique reusable questions -> Claude fills only the remaining unique slots -> server exports files -> stores artifacts -> returns keys/metadata -> frontend renders download and solve actions.
```
