# Guardrails & Repeat Cap Admin API Contracts

**Status: DRAFT — 2026-04-04**

All endpoints require `admin` role JWT. Guardrail and repeat-cap management is restricted to Super Admin and Platform Admin only.

---

## A. AI Guardrails Admin Endpoints

### GET /api/admin/guardrails/policy

Get current guardrail configuration.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Response 200:**
```json
{
  "policy": {
    "guardrailLevel": "medium",
    "retryLimit": 3,
    "enableAwsComprehend": false,
    "comprehToxicityThreshold": 0.75,
    "validationFilters": ["profanity", "sensitiveTopics"],
    "updatedAt": "2026-04-04T10:30:00Z",
    "updatedBy": "admin-user-id"
  }
}
```

**Response 403:** `{ "error": "Forbidden — requires Super Admin or Platform Admin" }`

---

### PUT /api/admin/guardrails/policy

Update guardrail configuration. Partial update — only include fields to change.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Request:**
```json
{
  "guardrailLevel": "strict",
  "retryLimit": 2,
  "reason": "Tightening for younger audience"
}
```

**Validation:**
- `guardrailLevel`: must be `"medium"` or `"strict"` (no `"none"`)
- `retryLimit`: integer 0-5
- `reason`: required string, min 5 characters

**Response 200:**
```json
{
  "success": true,
  "policy": {
    "guardrailLevel": "strict",
    "retryLimit": 2,
    "enableAwsComprehend": false,
    "comprehToxicityThreshold": 0.75,
    "validationFilters": ["profanity", "sensitiveTopics"],
    "updatedAt": "2026-04-04T10:31:00Z",
    "updatedBy": "admin-user-id"
  },
  "auditId": "uuid",
  "changes": {
    "guardrailLevel": { "from": "medium", "to": "strict" },
    "retryLimit": { "from": 3, "to": 2 }
  }
}
```

**Response 400:** `{ "error": "Invalid guardrailLevel. Must be 'medium' or 'strict'" }`
**Response 403:** `{ "error": "Forbidden" }`

---

### GET /api/admin/guardrails/templates

List all guardrail prompt templates.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Response 200:**
```json
{
  "templates": {
    "medium": {
      "content": "You are generating educational worksheets for Grade [grade] students...",
      "version": 2,
      "updatedAt": "2026-04-04T10:00:00Z",
      "updatedBy": "admin-user-id"
    },
    "strict": {
      "content": "You are generating educational worksheets for young students in Grade [grade]...",
      "version": 1,
      "updatedAt": "2026-04-04T00:00:00Z",
      "updatedBy": "system"
    }
  }
}
```

---

### PUT /api/admin/guardrails/templates/:level

Update a guardrail prompt template.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Path:** `:level` = `medium` or `strict`

**Request:**
```json
{
  "content": "You are generating educational worksheets for Grade [grade] students (ages [age])...",
  "reason": "Adding inclusivity emphasis"
}
```

**Validation:**
- `content` must contain `[grade]` and `[age]` placeholders
- `reason`: required string

**Response 200:**
```json
{
  "success": true,
  "template": {
    "level": "strict",
    "content": "...",
    "version": 2,
    "updatedAt": "2026-04-04T10:32:00Z",
    "updatedBy": "admin-user-id"
  },
  "auditId": "uuid"
}
```

**Response 400:** `{ "error": "Template must contain [grade] and [age] placeholders" }`

---

### POST /api/admin/guardrails/test

Dry-run validation on a sample worksheet (does not save or generate).

**Auth:** Bearer token (Super Admin or Platform Admin)

**Request:**
```json
{
  "worksheet": {
    "grade": 3,
    "subject": "Math",
    "questions": [
      { "number": 1, "question": "What is 2 + 2?", "answer": "4", "explanation": "2 + 2 = 4" }
    ]
  },
  "guardrailLevel": "strict"
}
```

**Response 200:**
```json
{
  "validationResult": {
    "safe": true,
    "failureReason": null,
    "failureDetails": null,
    "validatorsRun": ["profanityFilter", "sensitiveTopicFilter"]
  }
}
```

---

### GET /api/admin/audit/guardrail-events

Query moderation audit events.

**Auth:** Bearer token (Super Admin or Data/Compliance Admin)

**Query Parameters:**
- `startDate` (required): ISO-8601
- `endDate` (required): ISO-8601
- `failureReason` (optional): `PROFANITY` | `SENSITIVE_TOPIC` | `AWS_COMPREHEND`
- `limit` (optional, default 50, max 200)
- `lastKey` (optional): pagination cursor

**Response 200:**
```json
{
  "events": [
    {
      "auditId": "uuid",
      "timestamp": "2026-04-04T10:30:00Z",
      "eventType": "generation.moderation",
      "worksheetId": "uuid",
      "details": {
        "guardrailLevel": "medium",
        "validationResult": { "safe": false, "failureReason": "PROFANITY" },
        "retryCount": 1
      },
      "status": "retry"
    }
  ],
  "count": 50,
  "lastKey": "pagination-cursor"
}
```

---

## B. Repeat Cap Admin Endpoints

### GET /api/admin/repeat-cap

Get global default and all active overrides.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Response 200:**
```json
{
  "global": {
    "value": 20,
    "updatedAt": "2026-04-04T10:00:00Z",
    "updatedBy": "admin-user-id"
  },
  "overrides": [
    {
      "scope": "student",
      "scopeId": "student-uuid",
      "value": 10,
      "reason": "Remedial student needs more variety",
      "expiresAt": "2026-06-01T00:00:00Z",
      "createdAt": "2026-04-04T10:05:00Z",
      "updatedBy": "admin-user-id"
    }
  ]
}
```

---

### PUT /api/admin/repeat-cap

Update global repeat cap default.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Request:**
```json
{
  "value": 25,
  "reason": "Increasing cap due to limited Science inventory"
}
```

**Validation:**
- `value`: integer 0-100
- `reason`: required string, min 5 characters

**Response 200:**
```json
{
  "success": true,
  "global": {
    "value": 25,
    "updatedAt": "2026-04-04T10:10:00Z",
    "updatedBy": "admin-user-id"
  },
  "auditId": "uuid",
  "changes": { "value": { "from": 20, "to": 25 } }
}
```

**Response 400:** `{ "error": "value must be integer 0-100" }`
**Response 403:** `{ "error": "Forbidden" }`

---

### POST /api/admin/repeat-cap/override

Create a scope-specific override.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Request:**
```json
{
  "scope": "student",
  "scopeId": "student-uuid",
  "value": 10,
  "reason": "Remedial student needs more question variety",
  "expiresAt": "2026-06-01T00:00:00Z"
}
```

**Validation:**
- `scope`: `"student"` | `"parent"` | `"teacher"`
- `scopeId`: valid UUID
- `value`: integer 0-100
- `reason`: required
- `expiresAt`: optional ISO-8601 (must be future date)

**Response 201:**
```json
{
  "success": true,
  "override": {
    "scope": "student",
    "scopeId": "student-uuid",
    "value": 10,
    "reason": "Remedial student needs more question variety",
    "expiresAt": "2026-06-01T00:00:00Z",
    "createdAt": "2026-04-04T10:15:00Z",
    "updatedBy": "admin-user-id"
  },
  "auditId": "uuid"
}
```

**Response 409:** `{ "error": "Override already exists for student:student-uuid. Use PUT to update." }`

---

### DELETE /api/admin/repeat-cap/override/:scope/:scopeId

Remove a scope-specific override.

**Auth:** Bearer token (Super Admin or Platform Admin)

**Response 200:**
```json
{
  "success": true,
  "deleted": { "scope": "student", "scopeId": "student-uuid" },
  "auditId": "uuid"
}
```

**Response 404:** `{ "error": "Override not found for student:student-uuid" }`
