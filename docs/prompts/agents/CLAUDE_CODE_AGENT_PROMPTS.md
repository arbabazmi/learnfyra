# Claude Code Terminal Prompt Pack (Run One by One)

## Purpose
This document gives you ready-to-paste prompts you can run one by one in Claude Code terminal so all specs in docs are covered end-to-end.

## Recommended Run Mode
- Start with teammate mode enabled.
- Run prompts in the exact order below.
- Complete each step before moving to the next.

## Full Folder Technical Refresh Prompt (Use Before Planning)
Paste this first when you want a complete docs refresh with done/pending technical status:

Use program-orchestrator-agent in standard mode.

Task:
Refresh the complete technical documentation status for this repository and update:
1. docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md
2. docs/operations/NEXT_PHASE_EXECUTION_BACKLOG.md
3. docs/operations/NEXT_PHASE_AGENT_PROMPTS.md

Required coverage:
1. All workflows and architecture baseline
2. Completed vs pending matrix for each major stream
3. Full technology inventory (runtime, backend, frontend, data, testing, AWS infra)
4. P0/P1/P2 actionable backlog with owner and test hooks
5. Go/no-go gate and explicit blockers

Constraints:
1. Keep output execution-ready and concise
2. Preserve local-first strategy
3. Do not invent implementation; derive from code and canonical docs

## Start Development Now (Copy/Paste)
Use this prompt if you want Claude Code to begin development immediately:

You are the Orchestrator for Learnfyra development. Start implementation immediately using team flow and local-first execution.

Objective:
Implement all approved requirements from docs with zero scope loss, production-safe code quality, and complete test coverage mapping.

Mandatory process:
1. Read and normalize all docs first:
- docs/specs
- docs/design
- docs/qa
- docs/operations
- docs/IMPLEMENTATION_READINESS_CHECKLIST.md
- docs/technical/platform/LOCAL_DEV_STRATEGY.md
2. Build a canonical backlog and execute in thin vertical slices:
- Spec item
- Contract/API definition
- Implementation
- Unit tests
- Integration tests
- QA validation
- Code review
3. Use agents by responsibility:
- ba-agent: finalize acceptance criteria for each slice
- architect-agent: API/data contracts and design decisions
- dev-agent: code implementation
- qa-agent: tests and validation
- code-reviewer-agent: severity-ranked findings
- ui-agent: UI/UX changes where required
- devops-agent: only after local completion and explicit approval
4. Hard constraints:
- Local-first only; no AWS deployment yet
- No secret hardcoding
- Preserve existing behavior unless spec explicitly changes it
- Maintain Lambda-compatible handler patterns
- Ensure validation and CORS consistency where APIs are touched
- Every acceptance criterion must map to at least one test

Execution output format for every slice:
1. Slice name
2. Requirements covered
3. Files changed
4. API/schema changes
5. Tests added/updated
6. Test results
7. Risks and follow-ups
8. Ready for merge: Yes or No

Start now with Phase 1 and continue without pausing:
Phase 1:
- Produce full spec inventory
- Detect conflicts/duplicates
- Produce canonical prioritized backlog
- Assign each backlog item to an agent owner

Then immediately begin Phase 2 implementation for highest-priority local slice and keep going slice-by-slice until blocked.

If blocked:
- Report exact blocker
- Propose 2 concrete resolution options
- Continue with next unblocked slice in parallel.

## Step 0: Session Kickoff Prompt (Orchestrator)
Paste this first:

You are the Orchestrator for Learnfyra. We will execute all specs under docs one by one with zero scope loss.

Rules:
1. Read all docs recursively and build a full spec inventory.
2. Keep local-first implementation and testing.
3. Do not skip any requirement silently.
4. For every requirement, map to file changes and test cases.
5. Work in phases: spec normalization, design contracts, implementation, QA, code review, release readiness.
6. At the end of each phase, show a completion checklist and wait for approval.

Output now:
1. Full docs inventory grouped by specs, design, qa, operations, root docs.
2. Duplicate/conflict report.
3. Proposed execution order.
4. Agent assignment by item.


## Step 1: BA Normalization Prompt (All Specs)
Use with ba-agent:

Act as BA agent. Normalize and merge requirements from all files in docs/specs plus related files in docs/design, docs/qa, docs/operations, and root docs markdown files.

Deliver:
1. Canonical user stories.
2. Given/When/Then acceptance criteria.
3. Out-of-scope items.
4. Open questions.
5. Dependency map.
6. Boundary cases for grade 1, grade 10, 5 questions, 30 questions.

Constraint:
- No code.
- No infra edits.
- Requirements only.


## Step 2: Architect Prompt (System Contracts)
Use with architect-agent:

Act as architect-agent. Using BA output, define implementation architecture and contracts.

Deliver:
1. API contracts for all affected endpoints.
2. Data contracts and schema updates.
3. Handler boundaries and service responsibilities.
4. Storage strategy and key layout.
5. Performance and cost notes.
6. Rollout sequencing for local-first and AWS-later.

Constraint:
- No code yet.
- Output must be implementation-ready.


## Step 3: Per-Spec Deep Prompts (Run One by One)
Run the following prompt once for each file listed in the Spec File List section.

Prompt template:

Process this single spec deeply and produce an execution-ready package:
SPEC_FILE: <replace with one path>

Deliver:
1. Requirement summary.
2. Acceptance criteria in Given/When/Then.
3. Files to create/modify in this repository.
4. API and payload changes.
5. Validation and error handling rules.
6. Test plan: unit, integration, and regression.
7. Risks and assumptions.

Constraint:
- Keep backward compatibility with existing generate/download/solve flows.
- Local-first implementation before AWS wiring.


## Step 4: Dev Prompt (Implementation Slices)
Use with dev-agent after BA + architect outputs are approved:

Act as dev-agent. Implement features in thin vertical slices from the approved backlog.

For each slice:
1. List exact files to change before coding.
2. Implement code.
3. Add/update tests.
4. Run checks.
5. Report changed files and why.

Constraints:
- Follow existing project conventions.
- No hardcoded secrets.
- Keep handlers Lambda-compatible.
- Preserve CORS and validation behavior.


## Step 5: QA Prompt (Validation Gate)
Use with qa-agent after each implementation slice:

Act as qa-agent. Verify the slice against acceptance criteria.

Deliver:
1. Test cases mapped to each criterion.
2. Happy path, error path, boundary path results.
3. Regression risks.
4. Coverage impact.
5. Pass/fail decision with blocking issues.

Mandatory checks:
- OPTIONS/CORS behavior where applicable.
- Grade and question-count boundaries.
- Timed/untimed solve behavior when relevant.


## Step 6: Code Review Prompt
Use with code-reviewer-agent after QA pass:

Perform a strict code review focused on:
1. Functional regressions.
2. Security issues.
3. Performance concerns.
4. Error handling gaps.
5. Maintainability and naming.

Deliver:
1. Findings ordered by severity.
2. File references.
3. Required fixes before merge.
4. Nice-to-have improvements.


## Step 7: UI Prompt (When Spec Touches UX)
Use with ui-agent for any UI-related spec:

Implement UI changes aligned with existing visual direction while improving clarity and student usability.

Deliver:
1. Updated page structure and interactions.
2. Responsive behavior (desktop + mobile).
3. Accessibility checks.
4. Visual QA notes.

Constraints:
- Keep current product personality consistent.
- Avoid generic boilerplate design.


## Step 8: DevOps Prompt (After Local Completion)
Use with devops-agent only after local implementation and QA are complete:

Prepare deployment readiness for completed features.

Deliver:
1. CI/CD workflow changes required.
2. Environment variables and secrets checklist.
3. Rollout plan dev -> staging -> prod.
4. Monitoring and rollback plan.

Constraint:
- Do not deploy yet unless explicitly approved.


## Spec File List (Run One by One)
Use the Step 3 template against each of these:

1. docs/specs/CANONICAL_SPECS_INDEX.md
2. docs/specs/online-solve-spec.md
3. docs/specs/backend/auth-online-offline-reporting-spec.md
4. docs/specs/feature-reward-engagement-system.md
5. docs/specs/reward-engagement-flow-spec.md
6. docs/specs/frontend/ui-flow-master-spec.md
7. docs/specs/ui-redesign-spec.md
8. docs/specs/super-admin-model-config-spec.md
9. docs/specs/super-admin-model-control-plane-spec.md
10. docs/specs/super-admin-backend-model-routing-master-spec.md
11. docs/specs/super-admin-platform-operations-spec.md
12. docs/specs/SUPER-ADMIN-ROLES-SUMMARY.md
13. docs/design/learnfyra-ui-spec-v3.md
14. docs/design/frontend/admin-console-ux-spec.md
15. docs/design/frontend/auth-practice-reporting-ux-spec.md
16. docs/design/platform/student-authentication-and-progress-tracking-spec.md
17. docs/design/ux-rewards-engagement-spec.md
18. docs/qa/admin-model-routing-qa-spec.md
19. docs/qa/backend/auth-mode-reporting-qa-spec.md
20. docs/qa/rewards-gamification-qa-spec.md
21. docs/qa/ui-redesign-qa-spec.md
22. docs/operations/runbooks/admin-control-plane-operations-spec.md
23. docs/IMPLEMENTATION_READINESS_CHECKLIST.md
24. docs/technical/platform/LOCAL_DEV_STRATEGY.md


## Optional Fast Prompt for Single File
Use when you want a compact output for one file:

Analyze this file and return only:
1. Top 10 must-implement requirements.
2. Acceptance criteria.
3. Exact repository files to change.
4. Tests required.
5. Blockers/open questions.

File: <replace path>


## Completion Prompt (End-of-Cycle)
Use after all specs are processed:

Create a final delivery board with:
1. Completed items.
2. In-progress items.
3. Blocked items.
4. Missing tests.
5. Highest-risk unresolved gaps.
6. Exact next 10 implementation actions.

Also provide a release-readiness verdict for local and for AWS.
