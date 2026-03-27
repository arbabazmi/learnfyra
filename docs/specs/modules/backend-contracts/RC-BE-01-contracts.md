# RC-BE-01 - Backend Contract Lock and Compatibility Baseline
Status: release-baseline
Task ID: RC-BE-01
Authors: backend-developer-agent + architect-agent
Updated: 2026-03-26

## Purpose

Freeze backend API compatibility guarantees for release candidate hardening.

This baseline defines:
- frozen endpoint inventory
- response and auth compatibility guarantees
- additive-only change rules before RC cut
- non-blocking technical debt to defer beyond RC

## Contract Lock Rules

1. No breaking changes to request field names, required fields, or endpoint paths.
2. No breaking changes to core response envelopes (`statusCode`, `headers`, `body`).
3. New fields must be additive and ignorable by existing clients.
4. Error `message` text may improve, but status code semantics must remain stable.
5. Role/ownership checks may tighten for security but must not broaden access.

## Frozen API Inventory

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/oauth/:provider`
- `GET /api/auth/callback/:provider`

### Worksheet Lifecycle
- `POST /api/generate`
- `GET /api/solve/:worksheetId`
- `POST /api/submit`
- `GET /api/download`

### Student/Class/Progress
- `GET /api/student/profile`
- `POST /api/student/join-class`
- `POST /api/class/create`
- `GET /api/class/:id/students`
- `POST /api/progress/save`
- `GET /api/progress/history`
- `GET /api/progress/insights`
- `GET /api/progress/parent/:childId`

### Analytics/Rewards/Certificates
- `GET /api/analytics/class/:id`
- `GET /api/analytics/student/:id`
- `GET /api/rewards/student/:id`
- `GET /api/rewards/class/:id`
- `GET /api/certificates`
- `GET /api/certificates/:id/download`

### Question Bank
- `GET /api/qb/questions`
- `POST /api/qb/questions`
- `GET /api/qb/questions/:id`
- `POST /api/qb/questions/:id/reuse`

### Admin Control Plane
- `GET /api/admin/policies`
- `PUT /api/admin/policies/model-routing`
- `PUT /api/admin/policies/budget-usage`
- `PUT /api/admin/policies/validation-profile`
- `GET /api/admin/audit/events`

## Compatibility Guarantees

### Request Compatibility

1. Existing clients can continue sending prior `POST /api/generate` payloads without new required fields.
2. Existing solve/submit clients remain valid with current payload shape and optional fields.
3. Role-bound endpoints preserve current token claim expectations (`sub`, `email`, `role`).

### Response Compatibility

1. Success responses keep existing top-level properties for all frozen endpoints.
2. Error responses continue using JSON error envelope with stable status code class.
3. Additive response fields are allowed (for observability or machine-readable codes) when optional.

### Security Compatibility

1. Security hardening can add stricter validation and ownership checks.
2. Security hardening cannot remove existing auth checks or widen access scope.

## Validation and Quality Baseline

Minimum release checks before RC-BE-02 completion:

1. Focused suites for recently changed handlers pass.
2. Cross-module integration hardening tests pass.
3. No diagnostics errors in changed backend files.
4. CORS headers remain present on success and error paths for API handlers.

## Non-Blocking Technical Debt (Deferred)

1. Full transaction semantics for multi-write persistence paths.
2. Centralized schema registry for all endpoint request/response contracts.
3. Unified error code taxonomy across all modules.
4. Expanded integration coverage for all role combinations in one matrix suite.
5. Policy-consumer wiring from admin policy to generation runtime beyond current baseline.

## Go/No-Go Risk List

### Must Be Green (Go criteria)

1. No known authorization bypass in teacher/parent/admin routes.
2. No solve endpoint answer leakage.
3. Idempotency replay/conflict behavior deterministic for admin mutation endpoints.
4. No failing tests in modified backend suites.

### Blockers (No-Go)

1. Any regression that changes status code class for existing client error paths.
2. Any endpoint contract break (required request fields changed or removed path).
3. Any failing security regression test in access-controlled routes.

## RC-BE-02 Entry Criteria

RC-BE-02 can proceed when:
1. This contract baseline is accepted as frozen.
2. INT hardening evidence is available and passing.
3. Remaining work is limited to hardening and release-quality fixes only.