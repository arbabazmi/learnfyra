# DynamoDB Table Design

**Updated: docs/coppa-auth-architecture (2026-04-03)**
- Added `createdBy-index` GSI to `LearnfyraGenerationLog`
- Added `createdBy` attribute to `LearnfyraGenerationLog`
- Added COPPA tables: `LearnfyraPendingConsent`, `LearnfyraConsentLog`
- Updated `LearnfyraUsers` with ageGroup, parentId, linkedChildIds, consentId fields + parent-index GSI

## Table Overview

| Table | PK | SK | GSIs | Purpose |
|---|---|---|---|---|
| LearnfyraQuestionBank-{env} | questionId | — | GSI-1 (lookupKey+typeDifficulty), dedupeHash-index | Reusable questions |
| LearnfyraUsers-{env} | userId | — | email-index, parent-index | User accounts, roles, progress aggregates |
| LearnfyraWorksheetAttempt-{env} | userId | sortKey (worksheetId#{timestamp}) | — | Student solve attempts |
| LearnfyraClasses-{env} | classId | — | teacherId-index, joinCode-index | Class definitions |
| LearnfyraClassMemberships-{env} | classId | studentId | studentId-index | Class enrollment |
| LearnfyraCertificates-{env} | certificateId | — | userId-index | Completion certificates |
| LearnfyraGenerationLog-{env} | worksheetId | — | createdBy-index | AI generation audit trail |
| LearnfyraConfig-{env} | configKey | — | — | Platform config, model routing |
| LearnfyraPendingConsent-{env} | consentRequestId | — | — | COPPA: pending parent consent (72h TTL) |
| LearnfyraConsentLog-{env} | consentId | — | parentId-index, childId-index | COPPA: immutable consent audit trail |

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
| options | L | multiple-choice only | ["A. ...", "B. ...", "C. ...", "D. ..."] |
| pairs | L | matching only | `[{ "left": "term", "right": "definition" }, ...]` — see ADR-012 |
| answer | S | Yes | Correct answer. For `short-answer`: pipe-delimited keywords e.g. `"osmosis\|membrane"`. For `matching`: sentinel string `"pairs"`. All other types: exact answer string. |
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

### GSI-2: dedupeHash-index (ADR-011)

| | Attribute | Notes |
|---|---|---|
| PK | dedupeHash | SHA256(grade\|subject\|topic\|type\|normalizedQuestion) |
| Projection | KEYS_ONLY | Stores only `dedupeHash` + `questionId` |

Used by `questionBank/adapter.js` `questionExists(dedupeHash)` before saving a new question. Point-lookup only — no sort key. Prevents duplicate questions from accumulating in the bank across multiple generation runs.

**Local adapter:** iterates `worksheets-local/question-bank.json` and compares `dedupeHash` in-process. No GSI infrastructure needed locally.

---

## LearnfyraUsers

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| userId | S | PK | UUID v4 |
| email | S | Yes | Unique, GSI partition key |
| role | S | Yes | student / teacher / parent / admin / suspended |
| ageGroup | S | Yes | under13 / 13plus / adult (COPPA) |
| name | S | Yes | Display name (nickname only for under-13) |
| parentId | S | No | For under-13 students: parent's userId (COPPA) |
| linkedChildIds | SS | No | For parent records: list of child userIds (COPPA) |
| consentId | S | No | For under-13 students: reference to ConsentLog entry (COPPA) |
| createdAt | S | Yes | ISO-8601 |
| lastLoginAt | S | No | ISO-8601 |
| googleSub | S | No | Google OAuth subject ID |
| linkedStudentId | S | No | Parent records only (legacy — use linkedChildIds for COPPA) |
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

### GSI: parent-index (COPPA)

| | Attribute |
|---|---|
| PK | parentId |

Used to list all children linked to a parent account. Supports `GET /api/auth/children` and cascading deletion on consent revocation. Sparse index — only under-13 student records have `parentId`.

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

### GSI: joinCode-index (ADR-014)

| | Attribute | Notes |
|---|---|---|
| PK | joinCode | 6-char alphanumeric |
| Projection | KEYS_ONLY | Stores only `joinCode` + `classId` |

Used by `POST /api/classes/join` to resolve a student's join code to a `classId` in O(1). `joinCode` belongs on `LearnfyraClasses` (not Memberships) because it is a class attribute.

**Local adapter:** iterates `worksheets-local/classes.json` to find the matching joinCode in-process.

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
| createdBy | S | No | userId of the authenticated user who generated this worksheet. Null/absent for guest generations. Required for `GET /api/worksheets/mine`. |
| formats | SS | Yes | Requested export formats |
| s3Prefix | S | Yes | S3 key prefix for all files |
| ttl | N | Yes | Unix timestamp — expires in 7 days (DynamoDB TTL) |

### GSI: createdBy-index (added feat/my-worksheets-tracking)

| | Attribute | Notes |
|---|---|---|
| PK | createdBy | userId of the authenticated generator |
| SK | createdAt | ISO-8601 — enables date-sorted queries |
| Projection | ALL | Full item projection needed to populate worksheet list |

**Purpose:** Supports `GET /api/worksheets/mine` and `GET /api/dashboard/recent-worksheets`. Both endpoints query all worksheets generated by a specific user, sorted by creation date descending.

**CDK construct:** Added to `LearnfyraGenerationLog` table definition in `infra/lib/constructs/storage.ts`.

**Local adapter:** Iterates `worksheets-local/generation-log.json` and filters by `createdBy` in-process. No GSI infrastructure needed locally.

**Query example:**
```javascript
{
  TableName: 'LearnfyraGenerationLog-{env}',
  IndexName: 'createdBy-index',
  KeyConditionExpression: 'createdBy = :uid',
  ExpressionAttributeValues: { ':uid': 'user-uuid' },
  ScanIndexForward: false,  // most recent first
  Limit: 20
}
```

**Sparse index note:** Guest-generated worksheets have no `createdBy` attribute and do not appear in this GSI. Only authenticated user worksheets are indexed.

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

## LearnfyraPendingConsent (COPPA)

Stores consent requests while awaiting parent verification. Auto-deleted after 72 hours via DynamoDB TTL.

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| consentRequestId | S | PK | UUID v4 |
| parentEmail | S | Yes | Email to send consent request to |
| childNickname | S | No | Optional nickname provided by child |
| consentToken | S | Yes | Unique single-use token for consent email link |
| status | S | Yes | pending / consented / expired |
| createdAt | S | Yes | ISO-8601 |
| expiresAt | N | Yes | Unix timestamp for DynamoDB TTL (72h from creation) |
| ipAddress | S | Yes | IP address of the child's request (audit) |

**TTL:** `expiresAt` — DynamoDB auto-deletes expired records. No manual cleanup needed.

**No GSIs:** PendingConsent is looked up by `consentRequestId` (PK) only. Rate limiting on `parentEmail` is done via a Scan with filter (low volume, max 3 per email per day).

---

## LearnfyraConsentLog (COPPA)

Immutable audit trail of all parental consent actions. Records are NEVER deleted — this is a regulatory requirement for FTC COPPA compliance.

### Primary Schema

| Attribute | Type | Required | Notes |
|---|---|---|---|
| consentId | S | PK | UUID v4 |
| parentId | S | Yes | Parent userId who gave consent |
| childId | S | Yes | Child userId created after consent |
| consentMethod | S | Yes | email_plus / credit_card / gov_id |
| consentGivenAt | S | Yes | ISO-8601 timestamp |
| ipAddress | S | Yes | IP address at time of consent |
| policyVersion | S | Yes | Version of privacy policy accepted (e.g., "v1.0") |
| revokedAt | S | No | ISO-8601 timestamp (NULL if active) |
| revokedReason | S | No | Reason for revocation (NULL if active) |

**Critical:** `RemovalPolicy.RETAIN` on ALL environments (not just prod). ConsentLog records are NEVER deleted, even after consent revocation — only the `revokedAt` and `revokedReason` fields are updated.

### GSI: parentId-index

| | Attribute |
|---|---|
| PK | parentId |

Used to list all consent records for a parent (Parent Dashboard).

### GSI: childId-index

| | Attribute |
|---|---|
| PK | childId |

Used to look up consent status for a specific child account.

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
  consent.html
  parent-dashboard.html
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
