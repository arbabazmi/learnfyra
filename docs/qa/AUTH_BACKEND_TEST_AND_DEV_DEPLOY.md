# Auth and Backend Test and Deployment Documentation Index

Date: 2026-03-27
Status: Split into role-specific runbooks

This index replaces the previous mixed runbook. Use the document that matches your role.

## 1. Developer Testing Runbook

For backend and auth functional testing, use:

- docs/qa/developer-backend-auth-test-runbook.md

Covers:

1. Automated test gates.
2. Local auth and protected route testing.
3. API smoke validation checklist.
4. External API smoke journey for developers and QA.

## 2. Cloud Engineering Validation Runbook

For post-deploy AWS validation and environment readiness, use:

- docs/operations/runbooks/cloud-engineering-aws-validation-runbook.md

Covers:

1. CloudFormation resource health checks.
2. API Gateway, Lambda, Cognito, CloudFront, Route53 validation.
3. Secrets Manager and SSM dependency checks.
4. CloudWatch alarms, logs, and release gate criteria.

## 3. AWS Service Inventory and Status

For deployed vs pending AWS service status by environment, use:

- docs/operations/inventory/aws-services-inventory.md
