# Module 5 — Requirements Analysis
## Teacher & Parent Roles

| Field | Value |
|---|---|
| Document | 01-requirements-analysis.md |
| Module | M05 — Teacher & Parent Roles |
| Version | 1.0 |
| Date | 2026-04-03 |
| Prepared By | BA Agent |
| Source Documents | MODULE_5_FRD_Teacher_Parent.md v1.0, MODULE_5_TaskTracker.md v1.0, MODULE_5_SprintPlan.md v1.0, design-discussion.md |
| Audience | Technical Designer, DEV Agent, IaC Agent, QA Agent |

---

## 1. User Stories

### 1.1 Teacher Stories

**T-US-01 — Role Acquisition**
As a Teacher, I want to register directly with the Teacher role or upgrade from an existing Student account, so that I can access class management features without re-registering.

**T-US-02 — Class Creation**
As a Teacher, I want to create a named class with an optional grade level and subject configuration, so that I have an isolated context in which to organise my students and assignments.

**T-US-03 — Student Enrollment**
As a Teacher, I want to distribute a short invite code to my students so that they can self-enroll in my class without requiring my approval for each student.

**T-US-04 — Invite Code Control**
As a Teacher, I want to regenerate my class's invite code at any time, so that I can revoke access from new students if the previous code was shared beyond my class without affecting existing enrolled students.

**T-US-05 — Multiple Classes**
As a Teacher, I want to manage multiple classes simultaneously, so that I can run different cohorts (different periods, grades, or subjects) from a single account.

**T-US-06 — Class Archival**
As a Teacher, I want to archive a class at end of term, so that it disappears from my active list while all historical data (attempts, scores, analytics) remains accessible.

**T-US-07 — Worksheet Library**
As a Teacher, I want to save previously generated worksheets to a personal library, so that I can assign them to classes without triggering a new AI generation each time.

**T-US-08 — Assignment Configuration**
As a Teacher, I want to assign a worksheet to a class with configurable mode (practice or test), time limit, availability window, due date, and retake policy, so that I can control how my students experience the material and when they can access it.

**T-US-09 — Assignment Enforcement**
As a Teacher, I want my assignment configuration (mode, time limit, retake policy) to be enforced automatically by the solve engine, so that I do not have to police individual student sessions.

**T-US-10 — Short-Answer Review Queue**
As a Teacher, I want a prominently surfaced review queue that shows short-answer responses the scoring engine flagged as low-confidence, so that I can approve or override the system score before it becomes final in student records.

**T-US-11 — Score Override Cascade**
As a Teacher, I want an override I apply to a short-answer score to automatically cascade to the student's attempt total, their topic accuracy, and their assignment status, so that I do not need to manually correct records in multiple places.

**T-US-12 — Class Overview Analytics**
As a Teacher, I want to see a class overview panel showing average scores per assignment, overall completion rate, the five weakest topics, and a list of students below my accuracy threshold, so that I can identify where intervention is most needed.

**T-US-13 — Topic-by-Student Heatmap**
As a Teacher, I want a two-dimensional heatmap showing each student's accuracy per curriculum topic, so that I can instantly see which students are weak in which topics and adjust my instruction accordingly.

**T-US-14 — Per-Student Drill-Down**
As a Teacher, I want to click on any student cell in the heatmap to view that student's full progress profile (read-only), so that I can diagnose individual gaps without leaving the analytics dashboard.

**T-US-15 — Roster Management**
As a Teacher, I want to view my class roster with each student's completion summary and overall accuracy, and remove any student when necessary, so that I can keep the roster clean and accurate.

**T-US-16 — Parent Invite for Young Students**
As a Teacher, I want to generate a parent invite code on behalf of a specific enrolled student, so that parents of younger students (Grades 1–4) who cannot manage their own accounts can still be linked to their child.

---

### 1.2 Parent Stories

**P-US-01 — Role Acquisition**
As a Parent, I want to register directly with the Parent role or upgrade from an existing account, so that I can link to my child and access their progress data.

**P-US-02 — Student-Initiated Linking**
As a Parent, I want to use an invite code my child generates from their profile, so that the link is established with my child's explicit consent and the code expires automatically after 48 hours.

**P-US-03 — Teacher-Initiated Linking**
As a Parent, I want to use an invite code the teacher generates and distributes (e.g., in a backpack note), so that I can still link to my young child who cannot manage their own account settings.

**P-US-04 — Single-Use Code Safety**
As a Parent, I want to know that the invite code can only be consumed once, so that no other parent can accidentally or maliciously link to my child using the same code.

**P-US-05 — Multi-Child Switcher**
As a Parent with multiple children enrolled in Learnfyra, I want a top-level child switcher on my dashboard (not buried in settings), so that I can move between each child's progress view without extra navigation.

**P-US-06 — Child Progress Summary**
As a Parent, I want to see my child's activity summary for the last 7 days and last 30 days (worksheets attempted, average score, time spent), so that I can gauge how actively they are practising.

**P-US-07 — Assignment Status Monitoring**
As a Parent, I want to see all of my child's active teacher assignments with their status (not-started, in-progress, submitted, overdue), so that I know whether homework is being completed before the due date.

**P-US-08 — Needs-Attention Alerts**
As a Parent, I want to see a "needs attention" list of topics where my child's accuracy has been below 60% across three or more attempts, so that I can have an informed conversation about specific areas of difficulty before gaps compound.

**P-US-09 — Unlinking**
As a Parent, I want to unlink from a child's account at any time, so that I can stop receiving that child's data (for example, if a family circumstance changes) without affecting the child's account or progress.

**P-US-10 — Read-Only Assurance**
As a Parent, I want the platform to guarantee that my access is strictly read-only, so that my browsing of my child's dashboard cannot accidentally modify their scores, assignments, or settings.

---

### 1.3 Student Stories Driven by Class Participation

**S-US-01 — Joining a Class**
As a Student, I want to join my teacher's class by entering a 6-character invite code, so that I can receive and complete teacher-assigned worksheets.

**S-US-02 — Viewing Assigned Worksheets**
As a Student, I want to see all active assignments from my enrolled classes in a single list, with due dates and submission status, so that I can prioritise my work.

**S-US-03 — Generating a Parent Invite**
As a Student, I want to generate a one-time parent invite code from my profile settings, so that I can give my parent read-only visibility into my progress without sharing my password.

**S-US-04 — Rejoining After Removal**
As a Student who has been removed from a class, I want to be able to rejoin using the current invite code if the class is still active, so that a teacher error or temporary removal does not permanently block my access.

---

## 2. Functional Requirements List

### 2.1 Authentication and Role Management

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-T-001 | Existing Student may upgrade to Teacher role via POST /user/role/upgrade with body { role: "teacher" }. Users record role field is set to "teacher". Subsequent JWTs carry the teacher role claim. | Must | M01 Lambda Authorizer, M01 Cognito User Pool |
| FR-T-002 | New user may select Teacher role at registration. Post-confirmation Lambda trigger writes Users record with role = "teacher". | Must | M01 Cognito post-confirmation trigger |
| FR-T-003 | Role downgrade from Teacher to Student is not permitted via self-service. Attempt returns 403 ROLE_DOWNGRADE_NOT_PERMITTED. | Must | M01 Lambda Authorizer |
| FR-T-004 | Lambda Authorizer rejects non-teacher JWTs on teacher-only endpoints with 403 INSUFFICIENT_ROLE before the handler is invoked. | Must | M01 Lambda Authorizer |
| FR-P-001 | New user may register as Parent. Users record has role = "parent". | Must | M01 Cognito post-confirmation trigger |
| FR-P-002 | Existing user may upgrade to Parent role via POST /user/role/upgrade. | Must | M01 Lambda Authorizer |
| FR-P-003 | Lambda Authorizer rejects non-parent JWTs on parent-only endpoints with 403 INSUFFICIENT_ROLE before handler invocation. | Must | M01 Lambda Authorizer |
| FR-P-004 | Parent endpoints return 403 CHILD_NOT_LINKED for any unlinked studentId regardless of whether that studentId exists. Enumeration prevention is mandatory. | Must | ParentChildLink table, M5-AUTH-003 |

---

### 2.2 Class Management

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-T-010 | Teacher may create a named class. Required: className (1–100 chars). Optional: gradeLevel (1–10), subjects (enum array). System generates UUID classId and 6-char alphanumeric invite code (uppercase A–Z, 0–9, excluding O, 0, I, 1, unique across all active classes). | Must | LearnfyraClasses table, InviteCodeIndex GSI |
| FR-T-011 | Invite code must be unique at creation time. Collision triggers automatic regeneration without error surfaced to caller. Uniqueness checked via InviteCodeIndex GSI (no scan). | Must | InviteCodeIndex GSI |
| FR-T-012 | Teacher may regenerate invite code at any time. Previous code is immediately invalid. Existing members are unaffected. Old code returns 404 INVALID_JOIN_CODE after regeneration. | Must | LearnfyraClasses table, InviteCodeIndex GSI |
| FR-T-013 | Every class-scoped endpoint must verify that the authenticated teacher's userId matches Class.teacherId. Mismatch returns 403 NOT_CLASS_OWNER. This applies without exception. | Must | Per-class ownership check utility (M5-AUTH-002) |
| FR-T-014 | Teacher may archive a class. Archived class status = "archived", excluded from active GET /classes. All student, assignment, StudentAssignmentStatus, and attempt records are preserved. Analytics remain accessible. | Must | LearnfyraClasses table |
| FR-T-015 | GET /classes returns all active classes for the authenticated teacher, ordered by createdAt descending. | Must | TeacherIndex GSI on LearnfyraClasses |
| FR-T-016 | Student joins a class by submitting invite code via POST /student/classes/join. No teacher approval required. Immediate enrollment. StudentAssignmentStatus records created for all active assignments. | Must | InviteCodeIndex GSI, LearnfyraStudentAssignmentStatus table |
| FR-T-017 | Student already enrolled returns 409 ALREADY_ENROLLED. No duplicate membership record written. | Must | LearnfyraClasses / ClassMembership records |
| FR-T-018 | A removed student may rejoin using the active invite code. Existing membership record updated to status = "active" with new joinedAt. No duplicate record written. | Should | ClassMembership record update logic |

---

### 2.3 Worksheet Library

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-T-020 | Teacher may save a previously generated worksheet to their personal library via POST /teacher/library with worksheetId. Worksheet record updated with savedBy (teacherId) and savedAt. | Must | Worksheet table (M02/M03) |
| FR-T-021 | GET /teacher/library returns all worksheets saved by the authenticated teacher, sorted by savedAt descending. Fields: worksheetId, title, grade, subject, topic, difficulty, questionCount, savedAt. No other teacher's worksheets visible. | Must | Worksheet table GSI on savedBy (confirm or add in M05) |
| FR-T-022 | Teacher may remove a worksheet from their library via DELETE /teacher/library/{worksheetId}. Only disassociates from teacher. Worksheet record and existing Assignment records are unaffected. | Should | Worksheet table write access |
| FR-T-023 | Assigning a worksheet to a class must reuse the existing Worksheet record. No new AI generation call is permitted. This is a hard cost-saving constraint. | Must | Assignment handler, M02/M03 Worksheet record |

---

### 2.4 Assignment Management

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-T-030 | Teacher may create an assignment specifying: classId (required), worksheetId (required), mode (required: "practice" or "test"), dueDate (optional), openAt (optional), closeAt (optional, must be after openAt if both set), timeLimit (optional, minimum 60 seconds), retakePolicy (required: "unlimited", "limited", or "once"). If retakePolicy = "limited", retakeLimit (integer >= 1) is also required. | Must | LearnfyraAssignments table, ownership check |
| FR-T-031 | Assignment creation must atomically write StudentAssignmentStatus records for every student currently enrolled in the class. Initial status = "not-started". Not deferred or async. | Must | LearnfyraStudentAssignmentStatus table |
| FR-T-032 | When a new student joins a class with active assignments, StudentAssignmentStatus records must be created for all active assignments at join time. Initial status = "not-started". | Must | LearnfyraStudentAssignmentStatus table, join flow |
| FR-T-033 | Assignment mode overrides student preference. Practice mode: instant per-question feedback. Test mode: score and answers hidden until full submission. Enforced by M03 solve engine reading the Assignment record. | Must | M03 solve engine integration, LearnfyraAssignments table |
| FR-T-034 | If timeLimit is set, solve engine enforces it and auto-submits when timer reaches zero. StudentAssignmentStatus updated to "submitted" on auto-submit. | Must | M03 solve engine, M04 submit handler integration |
| FR-T-035 | openAt and closeAt enforce availability window. Access before openAt or after closeAt returns 403 ASSIGNMENT_NOT_AVAILABLE. | Must | Assignment handler, student assignment access control |
| FR-T-036 | Teacher may update assignment configuration only before openAt has passed. After openAt, PATCH returns 409 ASSIGNMENT_ALREADY_OPEN. | Should | LearnfyraAssignments table, timestamp comparison |
| FR-T-037 | Teacher may close an active assignment early via DELETE /assignments/{assignmentId}/close. All StudentAssignmentStatus records with status "not-started" or "in-progress" are updated to "overdue". No new solve sessions permitted on a closed assignment. | Must | LearnfyraAssignments table, LearnfyraStudentAssignmentStatus table |
| FR-T-038 | GET /classes/{classId}/assignments returns all assignments sorted by dueDate ascending. Overdue assignments sorted by dueDate ascending at top. Each assignment includes current status. | Must | ClassDueDateIndex GSI, StudentAssignmentStatus aggregation |
| FR-T-039 | Retake policy is enforced by solve engine at attempt creation. Once policy with existing submitted attempt returns 403 RETAKE_NOT_PERMITTED. Limited policy with retakeLimit reached returns same error. | Must | M03 solve engine, WorksheetAttempt table, retakeLimit enforcement |

---

### 2.5 Short-Answer Review Queue

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-T-040 | M03 scoring engine must flag short-answer responses where fuzzy-match confidence is below 0.75 (configurable). Flagged responses create a ReviewQueueItem with status = "pending" associated to attemptId, questionNumber, studentId, classId, assignmentId. | Must | M03 scorer.js, ReviewQueueItems table |
| FR-T-041 | Review queue must be prominently surfaced on the teacher dashboard (not in a sub-menu). GET /classes/{classId}/review-queue returns all pending items with required fields: reviewId, studentName, questionText, studentAnswer, expectedAnswer, systemConfidenceScore, currentScore, pointsPossible, attemptId. | Must | ReviewQueueItems table, ClassPendingIndex GSI |
| FR-T-042 | Teacher resolves a ReviewQueueItem via POST /review-queue/{reviewId}/resolve with action = "approve" or "override" (with overrideScore 0 to pointsPossible). | Must | ReviewQueueItems table |
| FR-T-043 | Override action triggers atomic cascade: (1) ReviewQueueItem marked "resolved" with overrideScore, (2) WorksheetAttempt total recalculated, (3) UserProgress topic accuracy recalculated, (4) StudentAssignmentStatus score updated. All four writes must succeed or compensating writes must restore consistency. | Must | ReviewQueueItems, WorksheetAttempt (M04), UserProgress (M04), StudentAssignmentStatus tables |
| FR-T-044 | Teacher may only resolve items belonging to their own classes. Non-owned class item returns 403 NOT_CLASS_OWNER. | Must | Ownership check, ReviewQueueItem classId attribute |
| FR-T-045 | A resolved ReviewQueueItem cannot be re-resolved. Attempt returns 409 REVIEW_ALREADY_RESOLVED. | Should | ReviewQueueItem status check |

---

### 2.6 Class Analytics

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-T-050 | GET /classes/{classId}/analytics returns: averageScorePerAssignment (array), completionRate (overall %), weakestTopics (up to 5, ranked by lowest class-average accuracy from UserProgress), studentsBelowThreshold (studentIds where accuracy < configurable threshold, default 60%). | Must | ClassAssignmentIndex GSI, UserProgress table (M04) |
| FR-T-051 | GET /classes/{classId}/analytics/heatmap returns a two-dimensional structure: rows indexed by studentId, columns by curriculum topic, cells = accuracy percentage (0–100 integer) or null (no attempts). studentNames map included. | Must | UserProgress table (M04), roster query |
| FR-T-052 | Analytics and heatmap SLA: 300 milliseconds for classes with up to 200 students. No DynamoDB Scan operations permitted on any analytics code path. GSI-based queries only. | Must | ClassAssignmentIndex GSI, StudentIndex GSI, DynamoDB read capacity |
| FR-T-053 | Accuracy threshold configurable per class (0–100, default 60). Teacher updates via PATCH /classes/{classId} with { accuracyThreshold }. Analytics reflects the updated threshold immediately. | Should | LearnfyraClasses table, PATCH class handler |
| FR-T-054 | Teacher may drill down to an individual student's progress view via GET /classes/{classId}/students/{studentId}/progress. Response structure identical to M04 GET /student/progress. Requires teacher to own the class AND student to be enrolled. Returns 404 STUDENT_NOT_IN_CLASS if enrollment check fails (not 403). | Must | M04 progress data model and response schema |

---

### 2.7 Student Roster Management

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-T-060 | GET /classes/{classId}/students returns roster with fields: studentId, displayName, joinedAt, assignmentsSummary (total/submitted/overdue), lastActiveAt, overallAccuracy. | Must | ClassMembership, StudentAssignmentStatus aggregation |
| FR-T-061 | Teacher may remove a student via DELETE /classes/{classId}/students/{studentId}. ClassMembership status set to "removed". studentCount decremented. All historical WorksheetAttempt and StudentAssignmentStatus records preserved. Student no longer receives new assignments or sees class assignments. | Must | ClassMembership record, studentCount atomic decrement |
| FR-T-062 | Teacher may generate a parent invite code for any enrolled student via POST /classes/{classId}/students/{studentId}/parent-invite. ParentInviteCode record written with linkMethod = "teacher-invite", TTL = 48 hours. Response includes code string and expiresAt. Non-enrolled student request returns 403 STUDENT_NOT_IN_CLASS. | Must | ParentInviteCode table, enrollment verification |

---

### 2.8 Parent Invite and Linking

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-P-010 | Student generates parent invite code via POST /student/parent-invite. ParentInviteCode record: initiatedBy = student userId, targetStudentId = student's own userId, linkMethod = "student-invite", used = false, TTL = createdAt + 48 hours. If a prior unused code exists for this student, it is invalidated (used = true) before writing the new one. | Must | ParentInviteCode table, DynamoDB TTL |
| FR-P-011 | Teacher generates parent invite code for enrolled student (FR-T-062). linkMethod = "teacher-invite". Same TTL and single-use rules apply. | Must | ParentInviteCode table |
| FR-P-012 | Parent consumes invite code via POST /parent/link. Validation: record exists (else 404), used = false (else 409), current time before expiresAt (else 410). On success: ParentChildLink written, invite code marked used = true atomically. Response includes linked child's displayName. | Must | ParentChildLink table, ParentInviteCode table, atomic conditional update |
| FR-P-013 | Already-consumed invite code returns 409 INVITE_CODE_ALREADY_USED. No ParentChildLink written. | Must | ParentInviteCode used field |
| FR-P-014 | Expired invite code (expiresAt in the past) returns 410 INVITE_CODE_EXPIRED even if the DynamoDB TTL has not yet fired. Application-level check on expiresAt is mandatory. | Must | Application-level timestamp comparison, not reliance on TTL absence |
| FR-P-015 | Non-existent invite code returns 404 INVITE_CODE_NOT_FOUND. | Must | ParentInviteCode table read |
| FR-P-016 | Parent may link to multiple children. No Phase 1 limit. A child may have multiple parents. Both directions queryable via bidirectional GSI on ParentChildLink. | Must | ParentChildLink table, InvertedIndex GSI |
| FR-P-017 | Parent may unlink via DELETE /parent/children/{studentId}. ParentChildLink status set to "revoked". Child data is unaffected. | Must | ParentChildLink status update |

---

### 2.9 Parent Dashboard

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-P-020 | GET /parent/children/{studentId}/progress returns: last7Days (worksheetsAttempted, averageScore, totalTimeSpentSeconds), last30Days (same), overallAccuracy, needsAttention (topics where accuracy < 60% across 3+ attempts). Returns 403 CHILD_NOT_LINKED for unlinked or revoked ParentChildLink. | Must | ParentChildLink verification, UserProgress table (M04), WorksheetAttempt table (M04) |
| FR-P-021 | GET /parent/children/{studentId}/assignments returns all active teacher assignments for the child: assignmentId, title, className, teacherName, dueDate, status, score (null if not submitted or test mode pre-submission). Returns 403 CHILD_NOT_LINKED for unlinked studentId. | Must | ParentChildLink verification, StudentAssignmentStatus (StudentIndex GSI), Assignment table |
| FR-P-022 | Needs-attention signal: topics where child's accuracy < 60% across 3+ attempts, sourced from UserProgress records (pre-aggregated). Response: needsAttention array with topic, currentAccuracy, attemptCount per entry. | Must | UserProgress table (M04) |
| FR-P-023 | All parent endpoints are strictly read-only. No parent endpoint may modify Student, WorksheetAttempt, UserProgress, Assignment, or StudentAssignmentStatus records. Any request body modification fields are ignored. | Must | Handler design constraint |

---

### 2.10 Multi-Child Management

| FR ID | Description | Priority | Dependencies |
|---|---|---|---|
| FR-P-030 | GET /parent/children returns list of all active linked children: studentId, displayName, gradeLevel, linkMethod, linkedAt. | Must | ParentChildLink table (primary key query by parentId) |
| FR-P-031 | Multi-child dashboard renders child-switcher at top level of UI (not in settings sub-menu). Each child's data is fully isolated. No endpoint returns combined data for multiple children. | Must | Frontend layout requirement, API design (separate per-child endpoints) |
| FR-P-032 | Revoked ParentChildLink is treated identically to no link for RBAC. Returns 403 CHILD_NOT_LINKED (not 404). | Must | ParentChildLink status = "revoked" check in RBAC utility |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| SLA | Endpoint(s) | Condition | Measurement Point |
|---|---|---|---|
| 300 ms | GET /classes/{classId}/analytics, GET /classes/{classId}/analytics/heatmap | Up to 200 students in class | API Gateway receipt to response |
| 200 ms | GET /parent/children/{studentId}/progress | needsAttention from pre-aggregated UserProgress | API Gateway receipt to response |
| 200 ms | GET /classes/{classId}/students | Up to 200 students in roster | API Gateway receipt to response |
| 150 ms | GET /student/assignments | All assignments for one student via StudentIndex GSI | API Gateway receipt to response |

All SLAs are predicated on GSI-based access patterns only. No SLA applies to a code path that uses a DynamoDB Scan. Scan operations are prohibited in all production handlers.

The analyticsHandler Lambda is provisioned at 512 MB memory specifically to support in-memory aggregation of StudentAssignmentStatus records for up to 200 students across multiple assignments in a single invocation.

---

### 3.2 Security

**Two-layer RBAC model.** Every request passes through two independent checks:
1. Lambda Authorizer: validates the JWT, confirms the role claim matches the required role for the route (teacher, parent, student). Runs before any handler is invoked.
2. Handler-level resource ownership check: verifies the authenticated user's identity matches the specific resource being requested (Class.teacherId, ParentChildLink.parentId, StudentAssignmentStatus.studentId). The Lambda Authorizer alone cannot perform this check.

**Enumeration prevention.** Three categories of endpoint must return 403 (never 404) to prevent probing for valid IDs:
- Parent accessing any unlinked studentId via GET /parent/children/{studentId}/* must return 403 CHILD_NOT_LINKED whether or not the studentId exists.
- Student accessing any assignmentId not assigned to them must return 403 (not 404).
- Teacher accessing a class they do not own must return 403 NOT_CLASS_OWNER (not 404).

**Invite code race condition prevention.** POST /parent/link must use a DynamoDB conditional update with ConditionExpression: attribute_exists(PK) AND used = :false. Two simultaneous requests for the same code will produce one success and one ConditionalCheckFailedException. The ConditionalCheckFailedException maps to 409 INVITE_CODE_ALREADY_USED. No optimistic locking pattern is sufficient; only the DynamoDB conditional write is.

**Invite code non-guessability.** The 6-character code space with the filtered character set (A–Z minus O and I, 0–9 minus 0 and 1 = 32 characters) provides 32^6 = approximately 1.07 billion combinations. Combined with 48-hour TTL expiry and single-use enforcement, this is accepted as sufficient for Phase 1.

**Logging constraints.** No student PII (name, email, grade level) may appear in CloudWatch Logs. All log entries must use only opaque identifiers: userId, classId, assignmentId, reviewId. This constraint applies to all five M05 Lambda handlers.

**Atomic operations.** Four specific operations require atomicity via DynamoDB conditional writes:
- Invite code consumption (used = false condition on ParentInviteCode write)
- Student invite code invalidation when a new code is generated (mark previous used = true before writing new record)
- studentCount increment on class join (atomic counter via DynamoDB UpdateItem with ADD)
- studentCount decrement on student removal (atomic counter via DynamoDB UpdateItem with ADD -1)

---

### 3.3 Accessibility

The frontend components for M05 (teacher dashboard, parent dashboard, student assignment list) must meet WCAG 2.1 AA standards. Specific requirements driven by M05's visual complexity:
- The topic-by-student heatmap must not rely solely on colour to convey information. Each cell must include a tooltip or accessible label with the numeric accuracy value.
- The review queue pending count badge must be readable by screen readers. It must not be conveyed exclusively through a visual badge colour.
- The child-switcher must be keyboard-navigable.

---

### 3.4 Scalability

- All DynamoDB access patterns must be GSI-based. No table scans in production code paths.
- StudentAssignmentStatus table must be provisioned with both GSIs (StudentIndex and ClassAssignmentIndex) from the first CDK deploy. Adding a GSI retroactively requires a table backfill and performance degradation window. Deferral is not permitted.
- LearnfyraClasses must have the InviteCodeIndex GSI from initial provisioning. Scan-based invite code lookup is unacceptable beyond 100 active classes.
- The system is designed to support 500 students per class without performance degradation. This is achieved by always querying StudentAssignmentStatus by assignmentId (primary key) rather than by classId.
- Soft class size cap of 300 students is the suggested default (OQ-2). If adopted, a 422 CLASS_AT_CAPACITY response at POST /student/classes/join enforces it when studentCount >= 300.

---

### 3.5 COPPA Compliance

Students in Grades 1–4 are typically under 13 years old. M05 must not introduce any data pattern that conflicts with COPPA requirements:
- No student PII beyond displayName and gradeLevel may be stored in M05 tables. Email addresses are stored only in the M01 Cognito User Pool for authentication.
- No student PII may appear in CloudWatch Logs, DynamoDB Streams, or any intermediate data layer.
- All WorksheetAttempt, StudentAssignmentStatus, and UserProgress records for a minor student must be purgeable on parental request by a targeted delete-by-studentId operation. The data model must not prevent this. This is a design constraint for Phase 1, not a Phase 1 feature.
- The teacher-initiated parent invite flow (FR-T-062) is specifically designed to support Grades 1–4 where students cannot manage their own account settings. This flow must function without the student's direct involvement beyond their account existing.
- COPPA compliance ownership sits with the M06 Infrastructure and CDK module. M05 must not introduce any storage pattern that contradicts M06's compliance posture.

---

### 3.6 Data Isolation

The data isolation model must prevent all five of the following cross-boundary reads:
1. A Teacher may never read data for a class they do not own.
2. A Parent may never read data for a child they are not linked to via an active ParentChildLink.
3. A Student may never read another student's progress data or assignment scores.
4. A Parent with multiple children must never see combined cross-child data in a single response. Each child is a separate API request.
5. Class analytics (heatmap, overview) must never expose one student's individual performance to another student. Only the owning teacher may see per-student breakdown.

---

## 4. Edge Cases and Constraints

### 4.1 Race Condition: Invite Code Consumption

**Scenario:** Two parents simultaneously submit POST /parent/link with the same valid invite code.

**Constraint:** The handler must use a DynamoDB UpdateItem with ConditionExpression `used = :false`. The first request updates the record and receives a success. The second request receives a ConditionalCheckFailedException, which the handler translates to 409 INVITE_CODE_ALREADY_USED. No ParentChildLink is written for the second request.

**Not acceptable:** Performing a GetItem followed by a PutItem. This check-then-write sequence has a race window between the read and the write where both requests can pass the check and both consume the code.

**Required implementation reference:** M5-AUTH-004.

---

### 4.2 Lazy vs Real-Time Overdue Evaluation

**Scenario:** A student's assignment passes its dueDate without submission. The StudentAssignmentStatus record still shows "not-started" or "in-progress" in DynamoDB.

**Decision (OQ-4 suggested default):** Lazy evaluation. The handler for GET /parent/children/{studentId}/assignments evaluates overdue status at read time: if dueDate < now AND status is not "submitted", the item is treated as "overdue" and the status is written back to DynamoDB to maintain consistency for subsequent reads. The handler for GET /student/assignments applies the same lazy evaluation.

**Implication:** An assignment that became overdue at 11:59 PM may show its old status until the next time either parent or student reads it. This is acceptable for Phase 1. Phase 2 will introduce an EventBridge-scheduled Lambda to perform batch overdue updates.

**Constraint:** When a Teacher explicitly closes an assignment via DELETE /assignments/{assignmentId}/close, all affected StudentAssignmentStatus records must be updated eagerly (not lazily) to status = "overdue" as part of the close operation. The close path is synchronous and fully committed before the 200 response is returned.

---

### 4.3 Class Archival Behaviour

**What changes on archive:**
- Class record status = "archived", archivedAt timestamp set.
- Class does not appear in GET /classes (active list).
- Students cannot join the class (invite code returns 404 or 409 CLASS_ARCHIVED on join attempt).
- No new assignments can be created for an archived class.

**What is preserved:**
- All ClassMembership records.
- All Assignment records (status unchanged).
- All StudentAssignmentStatus records.
- All WorksheetAttempt records for students who were in the class.
- All ReviewQueueItem records (see OQ-3 for resolution status access).
- Analytics data: GET /classes/{classId}/analytics remains accessible to the owning teacher.

**Constraint:** Archiving must not cascade-delete or cascade-modify any child records. It is a status change on the Class record only.

---

### 4.4 Student Removal Data Preservation

When a teacher removes a student via DELETE /classes/{classId}/students/{studentId}:
- ClassMembership status = "removed". This is the only record modified.
- studentCount on the Class record is decremented atomically.
- All WorksheetAttempt records for that student remain in the WorksheetAttempt table.
- All StudentAssignmentStatus records for that student and that class remain in the StudentAssignmentStatus table. They continue to appear in the teacher's class analytics for historical accuracy.
- The student's UserProgress records are unaffected.
- The student's own GET /student/assignments no longer returns assignments from the removed class.
- A removed student may rejoin the class (FR-T-018) by using the active invite code, which reactivates the existing ClassMembership record rather than creating a duplicate.

---

### 4.5 TTL-Based Cleanup vs Application-Level Checks

DynamoDB TTL expiry is not instantaneous. DynamoDB typically processes TTL deletes within 48 hours of the expiry timestamp but provides no hard guarantee. A ParentInviteCode record with a past expiresAt may still exist in DynamoDB when a parent attempts to consume it.

**Constraint:** POST /parent/link must perform an application-level check against the expiresAt field (ISO-8601 timestamp attribute) in addition to the used field. The sequence of checks is:
1. GetItem by INVITE#{code}: if item not found, return 404 INVITE_CODE_NOT_FOUND.
2. Check expiresAt < now: if true, return 410 INVITE_CODE_EXPIRED. (Do not rely on the item being absent.)
3. Check used = true: if true, return 409 INVITE_CODE_ALREADY_USED.
4. Conditional UpdateItem with ConditionExpression `used = :false`: if ConditionalCheckFailedException, return 409 INVITE_CODE_ALREADY_USED.
5. On success, write ParentChildLink record.

This five-step sequence handles both the TTL timing gap and the concurrent consumption race condition.

---

### 4.6 Analytics SLA for Large Classes (200+ Students)

**Boundary condition:** A class with 200 students and 10 assignments generates 2,000 StudentAssignmentStatus records. The analytics handler must aggregate these within 300 ms.

**Required approach:**
- Query ClassAssignmentIndex GSI (PK = classId) to retrieve all StudentAssignmentStatus records for the class. This is a single Query operation returning up to 2,000 items.
- In-memory aggregation of scores, completion rates, and topic accuracy from the result set.
- Parallel batch GetItem calls against the UserProgress table for each enrolled student (200 GetItem calls). Use DynamoDB BatchGetItem (max 100 items per call) in two batches.

**Lambda memory:** analyticsHandler is provisioned at 512 MB specifically for this in-memory aggregation workload.

**Constraint:** If the class has 500 students (the stated scalability target), the response time will exceed the 300 ms SLA with this approach. At 500 students, the analytics query is expected to take 500–800 ms. This is a known limitation of Phase 1. The SLA is formally specified as 200 students. Class size beyond 200 is outside the SLA boundary for Phase 1.

---

### 4.7 Cross-Module Integration Complexity

**M03 Scoring Engine Integration (FR-T-040):**
The M03 scoring engine is marked as done in the module status tracker. M05 requires it to be modified to:
- Accept Assignment context (classId, assignmentId) when scoring a submission.
- Output a confidence score for short-answer responses.
- Write a ReviewQueueItem record when confidence < 0.75.

This is a non-trivial change to existing production code. The Assignment context must flow from the submit request through the M04 submitHandler into the M03 scorer. The WorksheetAttempt record must carry the assignmentId field (M5-BE-036 confirms or adds this field). Any change to the M03 scorer must not affect existing non-assignment submissions (where no classId or assignmentId is present). The confidence threshold (0.75) must be configurable, not hardcoded.

**M04 Solve Session Integration (M5-BE-021, M5-BE-022):**
The M04 solveHandler must accept an optional assignmentId query parameter. When provided, the handler reads the Assignment record to enforce mode, timeLimit, and retakePolicy before creating the WorksheetAttempt. The handler also updates StudentAssignmentStatus to "in-progress" at session start. The M04 submitHandler must update StudentAssignmentStatus to "submitted" with score and submittedAt on successful submission when an assignmentId is present. These are the most risk-prone changes in M05 as they touch production solve paths.

---

## 5. Open Questions and Recommended Resolutions

### OQ-1 — Invite Code Expiry

**Question:** Should Class invite codes expire automatically after a configurable period (e.g., 30 days) if the teacher has not manually regenerated them?

**Impact if unresolved:** Invite codes are permanent until manually regenerated. A code shared publicly by a student could allow unauthorized enrollment indefinitely.

**Recommended resolution:** Do not auto-expire invite codes in Phase 1. The inviteCodeExpiresAt field is reserved on the Class record for future use. Teachers may regenerate at any time. Add optional scheduled expiry (configurable per class, via PATCH /classes/{classId}) in Phase 2.

**Decision needed from:** Product Owner.

---

### OQ-2 — Maximum Students per Class

**Question:** Is 200 students a hard cap or a soft performance target? Is there a hard cap?

**Impact if unresolved:** A class with more than 200 students will breach the 300 ms analytics SLA. A class with 1,000 students would cause Lambda timeout on analytics queries.

**Recommended resolution:** Implement a soft cap of 300 students per class enforced at POST /student/classes/join with a 422 response and error code CLASS_AT_CAPACITY when studentCount >= 300. Document the analytics SLA as applying to up to 200 students. Classes between 201 and 300 students will receive analytics responses but without a latency guarantee.

**Decision needed from:** Product Owner (cap value) and Technical Designer (whether 300 vs 200 vs 500 requires a different analytics architecture).

---

### OQ-3 — Review Queue Access for Archived Classes

**Question:** Should the teacher be able to view and resolve ReviewQueueItems for an archived class?

**Impact if unresolved:** ReviewQueueItems created before archival may be permanently inaccessible, resulting in student scores that are never reviewed and corrected.

**Recommended resolution:** GET /classes/{classId}/review-queue must return pending items for archived classes. POST /review-queue/{reviewId}/resolve must be permitted for archived class items. Archiving a class is not a reason to stop score correction. Both endpoints should check class status and bypass the "active class" guard when resolving review items.

**Decision needed from:** Product Owner (acceptable to leave pre-archival items unresolved, or must allow resolution).

---

### OQ-4 — Lazy vs Real-Time Overdue Evaluation

**Question:** Should StudentAssignmentStatus "overdue" state be set in real time (EventBridge scheduled Lambda) or lazily at read time?

**Impact if unresolved:** Inconsistent overdue status in DynamoDB until the next read. Parent or student sees incorrect status between due date passing and next fetch.

**Recommended resolution:** Lazy evaluation for Phase 1. Handlers for GET /parent/children/{studentId}/assignments and GET /student/assignments evaluate overdue status at read time (dueDate < now AND status != "submitted") and write back the updated status. Teacher-initiated close (DELETE /assignments/{assignmentId}/close) remains synchronous and eager. Add EventBridge batch update in Phase 2.

**Decision needed from:** Engineering team (acceptable consistency lag for parent and student views in Phase 1).

---

### OQ-5 — Needs-Attention Threshold Configurability

**Question:** Should the needs-attention threshold (60% accuracy, 3+ attempts) be configurable per parent or per platform?

**Impact if unresolved:** No personalisation. Thresholds may cause alert fatigue for high-performing students or insufficient alerting for others.

**Recommended resolution:** Platform-wide default (60%, 3 attempts) stored in a Config table. Per-parent configuration is Phase 2. The threshold values must not be hardcoded in the handler — they must be read from the Config table so Phase 2 can introduce per-parent overrides without a handler code change.

**Decision needed from:** Product Owner (whether Phase 1 should support any configurability or only use the hardcoded default).

---

### OQ-6 — Display Name Format for Teacher and Parent Views

**Question:** Should student surnames be hidden from teacher-facing views to comply with FERPA/COPPA guidelines?

**Impact if unresolved:** Full names of minor students may be visible in teacher dashboards and class rosters, potentially conflicting with school data privacy policies.

**Recommended resolution:** displayName is set by the user at registration and is their responsibility to configure in Phase 1. Teachers see the displayName as set by the student (or by a school admin in future). Add a school-admin-controlled name visibility setting in Phase 2. Legal review is required before M05 is shipped to schools. This recommendation must be escalated to counsel before GA launch.

**Decision needed from:** Legal / Product Owner.

---

## 6. Integration Points with Existing Modules

### 6.1 M01 — Authentication and Identity

| Integration | Direction | What M05 Needs | Status |
|---|---|---|---|
| Lambda Authorizer role enforcement | M01 provides, M05 consumes | Authorizer must recognise role = "teacher" and role = "parent" JWT claims and enforce them on M05 routes | Must be confirmed (M5-AUTH-006) |
| Cognito custom attribute | M01 provides, M05 writes | custom:role must accept "teacher" and "parent" values. If currently restricted to "student" and "admin", CDK construct must be updated before Sprint 2 | Must be confirmed (M5-AUTH-006) |
| POST /user/role/upgrade | M01 owns or M05 adds | Endpoint must allow upgrade to "teacher" or "parent" and reject downgrade from "teacher" to "student". If not in M01, it becomes a new M01 task that M05 depends on | Confirm with M01 owner |
| JWT sub as userId | M01 provides, M05 uses as primary identifier | All M05 DynamoDB records use Cognito sub as the userId. This must be consistent with M01's identity model | Confirmed (existing pattern) |

---

### 6.2 M02 — Worksheet Generator

| Integration | Direction | What M05 Needs | Status |
|---|---|---|---|
| Worksheet DynamoDB record | M02 writes, M05 reads | Worksheet record must have: worksheetId (UUID), grade, subject, topic, difficulty, questionCount, title. M05 uses worksheetId in Assignment records. | Confirmed (existing) |
| Worksheet savedBy field | M05 adds field to M02 record | POST /teacher/library adds savedBy (teacherId) and savedAt fields to the Worksheet record. A GSI on savedBy may be needed for GET /teacher/library — must be confirmed or added as a task | Needs GSI confirmation |
| No re-generation on assignment | Hard constraint | When teacher creates an assignment referencing a worksheetId, no call to the AI service (Bedrock/Anthropic) is made. The handler must verify worksheetId exists and use the existing record only | Must be enforced in assignmentHandler |

---

### 6.3 M03 — Online Solve and Scoring

| Integration | Direction | What M05 Needs | Status |
|---|---|---|---|
| Assignment context in solve session | M05 adds parameter to M03/M04 | GET /solve/{worksheetId} or POST /solve/start must accept an optional assignmentId query parameter. When present, the solve engine reads the Assignment record to enforce mode, timeLimit, and retakePolicy. | TODO (M5-BE-021) |
| Short-answer confidence score | M03 must output, M05 consumes | The M03 scorer must output a fuzzy-match confidence score for short-answer questions. When confidence < 0.75, the M03 scoring path must write a ReviewQueueItem. The threshold is configurable. | TODO (M5-BE-025) |
| ReviewQueueItem creation in scoring engine | M05 adds to M03 code path | scorer.js or the submit handler must write a ReviewQueueItem record including classId and assignmentId (from the Assignment context). Non-assignment submissions must not write ReviewQueueItems. | TODO (M5-BE-025) |
| Mode enforcement | M03 solve engine reads Assignment mode | Practice mode provides instant per-question feedback. Test mode hides feedback until full submission. Mode is set on the Assignment record, not on the WorksheetAttempt. | TODO (M5-BE-021) |
| Retake policy enforcement | M03 solve engine reads Assignment retakePolicy | Before creating a new WorksheetAttempt, the solve engine checks the retakePolicy on the Assignment and the existing attempt history. | TODO (M5-BE-021) |

---

### 6.4 M04 — Progress Tracking

| Integration | Direction | What M05 Needs | Status |
|---|---|---|---|
| WorksheetAttempt table | M04 owns, M05 reads and extends | WorksheetAttempt records must include an assignmentId field (nullable) to support the StudentAssignmentStatus join. M5-BE-036 confirms or adds this field. | Needs field confirmation |
| UserProgress table | M04 owns, M05 reads | M05 analytics (heatmap, overview, parent needs-attention) reads UserProgress records by userId. The table must have DynamoDB Streams enabled from initial provisioning (architectural constraint in Section 2.3). | DynamoDB Streams must be confirmed in M04 CDK construct |
| M04 submitHandler extension | M05 extends M04 | On submission with an assignmentId present, the M04 submitHandler must write the StudentAssignmentStatus record to status = "submitted" with score and submittedAt. | TODO (M5-BE-022) |
| GET /student/progress response schema | M04 defines, M05 reuses | GET /classes/{classId}/students/{studentId}/progress (teacher view) must return the same response structure as M04's GET /student/progress. M05 does not define a new progress schema. | Depends on M04 schema being stable |
| DynamoDB Streams on UserProgress | M04 must enable, M05 architectural constraint | Streams must be enabled with StreamViewType: NEW_AND_OLD_IMAGES at the time the UserProgress table CDK construct is deployed. Phase 2 email notification Lambda will attach to this stream without schema migration. | Must be added to M04 CDK construct if not already present |

---

### 6.5 M06 — CDK Infrastructure

| Integration | Direction | What M05 Needs | Status |
|---|---|---|---|
| Five new DynamoDB tables | M06 CDK stack, M05 defines schema | LearnfyraClasses, LearnfyraAssignments, LearnfyraStudentAssignmentStatus, LearnfyraParentChildLinks, LearnfyraParentInviteCodes must all be provisioned in the CDK stack. All GSIs must be present at first deploy. | TODO (M5-INF-001 through M5-INF-005) |
| ReviewQueueItems table | M06 CDK stack, M05 defines schema | LearnfyraReviewQueueItems table with ClassPendingIndex GSI. | TODO (M5-INF-015) |
| Five new Lambda functions | M06 CDK stack, M05 defines handlers | classHandler, assignmentHandler, reviewHandler, analyticsHandler, parentHandler. All ARM_64, Node 18. Memory and timeout as specified per function in Section 7 of FRD. | TODO (M5-INF-009 through M5-INF-013) |
| API Gateway routes | M06 CDK stack | All M05 endpoints wired to their respective Lambda functions with Lambda Authorizer applied. | TODO (M5-INF-014) |
| PITR on prod tables | M06 CDK stack | Point-in-time recovery must be enabled on all five new tables in the prod environment. | TODO |
| DynamoDB Streams on UserProgress | M04 CDK construct (owned by M06) | Must be confirmed or added before M05 analytics and review cascade features are deployed. | TODO (M5-INF-006) |
| CloudWatch alarms | M06 monitoring construct | Error rate > 1% and p99 latency alarms for all five M05 Lambda functions. Latency threshold: > 2s for analyticsHandler, > 500ms for all others. | TODO (M5-INF-016) |
| Local bootstrap script (SETUP-002) | M06 tooling | scripts/bootstrap-local-db.js must create all five M05 tables in DynamoDB local with all GSIs. This must complete before any local development testing begins. | TODO (M5-INF-008) |

---

## 7. Data Model Summary

### 7.1 LearnfyraClasses-{env}

**Purpose:** Stores class entities owned by teachers.

| Key | Value |
|---|---|
| Primary Key | PK = CLASS#{classId}, SK = METADATA |
| GSI 1 — TeacherIndex | PK: teacherId, SK: createdAt, ALL projection. Access pattern: all classes for a teacher ordered by creation date. |
| GSI 2 — InviteCodeIndex | PK: inviteCode, ALL projection. Access pattern: O(1) class lookup by invite code at student join time. |

**Key attributes:** classId, teacherId, className (1–100 chars), gradeLevel (1–10, optional), subjects (enum array), inviteCode (6-char, filtered), inviteCodeExpiresAt (nullable, reserved), status (active/archived), accuracyThreshold (0–100, default 60), studentCount (atomic counter), createdAt, archivedAt (nullable).

**Relationships:** One Class to many ClassMembership records. One Class to many Assignment records. teacherId references the Users table (M01).

**Constraints:** inviteCode must be unique across all active classes. Uniqueness enforced via InviteCodeIndex GSI query before write. Collision triggers automatic regeneration. studentCount maintained via atomic UpdateItem ADD operations, never set directly.

---

### 7.2 LearnfyraAssignments-{env}

**Purpose:** Stores assignment configurations created by teachers, linking a class to a worksheet with configurable constraints.

| Key | Value |
|---|---|
| Primary Key | PK = ASSIGNMENT#{assignmentId}, SK = METADATA |
| GSI 1 — ClassIndex | PK: classId, SK: createdAt, ALL projection. Access pattern: all assignments for a class. |
| GSI 2 — ClassDueDateIndex | PK: classId, SK: dueDate, ALL projection. Access pattern: upcoming assignments for a class sorted by due date. |

**Key attributes:** assignmentId, classId, worksheetId, teacherId (denormalized for ownership checks), title (copied from Worksheet at creation time), mode (practice/test), timeLimit (seconds, nullable), dueDate (nullable), openAt (nullable), closeAt (nullable), retakePolicy (unlimited/limited/once), retakeLimit (required when retakePolicy = "limited"), status (active/closed/archived), createdAt, closedAt (nullable).

**Relationships:** Many Assignments to one Class. Many Assignments to one Worksheet (M02/M03). One Assignment to many StudentAssignmentStatus records.

**Constraints:** teacherId is denormalized from the Class record at assignment creation time to avoid a Class lookup on every assignment-scoped ownership check. openAt must be before closeAt when both are set. timeLimit minimum is 60 seconds. retakeLimit is only valid when retakePolicy = "limited".

---

### 7.3 LearnfyraStudentAssignmentStatus-{env}

**Purpose:** The critical join record between Assignments and students. Tracks each student's status, progress, and final score for each assignment they have been assigned. Used by teacher analytics, parent homework view, and student assignment list. Must not be derived at query time.

| Key | Value |
|---|---|
| Primary Key | PK = ASSIGNMENT#{assignmentId}, SK = STUDENT#{studentId} |
| GSI 1 — StudentIndex | PK: studentId, SK: assignmentId, ALL projection. Access pattern: all assignments for a given student (student dashboard, parent view). |
| GSI 2 — ClassAssignmentIndex | PK: classId, SK: assignmentId, ALL projection. Access pattern: all StudentAssignmentStatus records for a class across all assignments (class-level completion rate, analytics aggregation). |

**Key attributes:** assignmentId, studentId, classId (denormalized for class-level queries), status (not-started/in-progress/submitted/overdue), attemptId (nullable, set when WorksheetAttempt is created), score (nullable, set on submission), totalPoints (nullable, copied from Worksheet), submittedAt (nullable), updatedAt.

**Relationships:** One StudentAssignmentStatus record per student per assignment. References Assignment (by assignmentId) and WorksheetAttempt (by attemptId). classId is denormalized from the Assignment record.

**Critical write constraints:** Must be written atomically for all enrolled students when an assignment is created. Must be written for active assignments when a student joins a class. Must be written with status = "in-progress" when a solve session starts (M04 solveHandler integration). Must be written with status = "submitted" and score on submission (M04 submitHandler integration). Must be updated by score override cascade (reviewHandler).

**Scalability note:** Both GSIs must be provisioned at table creation. Adding GSIs retroactively requires a backfill operation with performance impact. This is a hard constraint per the FRD.

---

### 7.4 LearnfyraParentChildLinks-{env}

**Purpose:** Stores the bidirectional relationship between parent users and the student accounts they are linked to.

| Key | Value |
|---|---|
| Primary Key | PK = USER#{parentId}, SK = CHILD#{childId} |
| GSI 1 — InvertedIndex (ChildToParentIndex) | PK: childPK = USER#{childId}, SK: parentSK = PARENT#{parentId}, ALL projection. Access pattern: all parents linked to a given child (required for teacher-initiated invite validation and future notification targeting). |

**Key attributes:** parentId, childId, linkedAt, linkMethod (student-invite/teacher-invite), status (active/revoked), revokedAt (nullable).

**Relationships:** Many-to-many between parent Users and student Users. One parent may link to many children. One child may have many parents. Querying from parentId uses the primary key. Querying from childId uses the InvertedIndex GSI.

**RBAC constraint:** Any parent endpoint performing a data access must first query this table to verify an active link (status = "active") exists between the authenticated parentId (JWT sub) and the requested childId. A revoked link is treated identically to no link. Returns 403 CHILD_NOT_LINKED in both cases — never 404.

---

### 7.5 LearnfyraParentInviteCodes-{env}

**Purpose:** Short-lived, single-use tokens that authorise a parent to link to a specific student account. Auto-cleaned by DynamoDB TTL.

| Key | Value |
|---|---|
| Primary Key | PK = INVITE#{code}, SK = METADATA |
| GSIs | None. All access is by primary key (code value). |
| TTL Attribute | ttl (Number, Unix epoch integer). DynamoDB auto-expires unconsumed records. Sole cleanup mechanism — no scheduled job. |

**Key attributes:** code (raw invite code string), initiatedBy (userId of student or teacher who generated the code), targetStudentId, linkMethod (student-invite/teacher-invite), createdAt, expiresAt (ISO-8601 string, for display), ttl (Unix epoch integer = createdAt + 172800 seconds), used (Boolean, set atomically to true on consumption).

**Relationships:** One ParentInviteCode record maps to one targetStudentId. Consumption produces one ParentChildLink record.

**Critical constraints:**
- The ttl attribute must be configured as the DynamoDB TTL attribute on the table (not expiresAt, which is a string and not compatible with DynamoDB TTL requirements).
- The used field must be written atomically using a conditional update. This is the race condition prevention mechanism.
- The handler must perform an application-level check on expiresAt at read time, not rely on the record's absence after TTL fires.
- When a student generates a new invite code (POST /student/parent-invite), any existing unused code for that student must be invalidated (used = true) before writing the new code. This requires the student's targetStudentId to be queryable — but the table has no GSI. The recommended approach is to store the previous code in the student's Users record (or a separate attribute) so it can be invalidated by primary key without a scan.

**Open design gap:** The invalidation of prior invite codes for the same student (FR-P-010 second paragraph) requires either: (a) a GSI on targetStudentId (adds cost and complexity), or (b) storing the current active invite code reference on the student's record in the Users table (M01). This must be resolved by the Technical Designer before M5-BE-034 is implemented.

---

### 7.6 LearnfyraReviewQueueItems-{env}

**Purpose:** Stores short-answer responses flagged by the scoring engine for teacher review. Separate table from the five core M05 tables but provisioned as part of M05.

| Key | Value |
|---|---|
| Primary Key | PK = REVIEW#{reviewId}, SK = METADATA |
| GSI 1 — ClassPendingIndex | PK: classId, SK: status, KEYS_ONLY projection. Access pattern: all pending items for a class (filtered to status = "pending"). |

**Key attributes:** reviewId, assignmentId, classId, studentId, attemptId, questionNumber, questionText, studentAnswer, expectedAnswer, systemConfidenceScore, currentScore, pointsPossible, status (pending/resolved), createdAt, resolvedAt (nullable), resolvedBy (nullable), overrideScore (nullable).

**Relationships:** One ReviewQueueItem per flagged short-answer response per attempt. References WorksheetAttempt (by attemptId), Assignment (by assignmentId), and Class (by classId).

**Write path:** Created by the M03 scoring engine when fuzzy-match confidence < configurable threshold (default 0.75). The scoring engine must receive Assignment context (classId, assignmentId) at submission time to populate these fields. Non-assignment submissions must not create ReviewQueueItem records.

**Cascade on override:** When a teacher overrides a score, four records are updated: (1) ReviewQueueItem status = "resolved", (2) WorksheetAttempt total score recalculated, (3) UserProgress topic accuracy recalculated, (4) StudentAssignmentStatus score updated. The cascade must be implemented as a sequence of conditional writes with compensating logic if any step fails after the first. Full DynamoDB transactions (TransactWriteItems) should be evaluated by the Technical Designer as an alternative to compensating writes.

---

## 8. API Endpoint Inventory

The following table provides a complete inventory of all M05 API endpoints for reference by Technical Designer and DEV agents.

### 8.1 Teacher Endpoints

| Method | Path | Lambda | Auth Role | Priority |
|---|---|---|---|---|
| POST | /classes | classHandler | teacher | P1 |
| GET | /classes | classHandler | teacher | P1 |
| GET | /classes/{classId} | classHandler | teacher | P1 |
| PATCH | /classes/{classId} | classHandler | teacher | P2 |
| DELETE | /classes/{classId}/archive | classHandler | teacher | P1 |
| POST | /classes/{classId}/invite | classHandler | teacher | P1 |
| GET | /classes/{classId}/students | classHandler | teacher | P1 |
| DELETE | /classes/{classId}/students/{studentId} | classHandler | teacher | P1 |
| POST | /classes/{classId}/students/{studentId}/parent-invite | classHandler | teacher | P1 |
| POST | /teacher/library | classHandler | teacher | P1 |
| GET | /teacher/library | classHandler | teacher | P1 |
| DELETE | /teacher/library/{worksheetId} | classHandler | teacher | P2 |
| POST | /assignments | assignmentHandler | teacher | P1 |
| GET | /assignments/{assignmentId} | assignmentHandler | teacher | P1 |
| GET | /classes/{classId}/assignments | assignmentHandler | teacher | P1 |
| PATCH | /assignments/{assignmentId} | assignmentHandler | teacher | P2 |
| DELETE | /assignments/{assignmentId}/close | assignmentHandler | teacher | P1 |
| GET | /classes/{classId}/review-queue | reviewHandler | teacher | P1 |
| POST | /review-queue/{reviewId}/resolve | reviewHandler | teacher | P1 |
| GET | /classes/{classId}/analytics | analyticsHandler | teacher | P1 |
| GET | /classes/{classId}/analytics/heatmap | analyticsHandler | teacher | P1 |
| GET | /classes/{classId}/students/{studentId}/progress | analyticsHandler | teacher | P1 |

### 8.2 Parent Endpoints

| Method | Path | Lambda | Auth Role | Priority |
|---|---|---|---|---|
| POST | /parent/link | parentHandler | parent | P1 |
| GET | /parent/children | parentHandler | parent | P1 |
| DELETE | /parent/children/{studentId} | parentHandler | parent | P1 |
| GET | /parent/children/{studentId}/progress | parentHandler | parent | P1 |
| GET | /parent/children/{studentId}/assignments | parentHandler | parent | P1 |

### 8.3 Student Endpoints (New, M05-Driven)

| Method | Path | Lambda | Auth Role | Priority |
|---|---|---|---|---|
| POST | /student/parent-invite | classHandler or parentHandler | student | P1 |
| POST | /student/classes/join | classHandler | student | P1 |
| GET | /student/assignments | assignmentHandler | student | P1 |
| GET | /student/assignments/{assignmentId} | assignmentHandler | student | P1 |
| POST | /user/role/upgrade | authHandler (M01) | student | P1 |

### 8.4 Lambda Function Configuration Summary

| Lambda | Memory | Timeout | Reason |
|---|---|---|---|
| learnfyra-class-{env} | 256 MB | 15 s | Class CRUD, invite code generation, roster, library |
| learnfyra-assignment-{env} | 256 MB | 15 s | Assignment CRUD, StudentAssignmentStatus fan-out |
| learnfyra-review-{env} | 256 MB | 15 s | Review queue listing and cascade resolution |
| learnfyra-analytics-{env} | 512 MB | 15 s | In-memory aggregation of up to 200 students x 10 assignments |
| learnfyra-parent-{env} | 256 MB | 15 s | Parent linking, child progress and assignment views |

All functions: ARM_64 architecture, Node.js 18, esbuild bundling (minify: true, externalModules: @aws-sdk/*), X-Ray tracing enabled on staging and prod, context.callbackWaitsForEmptyEventLoop = false.

---

## 9. Testing Guidance for QA Agent

### 9.1 Boundary Values Required in All Tests

| Boundary | Why |
|---|---|
| Grade 1 | Youngest students. Minimal UserProgress data. Tests that analytics return correct null cells, not errors, for students with no topic data. |
| Grade 10 | Maximum grade. Full topic coverage. Tests analytics with dense data. |
| 5 questions | Minimum meaningful worksheet. Tests assignment creation and StudentAssignmentStatus fan-out at low volume. |
| 30 questions | Maximum worksheet. Tests ReviewQueueItem creation volume when all questions are short-answer at low confidence. |
| 1 student in class | Minimum roster. Tests analytics with a single data point — heatmap must render a 1-row matrix, not error. |
| 200 students in class | SLA boundary. Analytics response must meet 300 ms. Assert response time in performance tests. |
| className = 1 character | Minimum length. Must be accepted. |
| className = 100 characters | Maximum length. Must be accepted. |
| className = 101 characters | One over maximum. Must return 400 VALIDATION_ERROR. |
| timeLimit = 60 seconds | Minimum permitted. Must be accepted. |
| timeLimit = 59 seconds | One below minimum. Must return 400 VALIDATION_ERROR. |
| retakeLimit = 1 | Minimum permitted when retakePolicy = "limited". |
| accuracyThreshold = 0 | Edge case: all students are above threshold regardless of scores. |
| accuracyThreshold = 100 | Edge case: all students are below threshold regardless of scores. |

### 9.2 Security Test Cases (Non-Negotiable)

- Teacher A cannot access Teacher B's class. Returns 403, not 404.
- Parent with no links cannot access any student's data. Returns 403 CHILD_NOT_LINKED, not 404.
- Parent with a revoked link returns 403 CHILD_NOT_LINKED, same response body as no link (enumeration prevention).
- Student accessing an assignment not assigned to them returns 403, not 404.
- Two simultaneous POST /parent/link requests for the same code: one succeeds, one returns 409. Verify only one ParentChildLink is written.
- Expired invite code (expiresAt in the past, record still exists due to TTL lag) returns 410, not 404 or 200.

### 9.3 Cascade Test Requirements

The score override cascade (FR-T-043) must be tested as an integration test, not a unit test, because it touches four separate DynamoDB tables. The integration test must verify:
1. ReviewQueueItem status = "resolved" after override.
2. WorksheetAttempt totalScore increased by the difference between original score and overrideScore.
3. UserProgress topic accuracy recalculated (not just updated to a fixed value — verify the calculation).
4. StudentAssignmentStatus score field reflects the new total.
5. All four updates are consistent — no intermediate state where three tables are updated and the fourth is not.
