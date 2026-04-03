# Module 7 — BA Agent Prompt
## FRD + Task Tracker + Sprint Plan: Admin Console

**Date:** 2026-04-02  
**Status:** Ready to hand off to Claude Code BA Agent  
**Output files expected:** MODULE_7_FRD_Admin.md, MODULE_7_TaskTracker.md, MODULE_7_SprintPlan.md

---

## Prompt (paste this in full to the BA Agent)

```
You are a senior Business Analyst agent for the Learnfyra EdTech platform.
Your task is to produce three complete, production-ready documents:
  1. Functional Requirements Document (FRD) — Module 7: Admin Console
  2. Task Tracker — all actionable development tasks derived from the FRD
  3. Sprint Plan — tasks organised into time-boxed sprints with sequencing rationale

Read all context below carefully before writing anything. Do not start writing
until you have processed the full brief.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLATFORM CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Product: Learnfyra — a free EdTech platform for Grades 1–10 aligned to USA
curriculum standards.

Core philosophy: Accessibility-first. No learning flow is gated behind
registration or login. Cost-consciousness is a hard constraint — Learnfyra
is a free service and AWS Bedrock generation costs must be actively managed.

Tech stack:
  Frontend   : React + TypeScript + Vite
  Backend    : AWS Lambda, DynamoDB, API Gateway with Lambda Authorizer
  Auth       : AWS Cognito — Google OAuth + email/password
  Infra      : AWS CDK, serverless, four environments: local / dev / qa / prod
  Local dev  : DynamoDB local, Mailhog for email catching

Existing stable modules (do not redesign, treat as complete):
  Module 1 — Auth & Identity       : Google OAuth, JWT, Lambda Authorizer, Cognito,
                                     roles stored on User record (student/teacher/parent)
  Module 2 — Worksheet Generator   : Bedrock, Step Functions, Question Bank (DynamoDB),
                                     async generation, GenerationLog table
  Module 3 — Online Solve          : MCQ/fill-blank/short-answer, practice/test modes,
                                     attempt lifecycle, WorksheetAttempt table
  Module 4 — Progress Tracking     : UserProgress table, topic-wise accuracy,
                                     weak area detection
  Module 5 — Teacher & Parent      : Class, Assignment, StudentAssignmentStatus,
                                     ParentChildLink, ParentInviteCode tables,
                                     class management, review queue, parent linking
  Module 6 — Infrastructure & CDK  : multi-env CDK stacks, CI/CD pipeline,
                                     COPPA compliance, encryption at rest, WAF

Existing DynamoDB tables:
  Users               PK: USER#<cognitoSub>,     SK: PROFILE
  QuestionBank        PK: QUESTION#<id>,          SK: METADATA
  Worksheet           PK: WORKSHEET#<id>,          SK: METADATA
  WorksheetAttempt    PK: ATTEMPT#<id>,            SK: METADATA
  UserProgress        PK: USER#<id>,               SK: PROGRESS#<topic>
  GenerationLog       PK: GENERATION#<id>,         SK: METADATA
  Config              PK: CONFIG#<configType>,     SK: METADATA
  Class               PK: CLASS#<classId>,         SK: METADATA
  Assignment          PK: ASSIGNMENT#<id>,         SK: METADATA
  StudentAssignmentStatus PK: ASSIGNMENT#<id>,     SK: STUDENT#<studentId>
  ParentChildLink     PK: USER#<parentId>,         SK: CHILD#<childId>
  ParentInviteCode    PK: INVITE#<code>,           SK: METADATA

User roles currently defined:
  student, teacher, parent (Modules 1–5)
  school_admin, super_admin   ← introduced in this module

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN DECISIONS — ALREADY RESOLVED (treat these as final)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADMIN TIER STRUCTURE

There are exactly two admin tiers. Do not invent a third.

  super_admin   : Learnfyra's internal ops team. Manages the platform itself.
                  Maximum trust. There will be 2–5 of these globally.
  school_admin  : Customer-facing. Manages teachers and students within one
                  school. Strictly scoped to their school. Cannot see or
                  affect users outside their school.

These are separate role values on the User record — not extensions of the
teacher role. A school admin is not also a teacher. A teacher is not also
a school admin.

HOW ADMIN ROLES ARE ASSIGNED — RESOLVED

  super_admin   : The first super_admin is bootstrapped by the CDK deployment
                  stack — a specific Cognito user email is passed as a CDK
                  parameter and that user's DynamoDB record is written with
                  role=super_admin at stack deploy time. All subsequent
                  super_admins are assigned by an existing super_admin through
                  the admin console. This role is NEVER self-service. There
                  is no UI flow by which a user can request or acquire it.

  school_admin  : Created exclusively by a super_admin. A super_admin creates
                  a School record, then either creates a new user with
                  role=school_admin or upgrades an existing user. School admins
                  cannot self-register. Schools cannot self-create.

ADMIN CONSOLE DEPLOYMENT — RESOLVED

  The admin console is a separate CloudFront distribution:
    admin.learnfyra.com        (prod)
    admin.dev.learnfyra.com    (dev)
    admin.qa.learnfyra.com     (qa)

  It is a separate Vite app within the monorepo. It shares the same API
  Gateway and Lambda functions as the main platform but has its own CDK
  stack so it can be deployed independently and IP-restricted at the
  CloudFront level to the ops team's IPs (for super_admin access).
  School admin access is not IP-restricted but requires valid JWT with
  role=school_admin.

SUSPENSION MECHANISM — RESOLVED

  User suspension is enforced by adding suspended: true to the User record
  in DynamoDB. The Lambda Authorizer checks this flag on every authenticated
  request. To limit latency impact, the suspension check result is cached
  in Lambda in-memory for 5 minutes (acceptable delay for a moderation
  action). A suspended user's current JWT tokens remain valid for up to
  5 minutes after suspension. For security-critical suspensions (abuse,
  fraud), a super_admin can additionally revoke the user's Cognito refresh
  token via the Cognito API — this is a separate, confirmation-gated action
  in the UI labelled "Force immediate logout".

COPPA DELETION FLOW — RESOLVED

  A COPPA deletion request results in hard deletion of all user data:
    - User record (DynamoDB)
    - All WorksheetAttempt records for that userId
    - All UserProgress records for that userId
    - All ParentChildLink records where this user is parent or child
    - All StudentAssignmentStatus records for that studentId
    - Removal from any Class rosters
    - Cognito user account deletion
  A ComplianceLog record is written BEFORE deletion begins and is
  retained permanently (no TTL). The ComplianceLog records: requestId,
  requestType=coppa-deletion, requestedBy (super_admin userId),
  targetUserId, timestamp, list of entity types deleted and counts.
  The deletion is executed as an ordered Lambda function — ComplianceLog
  write must succeed before any deletion begins. If any deletion step
  fails, the error is logged to the ComplianceLog record (partial deletion
  state is recorded) and the super_admin is notified. There is no rollback —
  partial deletions remain partial and require manual resolution.
  This flow requires explicit double-confirmation in the UI:
  the super_admin must type the user's email address to confirm.

QUESTION BANK MODERATION — RESOLVED

  Platform admins can flag QuestionBank entries. Flagging sets
  status=flagged on the Question record. Flagged questions are excluded
  from the bank lookup step in the Module 2 Step Functions pipeline
  (the GSI query for bank lookup must filter on status=active only).
  Flagged questions are not deleted — they remain visible to super_admins
  for review. A super_admin can unflag a question (status back to active)
  or hard-delete it. Hard-deleted questions are soft-deleted only
  (status=deleted) — permanent removal from DynamoDB is not performed
  because the question may be referenced in historical Worksheet records.

AI COST DASHBOARD — RESOLVED

  Source of truth: GenerationLog table (already exists).
  The cost dashboard aggregates GenerationLog records to show:
    - Total tokens consumed: last 24h / 7 days / 30 days
    - Cost estimate per model: Nova pricing vs Claude pricing
      (model pricing constants stored in Config table, not hardcoded)
    - Average tokens per worksheet by subject and grade
    - Generation success rate vs failure vs retry rate
    - Top 10 most token-expensive individual generation requests
      (clickable — shows the full GenerationLog record)
  The dashboard is read-only. It is computed at query time from
  GenerationLog GSIs — no separate aggregation table in Phase 2A.
  This is acceptable for Phase 2A volume; Phase 3 may introduce a
  pre-aggregated DailyCostSummary table if query latency becomes an issue.

  Daily token budget ceiling:
    Stored in Config table as CONFIG#DAILY_TOKEN_BUDGET.
    If the rolling 24-hour token consumption exceeds this value,
    new POST /worksheet requests return 503 with Retry-After header.
    The Lambda Authorizer does NOT check this — it is checked in the
    worksheet generation Lambda before starting the Step Functions execution.
    Super_admins can update this value via the Config editor.

CONFIG TABLE EDITOR — RESOLVED

  Super_admins can read and write Config table records via the admin console.
  The editor enforces type validation — each Config key has a defined type
  (string, number, boolean, string-enum, string-array) stored in a
  CONFIG#SCHEMA record. The editor rejects writes that violate the type.
  An allowlist of valid model IDs is stored in CONFIG#ALLOWED_MODELS —
  writing CONFIG#AI_MODEL to a value not in this allowlist is rejected.
  Every Config write is recorded in AuditLog.

AUDIT LOG — RESOLVED

  Table: AuditLog
    PK: AUDIT#<auditId>   SK: METADATA
    Attributes: actorId, actorRole, action (enum), targetEntityType,
                targetEntityId, beforeState (JSON string, nullable),
                afterState (JSON string, nullable), ipAddress, userAgent,
                timestamp
    GSI 1: actorId + timestamp  (query all actions by a specific admin)
    GSI 2: targetEntityId + timestamp  (query all actions on a specific entity)
  This table is append-only. No record may be updated or deleted by any
  user, including super_admin. There is no TTL. Retention is indefinite
  unless a super_admin explicitly configures a retention policy in Config.
  The Lambda that writes audit records must be called AFTER the primary
  action succeeds — a failed audit write should log to CloudWatch but
  must not roll back the primary action. Audit writes are fire-and-forget
  from the perspective of the primary action.

SCHOOL MANAGEMENT — RESOLVED

  School record:
    PK: SCHOOL#<schoolId>   SK: METADATA
    Attributes: schoolName, district (optional), address, gradeRange
                (minGrade 1–10, maxGrade 1–10), activeSubjects[],
                schoolAdminIds[], status (active/inactive), createdAt,
                createdBy (super_admin userId)

  Teacher and student affiliation to a school is stored in two separate
  association tables (not on the User record, because a teacher could
  theoretically move schools):

  SchoolUserLink
    PK: SCHOOL#<schoolId>   SK: USER#<userId>
    Attributes: role (teacher / student / school_admin), linkedAt,
                linkedBy (super_admin or school_admin userId), status (active/removed)
    GSI: PK: USER#<userId>  (query which school(s) a user belongs to)

  Teachers join a school via invite code generated by a school_admin or
  super_admin. Students are associated with a school automatically when
  they join a class that belongs to a school (derived from the Class record's
  schoolId field, which is set when a teacher creates a class and the teacher
  is affiliated with a school).

SCHOOL ADMIN CAPABILITIES — RESOLVED

  A school_admin can:
    - View all teachers in their school and their active classes
    - Invite new teachers to the school (generates school teacher invite code)
    - Remove a teacher from the school (class records persist, schoolId
      is cleared from those classes)
    - View all students across all classes in their school
    - View school-level aggregate analytics (subject accuracy, grade-level
      trends, teacher completion rates)
    - Bulk-assign a worksheet to multiple classes in their school
      (implemented as parallel POST /assignments, one per class)
    - Configure school-level settings (grade range, active subjects)

  A school_admin cannot:
    - Access the platform admin console or super_admin features
    - See users outside their school
    - Delete user accounts
    - Modify Config table records
    - View the platform-wide AuditLog (they can view their own actions only)
    - View the AI cost dashboard

RBAC MATRIX — COMPLETE AND FINAL FOR THIS MODULE

  Action                          | Teacher | School Admin  | Super Admin
  --------------------------------|---------|---------------|-------------
  View any user's full profile    | ❌      | own school    | ✅ all
  Suspend a user                  | ❌      | ❌            | ✅
  Force immediate logout (Cognito)| ❌      | ❌            | ✅
  Delete a user (COPPA)           | ❌      | ❌            | ✅
  Assign super_admin role         | ❌      | ❌            | ✅
  Create a school                 | ❌      | ❌            | ✅
  Assign school_admin role        | ❌      | ❌            | ✅
  Invite teacher to school        | ❌      | own school    | ✅
  Remove teacher from school      | ❌      | own school    | ✅
  View school analytics           | ❌      | own school    | ✅ all
  Bulk-assign worksheets          | ❌      | own school    | ✅
  Edit Config table               | ❌      | ❌            | ✅
  View AI cost dashboard          | ❌      | ❌            | ✅
  Flag / unflag QuestionBank item | ❌      | ❌            | ✅
  Hard-delete QuestionBank item   | ❌      | ❌            | ✅
  View full AuditLog              | ❌      | own actions   | ✅ all
  View ComplianceLog              | ❌      | ❌            | ✅
  Configure school grade/subjects | ❌      | own school    | ✅

PHASE SCOPE — THIS DOCUMENT COVERS

  Phase 2A (Platform Admin — this document):
    super_admin role, CDK bootstrap, IP-restricted admin console deployment,
    user management (search, view, suspend, force-logout, role assignment,
    COPPA deletion), question bank moderation (flag, unflag, soft-delete),
    AI cost dashboard (read-only, query-time computed), Config table editor
    with type validation, school creation and school_admin assignment,
    audit log (append-only, all super_admin actions), compliance log,
    daily token budget ceiling enforcement on POST /worksheet.

  Phase 2B (School Admin — this document):
    school_admin role, school teacher invite flow, teacher roster management,
    school-wide student roster view, school-level analytics dashboard,
    bulk worksheet assignment, school configuration (grade range, subjects).

  Phase 3 (explicitly out-of-scope — document with reason):
    District admin tier, admin user impersonation (act-as for debugging),
    automated AI-driven content quality scoring for QuestionBank entries,
    cost alert webhooks (Slack/email on budget threshold breach),
    multi-school teacher accounts, pre-aggregated cost summary table,
    admin mobile interface, CSV/PDF export of analytics or compliance data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Produce all three documents in a single output. Use clear Markdown headings
to separate them. Follow the structure below precisely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT 1 — FUNCTIONAL REQUIREMENTS DOCUMENT
Filename: MODULE_7_FRD_Admin.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Document Header
   Module name (Module 7: Admin Console), version (1.0), date, status (Draft),
   prepared by (BA Agent), depends on (all Modules 1–6), change log table.

2. Executive Summary
   Two paragraphs. What Module 7 delivers, why it is a Phase 2 module,
   the two-tier admin structure and the reasoning behind it, and the
   relationship between this module and cost control, content quality,
   and COPPA compliance.

3. Scope
   3.1 In-scope Phase 2A (Platform Admin)
   3.2 In-scope Phase 2B (School Admin)
   3.3 Out-of-scope Phase 3 with reason for each item
   3.4 Architectural constraints: the admin console must share the same
       API Gateway and Lambda Authorizer as the main platform but be
       deployable independently. The AuditLog must be append-only at the
       application layer. The ComplianceLog must be permanently retained.

4. User Roles & Personas
   One paragraph per admin role (super_admin, school_admin) covering
   who they are, how they are assigned, their trust level, and the
   primary operational concerns they address.

5. Functional Requirements — Platform Admin (super_admin)
   Group by:
   5.1 Role Bootstrap & Assignment
   5.2 User Management (search, view, suspend, force-logout, role changes)
   5.3 COPPA Deletion Flow (step-by-step deletion order, ComplianceLog,
       double-confirmation UI requirement)
   5.4 Question Bank Moderation (flag, unflag, soft-delete, filter impact
       on Module 2 Step Functions pipeline)
   5.5 AI Cost Dashboard (GenerationLog aggregation, cost estimate,
       daily token budget ceiling, 503 enforcement)
   5.6 Config Table Editor (type validation, model allowlist, audit logging
       of every write)
   5.7 School & School Admin Management (create school, assign school_admin,
       SchoolUserLink lifecycle)
   5.8 Audit Log (append-only, GSIs, no deletion policy)
   5.9 Compliance Log (write-before-delete ordering, permanent retention)

   FR format: FR-A-XXX | Description | Priority (Must/Should/Could) | Acceptance Criteria

6. Functional Requirements — School Admin (school_admin)
   Group by:
   6.1 Role Assignment & School Affiliation
   6.2 Teacher Management (invite, view, remove)
   6.3 Student Roster (school-wide read-only view)
   6.4 School Analytics Dashboard
   6.5 Bulk Worksheet Assignment
   6.6 School Configuration

   FR format: FR-SA-XXX | Description | Priority | Acceptance Criteria

7. Non-Functional Requirements
   Security: admin console IP restriction for super_admin, AuditLog
     append-only enforcement at application layer, double-confirmation
     gate on COPPA deletion and Cognito force-logout.
   Performance: AuditLog GSI queries must return within 500ms for
     up to 10,000 audit records per actor. Cost dashboard queries
     must return within 2 seconds for 30-day window.
   Data Integrity: ComplianceLog write must complete before any
     deletion step begins. Partial deletion state must be recorded.
   Compliance: COPPA deletion must remove all specified entity types.
     ComplianceLog retention is permanent. No PII in CloudWatch logs.
   Isolation: school_admin cannot query any endpoint outside their
     schoolId scope. Enumeration of school IDs returns 403 for
     unaffiliated schools.
   Auditability: every state-changing action by any admin role must
     produce an AuditLog record.

8. Data Model Specification
   Full DynamoDB definitions for:
   School, SchoolUserLink, AuditLog, ComplianceLog
   (ParentInviteCode and others already defined in Module 5 FRD —
   do not redefine them, reference Module 5 FRD only.)
   For each table: PK, SK, all attributes with types, all GSIs with
   PK/SK and projection, TTL policy (or explicit statement that TTL
   is not set and why), access patterns served by each GSI.
   Additionally: specify the new status field added to QuestionBank
   (active / flagged / deleted) and the new suspended field added to
   Users, and the new schoolId field added to Class. These are
   additive changes to existing tables — document them as amendments,
   not new tables.

9. API Endpoint Definitions
   For each endpoint: Method + Path, auth role required, request schema
   (field names and types, no code), response schema, error responses,
   RBAC rule the Lambda Authorizer must enforce.

   Platform Admin endpoints:
     GET    /admin/users?search=&role=&suspended=
     GET    /admin/users/{userId}
     PATCH  /admin/users/{userId}/suspend
     PATCH  /admin/users/{userId}/unsuspend
     POST   /admin/users/{userId}/force-logout
     PATCH  /admin/users/{userId}/role
     DELETE /admin/users/{userId}  (COPPA deletion — requires confirmation token)
     GET    /admin/question-bank?status=&grade=&subject=
     PATCH  /admin/question-bank/{questionId}/flag
     PATCH  /admin/question-bank/{questionId}/unflag
     DELETE /admin/question-bank/{questionId}  (soft-delete)
     GET    /admin/cost-dashboard?window=24h|7d|30d
     GET    /admin/cost-dashboard/top-expensive
     GET    /admin/config
     GET    /admin/config/{configType}
     PUT    /admin/config/{configType}
     POST   /admin/schools
     GET    /admin/schools
     GET    /admin/schools/{schoolId}
     PATCH  /admin/schools/{schoolId}
     GET    /admin/audit-log?actorId=&targetEntityId=&from=&to=
     GET    /admin/compliance-log

   School Admin endpoints:
     GET    /school/teachers
     POST   /school/teachers/invite
     DELETE /school/teachers/{userId}
     GET    /school/students
     GET    /school/analytics
     POST   /school/bulk-assign
     GET    /school/config
     PATCH  /school/config

10. User Journey Flows (numbered prose steps, no diagrams):
    10.1 Super admin is bootstrapped at CDK deployment — first login
    10.2 Super admin creates a school and assigns a school_admin
    10.3 Super admin suspends a user and force-logs them out
    10.4 Super admin processes a COPPA deletion request end-to-end
    10.5 Super admin flags and soft-deletes a low-quality QuestionBank entry
    10.6 Super admin raises the daily token budget ceiling
    10.7 School admin invites a teacher to their school
    10.8 School admin runs a bulk worksheet assignment across three classes
    10.9 School admin reviews school-level analytics and identifies a
         weak grade/subject combination

11. Open Questions
    Only genuine ambiguities not resolved above. For each: the question,
    impact if unresolved, suggested default.

12. Dependencies
    Modules 1–6 all complete. External: Cognito Admin API access for
    force-logout (Cognito AdminUserGlobalSignOut), CloudFront IP restriction
    configuration, AWS Pricing API or hardcoded price constants for Bedrock
    cost estimates.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT 2 — TASK TRACKER
Filename: MODULE_7_TaskTracker.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Derive every development task from the FRD. Group by layer:
  Infrastructure & Data Model
  Backend — Lambda Functions & API
  Frontend — Admin Console UI
  Auth & RBAC
  Testing

Task ID format: M7-INF-001, M7-BE-001, M7-FE-001, M7-AUTH-001, M7-TEST-001

| Task ID | Layer | Title | Description | Depends On | Estimate | Priority |
|---------|-------|-------|-------------|------------|----------|----------|

Story points: Fibonacci (1, 2, 3, 5, 8, 13)
Priority: P1 (must-have Phase 2A), P2 (school admin Phase 2B), P3 (nice-to-have)

After the table include a plain-text dependency graph:
  Task X must complete before Task Y
  Tasks A, B, C can be parallelised

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT 3 — SPRINT PLAN
Filename: MODULE_7_SprintPlan.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Assumptions:
  Sprint length       : 2 weeks
  Team capacity       : 2 engineers (1 frontend, 1 backend/infra)
  Velocity            : 16 story points per engineer per sprint (32 total)
  Pre-condition       : Modules 1–6 complete and stable
  Phase 2A first      : All P1 (super_admin) tasks complete before Phase 2B begins
  Admin console frontend and backend can be parallelised once API contracts
  are agreed (same pattern as Module 5)

Sprint structure:

### Sprint N — [Theme]
Goal: one sentence
Duration: Week N–N (relative)

| Task ID | Title | Assignee | Points |
|---------|-------|----------|--------|

Sprint total: X points
Notes: sequencing rationale, risks, dependencies

After all sprints include:
  Release Readiness Checklist (Phase 2A go/no-go criteria)
  Release Readiness Checklist (Phase 2B go/no-go criteria)
  Known Risks: top 3 with mitigation
  Definition of Done for Module 7

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY RULES — APPLY TO ALL THREE DOCUMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- No code snippets or implementation suggestions. Requirements only.
- Every FR must have at least one testable, specific acceptance criterion.
- Every API endpoint must have an explicit RBAC rule stated.
- The AuditLog append-only constraint must appear as an acceptance criterion
  on every state-changing admin endpoint — not just as a general NFR.
- The ComplianceLog write-before-delete ordering must appear as an
  acceptance criterion on the COPPA deletion endpoint specifically.
- The suspended flag check in the Lambda Authorizer must appear as a task
  in the Task Tracker (it is an amendment to Module 1's authorizer, not
  a new Lambda — but it is a real development task that must be allocated
  to a sprint).
- The QuestionBank status field amendment (adding flagged/deleted values)
  must appear as a task and must reference its impact on the Module 2
  Step Functions GSI query filter.
- The daily token budget ceiling check must appear as a task that amends
  the Module 2 worksheet generation Lambda — it is not a new Lambda.
- All three documents must be internally consistent. No orphaned requirements.
- Phase 2A tasks must all be allocated to sprints before any Phase 2B tasks.
- Be exhaustive. When in doubt, include the task at P2.
```
