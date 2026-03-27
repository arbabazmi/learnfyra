# Next Phase Master Dossier

Last updated: 2026-03-25
Owner: Program Orchestrator
Scope: Full technical status, workflows, technologies, and next-phase execution readiness

## 1) Platform Technology Inventory

### Runtime and Core Language
- Node.js 18+ baseline (project engines) with ESM modules.
- JavaScript across backend handlers, domain logic, CLI, and frontend scripts.

### Backend and API
- Express local development server in `server.js`.
- Lambda-compatible handlers under `backend/handlers/`.
- Middleware under `backend/middleware/` (validation and auth).

### AI and Content Generation
- Anthropic SDK via `@anthropic-ai/sdk`.
- Prompt and worksheet generation modules under `src/ai/`.

### Document Export Pipeline
- HTML/PDF/DOCX exporters under `src/exporters/`.
- Puppeteer and Chromium (`puppeteer`, `puppeteer-core`, `@sparticuz/chromium`) for PDF.
- `docx` package for DOCX generation.

### Authentication and Security
- JWT authentication (`jsonwebtoken`).
- Password hashing (`bcryptjs`).
- Local/mock auth adapter implemented in `src/auth/`.

### Data and Storage
- Local JSON/file adapters under `src/db/` for development workflows.
- Local worksheet artifacts in `worksheets-local/`.
- AWS target storage model: S3, with DynamoDB planned for broader platform features.

### Testing and Quality
- Jest as test runner.
- `aws-sdk-client-mock` for AWS SDK mocking.
- Coverage threshold configured at 80% lines/functions/branches/statements.

### Infrastructure and Deployment
- AWS CDK (TypeScript) in `infra/cdk/`.
- Deployed/in-stack services currently include S3, Lambda, API Gateway, CloudFront, SSM.

## 2) Workflow Catalog (Current)

### Workflow A: Worksheet Generation and Download
Status: done (local and AWS core route wiring)
- Input validation via `backend/middleware/validator.js`.
- Worksheet generation via `src/ai/generator.js`.
- Export to selected format via `src/exporters/`.
- Download handoff via `/api/download`.

### Workflow B: Online Solve and Instant Scoring
Status: done (local end-to-end), partial (AWS route deployment)
- Solve data saved at generation to `worksheets-local/{uuid}/solve-data.json`.
- Question retrieval via `GET /api/solve/:worksheetId`.
- Submission and scoring via `POST /api/submit`.
- Scoring engine in `src/solve/scorer.js` and `src/solve/resultBuilder.js`.
- UI solve flow in `frontend/solve.html`, `frontend/js/solve.js`, `frontend/css/solve.css`.

### Workflow C: Student Auth and Session Entry
Status: partial
- Registration/login/logout routes implemented in local server and `authHandler`.
- Local auth adapter exists with JWT issuance.
- OAuth and Cognito paths remain pending for production auth parity.

### Workflow D: Student Progress, Class, Analytics, Rewards
Status: partial
- Handlers exist for student/profile, class operations, progress save/history, analytics, rewards.
- Unit tests exist for each major handler.
- Full spec-level persistence and precomputed aggregate architecture (DynamoDB-centric) still pending.

### Workflow E: Admin Control Plane and Platform Operations
Status: pending/partial
- Detailed operational runbook and specs are present in docs.
- Full implementation footprint (admin APIs, broader security ops automation, cost and audit control plane) is not fully provisioned.

### Workflow F: AWS Deployment and Runtime Parity
Status: partial
- CDK stack currently provisions generate/download core path.
- Solve/submit and broader module deployment still pending in CDK route/function wiring.
- Local-vs-AWS parity strategy documented and active as governance.

## 3) Completed vs Pending Matrix (Technical)

| Stream | Current State | Completed Evidence | Pending Technical Work |
|---|---|---|---|
| Generation + Export | Done | `server.js`, `src/ai/*`, `src/exporters/*`, exporter integration tests | Continuous quality hardening only |
| Online Solve | Done local, partial AWS | `backend/handlers/solveHandler.js`, `backend/handlers/submitHandler.js`, `src/solve/*`, `tests/unit/*solve*`, `tests/integration/solve.test.js` | CDK/API route wiring for solve/submit in AWS, alarms and production rollout |
| Auth Basic | Partial | `backend/handlers/authHandler.js`, `src/auth/mockAuthAdapter.js`, auth unit tests | OAuth providers, Cognito integration, stronger production auth policies |
| Progress + Class + Analytics | Partial | `backend/handlers/progressHandler.js`, `classHandler.js`, `analyticsHandler.js`, unit tests | Spec-complete aggregates, larger analytics/report contracts, batch flows |
| Rewards | Partial | `backend/handlers/rewardsHandler.js`, `src/rewards/*`, rewards unit tests | Full rewards lifecycle persistence and anti-gaming production workflows |
| Admin Control Plane | Pending/partial | Detailed specs and operations runbooks in docs | API/infra implementation, security automation, cost and audit integrations |
| Infra/CDK | Partial | `infra/cdk/lib/learnfyra-stack.ts` provisions core services | Additional Lambdas/routes, DynamoDB/Cognito/Secrets expansion per specs |
| CI/CD and Ops Gates | Partial | Existing workflow docs and deployment policies | Full pipeline alignment with all module rollout gates |

## 4) Tests and Validation Snapshot

### Implemented Test Coverage Areas
- Solve and scoring: unit + integration.
- Exporters: integration tests for HTML/PDF/DOCX.
- Handlers: auth, student, progress, class, analytics, rewards, solve, submit.

### Current Gaps
- End-to-end integration coverage for auth + reporting + rewards combined flows.
- AWS deployment smoke tests for newly added non-core routes.
- Contract tests across local vs AWS adapter parity for all expanded modules.

## 5) Requirements and Canonical Governance

### Canonical References
- Specs index: `docs/specs/CANONICAL_SPECS_INDEX.md`.
- Readiness criteria: `docs/IMPLEMENTATION_READINESS_CHECKLIST.md`.
- Local/AWS parity rules: `docs/technical/platform/LOCAL_DEV_STRATEGY.md`.

### Rule Set for New Work
- No requirement enters build without explicit acceptance criteria.
- Every P0/P1 requirement maps to a test.
- No secrets hardcoded; use environment and managed secret/config sources.
- Preserve Lambda-compatible handler design and CORS behavior.

## 6) Architecture Baseline

### Local-First Execution Baseline
- Domain logic in `src/` remains shared.
- Runtime adapters define local vs AWS behavior.
- Business logic should not fork by infrastructure environment.

### Deployment Baseline
- Existing deployed core: generate/download.
- Next AWS increments: solve/submit, then expanded module rollout.

## 7) Priority Next-Phase Work

### P0
- Normalize all active specs into one approved execution backlog with explicit status.
- Lock top implementation slices and acceptance criteria.
- Finalize deployment boundary for what must remain local-only in current phase.

### P1
- Implement first cross-module slice (auth + solve persistence + reporting link).
- Add parity and contract tests for the selected slice.

### P2
- Expand to admin/rewards/ops automation milestones after P0/P1 gates pass.

## 8) Risks and Mitigations

- Risk: documentation breadth causes execution drift.
  - Mitigation: maintain this dossier as single technical status source.
- Risk: local-complete assumptions leak into production readiness.
  - Mitigation: explicit local gate and separate AWS readiness gate.
- Risk: parallel agents over-document instead of shipping slices.
  - Mitigation: use effort mode defaults (`standard`) and thin-slice execution.

## 9) Go/No-Go Gate for Next Feature Phase

### Go when
- Canonical backlog and status matrix approved.
- Top 2-3 slices have owner, contract, and tests mapped.
- No unresolved blocker decisions for active sprint items.
- Local validation evidence exists for release candidates.
- Dev deployment and smoke verification succeeded.

### No-Go when
- Spec conflicts remain unresolved on active slices.
- Test strategy missing for high-priority requirements.
- Scope includes AWS deployment without explicit promotion approval.
- Production is requested before local and dev gates complete.
- No evidence trail exists for local test pass and dev deployment success.

## 11) Environment Promotion Guardrail

Required release path:
1. Local validation.
2. Dev deployment and smoke test.
3. Optional staging verification.
4. Production deployment with manual approval.

Direct promotion to production as the first deployment target is disallowed.

## 10) Open Decisions Required

- Which feature stream is first for next sprint execution?
- Which spec family is authoritative when conflicts appear across spec/design/ops docs?
- What exactly defines phase-complete for local and for AWS readiness?
