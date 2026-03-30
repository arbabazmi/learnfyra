# Question Bank Production Migration — Program Package
**Created:** 2026-03-27  
**Package Version:** 1.0  
**Status:** Ready for execution  

---

## 📦 Package Contents

This package contains everything needed to complete the Question Bank production migration from local JSON storage to DynamoDB:

### 1. [NEXT_PHASE_MASTER_DOSSIER.md](./NEXT_PHASE_MASTER_DOSSIER.md)
**Purpose:** Comprehensive current state assessment and planning document  
**Contents:**
- Current state snapshot (done vs pending vs blocked)
- Canonical requirements with acceptance criteria
- Architecture and data contracts
- Phase-by-phase execution workflow
- Risk analysis and mitigations
- Go/No-Go checklist
- Open questions and decisions

**Use this for:** Understanding the complete scope, reviewing architecture decisions, tracking overall progress

---

### 2. [NEXT_PHASE_EXECUTION_BACKLOG.md](./NEXT_PHASE_EXECUTION_BACKLOG.md)
**Purpose:** Prioritized task board with clear ownership and timelines  
**Contents:**
- P0 tasks (blocking production)
- P1 tasks (hardening)
- P2 tasks (future enhancements)
- Sprint goal and completion criteria
- Task sequencing (serial vs parallel)
- Estimated effort per task
- Definition of done

**Use this for:** Daily standup tracking, sprint planning, task assignment, progress monitoring

---

### 3. [NEXT_PHASE_AGENT_PROMPTS.md](./NEXT_PHASE_AGENT_PROMPTS.md)
**Purpose:** Ready-to-run prompts for each specialist agent  
**Contents:**
- dev-agent prompts (implementation)
- devops-agent prompts (infrastructure + deployment)
- qa-agent prompts (testing + verification)
- code-reviewer-agent prompts (security review)
- ba-agent prompts (documentation)

**Use this for:** Copy-paste task execution, agent handoff, consistent task framing

---

## 🎯 Quick Start Guide

### For Orchestrator (Program Manager)
1. Read [NEXT_PHASE_MASTER_DOSSIER.md](./NEXT_PHASE_MASTER_DOSSIER.md) Section 10 (Open Questions) — resolve before starting
2. Review [NEXT_PHASE_EXECUTION_BACKLOG.md](./NEXT_PHASE_EXECUTION_BACKLOG.md) P0 tasks
3. Assign tasks to agents using prompts from [NEXT_PHASE_AGENT_PROMPTS.md](./NEXT_PHASE_AGENT_PROMPTS.md)
4. Track progress in backlog document
5. Verify Go/No-Go checklist before production deploy

### For Individual Contributors
1. Receive task assignment from orchestrator (task ID like QB-IMPL-001)
2. Open [NEXT_PHASE_AGENT_PROMPTS.md](./NEXT_PHASE_AGENT_PROMPTS.md) and find your prompt
3. Copy prompt → paste into agent session → execute
4. Mark task DONE in [NEXT_PHASE_EXECUTION_BACKLOG.md](./NEXT_PHASE_EXECUTION_BACKLOG.md) when complete
5. Report blockers to orchestrator

### For Reviewers
1. Read [NEXT_PHASE_MASTER_DOSSIER.md](./NEXT_PHASE_MASTER_DOSSIER.md) Section 3 (Architecture)
2. Review implementation against acceptance criteria in Section 2
3. Follow code-reviewer prompt in [NEXT_PHASE_AGENT_PROMPTS.md](./NEXT_PHASE_AGENT_PROMPTS.md)
4. Document findings and sign-off

---

## 📊 Current State Summary

### ✅ What's Done
- **Local implementation:** Full question bank adapter working with in-memory storage
- **Bank-first assembly:** Integrated into worksheet generator
- **API handler:** REST endpoints for question bank management
- **Tests:** 100+ tests covering local adapter and integration flows
- **CDK stub:** Admin Lambda defined (but not configured for DynamoDB)

### ⚠️ What's Pending
- **DynamoDB adapter:** Implementation of production storage backend (P0)
- **CDK infrastructure:** DynamoDB table definition and IAM grants (P0)
- **Tests:** Unit tests for DynamoDB adapter (P0)
- **Deployment:** Dev → staging → prod rollout (P0)
- **Monitoring:** CloudWatch alarms and operational runbooks (P1)

### 🚫 What's Blocked
- **None:** All dependencies are met, ready to proceed

---

## ⏱️ Estimated Timeline

### Standard Mode (Balanced)
**Serial execution (1 developer):**
- P0 tasks: 8-12 hours
- P1 tasks: 6-8 hours
- **Total: 14-20 hours (2-3 days of focused work)**

**Parallel execution (team of 3):**
- Day 1: Implementation (dev) + Infrastructure (devops)
- Day 2: Testing (qa) + Deployment to dev (devops) + Verification (qa)
- Day 3: Review (code-reviewer) + Staging/Prod deploy (devops)
- **Total: 3 days with coordination**

---

## 🎯 Success Criteria

### P0 Gate (Production Readiness)
- [ ] DynamoDB adapter fully implements adapter interface
- [ ] All unit tests pass (local + dynamodb)
- [ ] Integration tests pass with QB_ADAPTER=dynamodb
- [ ] CDK synth passes with zero warnings
- [ ] Dev smoke test passed
- [ ] Staging smoke test passed
- [ ] Code review approved with no critical findings
- [ ] CloudWatch alarms configured
- [ ] Rollback procedure tested

### P1 Gate (Operational Excellence)
- [ ] Integration tests added to CI
- [ ] Migration runbook documented and reviewed
- [ ] Monitoring dashboard configured
- [ ] Production deployment successful
- [ ] Performance metrics within SLA

---

## 📈 Risk Assessment

**Overall Risk Level:** LOW

**Rationale:**
- Well-defined scope with clear acceptance criteria
- Local implementation provides reference behavior
- Strong test coverage already in place
- Reversible changes (can rollback to local mode)
- No user-facing breaking changes

**Top Risks:**
1. DynamoDB query performance (medium) — mitigation: GSI design + caching strategy
2. Cost spike (low) — mitigation: PAY_PER_REQUEST billing + cost alarms
3. Migration complexity (low) — mitigation: fresh start, no existing prod data

---

## 🔄 Workflow Integration

### With Default Agent Workflow
This package follows the default delivery workflow from `.github/instructions/default-agent-workflow.instructions.md`:

```
1. program-orchestrator-agent → Produces this package ✅
2. dev-agent                   → Uses prompts from NEXT_PHASE_AGENT_PROMPTS.md
3. qa-agent                    → Uses prompts from NEXT_PHASE_AGENT_PROMPTS.md
4. code-reviewer-agent         → Uses prompts from NEXT_PHASE_AGENT_PROMPTS.md
```

**Additional agents used:**
- devops-agent: Infrastructure and deployment tasks
- ba-agent: Documentation and migration planning

### Coordination Points
- **After dev-agent completes implementation:** devops-agent deploys to dev
- **After qa-agent verifies smoke test:** code-reviewer-agent reviews code
- **After code review approved:** devops-agent deploys to staging → prod

---

## 📋 Next Actions (Immediate)

### For Orchestrator
1. ✅ Review Open Questions in NEXT_PHASE_MASTER_DOSSIER.md Section 10
   - Decide: Do we need to migrate existing data? (likely NO)
   - Decide: Question bank global or scoped to teacher? (default: global)
2. ✅ Assign QB-IMPL-001 to dev-agent
3. ✅ Assign QB-CDK-001 to devops-agent
4. ✅ Schedule daily standup for next 3 days
5. ✅ Monitor progress in NEXT_PHASE_EXECUTION_BACKLOG.md

### For Dev-Agent (First Task)
1. Open [NEXT_PHASE_AGENT_PROMPTS.md](./NEXT_PHASE_AGENT_PROMPTS.md)
2. Navigate to "🔧 DEV-AGENT Prompts → Prompt 1"
3. Execute: Implement DynamoDB Question Bank Adapter (QB-IMPL-001)
4. Estimate: 2-3 hours
5. Mark done when acceptance criteria met

### For DevOps-Agent (First Task)
1. Open [NEXT_PHASE_AGENT_PROMPTS.md](./NEXT_PHASE_AGENT_PROMPTS.md)
2. Navigate to "🏗️ DEVOPS-AGENT Prompts → Prompt 1"
3. Execute: Add DynamoDB Table to CDK Stack (QB-CDK-001)
4. Estimate: 1-2 hours
5. Mark done when CDK synth passes

---

## 📚 Reference Documents

### Already in Repository
- `CLAUDE.md` — Agent teams system prompt (project overview)
- `docs/tasks/backend/M01-M03-REQUIREMENTS-AND-TASKS.md` — Full backend requirements
- `docs/specs/modules/M02-question-bank-spec.md` — Question bank spec
- `src/questionBank/localQuestionBankAdapter.js` — Reference implementation

### Created by This Package
- `docs/operations/NEXT_PHASE_MASTER_DOSSIER.md` — Current state and plan
- `docs/operations/NEXT_PHASE_EXECUTION_BACKLOG.md` — Task backlog
- `docs/operations/NEXT_PHASE_AGENT_PROMPTS.md` — Agent prompts

### To Be Created
- `src/questionBank/dynamoQuestionBankAdapter.js` — DynamoDB adapter (QB-IMPL-001)
- `tests/unit/dynamoQuestionBankAdapter.test.js` — Unit tests (QB-TEST-001)
- `docs/runbooks/question-bank-migration.md` — Migration runbook (QB-DEPLOY-002)
- `docs/reviews/question-bank-dynamodb-review.md` — Code review report (QB-REVIEW-001)

---

## 🆘 Troubleshooting

### "I don't know where to start"
→ Read NEXT_PHASE_MASTER_DOSSIER.md Section 1 (Current State Snapshot)  
→ Then read NEXT_PHASE_EXECUTION_BACKLOG.md top P0 tasks

### "What should I work on next?"
→ Check NEXT_PHASE_EXECUTION_BACKLOG.md Sprint Board (TODO section)  
→ Pick highest priority task that is not blocked

### "I'm blocked on a dependency"
→ Report to orchestrator with task ID and blocker details  
→ Orchestrator will coordinate with dependent agent

### "I found a critical issue during implementation"
→ Document issue in task notes  
→ Escalate to orchestrator immediately  
→ Do NOT proceed to next task until resolved

### "Acceptance criteria are unclear"
→ Refer to NEXT_PHASE_MASTER_DOSSIER.md Section 2 (Requirements)  
→ If still unclear, consult with ba-agent or orchestrator

---

## ✅ Package Validation

**Checklist for orchestrator before distributing to team:**

- [x] NEXT_PHASE_MASTER_DOSSIER.md created and complete
- [x] NEXT_PHASE_EXECUTION_BACKLOG.md created with all P0/P1 tasks
- [x] NEXT_PHASE_AGENT_PROMPTS.md created with prompts for all agents
- [x] README.md (this file) created with quick start guide
- [x] All three docs cross-reference each other correctly
- [x] Task IDs consistent across all documents
- [x] Acceptance criteria clear and testable
- [x] Dependencies mapped correctly
- [x] Effort estimates realistic
- [x] Risk assessment complete

**Status:** ✅ Package ready for distribution

---

## 📞 Contact

**Program Orchestrator:** program-orchestrator-agent  
**Project Repository:** https://github.com/arbabazmi/learnfyra  
**Documentation Location:** `/docs/operations/`  

---

**Package created:** 2026-03-27  
**Next review date:** After QB-VERIFY-001 completes (dev smoke test)  
**Version:** 1.0
