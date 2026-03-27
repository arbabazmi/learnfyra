# INT-BE-01 - Cross-Module Integration Contract and Risk Map
Status: implementation-ready
Task ID: INT-BE-01
Authors: backend-developer-agent + architect-agent
Updated: 2026-03-26

## Purpose

Define integration contracts across M01-M07 backend modules so INT-BE-02 can harden behavior without breaking existing APIs.

This document covers:
- shared identity and authorization contracts
- cross-endpoint data flow contracts
- consistency and idempotency expectations
- prioritized backend integration risk map

## Integrated Module Surface

| Module | Core Handlers | Integration Role |
|---|---|---|
| M01 Auth | `authHandler` + `authMiddleware` | identity issuance, JWT claims, role checks |
| M02 Question Bank | `questionBankHandler`, bank adapter | reusable content inventory and dedupe |
| M03 Generation | `generateHandler`, `assembler` | worksheet assembly, provenance, storage artifacts |
| M04 Solve/Submit | `solveHandler`, `submitHandler`, scorer/result builder | safe solve projection and deterministic scoring |
| M05 Progress/Analytics | `progressHandler`, `analyticsHandler`, `certificatesHandler` | attempt persistence, aggregates, insights, teacher/parent reporting |
| M06 Class Relationships | `classHandler`, `studentHandler` | teacher/student association and class scoping |
| M07 Admin Control Plane | `adminHandler` | generation governance and policy auditability |

## Global Invariants

1. All handlers return Lambda-compatible `{ statusCode, headers, body }`.
2. All success and error responses include CORS headers.
3. JWT decode contract is stable: `{ sub, email, role }`.
4. UUID identifiers are v4 where required by endpoint contracts.
5. Core domain tables remain append/update compatible in local and AWS adapters.

## Cross-Module Contracts

### 1) Identity and Role Contract

Producer: M01 (`authHandler`, JWT generation)

Consumers: M05, M06, M07 and any protected route via `validateToken` + `requireRole`

Contract:
- `sub` is canonical user identifier used by `attempts`, `memberships`, `aggregates`, `certificates`, `adminAuditEvents`.
- Role values used by current backend: `student`, `teacher`, `parent`, `admin`.
- Role mismatch always returns `403` and must not leak protected records.

### 2) Worksheet Lifecycle Contract

Flow: `POST /api/generate` -> `GET /api/solve/:id` -> `POST /api/submit`

Contract:
- Generation persists solve payload with authoritative answers.
- Solve endpoint exposes render-only question fields and must never leak `answer`/`explanation`.
- Submit endpoint always scores against persisted authoritative data, never client-provided answer key.
- Submit response includes per-question review (including correct answer/explanation) after submission.

### 3) Attempt Persistence Contract

Flow: `POST /api/submit` (frontend) -> `POST /api/progress/save` (persistence path)

Contract:
- `attempts` records are immutable event entries.
- `aggregates` are derived summaries keyed by `{studentId}#{subject}`.
- Aggregate recomputation uses weighted totals, not unweighted average percentages.
- Certificate issuance is non-fatal side effect on first qualifying attempt.

### 4) Class/Relationship Scoping Contract

Producers: M06 (`classHandler`, `studentHandler`)

Consumers: M05 analytics/reporting endpoints

Contract:
- `memberships.id = {classId}#{studentId}` enforces uniqueness.
- Roster/analytics class views require owner teacher scope (`class.teacherId === JWT.sub`).
- Student profile returns active memberships only.
- Parent reporting requires active `parentLinks` authorization.

### 5) Admin Policy Governance Contract

Producer: M07 (`adminHandler`)

Consumer: generation orchestration (M03 path)

Contract:
- Policy updates are admin-only, idempotent, and auditable.
- Mutation endpoints require `Idempotency-Key`.
- Every successful mutation emits exactly one audit event.
- Failed validation responses are not persisted as idempotency snapshots.

## Shared Data Contract Matrix

| Entity | Primary Key | Producers | Consumers | Notes |
|---|---|---|---|---|
| users | `userId` | M01 | M05, M06, certificates | source for displayName/email projection |
| classes | `classId` | M06 | M06, M05 analytics | includes `teacherId`, `inviteCode` |
| memberships | `id` | M06 | M06, M05 | active/inactive status controls visibility |
| attempts | `attemptId` | M05 | M05 analytics/insights | immutable attempt history |
| aggregates | `id` | M05 | M05 parent/student analytics | derived summary table |
| certificates | `id` | M05 | certificatesHandler | student-facing completion artifacts |
| parentLinks | `id` | onboarding/admin scope | M05 parent endpoint | authz gate for parent access |
| adminPolicies | `id=global` | M07 | M07, M03 consumer path | policy singleton with versioning |
| adminAuditEvents | `id` | M07 | M07 audit list endpoint | mutation accountability |
| adminIdempotency | `id` | M07 | M07 mutation endpoints | replay/conflict control |

## Consistency and Idempotency Rules

1. `PUT` admin mutations are idempotent by `{actorId, endpoint, idempotencyKey}`.
2. Same key + same payload returns cached response.
3. Same key + different payload returns `409` conflict.
4. Class membership upsert pattern prevents duplicate enrollments.
5. Progress save updates aggregates in same request path; failures outside core attempt write are non-fatal where explicitly documented.

## Prioritized Risk Map

### P0 Risks (must be mitigated in INT-BE-02)

1. Authorization bypass across teacher/parent/admin scopes.
Cause: inconsistent ownership checks or missing role enforcement.
Mitigation: centralized authz guard assertions in tests for every sensitive endpoint.

2. Solve answer leakage regression.
Cause: accidental projection of internal question fields.
Mitigation: projection allowlist tests and regression fixtures for solve responses.

3. Cross-table consistency drift (attempts vs aggregates).
Cause: partial failure during progress save side effects.
Mitigation: reconciliation utility/test and strict update-order error handling.

### P1 Risks

1. Idempotency replay conflict bugs in admin mutation routes.
Mitigation: conflict/replay regression tests and request-hash normalization hardening.

2. Invite code integrity and class mis-association.
Mitigation: uniqueness checks, duplicate-detection error path, and data integrity tests.

3. Pagination/filter inconsistency across analytics endpoints.
Mitigation: shared pagination parser and boundary test suite.

### P2 Risks

1. Metadata contract drift between docs and response payloads.
Mitigation: contract snapshots in tests for core endpoints.

2. Local-vs-AWS adapter behavior mismatch.
Mitigation: adapter parity checklist for key query/update patterns.

## INT-BE-02 Implementation Checklist

1. Build shared integration test matrix for authz + response-shape invariants.
2. Add cross-module smoke flow tests:
   - auth -> class join -> solve -> submit -> progress save -> analytics
3. Add regression guards for solve leakage and admin idempotency replay.
4. Add consistency checks between attempts and aggregates.
5. Add risk-based negative tests for class ownership and parent link access.

## Acceptance Criteria

Given all backend modules are integrated
When protected endpoints are called with invalid role or ownership
Then access is denied with correct status and no sensitive data exposure.

Given a worksheet is generated and solved
When submission and progress save are executed
Then scoring, attempt persistence, and aggregate updates remain contract-aligned.

Given admin policies are updated with idempotency keys
When requests are replayed or conflicted
Then behavior follows idempotency contract with replay and conflict determinism.

Given integration hardening tests run
When regressions are introduced in cross-module contracts
Then tests fail with actionable diagnostics mapped to this risk list.