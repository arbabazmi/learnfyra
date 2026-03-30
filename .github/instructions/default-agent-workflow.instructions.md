---
alwaysApply: true
always_on: true
trigger: always_on
applyTo: "**"
description: Default Agent Orchestration Workflow
---

# Default Delivery Agent Workflow

For all delivery-oriented requests, use this workflow by default unless the user explicitly asks to skip or change it:

1. `program-orchestrator-agent`
2. `dev-agent`
3. `qa-agent`
4. `code-reviewer-agent`

## Routing Add-ons

- Use `architect-agent` first when design or architecture decisions are requested.
- Use `ba-agent` first when requirements are ambiguous or need formalization.
- Use `ui-agent` before `frontend-developer-agent` for major UI/UX changes.
- Use `devops-agent` between QA and review when deployment/pipeline changes are involved.

## Minimum Delivery Gate

Before considering a delivery complete:

- Implementation is finished.
- Tests are added/updated and executed (`npm test` or targeted suites as appropriate).
- Review findings are addressed or explicitly documented.
- Build/test result is reported with command-level outcomes.

## Learnfyra Notes

- Project stack: Node.js 18+, ESM modules, Express local server, AWS Lambda-style handlers.
- Core run command for local web app: `npm run dev` (serves frontend + `/api/*` routes).
- Keep changes local-first unless the request explicitly asks for AWS deployment wiring.

## Documentation Placement Rule

When creating documentation, place files under the correct `docs/` category folder (architecture, design, operations, prompts, qa, requirements, specs, tasks, technical). Avoid placing new docs at repository root unless explicitly requested.
