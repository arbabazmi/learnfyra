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


## 7) AI Worksheet Generator — Concrete Task Items (2026-03-27)

| ID | Item | Owner Agent | Status | Dependencies | Acceptance Hook | Test Hook |
|---|---|---|---|---|---|---|
| AI-1 | Ensure POST /api/generate is fully backward compatible | dev-agent | todo | — | Response shape unchanged for legacy clients | Integration test for legacy request |
| AI-2 | Implement bank-first assembly: query bank before AI | dev-agent | todo | — | Banked questions selected first | Unit/integration test for bank-first flow |
| AI-3 | Call AI only for question slots not covered by bank | dev-agent | todo | AI-2 | AI called for gap only | Test: partial bank coverage |
| AI-4 | Validate and store all AI-generated questions in bank | dev-agent | todo | AI-3 | Only valid questions stored | Test: invalid question rejection |
| AI-5 | Track question reuse (reuseCount) for banked questions | dev-agent | todo | AI-2 | reuseCount incremented on use | Test: reuseCount update |
| AI-6 | Renumber all questions 1..N after merge | dev-agent | todo | AI-3 | Sequential numbering in worksheet | Test: numbering correctness |
| AI-7 | Add provenance metadata (banked vs AI) per question | dev-agent | todo | AI-3 | Provenance field present | Worksheet JSON inspection |
| AI-8 | Write solve-data.json on every generation | dev-agent | todo | AI-3 | solve-data.json present | File existence + content test |
| AI-9 | Enforce auth and role restrictions on /api/generate | dev-agent | todo | — | Only teacher/admin allowed | Auth/role test |
| AI-10 | Enforce per-user/role generation quota | dev-agent | todo | — | Quota check enforced | Quota test |
| AI-11 | Prevent repeated questions within same worksheet | dev-agent | todo | — | No duplicates in worksheet | Test: duplicate prevention |
| AI-12 | Enforce repeat cap policy for future sessions | dev-agent | todo | — | Repeat cap enforced | Repeat cap test |
| AI-13 | Allow admin to configure repeat-cap override | dev-agent | todo | — | Override policy applied | Admin override test |
| AI-14 | Ensure CORS headers on all responses | dev-agent | todo | — | CORS present on all responses | CORS test |
| AI-15 | Ensure error responses use structured contract | dev-agent | todo | — | { success: false, error, errorCode, ... } | Error path test |
| AI-16 | Ensure input validation for all fields | dev-agent | todo | — | Invalid input rejected | Validation test |
| AI-17 | Ensure S3 upload of worksheet and answer key | dev-agent | todo | — | Files present in S3 | S3 inspection test |
| AI-18 | Ensure API key loaded from SSM Parameter Store | dev-agent | todo | — | API key not hardcoded | Lambda env test |
| AI-19 | Add/verify integration test for full bank-first flow | qa-agent | todo | AI-2, AI-3, AI-8 | End-to-end test passes | Integration test result |
| AI-20 | Document all new/changed API/data contracts | ba-agent | todo | AI-1..AI-18 | Docs updated | Spec/contract review |
