# DynamoDB Table Design

## Table Overview

| Table | PK | SK | GSIs | Purpose |
|---|---|---|---|---|
| LearnfyraQuestionBank-{env} | questionId | — | GSI-1 (lookupKey + typeDifficulty) | Reusable questions |
| LearnfyraUsers-{env} | userId | — | email-index | User accounts, roles, progress aggregates |
| LearnfyraWorksheetAttempt-{env} | userId | sortKey (worksheetId#{timestamp}) | — | Student solve attempts |
| LearnfyraClasses-{env} | classId | — | teacherId-index | Class definitions |
| LearnfyraClassMemberships-{env} | classId | studentId | studentId-index | Class enrollment |
| LearnfyraCertificates-{env} | certificateId | — | userId-index | Completion certificates |
| LearnfyraGenerationLog-{env} | worksheetId | — | — | AI generation audit trail |
| LearnfyraConfig-{env} | configKey | — | — | Platform config, model routing |

All tables: `BillingMode: PAY_PER_REQUEST`. Point-in-time recovery enabled on prod.

---

## LearnfyraQuestionBank

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| questionId | S | PK | UUID v4 |
| dedupeHash | S | Yes | SHA256(grade\|subject\|topic\|type\|normalizedQuestion) |
| grade | N | Yes | 1–10 |
| subject | S | Yes | Math \| ELA \| Science \| Social Studies \| Health |
| topic | S | Yes | From curriculum map |
| type | S | Yes | Question type enum |
| difficulty | S | Yes | Easy \| Medium \| Hard |
| question | S | Yes | Question text |
| options | L | Multiple-choice only | ["A. ...", "B. ...", "C. ...", "D. ..."] |
| answer | S | Yes | Correct answer string |
| explanation | S | Yes | Answer key explanation |
| points | N | Yes | Default: 1 |
| standards | SS | Yes | CCSS/NGSS/NHES codes |
| createdAt | S | Yes | ISO-8601 |
| generatedByModel | S | Yes | Claude model ID |
| timesUsed | N | Yes | Usage counter, starts at 0 |

### GSI-1: Topic-Type Lookup

| | Attribute | Notes |
|---|---|---|
| PK | lookupKey | `"grade#{grade}#subject#{subject}#topic#{topic}"` |
| SK | typeDifficulty | `"{type}#{difficulty}"` |

Example PK: `"grade#3#subject#Math#topic#Multiplication"`
Example SK: `"multiple-choice#Medium"`

This GSI supports the primary access pattern: "give me N questions of type X, difficulty Y, for grade G, subject S, topic T."

---

## LearnfyraUsers

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| userId | S | PK | UUID v4 |
| email | S | Yes | Unique, GSI partition key |
| role | S | Yes | student / teacher / parent / admin / suspended |
| name | S | Yes | Display name |
| createdAt | S | Yes | ISO-8601 |
| lastLoginAt | S | No | ISO-8601 |
| googleSub | S | No | Google OAuth subject ID |
| linkedStudentId | S | No | Parent records only |
| linkedParentIds | SS | No | Student records only |
| classIds | SS | No | Student's enrolled class IDs |
| deletedAt | S | No | Soft-delete timestamp |

**Precomputed progress aggregates (stored on student records):**

| Attribute | Type | Description |
|---|---|---|
| totalAttempts | N | Count of all worksheet attempts |
| avgScore | N | Mean percentage across all attempts |
| streak | N | Consecutive days with at least 1 attempt |
| lastActive | S | Most recent attempt ISO-8601 |
| weakAreas | SS | Topics with avgScore < 60% |
| strongAreas | SS | Topics with avgScore > 85% |
| subjectAvgScores | M | Map of subject → avgScore |

### GSI: email-index

| | Attribute |
|---|---|
| PK | email |

Used during authentication to look up userId by email.

---

## LearnfyraWorksheetAttempt

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| userId | S | PK | Student's user ID |
| sortKey | S | SK | `{worksheetId}#{ISO-8601-timestamp}` |
| worksheetId | S | Yes | |
| grade | N | Yes | |
| subject | S | Yes | |
| topic | S | Yes | |
| difficulty | S | Yes | |
| score | N | Yes | Points earned |
| totalPoints | N | Yes | Points possible |
| percentage | N | Yes | score/totalPoints × 100 |
| timeTaken | N | Yes | Seconds taken |
| timed | BOOL | Yes | Was timed mode used |
| answers | M | Yes | Map of questionNumber → submittedAnswer |
| completedAt | S | Yes | ISO-8601 |

---

## LearnfyraClasses

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| classId | S | PK | UUID v4 |
| teacherId | S | Yes | Teacher's userId |
| name | S | Yes | Class display name |
| grade | N | No | Optional — class may span grades |
| subject | S | No | Optional |
| joinCode | S | Yes | 6-char alphanumeric |
| createdAt | S | Yes | ISO-8601 |
| studentCount | N | Yes | Precomputed count |
| archivedAt | S | No | ISO-8601 or absent |

### GSI: teacherId-index

| | Attribute |
|---|---|
| PK | teacherId |

Used to list all classes for a given teacher.

---

## LearnfyraClassMemberships

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| classId | S | PK | |
| studentId | S | SK | |
| joinedAt | S | Yes | ISO-8601 |
| status | S | Yes | active / removed |
| removedAt | S | No | ISO-8601 when removed |

### GSI: studentId-index

| | Attribute |
|---|---|
| PK | studentId |

Used to list all classes a student is enrolled in.

---

## LearnfyraCertificates

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| certificateId | S | PK | UUID v4 |
| userId | S | Yes | Student's userId |
| worksheetId | S | Yes | |
| attemptId | S | Yes | Sort key from WorksheetAttempt |
| score | N | Yes | |
| percentage | N | Yes | |
| issuedAt | S | Yes | ISO-8601 |
| studentName | S | Yes | Name at time of issue |
| worksheetTitle | S | Yes | |
| s3Key | S | Yes | `certificates/{userId}/{certificateId}.pdf` |

### GSI: userId-index

| | Attribute |
|---|---|
| PK | userId |

Used to list all certificates for a student.

---

## LearnfyraGenerationLog

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| worksheetId | S | PK | UUID v4 |
| generatedAt | S | Yes | ISO-8601 |
| grade | N | Yes | |
| subject | S | Yes | |
| topic | S | Yes | |
| difficulty | S | Yes | |
| questionCount | N | Yes | |
| generationMode | S | Yes | bank-only / mixed / ai-only |
| provenanceLevel | S | Yes | full-bank / partial-bank / full-ai |
| modelUsed | S | Yes | Claude model ID |
| durationMs | N | Yes | Generation latency |
| userId | S | No | If generated by authenticated user |
| formats | SS | Yes | Requested export formats |
| s3Prefix | S | Yes | S3 key prefix for all files |
| ttl | N | Yes | Unix timestamp — expires in 7 days (DynamoDB TTL) |

---

## LearnfyraConfig

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| configKey | S | PK | Dotted path, e.g., "ai/activeModel" |
| value | (varies) | Yes | String, Number, or Boolean |
| updatedBy | S | Yes | Admin email or "system" |
| updatedAt | S | Yes | ISO-8601 |
| reason | S | No | Reason for change |
| previousValue | S | No | For rollback |

See `02-modules/admin.md` for full list of config keys.

---

## S3 Key Structure

```
learnfyra-{env}-s3-worksheets/
  worksheets/{year}/{month}/{day}/{uuid}/
    worksheet.pdf
    worksheet.docx
    worksheet.html
    answer-key.pdf
    answer-key.docx
    answer-key.html
    metadata.json          ← no answers, no PII
    solve-data.json        ← full worksheet with answers (authoritative)

  certificates/{userId}/{certificateId}.pdf

learnfyra-{env}-s3-frontend/
  index.html
  solve.html
  login.html
  register.html
  css/styles.css
  css/solve.css
  css/auth.css
  js/app.js
  js/solve.js
  js/auth.js

learnfyra-{env}-s3-logs/
  access-logs/
```

### metadata.json Schema

```json
{
  "id": "uuid-v4",
  "generatedAt": "2026-03-28T12:00:00Z",
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "questionCount": 10,
  "formats": ["pdf", "docx", "html"],
  "expiresAt": "2026-04-04T12:00:00Z",
  "flagged": false
}
```

No answers, no explanations, no PII stored in metadata.json.
