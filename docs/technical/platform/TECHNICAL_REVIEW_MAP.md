# Technical Review Map

Purpose: Identify which documents currently cover technical diagrams, solution architecture, workflows, APIs, and operational design so review can start from the right sources.

## Recommended Review Order
1. `docs/architecture/diagrams/worksheet_architecture.md`
2. `docs/specs/platform/platform-module-breakdown-auth-first.md`
3. `docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md`
4. `docs/technical/platform/PLATFORM_TECHNICAL_STATUS.md`
5. module-specific specs under `docs/specs/modules/`

## Best Documents for Technical Diagram and Solution Review

### 0) API Security and Auth Model
File: `docs/specs/security/api-security-auth-model.md`

What it covers:
- API security model
- authentication approach
- authorization rules
- guest mode policy
- public vs protected route strategy

Best use:
- Start here if your first review question is: how are APIs secured, how does auth/authz work, and what exactly can guest users do?

### 1) Worksheet Generation Architecture
File: `docs/architecture/diagrams/worksheet_architecture.md`

What it covers:
- Core AWS architecture for worksheet generation
- high-level platform flow
- question bank + dynamic assembly concept
- model strategy
- rendering approach
- cost optimization direction

Best use:
- Start here if you want to review the worksheet generator technical diagram first.

### 2) Platform Solution Blueprint
File: `docs/specs/platform/platform-module-breakdown-auth-first.md`

What it covers:
- overall platform module structure
- auth-first system design
- module boundaries and responsibilities
- high-level API surface
- core data contracts
- AWS architecture alignment

Best use:
- Start here if you want the end-to-end solution breakdown for the product.

### 2b) Completion Certificates Options
File: `docs/specs/frontend/certificate-completion-options.md`

What it covers:
- certificate download options (MVP -> advanced)
- API options for generate/download/list/verify
- auth and authorization rules for certificates
- acceptance criteria for certificate flows

Best use:
- Use this when deciding how to add student completion certificates.

### 3) Current Technical Status and Workflow Coverage
File: `docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md`

What it covers:
- workflow catalog
- architecture baseline
- current state: done / partial / pending
- technology inventory
- risks and next-phase readiness

Best use:
- Use this to review what is actually implemented versus planned.

### 4) Technical Inventory and Completion Matrix
File: `docs/technical/platform/PLATFORM_TECHNICAL_STATUS.md`

What it covers:
- tech stack summary
- active API surface
- workflow completion matrix
- test coverage footprint
- pending technical scope

Best use:
- Use this as the operational summary after reviewing architecture docs.

## Module-Level Solution Docs

If you want to review solution design by module instead of one big document:

- Auth and Identity: `docs/specs/modules/M01-auth-identity-spec.md`
- Question Bank: `docs/specs/modules/M02-question-bank-spec.md`
- Worksheet Generator: `docs/specs/modules/M03-worksheet-generator-spec.md`
- Solve and Submit: `docs/specs/modules/M04-solve-submit-spec.md`
- Progress and Reporting: `docs/specs/modules/M05-progress-reporting-spec.md`
- Class and Relationship Management: `docs/specs/modules/M06-class-relationship-spec.md`
- Admin Control Plane: `docs/specs/modules/M07-admin-control-plane-spec.md`

## UI and Flow Review Docs

Use these if you want technical review to include UX flow and screen behavior:

- `docs/specs/frontend/ui-flow-master-spec.md`
- `docs/design/frontend/auth-practice-reporting-ux-spec.md`
- `docs/design/platform/student-authentication-and-progress-tracking-spec.md`
- `docs/design/frontend/admin-console-ux-spec.md`

## Operations and Deployment Architecture Docs

Use these if you want infra, deployment, and production operation review:

- `docs/operations/inventory/aws-services-inventory.md`
- `docs/operations/runbooks/admin-control-plane-operations-spec.md`
- `docs/operations/deployment/env-based-iac-deployment-plan.md`
- `docs/technical/platform/LOCAL_DEV_STRATEGY.md`

## Suggested First Review Pass

If the goal is "review technical diagram and solution" only, use this sequence:

1. `docs/architecture/diagrams/worksheet_architecture.md`
2. `docs/specs/platform/platform-module-breakdown-auth-first.md`
3. `docs/specs/modules/M01-auth-identity-spec.md`
4. `docs/specs/modules/M03-worksheet-generator-spec.md`
5. `docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md`

## Review Note

Current coverage is good but fragmented:
- `docs/architecture/diagrams/worksheet_architecture.md` is the clearest single architecture/diagram source for generator design.
- `docs/specs/platform/platform-module-breakdown-auth-first.md` is the clearest single solution source for the broader platform.
- operational and status details are better captured in `docs/operations/` than in one unified architecture spec.
