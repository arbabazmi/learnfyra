# M07: Admin Module — Requirements and Task Board

**Document ID:** LFR-M07-TASKS-001
**Date:** 2026-03-27
**Status:** Requirements Specification — Ready for Implementation
**Effort Mode:** Standard
**Sources:** M07-admin-control-plane-spec.md, Admin Module.md, module-breakdown-phase1.md, Database.md, M01-M03-REQUIREMENTS-AND-TASKS.md, CLAUDE.md

---

## Status Legend

| Symbol | Meaning |
|---|---|
| [DONE] | Fully implemented |
| [PARTIAL] | Exists but incomplete |
| [MISSING] | Not implemented |
| not-started | Task not yet begun |

---

## PART 1 — Requirement Baseline

| REQ-ADMIN-NNN | Requirement | Priority | Status | Acceptance Criteria | Source |
|---|---|---|---|---|---|
| REQ-ADMIN-001 | Only admin role users may access any /api/admin/* endpoint | P0 | [PARTIAL] | Given a non-admin JWT, When any /api/admin/* endpoint is called, Then 403 with "Admin access required" and CORS headers; admin role must be in VALID_ROLES (blocks on TASK-AUTH-003) | FR-ADMIN-020 |
| REQ-ADMIN-002 | Admin must be able to list all users with pagination, filtered by role, registration date, or last login | P0 | [MISSING] | Given admin JWT, When GET /api/admin/users?role=teacher&limit=50, Then response contains users[] with userId, email, role, displayName, createdAt, lastLogin, activeFlag and cursor-based pagination | FR-ADMIN-001, FR-ADMIN-002 |
| REQ-ADMIN-003 | Admin must be able to deactivate a user account | P0 | [MISSING] | Given admin JWT and userId, When POST /api/admin/users/:userId/deactivate with { confirm: true }, Then Users table activeFlag=false; user cannot authenticate; audit log entry written | FR-ADMIN-003 |
| REQ-ADMIN-004 | Admin must be able to reactivate a deactivated user account | P0 | [MISSING] | Given admin JWT and userId with activeFlag=false, When POST /api/admin/users/:userId/reactivate, Then Users table activeFlag=true; audit log written | FR-ADMIN-003 |
| REQ-ADMIN-005 | Admin must be able to change a user's role | P0 | [MISSING] | Given admin JWT and valid userId, When POST /api/admin/users/:userId/role { role: "teacher" }, Then Users table role updated; role must be one of student/teacher/parent/admin; audit log written | FR-ADMIN-004 |
| REQ-ADMIN-006 | Admin must be able to manually link or unlink parent and student accounts | P1 | [MISSING] | Given admin JWT, When POST /api/admin/parent-link { parentId, studentId } or DELETE /api/admin/parent-link/:parentId/:studentId, Then ParentStudentLinks record created/deleted; audit log written | FR-ADMIN-005 |
| REQ-ADMIN-007 | Admin must be able to view all AI model configurations and their status | P1 | [MISSING] | Given admin JWT, When GET /api/admin/ai-models, Then response contains models[] with modelName, grade/subject scope, status (ACTIVE/DISABLED), defaultFor, fallbackModel, tokenUsage, qualityScoreThreshold | FR-ADMIN-006 |
| REQ-ADMIN-008 | Admin must be able to set a default AI model for a grade/subject/topic scope | P1 | [MISSING] | Given admin JWT, When PUT /api/admin/ai-models with modelName, grade, subject, fallbackModel, qualityScoreThreshold, Then Config table updated; subsequent generation for that scope uses configured model; audit log written | FR-ADMIN-007, FR-ADMIN-008 |
| REQ-ADMIN-009 | Admin must be able to disable an AI model | P1 | [MISSING] | Given admin JWT and modelName, When POST /api/admin/ai-models/:modelName/disable with { confirm: true }, Then Config table status=DISABLED; generation falls back to fallbackModel; audit log written | FR-ADMIN-010 |
| REQ-ADMIN-010 | Admin must be able to view AI usage statistics per model | P1 | [MISSING] | Given admin JWT, When GET /api/admin/ai-models/stats, Then response contains per-model: questionsGenerated, tokenUsage, successRate, failureRate from GenerationLog table | FR-ADMIN-009 |
| REQ-ADMIN-011 | Admin must be able to flag a question in the question bank for review | P0 | [MISSING] | Given admin JWT and questionId, When POST /api/admin/questions/:questionId/flag { reason }, Then QuestionBank status=FLAGGED; question excluded from bank-first selection until approved; audit log written | FR-ADMIN-012 |
| REQ-ADMIN-012 | Admin must be able to approve a flagged question | P0 | [MISSING] | Given admin JWT and flagged questionId, When POST /api/admin/questions/:questionId/approve, Then QuestionBank status=APPROVED; question re-enters bank selection; audit log written | FR-ADMIN-012 |
| REQ-ADMIN-013 | Admin must be able to configure repeat-cap override policy by scope | P0 | [MISSING] | Given admin JWT, When PUT /api/admin/policy/repeat-cap { scope: "student", targetId: "uuid", capPercent: 25 }, Then Config table stores override; capPercent must be integer 0–100; audit log written | FR-ADMIN-013, REQ-GEN-026 |
| REQ-ADMIN-014 | Admin must be able to view and update system-wide platform configuration | P1 | [MISSING] | Given admin JWT, When GET /api/admin/config, Then platform settings returned (maxQuestionsPerGrade, defaultAIModel, progressRetentionDays, weakTopicAccuracyThreshold, weakTopicMinAttempts); PUT /api/admin/config with any subset updates Config table; audit log written | FR-ADMIN-014 |
| REQ-ADMIN-015 | Admin must be able to view platform health metrics | P1 | [MISSING] | Given admin JWT, When GET /api/admin/health, Then response contains Lambda error rates, DynamoDB throttle counts, S3 usage from CloudWatch GetMetricData | FR-ADMIN-015 |
| REQ-ADMIN-016 | All admin write operations must be logged to AuditLog DynamoDB table | P0 | [MISSING] | Given any admin write operation, When it completes, Then AuditLog has record with PK=AUDIT#{timestamp}, SK=OP#{operationId}, performedBy, operationType, targetId, details | FR-ADMIN-016, FR-ADMIN-021 |
| REQ-ADMIN-017 | Admin must be able to query audit log with pagination and filter by operation type | P1 | [MISSING] | Given admin JWT, When GET /api/admin/audit?operationType=USER_DEACTIVATE&limit=50, Then audit[] returned sorted by timestamp descending with cursor-based pagination | FR-ADMIN-016 |
| REQ-ADMIN-018 | Admin must be able to perform bulk deactivation or bulk role change | P2 | [MISSING] | Given admin JWT, When POST /api/admin/users/bulk-deactivate { userIds: ["uuid", ...] }, Then all listed users deactivated; one audit log entry per user; { succeeded, failed, failedIds } returned | FR-ADMIN-017 |
| REQ-ADMIN-019 | Sensitive admin operations must require { confirm: true } in the request body | P0 | [MISSING] | Given admin attempts deactivate or model disable without { confirm: true }, Then 400 "Confirmation required"; with { confirm: true } operation proceeds | FR-ADMIN-022 |
| REQ-ADMIN-020 | Admin users must be provisioned via seed mechanism — not self-registration | P0 | [PARTIAL] | Given VALID_ROLES blocks admin in register, When new admin needed, Then account created via adminSeeder.js or direct DynamoDB write with role=admin | REQ-AUTH-013, GAP-001 |
| REQ-ADMIN-021 | CORS headers must be present on all admin endpoint responses including error paths | P0 | [MISSING] | Given any /api/admin/* response, Then Access-Control-Allow-Origin header present | FR-ADMIN-020 |
| REQ-ADMIN-022 | OPTIONS preflight must return 200 with CORS headers on all admin routes | P0 | [MISSING] | Given OPTIONS /api/admin/*, Then 200 with CORS headers and empty body | — |

---

## PART 2 — Design Decisions

| DEC-ADMIN-NNN | Decision | Chosen Approach | Rationale | Blocking REQs |
|---|---|---|---|---|
| DEC-ADMIN-001 | Admin role enforcement | assertRole(['admin']) as first middleware check — before any business logic or DynamoDB read | Single enforcement point. Consistent with existing assertRole pattern. | REQ-ADMIN-001 |
| DEC-ADMIN-002 | Config table design | Single DynamoDB Config table: PK=CONFIG#{configType}, SK=METADATA. configType examples: AI_MODEL#3#Math, PLATFORM_SETTINGS, REPEAT_CAP#student#{studentId} | Flexible key structure accommodates all admin-controlled settings. Repeat-cap override encoded in PK avoids per-entity tables. | REQ-ADMIN-008, REQ-ADMIN-013, REQ-ADMIN-014 |
| DEC-ADMIN-003 | AuditLog table design | PK=AUDIT#{ISO-8601-timestamp-UTC}, SK=OP#{operationId-UUID}. GSI1: PK=PERFORMER#{adminId}+SK=AUDIT#{timestamp}. GSI2: PK=OPTYPE#{operationType}+SK=AUDIT#{timestamp} | Timestamp PK enables chronological scan. GSIs enable filter by admin or operation type. UUID SK avoids hot partition on concurrent writes. | REQ-ADMIN-016, REQ-ADMIN-017 |
| DEC-ADMIN-004 | Platform health metrics source | CloudWatch GetMetricData called at request time in GET /api/admin/health — no pre-aggregation | Admin health checks are infrequent. ~200ms additional latency is acceptable. Phase 2 can add pre-aggregation. | REQ-ADMIN-015 |
| DEC-ADMIN-005 | AI model config propagation to generator | generateHandler reads Config table on each request for scope-specific model config. Falls back to env vars (CLAUDE_MODEL) if no config record found. | Real-time config changes take effect without Lambda redeployment. Config read adds ~1ms to generation flow. | REQ-ADMIN-008, REQ-ADMIN-009 |
| DEC-ADMIN-006 | Bulk operations strategy | BatchWriteItem in chunks of 25 (DynamoDB max). Partial failure returns { succeeded, failed, failedIds }. One audit entry per affected user. | BatchWriteItem handles partial failure natively. TransactWriteItems is 5x more expensive and not required here. | REQ-ADMIN-018 |
| DEC-ADMIN-007 | Sensitive operation confirmation | POST body must contain { confirm: true } for deactivate and model disable. Handler validates before executing any write. | Prevents accidental mutations from automation or copy-paste errors. | REQ-ADMIN-019 |
| DEC-ADMIN-008 | Admin handler isolation | Single backend/handlers/adminHandler.js with internal route dispatch. Dedicated admin Lambda with its own IAM scope. | Admin operations span multiple tables. Isolated Lambda = independent permission scope. | All REQ-ADMIN-* |

---

## PART 3 — Code Audit

### Existing Files

| File | Exists | Status | Notes |
|---|---|---|---|
| backend/handlers/adminHandler.js | Unknown | [MISSING] | CDK references questionBankHandler.js for /api/qb/questions/*. adminHandler.js for /api/admin/* not confirmed. Must be created. |
| backend/handlers/questionBankHandler.js | Unknown | [PARTIAL] | CDK references this. Overlaps with admin question flagging. Audit before splitting responsibilities. |
| tests/unit/adminHandler.test.js | No | [MISSING] | Must be created. |
| tests/integration/admin.test.js | No | [MISSING] | Must be created. |

### Missing Files

| File | Reason Needed |
|---|---|
| backend/handlers/adminHandler.js | All /api/admin/* endpoints |
| src/admin/auditLogger.js | Reusable audit log write helper |
| DynamoDB Config table in CDK | REQ-ADMIN-008, REQ-ADMIN-013, REQ-ADMIN-014 |
| DynamoDB AuditLog table in CDK | REQ-ADMIN-016, REQ-ADMIN-017 |
| DynamoDB GenerationLog table in CDK | REQ-ADMIN-010 |
| Admin Lambda CloudWatch IAM policy | REQ-ADMIN-015 |
| Admin seeder script (adminSeeder.js) | REQ-ADMIN-020 |
| tests/unit/adminHandler.test.js | QA coverage |
| tests/integration/admin.test.js | End-to-end evidence |

---

## PART 4 — API Contracts

### GET /api/admin/users
Query: `?role=teacher&from=2026-01-01&limit=50&cursor={base64key}`

Success Response (200):
```json
{
  "users": [
    {
      "userId": "uuid",
      "email": "teacher@example.com",
      "role": "teacher",
      "displayName": "Ms. Johnson",
      "createdAt": "2026-01-15T10:00:00Z",
      "lastLogin": "2026-03-25T14:00:00Z",
      "activeFlag": true
    }
  ],
  "count": 50,
  "nextCursor": "base64-encoded-last-evaluated-key"
}
```

### POST /api/admin/users/:userId/deactivate
Request: `{ "confirm": true }`
Success (200): `{ "userId": "uuid", "deactivated": true, "auditId": "uuid" }`
Errors: 400 (confirm missing/false), 403, 404

### POST /api/admin/users/:userId/reactivate
Success (200): `{ "userId": "uuid", "reactivated": true, "auditId": "uuid" }`

### POST /api/admin/users/:userId/role
Request: `{ "role": "teacher" }`
Success (200): `{ "userId": "uuid", "newRole": "teacher", "previousRole": "student", "auditId": "uuid" }`
Errors: 400 (invalid role — must be student/teacher/parent/admin), 403, 404

### GET /api/admin/ai-models
Success (200):
```json
{
  "models": [
    {
      "configKey": "AI_MODEL#3#Math",
      "modelName": "claude-haiku-4-20250514",
      "grade": 3,
      "subject": "Math",
      "fallbackModel": "claude-sonnet-4-20250514",
      "qualityScoreThreshold": 0.85,
      "status": "ACTIVE"
    }
  ]
}
```

### PUT /api/admin/ai-models
Request: `{ "modelName": "...", "grade": 3, "subject": "Math", "fallbackModel": "...", "qualityScoreThreshold": 0.85, "status": "ACTIVE" }`
Success (200): `{ "updated": true, "configKey": "AI_MODEL#3#Math", "auditId": "uuid" }`

### POST /api/admin/ai-models/:modelName/disable
Request: `{ "confirm": true }`
Success (200): `{ "modelName": "...", "status": "DISABLED", "auditId": "uuid" }`

### POST /api/admin/questions/:questionId/flag
Request: `{ "reason": "Incorrect answer key for Grade 5 fractions question" }`
Success (200): `{ "questionId": "uuid", "status": "FLAGGED", "auditId": "uuid" }`

### POST /api/admin/questions/:questionId/approve
Success (200): `{ "questionId": "uuid", "status": "APPROVED", "auditId": "uuid" }`

### PUT /api/admin/policy/repeat-cap
Request: `{ "scope": "student", "targetId": "uuid", "capPercent": 25 }`
Validation: scope ∈ [student, teacher, parent, default]; capPercent integer 0–100; targetId required when scope ≠ default
Success (200): `{ "scope": "student", "targetId": "uuid", "capPercent": 25, "configKey": "CONFIG#REPEAT_CAP#student#uuid", "auditId": "uuid" }`

### GET /api/admin/config
Success (200): `{ "maxQuestionsPerGrade": 30, "defaultAIModel": "claude-sonnet-4-20250514", "progressRetentionDays": 365, "weakTopicAccuracyThreshold": 60, "weakTopicMinAttempts": 3 }`

### PUT /api/admin/config
Request: any subset of platform config fields
Success (200): `{ "updated": true, "fields": ["weakTopicAccuracyThreshold"], "auditId": "uuid" }`

### GET /api/admin/health
Success (200):
```json
{
  "lambda": {
    "generate": { "errorRate": 0.2, "p99LatencyMs": 4200 },
    "submit": { "errorRate": 0.0, "p99LatencyMs": 320 }
  },
  "dynamodb": { "throttledRequests": 0, "consumedReadCapacity": 12.4 },
  "s3": { "worksheetBucketSizeGB": 1.2, "objectCount": 4320 },
  "retrievedAt": "2026-03-27T10:00:00Z"
}
```

### GET /api/admin/audit
Query: `?operationType=USER_DEACTIVATE&limit=50&cursor={base64key}`
Success (200): `{ "audit": [...], "count": 50, "nextCursor": "..." }`

### AuditLog Operation Type Enum

| operationType | Triggered By |
|---|---|
| USER_DEACTIVATE | POST /api/admin/users/:id/deactivate |
| USER_REACTIVATE | POST /api/admin/users/:id/reactivate |
| USER_ROLE_CHANGE | POST /api/admin/users/:id/role |
| PARENT_LINK_CREATE | POST /api/admin/parent-link |
| PARENT_LINK_DELETE | DELETE /api/admin/parent-link/:parentId/:studentId |
| AI_MODEL_CONFIG_UPDATE | PUT /api/admin/ai-models |
| AI_MODEL_DISABLE | POST /api/admin/ai-models/:name/disable |
| QUESTION_FLAG | POST /api/admin/questions/:id/flag |
| QUESTION_APPROVE | POST /api/admin/questions/:id/approve |
| REPEAT_CAP_UPDATE | PUT /api/admin/policy/repeat-cap |
| PLATFORM_CONFIG_UPDATE | PUT /api/admin/config |

---

## PART 5 — Task Board

| Task ID | Title | Agent | Inputs | Deliverables | Depends On | Priority | Status |
|---|---|---|---|---|---|---|---|
| TASK-ADMIN-001 | Define admin API contract | ba-agent + architect-agent | M07-ADMIN-MODULE-TASKS.md, Admin Module.md, M07-admin-control-plane-spec.md | Locked contracts for all /api/admin/* endpoints; AuditLog schema; Config table key design; repeat-cap precedence rules; error model | TASK-AUTH-003 | P0 | not-started |
| TASK-ADMIN-002 | Implement user list and filter endpoint | dev-agent | TASK-ADMIN-001 contract, Users table (TASK-AUTH-020) | GET /api/admin/users: GSI1 query by role when filter supplied; cursor pagination; assertRole(['admin']); CORS | TASK-ADMIN-001, TASK-AUTH-020 | P0 | not-started |
| TASK-ADMIN-003 | Implement user deactivate, reactivate, and role change | dev-agent | TASK-ADMIN-001 contract, adminHandler.js | POST deactivate: confirm check, UpdateItem activeFlag=false, writeAuditLog; POST reactivate: activeFlag=true; POST role: validate enum, UpdateItem, writeAuditLog; CORS | TASK-ADMIN-001, TASK-AUTH-020, TASK-ADMIN-008 | P0 | not-started |
| TASK-ADMIN-004 | Implement AI model config read and write endpoints | dev-agent | TASK-ADMIN-001 contract, Config table | GET /api/admin/ai-models; PUT /api/admin/ai-models; POST /api/admin/ai-models/:name/disable with confirm check; writeAuditLog on writes; CORS | TASK-ADMIN-001, TASK-ADMIN-007 | P1 | not-started |
| TASK-ADMIN-005 | Implement question flagging and approval | dev-agent | TASK-ADMIN-001 contract, QuestionBank table | POST /api/admin/questions/:id/flag: UpdateItem status=FLAGGED; POST /api/admin/questions/:id/approve: UpdateItem status=APPROVED; verify assembler.js filters non-ACTIVE/APPROVED; writeAuditLog; CORS | TASK-ADMIN-001, TASK-QB-003 | P0 | not-started |
| TASK-ADMIN-006 | Implement repeat-cap policy override endpoint | dev-agent | TASK-ADMIN-001 contract, Config table, REQ-GEN-026 | PUT /api/admin/policy/repeat-cap: validate scope enum + capPercent 0–100 + targetId when required; PutItem Config table PK=CONFIG#REPEAT_CAP#{scope}#{targetId}; writeAuditLog; CORS | TASK-ADMIN-001, TASK-ADMIN-007 | P0 | not-started |
| TASK-ADMIN-007 | CDK wiring — Config, AuditLog, GenerationLog tables + admin Lambda | devops-agent | infra/cdk/lib/learnfyra-stack.ts, M07 table schemas | Config table; AuditLog table with GSI1 (PERFORMER) + GSI2 (OPTYPE); GenerationLog table with GSI1 (USER); Admin Lambda (256MB, 15s, ARM_64); IAM grants; CloudWatch read policy; API Gateway /api/admin/* routes; CDK synth zero warnings; CDK assertion tests | TASK-ADMIN-001 | P0 | not-started |
| TASK-ADMIN-008 | Implement audit log write helper and query endpoint | dev-agent | TASK-ADMIN-001 contract, AuditLog table schema | src/admin/auditLogger.js: writeAuditLog({ performedBy, operationType, targetId, details }) — PutItem, returns auditId, swallows own DynamoDB errors; GET /api/admin/audit: GSI2 query when operationType filter present; cursor pagination; CORS | TASK-ADMIN-001, TASK-ADMIN-007 | P0 | not-started |
| TASK-ADMIN-009 | Implement platform health metrics and platform config endpoints | dev-agent | TASK-ADMIN-001 contract, CloudWatch SDK | GET /api/admin/health: CloudWatch GetMetricData + S3 ListObjectsV2; GET/PUT /api/admin/config: GetItem/UpdateItem CONFIG#PLATFORM_SETTINGS; writeAuditLog on PUT; CORS | TASK-ADMIN-001, TASK-ADMIN-007, TASK-ADMIN-008 | P1 | not-started |
| TASK-ADMIN-010 | Unit and integration tests for admin module | qa-agent | adminHandler.js, auditLogger.js, CLAUDE.md QA checklist | tests/unit/adminHandler.test.js (22 test cases — see Part 6); tests/unit/auditLogger.test.js; tests/integration/admin.test.js; all DynamoDB + CloudWatch mocked | TASK-ADMIN-002 through TASK-ADMIN-009 | P0 | not-started |

---

## PART 6 — Agent Prompt Pack

### TASK-ADMIN-001
```text
Agent: ba-agent + architect-agent
Task ID: TASK-ADMIN-001
Goal: Define and lock complete admin API contracts.
Inputs:
  - docs/tasks/backend/M07-ADMIN-MODULE-TASKS.md
  - docs/requirements/platform/Admin Module.md
  - docs/specs/modules/M07-admin-control-plane-spec.md
  - docs/tasks/backend/M01-M03-REQUIREMENTS-AND-TASKS.md (REQ-GEN-025, REQ-GEN-026, GAP-001)
  - CLAUDE.md
Deliverables:
  - Locked contracts for all /api/admin/* endpoints in Part 4 of this file
  - AuditLog DynamoDB table schema with GSIs
  - Config table key design for AI model config, platform settings, and repeat-cap overrides
  - Repeat-cap override precedence rules (student > parent > teacher > default)
  - Operation type enum for AuditLog
  - Confirmation requirement rule for sensitive operations
  - Admin provisioning procedure (REQ-ADMIN-020)
  - Error model: 400/401/403/404/500 with machine-readable codes
Constraints: No implementation. Audit log must be written as side-effect of every write operation.
Output: implementation-ready contract.
```

### TASK-ADMIN-003
```text
Agent: dev-agent
Task ID: TASK-ADMIN-003
Goal: Implement user deactivate, reactivate, and role change endpoints with audit logging.
Inputs:
  - docs/tasks/backend/M07-ADMIN-MODULE-TASKS.md TASK-ADMIN-001 approved contract
  - backend/handlers/adminHandler.js (create if not exists)
  - DYNAMODB_TABLE_USERS env var (from TASK-AUTH-020)
  - src/admin/auditLogger.js (from TASK-ADMIN-008 — must exist first)
  - CLAUDE.md
Deliverables:
  - POST /api/admin/users/:userId/deactivate: validate { confirm: true } (400 if absent), UpdateItem activeFlag=false, writeAuditLog(USER_DEACTIVATE)
  - POST /api/admin/users/:userId/reactivate: UpdateItem activeFlag=true, writeAuditLog(USER_REACTIVATE)
  - POST /api/admin/users/:userId/role: validate role enum, UpdateItem, writeAuditLog(USER_ROLE_CHANGE)
  - assertRole(['admin']) + validateToken on all routes
  - CORS headers, OPTIONS 200
  - context.callbackWaitsForEmptyEventLoop = false
Constraints: writeAuditLog failure must NOT cause handler to return 500 — catch and console.error only.
Output: files changed, test results.
```

### TASK-ADMIN-007
```text
Agent: devops-agent
Task ID: TASK-ADMIN-007
Goal: Add Config, AuditLog, and GenerationLog DynamoDB tables to CDK; wire admin Lambda.
Inputs:
  - infra/cdk/lib/learnfyra-stack.ts (read before modifying)
  - docs/tasks/backend/M07-ADMIN-MODULE-TASKS.md Part 4 (table schemas)
  - CLAUDE.md CDK patterns
Deliverables:
  - Config table: PK=CONFIG#{configType}, SK=METADATA; PAY_PER_REQUEST; RemovalPolicy per env
  - AuditLog table: PK=AUDIT#{timestamp}, SK=OP#{operationId}; GSI1: PERFORMER#{adminId}+AUDIT#{timestamp}; GSI2: OPTYPE#{type}+AUDIT#{timestamp}; RemovalPolicy.RETAIN on prod
  - GenerationLog table: PK=GENERATION#{requestId}, SK=METADATA; GSI1: USER#{userId}+CREATED#{createdAt}; 90-day TTL attribute; RemovalPolicy per env
  - Admin Lambda (256MB, 15s, ARM_64): grantReadWriteData on Config, AuditLog, QuestionBank, Users, ParentStudentLinks; grantReadData on GenerationLog, WorksheetAttempts; CloudWatch GetMetricData + GetMetricStatistics IAM policy; S3 ListBucket on worksheet bucket
  - Env vars injected: CONFIG_TABLE_NAME, AUDIT_LOG_TABLE_NAME, GENERATION_LOG_TABLE_NAME, USERS_TABLE_NAME
  - API Gateway /api/admin/* → admin Lambda
  - CDK synth zero warnings; CDK assertion tests for all 3 tables and GSIs
Constraints: IaC only. No handler code. No hardcoded ARNs.
Output: CDK diff, table/GSI inventory, synth evidence.
```

### TASK-ADMIN-008
```text
Agent: dev-agent
Task ID: TASK-ADMIN-008
Goal: Implement audit log write helper and query endpoint.
Inputs:
  - docs/tasks/backend/M07-ADMIN-MODULE-TASKS.md Part 4 (AuditLog schema, operation type enum)
  - AUDIT_LOG_TABLE_NAME env var (from TASK-ADMIN-007)
  - CLAUDE.md
Deliverables:
  - src/admin/auditLogger.js: async writeAuditLog({ performedBy, operationType, targetId, details })
    → PutItem to AuditLog table; PK=AUDIT#{new Date().toISOString()}, SK=OP#{uuidv4()}; returns auditId
    → swallows own DynamoDB errors (logs to console.error, never throws)
  - GET /api/admin/audit in adminHandler.js:
    → operationType filter → Query GSI2; no filter → Query by PK prefix with ScanIndexForward=false
    → cursor pagination via ExclusiveStartKey; assertRole(['admin']); CORS
Constraints: writeAuditLog must never throw. Tests must verify PutItem called with correct PK, SK, operationType.
Output: files changed, test results.
```

### TASK-ADMIN-010
```text
Agent: qa-agent
Task ID: TASK-ADMIN-010
Goal: Write complete unit and integration tests for the admin module.
Inputs:
  - backend/handlers/adminHandler.js (after TASK-ADMIN-002 through TASK-ADMIN-009)
  - src/admin/auditLogger.js
  - CLAUDE.md QA checklist, aws-sdk-client-mock
Deliverables:
  - tests/unit/adminHandler.test.js:
    1. Every route returns 403 for teacher/student/parent JWT
    2. Every route returns 401 for missing JWT
    3. Deactivate without confirm → 400
    4. Role change to "superadmin" → 400 (invalid enum)
    5. repeat-cap capPercent=0 accepted; capPercent=100 accepted; capPercent=101 → 400; capPercent=-1 → 400
    6. Question flag writes status=FLAGGED; approve writes status=APPROVED
    7. Audit PutItem called for every write operation
    8. writeAuditLog failure does NOT cause 500 response
    9. CORS headers on all responses including error paths
    10. OPTIONS 200 on all routes
  - tests/unit/auditLogger.test.js: PutItem called with PK=AUDIT#..., SK=OP#..., correct operationType
  - tests/integration/admin.test.js:
    1. Admin deactivates user → Users table activeFlag=false
    2. Admin flags question → QuestionBank status=FLAGGED
    3. Admin sets repeat-cap → Config table record written
    4. Admin updates platform config → config readable by progress handler mock
    5. Grade boundary: maxQuestionsPerGrade for Grade 1 and Grade 10
    6. All DynamoDB + CloudWatch mocked
Constraints: No real AWS calls. Admin role in test JWT payload.
Output: test files, all passing, coverage evidence.
```

---

## PART 7 — Out of Scope

- Admin frontend portal UI (separate project)
- Role-based sub-admin tiers (content admin, ops admin) — Phase 2
- AI model performance heatmaps per subject/grade — Phase 2
- Multi-step question approval workflow — Phase 2
- Automated alerts for flagged question volume thresholds
- SCIM provisioning for bulk user import
- Admin-initiated password reset or account recovery
- Billing or subscription management
- PDF/CSV export of audit logs or user reports — Phase 2
- School district or campus-level admin hierarchy

---

## PART 8 — Open Questions

| OQ-NNN | Question | Blocking Tasks | Decision Needed By |
|---|---|---|---|
| OQ-ADMIN-001 | How are first admin users provisioned in each environment? Via CDK custom resource, manual DynamoDB write, or CLI seeder script? (GAP-001) | TASK-ADMIN-001, REQ-ADMIN-020 | Before TASK-ADMIN-001 starts |
| OQ-ADMIN-002 | Should deactivating a user revoke active JWTs immediately, or only prevent new logins? Immediate revocation requires a token blocklist (DynamoDB TTL or ElastiCache). | TASK-ADMIN-003 | Before TASK-ADMIN-003 starts |
| OQ-ADMIN-003 | Should repeat-cap default scope apply to all users or only users created after the policy is set? | TASK-ADMIN-006 | Before TASK-ADMIN-006 starts |
| OQ-ADMIN-004 | Should questionBankHandler.js be merged into adminHandler.js for flag/approve routes, or remain a separate Lambda? CDK currently treats them as separate. | TASK-ADMIN-005, TASK-ADMIN-007 | Before TASK-ADMIN-007 starts |
| OQ-ADMIN-005 | What CloudWatch metric namespace and dimensions are used by existing Lambda functions? Determines which metric names GET /api/admin/health queries. | TASK-ADMIN-009 | Before TASK-ADMIN-009 starts |
