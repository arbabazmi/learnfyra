# Module 7: Admin Console — Business Requirements Document (BRD)

| Field | Value |
|---|---|
| Document ID | LFR-M07-BRD-001 |
| Module | M07: Admin Console |
| Version | 1.0 |
| Date | 2026-04-04 |
| Status | Approved — Ready for Implementation |
| Prepared By | BA Agent |
| Depends On | Modules 1 (Auth), 2 (Generator), 3 (Solve), 4 (Progress), 5 (Teacher/Parent), 6 (Infra) |
| Sources | MODULE_7_FRD_Admin.md, Module7_Admin_Discussion.md, admin-api.md, admin.md, M07-ADMIN-MODULE-TASKS.md, admin-runbook.md |

---

## 1. Executive Summary

Learnfyra requires administrative governance tooling to manage users, moderate AI-generated content, control AI costs, configure the platform, manage schools, and maintain compliance with COPPA. Module 7 introduces a two-tier admin hierarchy:

- **Phase 2A — Platform Admin (super_admin):** 2-5 internal ops staff with full platform control
- **Phase 2B — School Admin (school_admin):** Customer-facing, scoped to a single school

The admin console is a separate application deployed at `admin.learnfyra.com`, IP-restricted for super_admin access, sharing the same API Gateway and Lambda backend as the main platform.

---

## 2. Business Objectives

| ID | Objective | Success Metric |
|---|---|---|
| BO-01 | Protect children's data via COPPA-compliant deletion | 100% of deletion requests produce ComplianceLog records before any data removal |
| BO-02 | Maintain content quality as question bank grows | Flagged questions excluded from generation within 60s of flagging |
| BO-03 | Control AI generation costs | Daily token budget ceiling enforced; 503 returned when exceeded |
| BO-04 | Enable school customer onboarding | Schools created and school_admins assigned without engineering intervention |
| BO-05 | Provide immutable audit trail for all admin actions | Every state-changing admin action produces an AuditLog record; no record may be updated or deleted |
| BO-06 | Enable instant platform configuration changes | Config changes take effect within 60s without Lambda redeploy |

---

## 3. Stakeholders

| Role | Stakeholder | Interest |
|---|---|---|
| Platform Operations | Learnfyra Ops Team (2-5 people) | User management, cost control, content moderation, system config |
| School Administrators | School customers | Teacher management, school analytics, bulk assignments |
| Legal/Compliance | Legal counsel | COPPA deletion compliance, audit trail integrity |
| Engineering | Dev team | API contracts, CDK infrastructure, handler implementation |
| Product | Product team | Feature scoping, school onboarding, analytics |

---

## 4. Business Requirements

### BR-01: User Management

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-01.1 | Super admin can search users by email, name, or Cognito sub | P0 | 2A |
| BR-01.2 | Super admin can view any user's full profile with activity summary | P0 | 2A |
| BR-01.3 | Super admin can suspend/unsuspend a user account | P0 | 2A |
| BR-01.4 | Suspended users are blocked within 5 minutes (Authorizer cache TTL) | P0 | 2A |
| BR-01.5 | Super admin can force immediate logout (Cognito token revocation) | P0 | 2A |
| BR-01.6 | Super admin can change any user's role (student, teacher, parent, school_admin, super_admin) | P0 | 2A |
| BR-01.7 | No user can change their own role (self-assignment prevention) | P0 | 2A |

### BR-02: COPPA Deletion

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-02.1 | COPPA deletion requires double-confirmation (type user's email exactly) | P0 | 2A |
| BR-02.2 | ComplianceLog record MUST be written before any deletion step begins | P0 | 2A |
| BR-02.3 | Deletion executes in defined order: WorksheetAttempt > UserProgress > ParentChildLink > StudentAssignmentStatus > SchoolUserLink > User record > Cognito account | P0 | 2A |
| BR-02.4 | Partial deletions are recorded (not auto-retried) — requires manual resolution | P0 | 2A |
| BR-02.5 | ComplianceLog records are permanently retained (no TTL) | P0 | 2A |

### BR-03: Question Bank Moderation

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-03.1 | QuestionBank entries gain a `status` field (active/flagged/deleted) | P0 | 2A |
| BR-03.2 | Super admin can flag, unflag, and soft-delete questions | P0 | 2A |
| BR-03.3 | Flagged/deleted questions excluded from generation (Step Functions GSI filter) | P0 | 2A |
| BR-03.4 | Soft-deleted records are never hard-deleted (historical references) | P0 | 2A |
| BR-03.5 | Super admin can list/filter questions by status, grade, subject | P0 | 2A |

### BR-04: AI Cost Dashboard

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-04.1 | Dashboard shows token usage by time window (24h/7d/30d) | P0 | 2A |
| BR-04.2 | Cost estimates use pricing from Config table (not hardcoded) | P0 | 2A |
| BR-04.3 | Top-10 most expensive generation requests displayed | P1 | 2A |
| BR-04.4 | Daily token budget ceiling stored in Config table | P0 | 2A |
| BR-04.5 | Generation Lambda returns 503 when budget exceeded (fail-open on Config read failure) | P0 | 2A |

### BR-05: Config Table Editor

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-05.1 | Super admin can read/write all Config records | P0 | 2A |
| BR-05.2 | Writes are type-validated against CONFIG#SCHEMA | P0 | 2A |
| BR-05.3 | AI model config validated against CONFIG#ALLOWED_MODELS allowlist | P0 | 2A |
| BR-05.4 | Config changes take effect within 60s (no Lambda redeploy) | P0 | 2A |

### BR-06: School Management (Super Admin)

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-06.1 | Super admin can create schools with name, grade range, active subjects | P0 | 2A |
| BR-06.2 | Super admin can assign/revoke school_admin role with school affiliation | P0 | 2A |
| BR-06.3 | Super admin can view/update all school records | P1 | 2A |

### BR-07: School Admin Operations

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-07.1 | School admin can invite teachers via invite code | P0 | 2B |
| BR-07.2 | School admin can view/remove teachers from their school | P0 | 2B |
| BR-07.3 | School admin can view all students across school classes | P0 | 2B |
| BR-07.4 | School admin can view school-level analytics (accuracy by subject/grade) | P1 | 2B |
| BR-07.5 | School admin can bulk-assign worksheets to multiple classes | P1 | 2B |
| BR-07.6 | School admin can configure school grade range and active subjects | P1 | 2B |
| BR-07.7 | School admin CANNOT see/affect users outside their school | P0 | 2B |

### BR-08: Audit & Compliance

| Req ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-08.1 | Every state-changing admin action produces an AuditLog record | P0 | 2A |
| BR-08.2 | AuditLog is append-only (no update/delete at application layer) | P0 | 2A |
| BR-08.3 | AuditLog retained indefinitely (no TTL) | P0 | 2A |
| BR-08.4 | Super admin can query audit log by actor or target entity | P1 | 2A |
| BR-08.5 | School admin can only see their own audit entries | P0 | 2B |
| BR-08.6 | Audit write failure does NOT roll back the primary action | P0 | 2A |

---

## 5. RBAC Matrix

| Action | Student | Teacher | Parent | School Admin | Super Admin |
|---|---|---|---|---|---|
| Access /admin/* endpoints | - | - | - | - | Yes |
| Access /school/* endpoints | - | - | - | Own school | Yes |
| Search/view any user | - | - | - | Own school | All |
| Suspend/unsuspend user | - | - | - | - | Yes |
| Force logout (Cognito) | - | - | - | - | Yes |
| COPPA deletion | - | - | - | - | Yes |
| Change user role | - | - | - | - | Yes |
| Create school | - | - | - | - | Yes |
| Assign school_admin | - | - | - | - | Yes |
| Flag/unflag/delete questions | - | - | - | - | Yes |
| View AI cost dashboard | - | - | - | - | Yes |
| Edit Config table | - | - | - | - | Yes |
| View full AuditLog | - | - | - | Own actions | All |
| View ComplianceLog | - | - | - | - | Yes |
| Invite teacher to school | - | - | - | Own school | Yes |
| Remove teacher from school | - | - | - | Own school | Yes |
| View school analytics | - | - | - | Own school | All |
| Bulk-assign worksheets | - | - | - | Own school | Yes |
| Configure school settings | - | - | - | Own school | Yes |

---

## 6. Data Requirements

### New DynamoDB Tables

| Table | PK | SK | TTL | Notes |
|---|---|---|---|---|
| School | SCHOOL#schoolId | METADATA | None | School entity with grade range, subjects, status |
| SchoolUserLink | SCHOOL#schoolId | USER#userId | None | Affiliates users to schools; GSI on USER#userId |
| AuditLog | AUDIT#auditId | METADATA | None (permanent) | Append-only; GSI1: actorId+timestamp; GSI2: targetEntityId+timestamp |
| ComplianceLog | COMPLIANCE#requestId | METADATA | None (permanent) | COPPA deletion records; written before deletion begins |

### Amendments to Existing Tables

| Table | New Field | Type | Default | Purpose |
|---|---|---|---|---|
| Users | suspended | Boolean | false | Checked by Lambda Authorizer on every request |
| QuestionBank | status | String | active | Moderation state: active/flagged/deleted |
| Class | schoolId | String | null | School affiliation |

---

## 7. Out of Scope (Phase 3 Deferred)

| Item | Reason |
|---|---|
| District admin tier | No district customers at Phase 2; adds third role layer |
| Admin user impersonation | High security risk; requires legal review |
| Automated AI content scoring | Extra model call per question; manual moderation sufficient for Phase 2 volume |
| Cost alert webhooks (Slack/email) | Outbound webhook infra not in stack yet |
| Multi-school teacher accounts | Data model supports it; UI/permission logic deferred |
| Pre-aggregated DailyCostSummary | Query-time computation acceptable at Phase 2 volume |
| Admin mobile interface | Desktop-only; admin staff use workstations |
| CSV/PDF export of analytics | Requires presigned URL generation; deferred until demand confirmed |

---

## 8. Assumptions & Constraints

| ID | Type | Description |
|---|---|---|
| A-01 | Assumption | Modules 1-6 are fully operational before M07 implementation begins |
| A-02 | Assumption | Maximum 2-5 super_admin users globally |
| A-03 | Assumption | Phase 2A volume: <10,000 users, <50 schools |
| C-01 | Constraint | Admin console is a separate CloudFront distribution, IP-restricted for super_admin |
| C-02 | Constraint | First super_admin bootstrapped via CDK parameter (never self-service) |
| C-03 | Constraint | AuditLog is append-only — no UpdateItem/DeleteItem in any code path |
| C-04 | Constraint | ComplianceLog write MUST precede any COPPA deletion step |
| C-05 | Constraint | No PII in CloudWatch logs at any log level |
| C-06 | Constraint | Legal counsel must review COPPA deletion before Phase 2A production release |

---

## 9. Acceptance Criteria Summary

| AC ID | Criteria |
|---|---|
| AC-01 | Non-admin JWT on any /admin/* endpoint returns 403 |
| AC-02 | Suspended user is blocked within 5 minutes |
| AC-03 | COPPA deletion creates ComplianceLog before any data removal |
| AC-04 | Flagged question excluded from next generation request |
| AC-05 | Config change takes effect within 60s without redeploy |
| AC-06 | Daily token budget exceeded returns 503 with Retry-After header |
| AC-07 | School admin cannot access data outside their school |
| AC-08 | Every admin write action produces an AuditLog record |
| AC-09 | AuditLog GSI query returns within 500ms for 10,000 records |
| AC-10 | Cost dashboard 30-day query returns within 2 seconds |

---

## 10. Implementation Phasing

```
Phase 2A (Platform Admin) ──────────────────────────
  1. CDK tables (School, SchoolUserLink, AuditLog, ComplianceLog)
  2. AuditLogger utility (src/admin/auditLogger.js)
  3. Lambda Authorizer amendment (suspended flag check)
  4. User management endpoints (search, view, suspend, unsuspend, force-logout, role change)
  5. COPPA deletion endpoint with ComplianceLog
  6. Question bank moderation (flag, unflag, soft-delete)
  7. Cost dashboard (token usage, top-expensive)
  8. Config table editor (type-validated writes)
  9. School creation and school_admin assignment
  10. Audit log query endpoint

Phase 2B (School Admin) ─────────────────────────────
  11. School admin role enforcement (/school/* scope)
  12. Teacher invite flow (invite code generation)
  13. Teacher roster management
  14. Student roster (deduplicated cross-class view)
  15. School analytics dashboard
  16. Bulk worksheet assignment
  17. School configuration (grade range, subjects)
```
