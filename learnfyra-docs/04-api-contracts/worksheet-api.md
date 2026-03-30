# Worksheet API Contracts (M03)

**Status: FROZEN — RC-BE-01 (2026-03-26)**

---

## POST /api/generate

Generate a worksheet using the bank-first assembly pipeline.

**Auth:** Optional Bearer token. Guest requests allowed; authenticated requests may attach classId.

**Request:**
```json
{
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "questionCount": 10,
  "formats": ["pdf", "docx", "html"],
  "classId": "uuid-optional",
  "studentId": "uuid-optional"
}
```

**Validation:**
- `grade`: integer 1–10 (required)
- `subject`: `Math | ELA | Science | Social Studies | Health` (required)
- `topic`: must exist in curriculum map for the given grade/subject (required)
- `difficulty`: `Easy | Medium | Hard | Mixed` (required)
- `questionCount`: integer 5–30 (required)
- `formats`: array, min 1 element, subset of `[pdf, docx, html]` (required)

**Response 200:**
```json
{
  "worksheetId": "uuid-v4",
  "title": "Grade 3 Math — Multiplication",
  "estimatedTime": "20 minutes",
  "generationMode": "bank-only | mixed | ai-only",
  "provenanceLevel": "full-bank | partial-bank | full-ai",
  "questionCount": 10,
  "downloadUrls": {
    "pdf": "https://presigned-url/worksheet.pdf",
    "docx": "https://presigned-url/worksheet.docx",
    "html": "https://presigned-url/worksheet.html"
  },
  "answerKeyUrls": {
    "pdf": "https://presigned-url/answer-key.pdf",
    "docx": "https://presigned-url/answer-key.docx"
  },
  "solveUrl": "/solve.html?id=uuid-v4"
}
```

Note: `downloadUrls` contains only keys for the formats requested. Presigned URLs expire after 15 minutes. In local mode, these are local server paths instead of S3 presigned URLs.

**Error 400 — Validation failure:**
```json
{
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "details": {
    "grade": "Must be between 1 and 10",
    "topic": "Topic 'XYZ' not found in curriculum for Grade 3 Math"
  }
}
```

**Error 503 — Maintenance mode:**
```json
{ "error": "Service Unavailable", "code": "MAINTENANCE", "message": "Back at 14:00 UTC", "endsAt": "2026-03-28T14:00:00Z" }
```

**Error 500 — AI generation failed:**
```json
{ "error": "Internal Server Error", "code": "GENERATION_FAILED", "message": "Claude API error after 3 retries" }
```

---

## GET /api/download

Get a presigned download URL for a worksheet file.

**Auth:** None (URLs are time-limited by presigned URL expiry)

**Query Parameters:**
- `worksheetId` (required): UUID of the worksheet
- `file` (required): `worksheet-pdf | worksheet-docx | worksheet-html | answer-key-pdf | answer-key-docx`

**Response 200:**
```json
{
  "url": "https://presigned-s3-url",
  "expiresAt": "2026-03-28T12:15:00Z",
  "filename": "grade3_math_multiplication_medium_20260328.pdf"
}
```

**Error 404:**
```json
{ "error": "Not Found", "code": "WORKSHEET_NOT_FOUND" }
```

**Error 400 — Invalid file type:**
```json
{ "error": "Bad Request", "code": "INVALID_FILE_TYPE" }
```

---

## GET /api/worksheets

List recently generated worksheets (for the authenticated user, or all if admin).

**Auth:** Bearer token required

**Query Parameters:**
- `limit` (optional, default 20): integer 1–100
- `lastKey` (optional): DynamoDB pagination cursor
- `subject` (optional): filter by subject
- `grade` (optional): filter by grade

**Response 200:**
```json
{
  "worksheets": [
    {
      "worksheetId": "uuid-v4",
      "title": "Grade 3 Math — Multiplication",
      "grade": 3,
      "subject": "Math",
      "topic": "Multiplication",
      "difficulty": "Medium",
      "questionCount": 10,
      "generatedAt": "2026-03-28T12:00:00Z",
      "expiresAt": "2026-04-04T12:00:00Z",
      "formats": ["pdf", "docx", "html"]
    }
  ],
  "count": 5,
  "lastKey": "base64-pagination-cursor"
}
```

---

## Curriculum Validation

The `/api/generate` endpoint validates `topic` against the curriculum map (`src/ai/topics.js`). To query available topics before generating:

**GET /api/topics**

**Query Parameters:**
- `grade` (required): integer 1–10
- `subject` (required): subject enum

**Response 200:**
```json
{
  "grade": 3,
  "subject": "Math",
  "topics": ["Addition", "Subtraction", "Multiplication", "Division", "Fractions"],
  "standards": ["CCSS.MATH.CONTENT.3.OA.A.1"],
  "questionTypes": ["multiple-choice", "fill-in-the-blank", "show-your-work"],
  "description": "Grade 3 Math covers operations and algebraic thinking..."
}
```

---

## Global Invariants (RC-BE-01)

1. Every `POST /api/generate` response MUST include `worksheetId`.
2. Every `worksheetId` MUST map to a `solve-data.json` file in storage within 30 seconds of the response.
3. Every `worksheetId` MUST map to a `metadata.json` file in storage.
4. `downloadUrls` presigned URLs MUST be valid for at least 15 minutes.
5. `questionCount` in the response MUST equal the number of items in the generated worksheet's `questions` array.
6. `generationMode` and `provenanceLevel` fields MUST accurately reflect the generation source.
7. `options` field in question objects MUST only appear for `multiple-choice` type questions.

## Worksheet Lifecycle Contract

```
Generated → Stored (S3 / local)
     │
     ├── Expires after 7 days (S3 lifecycle rule)
     │
     └── Can be flagged (admin) or deleted (admin)
              │
              └── Deletion: S3 files removed, solve-data.json removed (solve disabled)
                            metadata.json overwritten with {deleted: true}
```
