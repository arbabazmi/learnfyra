# Next Phase Execution Backlog

Status legend: `todo`, `in-progress`, `done`, `blocked`

## 1) Current Workflow Status Board

| Workflow | Status | Evidence | Immediate Next Step |
|---|---|---|---|
| Generate + Export | done | API and exporter modules plus integration tests | Maintain regression coverage |
| Online Solve + Scoring (local) | done | Solve/submit handlers, scorer/resultBuilder, solve integration tests | Prepare AWS route/function deployment plan |
| Auth basic login/register/logout | in-progress | auth handler + middleware + unit tests | Add OAuth/Cognito production path design |
| Student/class/progress/analytics | in-progress | handlers + unit tests | Align with spec-grade reporting contracts |
| Rewards | in-progress | rewards handler + rewards engine tests | Add full persistence and aggregation contract |
| Admin control plane | todo | specs and ops runbooks only | Define first implementation slice and API boundaries |
| AWS parity expansion | in-progress | CDK for core generate/download path | Add solve/submit and extended module deployment wiring |

## 2) P0 Backlog (Must Execute Now)

| ID | Item | Owner Agent | Status | Dependencies | Acceptance Hook | Test Hook |
|---|---|---|---|---|---|---|
| P0-1 | Normalize canonical requirement list across specs/design/qa/ops docs | ba-agent | in-progress | Canonical specs index | Approved requirement matrix with no duplicates | Traceability table complete |
| P0-2 | Create architecture contracts for first three implementation slices | architect-agent | todo | P0-1 | API/data contracts approved | QA validation map attached |
| P0-3 | Lock sprint scope and owner map for next 2-3 slices | program-orchestrator-agent | in-progress | P0-1, P0-2 | Scope signoff complete | Each slice mapped to automated tests |
| P0-4 | Build local->AWS readiness checklist for solve/submit deployment | devops-agent | todo | P0-2 | Deployment delta document approved | Dry-run commands verified |

## 3) P1 Backlog (Build and Verify)

| ID | Item | Owner Agent | Status | Dependencies | Acceptance Hook | Test Hook |
|---|---|---|---|---|---|---|
| P1-1 | Implement first approved cross-module vertical slice | dev-agent | todo | P0 complete | Slice criteria pass | Unit + integration tests pass |
| P1-2 | Validate first slice and run regression sweep | qa-agent | todo | P1-1 | No blocker defects | QA checklist and results report |
| P1-3 | Run severity-ranked code review gate | code-reviewer-agent | todo | P1-1 | No unresolved critical findings | Review report archived |
| P1-4 | Update UX layer for affected flows only | ui-agent | todo | P1-1 | UX acceptance checks pass | Responsive + a11y notes logged |

## 4) P2 Backlog (Scale and Harden)

| ID | Item | Owner Agent | Status | Dependencies | Acceptance Hook | Test Hook |
|---|---|---|---|---|---|---|
| P2-1 | Expand infra wiring for non-core modules (as approved) | devops-agent | todo | P1 stable | Infra plan approved | Synth/diff validation plus smoke tests |
| P2-2 | Expand analytics/rewards/admin rollout plan | program-orchestrator-agent | todo | P1 stable | Milestone roadmap approved | Test matrix attached |
| P2-3 | Cost and operations hardening package | devops-agent | todo | P2-1 | Monitoring and rollback plan approved | Alert simulation and runbook checks |

## 5) Active Decisions Needed

| Decision | Needed By | Blocking IDs |
|---|---|---|
| Priority stream for first cross-module slice | Product/Orchestrator | P0-2, P0-3, P1-1 |
| Authority order for conflicting docs | Product/BA | P0-1 |
| Local-complete vs AWS-ready definition | Product/DevOps | P0-4, P2-1 |

## 6) Definition of Done for Each Backlog Item

- Functional scope implemented for the item.
- Acceptance criteria marked pass/fail with evidence.
- Required automated tests added or updated.
- No unresolved critical review findings.
- Dossier and backlog status updated in the same change.
