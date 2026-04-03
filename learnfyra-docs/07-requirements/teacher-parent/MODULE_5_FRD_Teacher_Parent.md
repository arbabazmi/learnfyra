# Module 5 — Functional Requirements Document
## Teacher & Parent Roles

| Field | Value |
|---|---|
| Module | M05 — Teacher & Parent Roles |
| Version | 1.0 |
| Date | 2026-04-02 |
| Status | Draft |
| Prepared By | BA Agent |
| Depends On | M01 Auth & Identity, M02 Worksheet Generator, M03 Online Solve, M04 Progress Tracking, M06 Infrastructure & CDK |
| Supersedes | M06 Class Management README (class management is now formally owned by M05) |

### Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-04-02 | BA Agent | Initial draft — Teacher and Parent role specification |

---

## 1. Executive Summary

Module 5 introduces two relational roles to the Learnfyra platform: Teacher and Parent. These roles differ fundamentally from the Student and Guest roles defined in earlier modules because their value is not derived from individual learning activity but from the relationships they hold with other users. A Teacher's value is in orchestrating a cohort of learners, tracking their progress across curriculum topics, and delivering structured assignments with configurable constraints. A Parent's value is in maintaining informed visibility into their child's academic activity without requiring their child's direct involvement in sharing data. Both roles require authenticated identity because anonymous relationship management is incoherent — you cannot be a teacher of a class without being identifiable as the owner of that class, and you cannot be a parent of a child without having a verifiable link to that child's account.

Module 5 builds directly on the authentication infrastructure of M01, the worksheet generation capabilities of M02 and M03, and the progress data produced by M04. The new DynamoDB tables introduced by M05 — Class, Assignment, StudentAssignmentStatus, ParentChildLink, and ParentInviteCode — extend the existing data model without replacing any of it. The StudentAssignmentStatus table is the most critical new record: it is the join between assignments and attempts that makes class-level analytics and parent homework tracking possible without expensive scan operations. All M05 features assume that Modules 1 through 4 and the Module 6 CDK infrastructure are complete and stable.

---

## 2. Scope

### 2.1 In-Scope (Phase 1)

**Teacher capabilities:**
- Role registration and upgrade from Student to Teacher
- Class creation with grade level and subject configuration
- Class invite code generation and lifecycle management
- Student roster management including removal
- Saved worksheet library management (reuse of generated worksheets)
- Assignment creation with full configuration: mode, time limit, due date, availability window, retake policy
- Short-answer review queue: surfacing, approval, and score override with cascade updates
- Class progress dashboard: overview panel (average scores, completion rate, weak topics, students below threshold)
- Topic-by-student accuracy heatmap
- Per-student progress drill-down (read-only view of the student's own progress data)
- RBAC enforcement on all class-scoped endpoints

**Parent capabilities:**
- Role registration as Parent
- Student-initiated parent invite code flow
- Teacher-initiated parent invite code flow
- Invite code consumption and parent-child link establishment
- Read-only child progress dashboard: activity summary, assignment status, needs-attention topics
- Multi-child switcher for parents with more than one linked child
- Unlinking from a child
- RBAC enforcement on all child-scoped endpoints

### 2.2 Out of Scope (Phase 2 — Deferred with Reason)

| Deferred Feature | Reason for Deferral |
|---|---|
| Teacher feedback/comments on individual attempts | Requires a comment data model and a UI thread view. Low priority relative to core analytics. |
| Bulk score approval in review queue | Batch DynamoDB write pattern needed. Phase 1 single-item approval is sufficient for initial class sizes. |
| PDF/CSV report export for teachers | Puppeteer-based export adds Lambda memory and cold start complexity. Analytics dashboard is sufficient for Phase 1. |
| School admin role above teacher | Requires a multi-tenancy model. Out of scope for single-school MVP. |
| Multi-teacher class collaboration | Requires class co-ownership model and conflict resolution. Deferred until school admin role exists. |
| Messaging/announcements to class | Requires notification infrastructure (SES + Pinpoint or similar). Deferred to Phase 2. |
| Email digest notifications for parents | Architecture must support this without schema migration — see Section 2.3. |
| Accuracy-drop alert emails for parents | Same architectural dependency as email digest. Deferred to Phase 2. |
| Microsoft/GitHub OAuth | Additional Cognito Identity Provider configuration. Deferred. |
| MFA enforcement | Phase 1 uses password + Google OAuth only. |
| Advanced cohort analytics | Cross-class and cross-cohort analysis deferred until sufficient usage data exists. |
| Assignment extensions / per-student due date overrides | Requires per-student assignment override record. Phase 2. |
| Student self-removal from a class | Teacher-initiated removal only in Phase 1. |
| Bulk enrollment via CSV | Phase 2. |
| Class transfer (changing a class's teacher) | Not planned for Phase 1. |

### 2.3 Architectural Constraints for Deferred Features

**Email notifications (Phase 2 readiness constraint — mandatory, not optional):**

The UserProgress table write path in M04 must emit to a DynamoDB Stream. A future Lambda consumer will attach to this stream to evaluate whether a student's topic accuracy has dropped below a configurable threshold and fire via Amazon SES without requiring any schema change. This stream must be enabled on the UserProgress table at the time M04's CDK construct is created. If it is not enabled at table creation time, enabling it later requires a table update that may affect read/write capacity and will require coordination with all existing consumers. The M05 FRD records this as a hard architectural constraint even though the notification feature itself is deferred. The IaC agent must confirm DynamoDB Streams is enabled on the UserProgress table in the CDK construct before M05 work begins.

---

## 3. User Roles and Personas

**Teacher:** A Teacher is a credentialed or self-identified instructor using Learnfyra to manage one or more classes of students in Grades 1–10. Their primary motivation is instructional efficiency — they want to generate and assign targeted practice material, know which students are falling behind which topics, and act on that information quickly. Teachers are typically classroom teachers or tutors. They are comfortable using web-based tools but expect the interface to reduce administrative burden, not add to it. A Teacher is always the sole owner of their classes; they cannot share class ownership in Phase 1.

**Parent:** A Parent is a guardian who wants to monitor their child's progress on Learnfyra without directly supervising each session. Their primary motivation is accountability and early intervention — they want to know if their child is completing assigned work and whether there are recurring gaps in understanding before those gaps compound. Parents typically have limited time and need a dashboard that surfaces the most important signals immediately, without requiring them to interpret raw data. A Parent is always read-only; they cannot assign work, change scores, or interact with the learning flow on behalf of their child.

---

## 4. RBAC Matrix

| Action | Guest | Student | Teacher | Parent |
|---|---|---|---|---|
| Solve worksheet | Yes (stateless, no tracking) | Yes (tracked) | Yes (tracked) | Yes (tracked) |
| Generate worksheet | Yes | Yes | Yes | Yes |
| Create class | No | No | Yes | No |
| Assign worksheet to class | No | No | Yes — own classes only | No |
| View class roster | No | No | Yes — own classes only | No |
| View student progress | No | Self only | Yes — own class students only | Yes — own linked children only |
| Review and override short answers | No | No | Yes — own class only | No |
| Set assignment mode and timer | No | No | Yes | No |
| Archive class | No | No | Yes — own class only | No |
| Initiate parent invite code | No | Yes — for own account | Yes — for student in own class | No |
| Consume parent invite code and link | No | No | No | Yes |
| View assignment status | No | Own assignments only | All assignments in own class | Own linked child's assignments only |
| Remove student from class | No | No | Yes — own class only | No |
| Unlink from child | No | No | No | Yes — own link only |

---

## 5. Functional Requirements — Teacher

### 5.1 Role Registration and Upgrade

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-T-001 | A user with an existing Student account may request an upgrade to the Teacher role from their profile settings. The system sets the user's role field in the Users table to "teacher" upon confirmation. | Must | Given a Student JWT calls POST /user/role/upgrade with body { role: "teacher" }, when the request is processed, then the Users record for that userId has role = "teacher" and subsequent JWTs issued for that user carry the teacher role claim. |
| FR-T-002 | A new user registering via email/password or Google OAuth may select "I am a teacher" during registration. The system sets role = "teacher" on the initial Users record. | Must | Given a new user completes Cognito registration with a teacher intent flag, when the post-confirmation Lambda trigger fires, then the Users record is written with role = "teacher". |
| FR-T-003 | Role upgrade from Teacher back to Student is not permitted via self-service. Only an Admin may downgrade a role. | Must | Given a Teacher JWT calls POST /user/role/upgrade with body { role: "student" }, when the request is processed, then the response is 403 with error code ROLE_DOWNGRADE_NOT_PERMITTED. |
| FR-T-004 | The Lambda Authorizer must reject any request to a teacher-only endpoint from a JWT carrying a non-teacher role claim, returning 403 before the handler is invoked. | Must | Given a Student JWT is used to call POST /classes, when the Lambda Authorizer evaluates the request, then API Gateway returns 403 with error code INSUFFICIENT_ROLE and the handler is never invoked. |

### 5.2 Class Management

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-T-010 | A Teacher may create a named class. Required fields: className (string, 1–100 characters). Optional fields: gradeLevel (integer 1–10), subjects (array of enum values: Math, ELA, Science, Social Studies, Health). The system generates a unique classId (UUID v4) and a unique alphanumeric invite code. | Must | Given a Teacher JWT calls POST /classes with { className: "Period 3 Math", gradeLevel: 5, subjects: ["Math"] }, when the class is created, then the response includes classId (UUID v4), inviteCode (6-character alphanumeric), and a Class record exists in DynamoDB with status = "active" and teacherId matching the JWT sub. |
| FR-T-011 | The invite code generated for a new class must be exactly 6 characters, use only uppercase letters A–Z and digits 0–9, exclude visually ambiguous characters (O, 0, I, 1), and be unique across all active classes in the same environment at the time of generation. If a collision occurs, the system regenerates a new code automatically without surfacing an error to the caller. | Must | Given a code collision occurs during class creation, when the handler detects the collision by querying the Class table's inviteCode GSI, then a new code is generated and the class is written successfully with no error returned to the caller. |
| FR-T-012 | A Teacher may regenerate the invite code for one of their classes at any time. The previous invite code becomes invalid immediately upon regeneration. Students who already joined using the previous code retain their membership. | Must | Given a Teacher JWT calls POST /classes/{classId}/invite, when the invite code is regenerated, then the Class record's inviteCode field is updated to a new unique code, and GET /classes/{classId} for that teacher returns the new code. A student attempting to join using the old code after regeneration receives 404 with INVALID_JOIN_CODE. |
| FR-T-013 | A Teacher must only be able to manage classes they own. Any class-scoped endpoint must verify that the authenticated teacher's userId matches the teacherId stored on the Class record before processing the request. | Must | Given Teacher A JWT calls GET /classes/{classId} where classId belongs to Teacher B, when the ownership check runs, then the response is 403 with error code NOT_CLASS_OWNER. This criterion applies to every class-scoped endpoint in this specification without exception. |
| FR-T-014 | A Teacher may archive a class. An archived class is read-only. Its status changes to "archived" and it no longer appears in the teacher's active class list. All student membership records, assignment records, StudentAssignmentStatus records, and WorksheetAttempt records for that class are preserved. | Must | Given a Teacher JWT calls DELETE /classes/{classId}/archive, when the archive completes, then the Class record has status = "archived", the class does not appear in GET /classes for that teacher, and GET /classes/{classId}/analytics still returns the historical data for that class. |
| FR-T-015 | A Teacher may manage multiple classes simultaneously. GET /classes returns all active classes for the authenticated teacher, ordered by createdAt descending. | Must | Given a Teacher has created 3 classes, when that teacher calls GET /classes, then all 3 classes appear in the response ordered by creation time descending. |
| FR-T-016 | Students join a class by submitting the invite code via POST /student/classes/join. No teacher approval is required. The student is immediately enrolled and can see assignments. | Must | Given a Student JWT calls POST /student/classes/join with a valid inviteCode, when the request is processed, then a ClassMembership record is written for that student in that class, the class's studentCount is incremented, and the student's GET /student/assignments response includes any active assignments for that class. |
| FR-T-017 | A student who attempts to join a class they are already enrolled in must receive 409 with ALREADY_ENROLLED. No duplicate membership record is written. | Must | Given a Student is already enrolled in class X, when that student calls POST /student/classes/join with the same invite code, then the response is 409 with ALREADY_ENROLLED and the existing membership record is unchanged. |
| FR-T-018 | A student who has been removed from a class may rejoin that class using the invite code if the class is still active. The system updates the existing membership record to status = "active" rather than writing a duplicate record. | Should | Given a student has status = "removed" in a ClassMembership record for class X, when that student calls POST /student/classes/join with the active invite code for class X, then the existing membership record is updated to status = "active" with a new joinedAt timestamp, and no duplicate record is written. |

### 5.3 Worksheet Library

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-T-020 | A Teacher may save any previously generated worksheet to their personal worksheet library. Saving a worksheet marks it as reusable and associates it with the teacher's userId in the Worksheet table. | Must | Given a Teacher JWT calls POST /teacher/library with { worksheetId: "<uuid>" }, when the save is processed, then the Worksheet record is updated with a savedBy field containing the teacher's userId and a savedAt timestamp, and GET /teacher/library returns this worksheet. |
| FR-T-021 | GET /teacher/library returns all worksheets saved by the authenticated teacher, sorted by savedAt descending. Each entry includes: worksheetId, title, grade, subject, topic, difficulty, questionCount, savedAt. | Must | Given a Teacher has saved 5 worksheets, when that teacher calls GET /teacher/library, then 5 worksheets are returned with the correct metadata fields. No worksheets saved by other teachers appear in the response. |
| FR-T-022 | A Teacher may remove a worksheet from their library. Removal only disassociates the worksheet from the teacher's library; it does not delete the Worksheet record or any existing assignments using that worksheet. | Should | Given a Teacher calls DELETE /teacher/library/{worksheetId}, when the removal is processed, then GET /teacher/library no longer includes that worksheetId, but any existing Assignment records referencing that worksheetId remain intact and students can still access their attempts. |
| FR-T-023 | When a Teacher assigns a worksheet to a class, the system must use the existing Worksheet record and must not trigger a new AI generation call. This is a cost-saving hard constraint. | Must | Given a Teacher calls POST /assignments referencing a valid worksheetId, when the assignment is created, then no call to the AI generation service (Bedrock) is made, and the Assignment record references the existing Worksheet record by worksheetId. |

### 5.4 Assignment Management

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-T-030 | A Teacher may create an assignment by specifying: classId (required), worksheetId (required), mode (required: "practice" or "test"), dueDate (optional: ISO-8601 future timestamp), openAt (optional: ISO-8601 timestamp), closeAt (optional: ISO-8601 timestamp, must be after openAt if both set), timeLimit (optional: integer seconds, minimum 60), retakePolicy (required: "unlimited", "limited", or "once"). If retakePolicy = "limited", a retakeLimit integer field (minimum 1) is also required. | Must | Given a Teacher JWT calls POST /assignments with valid parameters, when the assignment is created, then an Assignment record is written with a UUID assignmentId, status = "active", and StudentAssignmentStatus records are written for each currently enrolled student in the class with status = "not-started". |
| FR-T-031 | When an assignment is created, a StudentAssignmentStatus record must be written for every student currently enrolled in the class. The initial status for each record is "not-started". This write must occur atomically as part of the assignment creation flow — it is not a deferred or async operation. | Must | Given an assignment is created for a class with 25 enrolled students, when the assignment creation completes, then exactly 25 StudentAssignmentStatus records exist for that assignmentId, each with status = "not-started" and the correct studentId. |
| FR-T-032 | When a new student joins a class that has active assignments, StudentAssignmentStatus records must be created for that student for all active assignments in that class at the time of joining. The initial status is "not-started". | Must | Given Class X has 3 active assignments, when a new student joins Class X via invite code, then 3 StudentAssignmentStatus records are created for that student, one per active assignment, each with status = "not-started". |
| FR-T-033 | Assignment mode ("practice" or "test") set by the teacher overrides any student preference. In "practice" mode, the solve engine provides instant per-question feedback. In "test" mode, the score and correct answers are hidden until the student submits. The assignment mode is enforced by the solve engine (M03) when it reads the Assignment record at the start of a solve session. | Must | Given an assignment has mode = "test" and a student opens that assignment, when the student answers questions, then no per-question feedback is shown until the student submits the full attempt. |
| FR-T-034 | If a timeLimit is set on an assignment, the solve engine must enforce that limit and auto-submit the student's current answers when the timer reaches zero. The timeLimit value is read from the Assignment record by the solve engine at session start. | Must | Given an assignment has timeLimit = 300 seconds and a student starts a solve session, when 300 seconds elapse, then the attempt is auto-submitted with whatever answers the student has entered, and the StudentAssignmentStatus record is updated to status = "submitted". |
| FR-T-035 | If openAt is set on an assignment, students must not be able to access the assignment before that timestamp. If closeAt is set, students must not be able to access the assignment after that timestamp. Attempts to access outside the window return 403 with ASSIGNMENT_NOT_AVAILABLE. | Must | Given an assignment has openAt = T+1hour and a student calls GET /student/assignments/{assignmentId} at time T, then the response is 403 with ASSIGNMENT_NOT_AVAILABLE. Given the same assignment is accessed at T+2hours, then the assignment is accessible. |
| FR-T-036 | A Teacher may update an assignment's configuration (mode, timeLimit, dueDate, openAt, closeAt, retakePolicy) only before the assignment's openAt timestamp. After openAt has passed, the assignment is locked and configuration changes are rejected with 409 ASSIGNMENT_ALREADY_OPEN. | Should | Given an assignment has openAt in the past, when a Teacher calls PATCH /assignments/{assignmentId} to change any configuration field, then the response is 409 with ASSIGNMENT_ALREADY_OPEN and no fields are updated. |
| FR-T-037 | A Teacher may close an active assignment before its closeAt timestamp by calling DELETE /assignments/{assignmentId}/close. Closing sets the assignment status to "closed". Students who have not submitted are moved to status = "overdue" in StudentAssignmentStatus. No new solve sessions may be started for a closed assignment. | Must | Given a Teacher calls DELETE /assignments/{assignmentId}/close, when the close completes, then the Assignment record has status = "closed", all StudentAssignmentStatus records with status = "not-started" or "in-progress" for that assignment are updated to status = "overdue", and GET /student/assignments/{assignmentId} for any student returns 403 with ASSIGNMENT_CLOSED. |
| FR-T-038 | A Teacher may view all assignments for a given class via GET /classes/{classId}/assignments. The teacher must own the class. Assignments are returned sorted by dueDate ascending (soonest due first), with overdue assignments sorted by dueDate ascending (oldest overdue first) at the top. | Must | Given a Teacher calls GET /classes/{classId}/assignments for a class they own, when the response is returned, then all assignments for that class are included, sorted correctly, and each assignment includes its current status. A teacher calling this endpoint for a class they do not own receives 403 with NOT_CLASS_OWNER. |
| FR-T-039 | The retakePolicy on an assignment is enforced by the solve engine at attempt creation time. If retakePolicy = "once" and a submitted attempt already exists in WorksheetAttempt for that student and assignment, the solve engine returns 403 with RETAKE_NOT_PERMITTED. If retakePolicy = "limited" and the student has reached the retakeLimit, the same error is returned. | Must | Given an assignment with retakePolicy = "once" and a student who has already submitted an attempt, when that student calls POST /solve/start with that assignmentId, then the response is 403 with RETAKE_NOT_PERMITTED and no new WorksheetAttempt record is created. |

### 5.5 Short-Answer Review Queue

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-T-040 | The scoring engine (M03) must flag any short-answer question response where the fuzzy-match confidence score is below a configurable threshold (default: 0.75). A flagged response must create a ReviewQueueItem record associated with the attemptId, questionNumber, studentId, classId, and assignmentId. | Must | Given a student submits a short-answer response with fuzzy-match confidence = 0.60, when the scoring engine processes the submission, then a ReviewQueueItem record is written with status = "pending" and the item appears in GET /classes/{classId}/review-queue for the teacher of that class. |
| FR-T-041 | The teacher's review queue must be prominently surfaced on the teacher dashboard, not placed in a sub-menu. GET /classes/{classId}/review-queue returns all pending ReviewQueueItems for that class, each including: reviewId, studentName, questionText, studentAnswer, expectedAnswer, systemConfidenceScore, currentScore, pointsPossible, attemptId. | Must | Given a class has 3 pending review items, when the teacher views their dashboard for that class, then the review queue count (3) is visible in the primary dashboard view without additional navigation. GET /classes/{classId}/review-queue returns all 3 items with the required fields. |
| FR-T-042 | A Teacher may resolve a ReviewQueueItem by calling POST /review-queue/{reviewId}/resolve with a body specifying action = "approve" (accept the system score) or action = "override" with an overrideScore (integer, 0 to pointsPossible inclusive). | Must | Given a Teacher calls POST /review-queue/{reviewId}/resolve with { action: "approve" }, when the resolution is processed, then the ReviewQueueItem status changes to "resolved", the WorksheetAttempt total score is not changed, and the StudentAssignmentStatus record for that student and assignment reflects the existing score. |
| FR-T-043 | When a Teacher overrides a score (action = "override"), the following cascade must occur atomically or with compensating writes: (1) the ReviewQueueItem is marked "resolved" with the overrideScore, (2) the WorksheetAttempt total score is recalculated with the new score for that question, (3) the UserProgress record for the student is updated to reflect the corrected accuracy for the relevant topic, (4) the StudentAssignmentStatus record for that student and assignment is updated with the new score. | Must | Given a Teacher calls POST /review-queue/{reviewId}/resolve with { action: "override", overrideScore: 1 } for a question that was previously scored 0, when the cascade completes, then the WorksheetAttempt total score has increased by 1, the UserProgress topic accuracy for the relevant topic has been recalculated, and the StudentAssignmentStatus score field reflects the new total. |
| FR-T-044 | A Teacher must only be able to resolve ReviewQueueItems belonging to their own classes. Attempting to resolve an item from another teacher's class returns 403 with NOT_CLASS_OWNER. | Must | Given Teacher A calls POST /review-queue/{reviewId}/resolve where the reviewId belongs to a class owned by Teacher B, when the ownership check runs, then the response is 403 with NOT_CLASS_OWNER. |
| FR-T-045 | A ReviewQueueItem that has been resolved cannot be re-resolved. Calling POST /review-queue/{reviewId}/resolve on an already-resolved item returns 409 with REVIEW_ALREADY_RESOLVED. | Should | Given a ReviewQueueItem has status = "resolved", when a Teacher calls POST /review-queue/{reviewId}/resolve for that item, then the response is 409 with REVIEW_ALREADY_RESOLVED and no records are modified. |

### 5.6 Class Progress Dashboard

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-T-050 | GET /classes/{classId}/analytics returns the class overview panel data for the teacher who owns the class. Required response fields: averageScorePerAssignment (array of { assignmentId, assignmentTitle, averageScore, completionRate }), completionRate (overall percentage of students who submitted before dueDate), weakestTopics (array of up to 5 topics ranked by lowest class-average accuracy, derived from UserProgress records for students in the class), studentsBelow Threshold (array of studentIds where overall accuracy is below the configurable threshold, default 60%). | Must | Given a class has 10 students and 3 assignments with varying completion rates, when GET /classes/{classId}/analytics is called by the owning teacher, then the response includes all four required sections and the studentsBelow Threshold list accurately reflects students whose class-average accuracy is below 60%. A non-owner teacher calling this endpoint receives 403 with NOT_CLASS_OWNER. |
| FR-T-051 | GET /classes/{classId}/analytics/heatmap returns a two-dimensional accuracy structure: rows indexed by studentId, columns indexed by curriculum topic, cells containing accuracy percentage (integer 0–100) computed from UserProgress records. The response must include a mapping of studentId to studentName for display purposes. Topics with no attempt data for a student are represented as null in the cell value, not zero. | Must | Given a class has 5 students and data covering 8 topics, when GET /classes/{classId}/analytics/heatmap is called by the owning teacher, then the response contains a 5-by-8 matrix where each cell is an integer 0–100 or null, and the studentNames map contains an entry for each of the 5 students. A non-owner teacher calling this endpoint receives 403 with NOT_CLASS_OWNER. |
| FR-T-052 | The analytics and heatmap query SLA is 300 milliseconds for classes with up to 200 students. This SLA must be achieved without scan operations. All analytics queries must use GSI-based access patterns against StudentAssignmentStatus (querying by classId via the classId GSI on Assignment, then by assignmentId via the primary key on StudentAssignmentStatus) and UserProgress (querying by userId). | Must | Given a class has 200 students and 10 assignments, when GET /classes/{classId}/analytics is called, then the response is returned within 300ms as measured from API Gateway receipt to response, and no DynamoDB Scan operations are used. |
| FR-T-053 | The accuracy threshold used for "students below threshold" in the overview panel must be configurable per class. The default is 60%. A Teacher may update the threshold for a class via PATCH /classes/{classId} with field accuracyThreshold (integer 0–100). | Should | Given a Teacher calls PATCH /classes/{classId} with { accuracyThreshold: 75 }, when the update is processed, then GET /classes/{classId}/analytics returns studentsBelow Threshold based on 75% accuracy, not 60%. |
| FR-T-054 | A Teacher may drill down from the heatmap to an individual student's progress view by calling GET /classes/{classId}/students/{studentId}/progress. This endpoint returns the same data structure as the student's own GET /student/progress endpoint from M04, but scoped to the authenticated teacher's ownership of the class. | Must | Given a Teacher who owns Class X calls GET /classes/{classId}/students/{studentId}/progress where studentId is enrolled in Class X, when the request is processed, then the response is identical in structure to the student's own progress view from M04. A teacher who does not own Class X receives 403 with NOT_CLASS_OWNER. A teacher who owns Class X but requests a studentId not enrolled in Class X receives 404 with STUDENT_NOT_IN_CLASS. |

### 5.7 Student Roster Management

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-T-060 | GET /classes/{classId}/students returns the current roster for the authenticated teacher's class. Each student entry includes: studentId, displayName, joinedAt, assignmentsSummary (total assigned, total submitted, total overdue), lastActiveAt, overallAccuracy. | Must | Given a class has 15 enrolled students, when a Teacher calls GET /classes/{classId}/students, then 15 student entries are returned, each with the required fields. A teacher calling this endpoint for a class they do not own receives 403 with NOT_CLASS_OWNER. |
| FR-T-061 | A Teacher may remove a student from their class via DELETE /classes/{classId}/students/{studentId}. Removal is immediate: the ClassMembership record is updated to status = "removed", the student no longer receives new assignments, and the student's class access is revoked. All historical WorksheetAttempt records and StudentAssignmentStatus records for that student are preserved. The class studentCount is decremented. | Must | Given a Teacher calls DELETE /classes/{classId}/students/{studentId}, when the removal completes, then the ClassMembership record has status = "removed", GET /classes/{classId}/students does not include that student, and GET /student/assignments for that student no longer includes assignments from that class. All previous WorksheetAttempt records for that student in that class remain in DynamoDB. |
| FR-T-062 | A Teacher may initiate a parent invite code for any student currently enrolled in one of their classes. This generates a ParentInviteCode record with linkMethod = "teacher-invite", targetStudentId = the enrolled student's id, and initiatedBy = the teacher's userId. The code expires after 48 hours. The teacher receives the invite code string to distribute out-of-band (printed or manually shared). | Must | Given a Teacher calls POST /classes/{classId}/students/{studentId}/parent-invite, when the invite code is generated, then a ParentInviteCode record exists in DynamoDB with TTL set to expiresAt = createdAt + 48 hours, linkMethod = "teacher-invite", targetStudentId = the specified studentId, and the response includes the invite code string and expiresAt timestamp. A teacher calling this endpoint for a student not in their class receives 403 with STUDENT_NOT_IN_CLASS. |

---

## 6. Functional Requirements — Parent

### 6.1 Role Registration and Linking

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-P-001 | A new user may register as a Parent during initial registration by selecting the Parent role. A Parent's Users record has role = "parent". | Must | Given a new user completes registration with role = "parent", when the post-confirmation Lambda trigger fires, then the Users record is written with role = "parent". |
| FR-P-002 | An existing user may upgrade to the Parent role from profile settings. The role field on their Users record is updated to "parent". | Must | Given a Student JWT calls POST /user/role/upgrade with { role: "parent" }, when the request is processed, then the Users record has role = "parent" and subsequent JWTs carry the parent role claim. |
| FR-P-003 | The Lambda Authorizer must reject any request to a parent-only endpoint from a JWT carrying a non-parent role claim, returning 403 before the handler is invoked. | Must | Given a Student JWT is used to call GET /parent/children, when the Lambda Authorizer evaluates the request, then API Gateway returns 403 with INSUFFICIENT_ROLE before the handler is invoked. |
| FR-P-004 | A Parent must only be able to view data for children they are explicitly linked to via a valid active ParentChildLink record. Requests referencing any studentId not linked to the authenticated parent must return 403 with CHILD_NOT_LINKED, regardless of whether that studentId exists. This prevents enumeration of student IDs. | Must | Given a Parent JWT calls GET /parent/children/{studentId}/progress for a studentId where no active ParentChildLink exists for that parent, when the RBAC check runs, then the response is 403 with CHILD_NOT_LINKED. This must be true whether or not the studentId exists in the Users table. |

### 6.2 Parent Invite Code Flows

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-P-010 | Flow A — Student-Initiated: A logged-in Student may generate a parent invite code from their profile settings. The system writes a ParentInviteCode record with initiatedBy = the student's userId, targetStudentId = the student's own userId, linkMethod = "student-invite", used = false, and expiresAt = createdAt + 48 hours. TTL is set on the expiresAt field so DynamoDB auto-expires the record if it is never consumed. No scheduled job is used for cleanup — TTL is the only cleanup mechanism. | Must | Given a Student JWT calls POST /student/parent-invite, when the invite code is generated, then a ParentInviteCode record is written with TTL = expiresAt = createdAt + 48 hours, used = false, and the response includes the invite code string and expiresAt. Calling POST /student/parent-invite again invalidates the previous code (marks it used = true) and generates a fresh code. |
| FR-P-011 | Flow B — Teacher-Initiated: A Teacher may generate a parent invite code for a specific student in one of their classes (FR-T-062). The resulting ParentInviteCode record has linkMethod = "teacher-invite", initiatedBy = the teacher's userId, and targetStudentId = the student's userId. The same TTL and single-use rules apply. | Must | Given a Teacher calls POST /classes/{classId}/students/{studentId}/parent-invite (FR-T-062), when the code is generated, then the ParentInviteCode record has linkMethod = "teacher-invite" and targetStudentId correctly set. The code expires after 48 hours via DynamoDB TTL. |
| FR-P-012 | A Parent consumes an invite code by calling POST /parent/link with the invite code string. The system validates the code: (1) the ParentInviteCode record exists, (2) used = false, (3) current time is before expiresAt. If all three pass, the system writes a ParentChildLink record with status = "active", marks the ParentInviteCode as used = true, and returns the linked child's basic profile (displayName, grade). | Must | Given a Parent JWT calls POST /parent/link with a valid, unused, unexpired invite code, when the link is established, then a ParentChildLink record is written with PK = USER#parentId and SK = CHILD#childId and a corresponding inverted GSI record, the ParentInviteCode record has used = true, and the response includes the linked child's displayName. |
| FR-P-013 | An invite code that has already been consumed (used = true) must return 409 with INVITE_CODE_ALREADY_USED when a second parent attempts to consume it. | Must | Given a ParentInviteCode has used = true, when a Parent JWT calls POST /parent/link with that code, then the response is 409 with INVITE_CODE_ALREADY_USED and no ParentChildLink is written. |
| FR-P-014 | An invite code that has expired (current time is after expiresAt) must return 410 with INVITE_CODE_EXPIRED. The DynamoDB TTL may not have fired immediately, so the handler must check the expiresAt field at application level, not rely solely on the record being absent. | Must | Given a ParentInviteCode record exists with expiresAt in the past and used = false (TTL has not yet fired), when a Parent JWT calls POST /parent/link with that code, then the response is 410 with INVITE_CODE_EXPIRED and no ParentChildLink is written. |
| FR-P-015 | An invalid invite code (no matching ParentInviteCode record) must return 404 with INVITE_CODE_NOT_FOUND. | Must | Given a Parent JWT calls POST /parent/link with a code that matches no record in the ParentInviteCode table, then the response is 404 with INVITE_CODE_NOT_FOUND. |
| FR-P-016 | A parent may link to multiple children. There is no limit on the number of children a parent can link to in Phase 1. A child may have multiple parents linked to them. The ParentChildLink table supports both directions via its bidirectional GSI design. | Must | Given a Parent has already linked to 2 children, when that parent consumes a valid invite code for a third child, then the link is established and GET /parent/children returns 3 children. |
| FR-P-017 | A parent may unlink from a child by calling DELETE /parent/children/{studentId}. The ParentChildLink record's status is set to "revoked". The parent no longer sees that child in their dashboard. The child's data is not affected. | Must | Given a Parent JWT calls DELETE /parent/children/{studentId}, when the unlink completes, then the ParentChildLink record has status = "revoked", GET /parent/children no longer includes that studentId, and the student's Users record and progress data are unchanged. |

### 6.3 Child Progress Dashboard

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-P-020 | GET /parent/children/{studentId}/progress returns the activity summary for a linked child. The response includes: last7Days (worksheetsAttempted, averageScore, totalTimeSpentSeconds), last30Days (same fields), and overallAccuracy. All data is sourced from WorksheetAttempt records and UserProgress records for the child. The parent must have an active ParentChildLink to the specified studentId or the request returns 403 with CHILD_NOT_LINKED. | Must | Given a Parent has an active link to a student who has 5 attempts in the last 7 days and 12 attempts in the last 30 days, when the Parent calls GET /parent/children/{studentId}/progress, then the response includes last7Days.worksheetsAttempted = 5 and last30Days.worksheetsAttempted = 12 with accurate averageScore values. Calling this endpoint for an unlinked studentId returns 403 with CHILD_NOT_LINKED. |
| FR-P-021 | GET /parent/children/{studentId}/assignments returns all active teacher assignments for a linked child. Each assignment entry includes: assignmentId, assignmentTitle, className, teacherName, dueDate, status (sourced from the StudentAssignmentStatus record for that child), score (null if not yet submitted or if mode = "test" and not yet submitted). The parent must have an active ParentChildLink to the specified studentId. | Must | Given a student has 4 active assignments (1 submitted, 1 in-progress, 1 not-started, 1 overdue), when their linked parent calls GET /parent/children/{studentId}/assignments, then all 4 assignments are returned with accurate status values sourced from StudentAssignmentStatus records. Calling this endpoint for an unlinked studentId returns 403 with CHILD_NOT_LINKED. |
| FR-P-022 | The parent dashboard must surface a "needs attention" signal: topics where the child's accuracy has been below 60% across three or more attempts. This is computed from UserProgress records, not calculated in real time per request. The GET /parent/children/{studentId}/progress response includes a needsAttention array of topic entries with fields: topic, currentAccuracy, attemptCount. | Must | Given a student has attempted 4 questions in topic "Fractions" with 40% accuracy, when their parent calls GET /parent/children/{studentId}/progress, then the needsAttention array includes an entry for "Fractions" with currentAccuracy = 40 and attemptCount = 4. Topics where accuracy is above 60% or where fewer than 3 attempts exist do not appear in needsAttention. |
| FR-P-023 | The parent dashboard view is strictly read-only. No parent endpoint may accept a request body that modifies any Student, WorksheetAttempt, UserProgress, Assignment, or StudentAssignmentStatus record. | Must | Given any Parent JWT is used to call any parent-namespace endpoint with a request body containing data modification fields, when the Lambda handler processes the request, then the data modification fields are ignored and no records are modified outside of ParentChildLink management. |

### 6.4 Multi-Child Management

| FR ID | Description | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-P-030 | GET /parent/children returns the list of all children linked to the authenticated parent via active ParentChildLink records. Each entry includes: studentId, displayName, gradeLevel, linkMethod (student-invite or teacher-invite), linkedAt. | Must | Given a Parent has active links to 3 children, when that parent calls GET /parent/children, then 3 entries are returned, each with the required fields. |
| FR-P-031 | For parents with multiple linked children, the dashboard frontend renders a child-switcher at the top level of the UI, not buried in settings. The API supports this by providing GET /parent/children as a top-level list endpoint. Each child's data is fully isolated — the API never returns data for multiple children in a single response. | Must | Given a Parent has 2 linked children, when the parent UI renders, then both children are accessible via the child-switcher without sub-menu navigation. Calling GET /parent/children/{childA}/progress returns only childA's data. Calling GET /parent/children/{childB}/progress returns only childB's data. No endpoint combines data across children. |
| FR-P-032 | A Parent whose ParentChildLink has status = "revoked" for a given child must not be able to access any data for that child. Revoked links are equivalent to no link for RBAC purposes. | Must | Given a ParentChildLink record has status = "revoked" for a specific child, when the parent calls GET /parent/children/{studentId}/progress, then the response is 403 with CHILD_NOT_LINKED (not 404, to prevent enumeration). |

---

## 7. Non-Functional Requirements

### 7.1 Security

- RBAC is enforced at two layers: the Lambda Authorizer (role-level, before any handler runs) and within the handler itself (resource-level, verifying ownership of the specific classId, studentId, or childId). Both layers are required. The Lambda Authorizer alone is insufficient because it cannot verify per-resource ownership.
- Enumeration of student IDs by a parent must return 403 (not 404) for all unlinked records. This prevents a parent from probing for valid student IDs by observing the difference in response codes.
- Enumeration of class IDs by non-owning teachers must return 403 (not 404) for all classes that exist but are not owned by the requesting teacher.
- All invite code validation must be performed atomically (check-then-set) to prevent a race condition where two parents consume the same code simultaneously. A DynamoDB conditional update with a condition expression on used = false is required.
- Invite codes must not be guessable. The 6-character code space (using the filtered character set) provides approximately 34^6 = 1.6 billion combinations. Combined with TTL expiry and single-use enforcement, this is considered sufficient for Phase 1.
- No student PII (name, email, grade) may be logged in CloudWatch Logs. Logging must use only opaque identifiers (userId, classId, assignmentId).

### 7.2 Performance

- GET /classes/{classId}/analytics and GET /classes/{classId}/analytics/heatmap must return within 300 milliseconds for classes with up to 200 students. This requires GSI-based queries only — no Scan operations.
- GET /parent/children/{studentId}/progress must return within 200 milliseconds. The needsAttention computation reads from the pre-aggregated UserProgress record, not from raw attempt history.
- GET /classes/{classId}/students must return within 200 milliseconds for rosters of up to 200 students.
- GET /student/assignments must return within 150 milliseconds. This query uses the studentId GSI on StudentAssignmentStatus.

### 7.3 Data Isolation

- A Teacher may never read data for a class they do not own.
- A Parent may never read data for a child they are not linked to via an active ParentChildLink.
- A Student may never read another student's progress data or assignment scores.
- Cross-child data is never returned in a single API response for parents with multiple children. Each child is a separate request.
- Class analytics never expose one student's individual data to another student. Only the teacher may see per-student data.

### 7.4 COPPA Compliance

- Students in Grades 1–4 are typically under 13. No PII beyond a display name and grade level is stored in the Users table for students. Email address is stored only for authentication purposes and is not displayed in any teacher or parent-facing view.
- No student PII is written to CloudWatch Logs, DynamoDB Streams, or any intermediate storage. Log entries use only userId, classId, and assignmentId.
- Data retention: WorksheetAttempt records and StudentAssignmentStatus records for minor students must be purgeable on parental request. The architecture must support a targeted delete by studentId across all tables. This is a design constraint, not a Phase 1 feature, but the data model must not prevent it.
- COPPA compliance is owned by the M06 Infrastructure & CDK module. M05 must not introduce any data storage pattern that contradicts M06's compliance posture.

### 7.5 Scalability

- All DynamoDB access patterns for M05 must be GSI-based. No table scans are permitted in production code paths.
- The StudentAssignmentStatus table must be modelled with its dual GSIs from the first CDK deploy. Adding a GSI to an existing DynamoDB table requires a backfill and a brief performance impact. Deferring the GSI is not an option.
- The Class table must have a GSI on inviteCode to make code lookup O(1) at join time. A scan-based join code lookup is not acceptable beyond 100 active classes.
- The system must support 500 students per class without degraded query performance. This is achieved by always querying by assignmentId (primary key of StudentAssignmentStatus) rather than scanning by classId.

### 7.6 Architectural Constraint — DynamoDB Streams for Future Email Notifications

The UserProgress table must have DynamoDB Streams enabled from the moment it is provisioned in CDK. A future Phase 2 Lambda consumer will attach to this stream to evaluate accuracy threshold events (e.g., a student's topic accuracy drops below 60% across 3+ attempts) and fire email notifications via Amazon SES. Enabling Streams on the table at creation time is a zero-cost operation with no impact on current read/write paths. Deferring it creates a table migration risk. The IaC agent must include StreamSpecification in the UserProgress table CDK construct before M04 ships.

---

## 8. Data Model Specification

### 8.1 Class Table

**Table name:** LearnfyraClasses-{env}

| Attribute | Type | Notes |
|---|---|---|
| PK | String | CLASS#{classId} |
| SK | String | METADATA |
| classId | String | UUID v4 |
| teacherId | String | Cognito sub of the owning teacher |
| className | String | 1–100 characters |
| gradeLevel | Number | Integer 1–10, optional |
| subjects | List of String | Enum values: Math, ELA, Science, Social Studies, Health |
| inviteCode | String | 6-character alphanumeric, uppercase, excludes O, 0, I, 1 |
| inviteCodeExpiresAt | String | ISO-8601, nullable — invite codes do not expire by default; this field is reserved for future forced rotation |
| status | String | Enum: active, archived |
| accuracyThreshold | Number | Integer 0–100, default 60 |
| studentCount | Number | Integer, maintained via atomic counter |
| createdAt | String | ISO-8601 |
| archivedAt | String | ISO-8601, nullable |

**GSI 1 — TeacherIndex:**
- PK: teacherId
- SK: createdAt
- Projection: ALL
- Access pattern: query all classes owned by a teacher, sorted by creation date

**GSI 2 — InviteCodeIndex:**
- PK: inviteCode
- SK: (none — inviteCode is unique enough as a hash key)
- Projection: ALL
- Access pattern: look up a class by invite code at join time (O(1), replaces scan)

### 8.2 Assignment Table

**Table name:** LearnfyraAssignments-{env}

| Attribute | Type | Notes |
|---|---|---|
| PK | String | ASSIGNMENT#{assignmentId} |
| SK | String | METADATA |
| assignmentId | String | UUID v4 |
| classId | String | References Class record |
| worksheetId | String | References Worksheet record |
| teacherId | String | Denormalized for ownership checks without Class lookup |
| title | String | Copied from Worksheet at assignment creation time |
| mode | String | Enum: practice, test |
| timeLimit | Number | Integer seconds, nullable |
| dueDate | String | ISO-8601, nullable |
| openAt | String | ISO-8601, nullable |
| closeAt | String | ISO-8601, nullable |
| retakePolicy | String | Enum: unlimited, limited, once |
| retakeLimit | Number | Integer, required only when retakePolicy = "limited" |
| status | String | Enum: active, closed, archived |
| createdAt | String | ISO-8601 |
| closedAt | String | ISO-8601, nullable |

**GSI 1 — ClassIndex:**
- PK: classId
- SK: createdAt
- Projection: ALL
- Access pattern: query all assignments for a class

**GSI 2 — ClassDueDateIndex:**
- PK: classId
- SK: dueDate
- Projection: ALL
- Access pattern: query upcoming assignments for a class sorted by due date

### 8.3 StudentAssignmentStatus Table

**Table name:** LearnfyraStudentAssignmentStatus-{env}

This is the most critical new join record in Module 5. It connects Assignment records to WorksheetAttempt records per student and is required by the teacher class progress view, the parent homework status view, and the student assignment view. It must be modelled with both GSIs from the first CDK deploy. Do not derive this data at query time — doing so requires scanning the WorksheetAttempt table by assignmentId and studentId, which degrades to O(n) at scale.

| Attribute | Type | Notes |
|---|---|---|
| PK | String | ASSIGNMENT#{assignmentId} |
| SK | String | STUDENT#{studentId} |
| assignmentId | String | UUID v4 |
| studentId | String | Cognito sub |
| classId | String | Denormalized for class-level queries |
| status | String | Enum: not-started, in-progress, submitted, overdue |
| attemptId | String | UUID v4, nullable — set when a WorksheetAttempt is created |
| score | Number | Integer, nullable — set on submission |
| totalPoints | Number | Integer, nullable — copied from Worksheet at assignment creation |
| submittedAt | String | ISO-8601, nullable |
| updatedAt | String | ISO-8601 |

**Primary key access pattern:** query all students for a given assignment (PK = ASSIGNMENT#{assignmentId}, SK begins_with STUDENT#) — used by teacher class view.

**GSI 1 — StudentIndex:**
- PK: studentId
- SK: assignmentId
- Projection: ALL
- Access pattern: query all assignments for a given student — used by student assignment view and parent homework view.

**GSI 2 — ClassAssignmentIndex:**
- PK: classId
- SK: assignmentId
- Projection: ALL
- Access pattern: query all StudentAssignmentStatus records for a class across all assignments — used by class-level completion rate calculations.

### 8.4 ParentChildLink Table

**Table name:** LearnfyraParentChildLinks-{env}

| Attribute | Type | Notes |
|---|---|---|
| PK | String | USER#{parentId} |
| SK | String | CHILD#{childId} |
| parentId | String | Cognito sub of the parent |
| childId | String | Cognito sub of the linked student |
| linkedAt | String | ISO-8601 |
| linkMethod | String | Enum: student-invite, teacher-invite |
| status | String | Enum: active, revoked |
| revokedAt | String | ISO-8601, nullable |

**GSI 1 — InvertedIndex (ChildToParentIndex):**
- PK: USER#{childId} (stored as childPK attribute for GSI)
- SK: PARENT#{parentId} (stored as parentSK attribute for GSI)
- Projection: ALL
- Access pattern: query all parents linked to a given child (required for teacher-initiated flow validation, future notification targeting)

Access pattern notes: querying by parentId uses the table's primary key directly. Querying by childId uses the InvertedIndex GSI. Both directions must be efficient because RBAC checks can arrive from either direction.

### 8.5 ParentInviteCode Table

**Table name:** LearnfyraParentInviteCodes-{env}

TTL cleanup is the only mechanism for removing unconsumed invite codes. No scheduled job or Lambda cron is used. The expiresAt attribute is configured as the TTL attribute on the DynamoDB table, and its value is a Unix epoch timestamp (integer, not ISO-8601 string), as required by DynamoDB TTL. The application-level expiresAt for display purposes may be stored as an additional ISO-8601 string attribute.

| Attribute | Type | Notes |
|---|---|---|
| PK | String | INVITE#{code} |
| SK | String | METADATA |
| code | String | The raw invite code string |
| initiatedBy | String | userId of the student or teacher who generated the code |
| targetStudentId | String | Cognito sub of the student this invite links to |
| linkMethod | String | Enum: student-invite, teacher-invite |
| createdAt | String | ISO-8601 |
| expiresAt | String | ISO-8601, for display |
| ttl | Number | Unix epoch integer — configured as the DynamoDB TTL attribute. Set to createdAt + 172800 seconds (48 hours). This is the sole cleanup mechanism. |
| used | Boolean | Set to true atomically upon successful consumption |

**No GSIs required.** All access is via the primary key (INVITE#{code}) — invite code lookup is always by code value.

---

## 9. API Endpoint Definitions

### 9.1 Teacher Endpoints

---

**POST /classes**

- Auth: Bearer token, role = teacher
- RBAC Rule: Lambda Authorizer must verify role = "teacher" before invocation. If role is absent or not "teacher", return 403 INSUFFICIENT_ROLE.
- Request body: { className: string (required, 1–100 chars), gradeLevel: number (optional, 1–10), subjects: string[] (optional) }
- Response 201: { classId: string, className: string, inviteCode: string, gradeLevel: number|null, subjects: string[], status: "active", studentCount: 0, createdAt: string }
- Response 400: { error: "VALIDATION_ERROR", message: string }
- Response 403: { error: "INSUFFICIENT_ROLE" }

---

**GET /classes**

- Auth: Bearer token, role = teacher
- RBAC Rule: Lambda Authorizer must verify role = "teacher". Response contains only classes owned by the authenticated teacher (teacherId = JWT sub).
- Request: no body
- Response 200: { classes: [{ classId, className, gradeLevel, subjects, inviteCode, status, studentCount, createdAt, pendingReviewCount }] }
- Response 403: { error: "INSUFFICIENT_ROLE" }

---

**GET /classes/{classId}**

- Auth: Bearer token, role = teacher
- RBAC Rule: Lambda Authorizer verifies role = "teacher". Handler verifies Class.teacherId = JWT sub. Return 403 NOT_CLASS_OWNER if mismatch.
- Request: no body
- Response 200: { classId, className, gradeLevel, subjects, inviteCode, status, studentCount, accuracyThreshold, createdAt, archivedAt|null }
- Response 403: { error: "NOT_CLASS_OWNER" } or { error: "INSUFFICIENT_ROLE" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**PATCH /classes/{classId}**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub.
- Request body: { accuracyThreshold: number (optional, 0–100), className: string (optional) }
- Response 200: { classId, updatedFields: string[] }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**DELETE /classes/{classId}/archive**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub. Return 403 NOT_CLASS_OWNER if mismatch.
- Request: no body
- Response 200: { classId, status: "archived", archivedAt: string }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }
- Response 409: { error: "CLASS_ALREADY_ARCHIVED" }

---

**POST /classes/{classId}/invite**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub.
- Request: no body
- Response 200: { classId, inviteCode: string (new code), updatedAt: string }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**GET /classes/{classId}/students**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub.
- Request: no body
- Response 200: { students: [{ studentId, displayName, joinedAt, status: "active"|"removed", assignmentsSummary: { total, submitted, overdue }, lastActiveAt, overallAccuracy }] }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**DELETE /classes/{classId}/students/{studentId}**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub.
- Request: no body
- Response 200: { message: "Student removed", studentId, classId }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "STUDENT_NOT_IN_CLASS" } or { error: "CLASS_NOT_FOUND" }

---

**POST /classes/{classId}/students/{studentId}/parent-invite**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub AND student is enrolled in classId.
- Request: no body
- Response 201: { inviteCode: string, targetStudentId: string, expiresAt: string, linkMethod: "teacher-invite" }
- Response 403: { error: "NOT_CLASS_OWNER" } or { error: "STUDENT_NOT_IN_CLASS" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**POST /assignments**

- Auth: Bearer token, role = teacher
- RBAC Rule: Lambda Authorizer verifies role = "teacher". Handler verifies Class.teacherId = JWT sub for the specified classId.
- Request body: { classId: string (required), worksheetId: string (required), mode: "practice"|"test" (required), dueDate: string|null (ISO-8601), openAt: string|null, closeAt: string|null, timeLimit: number|null, retakePolicy: "unlimited"|"limited"|"once" (required), retakeLimit: number (required if retakePolicy = "limited") }
- Response 201: { assignmentId, classId, worksheetId, mode, status: "active", createdAt, studentCount (number of StudentAssignmentStatus records written) }
- Response 400: { error: "VALIDATION_ERROR", message: string }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" } or { error: "WORKSHEET_NOT_FOUND" }

---

**GET /assignments/{assignmentId}**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Assignment.teacherId = JWT sub.
- Request: no body
- Response 200: { assignmentId, classId, worksheetId, title, mode, timeLimit, dueDate, openAt, closeAt, retakePolicy, retakeLimit, status, createdAt }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "ASSIGNMENT_NOT_FOUND" }

---

**GET /classes/{classId}/assignments**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub.
- Request: no body
- Response 200: { assignments: [{ assignmentId, title, mode, dueDate, status, submissionCount, totalStudents }] } sorted by dueDate ascending
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**PATCH /assignments/{assignmentId}**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Assignment.teacherId = JWT sub AND Assignment.openAt is in the future (not yet open).
- Request body: { mode, timeLimit, dueDate, openAt, closeAt, retakePolicy, retakeLimit } — all optional
- Response 200: { assignmentId, updatedFields: string[] }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "ASSIGNMENT_NOT_FOUND" }
- Response 409: { error: "ASSIGNMENT_ALREADY_OPEN" }

---

**DELETE /assignments/{assignmentId}/close**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Assignment.teacherId = JWT sub.
- Request: no body
- Response 200: { assignmentId, status: "closed", closedAt: string, studentsMarkedOverdue: number }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "ASSIGNMENT_NOT_FOUND" }
- Response 409: { error: "ASSIGNMENT_ALREADY_CLOSED" }

---

**GET /classes/{classId}/review-queue**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub.
- Request: no body
- Response 200: { pendingCount: number, items: [{ reviewId, studentName, questionNumber, questionText, studentAnswer, expectedAnswer, systemConfidenceScore, currentScore, pointsPossible, attemptId, createdAt }] }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**POST /review-queue/{reviewId}/resolve**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies the ReviewQueueItem's classId belongs to a class owned by the JWT sub (Class.teacherId = JWT sub).
- Request body: { action: "approve"|"override" (required), overrideScore: number (required only when action = "override", 0 to pointsPossible) }
- Response 200: { reviewId, action, overrideScore|null, updatedAttemptScore: number, updatedStudentAssignmentStatus: { status, score } }
- Response 400: { error: "VALIDATION_ERROR" }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "REVIEW_ITEM_NOT_FOUND" }
- Response 409: { error: "REVIEW_ALREADY_RESOLVED" }

---

**GET /classes/{classId}/analytics**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub. Reads StudentAssignmentStatus records via ClassAssignmentIndex GSI and UserProgress records via userId. No Scan operations.
- Request: no body
- Response 200: { classId, assignmentBreakdown: [{ assignmentId, title, averageScore, completionRate }], overallCompletionRate: number, weakestTopics: [{ topic, classAverageAccuracy }], studentsBelowThreshold: [{ studentId, displayName, accuracy }], accuracyThreshold: number }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**GET /classes/{classId}/analytics/heatmap**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub. Reads UserProgress records by userId for each enrolled student. No Scan operations.
- Request: no body
- Response 200: { classId, students: [{ studentId, displayName }], topics: [string], cells: { [studentId]: { [topic]: number|null } } }
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "CLASS_NOT_FOUND" }

---

**GET /classes/{classId}/students/{studentId}/progress**

- Auth: Bearer token, role = teacher
- RBAC Rule: Handler verifies Class.teacherId = JWT sub AND studentId is enrolled in classId. Returns 403 NOT_CLASS_OWNER if teacher check fails. Returns 404 STUDENT_NOT_IN_CLASS if enrollment check fails.
- Request: no body
- Response 200: Same structure as GET /student/progress from M04
- Response 403: { error: "NOT_CLASS_OWNER" }
- Response 404: { error: "STUDENT_NOT_IN_CLASS" } or { error: "CLASS_NOT_FOUND" }

---

### 9.2 Parent Endpoints

---

**POST /parent/link**

- Auth: Bearer token, role = parent
- RBAC Rule: Lambda Authorizer verifies role = "parent". Handler validates invite code atomically (conditional update on used = false).
- Request body: { inviteCode: string (required) }
- Response 201: { parentId, childId, displayName: string, gradeLevel: number|null, linkMethod: string, linkedAt: string }
- Response 403: { error: "INSUFFICIENT_ROLE" }
- Response 404: { error: "INVITE_CODE_NOT_FOUND" }
- Response 409: { error: "INVITE_CODE_ALREADY_USED" }
- Response 410: { error: "INVITE_CODE_EXPIRED" }

---

**GET /parent/children**

- Auth: Bearer token, role = parent
- RBAC Rule: Lambda Authorizer verifies role = "parent". Response contains only children with active ParentChildLink records where parentId = JWT sub.
- Request: no body
- Response 200: { children: [{ studentId, displayName, gradeLevel, linkMethod, linkedAt }] }
- Response 403: { error: "INSUFFICIENT_ROLE" }

---

**DELETE /parent/children/{studentId}**

- Auth: Bearer token, role = parent
- RBAC Rule: Handler verifies an active ParentChildLink exists for parentId = JWT sub and childId = studentId. Return 403 CHILD_NOT_LINKED if not found.
- Request: no body
- Response 200: { parentId, childId: studentId, status: "revoked", revokedAt: string }
- Response 403: { error: "CHILD_NOT_LINKED" }
- Response 404: { error: "LINK_NOT_FOUND" }

---

**GET /parent/children/{studentId}/progress**

- Auth: Bearer token, role = parent
- RBAC Rule: Handler verifies active ParentChildLink exists for parentId = JWT sub and childId = studentId. Return 403 CHILD_NOT_LINKED if not found (do not return 404 — enumeration prevention).
- Request: no body
- Response 200: { studentId, displayName, last7Days: { worksheetsAttempted, averageScore, totalTimeSpentSeconds }, last30Days: { worksheetsAttempted, averageScore, totalTimeSpentSeconds }, overallAccuracy, needsAttention: [{ topic, currentAccuracy, attemptCount }] }
- Response 403: { error: "CHILD_NOT_LINKED" } or { error: "INSUFFICIENT_ROLE" }

---

**GET /parent/children/{studentId}/assignments**

- Auth: Bearer token, role = parent
- RBAC Rule: Handler verifies active ParentChildLink for parentId = JWT sub and childId = studentId. Reads StudentAssignmentStatus records via StudentIndex GSI (PK = studentId). Return 403 CHILD_NOT_LINKED if no active link.
- Request: no body
- Response 200: { studentId, assignments: [{ assignmentId, title, className, teacherName, dueDate, status, score|null, submittedAt|null }] }
- Response 403: { error: "CHILD_NOT_LINKED" } or { error: "INSUFFICIENT_ROLE" }

---

### 9.3 Student Endpoints (New — Driven by Class Participation)

---

**POST /student/parent-invite**

- Auth: Bearer token, role = student
- RBAC Rule: Lambda Authorizer verifies role = "student". Handler generates invite for the authenticated student's own account only (targetStudentId = JWT sub). A student may not generate an invite for a different student.
- Request: no body
- Response 201: { inviteCode: string, expiresAt: string, linkMethod: "student-invite" }
- Response 403: { error: "INSUFFICIENT_ROLE" }

---

**POST /student/classes/join**

- Auth: Bearer token, role = student
- RBAC Rule: Lambda Authorizer verifies role = "student".
- Request body: { inviteCode: string (required, 6-character alphanumeric) }
- Response 200: { classId, className, teacherName, gradeLevel, joinedAt, activeAssignmentCount }
- Response 400: { error: "VALIDATION_ERROR" }
- Response 403: { error: "INSUFFICIENT_ROLE" }
- Response 404: { error: "INVALID_JOIN_CODE" }
- Response 409: { error: "ALREADY_ENROLLED" }

---

**GET /student/assignments**

- Auth: Bearer token, role = student
- RBAC Rule: Lambda Authorizer verifies role = "student". Handler reads StudentAssignmentStatus records via StudentIndex GSI (PK = studentId = JWT sub). Only records for the authenticated student are returned.
- Request: no body
- Response 200: { assignments: [{ assignmentId, title, className, mode, dueDate, openAt, closeAt, timeLimit, retakePolicy, status, score|null, submittedAt|null }] }
- Response 403: { error: "INSUFFICIENT_ROLE" }

---

**GET /student/assignments/{assignmentId}**

- Auth: Bearer token, role = student
- RBAC Rule: Handler verifies a StudentAssignmentStatus record exists for the authenticated studentId and the requested assignmentId. Return 403 if no such record exists (prevents enumeration of assignment IDs). Also enforces availability window: if current time is before openAt or after closeAt, return 403 ASSIGNMENT_NOT_AVAILABLE.
- Request: no body
- Response 200: { assignmentId, worksheetId, title, mode, timeLimit, dueDate, openAt, closeAt, retakePolicy, retakeLimit|null, status, score|null, submittedAt|null }
- Response 403: { error: "ASSIGNMENT_NOT_AVAILABLE" } or { error: "ASSIGNMENT_NOT_FOUND" }

---

## 10. User Journey Flows

### 10.1 Teacher Creates a Class and Invites Students

1. The teacher logs in with a teacher-role JWT.
2. The teacher navigates to their dashboard and selects "Create New Class".
3. The teacher enters a class name (e.g., "Period 3 Math"), selects grade level 5, and selects subject "Math".
4. The teacher submits the form. The frontend calls POST /classes.
5. The backend generates a UUID classId and a unique 6-character invite code, writes the Class record to DynamoDB, and returns the classId and inviteCode.
6. The teacher copies the invite code from the dashboard.
7. The teacher distributes the invite code to students out-of-band (verbally, written on a whiteboard, or printed).
8. Each student logs in with a student-role JWT, navigates to "Join a Class", enters the 6-character invite code, and submits.
9. The frontend calls POST /student/classes/join with the invite code.
10. The backend looks up the class via the InviteCodeIndex GSI, verifies no existing active membership for that student, writes a ClassMembership record, increments the class studentCount, and creates StudentAssignmentStatus records for any already-active assignments in the class.
11. The student sees the class appear in their class list.
12. The teacher's class roster (GET /classes/{classId}/students) now includes the new student.

### 10.2 Teacher Generates, Saves, and Assigns a Worksheet as a Timed Test

1. The teacher navigates to the worksheet generator (M03 flow) and generates a new worksheet for Grade 5 Math, topic: Fractions, difficulty: Medium.
2. The worksheet is generated and a Worksheet record is written in DynamoDB with a worksheetId.
3. The teacher reviews the worksheet and selects "Save to Library". The frontend calls POST /teacher/library with the worksheetId.
4. The backend updates the Worksheet record with savedBy = teacherId and savedAt timestamp.
5. The teacher navigates to their class "Period 3 Math" and selects "Create Assignment".
6. The teacher selects the saved worksheet from GET /teacher/library, sets mode = "test", timeLimit = 600 (10 minutes), dueDate = 7 days from today, openAt = today, and retakePolicy = "once".
7. The teacher submits the assignment form. The frontend calls POST /assignments.
8. The backend writes the Assignment record and writes a StudentAssignmentStatus record for each of the 25 enrolled students with status = "not-started".
9. Each student's GET /student/assignments response now includes the new assignment.
10. When a student opens the assignment, the solve engine reads the Assignment record, enforces mode = "test" and timeLimit = 600, and starts the solve session.

### 10.3 Teacher Resolves a Short-Answer Review Queue Item

1. The scoring engine in M03 processes a student's submission and encounters a short-answer response with fuzzy-match confidence = 0.62 (below the 0.75 threshold).
2. The scoring engine writes a ReviewQueueItem record with status = "pending", attaching the studentId, attemptId, questionNumber, questionText, studentAnswer, expectedAnswer, systemConfidenceScore = 0.62, and currentScore = 0.
3. The teacher's dashboard prominently displays a review queue badge with count 1.
4. The teacher calls GET /classes/{classId}/review-queue and sees the item.
5. The teacher reads the student's answer: "the result is 42" compared to the expected answer: "42". The teacher judges this to be correct.
6. The teacher calls POST /review-queue/{reviewId}/resolve with { action: "override", overrideScore: 1 }.
7. The backend atomically: marks the ReviewQueueItem resolved, recalculates the WorksheetAttempt total score (increments by 1), updates the UserProgress record for the relevant topic to reflect improved accuracy, and updates the StudentAssignmentStatus score for that student and assignment.
8. The review queue badge disappears for that item.
9. The student's progress data now reflects the corrected score.

### 10.4 Parent Links to a Child via Student-Initiated Invite Code

1. The student (age 12, Grade 7) logs in with a student-role JWT.
2. The student navigates to Profile Settings and selects "Generate Parent Invite Code".
3. The frontend calls POST /student/parent-invite.
4. The backend writes a ParentInviteCode record with TTL = now + 48 hours, linkMethod = "student-invite", used = false.
5. The student receives the invite code string and expiresAt timestamp.
6. The student shares the code with their parent out-of-band (text message, verbally).
7. The parent registers on Learnfyra with role = "parent" (or logs in if they already have an account).
8. The parent navigates to "Link to a Child" and enters the invite code.
9. The frontend calls POST /parent/link with the invite code.
10. The backend validates the code: record exists, used = false, current time is before expiresAt. All checks pass.
11. The backend writes a ParentChildLink record (both primary and GSI record), marks the ParentInviteCode as used = true atomically.
12. The parent is redirected to their child's dashboard.
13. GET /parent/children now returns one child entry.

### 10.5 Parent Links to a Child via Teacher-Initiated Invite Code

1. A Grade 2 student (age 7) is enrolled in class "Grade 2 Reading" and cannot manage their own account settings.
2. The teacher navigates to the class roster (GET /classes/{classId}/students) and finds the student.
3. The teacher selects "Generate Parent Invite" for that student.
4. The frontend calls POST /classes/{classId}/students/{studentId}/parent-invite.
5. The backend verifies the teacher owns the class and the student is enrolled, writes a ParentInviteCode record with linkMethod = "teacher-invite", TTL = now + 48 hours.
6. The backend returns the invite code string and expiresAt to the teacher.
7. The teacher prints the invite code and sends it home with the student in their backpack.
8. The parent registers on Learnfyra with role = "parent".
9. The parent enters the invite code via POST /parent/link.
10. The backend validates the code and establishes the ParentChildLink.
11. The parent can now view the Grade 2 student's homework status and progress.

### 10.6 Parent Views Child's Homework Status and Weak Topics

1. The parent logs in with a parent-role JWT.
2. If the parent has multiple children, a child-switcher is shown. The parent selects their child "Alice".
3. The frontend calls GET /parent/children/{aliceId}/assignments.
4. The backend reads StudentAssignmentStatus records for aliceId via the StudentIndex GSI and joins with Assignment records to retrieve titles, class names, and due dates.
5. The parent sees: 2 assignments due this week (1 submitted, 1 not-started), 1 overdue assignment.
6. The parent selects the overdue assignment to see its details (dueDate passed, status = "overdue").
7. The parent calls GET /parent/children/{aliceId}/progress.
8. The backend reads the UserProgress record for aliceId and computes the needsAttention list.
9. The parent sees the activity summary (last 7 days: 3 worksheets attempted, 72% average score) and a "needs attention" alert for "Fractions" (45% accuracy across 4 attempts).
10. The parent has a data-informed conversation with their child about Fractions practice.

---

## 11. Open Questions

| # | Question | Impact if Unresolved | Suggested Default |
|---|---|---|---|
| OQ-1 | Should the Class invite code expire automatically after a configurable period (e.g., 30 days) if the teacher has not manually regenerated it? A never-expiring code is a mild security concern if a student shares the code publicly. | If unresolved, invite codes are permanent until regenerated. This is probably acceptable for a school context. | Default: codes do not expire automatically. Teachers may regenerate at any time. Add optional scheduled expiry in Phase 2. |
| OQ-2 | What is the maximum number of students allowed in a single class? The analytics SLA assumes 200 students. Is there a hard cap or is 200 the soft performance target? | If uncapped, a class with 1,000 students could breach the 300ms analytics SLA despite GSI-based queries. | Suggested default: soft cap of 300 students per class, enforced with a 422 response at join time if studentCount >= 300, with an error code CLASS_AT_CAPACITY. |
| OQ-3 | Should a teacher be able to view the review queue for an archived class? Archived class data is preserved and read-only, so review items from before archival may still exist. | If unresolved, the review queue endpoint may return 403 or 404 for archived classes, preventing resolution of pre-archival items. | Suggested default: GET /classes/{classId}/review-queue returns pending items for archived classes (read-only). POST /review-queue/{reviewId}/resolve is permitted for archived class items. |
| OQ-4 | When a student's assignment status changes to "overdue" (either via teacher close action or due date passing), should this be a real-time trigger or a lazy evaluation? Real-time requires a scheduled Lambda or EventBridge rule. Lazy evaluation marks status as "overdue" on the next read. | If unresolved, the overdue status in StudentAssignmentStatus is inconsistent until the next read, which may show incorrect status on the parent dashboard. | Suggested default: Lazy evaluation for Phase 1 — the handler for GET /parent/children/{studentId}/assignments evaluates overdue status at read time based on dueDate < now AND status != "submitted", and writes the updated status back. Add EventBridge-driven batch update in Phase 2. |
| OQ-5 | Should the needsAttention threshold (60% accuracy across 3+ attempts) be configurable per parent or per platform? | If uncapped, parents cannot adjust sensitivity, which may lead to alert fatigue or insufficient alerting for different learning contexts. | Suggested default: platform-wide default of 60% and 3 attempts, configurable via the Config table (M07 Admin Control Plane). Per-parent configuration is Phase 2. |
| OQ-6 | What display name format is exposed to teachers and parents? The Users table stores a displayName. For minors, should surname be hidden from teacher views to comply with FERPA/COPPA guidelines? | If unresolved, full names of minors may be visible in teacher dashboards, potentially conflicting with school data policy. | Suggested default: displayName is set by the user at registration and is the user's responsibility. Add a school-admin-controlled name visibility setting in Phase 2. Consult legal before shipping to schools. |

---

## 12. Dependencies

| Dependency | Module | Status | Notes |
|---|---|---|---|
| Lambda Authorizer with role claim enforcement | M01 | DONE | Required for all M05 endpoints. Role = "teacher" and "parent" claims must be supported. |
| Cognito User Pool with role field in custom attributes | M01 | DONE | role field must support "teacher" and "parent" values in addition to "student". |
| POST /user/role/upgrade endpoint | M01 | To be confirmed | Required for FR-T-001 and FR-P-002. If not already implemented in M01, it is a new M01 task that M05 depends on. |
| Worksheet record in DynamoDB (worksheetId, grade, subject, topic, questionCount) | M02/M03 | DONE | Required by POST /assignments (worksheetId validation) and GET /teacher/library. |
| WorksheetAttempt table with studentId, worksheetId, assignmentId, totalScore, submittedAt | M04 | Done (CDK deployed per module-status.md — Lambda TODO) | M05 analytics reads WorksheetAttempt records. The assignmentId field must exist on WorksheetAttempt records to support the StudentAssignmentStatus join. |
| UserProgress table with userId, topic, accuracy, attemptCount | M04 | TODO | Required by heatmap, analytics overview, parent needs-attention, and student drill-down. Must have DynamoDB Streams enabled at table creation per Section 2.3 architectural constraint. |
| Scoring engine short-answer fuzzy-match confidence score output | M03 | TODO | Required by FR-T-040 (review queue creation). The scoring engine must output a confidence score and the M03 submit handler must write ReviewQueueItem records when confidence is below threshold. |
| DynamoDB local bootstrap script (SETUP-002) | M06 | TODO | Must be updated to include all 5 new M05 tables: LearnfyraClasses, LearnfyraAssignments, LearnfyraStudentAssignmentStatus, LearnfyraParentChildLinks, LearnfyraParentInviteCodes. |
| CDK stack for M05 tables and Lambda functions | M06 Infrastructure | TODO | All 5 new tables and the new Lambda functions (classHandler, assignmentHandler, reviewHandler, analyticsHandler, parentHandler) must be added to the CDK stack. DynamoDB Streams must be enabled on UserProgress. |
| React frontend (learnfyra-app) | Frontend | BLOCKED (UI template) | Per memory note, learnfyra-app is the active frontend. M05 frontend work must target learnfyra-app, not the old frontend/ directory. Do not start frontend work until UI template is received. |
