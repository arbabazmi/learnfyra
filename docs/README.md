# Docs Structure Index

This folder has been reorganized into domain-first sections so teams can find backend, frontend, platform, and operations documentation faster.

## Top-Level Structure

- `docs/architecture/`
  - `diagrams/`: architecture references and system visuals
  - `workflows/`: process and request/response workflows
- `docs/design/`
  - `frontend/`: UX and UI specs for user-facing experiences
  - `platform/`: cross-cutting design docs
- `docs/operations/`
  - `deployment/`: environment and rollout plans
  - `inventory/`: AWS/services inventory docs
  - `monitoring/`: observability, analytics, and alert runbooks
  - `planning/`: readiness reports and phase dossiers
  - `runbooks/`: operational playbooks
- `docs/prompts/agents/`: reusable agent execution prompts
- `docs/qa/`
  - `backend/`: API and backend QA specs
  - `frontend/`: UI and engagement QA specs
- `docs/requirements/`
  - `frontend/`: frontend requirements and intake templates
  - `platform/`: platform-level requirement baselines
- `docs/specs/`
  - `backend/`: backend feature specs
  - `frontend/`: frontend and flow specs
  - `platform/`: platform-level specs and module plans
  - `security/`: auth and API security model
  - `modules/`: module-level deep specs
  - `modules/backend-contracts/`: backend contract and hardening docs
- `docs/tasks/`
  - `backend/`: backend progress trackers
  - `platform/`: platform execution backlog and sprint boards
- `docs/technical/`
  - `backend/`: backend technical architecture details
  - `infrastructure/`: deployment and cloud technical references
  - `platform/`: platform strategy and review maps

## Duplicate Handling

A hash-based duplicate scan was run across all markdown files under `docs/`.

- Result: no exact duplicate files detected.

If you want, the next cleanup pass can remove near-duplicates (same topic, different wording) after human review.
