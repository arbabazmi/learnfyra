# Worksheet Generation Flow

## ASCII Sequence Diagram

```
Teacher/Browser          Express/API GW         generateHandler         Claude AI          Storage
      │                       │                       │                    │                  │
      │── POST /api/generate ─►│                       │                    │                  │
      │   {grade,subject,...}  │── invoke handler ─────►│                    │                  │
      │                       │                       │── validate input   │                  │
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
| Generation log | Not written | DynamoDB GenerationLog PutItem |

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
