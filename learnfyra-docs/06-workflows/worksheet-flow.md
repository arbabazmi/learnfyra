# Worksheet Generation Flow

**Updated: feat/my-worksheets-tracking (2026-04-03)**
- Step 10 now writes `createdBy = userId` to `LearnfyraGenerationLog` for authenticated users
- This populates `GET /api/worksheets/mine` and dashboard feeds

## ASCII Sequence Diagram

```
Teacher/Browser          Express/API GW         generateHandler         Claude AI          Storage
      │                       │                       │                    │                  │
      │── POST /api/generate ─►│                       │                    │                  │
      │   {grade,subject,...}  │── invoke handler ─────►│                    │                  │
      │   Authorization:Bearer │                       │── validate input   │                  │
      │                       │                       │   (grade,subject, ─►                  │
      │                       │                       │    topic,count)    │                  │
      │                       │                       │                    │                  │
      │                       │                       │── QB.getQuestions──────────────────►  │
      │                       │                       │   (per type)       │    read local/   │
      │                       │                       │◄─ banked questions─────────────────── │
      │                       │                       │                    │                  │
      │                       │                       │  if gap > 0:       │                  │
      │                       │                       │── messages.create ─►│                  │
      │                       │                       │   (system+user     │                  │
      │                       │                       │    prompt)         │── think ──────   │
      │                       │                       │                    │                  │
      │                       │                       │◄─ raw JSON text ───│                  │
      │                       │                       │                    │                  │
      │                       │                       │── extractJSON()    │                  │
      │                       │                       │── coerceTypes()    │                  │
      │                       │                       │── validateQ()      │                  │
      │                       │                       │  [retry if fail]   │                  │
      │                       │                       │                    │                  │
      │                       │                       │── save new Qs ─────────────────────►  │
      │                       │                       │   to QB bank       │                  │
      │                       │                       │                    │                  │
      │                       │                       │── export parallel  │                  │
      │                       │                       │   html/pdf/docx    │                  │
      │                       │                       │                    │                  │
      │                       │                       │── write files ─────────────────────►  │
      │                       │                       │   + metadata.json  │   S3 / local     │
      │                       │                       │   + solve-data.json│                  │
      │                       │                       │                    │                  │
      │                       │                       │── GenerationLog ───────────────────►  │
      │                       │                       │   PutItem          │  DynamoDB        │
      │                       │                       │   {worksheetId,    │  (AWS only)      │
      │                       │                       │    createdBy:userId│                  │
      │                       │                       │    ...}            │                  │
      │                       │                       │                    │                  │
      │◄─ {worksheetId,        │◄──────────────────────│                    │                  │
      │   downloadUrls,solveUrl│                       │                    │                  │
```

## Local vs AWS Differences

| Step | Local (APP_RUNTIME=local) | AWS (APP_RUNTIME=aws) |
|---|---|---|
| Handler invocation | Express calls handler directly | API Gateway → Lambda |
| QB adapter | JSON files in worksheets-local/ | DynamoDB GSI-1 query |
| File storage | Write to worksheets-local/{uuid}/ | S3 PutObject to bucket |
| Download URLs | Local server paths (/worksheets-local/...) | S3 presigned URLs (15min) |
| Generation log | Written to worksheets-local/generation-log.json | DynamoDB GenerationLog PutItem |
| createdBy tracking | Stored in local generation-log.json | DynamoDB createdBy-index GSI |

## Request Schema

```json
{
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "questionCount": 10,
  "formats": ["pdf", "docx", "html"],
  "classId": "uuid (optional)",
  "studentId": "uuid (optional)"
}
```

## Response Schema

```json
{
  "worksheetId": "uuid-v4",
  "title": "Grade 3 Math — Multiplication",
  "estimatedTime": "20 minutes",
  "generationMode": "mixed",
  "provenanceLevel": "partial-bank",
  "questionCount": 10,
  "downloadUrls": {
    "pdf": "...",
    "docx": "...",
    "html": "..."
  },
  "answerKeyUrls": {
    "pdf": "...",
    "docx": "..."
  },
  "solveUrl": "/solve.html?id=uuid-v4"
}
```

## Bank-First Decision Tree

```
questionCount = 10 requested

QB.getQuestions({grade:3, subject:Math, topic:Multiplication})
├── Returns 10+ questions
│     → generationMode = 'bank-only'
│     → select 10, no Claude call
│
├── Returns 4 questions
│     → generationMode = 'mixed'
│     → use all 4 banked
│     → call Claude for 6 more
│     → save 6 new Q to bank
│
└── Returns 0 questions
      → generationMode = 'ai-only'
      → call Claude for all 10
      → save all 10 to bank
```

## File Output Structure

```
worksheets/{year}/{month}/{day}/{uuid}/
  worksheet.pdf         ← US Letter, 0.75" margins, Puppeteer
  worksheet.docx        ← US Letter, 1" margins, docx npm
  worksheet.html        ← embedded CSS, print-optimized
  answer-key.pdf        ← same layout + answers + explanations
  answer-key.docx       ← same layout + answers + explanations
  answer-key.html
  metadata.json         ← no answers, no PII
  solve-data.json       ← full JSON with answers (authoritative)
```

## Generation Log Schema (LearnfyraGenerationLog)

Written to DynamoDB on every authenticated generation (AWS only). Guest generations write null for `createdBy`.

```json
{
  "worksheetId": "uuid-v4",
  "generatedAt": "2026-03-28T12:00:00Z",
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "questionCount": 10,
  "generationMode": "mixed",
  "provenanceLevel": "partial-bank",
  "modelUsed": "claude-sonnet-4-20250514",
  "durationMs": 4200,
  "createdBy": "user-uuid-v4",
  "formats": ["pdf", "docx", "html"],
  "s3Prefix": "worksheets/2026/03/28/uuid-v4/",
  "ttl": 1743811200
}
```

The `createdBy` field is the userId extracted from the JWT in the `Authorization` header. It is null for guest (unauthenticated) requests.

The `createdBy-index` GSI (PK=createdBy, SK=createdAt) on this table is how `GET /api/worksheets/mine` and `GET /api/dashboard/recent-worksheets` retrieve all worksheets belonging to a specific user in one query.

## My Worksheets Status Flow

After generation, a worksheet transitions through statuses as the user interacts with it:

```
POST /api/generate (authenticated)
  → GenerationLog written with createdBy = userId
  → Worksheet appears in GET /api/worksheets/mine with status = "new"

Student clicks "Solve Online"
  → GET /api/solve/:id called
  → Status remains "new" (no attempt written until submit)

Student submits answers
  → POST /api/submit called
  → WorksheetAttempt record written to DynamoDB (PK=userId, SK=worksheetId#{timestamp})
  → Status transitions to "completed"

Student retakes worksheet
  → Another WorksheetAttempt record written
  → Status remains "completed" (most recent attempt determines status)
  → worksheetsDone still counts this worksheet once (de-duplicated by worksheetId)
```

## Dashboard Integration

`GET /api/dashboard/stats` and `GET /api/dashboard/recent-worksheets` both use the `createdBy-index` GSI on `LearnfyraGenerationLog` as their primary data source for worksheet counts and the recent list. Attempt data from `LearnfyraWorksheetAttempt` is joined to derive per-worksheet status.

## PDF Generation Details

Puppeteer is used for PDF generation. Key settings:
- Format: US Letter (8.5" × 11")
- Margins: 0.75" on all sides
- Print background: true (enables colored headers)
- Width in pixels: 816px (8.5" @ 96 DPI)

DOCX generation details:
- Page size: 12240 × 15840 DXA (US Letter)
- Margins: 1440 DXA (1") on all sides
- Font: Calibri 11pt body, Calibri Bold 14pt headers

## Filename Convention

```
grade{n}_{subject}_{topic}_{difficulty}_{YYYYMMDD}.{ext}
```

Example: `grade3_math_multiplication_medium_20260328.pdf`

Special characters in topic names are replaced by underscores via `sanitizeSegment()`.
