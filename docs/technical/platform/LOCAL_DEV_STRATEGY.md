# Learnfyra Local Development Strategy
# File: docs/technical/platform/LOCAL_DEV_STRATEGY.md
# Version: 1.0
# Date: 2026-03-24
# Status: Canonical local-vs-AWS parity guide

---

## Purpose

Define how the same application code runs both locally and on AWS by swapping infrastructure adapters via environment configuration rather than forking business logic.

---

## Parity Principle

1. Keep domain logic identical across local and AWS
2. Switch only data and platform adapters based on runtime environment
3. Validate every feature in both modes before merge

---

## Runtime Profiles

### Local Profile

1. `NODE_ENV=development`
2. `APP_RUNTIME=local`
3. File-based worksheet artifacts in `worksheets-local/`
4. Local or emulated data services

### AWS Profile

1. `NODE_ENV=production`
2. `APP_RUNTIME=aws`
3. S3, DynamoDB, Secrets Manager, Parameter Store, CloudWatch

---

## Service Adapter Strategy

### Auth

1. Local: mock auth provider with deterministic test identities
2. AWS: Cognito and configured OAuth providers

### Database

1. Local: DynamoDB Local or lightweight local adapter for development
2. AWS: DynamoDB tables defined by IaC

### Config and Secrets

1. Local: `.env` and local config files
2. AWS: Parameter Store for config and Secrets Manager for credentials

### Metrics

1. Local: structured logs and counters for dev visibility
2. AWS: CloudWatch metrics, alarms, and dashboards

---

## Required Environment Variables

### Core

1. `NODE_ENV`
2. `APP_RUNTIME`
3. `USE_LOCAL_AWS_EMULATION`

### Data

1. `WORKSHEET_STORAGE_MODE` values: `local` or `s3`
2. `DDB_ENDPOINT` for local DynamoDB when emulated
3. `DDB_TABLE_PREFIX`

### Auth

1. `AUTH_MODE` values: `mock` or `cognito`
2. `COGNITO_USER_POOL_ID`
3. `COGNITO_CLIENT_ID`

### Model Control Plane

1. `MODEL_CONFIG_SOURCE` values: `local-file` or `ssm`
2. `MODEL_CONFIG_LOCAL_PATH`
3. `SECRET_SOURCE` values: `env` or `secrets-manager`

---

## Adapter Contract Requirements

Every adapter should expose the same interface for:

1. read worksheet metadata and solve data
2. persist attempts and aggregates
3. fetch auth identity context
4. resolve model routing configuration
5. fetch provider credentials
6. emit telemetry events

---

## Minimal Local Tooling

1. Script to initialize local data stores and seed fixtures
2. Script to run app in local profile
3. Script to run parity checks against local profile and AWS-like profile

---

## Validation Gates

Before considering a module complete:

1. Feature smoke test passes in local profile
2. Feature smoke test passes in AWS profile assumptions
3. Request and response contracts are identical in both modes
4. No module includes AWS-only business logic branches in core domain code

---

## Module Mapping

### Online Solve

1. Local: filesystem in `worksheets-local/{uuid}/solve-data.json`
2. AWS: S3 object retrieval

### Auth and Reporting

1. Local: mock auth + local data adapter
2. AWS: Cognito + DynamoDB + CloudWatch

### Rewards

1. Local: same reward engine over local or emulated aggregates
2. AWS: reward engine over DynamoDB + precomputed aggregates

### Super Admin Control Plane

1. Local: local config files and env secret source
2. AWS: Parameter Store + Secrets Manager + audit events

---

## Notes

This document is normative for parity expectations and should be referenced by all major module specs.
