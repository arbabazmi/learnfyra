# Learnfyra Platform Technical Status

Last updated: 2026-03-25
Owner: Program Orchestrator
Purpose: Single technical reference for technologies, workflows, implemented scope, and pending scope.

## 1) Technology Stack

### Application Runtime
- Node.js (project engine requires 18+).
- JavaScript with ESM module style.

### Backend
- Express local API server (`server.js`).
- Lambda-compatible route handlers (`backend/handlers/`).
- Shared middleware (`backend/middleware/`).

### AI and Worksheet Generation
- Anthropic API client (`@anthropic-ai/sdk`).
- AI generation modules under `src/ai/`.

### Export and Templating
- HTML templates and CSS generator in `src/templates/`.
- Exporters in `src/exporters/`.
- PDF generation with Puppeteer/Chromium.
- DOCX export with `docx`.

### Auth and Security
- JWT with `jsonwebtoken`.
- Password hashing with `bcryptjs`.
- Auth adapters in `src/auth/`.

### Data and Persistence
- Local JSON/file-backed development persistence in `src/db/` and `worksheets-local/`.
- Planned/partial AWS persistence stack includes S3 and DynamoDB-based models by spec.

### Testing
- Jest (unit/integration).
- AWS client mocks with `aws-sdk-client-mock`.
- Coverage thresholds configured to 80% global.

### Infrastructure
- AWS CDK TypeScript stack under `infra/cdk/`.
- Current core infra services include S3, Lambda, API Gateway, CloudFront, SSM.

## 2) Active API Surface (Local Server)

### Worksheet and Solve
- `POST /api/generate`
- `GET /api/download`
- `GET /api/solve/:worksheetId`
- `POST /api/submit`

### Auth and Student
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/student/profile`
- `POST /api/student/join-class`

### Progress, Class, Analytics, Rewards
- `POST /api/progress/save`
- `GET /api/progress/history`
- `POST /api/class/create`
- `GET /api/class/:id/students`
- `GET /api/analytics/class/:id`
- `GET /api/rewards/student/:id`
- `GET /api/rewards/class/:id`

## 3) Workflow and Completion Matrix

| Area | Completion | Technical Notes |
|---|---|---|
| Worksheet generation/export | complete | Local and AWS-core compatible handlers and exporters implemented |
| Online solve and scoring | complete (local), partial (AWS deployment) | Scoring engine and local solve flow are implemented with unit and integration coverage |
| Auth foundations | partial | Local register/login/logout and JWT flow implemented; OAuth/Cognito path not complete |
| Student/class/progress | partial | Handlers and unit tests exist; full spec-grade persistence and reporting expansion pending |
| Rewards | partial | Rewards engine and handler exist; broader anti-gaming + aggregate persistence rollout pending |
| Admin control plane | pending/partial | Specs and operations docs are mature; implementation is not complete |
| AWS expansion | partial | Core generate/download infra exists; solve/submit and extended module infra still pending |

## 4) Verified Test Coverage Footprint

### Present
- Solve unit tests: scorer/resultBuilder/solveHandler/submitHandler.
- Solve integration test: full flow.
- Export integration tests: HTML/PDF/DOCX.
- Unit tests for auth, student, progress, class, analytics, rewards handlers.

### Pending Expansion
- Cross-module integration tests (auth + solve persistence + analytics).
- Expanded parity tests for local and AWS-profile adapters.
- Deployment-level smoke checks for non-core API modules.

## 5) Technical Pending Scope

### High Priority
- Canonical cross-doc requirement normalization for active sprint slices.
- Architecture contract lock for first cross-module slices.
- Solve/submit AWS deployment route and Lambda wiring completion.

### Medium Priority
- OAuth and production auth integration path.
- Reporting and aggregate model completion per auth/reporting specs.
- Rewards and admin control-plane incremental implementation.

### Controlled Later Scope
- Full operations automation stack (security, audit, cost, emergency controls) per operations specifications.

## 6) Governance Links
- Canonical specs index: `docs/specs/CANONICAL_SPECS_INDEX.md`
- Local parity strategy: `docs/technical/platform/LOCAL_DEV_STRATEGY.md`
- Readiness checklist: `docs/IMPLEMENTATION_READINESS_CHECKLIST.md`
- Master dossier: `docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md`
- Execution backlog: `docs/operations/NEXT_PHASE_EXECUTION_BACKLOG.md`
