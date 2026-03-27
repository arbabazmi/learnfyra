# M07-BE-01 - Admin Control Plane Backend Contracts
Status: implementation-ready
Task ID: M07-BE-01
Authors: backend-developer-agent + architect-agent
Updated: 2026-03-26

## Summary

This contract defines admin-only backend APIs for generation governance:
- model routing policy
- premium escalation and fallback behavior
- budget and usage policy thresholds
- validation strictness profiles

This is contract-only work. Implementation belongs to M07-BE-02.

## Scope

- Backend API contracts only
- Admin authentication/authorization rules
- Data contracts for persistent policy state
- Audit event schema for sensitive changes
- Idempotency and safety controls for policy mutation endpoints

Out of scope:
- Frontend admin console
- AWS deployment and IAM provisioning
- Real-time billing ingestion implementation

## Existing Touchpoints

The current generation path already supports inputs needed for policy-driven behavior:
- `backend/handlers/generateHandler.js` passes `generationMode` and `provenanceLevel`
- `backend/middleware/validator.js` validates `generationMode` and `provenanceLevel`
- `src/ai/assembler.js` performs model selection (`LOW_COST_MODEL`, `CLAUDE_MODEL`, `PREMIUM_MODEL`)

M07-BE-02 will wire policy resolution into this existing flow without breaking current request compatibility.

## Authorization Matrix

| Endpoint | Role Required | Ownership Rule |
|---|---|---|
| GET /api/admin/policies | admin | JWT role must be `admin` |
| PUT /api/admin/policies/model-routing | admin | JWT role must be `admin` |
| PUT /api/admin/policies/budget-usage | admin | JWT role must be `admin` |
| PUT /api/admin/policies/validation-profile | admin | JWT role must be `admin` |
| GET /api/admin/audit/events | admin | JWT role must be `admin` |

Any non-admin caller receives `403 Forbidden`.

## Standard Response Model

All responses follow Lambda-compatible shape with CORS headers:

```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Idempotency-Key",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS"
  },
  "body": "json-string"
}
```

Error envelope:

```json
{
  "error": "Human-readable message.",
  "code": "ADMIN_INVALID_REQUEST"
}
```

Canonical error codes:
- `ADMIN_INVALID_REQUEST`
- `ADMIN_FORBIDDEN`
- `ADMIN_NOT_FOUND`
- `ADMIN_CONFLICT`
- `ADMIN_INTERNAL_ERROR`

## Data Contracts

### adminPolicies

Primary key: `id`, singleton value `global`

```json
{
  "id": "global",
  "version": 1,
  "modelRouting": {
    "defaultMode": "auto",
    "allowPremium": true,
    "premiumEscalation": {
      "missingCountThreshold": 15,
      "hardQuestionCountThreshold": 10
    },
    "fallbackOrder": ["low", "default", "premium"]
  },
  "budgetUsage": {
    "dailyUsdSoftLimit": 100,
    "dailyUsdHardLimit": 150,
    "monthlyUsdSoftLimit": 2500,
    "monthlyUsdHardLimit": 3000,
    "softLimitBehavior": "log-only",
    "hardLimitBehavior": "block-premium"
  },
  "validationProfile": {
    "name": "standard",
    "strictness": "balanced",
    "rejectOnCountMismatch": true,
    "rejectOnSchemaViolation": true,
    "allowPartialIfRecoverable": false
  },
  "updatedAt": "ISO-8601",
  "updatedBy": "uuid-v4"
}
```

### adminIdempotency

Primary key: `id`

```json
{
  "id": "{actorId}#{idempotencyKey}",
  "actorId": "uuid-v4",
  "idempotencyKey": "string",
  "action": "update-model-routing|update-budget-usage|update-validation-profile",
  "requestHash": "sha256 hex",
  "responseStatusCode": 200,
  "responseBody": "json-string",
  "createdAt": "ISO-8601",
  "expiresAt": "ISO-8601"
}
```

TTL expectation: 24 hours.

### adminAuditEvents

Primary key: `id`

```json
{
  "id": "uuid-v4",
  "eventType": "admin.policy.updated",
  "action": "update-model-routing",
  "actorId": "uuid-v4",
  "actorRole": "admin",
  "target": "adminPolicies.global.modelRouting",
  "before": {"...": "redacted-safe snapshot"},
  "after": {"...": "redacted-safe snapshot"},
  "reason": "string",
  "requestId": "lambda request id",
  "idempotencyKey": "string or null",
  "createdAt": "ISO-8601"
}
```

## Endpoint Contracts

### GET /api/admin/policies

Purpose: return current effective policy snapshot used by generation.

Success `200`:

```json
{
  "version": 1,
  "modelRouting": {
    "defaultMode": "auto",
    "allowPremium": true,
    "premiumEscalation": {
      "missingCountThreshold": 15,
      "hardQuestionCountThreshold": 10
    },
    "fallbackOrder": ["low", "default", "premium"]
  },
  "budgetUsage": {
    "dailyUsdSoftLimit": 100,
    "dailyUsdHardLimit": 150,
    "monthlyUsdSoftLimit": 2500,
    "monthlyUsdHardLimit": 3000,
    "softLimitBehavior": "log-only",
    "hardLimitBehavior": "block-premium"
  },
  "validationProfile": {
    "name": "standard",
    "strictness": "balanced",
    "rejectOnCountMismatch": true,
    "rejectOnSchemaViolation": true,
    "allowPartialIfRecoverable": false
  },
  "updatedAt": "ISO-8601",
  "updatedBy": "uuid-v4"
}
```

Errors:
- `401` invalid token
- `403` non-admin role

### PUT /api/admin/policies/model-routing

Purpose: update default model route and premium escalation rules.

Required headers:
- `Authorization: Bearer <token>`
- `Idempotency-Key: <opaque string>`

Request:

```json
{
  "defaultMode": "auto",
  "allowPremium": true,
  "premiumEscalation": {
    "missingCountThreshold": 15,
    "hardQuestionCountThreshold": 10
  },
  "fallbackOrder": ["low", "default", "premium"],
  "reason": "Enable premium only for high-complexity requests."
}
```

Validation rules:
- `defaultMode` in `auto|bank-first`
- `allowPremium` boolean
- thresholds are integers, `missingCountThreshold` 1-30, `hardQuestionCountThreshold` 5-30
- `fallbackOrder` includes only `low|default|premium`, no duplicates, minimum 2 entries
- `reason` required, 10-300 chars

Success `200`:

```json
{
  "message": "Model routing policy updated.",
  "version": 2,
  "appliedAt": "ISO-8601"
}
```

### PUT /api/admin/policies/budget-usage

Purpose: update cost thresholds and enforcement behavior.

Required headers:
- `Authorization`
- `Idempotency-Key`

Request:

```json
{
  "dailyUsdSoftLimit": 100,
  "dailyUsdHardLimit": 150,
  "monthlyUsdSoftLimit": 2500,
  "monthlyUsdHardLimit": 3000,
  "softLimitBehavior": "log-only",
  "hardLimitBehavior": "block-premium",
  "reason": "Reduce budget overrun risk while preserving baseline generation."
}
```

Validation rules:
- limits are finite numbers > 0
- soft limit must be <= hard limit for both daily and monthly
- `softLimitBehavior` in `log-only|warn-and-log`
- `hardLimitBehavior` in `block-premium|block-generation`
- when `hardLimitBehavior=block-generation`, `reason` must include a ticket token matching `[A-Z]{2,10}-<digits>`

Success `200`:

```json
{
  "message": "Budget and usage policy updated.",
  "version": 3,
  "appliedAt": "ISO-8601"
}
```

### PUT /api/admin/policies/validation-profile

Purpose: update generation validation strictness profile.

Required headers:
- `Authorization`
- `Idempotency-Key`

Request:

```json
{
  "name": "strict",
  "strictness": "strict",
  "rejectOnCountMismatch": true,
  "rejectOnSchemaViolation": true,
  "allowPartialIfRecoverable": false,
  "reason": "Raise correctness bar for district pilot."
}
```

Validation rules:
- `name` in `lenient|standard|strict|custom`
- `strictness` in `lenient|balanced|strict`
- toggle fields are booleans
- unsafe combination blocked: `rejectOnSchemaViolation=false` with `strictness=strict`
- strictness downgrade rule: if previous strictness is `strict` and new strictness is `lenient`, `reason` minimum length is 25

Success `200`:

```json
{
  "message": "Validation profile updated.",
  "version": 4,
  "appliedAt": "ISO-8601"
}
```

### GET /api/admin/audit/events

Purpose: list admin policy mutation events.

Query params:
- `limit` default `50`, range `1-200`
- `offset` default `0`, min `0`
- `action` optional filter

Success `200`:

```json
{
  "events": [
    {
      "id": "uuid-v4",
      "eventType": "admin.policy.updated",
      "action": "update-model-routing",
      "actorId": "uuid-v4",
      "target": "adminPolicies.global.modelRouting",
      "createdAt": "ISO-8601"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "returned": 1
  }
}
```

## Idempotency Rules

For each mutation endpoint (`PUT`):
1. `Idempotency-Key` is required.
2. Key scope is `{actorId} + {endpoint}`.
3. If key already exists with same `requestHash`, return previously stored status/body.
4. If key exists with different `requestHash`, return `409 ADMIN_CONFLICT`.
5. Store idempotency record before returning successful mutation response.

## Safety Rules

1. Must always keep at least one usable fallback route. Reject empty `fallbackOrder`.
2. Disallow budget config where any hard limit is below corresponding soft limit.
3. Disallow `block-generation` without explicit `reason` containing ticket reference.
4. Validation strictness downgrade from `strict` to `lenient` requires reason length >= 25.
5. Every accepted mutation must emit one audit event with before/after snapshots.

## Backward Compatibility Requirements

1. If no admin policy exists, generation behavior must match current defaults.
2. Existing `/api/generate` request body remains unchanged and optional fields remain optional.
3. Policy application failures in runtime should fail open to current safe defaults and log an admin warning.

## M07-BE-02 Implementation Checklist

1. Create `backend/handlers/adminHandler.js` with routes defined above.
2. Add admin role support in auth role enforcement where missing.
3. Add policy service module (`src/admin/policyService.js`) for load/validate/update.
4. Add audit writer (`src/admin/auditService.js`) and idempotency store helper.
5. Wire `generateHandler`/`assembler` policy resolution without breaking current defaults.
6. Add unit tests for authz, validation, idempotency replay/conflict, and audit emission.

## Acceptance Criteria

Given an admin updates model routing policy
When a later worksheet generation request is processed
Then generation routing follows the updated policy and fallback rules.

Given budget hard limit behavior is configured to block premium
When premium escalation conditions are met and budget is over hard limit
Then generation degrades to configured fallback route.

Given validation profile is changed by admin
When generation validation runs
Then behavior follows the selected strictness toggles.

Given a non-admin user calls any admin endpoint
When request is processed
Then response is 403 and no policy mutation occurs.

Given two identical update requests with same Idempotency-Key
When both are processed
Then the second returns the original response without duplicate mutation or duplicate audit event.