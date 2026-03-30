# M07 — Admin Control Plane

## Module Summary

M07 is the platform administration interface accessible only to users with the `admin` role. It provides four functional areas: user management, AI model routing, worksheet oversight, and platform configuration.

## Admin Roles

| Role | Access Level | Responsibilities |
|---|---|---|
| Super Admin | Full platform access | All capabilities below |
| Ops Admin | Infrastructure + config | Model routing, feature flags, platform health |
| Support Admin | User management | Account issues, suspensions, role changes |
| Data/Compliance Admin | Read-only data access | Reporting, GDPR requests, audit logs |

Role assignment is controlled by Super Admin only.

## Functional Areas

### 1. User Management (FR-ADMIN-001 to FR-ADMIN-007)

| Endpoint | Description |
|---|---|
| GET /api/admin/users | List users with filter/search |
| GET /api/admin/users/{id} | Get user detail |
| PUT /api/admin/users/{id}/role | Change user role |
| POST /api/admin/users/{id}/suspend | Suspend account |
| POST /api/admin/users/{id}/unsuspend | Reinstate account |
| DELETE /api/admin/users/{id} | Soft-delete user (GDPR) |

Suspended users: Cognito account disabled + Users table `role = suspended`. All existing data retained.
Deleted users: `deletedAt` timestamp added, PII fields nulled (GDPR soft delete). Worksheet data anonymized, attempt data retained in aggregate.

### 2. AI Model Management (FR-ADMIN-008 to FR-ADMIN-014)

| Endpoint | Description |
|---|---|
| GET /api/admin/models | List configured AI models |
| POST /api/admin/models | Add model configuration |
| PUT /api/admin/models/{id}/activate | Set active model |
| POST /api/admin/models/rollback | Emergency rollback to previous model |
| GET /api/admin/models/audit | Model switch audit log |

**Hot-swap behavior:** The active model ID is read from DynamoDB Config table (`configKey = "ai/activeModel"`) on every Lambda invocation. Switching the config record takes effect immediately for all subsequent requests — no Lambda redeploy needed.

**Supported model providers (Phase 1):** Anthropic only (Claude Sonnet, Claude Haiku, Claude Opus).

**Phase 2:** Multi-provider support (OpenAI, Google Gemini) via provider abstraction layer.

**Audit trail:** Every model switch is logged to DynamoDB with `updatedBy`, `updatedAt`, `previousModel`, `newModel`, `reason`.

**Emergency rollback:** POST /api/admin/models/rollback restores the most recent previous model from the audit trail.

### 3. Worksheet Oversight (FR-ADMIN-015 to FR-ADMIN-018)

| Endpoint | Description |
|---|---|
| GET /api/admin/worksheets | List recent worksheets with metadata |
| GET /api/admin/worksheets/{id} | Get worksheet metadata and content |
| POST /api/admin/worksheets/{id}/flag | Flag for quality review |
| DELETE /api/admin/worksheets/{id} | Remove worksheet (S3 delete + metadata mark) |

Flagged worksheets: `flagged: true` in metadata.json. A flag reason and flaggedBy are added. They remain accessible unless deleted.

Deletion: S3 files are deleted, metadata.json is overwritten with `{deleted: true, deletedAt, deletedBy}`. The solve-data.json is also deleted (prevents future solve attempts on deleted worksheets).

### 4. Platform Configuration (FR-ADMIN-019 to FR-ADMIN-022)

| Config Key | Type | Description |
|---|---|---|
| `platform/maintenanceMode` | Boolean | Enables maintenance mode (503 on all routes) |
| `platform/maintenanceMessage` | String | Message shown during maintenance |
| `platform/maintenanceEndsAt` | ISO-8601 | When maintenance is expected to end |
| `platform/guestGenerateEnabled` | Boolean | Allow unauthenticated worksheet generation |
| `platform/maxQuestionsPerRequest` | Number | Override max questions (default 30) |
| `platform/rateLimitPerMinute` | Number | API Gateway throttle rate |
| `ai/activeModel` | String | Active Claude model ID |
| `ai/maxTokens` | Number | Override max_tokens for Claude calls |
| `ai/temperature` | Number | Override Claude temperature (0.0-1.0) |

All config values are read from DynamoDB Config table. Changes take effect immediately (no deploy).

### 5. Platform Reports (FR-ADMIN-019)

| Endpoint | Description |
|---|---|
| GET /api/admin/reports/usage | Daily/weekly generation counts, by subject/grade |
| GET /api/admin/reports/cost | Estimated Claude API spend (from GenerationLog) |
| GET /api/admin/reports/errors | Error rate by function, recent error messages |

## Admin Console UX (Phase 2)

The Angular admin console will have a left navigation structure:

```
├── Dashboard (platform health overview)
├── Users
│   ├── All Users
│   ├── Teachers
│   ├── Students
│   └── Suspended
├── AI Models
│   ├── Active Model
│   ├── Model Catalog
│   └── Audit Log
├── Worksheets
│   ├── Recent
│   └── Flagged
├── Config
│   ├── Platform Settings
│   └── Rate Limits
└── Reports
    ├── Usage
    ├── Cost
    └── Errors
```

Phase 1: Admin functions accessible via API only (no dedicated admin UI).

## DynamoDB Config Table Schema

```
Table: LearnfyraConfig-{env}
PK: configKey (String)
```

| Attribute | Type | Description |
|---|---|---|
| configKey | String | Dotted path, e.g., "ai/activeModel" |
| value | String / Boolean / Number | Config value |
| updatedBy | String | Admin user email |
| updatedAt | String | ISO-8601 |
| reason | String | Reason for change (optional) |
| previousValue | String | Previous value for rollback |

## RBAC Test Matrix

| Test ID | Actor | Action | Expected |
|---|---|---|---|
| RBAC-001 | Super Admin | PUT /api/admin/users/{id}/role | 200 |
| RBAC-002 | Ops Admin | PUT /api/admin/users/{id}/role | 403 |
| RBAC-003 | Support Admin | POST /api/admin/users/{id}/suspend | 200 |
| RBAC-004 | Data Admin | GET /api/admin/users | 200 (read only) |
| RBAC-005 | Data Admin | POST /api/admin/users/{id}/suspend | 403 |
| RBAC-006 | Teacher | GET /api/admin/users | 403 |
| RBAC-007 | Student | GET /api/admin/users | 403 |
| RBAC-008 | Ops Admin | PUT /api/admin/models/{id}/activate | 200 |
| RBAC-009 | Support Admin | PUT /api/admin/models/{id}/activate | 403 |
| RBAC-010 | Super Admin | DELETE /api/admin/users/{id} | 200 |
| RBAC-011 | Ops Admin | DELETE /api/admin/users/{id} | 403 |
| RBAC-012 | Ops Admin | POST /api/admin/config | 200 |
| RBAC-013 | Support Admin | POST /api/admin/config | 403 |
| RBAC-014 | Data Admin | GET /api/admin/reports/usage | 200 |
| RBAC-015 | Teacher | GET /api/admin/reports/usage | 403 |

## Design Decisions (DEC-ADMIN-001 to DEC-ADMIN-008)

**DEC-ADMIN-001:** Config stored in DynamoDB, not env vars. Rationale: hot-swap without redeploy.

**DEC-ADMIN-002:** Model hot-swap is immediate, not queued. Rationale: for emergency rollback, speed matters over consistency (active requests in flight use the previous model, new requests use the new model).

**DEC-ADMIN-003:** Soft-delete for users, not hard-delete. Rationale: data integrity for worksheets and attempts that reference the userId.

**DEC-ADMIN-004:** Admin role cannot be self-assigned. Rationale: prevents privilege escalation. Admin accounts are created out-of-band.

**DEC-ADMIN-005:** Audit trail uses DynamoDB, not CloudWatch Logs. Rationale: structured queryable format for compliance reporting.

**DEC-ADMIN-006:** Rate limits are API Gateway-level, not application-level. Rationale: API Gateway throttling is enforced before Lambda invocation, reducing cost on abuse.

**DEC-ADMIN-007:** Maintenance mode is a Config table flag checked by each Lambda handler on every request. Rationale: allows instant enable/disable without touching infrastructure.

**DEC-ADMIN-008:** Model catalog is stored in DynamoDB Config (not code). Rationale: adding a new model provider requires only a Config write + Lambda code update, not a CDK deploy.

## Acceptance Criteria

**AC-1:** Given a Super Admin calls PUT /api/admin/users/{id}/role with role="teacher", when the user next calls /api/auth/token, then their JWT contains role="teacher".

**AC-2:** Given an Ops Admin calls PUT /api/admin/models/{id}/activate, when the next POST /api/generate is called, then it uses the newly activated model.

**AC-3:** Given maintenance mode is enabled, when any authenticated request hits the API, then all endpoints return 503 with the maintenanceMessage.

**AC-4:** Given a Support Admin calls POST /api/admin/users/{id}/suspend, then the user's Cognito account is disabled and subsequent login attempts return "AccountDisabledException".

**AC-5:** Given a model switch is made, when GET /api/admin/models/audit is called, then the switch appears in the audit log with updatedBy, timestamp, previous and new model IDs.

**AC-6:** Given a teacher attempts to call any /api/admin/* endpoint, then they receive 403 Forbidden with code INSUFFICIENT_ROLE.
