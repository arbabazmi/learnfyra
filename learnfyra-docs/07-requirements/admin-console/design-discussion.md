# Module 7 — Admin Console Design Discussion

**Date:** 2026-04-02  
**Status:** Finalised — ready for BA agent  
**Context:** Pre-requirements design discussion covering all resolved decisions for the Admin Console module. This is a Phase 2 module; Modules 1–6 must be complete before implementation begins.

---

## How Many Admin Tiers?

The existing Phase 1 docs list "Admin console" and "school admin role" as explicitly deferred. This is a Phase 2 module split into two sub-phases:

**Phase 2A — Platform Admin (super_admin):** Learnfyra's internal ops team. Manages the platform itself: users, content quality, AI cost controls, system config, COPPA compliance, school creation. There will be 2–5 of these globally. Maximum trust level.

**Phase 2B — School Admin (school_admin):** Customer-facing. Manages teachers and students within one school. Strictly scoped to their school. Cannot see or affect users outside their school.

These are separate role values on the User record — not extensions of the teacher role. A school admin is not also a teacher. These two tiers must not be conflated — their data scope, trust level, and use cases are completely different.

---

## How Admin Roles Are Assigned

**super_admin:** The first super_admin is bootstrapped by the CDK deployment stack — a specific Cognito user email is passed as a CDK parameter and that user's DynamoDB record is written with `role=super_admin` at stack deploy time. All subsequent super_admins are assigned by an existing super_admin through the admin console. This role is **never self-service**. There is no UI flow by which a user can request or acquire it.

**school_admin:** Created exclusively by a super_admin. A super_admin creates a School record, then either creates a new user with `role=school_admin` or upgrades an existing user. School admins cannot self-register. Schools cannot self-create.

---

## Admin Console Deployment

The admin console is a **separate CloudFront distribution** at `admin.learnfyra.com` (and per-environment equivalents). It is a separate Vite app within the monorepo. It shares the same API Gateway and Lambda functions as the main platform but has its own CDK stack so it can be deployed independently and IP-restricted at the CloudFront level to the ops team's IPs for super_admin access. School admin access is not IP-restricted but requires a valid JWT with `role=school_admin`.

Reasons for separation: smaller attack surface, independent deployability, IP restriction without affecting main platform, clear security boundary.

---

## Platform Admin — Feature Decisions

### User Management

Search for any user by email, name, or Cognito sub. View profile, role, creation date, and activity summary. Suspend a user by setting `suspended: true` on the User record — this is checked by the Lambda Authorizer on every authenticated request. A suspended user's JWT remains valid for up to 5 minutes (Lambda in-memory cache TTL). For security-critical cases, a super_admin can additionally revoke the Cognito refresh token via the Cognito Admin API — this "Force immediate logout" action is a separate, confirmation-gated button. Role management: approve a user for `teacher` role, demote to `student`, assign `school_admin`.

### COPPA Deletion Flow

COPPA deletion is a hard delete of all user data in this order:
1. Write ComplianceLog record (must succeed before any deletion begins)
2. Delete WorksheetAttempt records for userId
3. Delete UserProgress records for userId
4. Delete ParentChildLink records (both directions)
5. Delete StudentAssignmentStatus records for studentId
6. Remove from Class rosters (SchoolUserLink, StudentAssignmentStatus)
7. Delete User record from DynamoDB
8. Delete Cognito user account

If any step fails, the error is appended to the ComplianceLog record (partial deletion state is recorded). There is no rollback — partial deletions remain partial and require manual resolution. The ComplianceLog is written once at start and updated at completion.

The UI requires **double-confirmation**: the super_admin must type the user's email address exactly to proceed. This is the most legally important feature on the platform.

### Question Bank Moderation

QuestionBank entries can be flagged (`status=flagged`). Flagged questions are excluded from the Module 2 Step Functions bank lookup GSI query (which filters on `status=active` only). They remain visible to super_admins for review. A super_admin can unflag (back to `status=active`) or soft-delete (`status=deleted`). Hard deletion from DynamoDB is never performed — historical Worksheet records may reference the questionId.

This is one of the most important long-term quality levers. Without it, the question bank degrades over time as poor AI outputs accumulate. The `status` field is an **additive change to the existing QuestionBank table**.

### AI Cost Dashboard

Source of truth: the existing GenerationLog table. Dashboard aggregates to show:
- Total tokens consumed: last 24h / 7 days / 30 days
- Cost estimate per model (Nova vs Claude — pricing constants in Config table, not hardcoded)
- Average tokens per worksheet by subject and grade
- Success vs failure vs retry rate
- Top 10 most token-expensive generation requests (clickable, shows full GenerationLog record)

Read-only, query-time computed from GenerationLog GSIs. Acceptable for Phase 2A volume. Phase 3 may introduce a pre-aggregated DailyCostSummary table if query latency becomes an issue.

**Daily token budget ceiling:** Stored as `CONFIG#DAILY_TOKEN_BUDGET` in the Config table. If rolling 24-hour token consumption exceeds this value, new `POST /worksheet` requests return `503 Service Temporarily Unavailable` with a `Retry-After` header. This check lives in the worksheet generation Lambda, not the Authorizer. This is an **amendment to the Module 2 generation Lambda**, not a new service.

### Config Table Editor

Super_admins can read and write Config table records via the admin console. Type validation is enforced — each Config key has a defined type (`string`, `number`, `boolean`, `string-enum`, `string-array`) stored in a `CONFIG#SCHEMA` record. The editor rejects writes that violate the type. An allowlist of valid model IDs is stored in `CONFIG#ALLOWED_MODELS` — writing `CONFIG#AI_MODEL` to a value not in this allowlist is rejected. Every Config write produces an AuditLog record.

### Audit Log

All admin actions are logged. AuditLog is append-only — no record may be updated or deleted by any user, including super_admin. Every state-changing admin action must produce an AuditLog record as an acceptance criterion on that endpoint (not just as a general NFR). Audit writes are fire-and-forget: a failed audit write logs to CloudWatch but must not roll back the primary action.

The `AuditLog` write must happen **after** the primary action succeeds, not before.

---

## Suspension Mechanism — Important Detail

The Authorizer currently validates JWT against JWKS. Adding `suspended: true` means one additional DynamoDB read per request. To limit latency impact, the result is cached in Lambda in-memory for 5 minutes — acceptable delay for moderation. The `suspended` field is an **additive change to the existing User record**.

---

## School Admin — Feature Decisions

### Teacher Management

Invite teachers to the school by generating a school-level invite code. View all teachers in the school and their active classes. Remove a teacher from the school — their account persists, their classes remain but `schoolId` is cleared from those Class records.

### School-Level Analytics

Aggregate across all classes in the school: subject-level accuracy trends, grade-level performance, teacher completion rates. Read-only, derived from the same UserProgress and StudentAssignmentStatus records as Module 4 — no new computation infrastructure.

### Bulk Assignment

A school admin can push a worksheet assignment to multiple classes simultaneously. Same configuration parameters as a teacher assignment. Implemented as parallel `POST /assignments` calls, one per class — not a single bulk-assignment DynamoDB record. This keeps the data model clean and reuses the existing Assignment table.

### School Configuration

Customise which grade levels and subjects are active for the school. Stored on the School record. Used to filter the generator UI for teachers affiliated with that school.

---

## New DynamoDB Tables

### School
- PK: `SCHOOL#<schoolId>`, SK: `METADATA`
- Attributes: schoolName, district (optional), address, gradeRange (minGrade, maxGrade), activeSubjects[], schoolAdminIds[], status (active/inactive), createdAt, createdBy
- GSI: query schools by schoolAdminId

### SchoolUserLink
- PK: `SCHOOL#<schoolId>`, SK: `USER#<userId>`
- Attributes: role (teacher / student / school_admin), linkedAt, linkedBy, status (active/removed)
- GSI: PK: `USER#<userId>` — query which school(s) a user belongs to

### AuditLog
- PK: `AUDIT#<auditId>`, SK: `METADATA`
- Attributes: actorId, actorRole, action (enum), targetEntityType, targetEntityId, beforeState (JSON), afterState (JSON), ipAddress, userAgent, timestamp
- GSI 1: actorId + timestamp
- GSI 2: targetEntityId + timestamp
- **No TTL** — audit logs retained indefinitely. This is non-negotiable.
- Append-only at the application layer.

### ComplianceLog
- PK: `COMPLIANCE#<requestId>`, SK: `METADATA`
- Attributes: requestType (coppa-deletion / data-export / account-suspension), requestedBy, targetUserId, startedAt, completedAt, deletedEntities (list of entity types and counts), errorState (nullable), legalBasis
- **No TTL** — permanent retention.
- Written before deletion begins, updated on completion or error.

### Additive Changes to Existing Tables

| Table | New Field | Values | Purpose |
|-------|-----------|--------|---------|
| Users | `suspended` | boolean, default false | Suspension flag checked by Lambda Authorizer |
| QuestionBank | `status` | active / flagged / deleted | Moderation state; Step Functions GSI filters on active only |
| Class | `schoolId` | string (nullable) | Affiliates a class with a school |

---

## RBAC Matrix — Admin Extensions

| Action | Teacher | School Admin | Super Admin |
|--------|---------|--------------|-------------|
| View any user's full profile | ❌ | own school | ✅ all |
| Suspend a user | ❌ | ❌ | ✅ |
| Force immediate logout (Cognito) | ❌ | ❌ | ✅ |
| Delete a user (COPPA) | ❌ | ❌ | ✅ |
| Assign super_admin role | ❌ | ❌ | ✅ |
| Create a school | ❌ | ❌ | ✅ |
| Assign school_admin role | ❌ | ❌ | ✅ |
| Invite teacher to school | ❌ | own school | ✅ |
| Remove teacher from school | ❌ | own school | ✅ |
| View school analytics | ❌ | own school | ✅ all |
| Bulk-assign worksheets | ❌ | own school | ✅ |
| Edit Config table | ❌ | ❌ | ✅ |
| View AI cost dashboard | ❌ | ❌ | ✅ |
| Flag / unflag QuestionBank entry | ❌ | ❌ | ✅ |
| Soft-delete QuestionBank entry | ❌ | ❌ | ✅ |
| View full AuditLog | ❌ | own actions | ✅ all |
| View ComplianceLog | ❌ | ❌ | ✅ |
| Configure school grade/subjects | ❌ | own school | ✅ |

---

## Phase Scope

### Phase 2A — In Scope (Platform Admin)
super_admin role, CDK bootstrap, IP-restricted admin console deployment, user management (search, view, suspend, force-logout, role assignment, COPPA deletion with double-confirmation), question bank moderation (flag, unflag, soft-delete), AI cost dashboard (read-only, query-time computed), Config table editor with type validation and model allowlist, school creation and school_admin assignment, AuditLog (append-only, all super_admin actions), ComplianceLog, daily token budget ceiling enforcement (amendment to Module 2 Lambda).

### Phase 2B — In Scope (School Admin)
school_admin role, school teacher invite flow, teacher roster management, school-wide student roster view, school-level analytics dashboard, bulk worksheet assignment (parallel POST /assignments), school configuration (grade range, active subjects).

### Phase 3 — Explicitly Out of Scope
District admin tier, admin user impersonation (act-as for debugging), automated AI-driven content quality scoring for QuestionBank entries, cost alert webhooks (Slack/email on budget threshold breach), multi-school teacher accounts, pre-aggregated DailyCostSummary table, admin mobile interface, CSV/PDF export of analytics or compliance data.
