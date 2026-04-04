# Module 7: Admin Console — Technical Design Document (TDD)

| Field | Value |
|---|---|
| Document ID | LFR-M07-TDD-001 |
| Module | M07: Admin Console |
| Version | 1.0 |
| Date | 2026-04-04 |
| Status | Approved — Ready for Implementation |
| Prepared By | Architect Agent |
| Sources | M07-Admin-BRD.md, MODULE_7_FRD_Admin.md, Module7_Admin_Discussion.md, admin-api.md, M07-ADMIN-MODULE-TASKS.md |

---

## 1. Architecture Overview

```
                          admin.learnfyra.com
                                 │
                          CloudFront (IP-restricted for super_admin)
                                 │
                      ┌──────────┴──────────┐
                      │                     │
                  /admin/*              /school/*
                      │                     │
                API Gateway (shared with main platform)
                      │
              Lambda Authorizer (amended: suspended check)
                      │
          ┌───────────┴───────────────────┐
          │                               │
    adminHandler.js                schoolAdminHandler.js
    (super_admin routes)           (school_admin routes)
          │                               │
    ┌─────┼────────────────┐        ┌─────┼──────────┐
    │     │     │     │    │        │     │     │    │
  Users AuditLog QB Config School  School SchoolUser Class
  Table  Table  Table Table Table  Table  Link Table Table
                │
          ComplianceLog
            Table
```

### Key Architectural Decisions

| ID | Decision | Rationale |
|---|---|---|
| AD-01 | Separate admin console CloudFront distribution | IP restriction for super_admin without affecting main platform |
| AD-02 | Shared API Gateway and Lambda | Reduce infrastructure duplication; RBAC enforced at Authorizer level |
| AD-03 | Admin handler split into two Lambdas (admin + school) | Different IAM scopes; school admin Lambda has narrower table access |
| AD-04 | Config stored in DynamoDB, not env vars | Hot-swap without redeploy |
| AD-05 | AuditLog append-only at application layer | DynamoDB IAM cannot restrict UpdateItem/DeleteItem per-table without impacting batch ops |
| AD-06 | ComplianceLog write-before-delete ordering | Hard constraint for COPPA compliance; not an eventual consistency pattern |
| AD-07 | Suspended flag cached in Authorizer for 5min | One DynamoDB read per userId per 5min; acceptable for admin volumes |

---

## 2. File Structure

```
backend/
  handlers/
    adminHandler.js          ← EXTEND (currently: policy management only)
                               ADD: user management, COPPA deletion, question bank,
                                    cost dashboard, config editor, school management,
                                    audit log query, compliance log query
    schoolAdminHandler.js    ← NEW: all /school/* routes
  middleware/
    authMiddleware.js        ← AMEND: add suspended flag check with 5-min cache

src/
  admin/
    auditLogger.js           ← NEW: writeAuditLog() utility (fire-and-forget)
    complianceLogger.js      ← NEW: writeComplianceLog(), updateComplianceLog()
    coppaDeleter.js          ← NEW: ordered COPPA deletion pipeline
    costDashboard.js         ← NEW: GenerationLog aggregation queries
    configValidator.js       ← NEW: type validation against CONFIG#SCHEMA

infra/cdk/lib/
  constructs/
    admin-tables.ts          ← NEW: School, SchoolUserLink, AuditLog, ComplianceLog
  learnfyra-stack.ts         ← AMEND: add admin tables, admin Lambda, school Lambda

tests/
  unit/
    adminHandler.test.js     ← NEW (or extend existing)
    schoolAdminHandler.test.js ← NEW
    auditLogger.test.js      ← NEW
    coppaDeleter.test.js     ← NEW
    costDashboard.test.js    ← NEW
  integration/
    admin.test.js            ← NEW
```

---

## 3. DynamoDB Table Designs

### 3.1 School Table

```
Table: LearnfyraSchool-{env}
Billing: PAY_PER_REQUEST
RemovalPolicy: RETAIN (prod), DESTROY (dev/staging)

PK: SCHOOL#{schoolId}    SK: METADATA
```

| Attribute | Type | Required | Notes |
|---|---|---|---|
| schoolId | S | Yes | UUID v4 |
| schoolName | S | Yes | |
| district | S | No | |
| address | S | No | |
| minGrade | N | Yes | 1-10 |
| maxGrade | N | Yes | 1-10, >= minGrade |
| activeSubjects | SS | Yes | At least one of: Math, ELA, Science, Social Studies, Health |
| schoolAdminIds | SS | No | Set of userId values |
| status | S | Yes | active / inactive |
| createdAt | S | Yes | ISO-8601 |
| createdBy | S | Yes | super_admin userId |

**Access Patterns:**
- Get school by ID: GetItem(PK=SCHOOL#id, SK=METADATA)
- List all schools: Scan (super_admin only; acceptable at <50 schools)

### 3.2 SchoolUserLink Table

```
Table: LearnfyraSchoolUserLink-{env}
Billing: PAY_PER_REQUEST
RemovalPolicy: RETAIN (prod), DESTROY (dev/staging)

PK: SCHOOL#{schoolId}    SK: USER#{userId}
GSI1: PK=USER#{userId}   SK=SCHOOL#{schoolId}  (all attributes)
```

| Attribute | Type | Required | Notes |
|---|---|---|---|
| schoolId | S | Yes | UUID v4 |
| userId | S | Yes | UUID v4 |
| role | S | Yes | teacher / student / school_admin |
| linkedAt | S | Yes | ISO-8601 |
| linkedBy | S | Yes | userId of admin who created link |
| status | S | Yes | active / removed |

**Access Patterns:**
- List users in school: Query(PK=SCHOOL#id) with role filter
- Find school(s) for user: Query GSI1(PK=USER#id)
- Check user-school membership: GetItem(PK=SCHOOL#id, SK=USER#id)

### 3.3 AuditLog Table

```
Table: LearnfyraAuditLog-{env}
Billing: PAY_PER_REQUEST
RemovalPolicy: RETAIN (all environments)
TTL: NONE (permanent retention)

PK: AUDIT#{auditId}    SK: METADATA
GSI1: PK=actorId       SK=timestamp   (all attributes)
GSI2: PK=targetEntityId SK=timestamp  (all attributes)
```

| Attribute | Type | Required | Notes |
|---|---|---|---|
| auditId | S | Yes | UUID v4 |
| actorId | S | Yes | Admin userId |
| actorRole | S | Yes | super_admin / school_admin |
| action | S | Yes | Enum (see Section 3.3.1) |
| targetEntityType | S | Yes | Users, QuestionBank, Config, School, SchoolUserLink, Assignment |
| targetEntityId | S | Yes | PK of target record |
| beforeState | S | No | JSON string (null for creates) |
| afterState | S | No | JSON string (null for deletes) |
| ipAddress | S | Yes | IPv4 or IPv6 |
| userAgent | S | Yes | User-Agent header |
| timestamp | S | Yes | ISO-8601 |

**3.3.1 Action Enum:**
```
USER_SUSPENDED, USER_UNSUSPENDED, FORCE_LOGOUT, ROLE_CHANGE,
COPPA_DELETION, QUESTION_FLAGGED, QUESTION_UNFLAGGED,
QUESTION_SOFT_DELETED, CONFIG_UPDATED, SCHOOL_CREATED,
SCHOOL_UPDATED, SCHOOL_ADMIN_ASSIGNED, TEACHER_INVITED,
TEACHER_REMOVED, BULK_ASSIGNMENT_CREATED, SCHOOL_CONFIG_UPDATED
```

**Constraint:** No handler may call UpdateItem or DeleteItem against this table. PutItem only.

### 3.4 ComplianceLog Table

```
Table: LearnfyraComplianceLog-{env}
Billing: PAY_PER_REQUEST
RemovalPolicy: RETAIN (all environments)
TTL: NONE (permanent retention)

PK: COMPLIANCE#{requestId}    SK: METADATA
```

| Attribute | Type | Required | Notes |
|---|---|---|---|
| requestId | S | Yes | UUID v4 |
| requestType | S | Yes | coppa-deletion (extensible) |
| requestedBy | S | Yes | super_admin userId |
| targetUserId | S | Yes | Subject of deletion |
| startedAt | S | Yes | ISO-8601 |
| completedAt | S | No | ISO-8601, set on completion |
| legalBasis | S | Yes | Free-text legal justification |
| status | S | Yes | in-progress / completed / partial-failure |
| deletedEntities | L | No | [{entityType, count}], set on completion |
| errorState | M | No | {failedStep, errorMessage, countAtFailure} |

---

## 4. API Endpoint Contracts

### 4.1 Platform Admin Endpoints (/admin/*)

All require `role=super_admin` JWT unless noted. All return CORS headers.

#### User Management

| Method | Path | Handler Function | Auth |
|---|---|---|---|
| GET | /api/admin/users | handleListUsers | super_admin |
| GET | /api/admin/users/:userId | handleGetUser | super_admin |
| PATCH | /api/admin/users/:userId/suspend | handleSuspendUser | super_admin |
| PATCH | /api/admin/users/:userId/unsuspend | handleUnsuspendUser | super_admin |
| POST | /api/admin/users/:userId/force-logout | handleForceLogout | super_admin |
| PATCH | /api/admin/users/:userId/role | handleChangeRole | super_admin |
| DELETE | /api/admin/users/:userId | handleCoppaDelete | super_admin |

#### Question Bank Moderation

| Method | Path | Handler Function | Auth |
|---|---|---|---|
| GET | /api/admin/question-bank | handleListQuestions | super_admin |
| PATCH | /api/admin/question-bank/:questionId/flag | handleFlagQuestion | super_admin |
| PATCH | /api/admin/question-bank/:questionId/unflag | handleUnflagQuestion | super_admin |
| DELETE | /api/admin/question-bank/:questionId | handleSoftDeleteQuestion | super_admin |

#### Cost Dashboard

| Method | Path | Handler Function | Auth |
|---|---|---|---|
| GET | /api/admin/cost-dashboard | handleCostDashboard | super_admin |
| GET | /api/admin/cost-dashboard/top-expensive | handleTopExpensive | super_admin |

#### Config Management

| Method | Path | Handler Function | Auth |
|---|---|---|---|
| GET | /api/admin/config | handleGetAllConfig | super_admin |
| GET | /api/admin/config/:configType | handleGetConfig | super_admin |
| PUT | /api/admin/config/:configType | handleUpdateConfig | super_admin |

#### School Management

| Method | Path | Handler Function | Auth |
|---|---|---|---|
| POST | /api/admin/schools | handleCreateSchool | super_admin |
| GET | /api/admin/schools | handleListSchools | super_admin |
| GET | /api/admin/schools/:schoolId | handleGetSchool | super_admin |
| PATCH | /api/admin/schools/:schoolId | handleUpdateSchool | super_admin |

#### Audit & Compliance

| Method | Path | Handler Function | Auth |
|---|---|---|---|
| GET | /api/admin/audit-log | handleQueryAuditLog | super_admin |
| GET | /api/admin/compliance-log | handleListComplianceLog | super_admin |

### 4.2 School Admin Endpoints (/school/*)

All require `role=school_admin` JWT. All scoped to caller's schoolId.

| Method | Path | Handler Function | Auth |
|---|---|---|---|
| GET | /school/teachers | handleListTeachers | school_admin |
| POST | /school/teachers/invite | handleInviteTeacher | school_admin |
| DELETE | /school/teachers/:userId | handleRemoveTeacher | school_admin |
| GET | /school/students | handleListStudents | school_admin |
| GET | /school/analytics | handleSchoolAnalytics | school_admin |
| POST | /school/bulk-assign | handleBulkAssign | school_admin |
| GET | /school/config | handleGetSchoolConfig | school_admin |
| PATCH | /school/config | handleUpdateSchoolConfig | school_admin |

---

## 5. Component Designs

### 5.1 Audit Logger (src/admin/auditLogger.js)

```javascript
/**
 * Fire-and-forget audit log writer.
 * NEVER throws — catches all DynamoDB errors internally.
 *
 * @param {Object} params
 * @param {string} params.actorId - Admin userId
 * @param {string} params.actorRole - super_admin | school_admin
 * @param {string} params.action - Action enum value
 * @param {string} params.targetEntityType - Entity type
 * @param {string} params.targetEntityId - Entity PK
 * @param {Object|null} params.beforeState - State before action
 * @param {Object|null} params.afterState - State after action
 * @param {string} params.ipAddress - Request IP
 * @param {string} params.userAgent - User-Agent header
 * @returns {Promise<string|null>} auditId or null on failure
 */
export async function writeAuditLog(params) { ... }
```

**Key behavior:**
- Uses PutItem (never UpdateItem/DeleteItem)
- Generates UUID v4 for auditId
- Sets timestamp to `new Date().toISOString()`
- On DynamoDB error: `console.error()` and returns null
- NEVER re-throws — caller's primary action must not fail due to audit

### 5.2 COPPA Deleter (src/admin/coppaDeleter.js)

```javascript
/**
 * Executes COPPA deletion in strict order.
 * ComplianceLog MUST be written by caller before invoking this.
 *
 * @param {string} targetUserId
 * @param {string} requestId - ComplianceLog requestId
 * @returns {Promise<{status, deletedEntities, errorState}>}
 */
export async function executeCoppaDeletion(targetUserId, requestId) { ... }
```

**Deletion order (immutable):**
1. Delete WorksheetAttempt records
2. Delete UserProgress records
3. Delete ParentChildLink records (both directions)
4. Delete StudentAssignmentStatus records
5. Set SchoolUserLink status=removed
6. Delete User record from DynamoDB
7. Delete Cognito user account (AdminDeleteUser)

**On step failure:** Record error in ComplianceLog, halt, return partial-failure status.

### 5.3 Cost Dashboard (src/admin/costDashboard.js)

```javascript
/**
 * Aggregates GenerationLog for cost dashboard.
 *
 * @param {string} window - '24h' | '7d' | '30d'
 * @returns {Promise<CostDashboardResponse>}
 */
export async function getCostDashboard(window) { ... }

/**
 * Returns top 10 most expensive generation requests.
 * @returns {Promise<GenerationLogRecord[]>}
 */
export async function getTopExpensiveRequests() { ... }
```

**Implementation:** Query-time aggregation from GenerationLog GSI. Uses Config table for model pricing constants. Unpriced models shown as `estimatedCost: null`.

### 5.4 Config Validator (src/admin/configValidator.js)

```javascript
/**
 * Validates a config value against CONFIG#SCHEMA type definition.
 *
 * @param {string} configType - Config key
 * @param {any} value - Proposed value
 * @returns {{valid: boolean, error?: string}}
 */
export async function validateConfigValue(configType, value) { ... }
```

**Supported types:** string, number, boolean, string-enum, string-array
**Special rule:** CONFIG#AI_MODEL must be in CONFIG#ALLOWED_MODELS

### 5.5 Lambda Authorizer Amendment

```javascript
// In-memory cache for suspended check
const suspendedCache = new Map(); // userId -> { suspended: boolean, cachedAt: number }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function checkSuspended(userId) {
  const cached = suspendedCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.suspended;
  }
  // DynamoDB GetItem on Users table for suspended field
  const result = await getUserSuspendedFlag(userId);
  suspendedCache.set(userId, { suspended: result, cachedAt: Date.now() });
  return result;
}
```

**Latency impact:** At most one DynamoDB read per userId per 5 minutes.

---

## 6. Security Design

### 6.1 Authentication & Authorization Flow

```
Request → API Gateway → Lambda Authorizer
  1. Validate JWT signature against JWKS
  2. Check token expiry
  3. Extract role from JWT claims
  4. Check suspended flag (DynamoDB with 5-min cache)
  5. If suspended → Deny (401)
  6. If role not sufficient for route → Deny (403)
  7. Allow → forward to handler

Handler receives decoded token with:
  { userId, email, role, schoolId (for school_admin) }
```

### 6.2 RBAC Enforcement

```javascript
// adminHandler.js - every route starts with:
requireRole(decoded, ['super_admin']);

// schoolAdminHandler.js - every route starts with:
requireRole(decoded, ['school_admin', 'super_admin']);
// PLUS: verify caller's schoolId matches route scope
```

### 6.3 Anti-Enumeration

School admin requests for non-affiliated school IDs return 403 (not 404) to prevent school ID enumeration.

### 6.4 Self-Assignment Prevention

```javascript
if (targetUserId === decoded.userId) {
  return errorResponse(403, 'Cannot change own role', 'SELF_ROLE_CHANGE');
}
```

### 6.5 PII Protection

No user email, name, or Cognito sub in CloudWatch logs. ComplianceLog stored in DynamoDB only, not echoed to CloudWatch.

---

## 7. CDK Infrastructure Changes

### 7.1 New Tables (infra/cdk/lib/constructs/admin-tables.ts)

```typescript
// School table
new dynamodb.Table(this, 'SchoolTable', {
  tableName: `learnfyra-school-${env}`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
});

// SchoolUserLink table + GSI
const schoolUserLinkTable = new dynamodb.Table(this, 'SchoolUserLinkTable', {
  tableName: `learnfyra-school-user-link-${env}`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
});
schoolUserLinkTable.addGlobalSecondaryIndex({
  indexName: 'UserSchoolIndex',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// AuditLog table + 2 GSIs
const auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
  tableName: `learnfyra-audit-log-${env}`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.RETAIN, // ALL environments
});
auditLogTable.addGlobalSecondaryIndex({
  indexName: 'ActorIndex',
  partitionKey: { name: 'actorId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
auditLogTable.addGlobalSecondaryIndex({
  indexName: 'TargetIndex',
  partitionKey: { name: 'targetEntityId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// ComplianceLog table
new dynamodb.Table(this, 'ComplianceLogTable', {
  tableName: `learnfyra-compliance-log-${env}`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.RETAIN, // ALL environments
});
```

### 7.2 Admin Lambda (extends existing)

```typescript
// Amend existing admin Lambda to include new table env vars
adminFn.addEnvironment('SCHOOL_TABLE_NAME', schoolTable.tableName);
adminFn.addEnvironment('SCHOOL_USER_LINK_TABLE_NAME', schoolUserLinkTable.tableName);
adminFn.addEnvironment('AUDIT_LOG_TABLE_NAME', auditLogTable.tableName);
adminFn.addEnvironment('COMPLIANCE_LOG_TABLE_NAME', complianceLogTable.tableName);

// Grant permissions
schoolTable.grantReadWriteData(adminFn);
schoolUserLinkTable.grantReadWriteData(adminFn);
auditLogTable.grant(adminFn, 'dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:GetItem');
// NOTE: No UpdateItem or DeleteItem on AuditLog
complianceLogTable.grantReadWriteData(adminFn);
```

### 7.3 School Admin Lambda (new)

```typescript
const schoolAdminFn = new NodejsFunction(this, 'SchoolAdminFunction', {
  functionName: `learnfyra-school-admin-${env}`,
  entry: '../backend/handlers/schoolAdminHandler.js',
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_18_X,
  architecture: lambda.Architecture.ARM_64,
  memorySize: 256,
  timeout: Duration.seconds(15),
  environment: {
    SCHOOL_TABLE_NAME: schoolTable.tableName,
    SCHOOL_USER_LINK_TABLE_NAME: schoolUserLinkTable.tableName,
    AUDIT_LOG_TABLE_NAME: auditLogTable.tableName,
    USERS_TABLE_NAME: usersTable.tableName,
    NODE_ENV: env,
  },
});
```

### 7.4 API Gateway Routes (new)

```
POST   /api/admin/users/{userId}/force-logout  → adminFn
PATCH  /api/admin/users/{userId}/suspend        → adminFn
PATCH  /api/admin/users/{userId}/unsuspend      → adminFn
PATCH  /api/admin/users/{userId}/role           → adminFn
DELETE /api/admin/users/{userId}                → adminFn
GET    /api/admin/question-bank                 → adminFn
PATCH  /api/admin/question-bank/{id}/flag       → adminFn
PATCH  /api/admin/question-bank/{id}/unflag     → adminFn
DELETE /api/admin/question-bank/{id}            → adminFn
GET    /api/admin/cost-dashboard                → adminFn
GET    /api/admin/cost-dashboard/top-expensive  → adminFn
GET    /api/admin/config                        → adminFn
GET    /api/admin/config/{configType}           → adminFn
PUT    /api/admin/config/{configType}           → adminFn
POST   /api/admin/schools                       → adminFn
GET    /api/admin/schools                       → adminFn
GET    /api/admin/schools/{schoolId}            → adminFn
PATCH  /api/admin/schools/{schoolId}            → adminFn
GET    /api/admin/audit-log                     → adminFn
GET    /api/admin/compliance-log                → adminFn
GET    /school/teachers                         → schoolAdminFn
POST   /school/teachers/invite                  → schoolAdminFn
DELETE /school/teachers/{userId}                → schoolAdminFn
GET    /school/students                         → schoolAdminFn
GET    /school/analytics                        → schoolAdminFn
POST   /school/bulk-assign                      → schoolAdminFn
GET    /school/config                           → schoolAdminFn
PATCH  /school/config                           → schoolAdminFn
```

---

## 8. Error Handling Strategy

| HTTP Code | When | Response Shape |
|---|---|---|
| 400 | Validation failure (missing fields, invalid types, minGrade > maxGrade) | `{ error: "message", code: "VALIDATION_ERROR" }` |
| 401 | Invalid/expired JWT, suspended user | `{ error: "Unauthorized", code: "AUTH_ERROR" }` |
| 403 | Insufficient role, self-role-change, cross-school access | `{ error: "Forbidden", code: "INSUFFICIENT_ROLE" }` |
| 404 | Entity not found | `{ error: "Not found", code: "NOT_FOUND" }` |
| 409 | Conflict (already suspended, already flagged, etc.) | `{ error: "Conflict", code: "CONFLICT" }` |
| 500 | Internal error, ComplianceLog write failure | `{ error: "Internal error", code: "INTERNAL_ERROR" }` |
| 502 | Cognito API failure (force-logout) | `{ error: "Upstream error", code: "UPSTREAM_ERROR" }` |
| 503 | Daily token budget exceeded (generation Lambda) | `{ error: "Budget exceeded", code: "BUDGET_EXCEEDED", retryAfter: 3600 }` |

---

## 9. Implementation Task Sequencing

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2A — Implementation Order                                  │
│                                                                  │
│ Track 1 (Foundation — sequential):                               │
│   T1.1  CDK: Add 4 new DynamoDB tables + GSIs                   │
│   T1.2  src/admin/auditLogger.js                                 │
│   T1.3  Amend authMiddleware.js: suspended flag check            │
│                                                                  │
│ Track 2 (Handlers — parallel after T1):                          │
│   T2.1  User management (list, view, suspend, unsuspend,        │
│          force-logout, role change)                               │
│   T2.2  COPPA deletion (coppaDeleter.js + handler)               │
│   T2.3  Question bank moderation (flag, unflag, soft-delete)     │
│   T2.4  Cost dashboard (costDashboard.js + handler)              │
│   T2.5  Config editor (configValidator.js + handler)             │
│   T2.6  School management (create, list, update, admin assign)   │
│   T2.7  Audit log query endpoint                                 │
│   T2.8  Compliance log query endpoint                            │
│                                                                  │
│ Track 3 (Testing — after Track 2):                               │
│   T3.1  Unit tests for all handlers                              │
│   T3.2  Unit tests for utility modules                           │
│   T3.3  Integration tests (full flow)                            │
│                                                                  │
│ Track 4 (Wire to Express for local dev):                         │
│   T4.1  Add all admin routes to server.js                        │
│   T4.2  Local smoke test: generate → admin review → flag         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Phase 2B — Implementation Order                                  │
│                                                                  │
│ T5.1  schoolAdminHandler.js scaffold                             │
│ T5.2  Teacher invite flow                                        │
│ T5.3  Teacher roster management                                  │
│ T5.4  Student roster (deduplicated)                              │
│ T5.5  School analytics dashboard                                 │
│ T5.6  Bulk worksheet assignment                                  │
│ T5.7  School configuration                                       │
│ T5.8  School admin tests                                         │
│ T5.9  Wire /school/* routes to server.js                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Testing Strategy

### Unit Tests (per handler)

| Test Category | Count | Priority |
|---|---|---|
| RBAC enforcement (403 for wrong role on every route) | ~20 | P0 |
| Suspend/unsuspend flow | 6 | P0 |
| COPPA deletion ordering | 8 | P0 |
| ComplianceLog write-before-delete | 3 | P0 |
| Question bank moderation state transitions | 8 | P0 |
| Config type validation | 10 | P0 |
| Cost dashboard aggregation | 5 | P1 |
| School CRUD | 6 | P0 |
| School admin scope isolation | 8 | P0 |
| AuditLog written for every write action | ~15 | P0 |
| AuditLog failure does not cause 500 | 3 | P0 |
| CORS headers on all responses | ~5 | P0 |
| OPTIONS preflight returns 200 | 2 | P0 |

### Integration Tests

| Test | Description |
|---|---|
| Full COPPA flow | Create user → suspend → COPPA delete → verify ComplianceLog |
| Question moderation | Create question → flag → verify excluded from generation → unflag |
| School lifecycle | Create school → assign admin → invite teacher → verify scope |
| Config hot-swap | Update config → verify next handler invocation reads new value |

### Mocking Strategy

- All DynamoDB calls: `aws-sdk-client-mock`
- Cognito AdminUserGlobalSignOut: mock Cognito client
- CloudWatch GetMetricData: mock CloudWatch client
- No real AWS calls in any test
