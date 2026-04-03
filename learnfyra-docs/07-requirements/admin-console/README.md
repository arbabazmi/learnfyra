# Module 7 — Admin Console

**Status:** Design Finalised — Ready for BA Agent FRD Generation
**Date:** 2026-04-02
**Depends On:** Modules 1-6 (all must be complete before implementation)

---

## Overview

Module 7 introduces two admin tiers: Platform Admin (super_admin) and School Admin (school_admin). The admin console is a separate CloudFront distribution (admin.learnfyra.com) sharing the same API Gateway but deployable independently with IP restriction for super_admin access.

## Documents in This Directory

| File | Purpose |
|------|---------|
| design-discussion.md | All resolved design decisions (admin tiers, COPPA deletion, moderation, cost dashboard, school management, RBAC matrix) |
| ba-agent-prompt.md | Full prompt to generate FRD + Task Tracker + Sprint Plan |

## Key Design Decisions

- **Two admin tiers:** super_admin (2-5 globally, platform ops) and school_admin (customer-facing, school-scoped)
- **super_admin bootstrap:** First admin created by CDK deployment (Cognito email as CDK parameter)
- **Separate deployment:** admin.learnfyra.com as independent Vite app, IP-restricted at CloudFront for super_admin
- **COPPA deletion:** Hard delete of all user data in defined order, ComplianceLog written before deletion begins, double-confirmation UI
- **Question Bank moderation:** status field (active/flagged/deleted) — flagged excluded from Module 2 Step Functions GSI query
- **AI cost dashboard:** Read-only, query-time computed from GenerationLog GSIs, daily token budget ceiling in Config table
- **Audit log:** Append-only, no TTL, indefinite retention, every state-changing admin action must produce an AuditLog record
- **4 new DynamoDB tables:** School, SchoolUserLink, AuditLog, ComplianceLog
- **3 additive changes:** Users.suspended, QuestionBank.status, Class.schoolId

## Phase Scope

**Phase 2A (Platform Admin):** super_admin role, CDK bootstrap, IP-restricted admin console, user management, COPPA deletion, question bank moderation, AI cost dashboard, Config table editor, school creation, audit log, compliance log, daily token budget ceiling.

**Phase 2B (School Admin):** school_admin role, teacher invite flow, teacher roster, school-wide student view, school analytics, bulk assignment, school configuration.

## Next Steps

1. Run BA Agent prompt to generate MODULE_7_FRD_Admin.md, MODULE_7_TaskTracker.md, MODULE_7_SprintPlan.md
2. Review and approve FRD
3. Complete Modules 1-6 before beginning implementation
