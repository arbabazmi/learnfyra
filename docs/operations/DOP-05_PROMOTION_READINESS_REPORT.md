# DOP-05 Promotion Readiness and Guardrail Compliance Report

Date: 2026-03-25
Scope: Dev, Staging, and Production promotion workflows
Owner: DevOps/IaC stream

## Validation Inputs Reviewed
- .github/workflows/deploy-dev.yml
- .github/workflows/deploy-staging.yml
- .github/workflows/deploy-prod.yml
- docs/operations/NEXT_PHASE_MASTER_DOSSIER.md

## Promotion Readiness Checklist (Evidence-Based)

### Gate A: Local Validation Evidence
- [x] Production workflow requires `local_validation_evidence` input.
- [x] Staging workflow requires `local_validation_evidence` input.
- [x] Both workflows fail early when local evidence input is empty.

### Gate B: Successful Dev Deployment Evidence
- [x] Production workflow requires `dev_run_id` input.
- [x] Staging workflow requires `dev_run_id` input.
- [x] Both workflows validate `dev_run_id` is numeric.
- [x] Both workflows query GitHub Actions run metadata for the provided run id.
- [x] Both workflows require run name equals `Full Deploy — Dev`.
- [x] Both workflows require referenced run conclusion equals `success`.

### Gate C: Test and Deployment Safety
- [x] Dev workflow enforces test job before deploy.
- [x] Staging workflow enforces test job before deploy.
- [x] Production workflow enforces test job before manual approval and deploy.
- [x] Dev and staging workflows include backend smoke checks after deploy.
- [x] Production retains manual approval gate via protected environment.

### Gate D: Promotion Sequence Compliance
- [x] Dossier defines required sequence: local -> dev -> (optional) staging -> prod.
- [x] Direct prod-first deployment is prohibited in policy and enforced by workflow checks.
- [x] Staging promotion now also enforces local+dev evidence (aligned with prod policy intent).

## Go/No-Go Report

Decision: GO, with guardrails enforced for staging and production.

Reasoning:
- Mandatory local validation evidence is enforced in both staging and production workflows.
- Mandatory successful dev deployment evidence is enforced in both staging and production workflows.
- Production maintains manual approval and pre-deploy tests.
- Dev remains the first deploy target with tests and smoke checks.

## Blockers Identified During Review

1. Staging could previously run from branch push without proving local/dev evidence.
Status: Resolved.
Fix applied: Removed push trigger and added promotion verification job with required workflow_dispatch inputs.

## Required Fixes Applied

1. Workflow hardening: .github/workflows/deploy-staging.yml
- Removed auto trigger on push to `staging`.
- Added workflow_dispatch required inputs:
  - `local_validation_evidence`
  - `dev_run_id`
- Added `verify-dev-promotion` job to validate:
  - local evidence present
  - dev run id format
  - referenced run is `Full Deploy — Dev`
  - referenced run conclusion is `success`
- Wired `test` job dependency to `verify-dev-promotion`.

## Residual Operational Notes
- This guardrail model assumes operators provide truthful local evidence text.
- If stronger assurance is needed, convert local evidence into a signed artifact upload from CI and verify artifact existence by run id.
