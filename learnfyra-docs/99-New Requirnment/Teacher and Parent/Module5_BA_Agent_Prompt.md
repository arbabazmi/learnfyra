# Module 5 — BA Agent Prompt
## FRD + Task Tracker + Sprint Plan: Teacher & Parent Roles

**Date:** 2026-04-01  
**Status:** Ready to hand off to Claude Code BA Agent  
**Output files expected:** MODULE_5_FRD_Teacher_Parent.md, MODULE_5_TaskTracker.md, MODULE_5_SprintPlan.md

---

## Prompt (paste this in full to the BA Agent)

```
You are a senior Business Analyst agent for the Learnfyra EdTech platform.
Your task is to produce three complete, production-ready documents:
  1. Functional Requirements Document (FRD) — Module 5: Teacher & Parent Roles
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
registration or login. Authentication is optional and framed as a benefit,
never a requirement. Cost-consciousness is a hard constraint given the
free-tier service model.

Tech stack:
  Frontend   : React + TypeScript + Vite
  Backend    : AWS Lambda, DynamoDB, API Gateway with Lambda Authorizer
  Auth       : AWS Cognito — Google OAuth + email/password
  Infra      : AWS CDK, serverless, four environments: local / dev / qa / prod
  Local dev  : DynamoDB local, Mailhog for email catching

Existing modules already designed (do not redesign these, treat as stable):
  Module 1 — Auth & Identity       : Google OAuth, JWT, Lambda Authorizer, Cognito
  Module 2 — Worksheet Generator   : AI via AWS Bedrock, Step Functions pipeline,
                                     Question Bank (DynamoDB), async generation,
                                     POST /worksheet → PENDING → GET /worksheet/{id}
  Module 3 — Online Solve          : MCQ / fill-blank / short-answer, practice vs
                                     test modes, auto-save, timer, attempt lifecycle
  Module 4 — Progress Tracking     : UserProgress table, topic-wise accuracy,
                                     weak area detection, attempt history
  Module 6 — Infrastructure & CDK  : multi-env CDK stacks, CI/CD pipeline,
                                     COPPA compliance, encryption, WAF

Existing DynamoDB tables (access-pattern-first design, GSIs already defined):
  Users           PK: USER#<cognitoSub>
  QuestionBank    PK: QUESTION#<id>,    SK: METADATA
  Worksheet       PK: WORKSHEET#<id>,   SK: METADATA
  WorksheetAttempt PK: ATTEMPT#<id>,   SK: METADATA
  UserProgress    (userId + topic-level aggregations)
  GenerationLog   PK: GENERATION#<id>, SK: METADATA
  Config          PK: CONFIG#<type>,   SK: METADATA

User roles currently defined in the User record:
  student  (default)
  teacher  (to be implemented — this document)
  parent   (to be implemented — this document)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN DECISIONS — ALREADY RESOLVED (treat these as final)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHILOSOPHY CLARIFICATION FOR TEACHER & PARENT ROLES
Teacher and Parent are relational roles — their value derives entirely from
being connected to other users (class members, children). Authentication is
therefore mandatory for these roles. This is not a contradiction of the
guest-first principle: core learning remains open; relationship management
requires identity. This distinction must be reflected in the FRD's scope
section.

TEACHER — RESOLVED DESIGN DECISIONS

1. Class scoping
   A teacher creates named classes. Each class has a grade level and optional
   subject list. Each class gets a unique short alphanumeric invite code.
   Students join via invite code with no teacher approval required (frictionless).
   A teacher may manage multiple classes simultaneously.
   A class can be archived at end of term; archived classes are read-only,
   not deleted. Student progress data is never deleted when a class is archived.

2. Worksheet assignment
   Teachers assign from their own generated worksheet library (previously
   generated worksheets are saveable and reusable — this is a cost-saving
   constraint; do not generate a new worksheet for every assignment).
   Assignment configuration parameters:
     - Mode            : Practice (instant feedback) OR Test (score hidden
                         until submission)
     - Time limit      : Optional. If set, solve engine auto-submits at zero.
     - Due date        : Creates urgency; surfaces overdue state in student
                         and parent dashboards.
     - Availability window : openAt + closeAt timestamps. Students cannot
                         access the worksheet outside this window.
     - Retake policy   : Unlimited retakes / limited count / locked to first
                         attempt only.
   Assignment mode and retake policy set by the teacher override any student
   preference.

3. Short-answer review queue
   The scoring engine in Module 3 flags short answers where fuzzy-match
   confidence is below threshold. These flagged responses must surface in a
   Teacher Review Queue. The teacher sees: the question, the student's
   answer, the expected answer, and the system confidence score. The teacher
   approves the auto-score or overrides it with a manual score. An override
   triggers: recalculation of the attempt total score, update to
   WorksheetAttempt, update to UserProgress, and a status change in the
   StudentAssignmentStatus record. The review queue must be surfaced
   prominently in the teacher dashboard — not buried in a sub-menu.

4. Class analytics dashboard
   The teacher dashboard has two primary views:
   a) Class overview: average score per assignment, completion rate
      (submitted before due date), ranked list of weakest class topics,
      list of students below an accuracy threshold (configurable, default 60%).
   b) Topic × Student heatmap: rows = students, columns = curriculum topics,
      cells = accuracy percentage, colour-coded red→green. This is the most
      actionable view for instructional decisions.
   The teacher can click any student cell to drill down to that student's
   individual progress view (read-only, same data the student sees).

5. RBAC enforcement for teacher
   A teacher JWT on any class-scoped endpoint resolves only if that teacher
   is the owner of the requested class. A teacher cannot access another
   teacher's class data. This is the most commonly misimplemented rule and
   must be stated as an explicit acceptance criterion on every class-scoped
   endpoint.

PARENT — RESOLVED DESIGN DECISIONS

6. Parent-child linking — two flows
   Flow A (student-initiated): A logged-in student generates a one-time
   parent invite code from their profile settings. The code expires after
   48 hours and is single-use. The parent uses this code when registering
   or from their existing account to establish the link.
   Flow B (teacher-initiated): A teacher can generate a parent invite code
   for a specific student in their class and distribute it out-of-band
   (printed, emailed manually). This flow is critical for Grades 1–4
   where younger students may not manage their own accounts.
   A parent can link to multiple children (siblings). A child can have
   multiple parents linked. The link is stored bidirectionally in DynamoDB
   so it can be queried from either direction efficiently.

7. Parent dashboard scope
   The parent dashboard is read-only. It surfaces three things:
   a) Activity summary: last 7 days and last 30 days — worksheets attempted,
      average score, time spent.
   b) Assignment status: all active teacher assignments for their child —
      what is due, what has been submitted, what score was received on
      submitted tests.
   c) Needs attention: topics where the child's accuracy has been below
      60% across three or more attempts. This is a computed, not real-time,
      signal.
   For parents with multiple children, a child-switcher at the top level
   of the dashboard is required. Each child is fully isolated — no
   cross-child data is ever surfaced in a single view.

8. RBAC enforcement for parent
   A parent JWT on GET /student/:id/progress resolves only if a valid
   ParentChildLink exists between the requester's Cognito sub and the
   requested studentId. No exceptions. Enumeration of student IDs by a
   parent must return 403 on all unlinked records.

RBAC MATRIX — COMPLETE AND FINAL

  Action                          | Guest | Student  | Teacher         | Parent
  --------------------------------|-------|----------|-----------------|------------------
  Solve worksheet                 | ✅*   | ✅       | ✅              | ✅
  Generate worksheet              | ✅    | ✅       | ✅              | ✅
  Create class                    | ❌    | ❌       | ✅              | ❌
  Assign worksheet to class       | ❌    | ❌       | ✅ own class    | ❌
  View class roster               | ❌    | ❌       | ✅ own classes  | ❌
  View student progress           | ❌    | self only| ✅ own students | ✅ own children
  Review / override short answers | ❌    | ❌       | ✅ own class    | ❌
  Set assignment mode/timer       | ❌    | ❌       | ✅              | ❌
  Archive class                   | ❌    | ❌       | ✅ own class    | ❌
  Link to child                   | ❌    | ❌       | initiate invite | ✅ consume invite
  View assignment status          | ❌    | own only | all in class    | own child only

  * Guest: stateless mode, limited tracking

NEW DYNAMODB TABLES REQUIRED (schemas to be formally specified in FRD)

  Class
    PK : CLASS#<classId>
    SK : METADATA
    Key attributes: teacherId, className, gradeLevel, subjects[],
                    inviteCode, inviteCodeExpiresAt, status (active/archived),
                    createdAt
    GSI required: query all classes by teacherId

  Assignment
    PK : ASSIGNMENT#<assignmentId>
    SK : METADATA
    Key attributes: classId, worksheetId, mode, timeLimit, dueDate, openAt,
                    closeAt, retakePolicy, status (active/closed/archived),
                    createdAt
    GSI required: query assignments by classId, query by classId + dueDate

  StudentAssignmentStatus
    PK : ASSIGNMENT#<assignmentId>
    SK : STUDENT#<studentId>
    Key attributes: status (not-started / in-progress / submitted / overdue),
                    attemptId (nullable), score (nullable), submittedAt (nullable)
    GSI required: query all assignments for a studentId (flipped access pattern)
    Note: this is the join record between Assignment and WorksheetAttempt.
    It is required by both the teacher class progress view and the parent
    homework status view. It must be modelled as a first-class record
    with both GSIs from day one — not derived at query time.

  ParentChildLink
    PK : USER#<parentId>
    SK : CHILD#<childId>
    Key attributes: linkedAt, linkMethod (student-invite / teacher-invite),
                    status (active / revoked)
    GSI required: inverted — PK: USER#<childId>, SK: PARENT#<parentId>
    (bidirectional querying is required)

  ParentInviteCode  (short-lived, consumed on use)
    PK : INVITE#<code>
    SK : METADATA
    Key attributes: initiatedBy (studentId or teacherId), targetStudentId,
                    createdAt, expiresAt, used (boolean)
    TTL: set on expiresAt so DynamoDB auto-expires unconsumed codes

PHASE 1 SCOPE CUT — WHAT IS IN AND WHAT IS DEFERRED

  Phase 1 (this document):
    Teacher   : class creation, invite code, student roster management,
                worksheet assignment with all configuration parameters,
                class progress dashboard (overview + heatmap + per-student
                drill-down), short-answer review queue, RBAC enforcement
                on all endpoints
    Parent    : student-initiated and teacher-initiated linking flows,
                parent invite code generation and consumption,
                read-only child progress dashboard, multi-child switcher,
                RBAC enforcement on all endpoints

  Deferred to Phase 2 (document as out-of-scope with reason):
    Teacher   : teacher feedback/comments on individual attempts, bulk
                score approval in review queue, PDF/CSV report export,
                school admin role above teacher, multi-teacher class
                collaboration, messaging/announcements to class
    Parent    : email digest notifications, accuracy-drop alert emails
                (note: architecture must make this addable via DynamoDB
                Streams + Lambda without schema migration — flag this
                as an architectural constraint in the FRD even though
                the feature is deferred)
    Both      : Microsoft/GitHub OAuth, MFA, advanced cohort analytics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Produce all three documents in a single output. Use clear Markdown headings
to separate them. Follow the structure and formatting rules below precisely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT 1 — FUNCTIONAL REQUIREMENTS DOCUMENT (FRD)
Filename suggestion: MODULE_5_FRD_Teacher_Parent.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Structure:

1. Document Header
   Module name, version (1.0), date, status (Draft), prepared by (BA Agent),
   depends on (list other modules), change log table.

2. Executive Summary
   Two paragraphs. Explain what Module 5 delivers, why Teacher and Parent
   are relational roles, and how they interact with Modules 1–4.

3. Scope
   3.1 In-scope (Phase 1)
   3.2 Out-of-scope with brief reason for each item
   3.3 Architectural constraints for deferred features (email notifications
       must be addable via DynamoDB Streams without schema migration)

4. User Roles & Personas
   One paragraph per role (Teacher, Parent) covering who they are,
   their primary motivation, and their relationship to the student.

5. Functional Requirements — Teacher
   Group by these sub-sections:
   5.1 Role Registration & Upgrade (how a user becomes a teacher)
   5.2 Class Management (create, archive, invite code lifecycle)
   5.3 Worksheet Library (save, reuse, manage generated worksheets)
   5.4 Assignment Management (create, configure, publish, close)
   5.5 Short-Answer Review Queue (queue surfacing, approve, override,
       cascade score update)
   5.6 Class Progress Dashboard (overview panel, heatmap, student drill-down)
   5.7 Student Roster Management (view, remove, link to parent)

   For each requirement use the format:
   FR-T-XXX | Description | Priority (Must/Should/Could) | Acceptance Criteria

6. Functional Requirements — Parent
   Group by:
   6.1 Role Registration & Linking
   6.2 Parent Invite Code Flows (student-initiated, teacher-initiated)
   6.3 Child Progress Dashboard
   6.4 Multi-Child Management

   Same FR format: FR-P-XXX | Description | Priority | Acceptance Criteria

7. Non-Functional Requirements
   Security (RBAC enforcement, enumeration prevention),
   Performance (class analytics query SLA: < 300ms for classes up to 200
   students), Data Isolation (strict userId/classId/parentId enforcement),
   COPPA Compliance (no PII in logs, data retention policy for minors),
   Scalability (design for 500 students per class without scan operations)

8. Data Model Specification
   Full DynamoDB table definitions for:
   Class, Assignment, StudentAssignmentStatus, ParentChildLink, ParentInviteCode
   For each table: PK, SK, all attributes with types, all GSIs with their
   PK/SK and projection type, TTL field if applicable, access patterns
   served by each GSI.

9. API Endpoint Definitions
   For each endpoint: Method + Path, Auth required (role), Request schema
   (field names and types, no code), Response schema, Error responses,
   RBAC rule that the Lambda Authorizer must enforce.

   Endpoints to define:
   Teacher:
     POST   /classes
     GET    /classes (list teacher's classes)
     GET    /classes/{classId}
     DELETE /classes/{classId}/archive
     POST   /classes/{classId}/invite (regenerate invite code)
     GET    /classes/{classId}/students
     DELETE /classes/{classId}/students/{studentId}
     POST   /assignments
     GET    /assignments/{assignmentId}
     GET    /classes/{classId}/assignments
     PATCH  /assignments/{assignmentId} (update config before openAt)
     DELETE /assignments/{assignmentId}/close
     GET    /classes/{classId}/review-queue
     POST   /review-queue/{reviewId}/resolve
     GET    /classes/{classId}/analytics (overview panel data)
     GET    /classes/{classId}/analytics/heatmap

   Parent:
     POST   /parent/link (consume invite code)
     GET    /parent/children (list linked children)
     DELETE /parent/children/{studentId} (unlink)
     GET    /parent/children/{studentId}/progress
     GET    /parent/children/{studentId}/assignments

   Student (new endpoints driven by class participation):
     POST   /student/parent-invite (generate invite code)
     GET    /student/assignments (all active assignments for student)
     GET    /student/assignments/{assignmentId}

10. User Journey Flows
    Write step-by-step numbered flows (no diagrams, prose steps):
    10.1 Teacher creates a class and invites students
    10.2 Teacher generates, saves, and assigns a worksheet as a timed test
    10.3 Teacher resolves a short-answer review queue item
    10.4 Parent links to a child via student-initiated invite code
    10.5 Parent links to a child via teacher-initiated invite code
    10.6 Parent views child's homework status and weak topics

11. Open Questions
    List any genuine ambiguities not resolved by the design decisions above.
    Do not invent questions that are already resolved. For each open question
    include: the question, the impact if unresolved, and a suggested default.

12. Dependencies
    List dependencies on Modules 1–4 and 6, and any external dependencies.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT 2 — TASK TRACKER
Filename suggestion: MODULE_5_TaskTracker.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Derive every development task from the FRD. Group tasks by layer:
  Infrastructure & Data Model
  Backend — Lambda Functions & API
  Frontend — UI Components
  Auth & RBAC
  Testing

For each task use this exact table format:

| Task ID | Layer | Title | Description | Depends On | Estimate | Priority |
|---------|-------|-------|-------------|------------|----------|----------|

Task ID format: M5-INF-001, M5-BE-001, M5-FE-001, M5-AUTH-001, M5-TEST-001

Estimation units: story points using Fibonacci (1, 2, 3, 5, 8, 13)

Priority: P1 (must-have Phase 1), P2 (should-have Phase 1), P3 (nice-to-have Phase 1)

After the table, include a dependency graph written as a plain-text list:
  Task X must complete before Task Y
  Tasks A, B, C can be parallelised
  etc.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT 3 — SPRINT PLAN
Filename suggestion: MODULE_5_SprintPlan.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Assumptions to apply:
  Sprint length       : 2 weeks
  Team capacity       : 2 engineers (1 frontend, 1 backend/infra)
  Velocity estimate   : 16 story points per engineer per sprint (32 total)
  Parallel workstreams: frontend and backend/infra tasks can run concurrently
                        once API contracts are agreed
  Pre-condition       : Modules 1–4 and Module 6 infrastructure are
                        complete and stable before this module begins

Sprint structure for each sprint:

### Sprint N — [Theme]
Goal: one sentence sprint goal
Duration: Sprint N start → Sprint N end (use relative week numbers, e.g. Week 1–2)

| Task ID | Title | Assignee | Points |
|---------|-------|----------|--------|

Sprint total points: X
Notes: any sequencing rationale, risks, or cross-team dependencies

After all sprints, include:
  Release Readiness Checklist: what must be true before Module 5 ships to QA
  Known Risks: top 3 risks with mitigation for each
  Definition of Done for Module 5: specific, testable criteria

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY RULES — APPLY TO ALL THREE DOCUMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Do not include code snippets, code examples, or implementation suggestions
  in any document. Requirements only. Implementation is the engineer's domain.
- Every functional requirement must have at least one acceptance criterion.
  Acceptance criteria must be testable and specific — not vague.
- Every API endpoint must have an explicit RBAC rule stated.
- The StudentAssignmentStatus table and its dual GSIs must appear in the data
  model and be referenced in every feature that depends on it (teacher class
  view, parent homework view, student assignment view). Do not let this table
  appear only once — it is the most critical new join record.
- The ParentInviteCode table must specify TTL-based expiry as the cleanup
  mechanism, not a scheduled job. State this explicitly.
- The deferred email notification feature must appear as an architectural
  note in the non-functional requirements: the UserProgress write path
  must emit to a DynamoDB Stream so a future Lambda consumer can evaluate
  notification thresholds without requiring a schema change.
- All three documents must be internally consistent. If a feature appears
  in the FRD it must have corresponding tasks in the Task Tracker and
  those tasks must be allocated to a sprint. No orphaned requirements.
- Be exhaustive. A task missed here becomes a production gap. When in doubt,
  include the task and mark it P2.
```
