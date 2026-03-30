# Learnfyra Modular Specs (Token-Efficient)

Purpose: Break requirements into small, assignable docs so Claude Code and Copilot can work in parallel with lower token usage.

## How to Use
1. Read this file first.
2. Pick one module file only for the current task.
3. Keep implementation and QA prompts scoped to one module.
4. Update only that module doc plus status files.

## Parallel Work References
1. Frontend/backend ownership: [../../operations/FRONTEND_BACKEND_DISTRIBUTION.md](../../operations/FRONTEND_BACKEND_DISTRIBUTION.md)
2. Frontend/backend prompt pack: [../../operations/FRONTEND_BACKEND_AGENT_PROMPTS.md](../../operations/FRONTEND_BACKEND_AGENT_PROMPTS.md)

## Module Docs
1. [M01-auth-identity-spec.md](M01-auth-identity-spec.md)
2. [M02-question-bank-spec.md](M02-question-bank-spec.md)
3. [M03-worksheet-generator-spec.md](M03-worksheet-generator-spec.md)
4. [M04-solve-submit-spec.md](M04-solve-submit-spec.md)
5. [M05-progress-reporting-spec.md](M05-progress-reporting-spec.md)
6. [M06-class-relationship-spec.md](M06-class-relationship-spec.md)
7. [M07-admin-control-plane-spec.md](M07-admin-control-plane-spec.md)

## Token Rules
- Do not load all module docs at once.
- For each task, load: one module doc + one QA doc + one ops doc max.
- Keep prompts to one slice, one owner, one acceptance bundle.
