# Module 5 — Sprint Plan
## Teacher & Parent Roles

| Field | Value |
|---|---|
| Module | M05 — Teacher & Parent Roles |
| Version | 1.0 |
| Date | 2026-04-02 |
| Status | Draft |
| Prepared By | BA Agent |
| Source Documents | MODULE_5_FRD_Teacher_Parent.md v1.0, MODULE_5_TaskTracker.md v1.0 |

---

## Sprint Planning Assumptions

| Assumption | Value |
|---|---|
| Sprint length | 2 weeks |
| Team composition | 1 frontend engineer (FE), 1 backend + infra engineer (BE/Infra) |
| Velocity per engineer per sprint | 16 story points |
| Total velocity per sprint | 32 story points |
| Parallel workstreams | Frontend and backend/infra tasks run concurrently once API contracts are agreed and UI template is received |
| Pre-condition | Modules 1, 2, 3, 4, and 6 infrastructure are complete and stable before M05 begins |
| Frontend start condition | All frontend tasks are blocked until the UI template is received from the product owner. Frontend engineer works on integration and test tasks until unblocked. |
| Local-first rule | All backend acceptance criteria must pass locally (DynamoDB local, APP_RUNTIME=local) before any CDK deploy is started |
| API contract lock | API contracts for all M05 endpoints (Section 9 of FRD) must be agreed and documented before Week 3 |

---

## Sprint 1 — Foundation: Tables, Auth, and Class Core

**Goal:** Provision all M05 DynamoDB tables, update SETUP-002 bootstrap script, update the Lambda Authorizer for teacher and parent roles, and deliver the class creation and student join flows end-to-end locally.

**Duration:** Week 1–2

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-INF-001 | Provision LearnfyraClasses-{env} DynamoDB table | BE/Infra | 3 |
| M5-INF-002 | Provision LearnfyraAssignments-{env} DynamoDB table | BE/Infra | 3 |
| M5-INF-003 | Provision LearnfyraStudentAssignmentStatus-{env} DynamoDB table | BE/Infra | 5 |
| M5-INF-004 | Provision LearnfyraParentChildLinks-{env} DynamoDB table | BE/Infra | 3 |
| M5-INF-005 | Provision LearnfyraParentInviteCodes-{env} DynamoDB table | BE/Infra | 2 |
| M5-INF-015 | Provision ReviewQueueItems-{env} DynamoDB table | BE/Infra | 3 |
| M5-INF-008 | Update SETUP-002 bootstrap script for M05 tables | BE/Infra | 3 |
| M5-AUTH-006 | Verify Cognito custom attribute supports teacher and parent roles | BE/Infra | 2 |
| M5-AUTH-001 | Add teacher and parent role values to Lambda Authorizer | FE (integration) | 3 |
| M5-INF-006 | Enable DynamoDB Streams on LearnfyraUserProgress-{env} | BE/Infra | 2 |
| M5-TEST-016 | CDK assertion tests for all M05 tables | BE/Infra | 3 |

Sprint 1 total points: 32 (BE/Infra: 29, FE: 3)

Notes: All six table provisions (M5-INF-001 through M5-INF-005, M5-INF-015) are fully parallelisable and represent the foundation for all subsequent M05 work. M5-INF-006 (DynamoDB Streams on UserProgress) is a zero-cost operation that must not be deferred to a later sprint — deferral risks a table migration. M5-AUTH-006 must be resolved before Sprint 2 begins; if the Cognito attribute requires a CDK update the deployment must happen in this sprint. The frontend engineer handles M5-AUTH-001 (Lambda Authorizer role update) as it involves reviewing and verifying M01 Lambda Authorizer code, not building new frontend components. CDK assertion tests for all tables (M5-TEST-016) are written in this sprint alongside provisioning to catch GSI misconfigurations early.

---

## Sprint 2 — Class Management and Assignment Backend

**Goal:** Deliver the complete class management backend (create, list, get, archive, invite code, roster) and the assignment creation backend including StudentAssignmentStatus population. All acceptance criteria pass locally against DynamoDB local.

**Duration:** Week 3–4

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-BE-035 | Implement POST /user/role/upgrade endpoint | BE/Infra | 3 |
| M5-AUTH-002 | Implement per-class ownership check utility | BE/Infra | 2 |
| M5-BE-001 | classHandler — POST /classes (with invite code uniqueness) | BE/Infra | 5 |
| M5-BE-002 | classHandler — GET /classes | BE/Infra | 3 |
| M5-BE-003 | classHandler — GET /classes/{classId} | BE/Infra | 2 |
| M5-BE-005 | classHandler — DELETE /classes/{classId}/archive | BE/Infra | 3 |
| M5-BE-006 | classHandler — POST /classes/{classId}/invite | BE/Infra | 3 |
| M5-BE-036 | Validate assignmentId field on WorksheetAttempt records | BE/Infra | 2 |
| M5-BE-010 | student join — POST /student/classes/join | BE/Infra | 8 |
| M5-TEST-001 | Unit tests — classHandler | FE | 5 |
| M5-TEST-002 | Unit tests — student join flow | FE | 3 |
| M5-TEST-010 | Unit tests — student parent invite and role upgrade (role upgrade portion) | FE | 1 |

Sprint 2 total points: 40 (BE/Infra: 31, FE: 9)

Notes: This sprint is over the 32-point velocity target by 8 points. The FE engineer is unblocked on testing tasks and the BE/Infra engineer should prioritise M5-BE-001 and M5-BE-010 first. If M5-BE-010 (student join) slips due to StudentAssignmentStatus complexity, it can move to Sprint 3 — but it must not slip past Sprint 3 as assignment creation (M5-BE-014) depends on it being defined. M5-AUTH-002 (ownership utility) must be implemented before any class-scoped handler goes to review. M5-BE-036 (WorksheetAttempt assignmentId field) is a confirmation task — if the field already exists in M04 it is a 1-point check, not a 2-point implementation. API contracts for all Section 9 endpoints must be reviewed and signed off by end of this sprint to unblock frontend work.

**Revised sprint if velocity constraint is strict (cut to 32 points):** Move M5-BE-036 and M5-TEST-010 to Sprint 3.

---

## Sprint 3 — Assignment Management and Solve Session Integration

**Goal:** Deliver the complete assignment management backend (create, close, update, student assignment views) and integrate assignment context into the M04 solve session start and submit flows. StudentAssignmentStatus records are being populated end-to-end by end of this sprint.

**Duration:** Week 5–6

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-BE-014 | assignmentHandler — POST /assignments | BE/Infra | 8 |
| M5-BE-015 | assignmentHandler — GET /assignments/{assignmentId} | BE/Infra | 2 |
| M5-BE-016 | assignmentHandler — GET /classes/{classId}/assignments | BE/Infra | 5 |
| M5-BE-018 | assignmentHandler — DELETE /assignments/{assignmentId}/close | BE/Infra | 5 |
| M5-BE-021 | Integrate assignmentId into M04 solve session start | BE/Infra | 8 |
| M5-BE-022 | Integrate StudentAssignmentStatus update into M04 submit flow | BE/Infra | 5 |
| M5-AUTH-005 | Implement student assignment access control | FE | 2 |
| M5-BE-019 | student assignments — GET /student/assignments | FE | 5 |
| M5-BE-020 | student assignments — GET /student/assignments/{assignmentId} | FE | 3 |

Sprint 3 total points: 43 (BE/Infra: 33, FE: 10)

Notes: This is the heaviest backend sprint. M5-BE-021 and M5-BE-022 (M04 integration) are the most technically complex tasks in the module because they touch existing production code paths. The BE/Infra engineer should begin M5-BE-021 in Week 5 and complete M5-BE-022 in Week 6. If the M04 integration slips, M5-BE-021 and M5-BE-022 may spill into Sprint 4 — this is acceptable as long as M5-BE-014, M5-BE-016, and M5-BE-018 complete in Sprint 3 to unblock analytics development in Sprint 4. The FE engineer implements student assignment endpoints (M5-BE-019, M5-BE-020) and the access control utility (M5-AUTH-005) in parallel. Unit tests for assignments (M5-TEST-004) and solve session enforcement (M5-TEST-005) are written in Sprint 4 alongside the analytics work rather than in this sprint to avoid overloading.

**Risk flag:** M5-BE-021 requires coordinating with the M04 solveHandler. If M04 code is not in a state that supports the assignmentId parameter gracefully, a refactoring cost must be absorbed here. Estimate may increase to 13 points combined for M5-BE-021 + M5-BE-022. Flag this as a risk at Sprint 3 planning.

---

## Sprint 4 — Review Queue, Analytics Backend, and Parent Linking Backend

**Goal:** Deliver the short-answer review queue end-to-end (creation in scoring engine, teacher resolution, cascade), the class analytics and heatmap endpoints, and the complete parent linking backend.

**Duration:** Week 7–8

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-BE-025 | Integrate review queue item creation into M03 scoring engine | BE/Infra | 5 |
| M5-BE-023 | reviewHandler — GET /classes/{classId}/review-queue | BE/Infra | 3 |
| M5-BE-024 | reviewHandler — POST /review-queue/{reviewId}/resolve (with cascade) | BE/Infra | 8 |
| M5-BE-026 | analyticsHandler — GET /classes/{classId}/analytics | BE/Infra | 8 |
| M5-AUTH-003 | Implement parent-child link verification utility | BE/Infra | 2 |
| M5-AUTH-004 | Implement invite code atomic consumption | BE/Infra | 3 |
| M5-TEST-004 | Unit tests — assignmentHandler | FE | 8 |
| M5-TEST-005 | Unit tests — solve session enforcement | FE | 3 |

Sprint 4 total points: 40 (BE/Infra: 29, FE: 11)

Notes: M5-BE-025 (review queue item creation in M03) requires careful coordination — it touches the M03 scoring engine which is marked as DONE in module-status.md. The change must not break existing scoring behaviour for non-assignment submissions. M5-BE-026 (analytics overview) is the most performance-critical endpoint in the module. The BE/Infra engineer should implement a first pass in Week 7 and run load tests against DynamoDB local with 200 synthetic StudentAssignmentStatus records in Week 8. M5-AUTH-003 and M5-AUTH-004 (parent link utilities) are implemented here to unblock the parent backend tasks in Sprint 5. The FE engineer spends this sprint writing unit tests for the assignment and solve work from Sprint 3.

---

## Sprint 5 — Heatmap, Parent Dashboards, Roster Management, and Remaining Backend

**Goal:** Deliver the heatmap endpoint, all parent dashboard backend endpoints, student roster management, the worksheet library, and the student parent invite endpoint. Complete all backend unit tests and integration tests.

**Duration:** Week 9–10

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-BE-027 | analyticsHandler — GET /classes/{classId}/analytics/heatmap | BE/Infra | 8 |
| M5-BE-028 | analyticsHandler — GET /classes/{classId}/students/{studentId}/progress | BE/Infra | 3 |
| M5-BE-029 | parentHandler — POST /parent/link | BE/Infra | 8 |
| M5-BE-030 | parentHandler — GET /parent/children | BE/Infra | 2 |
| M5-BE-031 | parentHandler — DELETE /parent/children/{studentId} | BE/Infra | 2 |
| M5-BE-034 | student parent invite — POST /student/parent-invite | BE/Infra | 3 |
| M5-BE-008 | classHandler — DELETE /classes/{classId}/students/{studentId} | BE/Infra | 3 |
| M5-TEST-006 | Unit tests — reviewHandler | FE | 5 |
| M5-TEST-007 | Unit tests — review queue item creation in scoring engine | FE | 3 |
| M5-TEST-012 | Unit tests — invite code atomic consumption | FE | 3 |

Sprint 5 total points: 40 (BE/Infra: 29, FE: 11)

Notes: M5-BE-027 (heatmap) is the second analytics endpoint and shares infrastructure with M5-BE-026. Once the analytics handler skeleton exists from Sprint 4, heatmap implementation is primarily a new query and data transformation. M5-BE-029 (POST /parent/link) is the most critical parent endpoint and must handle the atomic consumption race condition defined in M5-AUTH-004. The FE engineer focuses on review queue and invite code unit tests this sprint, keeping pace with backend work so that integration tests in Sprint 6 are not blocked by untested units.

---

## Sprint 6 — Remaining Parent Dashboards, Remaining Backend, CDK Lambda Deploy, and Integration Tests

**Goal:** Deliver remaining parent dashboard endpoints, remaining backend tasks (worksheet library, role-related handlers, assignment patch/close), wire all Lambda functions in CDK, and complete all integration tests. Backend is fully complete and deployed to dev environment by end of this sprint.

**Duration:** Week 11–12

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-BE-032 | parentHandler — GET /parent/children/{studentId}/progress | BE/Infra | 5 |
| M5-BE-033 | parentHandler — GET /parent/children/{studentId}/assignments | BE/Infra | 5 |
| M5-BE-009 | classHandler — POST /classes/{classId}/students/{studentId}/parent-invite | BE/Infra | 3 |
| M5-INF-009 | Lambda function for classHandler in CDK | BE/Infra | 2 |
| M5-INF-010 | Lambda function for assignmentHandler in CDK | BE/Infra | 2 |
| M5-INF-011 | Lambda function for reviewHandler in CDK | BE/Infra | 2 |
| M5-INF-012 | Lambda function for analyticsHandler in CDK | BE/Infra | 2 |
| M5-INF-013 | Lambda function for parentHandler in CDK | BE/Infra | 2 |
| M5-INF-014 | API Gateway routes for all M05 endpoints in CDK | BE/Infra | 5 |
| M5-TEST-008 | Unit tests — analyticsHandler | FE | 8 |
| M5-TEST-009 | Unit tests — parentHandler | FE | 8 |

Sprint 6 total points: 44 (BE/Infra: 28, FE: 16)

Notes: This sprint completes the backend and infrastructure. M5-INF-009 through M5-INF-014 are CDK tasks that can be developed in parallel with the parent dashboard handler implementation — the Lambda function definitions do not depend on the handler being fully tested, only on the API contracts being frozen. M5-INF-014 (API Gateway routes) depends on all Lambda functions being defined. The FE engineer writes the two largest unit test suites (analytics and parent) this sprint. By end of Sprint 6, all backend tasks should be deployed to dev and integration tests should pass against the live dev environment.

**Remaining backend tasks for potential overlap into Sprint 6 from earlier sprints:**
- M5-BE-004 (PATCH /classes/{classId}) — P2, fits into Sprint 6 if BE/Infra capacity allows
- M5-BE-011, M5-BE-012, M5-BE-013 (worksheet library) — P1, if not already completed, must be in Sprint 6
- M5-BE-017 (PATCH /assignments/{assignmentId}) — P2, can move to Sprint 7 if needed

---

## Sprint 7 — Frontend: Teacher Dashboard (Blocked on UI Template)

**Goal:** Build the complete teacher-facing frontend in learnfyra-app: dashboard shell, class management, worksheet library, assignment creation, assignment list, and roster management.

**Duration:** Week 13–14

**Dependency:** UI template must be received before this sprint begins. If the UI template has not been received by Week 11, Sprint 7 frontend work is replaced with integration testing, performance testing against the dev environment, and remaining P2 backend tasks.

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-FE-001 | Teacher dashboard shell and class switcher | FE | 5 |
| M5-FE-002 | Class creation form | FE | 3 |
| M5-FE-003 | Class roster view | FE | 5 |
| M5-FE-004 | Worksheet library view and assignment creation form | FE | 8 |
| M5-FE-005 | Class assignments list view | FE | 5 |
| M5-FE-016 | Role upgrade and registration flow updates | FE | 3 |
| M5-TEST-013 | Integration tests — teacher full flow | BE/Infra | 8 |
| M5-TEST-017 | Boundary case tests — grade and class size | BE/Infra | 3 |

Sprint 7 total points: 40 (FE: 29, BE/Infra: 11)

Notes: The BE/Infra engineer runs integration tests (M5-TEST-013) and boundary case performance tests (M5-TEST-017) this sprint while the FE engineer builds teacher UI components. M5-FE-004 (worksheet library and assignment creation form) is the most complex frontend task and includes all assignment configuration fields — budget a full week for it. M5-FE-016 (role upgrade) must be complete before the teacher dashboard can be used end-to-end.

---

## Sprint 8 — Frontend: Teacher Analytics, Review Queue, and Student Class Flow (Blocked on UI Template)

**Goal:** Build the teacher analytics panel, heatmap, student drill-down, and review queue UI. Build the student class join flow and assignment list. Complete remaining integration tests.

**Duration:** Week 15–16

**Dependency:** UI template must be available. Sprint 7 frontend components must be complete.

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-FE-006 | Short-answer review queue view | FE | 8 |
| M5-FE-007 | Class analytics overview panel | FE | 8 |
| M5-FE-008 | Topic-by-student accuracy heatmap | FE | 8 |
| M5-FE-009 | Student drill-down progress view (teacher view) | FE | 3 |
| M5-FE-010 | Student class join flow | FE | 3 |
| M5-FE-011 | Student assignment list view | FE | 5 |
| M5-TEST-014 | Integration tests — review queue full flow | BE/Infra | 5 |
| M5-TEST-018 | Security tests — enumeration prevention | BE/Infra | 3 |
| M5-TEST-011 | Unit tests — RBAC utilities | BE/Infra | 3 |

Sprint 8 total points: 46 (FE: 35, BE/Infra: 11)

Notes: M5-FE-008 (heatmap) is the most visually complex component. A third-party data-grid or heatmap library should be evaluated in Sprint 7 planning — if a suitable library exists in the learnfyra-app dependency tree, the estimate drops to 5 points. M5-FE-006 (review queue) must be reachable from the primary dashboard without sub-menu navigation — this is a FRD hard requirement (FR-T-041) and must be verified in the FE review. If this sprint is over capacity, M5-FE-011 (student assignment list) is the lowest-risk candidate to defer to Sprint 9 since it is a read-only view.

---

## Sprint 9 — Frontend: Parent Dashboard and Final Hardening (Blocked on UI Template)

**Goal:** Build the complete parent-facing frontend. Deliver remaining frontend tasks. Complete all testing including integration, security, and P2 unit tests. Perform full release readiness check.

**Duration:** Week 17–18

**Dependency:** UI template must be available. Sprint 8 must be complete.

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M5-FE-012 | Student parent invite code generation | FE | 2 |
| M5-FE-013 | Parent dashboard shell and child switcher | FE | 5 |
| M5-FE-014 | Parent link to child form | FE | 3 |
| M5-FE-015 | Parent child progress dashboard | FE | 8 |
| M5-TEST-003 | Unit tests — worksheet library handler | FE | 3 |
| M5-TEST-010 | Unit tests — student parent invite and role upgrade | FE | 3 |
| M5-TEST-015 | Integration tests — parent linking and dashboard | BE/Infra | 5 |
| M5-BE-004 | classHandler — PATCH /classes/{classId} (P2) | BE/Infra | 2 |
| M5-BE-011 | Worksheet library — POST /teacher/library (if deferred) | BE/Infra | 3 |
| M5-BE-012 | Worksheet library — GET /teacher/library (if deferred) | BE/Infra | 3 |
| M5-INF-016 | CloudWatch alarms for M05 Lambda functions | BE/Infra | 3 |

Sprint 9 total points: 40 (FE: 24, BE/Infra: 16)

Notes: M5-FE-013 (parent dashboard shell) and M5-FE-014 (parent link form) are simpler than teacher equivalents and should complete in Week 17. M5-FE-015 (parent child progress dashboard) is the most important parent feature — it surfaces the needsAttention computation and assignment status list. The BE/Infra engineer runs the parent integration tests (M5-TEST-015) in parallel. M5-INF-016 (CloudWatch alarms) is P2 but should complete before the module ships to staging. Worksheet library backend tasks (M5-BE-011, M5-BE-012) are marked "if deferred" — they should have completed in Sprint 5 or 6; this is a safety buffer only.

---

## Summary — Sprint Point Distribution

| Sprint | Theme | Total Points | FE Points | BE/Infra Points | Weeks |
|---|---|---|---|---|---|
| Sprint 1 | Foundation: Tables, Auth, Class Core | 32 | 3 | 29 | 1–2 |
| Sprint 2 | Class Management and Assignment Backend | 40 | 9 | 31 | 3–4 |
| Sprint 3 | Assignment Management and Solve Integration | 43 | 10 | 33 | 5–6 |
| Sprint 4 | Review Queue, Analytics Backend, Parent Linking Backend | 40 | 11 | 29 | 7–8 |
| Sprint 5 | Heatmap, Parent Dashboards, Roster, Remaining Backend | 40 | 11 | 29 | 9–10 |
| Sprint 6 | Remaining Parent Backend, CDK Lambda Deploy, Integration Tests | 44 | 16 | 28 | 11–12 |
| Sprint 7 | Frontend: Teacher Dashboard (UI template required) | 40 | 29 | 11 | 13–14 |
| Sprint 8 | Frontend: Analytics, Review Queue, Student Flow | 46 | 35 | 11 | 15–16 |
| Sprint 9 | Frontend: Parent Dashboard and Final Hardening | 40 | 24 | 16 | 17–18 |
| **Total** | | **365** | **148** | **217** | **18 weeks** |

Notes: Sprints 2 through 6 run slightly over the 32-point velocity target. This is expected for a module of this complexity. The overages are absorbed by the fact that many tasks in those sprints are partially parallelisable within a single engineer's sprint (e.g., writing a handler and its GSI query in the same sitting). Sprint 3 is the highest-risk sprint due to M04 integration complexity. If Sprint 3 slips, the BE/Infra engineer carries M5-BE-021 and M5-BE-022 into Sprint 4 and descopes M5-BE-025 (review queue creation) to Sprint 5. The FE sprint work (Sprints 7–9) is gated on the UI template and cannot start earlier.

---

## Release Readiness Checklist

The following conditions must all be true before Module 5 ships to the QA environment.

**Backend and Infrastructure:**
- All five M05 DynamoDB tables (LearnfyraClasses, LearnfyraAssignments, LearnfyraStudentAssignmentStatus, LearnfyraParentChildLinks, LearnfyraParentInviteCodes) are provisioned in dev with all GSIs as specified in FRD Section 8.
- ReviewQueueItems-{env} table is provisioned with ClassPendingIndex GSI.
- DynamoDB Streams is confirmed enabled on the UserProgress table.
- TTL attribute is confirmed configured on LearnfyraParentInviteCodes-{env} (ttl field, Number type, Unix epoch).
- All five M05 Lambda functions are deployed to dev and reachable via API Gateway.
- All M05 API Gateway routes are configured with the Lambda Authorizer.
- All backend unit tests pass: M5-TEST-001 through M5-TEST-012 and M5-TEST-016.
- All integration tests pass against dev: M5-TEST-013 through M5-TEST-015.
- Boundary case tests pass: M5-TEST-017 (200-student analytics within 300ms SLA, verified with DynamoDB local synthetic data).
- Security tests pass: M5-TEST-018 (enumeration prevention returns 403 not 404 for unlinked records).
- CloudWatch alarms for all M05 Lambda functions are deployed (M5-INF-016).
- Overall test coverage is at or above 80% on all new M05 handlers.

**RBAC and Security:**
- Lambda Authorizer rejects teacher role access with non-teacher JWT (verified via M5-TEST-001).
- Lambda Authorizer rejects parent role access with non-parent JWT (verified via M5-TEST-009).
- Per-class ownership check utility is wired in every class-scoped endpoint (verified by attempting access from a non-owning teacher JWT in integration tests).
- Parent-child link verification utility is wired in every parent endpoint (verified by attempting access to an unlinked child in integration tests).
- Invite code atomic consumption is tested with a simulated concurrent request (M5-TEST-012).

**Frontend (if UI template has been received):**
- All M5-FE tasks complete in learnfyra-app (not the old frontend/ directory).
- Teacher dashboard review queue badge is visible without sub-menu navigation (verified in browser E2E test).
- Parent child switcher is visible at top level of dashboard without sub-menu navigation.
- Assignment creation form validates all fields client-side before calling POST /assignments.
- Parent link form handles all three error cases (404, 409, 410) with user-friendly messages.

**Open Questions:**
- OQ-1 through OQ-6 from FRD Section 11 must be reviewed and a decision documented for each before M05 ships to QA. Unresolved open questions must not remain open at QA entry.

---

## Known Risks

### Risk 1 — M04 Solve Session Integration Complexity

**Description:** M5-BE-021 (integrate assignmentId into M04 solve session start) and M5-BE-022 (integrate StudentAssignmentStatus update into M04 submit flow) require changes to production M04 handlers that are already deployed and tested. The M04 solveHandler and submitHandler may not have been designed with an optional assignmentId parameter in mind. Adding assignment-scoped mode enforcement and retake policy checks may require a significant refactor rather than a small extension.

**Impact:** If this slips, the entire analytics, parent dashboard, and review queue features slip with it because they all depend on StudentAssignmentStatus records being populated by the solve/submit flow.

**Mitigation:** The BE/Infra engineer reviews M04 solveHandler.js and submitHandler.js at the start of Sprint 2 (before Sprint 3 when these tasks are scheduled) and produces a written design note for BA and QA review. If a refactor is needed, the estimate is revised and Sprint 3 scope is reduced accordingly. M5-BE-036 (confirm assignmentId field on WorksheetAttempt) is done in Sprint 2 as an early signal of the integration complexity.

### Risk 2 — UI Template Delay Blocking All Frontend Sprints

**Description:** Module status shows all frontend work as "BLOCKED — awaiting UI template from product owner" as of the last update. If the UI template is not received before Week 13, Sprints 7, 8, and 9 cannot begin. The frontend engineer has limited meaningful work for those 6 weeks.

**Impact:** Module 5 frontend ships late. Parent and teacher dashboards are unavailable in the first production release of M05. The backend ships on time but the product value is not realisable without the UI.

**Mitigation:** The FE engineer is assigned integration, unit, and security testing tasks throughout Sprints 1–6 (as shown in the sprint tables). This keeps the FE engineer productive and reduces the testing backlog. If the UI template is not received by Week 10, escalate to product owner with a decision deadline. As a fallback, the FE engineer can build teacher and parent dashboards against a provisional design system and refactor once the template arrives — this is a last resort and should only be approved by the product owner explicitly.

### Risk 3 — Analytics 300ms SLA with DynamoDB Cold Reads

**Description:** The class analytics endpoint (GET /classes/{classId}/analytics) and heatmap endpoint aggregate data across multiple DynamoDB tables (StudentAssignmentStatus, UserProgress). For classes with 200 students and 10+ assignments, this may involve 2,000+ DynamoDB reads in a single Lambda invocation. DynamoDB read latency is typically 1–5ms per item with warm connections. At 2,000 reads, the theoretical minimum is 200ms in fully parallel batch reads — leaving very little margin before the 300ms SLA is breached.

**Impact:** Analytics endpoints breach the SLA in production for large classes. This degrades the teacher experience and may cause Lambda timeouts.

**Mitigation:** M5-BE-026 and M5-BE-027 must be implemented using DynamoDB BatchGetItem (not individual GetItem calls) and all reads must be issued in parallel using Promise.all(). The BE/Infra engineer runs a load test in Sprint 4 Week 8 against DynamoDB local with 200 synthetic StudentAssignmentStatus records and 200 UserProgress records. If the SLA is not achievable via batch reads alone, a pre-computed analytics aggregate record (written on each StudentAssignmentStatus update via DynamoDB Streams) is introduced as an architectural escalation. This escalation requires a new INF task and a 1-sprint delay — flag it immediately if load test results are borderline.

---

## Definition of Done for Module 5

Module 5 is complete when all of the following are true:

1. A user with role = "student" can upgrade their account to role = "teacher" or role = "parent" via a self-service endpoint. A role downgrade from teacher to student is rejected with 403.

2. A teacher can create a named class, receive a unique alphanumeric invite code, and view that class in GET /classes. A student can join the class using the invite code via POST /student/classes/join. The teacher's GET /classes/{classId}/students roster includes the enrolled student within one API call of joining.

3. A teacher can create an assignment referencing an existing worksheetId (no new AI generation triggered), configure mode, timeLimit, dueDate, openAt, closeAt, and retakePolicy. StudentAssignmentStatus records are written for all enrolled students at assignment creation time with status = "not-started".

4. A student opening an assignment with mode = "test" receives no per-question feedback until final submission. A student opening an assignment with mode = "practice" receives per-question feedback. A student cannot access an assignment outside its openAt/closeAt window.

5. A student's assignment submission (via the M04 submit flow) updates the corresponding StudentAssignmentStatus record to status = "submitted" with the score and submittedAt timestamp.

6. A short-answer response with fuzzy-match confidence below 0.75 creates a ReviewQueueItem record visible in GET /classes/{classId}/review-queue. A teacher can approve or override the score. A score override cascades to WorksheetAttempt, UserProgress, and StudentAssignmentStatus atomically.

7. GET /classes/{classId}/analytics returns correct average scores, completion rates, weakest topics, and students below threshold using only GSI-based queries. Response time is under 300ms for a class with 200 students.

8. GET /classes/{classId}/analytics/heatmap returns a correct student-by-topic accuracy matrix with null for topics with no data. Response time is under 300ms for a class with 200 students.

9. A student can generate a parent invite code (student-initiated flow). A teacher can generate a parent invite code for a student in their class (teacher-initiated flow). Both codes expire after 48 hours via DynamoDB TTL, not a scheduled job.

10. A parent can consume a valid invite code via POST /parent/link, establishing a ParentChildLink record. Consuming the same code a second time returns 409. Consuming an expired code returns 410. Both checks are application-level (not relying on TTL having fired).

11. A parent can view their linked child's activity summary, assignment status (sourced from StudentAssignmentStatus records), and needs-attention topics (topics below 60% accuracy across 3+ attempts) via read-only endpoints. A parent with no active link to a studentId receives 403 (not 404) for all child-scoped requests.

12. A teacher cannot access data for a class they do not own. A parent cannot access data for a child they are not linked to. Both checks return 403. Enumeration of class IDs and student IDs by unauthorized users returns 403 responses that are indistinguishable from 403 responses for existing-but-unauthorized records.

13. All M5-TEST-001 through M5-TEST-018 pass in CI. Test coverage for all new M05 handlers is at or above 80%.

14. All five M05 DynamoDB tables are provisioned with correct GSIs as specified in FRD Section 8. DynamoDB Streams is enabled on UserProgress. TTL is configured on LearnfyraParentInviteCodes.

15. All M05 endpoints are accessible in the dev environment via API Gateway and return correct responses verified by M5-TEST-013 through M5-TEST-015 integration tests.
