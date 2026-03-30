# Copilot Instructions for Learnfyra

## Project Overview

This repository contains Learnfyra, an AI-powered USA curriculum worksheet platform for Grades 1-10.

- Runtime: Node.js 18+ with ESM modules
- App modes: local CLI and local web app
- Deployment target: AWS Lambda + API Gateway + S3 + CloudFront (via CDK)

## Primary Project Structure

- `src/ai/` prompt building and worksheet generation
- `src/exporters/` HTML/PDF/DOCX/answer-key generation
- `src/solve/` scoring and solve-result logic
- `backend/handlers/` Lambda-compatible API handlers
- `backend/middleware/` request validation and auth middleware
- `frontend/` static web app pages and assets
- `tests/unit/` unit tests
- `tests/integration/` integration tests
- `infra/cdk/` infrastructure as code
- `server.js` local Express development server

## Local Development Commands

- `npm run dev` start the local web app (`http://localhost:3000`)
- `npm start` run CLI flow
- `npm test` run all tests
- `npm run test:unit` run unit tests
- `npm run test:integration` run integration tests
- `npm run test:coverage` run tests with coverage

## Development Rules

- Prefer targeted, minimal changes over broad refactors.
- Preserve existing API contracts unless explicitly requested to change them.
- Keep handlers Lambda-compatible even when wiring local Express routes.
- Use environment variables for configuration and secrets; never hardcode keys.
- Maintain consistent CORS behavior on success and error responses for API handlers.

## Testing and Verification

- Add or update tests for every behavior change.
- Validate happy path and error path for API and scorer logic.
- For new or changed handlers, verify request validation and response schema.
- Report exact test/build commands executed and outcomes.

## Security and Quality

- Follow repository security instructions in `.github/instructions/snyk_rules.instructions.md`.
- For newly added first-party code, run the required Snyk code scan workflow and fix findings introduced by the change.
- Avoid logging secrets or sensitive user data.

## Documentation Placement Policy

When creating or updating documentation, always place files in the correct `docs/` subfolder based on intent.

- Architecture and system/data flow docs: `docs/architecture/`
- UI/UX and visual direction docs: `docs/design/`
- Runbooks, deployment notes, checklists, and operational procedures: `docs/operations/`
- Prompt engineering and reusable prompt assets: `docs/prompts/`
- Test plans, QA matrices, validation checklists, and verification guides: `docs/qa/`
- Product/business requirements and acceptance criteria: `docs/requirements/`
- Module or API specifications and interface contracts: `docs/specs/`
- Execution plans, task boards, and delivery trackers: `docs/tasks/`
- Deep implementation notes and low-level technical references: `docs/technical/`

Rules:

- Do not place new documentation files at repository root unless explicitly requested.
- Prefer updating an existing document in the correct folder before creating a new file.
- If a document spans multiple categories, place it where it will be maintained most often and add cross-links in related folders.
- Use clear, purpose-specific filenames; avoid generic names like `notes.md`.

## Default Agent Workflow

For delivery work, follow this sequence unless the user explicitly asks otherwise:

1. `program-orchestrator-agent`
2. `dev-agent`
3. `qa-agent`
4. `code-reviewer-agent`

Routing:

- Use `architect-agent` first for architecture/design tasks.
- Use `ba-agent` first if requirements are ambiguous.
- Use `ui-agent` before `frontend-developer-agent` for major UX/UI redesign.
- Use `devops-agent` between QA and review for deployment/infra pipeline changes.

Completion gate:

- Implementation complete
- Tests updated and executed
- Review findings addressed or documented
- Build/test status clearly reported
