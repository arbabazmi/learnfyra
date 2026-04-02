# Module 5 — Teacher & Parent Roles

**Status:** Design Finalised — Ready for BA Agent FRD Generation
**Date:** 2026-04-02
**Depends On:** Modules 1-4, Module 6

---

## Overview

Module 5 introduces Teacher and Parent as relational roles. Teachers orchestrate cohorts of learners via classes, assignments, analytics dashboards, and a short-answer review queue. Parents link to children via invite codes and get read-only progress visibility.

## Documents in This Directory

| File | Purpose |
|------|---------|
| design-discussion.md | All resolved design decisions (class scoping, assignment config, parent linking, RBAC matrix, DynamoDB tables) |
| ba-agent-prompt.md | Full prompt to generate FRD + Task Tracker + Sprint Plan |

## Key Design Decisions

- **Two parent-child linking flows:** student-initiated (profile settings) and teacher-initiated (for young students Grades 1-4)
- **5 new DynamoDB tables:** Class, Assignment, StudentAssignmentStatus, ParentChildLink, ParentInviteCode
- **StudentAssignmentStatus** is the critical join record between Assignment and WorksheetAttempt — used by teacher dashboard, parent dashboard, and student assignment view
- **ParentInviteCode** uses DynamoDB TTL for auto-expiry (48h) — no scheduled cleanup job
- **RBAC:** Teacher scoped to own classes only; Parent scoped to linked children only
- **Deferred:** Email notifications (architecture must support DynamoDB Streams for future Lambda consumer without schema migration)

## Phase 1 Scope

**Teacher:** Class CRUD, invite codes, roster management, worksheet assignment (mode/timer/due date/availability window/retake policy), class analytics (overview + heatmap), short-answer review queue, RBAC on all endpoints.

**Parent:** Student-initiated and teacher-initiated linking, read-only child progress dashboard, multi-child switcher, RBAC on all endpoints.

## Next Steps

1. Run BA Agent prompt to generate MODULE_5_FRD_Teacher_Parent.md, MODULE_5_TaskTracker.md, MODULE_5_SprintPlan.md
2. Review and approve FRD
3. Begin implementation per sprint plan
