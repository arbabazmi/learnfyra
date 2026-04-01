# Data Flow Diagrams

## Worksheet Generation Flow

```
Teacher /Student / Browser
     │
     │  POST /api/generate
     │  {grade, subject, topic, difficulty, questionCount, formats}
     ▼
API Gateway → Lambda Authorizer (optional — guest allowed)
     │
     ▼
learnfyra-generate Lambda
     │
     ├── 1. Validate input (grade 1-10, subject enum, count 5-30)
     │
     ├── 2. Query QuestionBank (M02)
     │      QB_ADAPTER=dynamodb: DynamoDB GSI-1 query
     │      QB_ADAPTER=local:    read local JSON file
     │      Returns: existing questions matching grade/subject/topic/type
     │
     ├── 3. Determine generationMode
     │      bank count >= requested → mode=bank-only
     │      bank count = 0          → mode=ai-only
     │      0 < bank count < needed → mode=mixed
     │
     ├── 4. Call Bedrock AI Model (if mode != bank-only)
     │      buildSystemPrompt() + buildUserPrompt(options)
     │      model: claude-sonnet-4-20250514 (or Config table override)
     │      max_tokens: 8192
     │      Returns: raw JSON with questions array
     │
     ├── 5. extractJSON() → coerceTypes() → validateQuestions()
     │      Retry with strict prompt on validation failure (up to 3 attempts)
     │
     ├── 6. Write AI questions back to QuestionBank
     │      dedupeHash = SHA256(grade|subject|topic|type|normalizedQuestion)
     │      Skip if dedupeHash already exists
     │
     ├── 7. Assemble final worksheet JSON
     │      Merge bank questions + AI questions
     │      Add: worksheetId (UUID), generatedAt, timerSeconds, provenanceLevel
     │
     ├── 8. Export files (parallel)
     │      htmlExporter → worksheet.html
     │      pdfExporter  → worksheet.pdf (Puppeteer)
     │      docxExporter → worksheet.docx
     │      answerKey    → answer-key.html, answer-key.pdf, answer-key.docx
     │
     ├── 9. Write to storage
     │      APP_RUNTIME=aws:   S3 PUT each file to worksheets/{year}/{month}/{day}/{uuid}/
     │      APP_RUNTIME=local: write to worksheets-local/{uuid}/
     │      Also write: metadata.json, solve-data.json
     │
     └── 10. Return response
            {worksheetId, downloadUrls: {pdf, docx, html}, solveUrl, estimatedTime}
```

## Online Solve Flow

```
Student / Browser
     │
     │  GET /api/solve/{worksheetId}
     ▼
learnfyra-solve Lambda
     │
     ├── 1. Read solve-data.json from storage
     │      APP_RUNTIME=aws:   S3 GET worksheets/{year}/{month}/{day}/{uuid}/solve-data.json
     │      APP_RUNTIME=local: read worksheets-local/{uuid}/solve-data.json
     │
     ├── 2. Strip sensitive fields from each question
     │      Remove: answer, explanation
     │      Keep:   number, type, question, options (multiple-choice only), points
     │
     └── 3. Return sanitized worksheet
            {worksheetId, title, grade, subject, topic, estimatedTime,
             timerSeconds, totalPoints, instructions, questions[]}
             (questions have NO answers or explanations)

Student fills answers → clicks Submit (or timer expires)
     │
     │  POST /api/submit
     │  {worksheetId, answers: [{number, answer}], timeTaken, timed, studentName?}
     ▼
learnfyra-submit Lambda
     │
     ├── 1. Read solve-data.json (same as above — has authoritative answers)
     │
     ├── 2. Score each answer (src/solve/scorer.js)
     │      multiple-choice:   exact match on option letter (A/B/C/D)
     │      true-false:        exact match (True/False)
     │      fill-in-the-blank: case-insensitive, trimmed string match
     │      short-answer:      case-insensitive keyword match
     │      matching:          exact match per pair
     │      show-your-work:    score final answer field only
     │      word-problem:      score final answer field only
     │
     ├── 3. Build result (src/solve/resultBuilder.js)
     │      totalScore, totalPoints, percentage
     │      per-question: correct, studentAnswer, correctAnswer, explanation, pointsEarned
     │
     ├── 4. Persist attempt (authenticated users only)
     │      DynamoDB WorksheetAttempt: PK=userId, SK=worksheetId#{timestamp}
     │      Fields: score, percentage, timeTaken, timed, answers
     │
     └── 5. Return result JSON
            {worksheetId, totalScore, totalPoints, percentage, timeTaken, timed, results[]}
```

## Authentication Flow

```
Browser                          Cognito                        Lambda Authorizer
   │                               │                                    │
   │── POST /api/auth/token ───────►│                                    │
   │   {code, codeVerifier}         │ Exchange code for tokens           │
   │                               │◄── tokens (access, refresh, id)    │
   │◄── {accessToken, refreshToken}─│                                    │
   │                                                                     │
   │── GET /api/protected ──────────────────────────────────────────────►│
   │   Authorization: Bearer {accessToken}                               │
   │                                                          Verify JWT │
   │                                                          Extract role│
   │                                                          IAM policy  │
   │                                                          Allow/Deny  │
   │◄── protected resource ─────────────────────────────────────────────│
```

## Question Bank Population Flow

```
AI generates new questions
     │
     ▼
For each question:
  dedupeHash = SHA256(normalize(grade|subject|topic|type|questionText))
     │
     ▼
  questionExists(dedupeHash)?
     ├── YES → skip, do not store (prevents duplicates)
     └── NO  → saveQuestion(question)
                    │
                    ▼
               DynamoDB PutItem
               (or local JSON append)
               questionId = UUID
               dedupeHash = SHA256
               typeDifficulty = "{type}#{difficulty}"
               lookupKey = "grade#{g}#subject#{s}#topic#{t}"
```

## Progress Aggregation Flow

```
Student submits worksheet attempt
     │
     └── WorksheetAttempt written to DynamoDB
         PK: userId, SK: worksheetId#{timestamp}
         Fields: score, percentage, timeTaken, subject, topic, grade

GET /api/progress/:studentId
     │
     ▼
learnfyra-progress Lambda
     │
     ├── Query WorksheetAttempt by userId (all attempts)
     │
     ├── Compute aggregates:
     │      totalAttempts
     │      avgScore (by subject, by topic, overall)
     │      streak (consecutive days with attempts)
     │      lastActive timestamp
     │      weakAreas (topics with avgScore < 60%)
     │      strongAreas (topics with avgScore > 85%)
     │
     └── Return progress JSON
```

## S3 Key Construction

```javascript
// All worksheet files share the same prefix
const prefix = `worksheets/${year}/${month}/${day}/${uuid}/`;

// Files written per generation:
`${prefix}worksheet.pdf`
`${prefix}worksheet.docx`
`${prefix}worksheet.html`
`${prefix}answer-key.pdf`
`${prefix}answer-key.docx`
`${prefix}answer-key.html`
`${prefix}metadata.json`
`${prefix}solve-data.json`

// Example:
// worksheets/2026/03/28/a1b2c3d4-e5f6-7890-abcd-ef1234567890/worksheet.pdf
```

## Presigned URL Generation

```
learnfyra-download Lambda
     │
     ├── Parse worksheetId from query param
     ├── Reconstruct S3 key from worksheetId
     │   (read metadata.json to get year/month/day from generatedAt)
     ├── Generate presigned GET URL
     │   Expiry: 15 minutes
     └── Return presigned URL to browser
         Browser downloads file directly from S3 (no Lambda proxy)
```

This avoids streaming large files through Lambda and keeps download latency minimal.
