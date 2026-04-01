# Admin API Contracts (M07)

**Status: FROZEN — RC-BE-01 (2026-03-26)**

All endpoints require `admin` role JWT. Specific actions require specific admin sub-roles (see `02-modules/admin.md` for RBAC matrix).

---

## User Management

### GET /api/admin/users

List all platform users with optional filters.

**Auth:** Bearer token (admin role — any admin sub-role)

**Query Parameters:**
- `role` (optional): filter by role
- `limit` (optional, default 50)
- `lastKey` (optional): pagination cursor
- `search` (optional): email or name substring

**Response 200:**
```json
{
  "users": [
    {
      "userId": "uuid-v4",
      "email": "user@example.com",
      "name": "User Name",
      "role": "teacher",
      "createdAt": "2026-01-15T10:00:00Z",
      "lastLoginAt": "2026-03-28T12:00:00Z"
    }
  ],
  "count": 50,
  "lastKey": "pagination-cursor"
}
```

---

### GET /api/admin/users/:userId

Get full user detail.

**Auth:** Bearer token (admin role — any admin sub-role)

**Response 200:**
```json
{
  "userId": "uuid-v4",
  "email": "user@example.com",
  "name": "User Name",
  "role": "student",
  "createdAt": "2026-01-15T10:00:00Z",
  "lastLoginAt": "2026-03-28T12:00:00Z",
  "totalAttempts": 24,
  "classIds": ["uuid-1", "uuid-2"]
}
```

---

### PUT /api/admin/users/:userId/role

Change a user's role.

**Auth:** Bearer token (Super Admin only)

**Request:**
```json
{ "role": "teacher" }
```

**Response 200:**
```json
{ "userId": "uuid-v4", "role": "teacher", "updatedAt": "2026-03-28T12:00:00Z" }
```

**Error 403 — Not Super Admin:**
```json
{ "error": "Forbidden", "code": "INSUFFICIENT_ROLE" }
```

---

### POST /api/admin/users/:userId/suspend

Suspend a user account.

**Auth:** Bearer token (Super Admin or Support Admin)

**Request:**
```json
{ "reason": "Violation of terms of service" }
```

**Response 200:**
```json
{ "userId": "uuid-v4", "status": "suspended", "suspendedAt": "2026-03-28T12:00:00Z" }
```

---

### POST /api/admin/users/:userId/unsuspend

Reinstate a suspended account.

**Auth:** Bearer token (Super Admin or Support Admin)

**Request:** Empty `{}`

**Response 200:**
```json
{ "userId": "uuid-v4", "status": "active", "unsuspendedAt": "2026-03-28T12:00:00Z" }
```

---

### DELETE /api/admin/users/:userId

Soft-delete a user (GDPR). PII nulled, data anonymized.

**Auth:** Bearer token (Super Admin only)

**Response 200:**
```json
{ "userId": "uuid-v4", "deleted": true, "deletedAt": "2026-03-28T12:00:00Z" }
```

---

## AI Model Management

### GET /api/admin/models

List configured AI models.

**Auth:** Bearer token (Ops Admin or Super Admin)

**Response 200:**
```json
{
  "activeModel": "claude-sonnet-4-20250514",
  "models": [
    {
      "modelId": "claude-sonnet-4-20250514",
      "provider": "anthropic",
      "displayName": "Claude Sonnet 4",
      "isActive": true,
      "addedAt": "2026-01-01T00:00:00Z"
    },
    {
      "modelId": "claude-haiku-20240307",
      "provider": "anthropic",
      "displayName": "Claude Haiku",
      "isActive": false,
      "addedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### PUT /api/admin/models/:modelId/activate

Switch the active AI model. Takes effect immediately for all subsequent requests.

**Auth:** Bearer token (Ops Admin or Super Admin)

**Request:**
```json
{ "reason": "Claude Sonnet degraded — switching to Haiku fallback" }
```

**Response 200:**
```json
{
  "previousModel": "claude-sonnet-4-20250514",
  "activeModel": "claude-haiku-20240307",
  "switchedAt": "2026-03-28T12:00:00Z",
  "switchedBy": "admin@learnfyra.com"
}
```

---

### POST /api/admin/models/rollback

Roll back to the previous active model.

**Auth:** Bearer token (Ops Admin or Super Admin)

**Response 200:**
```json
{
  "rolledBackTo": "claude-sonnet-4-20250514",
  "rolledBackAt": "2026-03-28T13:00:00Z",
  "rolledBackBy": "admin@learnfyra.com"
}
```

---

### GET /api/admin/models/audit

Get model switch audit log.

**Auth:** Bearer token (any admin sub-role)

**Query Parameters:**
- `limit` (optional, default 20)

**Response 200:**
```json
{
  "entries": [
    {
      "switchedAt": "2026-03-28T12:00:00Z",
      "previousModel": "claude-sonnet-4-20250514",
      "newModel": "claude-haiku-20240307",
      "switchedBy": "ops@learnfyra.com",
      "reason": "Claude Sonnet degraded"
    }
  ]
}
```

---

## Worksheet Oversight

### GET /api/admin/worksheets

List recent worksheets with metadata.

**Auth:** Bearer token (any admin sub-role)

**Query Parameters:**
- `flagged` (optional, boolean): filter to flagged only
- `limit` (optional, default 50)
- `lastKey` (optional)

**Response 200:**
```json
{
  "worksheets": [
    {
      "worksheetId": "uuid-v4",
      "title": "Grade 3 Math — Multiplication",
      "grade": 3,
      "subject": "Math",
      "generatedAt": "2026-03-28T12:00:00Z",
      "flagged": false,
      "generationMode": "ai-only"
    }
  ],
  "count": 50,
  "lastKey": "cursor"
}
```

---

### POST /api/admin/worksheets/:worksheetId/flag

Flag a worksheet for quality review.

**Auth:** Bearer token (any admin sub-role)

**Request:**
```json
{ "reason": "Content appears grade-inappropriate" }
```

**Response 200:**
```json
{ "worksheetId": "uuid-v4", "flagged": true, "flaggedAt": "2026-03-28T12:00:00Z" }
```

---

### DELETE /api/admin/worksheets/:worksheetId

Remove a worksheet. Deletes S3 files and marks metadata as deleted.

**Auth:** Bearer token (Super Admin only)

**Response 200:**
```json
{ "worksheetId": "uuid-v4", "deleted": true, "deletedAt": "2026-03-28T12:00:00Z" }
```

---

## Platform Configuration

### GET /api/admin/config

List all platform configuration entries.

**Auth:** Bearer token (Ops Admin or Super Admin)

**Response 200:**
```json
{
  "config": [
    {
      "configKey": "ai/activeModel",
      "value": "claude-sonnet-4-20250514",
      "updatedBy": "ops@learnfyra.com",
      "updatedAt": "2026-03-28T12:00:00Z"
    },
    {
      "configKey": "platform/maintenanceMode",
      "value": "false",
      "updatedBy": "system",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### PUT /api/admin/config/:configKey

Update a configuration value.

**Auth:** Bearer token (Ops Admin or Super Admin)

**Request:**
```json
{
  "value": "true",
  "reason": "Scheduled maintenance window"
}
```

**Response 200:**
```json
{
  "configKey": "platform/maintenanceMode",
  "previousValue": "false",
  "value": "true",
  "updatedAt": "2026-03-28T12:00:00Z"
}
```

---

## Reports

### GET /api/admin/reports/usage

**Auth:** Bearer token (Data/Compliance Admin or higher)

**Query Parameters:**
- `from` (ISO-8601 date)
- `to` (ISO-8601 date)
- `groupBy` (optional): `day | subject | grade`

**Response 200:**
```json
{
  "period": { "from": "2026-03-01", "to": "2026-03-28" },
  "totalGenerations": 1247,
  "bySubject": { "Math": 520, "ELA": 318, "Science": 249, "Social Studies": 110, "Health": 50 },
  "byGrade": { "3": 180, "4": 220, "5": 315 },
  "byDay": [
    { "date": "2026-03-28", "count": 87 }
  ]
}
```

---

### GET /api/admin/reports/cost

Estimated Claude API spend from GenerationLog.

**Auth:** Bearer token (Data/Compliance Admin or higher)

**Response 200:**
```json
{
  "period": { "from": "2026-03-01", "to": "2026-03-28" },
  "totalGenerations": 1247,
  "aiOnlyGenerations": 890,
  "estimatedTokensUsed": 12450000,
  "estimatedCostUSD": 37.35,
  "modelBreakdown": {
    "claude-sonnet-4-20250514": { "count": 890, "estimatedCostUSD": 37.35 }
  }
}
```

---

### GET /api/admin/reports/errors

Error rate and recent error messages by Lambda function.

**Auth:** Bearer token (Ops Admin or higher)

**Response 200:**
```json
{
  "period": "last_24h",
  "functions": [
    {
      "functionName": "learnfyra-generate-prod",
      "invocations": 1247,
      "errors": 3,
      "errorRate": 0.24,
      "recentErrors": [
        {
          "timestamp": "2026-03-28T11:30:00Z",
          "message": "Claude API timeout after 60 seconds",
          "requestId": "abc123"
        }
      ]
    }
  ]
}
```
