# Backend Task Progress Tracker

Last updated: 2026-03-26
Owner: Backend execution stream

## Status Legend
- completed
- in-progress
- not-started

## Numbered Backend Plan

| # | Task ID | Module | Title | Status |
|---|---|---|---|---|
| 1 | M01-BE-01 | M01 | Define OAuth and local auth API contracts | completed |
| 2 | M01-BE-02 | M01 | Implement auth backend foundation | completed |
| 3 | M02-BE-01 | M02 | Define question bank schema and API contracts | completed |
| 4 | M02-BE-02 | M02 | Implement question bank backend CRUD/search | completed |
| 5 | M03-BE-01 | M03 | Define bank-first generator contract | completed |
| 6 | M03-BE-02 | M03 | Implement generator preparation slice | completed |
| 7 | M04-BE-01 | M04 | Define solve and submit API/scoring contract | completed |
| 8 | M04-BE-02 | M04 | Implement solve and submit backend/scoring logic | completed |
| 9 | M05-BE-01 | M05 | Define progress and reporting contracts | completed |
| 10 | M05-BE-02 | M05 | Implement progress and reporting backend | completed |
| 11 | M06-BE-01 | M06 | Define class relationship contracts | completed |
| 12 | M06-BE-02 | M06 | Implement class relationship backend logic | completed |
| 13 | M07-BE-01 | M07 | Define admin control-plane contracts | completed |
| 14 | M07-BE-02 | M07 | Implement admin control-plane backend logic | completed |
| 15 | INT-BE-01 | Cross-module | Integration contract and risk map | completed |
| 16 | INT-BE-02 | Cross-module | Integration hardening implementation | completed |
| 17 | RC-BE-01 | Release | Backend contract lock and compatibility check | completed |
| 18 | RC-BE-02 | Release | Final backend hardening for release candidate | completed |

## Update Rule
- Move only one item to in-progress at a time.
- When a task finishes, set it to completed and move the next task to in-progress.
- Keep this file as the single source of backend execution status.

## Prompt Pack (Tasks 3-18)

### 3) M02-BE-01
```text
Agent: backend-developer-agent + architect-agent
Mode: standard
Task ID: M02-BE-01
Goal: Define question bank schema and API contracts.
Inputs: docs/specs/modules/M02-question-bank-spec.md, docs/specs/modules/M03-worksheet-generator-spec.md, docs/tasks/backend/BACKEND_TASK_PROGRESS_TRACKER.md
Deliverables: question entity schema, filter/search contract, dedupe rule summary, reuseCount behavior.
Constraints: backend only, no frontend edits, contract-first, no implementation yet.
Output: implementation-ready API/data contract + validation/error model + open blockers.
```

### 4) M02-BE-02
```text
Agent: backend-developer-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M02-BE-02
Goal: Implement question bank backend CRUD/search from approved M02-BE-01 contract.
Inputs: docs/specs/modules/M02-question-bank-spec.md, backend handlers for question bank (create/update as needed), tests/unit/*
Deliverables: GET/POST/GET-by-id question bank endpoints, filter support, dedupe enforcement, tests.
Constraints: backend only, Lambda-compatible responses, CORS consistency, no scope creep.
Output: files changed, reviewer findings/resolution, test results, risks.
```

### 5) M03-BE-01
```text
Agent: backend-developer-agent + architect-agent
Mode: standard
Task ID: M03-BE-01
Goal: Define bank-first worksheet generator contract.
Inputs: docs/specs/modules/M03-worksheet-generator-spec.md, docs/architecture/diagrams/worksheet_architecture.md, src/ai/generator.js
Deliverables: request/response contract updates, bank lookup->generate-missing flow, provenance metadata contract.
Constraints: backend only, backward compatibility required.
Output: implementation-ready contract + error model + compatibility notes.
```

### 6) M03-BE-02
```text
Agent: backend-developer-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M03-BE-02
Goal: Implement generator preparation slice based on M03-BE-01.
Inputs: src/ai/generator.js, related helper modules, tests/unit/*generator*
Deliverables: contract-aligned generator updates, bank hooks, provenance tracking, regression-safe behavior.
Constraints: backend only, preserve old request compatibility.
Output: files changed, review findings, test outcomes, blockers.
```

### 7) M04-BE-01
```text
Agent: backend-developer-agent + architect-agent
Mode: standard
Task ID: M04-BE-01
Goal: Define solve/submit API and scoring contract.
Inputs: docs/specs/modules/M04-solve-submit-spec.md, backend/handlers/solveHandler.js, backend/handlers/submitHandler.js
Deliverables: solve schema (no answer leakage), submit request/response schema, scoring rule matrix, validation errors.
Constraints: backend only, security-first.
Output: implementation-ready contract + edge-case handling rules.
```

### 8) M04-BE-02
```text
Agent: backend-developer-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M04-BE-02
Goal: Implement solve/submit backend logic and scoring alignment.
Inputs: backend/handlers/solveHandler.js, backend/handlers/submitHandler.js, src/solve/scorer.js, src/solve/resultBuilder.js
Deliverables: secure solve response, deterministic scoring, submit validation, tests.
Constraints: backend only, no answer leakage, Lambda/CORS consistency.
Output: files changed, review findings, tests pass/fail, risks.
```

### 9) M05-BE-01
```text
Agent: backend-developer-agent + architect-agent
Mode: standard
Task ID: M05-BE-01
Goal: Define progress/reporting backend contracts.
Inputs: docs/specs/modules/M05-progress-reporting-spec.md, backend/handlers/progressHandler.js, backend/handlers/analyticsHandler.js
Deliverables: progress write/read schema, analytics summary schema, validation/error model.
Constraints: backend only, role-aware contracts.
Output: implementation-ready contract + aggregation rules.
```

### 10) M05-BE-02
```text
Agent: backend-developer-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M05-BE-02
Goal: Implement progress/reporting backend from approved contract.
Inputs: backend/handlers/progressHandler.js, backend/handlers/analyticsHandler.js, related src helpers, tests/unit/*
Deliverables: contract-compliant progress APIs, analytics outputs, role checks, tests.
Constraints: backend only, regression-safe updates.
Output: files changed, review results, test report, open issues.
```

### 11) M06-BE-01
```text
Agent: backend-developer-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M06-BE-01
Goal: Define class relationship contracts.
Inputs: docs/specs/modules/M06-class-relationship-spec.md, backend/handlers/classHandler.js, backend/handlers/studentHandler.js
Deliverables: class CRUD contract, enrollment/membership contract, ownership/auth matrix, validation errors.
Constraints: backend only, duplicate membership prevention required.
Output: implementation-ready contract + authorization matrix.
```

### 12) M06-BE-02
```text
Agent: backend-developer-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M06-BE-02
Goal: Implement class relationship backend logic from M06-BE-01 contract.
Inputs: backend/handlers/classHandler.js, backend/handlers/studentHandler.js, related tests
Deliverables: membership/ownership enforcement, duplicate checks, contract-aligned responses, tests.
Constraints: backend only, Lambda/CORS consistency.
Output: files changed, review findings, QA results, blockers.
```

### 13) M07-BE-01
```text
Agent: backend-developer-agent + architect-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M07-BE-01
Goal: Define admin control-plane contracts.
Inputs: docs/specs/modules/M07-admin-control-plane-spec.md, backend admin-related handlers
Deliverables: admin endpoint contracts, authz matrix, audit event schema, idempotency/safety rules.
Constraints: backend only, strict admin-only enforcement.
Output: implementation-ready contract + error model + risk notes.
```

### 14) M07-BE-02
```text
Agent: backend-developer-agent + architect-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: M07-BE-02
Goal: Implement admin control-plane backend logic.
Inputs: admin-related backend handlers, middleware, tests/unit/*
Deliverables: admin-only checks, audit logging for sensitive actions, contract-aligned responses, tests.
Constraints: backend only, no privilege escalation paths.
Output: files changed, reviewer severity findings, QA pass/fail, blockers.
```

### 15) INT-BE-01
```text
Agent: backend-developer-agent + architect-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: INT-BE-01
Goal: Define cross-module integration contract and risk map.
Inputs: all touched backend handlers M01-M07, docs/operations/DUAL_AGENT_EXECUTION_PLAN.md
Deliverables: unified error model, response consistency rules, auth claim propagation map, compatibility matrix.
Constraints: backend only, no new features.
Output: integration contract + prioritized risk list.
```

### 16) INT-BE-02
```text
Agent: backend-developer-agent + architect-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: INT-BE-02
Goal: Implement integration hardening across backend modules.
Inputs: handlers and shared utils touched in INT-BE-01, tests
Deliverables: normalized responses/errors, consistent auth checks, shared helper cleanup, regression tests.
Constraints: backend only, non-breaking changes only.
Output: files changed, review findings, test evidence, unresolved risks.
```

### 17) RC-BE-01
```text
Agent: backend-developer-agent + architect-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: RC-BE-01
Goal: Freeze backend release contract and compatibility guarantees.
Inputs: docs/tasks/backend/BACKEND_TASK_PROGRESS_TRACKER.md, all backend API contracts from M01-M07/INT
Deliverables: frozen API inventory, compatibility notes, non-blocking technical debt list.
Constraints: backend only, no feature additions.
Output: release contract baseline + go/no-go risks.
```

### 18) RC-BE-02
```text
Agent: backend-developer-agent + architect-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: RC-BE-02
Goal: Final backend release-candidate hardening.
Inputs: frozen contract output from RC-BE-01, backend handlers, tests
Deliverables: final normalization fixes, security/reliability hardening, full regression pass.
Constraints: backend only, no breaking contract changes.
Output: final changed files, reviewer report, full test summary, release blockers.
```

## DevOps/IaC Task Plan (for New Backend Services)

| # | Task ID | Stream | Title | Status |
|---|---|---|---|---|
| 19 | DOP-01 | DevOps/IaC | Add new Lambda functions in CDK for auth/solve/submit/progress/analytics/class/rewards/student/admin | completed |
| 20 | DOP-02 | DevOps/IaC | Add API Gateway route wiring for all new handlers | completed |
| 21 | DOP-03 | DevOps/IaC | Apply IAM, env vars, and SSM/secret access per function | completed |
| 22 | DOP-04 | DevOps/IaC | Add monitoring/alarms and deployment smoke checks for new routes | completed |
| 23 | DOP-05 | DevOps/IaC | Validate promotion readiness (dev -> staging -> prod) with guardrails | completed |
| 24 | DOP-06 | DevOps/IaC | Add IaC observability dashboard for errors, usage, and performance | completed |
| 25 | DOP-07 | DevOps/IaC | Add IaC log analytics queries and error drill-down views | completed |
| 26 | DOP-08 | DevOps/IaC | Add IaC cost/anomaly and throughput visibility controls | completed |

## Prompt Pack (DevOps/IaC Tasks 19-23)

### 19) DOP-01
```text
Agent: devops-agent + architect-agent
Mode: standard
Task ID: DOP-01
Goal: Add Lambda resources in CDK for all new backend handlers.
Inputs: infra/cdk/lib/learnfyra-stack.ts, backend/handlers/*.js, docs/tasks/backend/BACKEND_TASK_PROGRESS_TRACKER.md
Deliverables: NodejsFunction definitions for auth, solve, submit, progress, analytics, class, rewards, student, admin handlers.
Constraints: keep existing generate/download functions stable; no frontend changes.
Output: file diff summary + function inventory + unresolved infra risks.
```

### 20) DOP-02
```text
Agent: devops-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: DOP-02
Goal: Wire API Gateway routes to all newly added functions.
Inputs: infra/cdk/lib/learnfyra-stack.ts, backend handler route contracts, tests
Deliverables: API resources/methods for auth, solve, submit, progress, analytics, class, rewards, student, admin.
Constraints: preserve existing routes and CORS behavior.
Output: route map, review findings, synthesis/test results.
```

### 21) DOP-03
```text
Agent: devops-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: DOP-03
Goal: Apply least-privilege IAM and runtime configuration for new functions.
Inputs: infra/cdk/lib/learnfyra-stack.ts, deployment workflows, handler env needs
Deliverables: IAM policies, bucket grants, SSM/secret grants, per-function environment variables.
Constraints: no hardcoded secrets; dev/staging/prod parity required.
Output: permission matrix, review findings, validation checks.
```

### 22) DOP-04
```text
Agent: devops-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: DOP-04
Goal: Add operational monitoring and smoke checks for new backend routes.
Inputs: infra/cdk/lib/learnfyra-stack.ts, .github/workflows/*.yml, docs/operations/*
Deliverables: CloudWatch alarms for errors/latency, workflow smoke test steps for new endpoints.
Constraints: maintain existing prod guardrails; no direct prod-first behavior.
Output: monitoring coverage list, workflow updates, QA smoke evidence.
```

### 23) DOP-05
```text
Agent: devops-agent + qa-agent
Mode: standard
Task ID: DOP-05
Goal: Validate promotion readiness and rollout guardrail compliance.
Inputs: .github/workflows/deploy-dev.yml, .github/workflows/deploy-staging.yml, .github/workflows/deploy-prod.yml, docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md
Deliverables: checklist proving local and dev validation gates before staging/prod promotion.
Constraints: no production deployment without local evidence + successful dev deployment evidence.
Output: go/no-go report, blockers, and required fixes.
```

### 24) DOP-06
```text
Agent: devops-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: DOP-06
Goal: Add IaC observability dashboards and alerts for backend services.
Inputs: infra/cdk/lib/learnfyra-stack.ts, .github/workflows/*.yml, CloudWatch-related docs/ops files
Deliverables:
- CloudWatch dashboard defined in CDK showing:
	- Lambda errors, invocations, duration (p50/p95/p99 where possible)
	- API Gateway 4XX/5XX, latency, request count
	- Top function error trend widgets
	- Usage widgets (request volume by route/service)
- Alarm set for:
	- Function error rate and error count thresholds
	- High latency thresholds
	- API 5XX spikes
- Log retention policy for all Lambda log groups
- Optional but recommended: X-Ray tracing enabled for staging/prod and dashboard links
Constraints:
- IaC only; no manual console configuration
- Keep existing deployment guardrails unchanged
- No breaking changes to current API routes
Output:
- CDK diff summary
- Dashboard widget inventory
- Alarm matrix (name, metric, threshold, env)
- QA evidence of synth/deploy validation and smoke checks
```

### 25) DOP-07
```text
Agent: devops-agent + qa-agent
Mode: standard
Task ID: DOP-07
Goal: Add reusable log analytics assets for fast incident diagnosis.
Inputs: infra/cdk/lib/learnfyra-stack.ts, Lambda log groups, API Gateway access logs
Deliverables:
- IaC-managed CloudWatch Log Insights query definitions (or documented query pack) for:
	- top errors by function
	- auth failures by route
	- high-latency request traces
	- 4XX/5XX route hotspots
- Dashboard links/panels for quick drill-down from alarm -> logs
Constraints:
- no manual console-only setup
- env-aware naming for dev/staging/prod
Output:
- query inventory
- validation notes with example results
```

### 26) DOP-08
```text
Agent: devops-agent + code-reviewer-agent + qa-agent
Mode: standard
Task ID: DOP-08
Goal: Add cost/anomaly and throughput visibility to reduce operational surprises.
Inputs: infra/cdk/lib/learnfyra-stack.ts, billing/alarm docs, workflows
Deliverables:
- CloudWatch anomaly or threshold alarms for unusual Lambda invocations/errors
- Usage trend widgets (daily request volume, top endpoints, peak windows)
- Optional budget alarm wiring guidance for each environment
Constraints:
- keep current deployment guardrails intact
- no production auto-remediation actions without approval
Output:
- alarm and widget matrix
- runbook notes for alert triage
```
