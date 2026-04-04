# M07 Admin Requirements

## Functional Requirements

### REQ-ADMIN-001: User List with Filter
**Priority:** P1
The system SHALL provide GET /api/admin/users with role filter, email/name search, and pagination. Response time < 2 seconds for up to 10,000 users.

### REQ-ADMIN-002: User Role Change
**Priority:** P1
Super Admin SHALL be able to change any user's role via PUT /api/admin/users/{id}/role. The change SHALL take effect on the user's next login (next JWT issuance).

### REQ-ADMIN-003: Account Suspension
**Priority:** P1
Support Admin and Super Admin SHALL be able to suspend and unsuspend user accounts. Suspended accounts SHALL be disabled in Cognito and marked in DynamoDB.

### REQ-ADMIN-004: GDPR Soft Delete
**Priority:** P2
Super Admin SHALL be able to soft-delete a user. PII fields (email, name) are nulled. The userId record is retained for data integrity (attempts, generation logs reference it).

### REQ-ADMIN-005: AI Model List
**Priority:** P1
GET /api/admin/models SHALL return the active model and all configured models with provider and status.

### REQ-ADMIN-006: Model Hot-Swap
**Priority:** P1
PUT /api/admin/models/{id}/activate SHALL switch the active model. The switch SHALL take effect within 60 seconds (Config table TTL cache window) without a Lambda redeploy.

### REQ-ADMIN-007: Model Rollback
**Priority:** P1
POST /api/admin/models/rollback SHALL restore the most recent previous active model from the audit log.

### REQ-ADMIN-008: Model Audit Log
**Priority:** P2
Every model switch SHALL be logged with: timestamp, previous model, new model, switched by (email), reason. Audit log available via GET /api/admin/models/audit.

### REQ-ADMIN-009: Worksheet Flag
**Priority:** P2
Any admin sub-role SHALL be able to flag a worksheet for quality review. Flagged worksheets remain accessible but appear in admin reports.

### REQ-ADMIN-010: Worksheet Delete
**Priority:** P2
Super Admin SHALL be able to delete a worksheet. S3 files SHALL be deleted. solve-data.json SHALL be deleted (prevents future solve attempts). metadata.json SHALL be overwritten with {deleted: true}.

### REQ-ADMIN-011: Platform Config Management
**Priority:** P1
Ops Admin and Super Admin SHALL be able to read and update config keys via GET/PUT /api/admin/config. Config changes SHALL take effect within 60 seconds.

### REQ-ADMIN-012: Maintenance Mode
**Priority:** P1
When `platform/maintenanceMode = true`, all API routes (except /api/health) SHALL return 503 with the maintenanceMessage value.

### REQ-ADMIN-013: Usage Reports
**Priority:** P2
GET /api/admin/reports/usage SHALL return generation counts by date range, subject, and grade.

### REQ-ADMIN-014: Cost Reports
**Priority:** P2
GET /api/admin/reports/cost SHALL return estimated Claude API spend from GenerationLog data.

### REQ-ADMIN-015: Error Reports
**Priority:** P2
GET /api/admin/reports/errors SHALL return error rates and recent error messages by Lambda function.

### REQ-ADMIN-016: RBAC Enforcement
**Priority:** P0
All admin endpoints SHALL enforce the role matrix. Support Admin cannot modify config or activate models. Data Admin has read-only access. Unauthorized access returns 403.

### REQ-ADMIN-017: Admin Role Not Self-Assignable
**Priority:** P0
The system SHALL prevent any user from assigning themselves the admin role. Role changes require an existing admin to perform them.

### REQ-ADMIN-018: Audit Trail Immutability
**Priority:** P1
Admin action logs (model switches, user suspensions, deletions) SHALL be append-only. Existing audit records SHALL NOT be modifiable via API.

### REQ-ADMIN-019: Config Hot-Swap Latency
**Priority:** P1
Config changes SHALL propagate to all running Lambda functions within 60 seconds (config TTL cache). This includes model changes, maintenance mode, rate limits.

### REQ-ADMIN-020: Emergency Rollback Speed
**Priority:** P0
POST /api/admin/models/rollback SHALL complete within 2 seconds and the previous model SHALL be active within 60 seconds.

### REQ-ADMIN-021: No Downtime for Config Changes
**Priority:** P1
All config changes (model switch, maintenance mode, rate limit changes) SHALL NOT require a Lambda redeploy or CDK stack update.

### REQ-ADMIN-022: Admin Endpoint Security
**Priority:** P0
All /api/admin/* routes SHALL require a valid JWT with `role = admin`. Invalid or non-admin tokens SHALL return 401 or 403 respectively.

## Design Decisions

**DEC-ADMIN-001:** Config stored in DynamoDB, not Lambda env vars — enables hot-swap without redeploy.

**DEC-ADMIN-002:** Model hot-swap is immediate (within cache TTL), not queued — speed of rollback takes priority.

**DEC-ADMIN-003:** Soft-delete for users — data integrity for worksheets and attempts that reference userId.

**DEC-ADMIN-004:** Admin role cannot be self-assigned — prevents privilege escalation.

**DEC-ADMIN-005:** Audit trail uses DynamoDB — structured, queryable, lower cost than CloudWatch Logs for compliance use.

**DEC-ADMIN-006:** Rate limits enforced at API Gateway level — blocks before Lambda invocation, reducing cost on abuse.

**DEC-ADMIN-007:** Maintenance mode is a Config table flag, not infrastructure change — instant enable/disable.

**DEC-ADMIN-008:** Model catalog in DynamoDB — adding a new model provider requires Config write + Lambda code update, not CDK deploy.

## Out of Scope (Phase 1)

- Multi-provider AI support (OpenAI, Google Gemini) — Config table ready but provider abstraction deferred to Phase 2
- Angular admin console — admin functionality via API only in Phase 1
- Automated quality scoring / auto-flagging of worksheets — Phase 2
- Bulk user import / LDAP/SCIM integration — Phase 2+
