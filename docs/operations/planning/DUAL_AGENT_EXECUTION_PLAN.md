# Dual-Agent Execution Plan (Claude + Copilot)

Purpose: Run both assistants together with low token usage and clean handoffs.

## Assignment Strategy

### Claude Code (Deep spec and architecture)
- BA normalization for one module at a time.
- Architecture contracts for one module at a time.
- Risk analysis and acceptance criteria hardening.

### Copilot (Implementation and focused edits)
- Code changes per approved module slice.
- Unit/integration tests per slice.
- Fast refactors and route wiring.

### Frontend and Backend Lane Split
- Frontend lane policy: `docs/operations/FRONTEND_BACKEND_DISTRIBUTION.md`
- Frontend/backend prompt pack: `docs/operations/FRONTEND_BACKEND_AGENT_PROMPTS.md`
- Frontend lead agent: `frontend-developer-agent` (with `ui-agent`)
- Backend lead agent: `backend-developer-agent` (with `architect-agent`)

## Work Split by Module
1. M01 Auth: Claude defines contracts, Copilot implements handlers and tests.
2. M02 Question Bank: Claude defines schema/rules, Copilot builds CRUD and search.
3. M03 Generator: Claude defines assembly policy, Copilot implements pipeline changes.
4. M04 Solve: Claude validates scoring rules, Copilot executes code and tests.
5. M05 Reporting: Claude defines analytics queries, Copilot implements endpoints.
6. M06 Classes: Claude defines access model, Copilot builds membership logic.
7. M07 Admin: Claude defines control policies, Copilot wires APIs and config.

## Token Consumption Rules
1. Never load full docs tree for every task.
2. Per task, read only:
   - one module spec file
   - one related QA or ops file
   - affected code files
3. Keep each prompt under one module and one outcome.
4. Update status in backlog after each slice to avoid re-reading old context.

## Prompt Pattern
Use this compact prompt shape:

```
Module: M0X
Goal: <single deliverable>
Inputs: <max 3 file paths>
Output: <files to update>
Constraints: local-first, no scope creep
```

## Handoff Contract
For each completed slice, always provide:
1. Requirement IDs covered.
2. Files changed.
3. Tests added/updated.
4. Known risks/open questions.

## Definition of Slice Done
1. Module acceptance criteria met.
2. Tests pass for touched scope.
3. Backlog status updated.
4. No unresolved critical review finding.

## Deployment Guardrail
1. No direct production deployment is allowed.
2. Mandatory promotion sequence: local validation -> dev deploy -> optional staging -> prod.
3. Production promotion requires:
   - evidence of local validation
   - evidence of successful dev deployment
   - manual production approval
