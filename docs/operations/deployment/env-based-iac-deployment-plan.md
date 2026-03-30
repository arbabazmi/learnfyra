# Learnfyra Environment-Based IaC Deployment Plan

## Goal
Ship infrastructure in phases to minimize cost and risk:
1. Deploy a low-cost dev environment first.
2. Promote to staging after feature and integration validation.
3. Enable production-grade reliability and security only in prod.

## Environment Strategy

| Area | Dev (now) | Staging (next) | Prod (final) |
|---|---|---|---|
| Frontend delivery | S3 static website endpoint | CloudFront + private S3 | CloudFront + private S3 |
| API | API Gateway + Lambda | API Gateway + Lambda | API Gateway + Lambda |
| Lambda sizing | Cost-optimized (lower memory) | Baseline production profile | Production profile |
| Tracing | Disabled | Enabled | Enabled |
| S3 versioning | Disabled | Optional | Enabled |
| Removal policy | Destroy (safe cleanup) | Destroy/retain per test needs | Retain |
| Cache invalidation | Not required (no CF) | Required | Required |
| Security hardening | Minimal required | Expanded | Full hardening |

## Dev Phase Scope (Implement First)

### Keep in Dev
- S3 worksheet bucket (private)
- S3 frontend bucket (website hosting for dev only)
- API Gateway REST API
- Lambda generate/download handlers
- SSM secure parameter for Anthropic key
- IAM roles/policies required for deploy and runtime

### Defer in Dev
- CloudFront distribution and OAI
- WAF, advanced edge controls
- Prod-level observability and alarms
- Any non-essential managed services not needed for local/dev validation

### Dev Cost Controls
- Reduce generate Lambda memory to 512 MB
- Lower API throttling limits for dev traffic profile
- Use S3 website endpoint instead of CloudFront
- Keep stack removable (DESTROY) to avoid idle cost

## Promotion Gates

### Dev -> Staging
- CDK synth passes
- Unit/integration tests pass
- End-to-end flow validated: generate -> download -> solve -> submit
- Deploy workflow completes without manual fixes

### Staging -> Prod
- Performance and error budgets validated
- Security review passed (least privilege, bucket policies, origin protections)
- Observability and alarms verified
- Rollback path tested

## CI/CD Notes
- Dev workflow should not require CloudFront outputs.
- Staging/prod workflows must keep CloudFront cache invalidation.
- Continue OIDC role assumption for all deployments.

## Rollout Sequence
1. Finalize dev-first stack changes and tests.
2. Deploy dev via manual workflow_dispatch.
3. Validate functionality and collect baseline cost.
4. Re-enable CloudFront path in staging and prod only.
5. Add remaining hardening controls incrementally.
