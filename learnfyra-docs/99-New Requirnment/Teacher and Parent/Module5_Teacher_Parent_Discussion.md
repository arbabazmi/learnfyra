# Module 5 — Teacher & Parent Role Design Discussion

**Date:** 2026-04-01  
**Status:** Finalised — ready for BA agent  
**Context:** Pre-requirements design discussion covering all resolved decisions for Teacher and Parent roles in Learnfyra.

---

## The Core Tension Resolved

Learnfyra is guest-first — no learning flow is gated behind login. That philosophy works cleanly for students. But both Teacher and Parent roles are fundamentally *relational* — they derive their entire value from being connected to other users (class members, children). So the principle needs a small refinement:

> **Core learning is always guest-accessible. Teacher and Parent roles require authentication because they are relationship-management roles, not learning roles.**

This is a coherent distinction and not a contradiction of the platform's values.

---

## Teacher Role

The teacher's job on Learnfyra is not just generating worksheets — any guest can do that. The teacher's unique value is **orchestrating a cohort of learners** and having visibility into how that cohort moves through material over time.

### Class Management

A teacher creates a named class scoped to a grade level and optionally one or more subjects. Each class gets a short alphanumeric invite code. Students join via that code with no teacher approval required — frictionless by default. The teacher can remove students from the roster, and removal takes effect immediately: the student loses class-scoped visibility but retains their own personal progress history, because progress belongs to the learner, not the class.

A teacher will likely teach multiple classes — different periods, different grade levels. The UI needs a class switcher at the top level, not buried in settings. Each class is its own isolated context with its own analytics.

Classes can be archived at end of term — archived classes are read-only, not deleted. Student progress data is never deleted when a class is archived.

### Worksheet Assignment

This is where Teacher diverges fundamentally from a regular user. A teacher doesn't just generate worksheets for themselves — they generate and then **push** worksheets to a class. Teachers assign from a saved worksheet library (previously generated worksheets are reusable — a critical cost-saving mechanic that avoids hitting Bedrock for the same worksheet repeatedly).

When assigning, the teacher configures:

- **Mode** — Practice (instant feedback) vs Test (score revealed only after submission). This overrides whatever default a student might prefer.
- **Time limit** — Optional. If set, the solve engine enforces it and auto-submits at zero.
- **Due date** — Creates urgency and affects how the assignment appears in student and parent dashboards.
- **Availability window** — openAt + closeAt. Students cannot access a worksheet outside this window.
- **Retake policy** — Unlimited / limited count / locked to first attempt only.

### The Short-Answer Review Queue

The scoring engine flags short answers where fuzzy-match confidence is below threshold. These flagged responses must surface in a **Teacher Review Queue**. The teacher sees: the question, the student's answer, the expected answer, and the system confidence score. The teacher approves or overrides with a manual score.

An override triggers a cascade: recalculation of the attempt total score → update to WorksheetAttempt → update to UserProgress → status change in StudentAssignmentStatus.

The review queue must be surfaced prominently on the teacher dashboard — not hidden in a sub-menu. It is one of the most time-sensitive things a teacher needs to action.

### Class Analytics Dashboard

The teacher dashboard has two primary views:

**Class Overview Panel** — average score per assignment, completion rate (submitted before due date), ranked list of weakest class topics, list of students below an accuracy threshold (configurable, default 60%).

**Topic × Student Heatmap** — rows are students, columns are curriculum topics, cells are accuracy percentages, colour-coded red → green. This is the most actionable view for instructional decisions. It instantly shows both which students are falling behind and which topics the whole class is weak on — the latter is a signal the teacher's own instruction may need adjustment, not just more student practice.

The teacher can click any student cell to drill down to that student's individual progress view (read-only mirror of what the student sees).

### RBAC Enforcement for Teacher

A teacher JWT on any class-scoped endpoint resolves only if that teacher is the owner of the requested class. A teacher cannot access another teacher's class data. This is the most commonly misimplemented RBAC rule in EdTech and must be an explicit acceptance criterion on every class-scoped endpoint.

### What Teachers Don't Need in Phase 1

Teachers don't need to create question bank entries manually, don't need to write feedback comments on individual attempts (future), don't need a messaging system, don't need report export to PDF yet, and don't need school-admin capabilities. Keep the role tight.

---

## Parent Role

The parent role is philosophically simpler but technically trickier because of the **linking problem** — how does a parent get securely connected to a specific child's account?

### The Linking Flow — Two Entry Points

**Flow A (student-initiated):** A logged-in student generates a one-time parent invite code from their profile settings. The code expires after 48 hours and is single-use. The parent uses this code when registering or from their existing account to establish the link.

**Flow B (teacher-initiated):** A teacher can generate a parent invite code for a specific student in their class and distribute it out-of-band (printed, emailed manually). This flow is critical for Grades 1–4 where younger students may not manage their own accounts.

A parent can link to multiple children (siblings). A child can have multiple parents linked. The link is stored bidirectionally in DynamoDB so it can be queried from either direction efficiently.

### What a Parent Actually Sees

A parent doesn't need the full student dashboard. They need a **simplified, read-only progress view** focused on three things: is my child doing their homework, how are they performing, and where are they struggling?

That translates to:

- **Activity summary** — last 7 days and last 30 days: worksheets attempted, average score, time spent.
- **Assignment status** — all active teacher assignments for their child: what is due, what has been submitted, what score was received.
- **Needs attention** — topics where the child's accuracy has been below 60% across three or more attempts. This is a computed signal, not real-time.

For parents with multiple children, a **child-switcher at the top level** of the dashboard is required. Each child is fully isolated — no cross-child data is ever surfaced in a single view.

### What a Parent Cannot Do

Parents cannot generate worksheets on behalf of their child (they can generate as a regular user for themselves, but cannot push content into their child's assigned queue). Parents cannot view the class roster — they see only their own child, never classmates. Parents cannot override scores or interact with the review queue. Parents cannot change their child's account settings or role.

### RBAC Enforcement for Parent

A parent JWT on `GET /student/:id/progress` resolves only if a valid `ParentChildLink` exists between the requester's Cognito sub and the requested studentId. Enumeration of student IDs by a parent must return 403 on all unlinked records.

### Deferred — But Architect For It Now

Phase 1 won't ship email notifications, but the data model must make it easy to add later. UserProgress writes should emit to a DynamoDB Stream so a future Lambda consumer can evaluate "did this student's topic accuracy drop below threshold?" and fire via SES — without requiring a schema migration. This is a hard architectural constraint, not a nice-to-have.

---

## New DynamoDB Tables Required

### Class
- PK: `CLASS#<classId>`, SK: `METADATA`
- Attributes: teacherId, className, gradeLevel, subjects[], inviteCode, inviteCodeExpiresAt, status (active/archived), createdAt
- GSI: query all classes by teacherId

### Assignment
- PK: `ASSIGNMENT#<assignmentId>`, SK: `METADATA`
- Attributes: classId, worksheetId, mode, timeLimit, dueDate, openAt, closeAt, retakePolicy, status (active/closed/archived), createdAt
- GSI 1: query assignments by classId
- GSI 2: composite — classId + dueDate (upcoming assignment queries)

### StudentAssignmentStatus *(most critical new record)*
- PK: `ASSIGNMENT#<assignmentId>`, SK: `STUDENT#<studentId>`
- Attributes: status (not-started / in-progress / submitted / overdue), attemptId (nullable), score (nullable), submittedAt (nullable)
- GSI: inverted — query all assignments for a given studentId
- Note: This is the join record between Assignment and WorksheetAttempt. It is required by both the teacher class progress view AND the parent homework status view AND the student assignment view. It must be modelled as a first-class DynamoDB record with both GSIs from day one — not derived at query time. If modelled lazily, class dashboards become full scans at 50+ students.

### ParentChildLink
- PK: `USER#<parentId>`, SK: `CHILD#<childId>`
- Attributes: linkedAt, linkMethod (student-invite / teacher-invite), status (active/revoked)
- GSI: inverted — PK: `USER#<childId>`, SK: `PARENT#<parentId>` (bidirectional querying required)

### ParentInviteCode *(short-lived, consumed on use)*
- PK: `INVITE#<code>`, SK: `METADATA`
- Attributes: initiatedBy (studentId or teacherId), targetStudentId, createdAt, expiresAt, used (boolean)
- TTL: set on expiresAt — DynamoDB auto-expires unconsumed codes. Cleanup must use TTL, not a scheduled job.

---

## RBAC Matrix — Complete

| Action | Guest | Student | Teacher | Parent |
|--------|-------|---------|---------|--------|
| Solve worksheet | ✅ stateless | ✅ tracked | ✅ tracked | ✅ tracked |
| Generate worksheet | ✅ | ✅ | ✅ | ✅ |
| Create class | ❌ | ❌ | ✅ | ❌ |
| Assign worksheet to class | ❌ | ❌ | ✅ own class | ❌ |
| View class roster | ❌ | ❌ | ✅ own classes | ❌ |
| View student progress | ❌ | self only | ✅ own students | ✅ own children |
| Review / override short answers | ❌ | ❌ | ✅ own class | ❌ |
| Set assignment mode/timer | ❌ | ❌ | ✅ | ❌ |
| Archive class | ❌ | ❌ | ✅ own class | ❌ |
| Link to child | ❌ | ❌ | can initiate invite | ✅ consume invite |
| View assignment status | ❌ | own only | all in class | own child only |

---

## Phase 1 Scope Cut

### In Phase 1
**Teacher:** class creation + invite + roster management, worksheet assignment with all configuration parameters, class progress dashboard (overview + heatmap + per-student drill-down), short-answer review queue, RBAC enforcement on all endpoints.

**Parent:** student-initiated and teacher-initiated linking flows, invite code generation and consumption, read-only child progress dashboard, multi-child switcher, RBAC enforcement on all endpoints.

### Deferred to Phase 2
**Teacher:** feedback/comments on individual attempts, bulk score approval in review queue, PDF/CSV report export, school admin role, multi-teacher class collaboration, messaging/announcements.

**Parent:** email digest notifications, accuracy-drop alert emails.

**Both:** Microsoft/GitHub OAuth, MFA, advanced cohort analytics.
