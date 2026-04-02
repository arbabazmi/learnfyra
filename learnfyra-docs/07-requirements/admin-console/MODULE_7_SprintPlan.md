# Module 7: Admin Console — Sprint Plan

| Field | Value |
|---|---|
| Module | Module 7: Admin Console |
| Version | 1.0 |
| Date | 2026-04-02 |
| Status | Draft |
| Prepared By | BA Agent |
| Source FRD | MODULE_7_FRD_Admin.md v1.0 |
| Source Task Tracker | MODULE_7_TaskTracker.md v1.0 |

---

## Assumptions

| Assumption | Value |
|---|---|
| Sprint length | 2 weeks |
| Team size | 2 engineers: 1 frontend (FE), 1 backend/infra (BE/Infra) |
| Velocity per engineer per sprint | 16 story points |
| Total velocity per sprint | 32 story points |
| Pre-condition | Modules 1–6 complete and stable before Sprint 1 begins |
| Phase gate | All P1 (super_admin) tasks must be allocated to sprints before any P2 (school_admin) tasks |
| Parallelisation | Admin console FE and BE can be parallelised once the API contracts defined in the FRD are agreed. FE starts scaffolding in the same sprint as early BE work. |
| Blocked tasks | M7-FE-001 through M7-FE-019 are blocked until the UI template is received from the product owner. FE sprint allocations below assume the template is available before Sprint 2. If the template is delayed, FE tasks shift and sprint totals reduce accordingly. |
| Open question OQ-7-001 | The SchoolTeacherInvite table approach (separate table) is assumed as the default. If the decision changes, M7-INF-013 and M7-BE-024 estimates may change by 1–2 points. |
| Open question OQ-7-003 | One CloudFront distribution (admin.learnfyra.com) with WAF path-level IP restriction is assumed. If a second distribution is needed for school_admin, M7-INF-008 and M7-AUTH-004 grow by approximately 5 points. |

---

## Sprint 1 — Infrastructure Foundation and Auth Amendments

**Goal:** All four new DynamoDB tables provisioned, existing tables amended, Lambda Authorizer updated with suspended flag check and admin role recognition, and CDK admin console stack scaffolded.

**Duration:** Weeks 1–2

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-INF-001 | Provision AuditLog DynamoDB table | BE/Infra | 3 |
| M7-INF-002 | Provision ComplianceLog DynamoDB table | BE/Infra | 2 |
| M7-INF-003 | Provision School DynamoDB table | BE/Infra | 2 |
| M7-INF-004 | Provision SchoolUserLink DynamoDB table | BE/Infra | 2 |
| M7-INF-005 | Add suspended field to Users table | BE/Infra | 1 |
| M7-INF-006 | Add status field to QuestionBank table | BE/Infra | 2 |
| M7-INF-007 | Add schoolId field to Class table | BE/Infra | 1 |
| M7-AUTH-001 | Lambda Authorizer — super_admin role support | BE/Infra | 2 |
| M7-AUTH-003 | Lambda Authorizer — suspended flag check | BE/Infra | 5 |
| M7-TEST-002 | Unit tests — suspended flag check in Authorizer | BE/Infra | 3 |
| M7-FE-001 | Admin console Vite app scaffold | FE | 5 |
| M7-FE-002 | Admin console authentication flow | FE | 3 |

**Sprint 1 total:** 31 points (BE/Infra: 21, FE: 8)

**Notes:**
- M7-INF-001 through M7-INF-007 are the critical path for all subsequent backend work and must all complete in this sprint.
- M7-AUTH-003 is the highest-risk task in Phase 2A because it adds a DynamoDB read to every authenticated request. The 5-minute in-memory cache must be implemented and unit tested (M7-TEST-002) within this sprint to confirm the latency impact is acceptable before any other work depends on it.
- M7-AUTH-001 must complete in this sprint so that BE handlers in Sprint 2 can be tested with the correct Authorizer behaviour.
- M7-FE-001 and M7-FE-002 begin immediately so the FE engineer is not blocked in Sprint 2. These tasks depend only on Module 1 auth being stable, which is a pre-condition.
- Risk: If M7-AUTH-003 reveals unacceptable latency overhead from the DynamoDB suspended check, the team must escalate before Sprint 2 begins. Mitigation: run a load test of the Authorizer with the suspended check enabled before Sprint 1 ends.

---

## Sprint 2 — CDK Admin Stack, AuditLog Utility, Core User Management Backend, and Admin UI Shell

**Goal:** Admin console CloudFront distribution deployed, AuditLog utility built and tested, core user management handlers live (search, view, suspend, unsuspend), and the admin UI navigation shell and user management pages scaffolded.

**Duration:** Weeks 3–4

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-INF-008 | Deploy separate admin console CDK stack | BE/Infra | 8 |
| M7-INF-010 | Grant Cognito force-logout IAM permission | BE/Infra | 1 |
| M7-BE-022 | AuditLog writer utility | BE/Infra | 3 |
| M7-TEST-001 | Unit tests — AuditLog writer utility | BE/Infra | 3 |
| M7-TEST-016 | CDK assertions tests — new tables and constructs | BE/Infra | 5 |
| M7-FE-014 | Admin console navigation shell and role-based menu | FE | 3 |
| M7-FE-003 | User management list and search page | FE | 5 |
| M7-AUTH-004 | CloudFront WAF IP restriction for /admin/* paths | FE (CDK config coordination with BE/Infra) | 3 |

**Sprint 2 total:** 31 points (BE/Infra: 20, FE: 11)

**Notes:**
- M7-INF-008 is the largest task in this sprint. It must complete before M7-AUTH-004, as the WAF rule set is part of the admin console CloudFront distribution construct.
- M7-BE-022 (AuditLog writer utility) is a shared dependency for almost every handler in Sprints 3 and 4. It must be complete and tested before those sprints begin. The utility does not expose an endpoint and can be built and unit-tested without an API Gateway route.
- M7-TEST-016 (CDK assertions) can be written in parallel with M7-INF-008 — the test author defines the expected constructs from the FRD and the CDK construct author writes the CDK to match.
- M7-FE-003 requires the API contract for GET /admin/users (defined in the FRD) but does not require the backend handler to be deployed. FE uses a mock API response for development.
- M7-AUTH-004 requires coordination between FE (WAF IP list sourced from product owner) and BE/Infra (CDK construct). The ops team's approved CIDR list must be provided to the BE engineer before this task begins.

---

## Sprint 3 — User Action Handlers, COPPA Deletion, Question Bank Moderation Backend

**Goal:** All user action handlers (force-logout, role change, COPPA deletion) and all question bank moderation handlers built and unit tested. Module 2 Step Functions GSI filter amended.

**Duration:** Weeks 5–6

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-BE-001 | User search and list handler | BE/Infra | 5 |
| M7-BE-002 | User full profile handler | BE/Infra | 3 |
| M7-BE-003 | Suspend user handler | BE/Infra | 3 |
| M7-BE-004 | Unsuspend user handler | BE/Infra | 2 |
| M7-BE-005 | Force-logout handler | BE/Infra | 3 |
| M7-BE-006 | Role change handler | BE/Infra | 5 |
| M7-AUTH-005 | Self-role-change prevention | BE/Infra | 1 |
| M7-BE-018 | Module 2 Step Functions GSI — status=active filter | BE/Infra | 3 |
| M7-TEST-006 | Unit tests — Module 2 GSI status filter | BE/Infra | 3 |
| M7-FE-004 | User profile and action panel | FE | 8 |

**Sprint 3 total:** 36 points (BE/Infra: 28, FE: 8)

**Notes:**
- This sprint is BE/Infra-heavy at 28 points. The split is acceptable because M7-FE-004 is a single substantial FE task (user profile with action panel). If the BE estimate proves optimistic, M7-BE-006 (5 points) can slide to Sprint 4 — it is a dependency of M7-FE-004 only for the role-change button, which can be stubbed in the UI.
- M7-BE-018 must be deployed in the same release window as M7-INF-006 (from Sprint 1). If there is any gap between the status field being written on new records and the GSI filter being applied, flagged questions could still be returned by the Step Functions workflow. Deployment must be coordinated.
- M7-TEST-006 validates the Module 2 GSI filter and must run against DynamoDB local with seeded flagged and deleted questions.
- M7-BE-007 (COPPA deletion, 13 points) is deliberately deferred to Sprint 4 to give it its own sprint focus. It is the most legally critical handler and must not be squeezed alongside other work.

---

## Sprint 4 — COPPA Deletion Handler, Config Editor Backend, Cost Dashboard Backend, School Management Backend

**Goal:** COPPA deletion handler built and fully tested, Config editor handlers complete, cost dashboard handlers complete, school management handlers complete.

**Duration:** Weeks 7–8

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-BE-007 | COPPA deletion handler | BE/Infra | 13 |
| M7-TEST-003 | Unit tests — COPPA deletion handler | BE/Infra | 8 |
| M7-TEST-013 | Unit tests — ComplianceLog write ordering | BE/Infra | 3 |
| M7-BE-008 | Question bank list handler | FE collab, BE/Infra | 3 |
| M7-BE-009 | Flag question handler | BE/Infra | 2 |
| M7-BE-010 | Unflag question handler | BE/Infra | 2 |

**Sprint 4 total:** 31 points (BE/Infra: 31, FE: 0)

**Notes:**
- This sprint is fully backend-focused. M7-BE-007 at 13 points occupies nearly half the sprint and must be the BE engineer's primary focus.
- M7-TEST-003 (8 points) and M7-TEST-013 (3 points) are both required before the COPPA deletion handler is considered done. These tests must be written and passing before the sprint ends — QA cannot be deferred.
- The FE engineer has no allocated tasks in this sprint. They should use this sprint to: (a) complete any carry-over from Sprint 3, (b) build M7-FE-005 (COPPA double-confirmation modal) and M7-FE-006 (force-logout confirmation dialog) using mock API responses, and (c) begin M7-FE-007 (question bank moderation page).
- M7-BE-008 through M7-BE-011 begin in this sprint. Flagging and unflagging are low-complexity (2 points each) and can be completed quickly after M7-BE-007.
- Risk: M7-BE-007 is the most complex handler in the module. If it is not complete by mid-sprint, the team must decide whether to carry it into Sprint 5. Partial delivery (handler code complete but not fully tested) is not acceptable for a COPPA deletion endpoint — it must ship with full test coverage.

---

## Sprint 5 — Question Bank, Config, Cost Dashboard, School Backend Completion; COPPA and Question Bank UI

**Goal:** All remaining P1 backend handlers complete (question bank moderation, Config editor, cost dashboard, school management, AuditLog and ComplianceLog queries); COPPA deletion UI and question bank UI complete.

**Duration:** Weeks 9–10

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-BE-011 | Soft-delete question handler | BE/Infra | 2 |
| M7-BE-012 | Cost dashboard aggregation handler | BE/Infra | 8 |
| M7-BE-013 | Top-expensive generations handler | BE/Infra | 3 |
| M7-BE-014 | Config list handler | BE/Infra | 2 |
| M7-BE-015 | Config single record handler | BE/Infra | 1 |
| M7-BE-016 | Config write handler | BE/Infra | 5 |
| M7-TEST-004 | Unit tests — Config write handler | BE/Infra | 3 |
| M7-TEST-010 | Unit tests — cost dashboard aggregation | BE/Infra | 5 |
| M7-TEST-007 | Unit tests — question bank moderation handlers | FE collab, BE/Infra | 5 |
| M7-FE-005 | COPPA deletion double-confirmation modal | FE | 5 |
| M7-FE-006 | Force-logout confirmation dialog | FE | 2 |
| M7-FE-007 | Question bank moderation page | FE | 8 |

**Sprint 5 total:** 49 points (BE/Infra: 34, FE: 15)

**Notes:**
- This sprint is above the nominal 32-point velocity. It is planned at 49 points because several tasks are low-complexity (M7-BE-011 at 2, M7-BE-014 at 2, M7-BE-015 at 1) and can be batched efficiently. If the team finds velocity insufficient, M7-BE-012 (8 points) can be deferred to Sprint 6 — cost dashboard is read-only and not a blocking dependency for any other handler.
- M7-TEST-010 includes a performance assertion for the 30-day window (must return within 2 seconds). If the GenerationLog GSI structure does not support this latency at representative data volumes, the team must flag it as a risk before Sprint 5 ends.
- M7-FE-007 (question bank moderation page) at 8 points is substantial. FE should timebox it to 6 days and carry the remainder to Sprint 6 if needed.

---

## Sprint 6 — Module 2 Token Budget Amendment, School Backend, AuditLog/ComplianceLog Backend, Remaining P1 UI

**Goal:** Daily token budget ceiling enforcement live (Module 2 amendment), school management and audit/compliance query handlers complete, cost dashboard and Config editor UI complete, school management UI complete.

**Duration:** Weeks 11–12

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-INF-009 | CDK bootstrap super_admin seed Lambda | BE/Infra | 5 |
| M7-INF-011 | Seed Config table with Bedrock pricing constants | BE/Infra | 2 |
| M7-INF-012 | Add CONFIG#SCHEMA entries for Module 7 keys | BE/Infra | 1 |
| M7-BE-017 | School management handlers (POST, GET, PATCH /admin/schools) | BE/Infra | 5 |
| M7-BE-019 | Module 2 generation Lambda — token budget ceiling check | BE/Infra | 5 |
| M7-TEST-005 | Unit tests — daily token budget ceiling | BE/Infra | 5 |
| M7-TEST-017 | Integration tests — token budget ceiling end-to-end | BE/Infra | 5 |
| M7-TEST-012 | Unit tests — school management handlers | BE/Infra | 3 |
| M7-FE-008 | AI cost dashboard page | FE | 8 |
| M7-FE-009 | Config table editor page | FE | 8 |

**Sprint 6 total:** 47 points (BE/Infra: 31, FE: 16)

**Notes:**
- M7-INF-009 (CDK bootstrap Lambda) is placed in Sprint 6 rather than Sprint 1 because it depends on M7-INF-002 (ComplianceLog table) being live and tested. It does not block any handler development.
- M7-BE-019 must be deployed atomically with M7-INF-011 and M7-INF-012 (Config seeds). The Lambda reads CONFIG#DAILY_TOKEN_BUDGET from DynamoDB; if the Config record does not exist, the check must fail-open (generation proceeds). Verify this behaviour in M7-TEST-005.
- M7-TEST-017 is an integration test requiring DynamoDB local with seeded GenerationLog records. It must pass before Sprint 6 ends.
- M7-FE-008 and M7-FE-009 are both 8-point tasks. If the FE engineer cannot complete both, M7-FE-009 (Config editor) is lower user-facing risk and can slide to Sprint 7.

---

## Sprint 7 — AuditLog/ComplianceLog Handlers, Remaining P1 UI, Phase 2A Integration Testing

**Goal:** AuditLog and ComplianceLog query handlers complete, school management UI complete, all P1 integration tests passing, Phase 2A feature-complete and ready for go/no-go review.

**Duration:** Weeks 13–14

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-BE-020 | AuditLog query handler | BE/Infra | 5 |
| M7-BE-021 | ComplianceLog query handler | BE/Infra | 2 |
| M7-AUTH-002 | Lambda Authorizer — school_admin role support | BE/Infra | 3 |
| M7-TEST-008 | Unit tests — user management action handlers | BE/Infra | 5 |
| M7-TEST-009 | Unit tests — role change and self-change prevention | BE/Infra | 3 |
| M7-TEST-011 | Unit tests — AuditLog query scoping | BE/Infra | 3 |
| M7-TEST-014 | Integration tests — COPPA deletion end-to-end | BE/Infra | 8 |
| M7-FE-010 | School management page | FE | 8 |
| M7-FE-011 | Assign school admin flow | FE | 3 |
| M7-FE-012 | Audit log viewer page | FE | 5 |

**Sprint 7 total:** 45 points (BE/Infra: 29, FE: 16)

**Notes:**
- M7-AUTH-002 (school_admin Authorizer support) is placed here rather than Sprint 1 because it is only needed for Phase 2B handlers (M7-BE-023 through M7-BE-031), none of which begin until Sprint 8. However, it is good practice to have it done and tested before Phase 2B sprint planning begins.
- M7-TEST-014 (COPPA integration test, 8 points) is the most important test in the module. It must pass before Phase 2A go/no-go. If the integration test reveals a data ordering problem in M7-BE-007, Sprint 7 must not close until it is fixed and the test passes.
- M7-FE-012 (Audit log viewer) requires M7-BE-020 to be deployed or mocked. Given both are in the same sprint, FE should develop against a mock response and switch to the live endpoint at sprint end.
- By end of Sprint 7, all P1 tasks must be complete, all P1 unit tests must be passing, and M7-TEST-014 (COPPA integration) and M7-TEST-017 (token budget integration) must be passing. This is the Phase 2A go/no-go gate.

---

## Sprint 8 — Phase 2A Hardening and Phase 2B Infrastructure

**Goal:** Phase 2A compliance log UI complete, any P1 bug fixes resolved, Phase 2B infrastructure provisioned (SchoolTeacherInvite table), and Phase 2B Authorizer amendment deployed.

**Duration:** Weeks 15–16

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-FE-013 | Compliance log viewer page | FE | 3 |
| M7-TEST-016 carry-over (if incomplete) | CDK assertions — any remaining assertions | BE/Infra | — |
| M7-INF-013 | SchoolTeacherInvite DynamoDB table | BE/Infra | 2 |
| M7-BE-023 | School admin teacher list handler | BE/Infra | 3 |
| M7-BE-024 | School admin teacher invite handler | BE/Infra | 3 |
| M7-BE-025 | Teacher invite redemption endpoint | BE/Infra | 5 |
| M7-BE-030 | School config read handler | BE/Infra | 1 |
| M7-BE-031 | School config update handler | BE/Infra | 3 |
| M7-TEST-018 | Unit tests — school admin teacher management handlers | BE/Infra | 5 |
| M7-FE-015 | School admin — teacher list and invite page | FE | 5 |
| M7-FE-019 | School admin — school configuration page | FE | 3 |

**Sprint 8 total:** 33 points (BE/Infra: 22, FE: 11)

**Notes:**
- This sprint formally begins Phase 2B work. The Phase 2A go/no-go review must have occurred and passed before Phase 2B sprint work begins (see Release Readiness Checklist below).
- M7-FE-013 (compliance log UI) is P1 work that was not scheduled in earlier sprints due to point budget constraints. It is low-risk (read-only page) and can be completed quickly.
- M7-BE-025 (teacher invite redemption) is the most complex Phase 2B backend task in this sprint because it spans both the admin console and the main platform. It requires coordination between the admin console's invite-generation flow and the main platform's sign-in flow.
- Risk: Teacher invite redemption requires a decision on OQ-7-001 (which table stores the invite code). The suggested default (SchoolTeacherInvite table) is assumed. If the product owner changes this decision, M7-INF-013 and M7-BE-024 and M7-BE-025 estimates may shift.

---

## Sprint 9 — Phase 2B School Admin Core Handlers and UI

**Goal:** School student roster, school analytics, and bulk assignment handlers complete and tested; corresponding UI pages complete.

**Duration:** Weeks 17–18

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-BE-026 | School admin teacher remove handler | BE/Infra | 5 |
| M7-BE-027 | School student roster handler | BE/Infra | 5 |
| M7-BE-028 | School analytics handler | BE/Infra | 8 |
| M7-BE-029 | Bulk assignment handler | BE/Infra | 5 |
| M7-TEST-019 | Unit tests — bulk assignment handler | BE/Infra | 5 |
| M7-TEST-020 | Unit tests — school analytics scoping | BE/Infra | 3 |
| M7-FE-016 | School admin — student roster page | FE | 3 |
| M7-FE-017 | School admin — analytics dashboard page | FE | 5 |
| M7-FE-018 | School admin — bulk assignment page | FE | 5 |

**Sprint 9 total:** 44 points (BE/Infra: 31, FE: 13)

**Notes:**
- M7-BE-028 (school analytics, 8 points) is the most complex Phase 2B handler. It queries across UserProgress and StudentAssignmentStatus records scoped to a school. The complexity comes from the join pattern (Class records must be queried first to get the set of classes, then individual student records must be aggregated). This handler should be started on day 1 of the sprint.
- M7-TEST-020 verifies that analytics data from other schools is never included in a school_admin's response. This is a security-critical test (data isolation) and must pass before Phase 2B go/no-go.
- M7-FE-017 (analytics dashboard) requires M7-BE-028 to be deployed or mocked. The 60% accuracy threshold highlighting requires a product decision — the default is 60% and is stored in the School record's config. If the product owner wants this threshold to be configurable, that is a Phase 3 enhancement.

---

## Sprint 10 — Phase 2B Completion, Integration Testing, and Phase 2B Go/No-Go

**Goal:** All Phase 2B tasks complete, all P2 integration tests passing, Phase 2B feature-complete and ready for production release.

**Duration:** Weeks 19–20

| Task ID | Title | Assignee | Points |
|---|---|---|---|
| M7-TEST-015 | Integration tests — school admin cross-school scoping | BE/Infra | 5 |
| M7-TEST-016 remaining Phase 2B assertions | CDK assertions for Phase 2B constructs | BE/Infra | 3 |
| Carry-over buffer | Any incomplete tasks from Sprint 9 | Both | — |
| Smoke test — Phase 2A production deployment | Manual smoke test of all P1 flows in prod | Both | — |
| Smoke test — Phase 2B staging deployment | Manual smoke test of all P2 flows in staging | Both | — |

**Sprint 10 total:** ~16–20 points allocated, remainder is buffer for carry-over and smoke testing.

**Notes:**
- Sprint 10 is intentionally under-allocated to provide a carry-over buffer for any tasks that slip from Sprints 8 or 9, and to accommodate the go/no-go review process and production deployment.
- M7-TEST-015 is the Phase 2B equivalent of M7-TEST-014 — it is the data-isolation integration test that must pass before school admin features go to production.
- Phase 2A production deployment should occur at the end of Sprint 7 (after go/no-go gate). Sprint 10 confirms the production deployment is stable before Phase 2B is enabled.

---

## Release Readiness Checklist — Phase 2A Go/No-Go

The following criteria must all be met before Phase 2A (super_admin features) is released to production.

- All P1 tasks in the Task Tracker are marked Complete.
- All P1 unit tests are passing with 80% or above code coverage on all new Lambda handlers.
- M7-TEST-014 (COPPA deletion integration test) is passing against DynamoDB local.
- M7-TEST-017 (token budget ceiling integration test) is passing against DynamoDB local.
- M7-TEST-016 (CDK assertions) is passing with no assertion failures.
- The Lambda Authorizer suspended flag check (M7-AUTH-003) has been load-tested and confirmed to add less than 50ms average latency overhead per request with a warm cache.
- The admin console CloudFront distribution is deployed to dev and qa environments and the IP restriction is confirmed working (super_admin access blocked from non-approved IPs).
- The COPPA deletion flow has been reviewed and approved by the ops team's legal counsel (NFR-COMP-003). This is an external gate — do not release to prod without legal sign-off.
- The CDK bootstrap super_admin seed Lambda (M7-INF-009) has been tested in a fresh dev environment deployment.
- The AuditLog table has been confirmed append-only: a code review confirms no UpdateItem or DeleteItem calls exist against the AuditLog table in any handler.
- The ComplianceLog table has been confirmed to have no TTL configured (CDK assertion test M7-TEST-016 covers this).
- The daily token budget ceiling check (M7-BE-019) has been smoke-tested: confirm that setting CONFIG#DAILY_TOKEN_BUDGET to 1 causes the next POST /worksheet to return 503, and that setting it to a high value restores normal behaviour.
- All open questions (OQ-7-001 through OQ-7-005) have been resolved and any design changes from the resolutions have been incorporated.
- No P0 or P1 bugs are open against Module 7 in the issue tracker.

---

## Release Readiness Checklist — Phase 2B Go/No-Go

The following criteria must all be met before Phase 2B (school_admin features) are released to production.

- Phase 2A go/no-go has been passed and Phase 2A is live in production.
- All P2 tasks in the Task Tracker are marked Complete.
- All P2 unit tests are passing with 80% or above code coverage on all new school_admin handlers.
- M7-TEST-015 (school admin cross-school scoping integration test) is passing. This is the most critical Phase 2B quality gate — school_admin data isolation must be confirmed before any school customers are onboarded.
- The school teacher invite redemption flow (M7-BE-025) has been tested end-to-end: a school_admin generates a code, a teacher redeems it, and the SchoolUserLink record appears correctly.
- Bulk assignment (M7-BE-029) has been smoke-tested with three classes to confirm parallel assignment calls succeed and the AuditLog record captures all three classIds.
- School analytics (M7-BE-028) has been tested with at least one school containing data across two subjects and two grade levels.
- The school_admin role has been confirmed unable to access any /admin/* endpoint (Authorizer returns 403 confirmed by test or manual verification).
- No P0 or P1 bugs are open against Phase 2B in the issue tracker.

---

## Known Risks

### Risk 1 — Lambda Authorizer Latency from Suspended Flag Check

**Description:** M7-AUTH-003 adds a DynamoDB GetItem call to every authenticated request when the in-memory cache is cold (every 5 minutes per userId). At high request concurrency, this could increase Authorizer latency and add DynamoDB read cost.

**Likelihood:** Medium. The Authorizer is already performing a JWT validation step; one additional DynamoDB read is the marginal cost.

**Impact:** High. If average Authorizer latency increases by more than 100ms, it affects every authenticated user on the main platform (not just admin users), because the Authorizer is shared.

**Mitigation:** Unit-test the cache logic rigorously (M7-TEST-002). Load-test the Authorizer with the suspended check enabled before Sprint 1 ends (using a staging environment with representative user counts). If latency is unacceptable, the alternative is to embed the suspended flag in the JWT at token-issue time (requires Module 1 token-issue flow amendment) — this would be a design decision requiring BA approval before implementation.

### Risk 2 — COPPA Deletion Legal Review Timeline

**Description:** Phase 2A go/no-go requires legal review of the COPPA deletion flow by the ops team's legal counsel (NFR-COMP-003). Legal review timelines are outside the engineering team's control and could block the production release.

**Likelihood:** Medium. Legal review is a new requirement introduced by Module 7 and has not been scheduled.

**Impact:** High. Without legal sign-off, Phase 2A cannot go to production. This could delay the entire Module 7 release by multiple weeks.

**Mitigation:** The product owner must schedule the legal review no later than the start of Sprint 5 (when the COPPA deletion handler implementation is underway). The legal reviewer should be provided with the COPPA deletion flow description from Section 10.4 of the FRD and the ComplianceLog data model from Section 8.4. Engineering should make the handler available in a staging environment for the reviewer's inspection no later than Sprint 7.

### Risk 3 — Cost Dashboard Query Latency at Scale

**Description:** GET /admin/cost-dashboard?window=30d is a query-time aggregation of up to 30 days of GenerationLog records. At production scale (potentially hundreds of thousands of generation events), the GSI scan plus aggregation in Lambda may exceed the 2-second NFR.

**Likelihood:** Low in Phase 2A (low user volume). Medium in Phase 3 (growth scenario).

**Impact:** Medium. A slow cost dashboard is an ops inconvenience, not a user-facing problem. However, it sets a poor precedent for admin tooling quality.

**Mitigation:** In Sprint 5 (when M7-BE-012 and M7-TEST-010 are built), run the cost dashboard query against a seeded test dataset representing 30 days of generation events at 10x the expected Phase 2A volume. If the 2-second NFR is not met, evaluate: (a) adding a GenerationLog GSI with a date-partitioned key to limit the scan range, or (b) introducing the pre-aggregated DailyCostSummary table from Phase 3 scope. Escalate the decision to the product owner before Sprint 6 begins.

---

## Definition of Done — Module 7

A task is done when:
- All acceptance criteria in the FRD for the corresponding FR are met and verifiable.
- Unit tests for the task are written, passing, and contribute to 80% or above line coverage for the handler or component.
- No UpdateItem or DeleteItem call against the AuditLog table exists in any code path introduced by the task.
- All state-changing handlers introduced by the task write an AuditLog record on success.
- The AuditLog write is fire-and-forget: a failed AuditLog write does not cause the primary action to fail.
- All endpoints introduced by the task have an explicit RBAC rule enforced by the Lambda Authorizer.
- For any endpoint touching school_admin scope: a test confirms that a school_admin cannot access data outside their schoolId.
- CDK constructs introduced by the task have corresponding CDK assertion tests.
- Code has been reviewed by at least one other engineer.
- The task has been deployed to the dev environment and smoke-tested.

Module 7 as a whole is done when:
- All P1 and P2 tasks are done per the definition above.
- Both Phase 2A and Phase 2B go/no-go checklists are passed.
- Phase 2A features are live in production and confirmed stable for at least one week.
- Phase 2B features are live in staging and confirmed stable for at least one week.
- The module-status.md file is updated to reflect all backend, frontend, test, and CDK statuses as DONE.
- Legal sign-off on the COPPA deletion flow is documented and stored in the ops team's records.
