# Module 7: Admin Console — Task Tracker

| Field | Value |
|---|---|
| Module | Module 7: Admin Console |
| Version | 1.0 |
| Date | 2026-04-02 |
| Status | Draft |
| Prepared By | BA Agent |
| Source FRD | MODULE_7_FRD_Admin.md v1.0 |

---

## Task ID Convention

| Prefix | Layer |
|---|---|
| M7-INF | Infrastructure and Data Model |
| M7-BE | Backend — Lambda Functions and API |
| M7-FE | Frontend — Admin Console UI |
| M7-AUTH | Auth and RBAC |
| M7-TEST | Testing |

Story points follow the Fibonacci scale: 1, 2, 3, 5, 8, 13.
Priority: P1 = must-have Phase 2A (super_admin), P2 = Phase 2B (school_admin), P3 = nice-to-have.

---

## Infrastructure and Data Model

| Task ID | Layer | Title | Description | Depends On | Estimate | Priority |
|---|---|---|---|---|---|---|
| M7-INF-001 | Infrastructure | Provision AuditLog DynamoDB table | Create AuditLog table: PK=AUDIT#auditId, SK=METADATA, GSI 1 on actorId+timestamp, GSI 2 on targetEntityId+timestamp. No TTL. Append-only at application layer. Project all attributes on both GSIs. | Module 6 CDK stack stable | 3 | P1 |
| M7-INF-002 | Infrastructure | Provision ComplianceLog DynamoDB table | Create ComplianceLog table: PK=COMPLIANCE#requestId, SK=METADATA. No TTL. No delete endpoint exposed. Permanent retention. | Module 6 CDK stack stable | 2 | P1 |
| M7-INF-003 | Infrastructure | Provision School DynamoDB table | Create School table: PK=SCHOOL#schoolId, SK=METADATA. All attributes per Section 8.1 of FRD. No TTL. | Module 6 CDK stack stable | 2 | P1 |
| M7-INF-004 | Infrastructure | Provision SchoolUserLink DynamoDB table | Create SchoolUserLink table: PK=SCHOOL#schoolId, SK=USER#userId, GSI 1 on USER#userId+SCHOOL#schoolId (projection all). No TTL. | M7-INF-003 | 2 | P1 |
| M7-INF-005 | Infrastructure | Add suspended field to Users table | Additive schema amendment: add suspended boolean field (default false) to Users table. Update CDK table definition or migration script. Existing records without the field are treated as suspended=false. | Module 1 Users table live | 1 | P1 |
| M7-INF-006 | Infrastructure | Add status field to QuestionBank table | Additive schema amendment: add status string field (values: active, flagged, deleted; default active) to QuestionBank table. Update CDK table definition or migration script. Existing records without the field are treated as status=active. This amendment must be coordinated with M7-BE-018 (Module 2 GSI filter update). | Module 2 QuestionBank table live | 2 | P1 |
| M7-INF-007 | Infrastructure | Add schoolId field to Class table | Additive schema amendment: add schoolId string field (nullable, default null) to Class table. Update CDK table definition or migration script. | Module 5 Class table live | 1 | P1 |
| M7-INF-008 | Infrastructure | Deploy separate admin console CDK stack | Create a new CDK stack (AdminConsoleStack) for the admin console Vite app. This stack provisions: a separate S3 bucket for the admin console static assets, a separate CloudFront distribution (admin.learnfyra.com), WAF IP rule set restricting /admin/* paths to ops-team CIDRs (provided as a CDK parameter), and Route 53 records for all environments (dev/qa/prod). The stack shares the existing API Gateway and Lambda Authorizer — no new API Gateway is created. | M7-INF-001 through M7-INF-007, Module 6 CDK stable | 8 | P1 |
| M7-INF-009 | Infrastructure | CDK bootstrap super_admin seed Lambda | Create a CDK custom resource (or CDK bootstrap Lambda) that runs at stack deploy time. It accepts a CDK parameter: super_admin_email. It looks up the Cognito user for that email, writes a User record with role=super_admin if one does not already exist, and writes a ComplianceLog record with requestType=bootstrap. If the email has no matching Cognito user, the stack deploy fails with a descriptive error. | M7-INF-002, Module 1 Cognito pool live | 5 | P1 |
| M7-INF-010 | Infrastructure | Grant Cognito AdminUserGlobalSignOut permission to force-logout Lambda IAM role | Update the IAM role for the admin user management Lambda to include cognito-idp:AdminUserGlobalSignOut on the Learnfyra Cognito User Pool ARN. This is a CDK IAM grant, not a manual console change. | M7-INF-008 | 1 | P1 |
| M7-INF-011 | Infrastructure | Seed Config table with Bedrock pricing constants at deploy time | CDK seed script writes initial pricing constants (CONFIG#NOVA_TOKEN_PRICE, CONFIG#CLAUDE_TOKEN_PRICE, etc.) and CONFIG#DAILY_TOKEN_BUDGET to the Config table at deploy time if they do not already exist. Values are CDK parameters (not hardcoded). | Module 2 Config table live, M7-INF-008 | 2 | P1 |
| M7-INF-012 | Infrastructure | Add CONFIG#SCHEMA entries for all Module 7 Config keys | CDK seed script writes CONFIG#SCHEMA entries defining the type (number, string, boolean, string-enum, string-array) for each Config key introduced in Module 7, including DAILY_TOKEN_BUDGET, NOVA_TOKEN_PRICE, CLAUDE_TOKEN_PRICE, and ALLOWED_MODELS. | M7-INF-011 | 1 | P1 |
| M7-INF-013 | Infrastructure | Create SchoolTeacherInvite DynamoDB table | Create SchoolTeacherInvite table: PK=INVITE#<code>, SK=METADATA. Attributes: schoolId, invitedBy, createdAt, expiresAt (TTL attribute, 7 days), status (pending/accepted/expired). GSI on schoolId+createdAt. | M7-INF-003 | 2 | P2 |

---

## Backend — Lambda Functions and API

| Task ID | Layer | Title | Description | Depends On | Estimate | Priority |
|---|---|---|---|---|---|---|
| M7-BE-001 | Backend | User search and list handler — GET /admin/users | Lambda handler implementing GET /admin/users with search (email/name/sub case-insensitive), role filter, suspended filter, and pagination (page + pageSize, max 100). Must enforce role=super_admin via Authorizer. Response time < 2s for 10,000 users. | M7-INF-005, M7-AUTH-001 | 5 | P1 |
| M7-BE-002 | Backend | User full profile handler — GET /admin/users/{userId} | Lambda handler returning full User record plus generationCount (from GenerationLog) and attemptCount (from WorksheetAttempt). Returns 404 if userId not found. Must enforce role=super_admin. | M7-INF-005, M7-AUTH-001 | 3 | P1 |
| M7-BE-003 | Backend | Suspend user handler — PATCH /admin/users/{userId}/suspend | Lambda handler setting suspended=true on User record. Returns 409 if already suspended. Writes AuditLog record with action=USER_SUSPENDED on success. Must enforce role=super_admin. | M7-INF-001, M7-INF-005, M7-AUTH-001 | 3 | P1 |
| M7-BE-004 | Backend | Unsuspend user handler — PATCH /admin/users/{userId}/unsuspend | Lambda handler setting suspended=false on User record. Returns 409 if not currently suspended. Writes AuditLog record with action=USER_UNSUSPENDED on success. Must enforce role=super_admin. | M7-INF-001, M7-INF-005, M7-AUTH-001 | 2 | P1 |
| M7-BE-005 | Backend | Force-logout handler — POST /admin/users/{userId}/force-logout | Lambda handler calling Cognito AdminUserGlobalSignOut for target user. Requires confirmed=true in request body. Returns 502 on Cognito error. Writes AuditLog record with action=FORCE_LOGOUT on success. Must enforce role=super_admin. | M7-INF-001, M7-INF-010, M7-AUTH-001 | 3 | P1 |
| M7-BE-006 | Backend | Role change handler — PATCH /admin/users/{userId}/role | Lambda handler updating User record role field. Validates role value against allowed enum. Prevents self-role-change (returns 403 if userId == callerSub). When role=school_admin, validates schoolId exists, creates SchoolUserLink record, and updates School.schoolAdminIds. Writes AuditLog record with action=ROLE_CHANGE. Must enforce role=super_admin. | M7-INF-001, M7-INF-003, M7-INF-004, M7-AUTH-001 | 5 | P1 |
| M7-BE-007 | Backend | COPPA deletion handler — DELETE /admin/users/{userId} | Lambda handler implementing the full COPPA deletion flow per FR-A-022 and FR-A-023. Steps: (1) write ComplianceLog record with status=in-progress — abort with 500 if this fails; (2) delete WorksheetAttempt records; (3) delete UserProgress records; (4) delete ParentChildLink records both directions; (5) delete StudentAssignmentStatus records; (6) remove SchoolUserLink records; (7) delete User record; (8) call Cognito AdminDeleteUser. On any step failure: append errorState to ComplianceLog and return 500. On success: update ComplianceLog with status=completed and deletedEntities. Write AuditLog record with action=COPPA_DELETION on completion. Validates confirmationToken in request body. Must enforce role=super_admin. | M7-INF-001, M7-INF-002, M7-INF-010, M7-AUTH-001 | 13 | P1 |
| M7-BE-008 | Backend | Question bank list handler — GET /admin/question-bank | Lambda handler querying QuestionBank table with optional filters: status (active/flagged/deleted), grade (1–10), subject. Returns paginated results. Must enforce role=super_admin. | M7-INF-006, M7-AUTH-001 | 3 | P1 |
| M7-BE-009 | Backend | Flag question handler — PATCH /admin/question-bank/{questionId}/flag | Lambda handler setting status=flagged on QuestionBank record. Returns 409 if already flagged or deleted. Writes AuditLog record with action=QUESTION_FLAGGED. Must enforce role=super_admin. | M7-INF-001, M7-INF-006, M7-AUTH-001 | 2 | P1 |
| M7-BE-010 | Backend | Unflag question handler — PATCH /admin/question-bank/{questionId}/unflag | Lambda handler setting status=active on QuestionBank record. Returns 409 if not currently flagged. Writes AuditLog record with action=QUESTION_UNFLAGGED. Must enforce role=super_admin. | M7-INF-001, M7-INF-006, M7-AUTH-001 | 2 | P1 |
| M7-BE-011 | Backend | Soft-delete question handler — DELETE /admin/question-bank/{questionId} | Lambda handler setting status=deleted on QuestionBank record. Returns 409 if already deleted. Writes AuditLog record with action=QUESTION_SOFT_DELETED. Must enforce role=super_admin. Record is never physically removed from DynamoDB. | M7-INF-001, M7-INF-006, M7-AUTH-001 | 2 | P1 |
| M7-BE-012 | Backend | Cost dashboard aggregation handler — GET /admin/cost-dashboard | Lambda handler querying GenerationLog GSI for the specified time window (24h, 7d, 30d). Aggregates: total tokens, cost estimate per model (pricing from Config table), average tokens by subject and grade, success/failure/retry rates. Must respond within 2s for 30-day window. Must enforce role=super_admin. | M7-INF-011, M7-AUTH-001, Module 2 GenerationLog table live | 8 | P1 |
| M7-BE-013 | Backend | Top-expensive generations handler — GET /admin/cost-dashboard/top-expensive | Lambda handler querying GenerationLog for the 10 highest-token records in the last 30 days. Returns all GenerationLog fields per record. Must enforce role=super_admin. | M7-AUTH-001, Module 2 GenerationLog table live | 3 | P1 |
| M7-BE-014 | Backend | Config list handler — GET /admin/config | Lambda handler returning all Config table records. Must enforce role=super_admin. | M7-AUTH-001, Module 2 Config table live | 2 | P1 |
| M7-BE-015 | Backend | Config single record handler — GET /admin/config/{configType} | Lambda handler returning a single Config record by configType. Returns 404 if not found. Must enforce role=super_admin. | M7-AUTH-001 | 1 | P1 |
| M7-BE-016 | Backend | Config write handler — PUT /admin/config/{configType} | Lambda handler writing a Config record. Reads CONFIG#SCHEMA to validate type before writing. Rejects if configType=CONFIG#AI_MODEL and value not in CONFIG#ALLOWED_MODELS. Writes AuditLog record with action=CONFIG_UPDATED on success. Must enforce role=super_admin. | M7-INF-001, M7-INF-012, M7-AUTH-001 | 5 | P1 |
| M7-BE-017 | Backend | School management handlers — POST, GET, PATCH /admin/schools | Three Lambda handlers (or one with method routing): POST creates School record, writes AuditLog SCHOOL_CREATED; GET /admin/schools lists all schools; GET /admin/schools/{schoolId} returns single school; PATCH /admin/schools/{schoolId} updates school fields, writes AuditLog SCHOOL_UPDATED. All must enforce role=super_admin. | M7-INF-001, M7-INF-003, M7-AUTH-001 | 5 | P1 |
| M7-BE-018 | Backend | Amendment to Module 2 Step Functions bank lookup GSI query — add status=active filter | Amend the existing Step Functions bank lookup step (in Module 2) to add a FilterExpression (or KeyConditionExpression if status is part of the GSI key) that restricts QuestionBank results to status=active. This is a modification of the existing Step Functions state machine definition, not a new Lambda. Must be tested to confirm flagged and deleted questions are excluded. | M7-INF-006, Module 2 Step Functions state machine | 3 | P1 |
| M7-BE-019 | Backend | Amendment to Module 2 worksheet generation Lambda — daily token budget ceiling check | Amend the existing worksheet generation Lambda to check the daily token budget before starting the Step Functions execution. The check reads CONFIG#DAILY_TOKEN_BUDGET from DynamoDB and the rolling 24-hour token sum from GenerationLog. If consumption equals or exceeds the budget, return 503 with Retry-After: 3600. If Config is unreachable, proceed with generation (fail-open) and log to CloudWatch. This is a modification of the existing generation Lambda, not a new function. | M7-INF-011, M7-INF-012, Module 2 generation Lambda | 5 | P1 |
| M7-BE-020 | Backend | AuditLog query handler — GET /admin/audit-log | Lambda handler querying AuditLog using GSI 1 (actorId) or GSI 2 (targetEntityId) with optional from/to timestamp filters. Handles two RBAC modes: super_admin sees all records; school_admin sees only records where actorId equals their own userId (handler enforces this regardless of supplied actorId parameter). Must respond within 500ms for 10,000 records per actor. | M7-INF-001, M7-AUTH-001 | 5 | P1 |
| M7-BE-021 | Backend | ComplianceLog query handler — GET /admin/compliance-log | Lambda handler scanning ComplianceLog table with pagination. Must enforce role=super_admin. No delete endpoint is exposed. | M7-INF-002, M7-AUTH-001 | 2 | P1 |
| M7-BE-022 | Backend | AuditLog writer utility | Shared utility module (not a separate Lambda) used by all state-changing handlers to write AuditLog records. The write is fire-and-forget: if the DynamoDB PutItem fails, the error is caught, logged to CloudWatch, and the primary action result is not affected. No UpdateItem or DeleteItem against AuditLog is ever called. This utility is imported by all handlers that modify state. | M7-INF-001 | 3 | P1 |
| M7-BE-023 | Backend | School admin teacher list handler — GET /school/teachers | Lambda handler querying SchoolUserLink for the caller's schoolId where role=teacher and status=active. Augments each teacher record with activeClassCount (count of Class records where teacherId matches and schoolId matches). Must enforce role=school_admin. | M7-INF-004, M7-AUTH-002 | 3 | P2 |
| M7-BE-024 | Backend | School admin teacher invite handler — POST /school/teachers/invite | Lambda handler generating a unique invite code, writing a SchoolTeacherInvite record with expiresAt=7 days, and returning the code. Writes AuditLog record with action=TEACHER_INVITED. Must enforce role=school_admin. | M7-INF-013, M7-INF-001, M7-AUTH-002 | 3 | P2 |
| M7-BE-025 | Backend | Teacher invite redemption endpoint | Lambda handler that accepts an invite code and a valid user JWT, validates the code (not expired, not already accepted, schoolId matches), creates a SchoolUserLink record for the teacher, and sets the invite status=accepted. Called from the main platform (not the admin console), so role=teacher is required (teacher must already be registered). | M7-INF-013, M7-INF-004, Module 1 auth stable | 5 | P2 |
| M7-BE-026 | Backend | School admin teacher remove handler — DELETE /school/teachers/{userId} | Lambda handler setting SchoolUserLink status=removed for target teacher in callerSchoolId. Clears schoolId field from all Class records owned by that teacher in the school. Writes AuditLog record with action=TEACHER_REMOVED. Returns 403 if target teacher is not in callerSchoolId. Must enforce role=school_admin. | M7-INF-001, M7-INF-004, M7-AUTH-002 | 5 | P2 |
| M7-BE-027 | Backend | School student roster handler — GET /school/students | Lambda handler querying all Class records affiliated with callerSchoolId, collecting unique studentIds from those classes via StudentAssignmentStatus or class membership records, and returning a deduplicated student list with displayName, grade, and classMembershipCount. Must enforce role=school_admin. | M7-INF-004, M7-AUTH-002, Module 5 Class table live | 5 | P2 |
| M7-BE-028 | Backend | School analytics handler — GET /school/analytics | Lambda handler aggregating UserProgress and StudentAssignmentStatus records scoped to the caller's schoolId. Returns subjectAccuracy, gradeAccuracy, and teacherCompletionRates. No new computation infrastructure — derives data from existing Module 4 and 5 tables. Must enforce role=school_admin. | M7-INF-004, M7-AUTH-002, Module 4 and 5 tables live | 8 | P2 |
| M7-BE-029 | Backend | Bulk assignment handler — POST /school/bulk-assign | Lambda handler validating all classIds belong to callerSchoolId, then issuing parallel POST /assignments calls (one per classId). Returns summary of success and failure per class. Writes AuditLog record with action=BULK_ASSIGNMENT_CREATED. Must enforce role=school_admin. Returns 403 if any classId is not affiliated with callerSchoolId. | M7-INF-001, M7-INF-004, M7-AUTH-002, Module 5 Assignment table live | 5 | P2 |
| M7-BE-030 | Backend | School config read handler — GET /school/config | Lambda handler returning School record for callerSchoolId (minGrade, maxGrade, activeSubjects). Must enforce role=school_admin. | M7-INF-003, M7-INF-004, M7-AUTH-002 | 1 | P2 |
| M7-BE-031 | Backend | School config update handler — PATCH /school/config | Lambda handler updating minGrade, maxGrade, and/or activeSubjects on School record for callerSchoolId. Validates minGrade <= maxGrade and activeSubjects not empty. Writes AuditLog record with action=SCHOOL_CONFIG_UPDATED. Must enforce role=school_admin. | M7-INF-001, M7-INF-003, M7-INF-004, M7-AUTH-002 | 3 | P2 |

---

## Frontend — Admin Console UI

| Task ID | Layer | Title | Description | Depends On | Estimate | Priority |
|---|---|---|---|---|---|---|
| M7-FE-001 | Frontend | Admin console Vite app scaffold | Create the admin console as a separate Vite + React + TypeScript application within the monorepo at a path such as apps/admin-console/. Configure build output to the AdminConsoleStack S3 bucket. Shared component library with the main app where possible. | M7-INF-008, UI template received | 5 | P1 |
| M7-FE-002 | Frontend | Admin console authentication flow | Implement login for the admin console using the same Cognito User Pool as the main platform. Redirect users without role=super_admin or role=school_admin to an access-denied page. Display an explanatory message for IP-restricted access failures. | M7-FE-001, Module 1 auth stable | 3 | P1 |
| M7-FE-003 | Frontend | User management list and search page | Page listing all users with search (email, name), role filter, and suspended filter. Pagination. Clicking a user opens the profile view. | M7-FE-001, M7-BE-001 | 5 | P1 |
| M7-FE-004 | Frontend | User profile and action panel | Page showing full user profile (role, suspended status, activity summary). Action buttons: Suspend, Unsuspend, Force Immediate Logout, Change Role, COPPA Deletion. Each action button disabled when the action is not applicable (e.g. Suspend is disabled if already suspended). | M7-FE-003, M7-BE-002, M7-BE-003, M7-BE-004, M7-BE-005, M7-BE-006, M7-BE-007 | 8 | P1 |
| M7-FE-005 | Frontend | COPPA deletion double-confirmation modal | Modal triggered from the user profile page. Displays target user's email and a text input requiring the admin to type it exactly. Confirm button is disabled until the typed value matches. On match, a confirmation token is generated client-side and the DELETE request is issued. Displays deletion summary (entity counts) on success, or error state with partial deletion details on failure. | M7-FE-004, M7-BE-007 | 5 | P1 |
| M7-FE-006 | Frontend | Force-logout confirmation dialog | Confirmation dialog on the user profile page. Plain acknowledgement (no email typing required). Issues POST /admin/users/{userId}/force-logout with confirmed=true on acceptance. | M7-FE-004, M7-BE-005 | 2 | P1 |
| M7-FE-007 | Frontend | Question bank moderation page | List view of QuestionBank entries with status filter (all/active/flagged/deleted), grade filter, and subject filter. Each row shows questionId, status badge, grade, subject, and the question text (truncated). Per-row actions: Flag, Unflag, Soft Delete. Actions are contextual (Flag disabled if already flagged, etc.). | M7-FE-001, M7-BE-008, M7-BE-009, M7-BE-010, M7-BE-011 | 8 | P1 |
| M7-FE-008 | Frontend | AI cost dashboard page | Dashboard page with time window selector (24h / 7d / 30d). Displays: total tokens, cost estimate per model, average tokens per subject/grade matrix, success/failure/retry rate indicators. Bottom section shows top-10 most expensive generations as a clickable table. Clicking a row expands the full GenerationLog record. | M7-FE-001, M7-BE-012, M7-BE-013 | 8 | P1 |
| M7-FE-009 | Frontend | Config table editor page | Table listing all Config records with configType, value, type, and last updated. Clicking a record opens an inline editor. The editor enforces the type constraint (number input for number type, toggle for boolean, dropdown for string-enum). Submit calls PUT /admin/config/{configType}. Displays validation errors inline. | M7-FE-001, M7-BE-014, M7-BE-015, M7-BE-016 | 8 | P1 |
| M7-FE-010 | Frontend | School management page | List of all schools with status badge. "Create School" button opens a form (schoolName, minGrade, maxGrade, activeSubjects checkboxes, optional district and address). Clicking a school opens the school detail page. School detail shows schoolAdminIds, grade range, subjects, and status with an Edit button. | M7-FE-001, M7-BE-017 | 8 | P1 |
| M7-FE-011 | Frontend | Assign school admin flow on school detail page | On the school detail page, a button "Assign School Admin" opens a user search modal. The admin searches for a user by email, sees their current role, and clicks "Make School Admin". Issues PATCH /admin/users/{userId}/role with role=school_admin and the schoolId of the current school. | M7-FE-010, M7-BE-006 | 3 | P1 |
| M7-FE-012 | Frontend | Audit log viewer page | Searchable, filterable audit log table. Filters: actorId (text input), targetEntityId (text input), from/to date pickers. Columns: timestamp, actorId, actorRole, action, targetEntityType, targetEntityId. Clicking a row expands beforeState/afterState, ipAddress, and userAgent. Paginated. | M7-FE-001, M7-BE-020 | 5 | P1 |
| M7-FE-013 | Frontend | Compliance log viewer page | Paginated list of ComplianceLog records. Columns: requestId, requestType, requestedBy, targetUserId, startedAt, status. Clicking a row expands all fields including deletedEntities and errorState (if partial failure). Read-only, no delete button. | M7-FE-001, M7-BE-021 | 3 | P1 |
| M7-FE-014 | Frontend | Admin console navigation shell and role-based menu | Navigation shell showing different menu sections based on JWT role. super_admin sees: Users, Question Bank, Cost Dashboard, Config, Schools, Audit Log, Compliance Log. school_admin sees: Teachers, Students, Analytics, Bulk Assign, School Config. Users who sign in with an unrecognised role see an access-denied page. | M7-FE-002 | 3 | P1 |
| M7-FE-015 | Frontend | School admin — teacher list and invite page | Page listing teachers in the school (displayName, email, active class count). "Invite Teacher" button issues POST /school/teachers/invite and displays the returned invite code in a copyable modal. Remove button per row issues DELETE /school/teachers/{userId} after a confirmation dialog. | M7-FE-014, M7-BE-023, M7-BE-024, M7-BE-026 | 5 | P2 |
| M7-FE-016 | Frontend | School admin — student roster page | Page listing all students across the school's classes. Columns: displayName, grade, class count. Read-only. Paginated. | M7-FE-014, M7-BE-027 | 3 | P2 |
| M7-FE-017 | Frontend | School admin — analytics dashboard page | Dashboard showing subject accuracy table, grade accuracy table, and teacher completion rate table. Cells below 60% accuracy are highlighted. | M7-FE-014, M7-BE-028 | 5 | P2 |
| M7-FE-018 | Frontend | School admin — bulk assignment page | Page with worksheet search (title, grade, subject), multi-select class list (showing all classes in the school), dueDate picker, and allowedAttempts input. Submit button issues POST /school/bulk-assign. Results summary shown after submission. | M7-FE-014, M7-BE-029 | 5 | P2 |
| M7-FE-019 | Frontend | School admin — school configuration page | Page displaying school name, grade range, and active subjects with an Edit button. Edit mode shows number inputs for minGrade/maxGrade and checkboxes for activeSubjects. Save issues PATCH /school/config. Validation errors shown inline. | M7-FE-014, M7-BE-030, M7-BE-031 | 3 | P2 |

---

## Auth and RBAC

| Task ID | Layer | Title | Description | Depends On | Estimate | Priority |
|---|---|---|---|---|---|---|
| M7-AUTH-001 | Auth | Amendment to Lambda Authorizer — super_admin role support | Amend the existing Module 1 Lambda Authorizer to recognise role=super_admin as a valid role claim. The Authorizer must enforce role=super_admin on all /admin/* routes. This is a modification of the existing authorizer Lambda, not a new function. | Module 1 Lambda Authorizer stable | 2 | P1 |
| M7-AUTH-002 | Auth | Amendment to Lambda Authorizer — school_admin role support | Amend the existing Module 1 Lambda Authorizer to recognise role=school_admin as a valid role claim. The Authorizer must enforce role=school_admin on all /school/* routes. It must also extract the caller's schoolId from their SchoolUserLink record and pass it to the handler context so handlers can use it for scoping without performing a redundant DynamoDB read. | M7-AUTH-001, M7-INF-004 | 3 | P1 |
| M7-AUTH-003 | Auth | Amendment to Lambda Authorizer — suspended flag check | Amend the existing Module 1 Lambda Authorizer to check the suspended field on the User record for every authenticated request. The check result is cached in Lambda in-memory for 5 minutes per userId (keyed by userId, not by JWT). If suspended=true is found, the Authorizer returns a Deny policy (caller receives 401). If the DynamoDB read fails, the request is allowed (fail-open) and the error is logged to CloudWatch. This is a modification of the existing authorizer Lambda. | M7-INF-005, Module 1 Lambda Authorizer stable | 5 | P1 |
| M7-AUTH-004 | Auth | CloudFront WAF IP restriction for /admin/* paths | Configure WAF rule on the admin console CloudFront distribution to allow requests to /admin/* paths only from the ops team's approved IP CIDRs (supplied as a CDK parameter). /school/* paths are not IP-restricted. This is a CDK WAF construct, not a manual console change. | M7-INF-008 | 3 | P1 |
| M7-AUTH-005 | Auth | Self-role-change prevention in role change handler | The role change handler (M7-BE-006) must check whether userId == callerSub and return 403 if so. This is enforced at the handler level (not the Authorizer level) because the Authorizer does not have context of the target userId. | M7-BE-006 | 1 | P1 |

---

## Testing

| Task ID | Layer | Title | Description | Depends On | Estimate | Priority |
|---|---|---|---|---|---|---|
| M7-TEST-001 | Testing | Unit tests — AuditLog writer utility | Unit tests for the shared AuditLog writer utility (M7-BE-022). Test cases: successful write, DynamoDB failure (must not throw, must log to CloudWatch), correct field population for each action type, append-only enforcement (no UpdateItem or DeleteItem calls). | M7-BE-022 | 3 | P1 |
| M7-TEST-002 | Testing | Unit tests — suspended flag check in Lambda Authorizer | Unit tests for the Authorizer suspended flag check (M7-AUTH-003). Test cases: suspended=true returns Deny, suspended=false allows request and caches result, DynamoDB failure allows request (fail-open), cache hit does not make DynamoDB call, cache expires after 5 minutes. | M7-AUTH-003 | 3 | P1 |
| M7-TEST-003 | Testing | Unit tests — COPPA deletion handler | Unit tests for M7-BE-007. Test cases: ComplianceLog write failure aborts deletion (returns 500, no records deleted), all steps execute in order on success, step 3 failure records partial state in ComplianceLog, confirmationToken absent returns 400, caller not super_admin returns 403, userId not found returns 404, successful deletion updates ComplianceLog with deletedEntities. All DynamoDB and Cognito calls must be mocked (no real AWS calls in unit tests). | M7-BE-007 | 8 | P1 |
| M7-TEST-004 | Testing | Unit tests — Config write handler with type validation | Unit tests for M7-BE-016. Test cases: valid number value for number type accepts and writes, string value for number type returns 400, CONFIG#AI_MODEL with value not in ALLOWED_MODELS returns 400, unknown configType returns 404, successful write produces AuditLog record. | M7-BE-016 | 3 | P1 |
| M7-TEST-005 | Testing | Unit tests — daily token budget ceiling check (Module 2 amendment) | Unit tests for M7-BE-019. Test cases: token consumption below ceiling — generation proceeds, token consumption equals ceiling — returns 503 with Retry-After header, token consumption above ceiling — returns 503, Config table unreachable — generation proceeds (fail-open) and logs error, budget check reads correct rolling 24-hour window from GenerationLog. | M7-BE-019 | 5 | P1 |
| M7-TEST-006 | Testing | Unit tests — Module 2 Step Functions GSI query — status filter | Unit tests for M7-BE-018. Test cases: query returns only status=active records, flagged record is excluded, deleted record is excluded, record without status field is treated as active. | M7-BE-018 | 3 | P1 |
| M7-TEST-007 | Testing | Unit tests — question bank moderation handlers | Unit tests for M7-BE-009, M7-BE-010, M7-BE-011. Test cases: flag active question succeeds, flag already-flagged returns 409, flag deleted returns 409, unflag flagged question succeeds, unflag active returns 409, soft-delete active succeeds, soft-delete deleted returns 409, DynamoDB record is never physically deleted. Each success writes AuditLog record. All DynamoDB calls mocked. | M7-BE-009, M7-BE-010, M7-BE-011 | 5 | P1 |
| M7-TEST-008 | Testing | Unit tests — user management handlers (suspend, unsuspend, force-logout) | Unit tests for M7-BE-003, M7-BE-004, M7-BE-005. Test cases: suspend already-suspended returns 409, unsuspend non-suspended returns 409, force-logout without confirmed=true returns 400, Cognito AdminUserGlobalSignOut failure returns 502 and no AuditLog written, successful suspend/unsuspend/force-logout each produce AuditLog records. All AWS calls mocked. | M7-BE-003, M7-BE-004, M7-BE-005 | 5 | P1 |
| M7-TEST-009 | Testing | Unit tests — role change and self-change prevention | Unit tests for M7-BE-006. Test cases: valid role change succeeds and writes AuditLog, invalid role value returns 400, self-role-change (userId == callerSub) returns 403, school_admin assignment without schoolId returns 400, school_admin assignment with non-existent schoolId returns 400. All DynamoDB calls mocked. | M7-BE-006 | 3 | P1 |
| M7-TEST-010 | Testing | Unit tests — cost dashboard aggregation handler | Unit tests for M7-BE-012. Test cases: 24h window returns correct token sum, 30-day window returns within 2s (performance assertion using mocked data of representative size), model pricing from Config table used (not hardcoded), model not in Config returns unpriced value (not error), missing window parameter returns 400. | M7-BE-012 | 5 | P1 |
| M7-TEST-011 | Testing | Unit tests — AuditLog query handler scoping | Unit tests for M7-BE-020. Test cases: super_admin can query by any actorId, school_admin calling with actorId of another user receives only their own records, school_admin calling without actorId parameter receives only their own records, from/to filter is applied correctly, GSI 1 used for actorId queries, GSI 2 used for targetEntityId queries. | M7-BE-020 | 3 | P1 |
| M7-TEST-012 | Testing | Unit tests — school management handlers | Unit tests for M7-BE-017. Test cases: create school with missing schoolName returns 400, minGrade > maxGrade returns 400, empty activeSubjects returns 400, successful creation writes AuditLog SCHOOL_CREATED, patch school writes AuditLog SCHOOL_UPDATED. | M7-BE-017 | 3 | P1 |
| M7-TEST-013 | Testing | Unit tests — ComplianceLog write ordering | Unit tests specifically verifying the ordering constraint of M7-BE-007. Test case: mock DynamoDB such that the ComplianceLog write is the first call. Assert that no other DynamoDB PutItem or DeleteItem for WorksheetAttempt, UserProgress, or any other entity table is called before the ComplianceLog write completes. | M7-BE-007 | 3 | P1 |
| M7-TEST-014 | Testing | Integration tests — COPPA deletion end-to-end | Integration tests running against DynamoDB local. Seed a user with WorksheetAttempt, UserProgress, ParentChildLink, StudentAssignmentStatus, and SchoolUserLink records. Trigger the COPPA deletion handler. Assert: ComplianceLog record exists with status=completed, all seeded records for that userId are gone, User record is gone, deletedEntities counts are accurate. Cognito call is mocked even in integration test. | M7-BE-007, M7-TEST-003, DynamoDB local running | 8 | P1 |
| M7-TEST-015 | Testing | Integration tests — school admin scoping (403 on cross-school access) | Integration tests running against DynamoDB local. Create two schools and two school_admin users. Assert that school_admin A calling GET /school/teachers receives only school A's teachers. Assert that school_admin A supplying school B's schoolId receives 403. Assert school ID enumeration returns 403 not 404. | M7-BE-023, M7-AUTH-002, DynamoDB local running | 5 | P2 |
| M7-TEST-016 | Testing | CDK assertions tests — new tables and constructs | CDK assertions tests in infra/cdk/test/ verifying: AuditLog table has no TTL, ComplianceLog table has no TTL, School and SchoolUserLink tables exist with correct GSIs, admin console CloudFront distribution exists, WAF IP rule set is attached to admin distribution, bootstrap Lambda custom resource is present. | M7-INF-001 through M7-INF-009 | 5 | P1 |
| M7-TEST-017 | Testing | Integration tests — token budget ceiling end-to-end | Integration test seeding GenerationLog with records summing to a token count above the configured CONFIG#DAILY_TOKEN_BUDGET. Assert that POST /worksheet returns 503 with Retry-After header. Seed token sum below budget and assert generation proceeds. | M7-BE-019, DynamoDB local running | 5 | P1 |
| M7-TEST-018 | Testing | Unit tests — school admin teacher management handlers | Unit tests for M7-BE-023, M7-BE-024, M7-BE-026. Test cases: teacher list scoped to callerSchoolId, invite code is unique and returns expiresAt, remove teacher sets SchoolUserLink status=removed, remove teacher clears schoolId from owned Class records, remove teacher does not delete User record, remove teacher for userId not in school returns 403. All DynamoDB calls mocked. | M7-BE-023, M7-BE-024, M7-BE-026 | 5 | P2 |
| M7-TEST-019 | Testing | Unit tests — bulk assignment handler | Unit tests for M7-BE-029. Test cases: all classIds in callerSchoolId — all assignments created, one classId not in callerSchoolId — 403 and zero assignments created, empty classIds array returns 400, parallel assignment calls are issued (assert parallelism by verifying all three calls are in-flight before first resolves). | M7-BE-029 | 5 | P2 |
| M7-TEST-020 | Testing | Unit tests — school analytics handler data scoping | Unit tests for M7-BE-028. Test cases: analytics scoped to callerSchoolId (records from other schools not included), subject with no attempts returns zero accuracy (not omitted), grade with no attempts returns zero accuracy. | M7-BE-028 | 3 | P2 |

---

## Dependency Graph

The following describes the ordering constraints between tasks. Tasks listed together on the same row can be parallelised.

Infrastructure foundation (must complete first):
- M7-INF-001, M7-INF-002, M7-INF-003 can be parallelised (no interdependencies).
- M7-INF-004 depends on M7-INF-003 (SchoolUserLink references School).
- M7-INF-005, M7-INF-006, M7-INF-007 can be parallelised (each amends a different existing table).
- M7-INF-008 depends on M7-INF-001 through M7-INF-007 (CDK admin stack references all new tables).
- M7-INF-009 depends on M7-INF-002 (ComplianceLog table must exist for bootstrap record).
- M7-INF-010 depends on M7-INF-008 (IAM grant is part of admin stack).
- M7-INF-011 depends on M7-INF-008.
- M7-INF-012 depends on M7-INF-011.
- M7-INF-013 (SchoolTeacherInvite) depends on M7-INF-003. P2, can begin in parallel with other P2 infrastructure.

Auth amendments (must complete before backend handlers):
- M7-AUTH-001 depends on Module 1 authorizer being stable.
- M7-AUTH-002 depends on M7-AUTH-001 and M7-INF-004.
- M7-AUTH-003 depends on M7-INF-005 and Module 1 authorizer being stable. Can be parallelised with M7-AUTH-002.
- M7-AUTH-004 depends on M7-INF-008.
- M7-AUTH-005 depends on M7-BE-006 (implemented within the handler, not separately deployable).

Backend — Phase 2A (can be parallelised once infrastructure and auth amendments are complete):
- M7-BE-022 (AuditLog writer utility) must complete before any handler that writes AuditLog (M7-BE-003, M7-BE-004, M7-BE-005, M7-BE-006, M7-BE-007, M7-BE-009, M7-BE-010, M7-BE-011, M7-BE-016, M7-BE-017).
- M7-BE-001, M7-BE-002 can be parallelised (both depend on M7-AUTH-001 and M7-INF-005 only).
- M7-BE-003, M7-BE-004, M7-BE-005, M7-BE-006 can be parallelised after M7-BE-022 and M7-AUTH-001 are complete.
- M7-BE-007 (COPPA deletion) depends on M7-BE-022, M7-INF-002, and M7-INF-010. It is the most complex handler and should be started early in its sprint.
- M7-BE-008, M7-BE-009, M7-BE-010, M7-BE-011 can be parallelised after M7-INF-006 is complete.
- M7-BE-018 (Module 2 Step Functions amendment) depends on M7-INF-006 and must be deployed in the same migration as M7-INF-006 to prevent a window where flagged questions could be returned.
- M7-BE-019 (Module 2 generation Lambda amendment) depends on M7-INF-011 and M7-INF-012.
- M7-BE-012, M7-BE-013 can be parallelised after M7-INF-011 and M7-AUTH-001.
- M7-BE-014, M7-BE-015, M7-BE-016 can be parallelised after M7-INF-012 and M7-AUTH-001.
- M7-BE-017 depends on M7-INF-003 and M7-BE-022.
- M7-BE-020 depends on M7-INF-001 and M7-AUTH-001.
- M7-BE-021 depends on M7-INF-002 and M7-AUTH-001.

Backend — Phase 2B (all P1 backend must be complete before starting):
- M7-BE-023, M7-BE-024, M7-BE-026 can be parallelised after M7-INF-013 and M7-AUTH-002.
- M7-BE-025 (teacher invite redemption) depends on M7-BE-024.
- M7-BE-027 depends on M7-INF-004 and Module 5 tables being live.
- M7-BE-028 depends on M7-INF-004 and Modules 4 and 5 tables being live.
- M7-BE-029 depends on M7-BE-022, M7-INF-004, and Module 5 Assignment table being live.
- M7-BE-030, M7-BE-031 can be parallelised after M7-INF-003 and M7-INF-004.

Frontend — Phase 2A (can be parallelised with backend once API contracts are agreed):
- M7-FE-001 (Vite scaffold) must complete before all other FE tasks.
- M7-FE-002 depends on M7-FE-001 and Module 1 auth being stable.
- M7-FE-014 (nav shell) depends on M7-FE-002.
- M7-FE-003 through M7-FE-013 depend on M7-FE-014 and their respective backend handlers.
- M7-FE-004 depends on M7-FE-003 (user list must exist before profile page is navigated to).
- M7-FE-005 depends on M7-FE-004 (modal is triggered from the profile page).
- M7-FE-006 depends on M7-FE-004.
- M7-FE-011 depends on M7-FE-010 (assign school admin is a sub-flow on the school detail page).

Frontend — Phase 2B:
- M7-FE-015 through M7-FE-019 depend on M7-FE-014 and their respective backend handlers. All can be parallelised with each other.

Testing:
- M7-TEST-001 depends on M7-BE-022.
- M7-TEST-002 depends on M7-AUTH-003.
- M7-TEST-003 and M7-TEST-013 depend on M7-BE-007.
- M7-TEST-014 (integration) depends on M7-TEST-003 and M7-TEST-013.
- All other unit test tasks depend on their corresponding backend handler tasks.
- M7-TEST-016 (CDK assertions) depends on all M7-INF tasks.
- M7-TEST-015, M7-TEST-018, M7-TEST-019, M7-TEST-020 are P2 and depend on their respective P2 backend tasks.
