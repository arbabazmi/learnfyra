# Super Admin + Model Routing — QA Specification
**Document Version:** 1.0  
**Created:** 2026-03-24  
**Project:** Learnfyra  
**Scope:** Super Admin RBAC, AI model assignment & routing (global + subject-level), failover/rollback, audit trails, security  
**Author:** QA Agent  
**Status:** Specification — No Code  

---

## Executive Summary

This QA specification covers testing for Learnfyra's Super Admin role and AI model routing system. The module allows authorized administrators to configure which Anthropic Claude models (or future providers) are used for worksheet generation, with granular control at global and subject levels, automatic failover, and comprehensive audit logging.

**Key Features Under Test:**
- Super Admin role-based access control (RBAC)
- Model configuration management (add/edit/delete models)
- Global model assignment (default for all subjects)
- Subject-level model override (e.g., use Opus for Math, Sonnet for ELA)
- Model routing correctness validation
- Automatic failover to backup models on API errors
- Manual rollback to previous model configurations
- Audit trail of all configuration changes
- Security: API key management, config tampering prevention, secret leakage prevention
- Multi-tenancy: different schools/districts can have different model assignments

**Testing Phases:**
1. Super Admin RBAC and authentication
2. Model configuration CRUD operations
3. Global model routing correctness
4. Subject-level model routing correctness
5. Failover and fallback behavior
6. Rollback and version control
7. Audit logging and compliance
8. Security and secret management
9. Performance and cost optimization
10. Edge cases and failure modes

---

## 1. Test Matrix

### 1.1 Super Admin RBAC — Role Assignment and Access Control

| Test ID | User Role | Action | Expected Behavior | Verification |
|---------|-----------|--------|-------------------|--------------|
| **RBAC-001** | Super Admin | Logs in with admin credentials | Admin dashboard shown with model config menu | JWT contains role='super_admin', UI shows admin nav |
| **RBAC-002** | Super Admin | Accesses /admin/models route | Model management page loads | UI displays model list, add/edit controls |
| **RBAC-003** | Teacher | Attempts to access /admin/models | Blocked, 403 Forbidden | Error page: "Administrator access required" |
| **RBAC-004** | Parent | Attempts to access /admin/* | Blocked, redirect to dashboard | Authorization middleware rejects |
| **RBAC-005** | Student | Tampers URL to /admin/models | Blocked, 403 Forbidden | Backend validates JWT role, returns error |
| **RBAC-006** | Super Admin | Promotes teacher to admin | Teacher gains admin role, can access admin panel | Database: users.role updated, JWT refreshed |
| **RBAC-007** | Super Admin | Demotes admin to teacher | Admin loses access to admin panel | Role downgrade, UI permissions updated |
| **RBAC-008** | Super Admin | Deletes own admin account | Prevented if last super admin | Error: "Cannot delete last administrator" |
| **RBAC-009** | Super Admin | Creates new super admin | New admin can login, full access granted | Database: new user with role='super_admin' |
| **RBAC-010** | Super Admin | Views audit log | Full audit trail visible | UI: paginated log of all actions |
| **RBAC-011** | Teacher-Admin | Partial admin rights (read-only) | Can view model config, cannot edit | UI: edit buttons disabled, POST returns 403 |
| **RBAC-012** | Super Admin | Session timeout (30 min idle) | Auto-logout from admin panel | Session expired, redirect to login |
| **RBAC-013** | Super Admin | Concurrent sessions (2 devices) | Both sessions valid, actions audit logged | Each action shows source IP/device |
| **RBAC-014** | Super Admin | JWT token tampered (role changed) | Backend rejects, returns 403 | JWT signature validation fails |
| **RBAC-015** | Super Admin | OAuth login as admin | Admin role recognized from OAuth profile | OAuth provider returns admin claim |

### 1.2 Model Configuration — CRUD Operations

| Test ID | Action | Input | Expected Behavior | Verification |
|---------|--------|-------|-------------------|--------------|
| **MODEL-001** | View model list | GET /api/admin/models | Returns all configured models | Response: array of models with id, name, provider, status |
| **MODEL-002** | Add new model | POST /api/admin/models {name, modelId, provider, apiKeyRef} | Model created, listed in UI | Database: models table has new row |
| **MODEL-003** | Add model with duplicate name | POST with existing name | Rejected, error message | Error: "Model name already exists" |
| **MODEL-004** | Add model with invalid modelId | POST {modelId: 'invalid-123'} | Validation error | Error: "Invalid model ID format" |
| **MODEL-005** | Edit existing model | PATCH /api/admin/models/:id {name} | Model name updated | Database: models.name updated, audit logged |
| **MODEL-006** | Edit model's API key reference | PATCH {apiKeyRef: 'new-secret-arn'} | API key reference updated, not exposed | Database: apiKeyRef updated, value never returned in API |
| **MODEL-007** | Delete unused model | DELETE /api/admin/models/:id | Model deleted | Database: models row deleted or soft-deleted |
| **MODEL-008** | Delete model in use | DELETE model currently assigned to subject | Blocked, error message | Error: "Cannot delete model in use by [Subject]" |
| **MODEL-009** | Soft delete model | DELETE with soft-delete flag | Model marked inactive, not deleted | Database: models.status='inactive' |
| **MODEL-010** | Restore soft-deleted model | PATCH with status='active' | Model reactivated | Database: models.status='active' |
| **MODEL-011** | View model details | GET /api/admin/models/:id | Full model config returned (excluding API key) | Response: name, modelId, provider, subjects assigned, status |
| **MODEL-012** | Add model with metadata | POST {name, modelId, costPerToken, maxTokens} | Model created with cost/limit metadata | Database: models.costPerToken, maxTokens stored |
| **MODEL-013** | Test model connectivity | POST /api/admin/models/:id/test | Test API call sent to model | Response: success or error from provider |
| **MODEL-014** | Add model with invalid API key | POST with wrong apiKeyRef | Model created, test fails | Model saved, connectivity test returns error |
| **MODEL-015** | Bulk import models | POST /api/admin/models/import {csv or json} | Multiple models created | Database: bulk insert, validation per row |

### 1.3 Global Model Assignment — Default Model for All Subjects

| Test ID | Configuration | Action | Expected Behavior | Verification |
|---------|---------------|--------|-------------------|--------------|
| **GLOBAL-001** | No model assigned | Generate worksheet (any subject) | Error: "No model configured" | API returns 500, user-friendly error |
| **GLOBAL-002** | Set global model | POST /api/admin/config {globalModelId: 'claude-sonnet-4'} | All subsequent worksheet requests use this model | Database: config.globalModelId set |
| **GLOBAL-003** | Global model set | Generate Math worksheet | Uses global model (claude-sonnet-4) | Anthropic API call logs show correct model |
| **GLOBAL-004** | Global model set | Generate ELA worksheet | Uses global model | Same model for all subjects |
| **GLOBAL-005** | Change global model | PATCH {globalModelId: 'claude-opus-3'} | All new worksheets use Opus | Database: config updated, audit logged |
| **GLOBAL-006** | Change global model mid-generation | Update config while worksheet generating | In-progress request uses old model, next uses new | State isolation per request |
| **GLOBAL-007** | Global model deleted | Delete model that is set as global | Error: "Cannot delete model in use as global default" | DELETE blocked |
| **GLOBAL-008** | Multiple admins change global model | Admin A sets Sonnet, Admin B sets Opus (race condition) | Last write wins, both changes audit logged | Database: transaction order preserved |
| **GLOBAL-009** | Global model inactive | Model set as global, then marked inactive | Worksheet generation fails gracefully | Error: "Configured model is inactive" |
| **GLOBAL-010** | Global model with cost limit | Model has cost cap, exceeds monthly budget | Warning shown or requests throttled | UI: budget alert, API rate limits |

### 1.4 Subject-Level Model Assignment — Override Global Default

| Test ID | Global Model | Subject Override | Worksheet Request | Expected Model Used | Verification |
|---------|--------------|------------------|-------------------|---------------------|--------------|
| **SUBJECT-001** | Sonnet-4 | Math → Opus-3 | Generate Math grade 5 | Opus-3 | API call uses claude-opus-3 |
| **SUBJECT-002** | Sonnet-4 | Math → Opus-3 | Generate ELA grade 5 | Sonnet-4 (global) | API call uses global model |
| **SUBJECT-003** | Sonnet-4 | ELA → Sonnet-3.5, Science → Opus | Generate Science grade 8 | Opus | Subject override honored |
| **SUBJECT-004** | None | Math → Haiku | Generate Math grade 2 | Haiku | Subject-level model used even without global |
| **SUBJECT-005** | Sonnet-4 | Math → Opus-3 | Admin removes Math override | Sonnet-4 (falls back to global) | Override deleted, global used |
| **SUBJECT-006** | Opus-3 | All subjects have overrides | Generate any worksheet | Subject-specific models | Global never used if all overridden |
| **SUBJECT-007** | Sonnet-4 | Math → Opus, then delete Opus model | Generate Math worksheet | Error or fallback to global | Graceful degradation |
| **SUBJECT-008** | Sonnet-4 | Math → Model-X (inactive) | Generate Math worksheet | Error: "Assigned model inactive, using global" | Fallback to global, warning logged |
| **SUBJECT-009** | Sonnet-4 | Math → Opus, ELA → Sonnet-3.5 | Admin updates Math → Haiku | Next Math worksheet uses Haiku | Subject override updated |
| **SUBJECT-010** | Sonnet-4 | Set subject model for "Social Studies" | Generate Social Studies worksheet | Subject model used | Custom subjects supported |
| **SUBJECT-011** | Sonnet-4 | Math → Opus | Worksheet specifies requestedModel='haiku' | Subject override priority > user request | Config enforced, user override rejected |
| **SUBJECT-012** | Sonnet-4 | Math → Opus | Teacher generates worksheet, sees model used | UI shows "Generated with claude-opus-3" | Transparency in UI |
| **SUBJECT-013** | Sonnet-4 | Grade-specific override (Math Grade 10 → Opus) | Generate Math Grade 10 vs Grade 5 | Grade 10 uses Opus, Grade 5 uses global | Grade-level routing supported |
| **SUBJECT-014** | Sonnet-4 | Topic-specific override (Calculus → Opus) | Generate Calculus vs Algebra | Calculus uses Opus, Algebra uses subject/global | Topic-level routing |
| **SUBJECT-015** | Sonnet-4 | Evening hours → Haiku (cost optimization) | Generate at 8pm vs 2pm | 8pm uses Haiku (off-peak pricing) | Time-based routing (advanced) |

### 1.5 Model Routing Correctness — Verification of Selection Logic

| Test ID | Scenario | Config Hierarchy | Expected Model | Verification Method |
|---------|----------|------------------|----------------|---------------------|
| **ROUTE-001** | Single global model only | Global=Sonnet-4 | Sonnet-4 for all | Intercept API calls, verify model param |
| **ROUTE-002** | Global + 1 subject override | Global=Sonnet-4, Math=Opus | Math→Opus, others→Sonnet-4 | Generate 5 subjects, verify each call |
| **ROUTE-003** | Global + all subjects overridden | Each subject has unique model | Each subject uses its assigned model | Generate all subjects, verify routing |
| **ROUTE-004** | No global, all subjects overridden | Subject models only | Each subject uses assigned model | Works without global default |
| **ROUTE-005** | Priority: Topic > Subject > Global | Math=Opus, Calculus=Sonnet-3.5, Global=Haiku | Calculus→Sonnet-3.5, Algebra→Opus | Topic-level beats subject-level |
| **ROUTE-006** | New subject added to curriculum | Global=Sonnet-4, new subject "Health" | Health uses global (no override) | New subjects inherit global |
| **ROUTE-007** | Model routing cache validity | Change Math model, generate immediately | New model used instantly | No stale cache, config refresh immediate |
| **ROUTE-008** | Multi-tenant routing | School A: Sonnet-4, School B: Opus | School A worksheet uses Sonnet, B uses Opus | Tenant isolation verified |
| **ROUTE-009** | User-specific routing (premium users) | Premium student: Opus, Free: Haiku | Premium worksheets use Opus | User tier routing (if implemented) |
| **ROUTE-010** | A/B testing routing | 50% Opus, 50% Sonnet for same subject | Worksheets split evenly | Random assignment for experimentation |
| **ROUTE-011** | Regional routing | US: Sonnet-4, EU: local model | Geographic-based model selection | Region-aware routing |
| **ROUTE-012** | Load-based routing | High load → Haiku, Low load → Opus | Model switches based on queue depth | Dynamic routing based on system state |
| **ROUTE-013** | Model version pinning | Math pinned to "sonnet-4-20250514" | Update global to newer version, Math stays pinned | Version lock per subject |
| **ROUTE-014** | Deprecated model handling | Model marked deprecated, still assigned | Warning shown, still works until sunset date | Graceful deprecation flow |
| **ROUTE-015** | Routing decision audit | Generate worksheet | Routing decision logged to audit trail | Log: "Used claude-opus-3 for Math (subject override)" |

### 1.6 Failover and Fallback — Automatic Recovery

| Test ID | Primary Model | Failure Type | Expected Behavior | Verification |
|---------|---------------|--------------|-------------------|--------------|
| **FAIL-001** | Opus-3 | 429 Rate Limit from Anthropic | Retry with exponential backoff | Logs show retry attempts with delays |
| **FAIL-002** | Opus-3 | 3 consecutive 429 errors | Failover to secondary model (Sonnet-4) | Worksheet generated, model switched logged |
| **FAIL-003** | Opus-3 | 500 Server Error from Anthropic | Immediate failover to secondary | No user-visible error, transparent switch |
| **FAIL-004** | Opus-3 | API key invalid/expired | Failover to secondary model with valid key | Error logged, secondary model succeeds |
| **FAIL-005** | Opus-3 | Network timeout (30s) | Retry once, then failover | Request completed within SLA |
| **FAIL-006** | Opus-3, secondary Sonnet-4 | Both models fail | Return user-friendly error, no worksheet | Error: "AI service temporarily unavailable" |
| **FAIL-007** | Haiku (cost-optimized) | Haiku unavailable | Failover to Sonnet (more expensive) | Cost alert triggered, worksheet generated |
| **FAIL-008** | Opus-3 | Partial response (truncated JSON) | Retry with same model, then failover | Retry logic validates response completeness |
| **FAIL-009** | Opus-3 | Failover triggered, primary recovers | Next request uses primary again (auto-recovery) | Health check re-enables primary |
| **FAIL-010** | Opus-3 | Admin manually disables model mid-generation | In-progress request completes, next request uses secondary | State consistency preserved |
| **FAIL-011** | Subject model fails | Fallback to global model | Math→Opus fails, uses global Sonnet-4 | Subject-to-global cascade |
| **FAIL-012** | All models fail | Queue request for retry or reject | User notified, retry queued for later | Graceful degradation |
| **FAIL-013** | Failover during batch generation | 10 worksheets generating, model fails on #5 | #5-10 use secondary model | Batch continues with fallback |
| **FAIL-014** | Circuit breaker activated | 50% error rate over 5 minutes | Circuit opens, all requests failover immediately | Circuit breaker pattern implemented |
| **FAIL-015** | Model quota exceeded (monthly limit) | Anthropic returns 402 Payment Required | Switch to backup provider or model | Quota alert sent to admin, failover executed |

### 1.7 Rollback and Version Control — Configuration History

| Test ID | Action | Expected Behavior | Verification |
|---------|--------|-------------------|--------------|
| **ROLL-001** | View config history | GET /api/admin/config/history | List of all config changes with timestamps | UI shows timeline of changes |
| **ROLL-002** | Change global model | PATCH global model from Opus to Sonnet | Config change versioned, old version saved | Database: config_history table has entry |
| **ROLL-003** | Rollback to previous config | POST /api/admin/config/rollback {version: N-1} | System reverts to previous model settings | Global/subject models restored |
| **ROLL-004** | Rollback mid-generation | Rollback while worksheets generating | In-progress uses old config, completed uses new | Request isolation maintained |
| **ROLL-005** | Multiple rollbacks | Roll back, then roll back again (N-2) | Each rollback step logged, multi-level undo works | History: rollback actions audited |
| **ROLL-006** | Preview rollback | GET /api/admin/config/history/:id/preview | Shows what will change on rollback | UI: diff view of current vs rollback target |
| **ROLL-007** | Rollback to 30-day-old config | Rollback to month-old version | Config restored, models may have changed/deleted | Validation: ensure models still exist |
| **ROLL-008** | Rollback deleted model config | Rollback to config using now-deleted model | Rollback blocked or warning shown | Error: "Model 'opus-2' no longer exists" |
| **ROLL-009** | Rollback with API key rotation | Old config references rotated key | Rollback updates config, uses current key ref | API keys decoupled from config versions |
| **ROLL-010** | Export config history | GET /api/admin/config/export | JSON or CSV download of all changes | Compliance export for audits |
| **ROLL-011** | Config diff between versions | Compare version N vs N-5 | Shows all changes across versions | UI: side-by-side comparison |
| **ROLL-012** | Automated rollback on error spike | 10 consecutive generation failures | Auto-rollback to last known good config | Automated remediation |
| **ROLL-013** | Manual config snapshot | POST /api/admin/config/snapshot {label} | Named snapshot created for future rollback | Checkpoint before risky changes |
| **ROLL-014** | Restore from snapshot | POST /api/admin/config/restore {snapshotId} | Config restored to snapshot state | Named restore point |
| **ROLL-015** | Config retention policy | Configs older than 1 year | Old history archived or deleted per policy | Database: config_history cleanup job |

### 1.8 Audit Logging and Compliance — Traceability

| Test ID | Event | Expected Log Entry | Retention | Verification |
|---------|-------|-------------------|-----------|--------------|
| **AUDIT-001** | Admin logs in | "User [email] logged in as super_admin" | 7 years | Database: audit_log table |
| **AUDIT-002** | Model added | "Model [name] created by [admin] at [timestamp]" | 7 years | Log entry with full details |
| **AUDIT-003** | Model deleted | "Model [name] deleted by [admin]" | 7 years | Log entry, soft-delete preferred |
| **AUDIT-004** | Global model changed | "Global model changed from [old] to [new] by [admin]" | 7 years | Log with old/new values |
| **AUDIT-005** | Subject model overridden | "Math model set to [model] by [admin]" | 7 years | Subject-specific audit |
| **AUDIT-006** | Model failover triggered | "Failover: Opus-3 failed, switched to Sonnet-4" | 7 years | Automatic event logged |
| **AUDIT-007** | Config rollback | "Config rolled back to version [N-1] by [admin]" | 7 years | Rollback action audited |
| **AUDIT-008** | API key rotated | "API key for [model] rotated by [admin]" | 7 years | Sensitive, log action not key value |
| **AUDIT-009** | Failed login attempt | "Failed admin login: [email], IP: [address]" | 7 years | Security monitoring |
| **AUDIT-010** | Unauthorized access attempt | "User [email] attempted to access /admin/* (denied)" | 7 years | RBAC violation logged |
| **AUDIT-011** | Model connectivity test failed | "Model [name] test failed: [error message]" | 7 years | Operational diagnostic |
| **AUDIT-012** | Bulk config change | "Imported 5 models from CSV by [admin]" | 7 years | Bulk operation summary |
| **AUDIT-013** | Worksheet generation (model used) | "Worksheet [id] generated with [model] for [subject]" | 90 days | Operational log (shorter retention) |
| **AUDIT-014** | Cost threshold exceeded | "Monthly cost for [model] exceeded $[threshold]" | 7 years | Financial audit |
| **AUDIT-015** | Export audit log | Admin exports audit log CSV | Export action itself logged | Meta-audit of audit access |

### 1.9 Security — Secret Management and Config Tampering Prevention

| Test ID | Attack Vector | Expected Behavior | Verification |
|---------|---------------|-------------------|--------------|
| **SEC-001** | API key in client code | API keys never exposed to frontend | View-source, network tab: no keys visible |
| **SEC-002** | API key in API response | GET /api/admin/models returns apiKeyRef, not key | Response: {"apiKeyRef": "arn:aws:secretsmanager..."} |
| **SEC-003** | SQL injection in model name | POST model with name = "'; DROP TABLE models;--" | Input sanitized, no SQL exec | Database: model name stored safely |
| **SEC-004** | XSS in model name | Model name = "<script>alert(1)</script>" | Output escaped, no script execution | UI: name displayed as text, not executed |
| **SEC-005** | JWT token tampering | Client changes role='teacher' to 'super_admin' | Backend rejects, 403 Forbidden | JWT signature validation |
| **SEC-006** | Direct database modification | Attacker modifies models table via DB access | Application detects unauthorized change | Checksum or audit mismatch alert |
| **SEC-007** | Config endpoint CSRF | POST /api/admin/config without CSRF token | Request blocked | CSRF token validation |
| **SEC-008** | Model API key leakage in logs | Application logs include API call | API key redacted in logs | Logs: "key=***...***" |
| **SEC-009** | Unauthorized config export | Non-admin attempts GET /api/admin/config/export | Blocked, 403 Forbidden | Authorization check |
| **SEC-010** | Environment variable exposure | AWS Lambda env vars visible in console | API keys stored in Secrets Manager, not env | Lambda env: reference to secret ARN only |
| **SEC-011** | Model test endpoint abuse | Spam POST /api/admin/models/:id/test | Rate limited, 429 after 10 requests/min | Rate limiter enforced |
| **SEC-012** | Replay attack on config change | Attacker replays POST /api/admin/config request | Nonce/timestamp validation, rejected | Idempotency key or timestamp check |
| **SEC-013** | Privilege escalation via config | Teacher edits model config in browser devtools | Backend validates role, rejects | Authorization re-verified server-side |
| **SEC-014** | Insecure API key storage | API keys in plain text in database | Keys encrypted at rest (AWS KMS or similar) | Database: encrypted column or Secrets Manager |
| **SEC-015** | API key in URL parameters | GET /api/generate?apiKey=sk-ant-... | API key never in URL, always header or backend-only | Server logs: no keys in query params |

### 1.10 Security — Secret Rotation and Access Control

| Test ID | Scenario | Action | Expected Behavior | Verification |
|---------|----------|--------|-------------------|--------------|
| **SEC-ROT-001** | Scheduled API key rotation | Admin rotates keys every 90 days | Old key deactivated, new key active | Secrets Manager: key version updated |
| **SEC-ROT-002** | Key rotation mid-generation | Key rotated while worksheets generating | In-progress requests use old key (grace period) | No 401/403 errors mid-request |
| **SEC-ROT-003** | Emergency key revocation | Admin discovers key leak, revokes immediately | All requests fail until new key configured | Error: "API authentication failed" |
| **SEC-ROT-004** | Key rotation notification | Admin rotates key | Email/Slack alert sent to team | Notification system triggered |
| **SEC-ROT-005** | Key rotation audit | Key rotated | Audit log entry created | Log: "API key for [model] rotated by [admin]" |
| **SEC-ROT-006** | Access to Secrets Manager | Lambda needs API key | Lambda IAM role grants read-only to specific secret | IAM policy: GetSecretValue only |
| **SEC-ROT-007** | Cross-tenant key isolation | School A cannot access School B API keys | Secrets scoped by tenant ID | Secrets Manager: path-based access control |
| **SEC-ROT-008** | Key version rollback | New key causes errors, rollback to previous | Secrets Manager: use previous version | Version management |
| **SEC-ROT-009** | Key usage monitoring | API calls monitored per key | Dashboard shows requests per API key | CloudWatch metrics |
| **SEC-ROT-010** | Invalid key detected | Model configured with invalid key | Admin alerted, model marked unhealthy | Monitoring: alert on 401 errors |

### 1.11 Performance and Cost Optimization

| Test ID | Scenario | Metric | Expected Result | Verification |
|---------|----------|--------|-----------------|--------------|
| **PERF-001** | Model selection latency | Time to resolve model config | < 50ms | Observability: trace model routing |
| **PERF-002** | Config cache hit rate | Read model config 1000 times | > 95% cache hits | Cache metrics |
| **PERF-003** | Config change propagation | Update model, measure time to take effect | < 5 seconds | Config invalidation timing |
| **PERF-004** | Cost tracking | Generate 100 worksheets, track cost per model | Cost recorded accurately | Database: cost_log table |
| **PERF-005** | Cost alert | Monthly model cost exceeds budget | Alert sent to admin | Email/Slack notification |
| **PERF-006** | Model usage analytics | 1000 worksheets over 1 month | Report shows model usage distribution | UI: pie chart of model usage |
| **PERF-007** | Batch generation performance | 50 worksheets with different models | All complete within 5 minutes | Parallel processing |
| **PERF-008** | Model routing under load | 1000 concurrent requests | All routed to correct models, no errors | Load test: routing accuracy maintained |
| **PERF-009** | Failover latency | Primary model fails | Failover to secondary in < 1 second | Observability: failover timing |
| **PERF-010** | Cost optimization via model selection | High-volume day | Auto-switch to cheaper model (Haiku) if cost threshold hit | Dynamic cost management |

### 1.12 Multi-Tenancy and Isolation

| Test ID | Scenario | Expected Behavior | Verification |
|---------|----------|-------------------|--------------|
| **TENANT-001** | School A sets global model | School B unaffected | School B uses its own config | Database: config scoped by tenantId |
| **TENANT-002** | School A admin logs in | Cannot access School B model config | Authorization boundary enforced | GET /api/admin/models filters by tenant |
| **TENANT-003** | Cross-tenant audit log | School A admin views audit log | Only sees School A actions | Audit log filtered by tenant |
| **TENANT-004** | Shared model (same API key) | 2 schools use same Claude account | Both schools can use model, costs isolated | Cost tracking per tenant |
| **TENANT-005** | Tenant-specific model | School A uses private fine-tuned model | School B cannot access | Model.tenantId enforced |
| **TENANT-006** | District-level config | District admin sets global model for all schools | All schools inherit district default | Hierarchical config: district > school |
| **TENANT-007** | School override district config | School C overrides district global model | School C uses own config | School-level override wins |
| **TENANT-008** | Tenant deletion | School B deleted from system | All School B configs archived, models preserved | Soft delete, data retained |
| **TENANT-009** | Tenant API key isolation | School A key stored in Secrets Manager | School B cannot retrieve School A key | IAM/secrets path isolation |
| **TENANT-010** | Tenant migration | School A moves to new district | Config and models migrated with tenant | Data portability |

### 1.13 Edge Cases and Failure Modes

| Test ID | Scenario | Expected Behavior | Verification |
|---------|----------|-------------------|--------------|
| **EDGE-001** | No models configured | Admin dashboard on first install | Wizard prompts to add first model | UI: onboarding flow |
| **EDGE-002** | All models inactive | Generate worksheet | Error: "No active models available" | Graceful error message |
| **EDGE-003** | Model deleted mid-generation | Model deleted while worksheet generating | In-progress request completes or fails gracefully | Request uses snapshot of config |
| **EDGE-004** | Circular failover | Model A fails → B, B fails → A | Detect loop, return error after 2 iterations | Circuit breaker prevents infinite loop |
| **EDGE-005** | Model name with special characters | Model name = "GPT-4-Turbo (£$€)" | Name stored and displayed correctly | Unicode support |
| **EDGE-006** | Very long model name (255 chars) | Model name at max length | Stored, truncated in UI if needed | Database: varchar(255) |
| **EDGE-007** | Subject not in curriculum | Request for subject "Quantum Physics" | Uses global model or error | Unrecognized subject handling |
| **EDGE-008** | Clock skew in audit logs | Server time different from DB time | Timestamps normalized to UTC | Consistent time zone |
| **EDGE-009** | Database connection lost | DB unavailable during config read | Cached config used, error logged | Read-through cache |
| **EDGE-010** | Config corruption | models table has invalid JSON in metadata | Validation error, rollback to last good config | Data integrity checks |
| **EDGE-011** | Large audit log (millions of rows) | Query audit log for 5-year period | Pagination works, query optimized | Database: indexed queries, partitioning |
| **EDGE-012** | Duplicate API keys | Two models share same API key | Allowed, both models work | Key shared across models OK |
| **EDGE-013** | Model provider shutdown | Anthropic API permanently offline | Admin alerted, all models marked unhealthy | Monitoring detects sustained outage |
| **EDGE-014** | Config file import error | Import malformed JSON config | Import fails gracefully, no partial state | Transaction rollback |
| **EDGE-015** | Unicode in subject names | Subject = "数学 (Shùxué)" | Subject routing works, no encoding errors | UTF-8 support |

---

## 2. Test Scenarios — End-to-End Flows

### 2.1 Scenario: First-Time Admin Setup

**Goal:** Validate onboarding flow for new super admin configuring model routing.

| Step | Actor | Action | Expected Result | Pass/Fail |
|------|-------|--------|-----------------|-----------|
| 1 | Super Admin | First login to admin panel | Dashboard shows "No models configured" banner | |
| 2 | Super Admin | Clicks "Add Model" | Modal form opens with fields: name, modelId, provider, API key | |
| 3 | Super Admin | Enters: "Claude Sonnet 4", "claude-sonnet-4-20250514", "Anthropic", API key | Form validates inputs | |
| 4 | Super Admin | Clicks "Test Connection" | System makes test API call, returns success | |
| 5 | Super Admin | Saves model | Model appears in model list with status "Active" | |
| 6 | Super Admin | Sets as global model | Global config updated, confirmation shown | |
| 7 | Teacher | Generates worksheet for Math Grade 5 | Worksheet created using Sonnet-4 | |
| 8 | Super Admin | Views audit log | Audit shows: model added, global config set | |

### 2.2 Scenario: Subject-Level Override

**Goal:** Validate subject-specific model routing.

| Step | Actor | Action | Expected Result | Pass/Fail |
|------|-------|--------|-----------------|-----------|
| 1 | Super Admin | Adds second model "Claude Opus 3" | Model created successfully | |
| 2 | Super Admin | Navigates to "Subject Routing" settings | UI shows list: Math, ELA, Science, etc. | |
| 3 | Super Admin | Sets Math → Opus-3, leaves others as default (Sonnet-4) | Subject override saved | |
| 4 | Teacher | Generates Math Grade 3 worksheet | Uses Opus-3 (verified in API logs) | |
| 5 | Teacher | Generates ELA Grade 3 worksheet | Uses Sonnet-4 (global default) | |
| 6 | Teacher | Generates Science Grade 3 worksheet | Uses Sonnet-4 (global default) | |
| 7 | Super Admin | Views model usage report | Shows Opus-3 used for Math only | |
| 8 | Super Admin | Removes Math override | Math returns to global model | |
| 9 | Teacher | Generates Math worksheet again | Uses Sonnet-4 | |

### 2.3 Scenario: Failover on Model Failure

**Goal:** Validate automatic failover when primary model fails.

| Step | Actor | Action | Expected Result | Pass/Fail |
|------|-------|--------|-----------------|-----------|
| 1 | Super Admin | Sets Math → Opus-3 (primary), Sonnet-4 (secondary fallback) | Config saved | |
| 2 | Teacher | Generates Math worksheet | Uses Opus-3 successfully | |
| 3 | Test Engineer | Simulates Opus-3 rate limit (429 error) | System logs error | |
| 4 | Teacher | Generates Math worksheet again | System retries Opus-3, then fails over to Sonnet-4 | |
| 5 | Teacher | Worksheet generated successfully | Uses Sonnet-4, no user-visible error | |
| 6 | Super Admin | Views health dashboard | Alert: "Opus-3 experiencing errors, failover active" | |
| 7 | Super Admin | Views audit log | Entry: "Failover triggered: Opus-3 → Sonnet-4" | |
| 8 | Test Engineer | Restores Opus-3 availability | System health check passes | |
| 9 | Teacher | Generates next Math worksheet | Uses Opus-3 again (primary restored) | |

### 2.4 Scenario: Config Rollback After Bad Change

**Goal:** Validate rollback to previous configuration.

| Step | Actor | Action | Expected Result | Pass/Fail |
|------|-------|--------|-----------------|-----------|
| 1 | Super Admin | Current config: Global=Sonnet-4, Math=Opus-3 | Worksheets generating normally | |
| 2 | Super Admin | Changes global model to Haiku (cost-cutting) | Config updated | |
| 3 | Teacher | Generates ELA worksheet with Haiku | Worksheet quality noticeably lower | |
| 4 | Super Admin | Views config history | Shows: "Global changed from Sonnet-4 to Haiku at [timestamp]" | |
| 5 | Super Admin | Clicks "Rollback to previous version" | Confirmation dialog shown | |
| 6 | Super Admin | Confirms rollback | Config restored: Global=Sonnet-4, Math=Opus-3 | |
| 7 | Teacher | Generates ELA worksheet again | Uses Sonnet-4, quality restored | |
| 8 | Super Admin | Views audit log | Entry: "Config rolled back to version [N-1] by [admin]" | |

### 2.5 Scenario: Multi-Tenant Isolation

**Goal:** Validate that School A and School B have isolated model configurations.

| Step | Actor | School | Action | Expected Result | Pass/Fail |
|------|-------|--------|--------|-----------------|-----------|
| 1 | Admin A | School A | Sets global model to Opus-3 | Config saved for School A | |
| 2 | Admin B | School B | Sets global model to Haiku | Config saved for School B | |
| 3 | Teacher A | School A | Generates Math worksheet | Uses Opus-3 | |
| 4 | Teacher B | School B | Generates Math worksheet | Uses Haiku | |
| 5 | Admin A | School A | Views audit log | Only sees School A actions | |
| 6 | Admin B | School B | Views audit log | Only sees School B actions | |
| 7 | Admin A | School A | Attempts to access School B config via API | 403 Forbidden | |
| 8 | Test Engineer | Admin | Queries database | models.tenantId correctly segregates configs | |

### 2.6 Scenario: API Key Rotation

**Goal:** Validate secure API key rotation without downtime.

| Step | Actor | Action | Expected Result | Pass/Fail |
|------|-------|--------|-----------------|-----------|
| 1 | Super Admin | Views model "Claude Sonnet 4" | Shows API key status: "Active, last rotated 60 days ago" | |
| 2 | Super Admin | Clicks "Rotate API Key" | Confirmation dialog: "Generate new key and deactivate old?" | |
| 3 | Super Admin | Enters new API key from Anthropic console | System validates key format | |
| 4 | Super Admin | Saves new key with 1-hour grace period | Old key still works for 1 hour, new key active | |
| 5 | Teacher | Generates worksheet (5 minutes later) | Uses new key successfully, no error | |
| 6 | Test Engineer | Tries to use old key (after 1 hour) | 401 Unauthorized | |
| 7 | Super Admin | Views audit log | Entry: "API key for Sonnet-4 rotated by [admin] at [timestamp]" | |
| 8 | Super Admin | Receives email notification | "API key rotation completed" | |

---

## 3. QA Checklist — Pre-Release Verification

### 3.1 Functional Testing

```
□ All RBAC tests pass (RBAC-001 to RBAC-015)
□ Model CRUD operations work correctly (MODEL-001 to MODEL-015)
□ Global model routing verified (GLOBAL-001 to GLOBAL-010)
□ Subject-level routing correct (SUBJECT-001 to SUBJECT-015)
□ Model selection logic validated (ROUTE-001 to ROUTE-015)
□ Failover behavior tested (FAIL-001 to FAIL-015)
□ Rollback functionality works (ROLL-001 to ROLL-015)
□ Audit logging comprehensive (AUDIT-001 to AUDIT-015)
□ Security tests pass (SEC-001 to SEC-ROT-010)
□ Performance benchmarks met (PERF-001 to PERF-010)
□ Multi-tenancy isolation verified (TENANT-001 to TENANT-010)
□ Edge cases handled gracefully (EDGE-001 to EDGE-015)
```

### 3.2 Integration Testing

```
□ Admin panel integrates with backend API correctly
□ Model routing integrates with worksheet generator (src/ai/generator.js)
□ Failover integrates with retry logic (src/utils/retryUtils.js)
□ Audit logging integrates with existing logging (src/utils/logger.js)
□ AWS Secrets Manager integration for API key storage
□ DynamoDB or PostgreSQL integration for config storage
□ CloudWatch integration for monitoring and alerting
□ IAM role permissions configured correctly for Lambda
□ S3 bucket policies allow config export/import
□ API Gateway routes secured with admin-only authorization
```

### 3.3 Security Testing

```
□ API keys never exposed to frontend (view-source, network tab checked)
□ JWT tampering blocked (role escalation attempts rejected)
□ CSRF protection on all admin POST/PATCH/DELETE endpoints
□ SQL injection attempts sanitized
□ XSS attempts escaped in UI
□ Rate limiting on admin endpoints (10 req/min per user)
□ Secrets Manager IAM permissions least-privilege
□ Audit log access restricted to super admins
□ API key rotation works without downtime
□ Cross-tenant data leakage prevented (verified in DB queries)
```

### 3.4 Performance Testing

```
□ Model routing latency < 50ms (p95)
□ Config cache hit rate > 95%
□ Config change propagates to all servers < 5 seconds
□ 1000 concurrent worksheet generation requests succeed
□ Failover latency < 1 second
□ Admin dashboard loads < 2 seconds with 10,000 audit log entries
□ No memory leaks over 24-hour soak test
□ Database query performance acceptable (no full table scans)
```

### 3.5 Compliance and Audit

```
□ Audit log retention policy enforced (7 years)
□ All sensitive actions logged (model changes, rollbacks, key rotations)
□ Audit log export works (CSV, JSON formats)
□ Audit log contains: timestamp, actor, action, old/new values, IP address
□ Sensitive data (API keys) never logged in plaintext
□ Compliance report can be generated for SOC 2 / GDPR audits
□ Data retention policy documented and implemented
```

### 3.6 Usability and UX

```
□ Admin dashboard intuitive for non-technical admins
□ Model add/edit forms have clear validation messages
□ Error messages user-friendly (no stack traces shown)
□ Confirmation dialogs for destructive actions (delete, rollback)
□ Loading indicators shown during async operations
□ Model status (active/inactive/unhealthy) clearly visualized
□ Audit log searchable and filterable
□ Help text and tooltips provided for complex settings
```

---

## 4. Test Data Requirements

### 4.1 Models to Configure for Testing

| Model Name | Model ID | Provider | Purpose |
|------------|----------|----------|---------|
| Claude Sonnet 4 | claude-sonnet-4-20250514 | Anthropic | Global default |
| Claude Opus 3 | claude-opus-3-20240229 | Anthropic | Subject override (Math) |
| Claude Haiku | claude-haiku-3-20240307 | Anthropic | Cost-optimized fallback |
| Claude Sonnet 3.5 | claude-3-5-sonnet-20241022 | Anthropic | Subject override (ELA) |

### 4.2 Test Subjects and Grade Levels

- Math (Grades 1, 5, 10)
- ELA (Grades 2, 6, 9)
- Science (Grades 3, 7, 10)
- Social Studies (Grades 4, 8)
- Health (Grade 6)

### 4.3 Test User Accounts

| Username | Role | Tenant | Purpose |
|----------|------|--------|---------|
| admin1@learnfyra.test | super_admin | School A | Primary admin testing |
| admin2@learnfyra.test | super_admin | School B | Multi-tenant testing |
| teacher1@learnfyra.test | teacher | School A | End-user perspective |
| teacher2@learnfyra.test | teacher | School B | Cross-tenant isolation |

### 4.4 Test API Keys

- Valid Anthropic API key (dev environment)
- Invalid/expired API key (for failover testing)
- Rate-limited API key (for 429 error simulation)

---

## 5. Automation Strategy

### 5.1 Unit Tests (Jest)

**Location:** `tests/unit/admin/`

- `modelRouter.test.js` — Model selection logic
- `failover.test.js` — Failover and retry logic
- `rbac.test.js` — Role-based access control
- `auditLogger.test.js` — Audit log creation
- `configValidator.test.js` — Config validation rules

**Coverage Target:** 90%

### 5.2 Integration Tests (Jest + Supertest)

**Location:** `tests/integration/admin/`

- `modelCrud.test.js` — Model CRUD API endpoints
- `configRouting.test.js` — Global and subject routing
- `rollback.test.js` — Config version control
- `secretsManager.test.js` — AWS Secrets Manager integration (mocked)

**Coverage Target:** 80%

### 5.3 End-to-End Tests (Playwright)

**Location:** `tests/e2e/admin/`

- `adminDashboard.spec.js` — Admin panel UI flows
- `modelSetup.spec.js` — First-time setup wizard
- `subjectOverride.spec.js` — Subject routing configuration
- `failoverScenario.spec.js` — Failover simulation
- `auditLogReview.spec.js` — Audit log access and export

**Run Frequency:** On every PR to `main` or `staging`

### 5.4 Load Tests (k6)

**Location:** `tests/load/admin/`

- `modelRoutingLoad.js` — 1000 concurrent worksheet requests with routing
- `configChangeLoad.js` — Rapid config changes under load
- `failoverLoad.js` — Failover behavior under stress

**Run Frequency:** Weekly on staging, before production deploy

### 5.5 Security Tests (OWASP ZAP, manual)

- SQL injection attempts on model name/config
- XSS attempts in model name/metadata
- JWT tampering and role escalation
- CSRF on admin endpoints
- Secret leakage in API responses and logs

**Run Frequency:** Monthly security audit

---

## 6. Test Environment Requirements

### 6.1 Local Development

- Node.js 18+
- PostgreSQL or DynamoDB Local
- AWS Secrets Manager mock (localstack or similar)
- Sample API keys (non-production)

### 6.2 CI/CD Pipeline (GitHub Actions)

- Automated unit and integration tests on every PR
- E2E tests on staging deploy
- Security scans (Snyk, OWASP ZAP) on release branch

### 6.3 Staging Environment

- Full AWS infrastructure (Lambda, DynamoDB, Secrets Manager, CloudWatch)
- Separate Anthropic API key (dev tier)
- Test tenant data (School A, School B)
- Monitoring and alerting configured

### 6.4 Production

- Same as staging, production API keys
- Enhanced monitoring (PagerDuty alerts)
- Weekly audit log review
- Monthly security scan

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| API key leakage | Low | Critical | Secrets Manager, audit logging, code review | DevOps |
| Model routing error (wrong model used) | Medium | High | Comprehensive routing tests, observability | QA/Dev |
| Failover loop causing outage | Low | High | Circuit breaker, max retry limit | Dev |
| Config rollback breaks in-progress requests | Medium | Medium | Request isolation, rollback validation | Dev |
| Multi-tenant data leak | Low | Critical | Tenant ID enforcement, security audit | Dev/Security |
| Cost spike from expensive model | Medium | Medium | Cost alerts, budget caps, usage monitoring | DevOps/Admin |
| Audit log retention failure | Low | Medium | Automated backups, compliance testing | DevOps |
| Unauthorized admin access | Low | Critical | RBAC tests, failed login monitoring | Security |
| Model deprecation without notice | Medium | Low | Model health checks, admin notifications | DevOps |
| Database corruption | Low | High | Automated backups, integrity checks, rollback | DBA |

---

## 8. Success Criteria

### 8.1 Functional

- [ ] All 150+ test cases pass
- [ ] All 6 end-to-end scenarios complete successfully
- [ ] Zero critical bugs, < 5 high-priority bugs
- [ ] Model routing accuracy 100% in test scenarios

### 8.2 Security

- [ ] No API keys exposed in logs, API responses, or frontend code
- [ ] All security tests pass (SQL injection, XSS, JWT tampering blocked)
- [ ] Secrets Manager integration working, keys never in plaintext
- [ ] Cross-tenant isolation verified (no data leakage)

### 8.3 Performance

- [ ] Model routing latency < 50ms (p95)
- [ ] Failover latency < 1 second
- [ ] Admin dashboard loads < 2 seconds
- [ ] 1000 concurrent requests handled without errors

### 8.4 Compliance

- [ ] Audit log captures all model changes, rollbacks, key rotations
- [ ] 7-year retention policy enforced
- [ ] Audit log export verified (CSV/JSON)
- [ ] Compliance report successfully generated

### 8.5 Usability

- [ ] Admin panel tested by 3 non-technical users, usability score > 8/10
- [ ] All error messages user-friendly (verified by BA)
- [ ] Help documentation complete

---

## 9. Test Execution Timeline

| Phase | Duration | Activities | Deliverable |
|-------|----------|-----------|-------------|
| **Phase 1: Unit Tests** | Week 1 | Write and run unit tests for routing, RBAC, audit | 90% unit test coverage |
| **Phase 2: Integration Tests** | Week 2 | API integration tests, Secrets Manager mock | API endpoints verified |
| **Phase 3: E2E Tests** | Week 3 | Admin panel UI tests (Playwright) | E2E scenarios pass |
| **Phase 4: Security Audit** | Week 4 | Security testing, penetration testing | Security report |
| **Phase 5: Load Testing** | Week 4 | k6 load tests, failover under load | Performance benchmarks met |
| **Phase 6: UAT** | Week 5 | User acceptance testing with admins | UAT sign-off |
| **Phase 7: Staging Deploy** | Week 6 | Deploy to staging, smoke tests | Staging verified |
| **Phase 8: Prod Deploy** | Week 6 | Deploy to production, monitor | Production rollout |

---

## 10. Dependencies and Prerequisites

### 10.1 Before QA Can Start

- [ ] BA spec complete and approved (super admin + model routing feature spec)
- [ ] DEV implements model routing logic in `src/ai/generator.js`
- [ ] DEV implements admin API endpoints:
  - GET/POST/PATCH/DELETE `/api/admin/models`
  - GET/POST `/api/admin/config`
  - GET/POST `/api/admin/config/rollback`
  - GET `/api/admin/config/history`
  - GET `/api/admin/audit`
- [ ] IaC provisions DynamoDB or PostgreSQL tables for models, config, audit
- [ ] IaC provisions AWS Secrets Manager for API key storage
- [ ] UI implements admin dashboard with model management screens
- [ ] DevOps sets up staging environment with test tenants

### 10.2 External Dependencies

- Anthropic API (dev tier for testing)
- AWS Secrets Manager (or local mock)
- DynamoDB or PostgreSQL
- CloudWatch (for monitoring and alerting)

---

## 11. Open Questions for BA/DEV

| Question | Decision Owner | Status |
|----------|----------------|--------|
| Q1: Should model routing support grade-level specificity (e.g., Math Grade 10 → Opus)? | BA | TBD |
| Q2: Should model routing support topic-level specificity (e.g., Calculus → Opus)? | BA | TBD |
| Q3: Should cost alerts be email, Slack, or in-app notifications? | BA/DevOps | TBD |
| Q4: What's the rollback grace period for in-progress worksheet generation? | DEV | TBD |
| Q5: Should config history retain all versions or only last 100? | DBA | TBD |
| Q6: Should failover support multiple fallback models (chain of 3+)? | DEV | TBD |
| Q7: Should model test endpoint be admin-only or available to teachers? | BA | TBD |
| Q8: Should audit log be queryable via API or UI-only? | BA | TBD |
| Q9: Should multi-tenancy use separate databases or row-level security? | DBA/IaC | TBD |
| Q10: Should model deprecation warnings be shown 30 or 90 days in advance? | BA | TBD |

---

## 12. Maintenance and Regression Testing

### 12.1 Regression Test Suite

**Run Frequency:** On every PR to `main`, `develop`, `staging`

- All unit tests (5 minutes)
- All integration tests (15 minutes)
- Core E2E scenarios (30 minutes)

### 12.2 Smoke Tests (Post-Deploy)

**Run Frequency:** After every staging/production deploy

1. Admin can login
2. Can view model list
3. Can add new model
4. Can set global model
5. Teacher can generate worksheet (uses correct model)
6. Audit log records action

**Duration:** < 5 minutes

### 12.3 Monthly Compliance Audit

- Review audit log completeness
- Verify API key rotation schedule
- Check cost tracking accuracy
- Confirm retention policy enforcement

---

## 13. Bug Severity Definitions

| Severity | Definition | Example | Response Time |
|----------|------------|---------|---------------|
| **Critical** | System unusable, data loss, security breach | API keys exposed, all worksheet generation fails | < 1 hour |
| **High** | Major feature broken, no workaround | Model routing fails, wrong model used | < 4 hours |
| **Medium** | Feature partially broken, workaround exists | Audit log missing some entries | < 24 hours |
| **Low** | Minor issue, cosmetic, nice-to-have | UI button alignment off | < 7 days |

---

## 14. Sign-Off

This QA specification must be reviewed and approved by:

- [ ] **BA Agent** — Requirements alignment
- [ ] **DEV Agent** — Implementability and testability
- [ ] **IaC Agent** — Infrastructure dependencies
- [ ] **DevOps Agent** — Deployment and monitoring
- [ ] **Security Team** — Security requirements
- [ ] **Product Owner** — Business acceptance

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-24 | QA Agent | Initial QA specification |

---

**End of QA Specification**
