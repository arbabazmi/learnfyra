# Project Plan — Module 5 (Teacher & Parent) + Module 7 (Admin Console)

**Created:** 2026-04-02
**Branch:** feature/module-5-7-requirements
**Status:** Requirements Finalised — Awaiting FRD Generation

---

## 1. Executive Summary

Two major feature modules are ready for formal requirements generation:

| Module | Scope | Phase | Prerequisites | Est. Sprints |
|--------|-------|-------|---------------|-------------|
| M05 — Teacher & Parent | Class management, assignments, review queue, parent linking, analytics | Phase 1 | Modules 1-4 complete | 4-5 sprints |
| M07 — Admin Console | Platform admin, school admin, COPPA, moderation, cost dashboard | Phase 2 | Modules 1-6 complete | 6-8 sprints |

**M05 is the next module to implement.** M07 is Phase 2 and should not begin until all Phase 1 modules (M01-M06) are stable.

---

## 2. Current Platform State (as of 2026-04-02)

| Module | Backend | Frontend | Tests | CDK | Blocking M05? |
|--------|---------|----------|-------|-----|---------------|
| M01 Auth | DONE | BLOCKED (UI template) | DONE | DONE | No (backend ready) |
| M02 Question Bank | TODO | N/A | TODO | TODO | No (M05 doesn't depend on QB) |
| M03 Worksheet Generator | DONE (no bank) | DONE | DONE | DONE | No |
| M04 Solve & Submit | TODO | BLOCKED (UI template) | TODO | DONE | **Yes** — M05 progress tracking needs WorksheetAttempt data |
| M05 Progress & Reporting | TODO | BLOCKED | TODO | TODO | Self — this is the module |
| M06 Class Management | TODO | BLOCKED | TODO | TODO | **Partial** — existing M06 spec covers basic CRUD, M05 new design expands significantly |
| M07 Admin | TODO | BLOCKED | TODO | TODO | No (Phase 2) |

---

## 3. Module 5 — Teacher & Parent: Implementation Roadmap

### 3.1 Relationship to Existing M06 (Class Management)

The existing M06 spec (`07-requirements/class-management/README.md`) covers basic class CRUD, join codes, and simple assignment. The new Module 5 design discussion (`07-requirements/teacher-parent/design-discussion.md`) is a **superset** that replaces and expands M06 with:

- Assignment configuration (mode, time limit, due date, availability window, retake policy)
- Short-answer review queue with score cascade
- Class analytics dashboard (overview + heatmap)
- Full parent role (linking flows, progress dashboard, multi-child)
- 5 new DynamoDB tables (vs M06's 2 tables)

**Decision:** The new M05 FRD supersedes the existing M06 class-management spec. M06 becomes infrastructure-only (CDK).

### 3.2 New DynamoDB Tables

| Table | PK | SK | GSIs | TTL |
|-------|----|----|------|-----|
| Class | CLASS#classId | METADATA | teacherId-index | No |
| Assignment | ASSIGNMENT#assignmentId | METADATA | classId-index, classId+dueDate-index | No |
| StudentAssignmentStatus | ASSIGNMENT#assignmentId | STUDENT#studentId | studentId-index (inverted) | No |
| ParentChildLink | USER#parentId | CHILD#childId | childId-index (inverted) | No |
| ParentInviteCode | INVITE#code | METADATA | — | expiresAt (48h) |

### 3.3 New API Endpoints (27 total)

**Teacher (16):**
- POST /classes, GET /classes, GET /classes/{id}, DELETE /classes/{id}/archive
- POST /classes/{id}/invite, GET /classes/{id}/students, DELETE /classes/{id}/students/{studentId}
- POST /assignments, GET /assignments/{id}, GET /classes/{id}/assignments
- PATCH /assignments/{id}, DELETE /assignments/{id}/close
- GET /classes/{id}/review-queue, POST /review-queue/{id}/resolve
- GET /classes/{id}/analytics, GET /classes/{id}/analytics/heatmap

**Parent (5):**
- POST /parent/link, GET /parent/children, DELETE /parent/children/{studentId}
- GET /parent/children/{studentId}/progress, GET /parent/children/{studentId}/assignments

**Student (3):**
- POST /student/parent-invite, GET /student/assignments, GET /student/assignments/{id}

**Cross-cutting (3):**
- POST /classes/join (student joins class)
- GET /classes/me (teacher or student — role-based response)
- Existing auth handler amendments for parent-child link

### 3.4 Estimated Sprint Breakdown

| Sprint | Theme | Key Deliverables |
|--------|-------|-----------------|
| S1 (Week 1-2) | Data Model + Core Backend | DynamoDB tables (CDK local), Class CRUD handler, join code logic |
| S2 (Week 3-4) | Assignments + Roster | Assignment CRUD, StudentAssignmentStatus lifecycle, roster management |
| S3 (Week 5-6) | Review Queue + Analytics | Short-answer review queue, score cascade, class overview + heatmap queries |
| S4 (Week 7-8) | Parent Role | Parent-child linking (both flows), parent dashboard, invite code lifecycle |
| S5 (Week 9-10) | Integration + Polish | End-to-end testing, RBAC hardening, performance validation, frontend (if template available) |

### 3.5 Critical Path

```
M04 Backend (Solve/Submit) must complete first
  └─> M05 S1: DynamoDB tables + Class CRUD
        └─> M05 S2: Assignments + StudentAssignmentStatus
              ├─> M05 S3: Review Queue + Analytics (needs assignment data)
              └─> M05 S4: Parent Role (needs StudentAssignmentStatus for homework view)
                    └─> M05 S5: Integration testing
```

### 3.6 Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| M04 backend not complete | Blocks M05 entirely — no WorksheetAttempt data | Prioritise M04 backend completion |
| UI template still not received | Frontend blocked | Backend is fully testable via API; frontend can catch up later |
| StudentAssignmentStatus query performance at scale | Slow teacher dashboard | Design GSIs for O(1) lookups from day one; load test with 500 students |

---

## 4. Module 7 — Admin Console: Implementation Roadmap

### 4.1 Phase Structure

M07 is split into two sub-phases:

**Phase 2A — Platform Admin (super_admin):** 4-5 sprints
- CDK bootstrap (first super_admin via deployment parameter)
- Separate admin console Vite app with IP restriction
- User management (search, suspend, force-logout, COPPA deletion)
- Question bank moderation (flag/unflag/soft-delete)
- AI cost dashboard (GenerationLog aggregation)
- Config table editor with type validation
- School creation + school_admin assignment
- AuditLog + ComplianceLog

**Phase 2B — School Admin (school_admin):** 2-3 sprints
- School admin role + school-scoped RBAC
- Teacher invite flow + roster management
- School-level analytics
- Bulk worksheet assignment
- School configuration (grade range, active subjects)

### 4.2 New DynamoDB Tables

| Table | PK | SK | GSIs | TTL |
|-------|----|----|------|-----|
| School | SCHOOL#schoolId | METADATA | schoolAdminId-index | No |
| SchoolUserLink | SCHOOL#schoolId | USER#userId | userId-index (inverted) | No |
| AuditLog | AUDIT#auditId | METADATA | actorId+timestamp, targetEntityId+timestamp | **No TTL** — indefinite retention |
| ComplianceLog | COMPLIANCE#requestId | METADATA | — | **No TTL** — permanent retention |

### 4.3 Additive Changes to Existing Tables

| Table | New Field | Purpose |
|-------|-----------|---------|
| Users | `suspended` (boolean) | Checked by Lambda Authorizer, cached 5min |
| QuestionBank | `status` (active/flagged/deleted) | Moderation; Step Functions GSI filters on active only |
| Class | `schoolId` (nullable string) | Affiliates class with a school |

### 4.4 Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Lambda Authorizer change (suspension check) | Adds DynamoDB read to every authenticated request | In-memory cache with 5min TTL |
| COPPA deletion partial failure | Legal exposure | ComplianceLog written before deletion; partial state recorded; no rollback |
| Admin console as separate deployment | Additional CI/CD complexity | Own CDK stack, independent deploy pipeline |

---

## 5. Action Items

### Immediate (This Branch)

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Requirement files organised in 07-requirements/ | Done | Complete |
| 2 | Project plan created | Done | Complete |
| 3 | Run BA Agent prompt for M05 FRD + Task Tracker + Sprint Plan | BA Agent | **Next** |
| 4 | Run BA Agent prompt for M07 FRD + Task Tracker + Sprint Plan | BA Agent | **Next** |
| 5 | Review and approve both FRDs | Product Owner | Pending |
| 6 | Update master-task-list.md and sprint-plan.md with new tasks | BA Agent | After FRD approval |

### Pre-Implementation (Before M05 Coding Starts)

| # | Action | Status |
|---|--------|--------|
| 1 | Complete M04 backend (Solve & Submit) | TODO |
| 2 | UI template received from product owner | BLOCKED |
| 3 | DynamoDB local tables created for M05 (5 tables) | TODO |
| 4 | API contracts frozen for M05 endpoints | TODO |

---

## 6. Document Index

```
07-requirements/
  teacher-parent/
    README.md                        -- this module's overview
    design-discussion.md             -- all resolved design decisions
    ba-agent-prompt.md               -- prompt to generate FRD/tasks/sprints
    MODULE_5_FRD_Teacher_Parent.md   -- (to be generated by BA Agent)
    MODULE_5_TaskTracker.md          -- (to be generated by BA Agent)
    MODULE_5_SprintPlan.md           -- (to be generated by BA Agent)
  admin-console/
    README.md                        -- this module's overview
    design-discussion.md             -- all resolved design decisions
    ba-agent-prompt.md               -- prompt to generate FRD/tasks/sprints
    MODULE_7_FRD_Admin.md            -- (to be generated by BA Agent)
    MODULE_7_TaskTracker.md          -- (to be generated by BA Agent)
    MODULE_7_SprintPlan.md           -- (to be generated by BA Agent)

09-progress/
  project-plan-m5-m7.md             -- this file
```
