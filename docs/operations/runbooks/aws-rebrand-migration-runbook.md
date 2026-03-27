# Learnfyra AWS Rebrand Migration Runbook

Date: 2026-03-25
Status: Implementation baseline
Scope: Replace old edusheet-named AWS resources with learnfyra-named resources and remove old infrastructure after cutover.

---

## Goal

Move all AWS infrastructure from old edusheet naming to learnfyra naming so the final AWS account state contains only learnfyra resources.

Important constraints:

1. CloudFormation stacks cannot be renamed in place.
2. S3 buckets cannot be renamed in place.
3. CloudFront distributions are effectively replaced, not renamed.
4. Safe migration is create new, cut over traffic, then delete old.

---

## Target Learnfyra Resource Patterns

| Service Type | Resource Name Pattern | Use |
|---|---|---|
| CloudFormation Stack | LearnfyraStack-{env} | Owns and deploys all environment infrastructure |
| S3 Bucket | learnfyra-{env}-s3-worksheets | Private worksheet and solve-data storage |
| S3 Bucket | learnfyra-{env}-s3-frontend | Private static frontend origin for CloudFront |
| Lambda Function | learnfyra-{env}-lambda-generate | Worksheet generation and export orchestration |
| Lambda Function | learnfyra-{env}-lambda-download | Download and presigned URL handling |
| API Gateway REST API | learnfyra-{env}-apigw | Public API entry point for frontend/API requests |
| CloudFront Distribution | learnfyra-{env}-cloudfront | HTTPS CDN and API proxy layer |
| SSM Parameter | /learnfyra/{env}/anthropic-api-key | Runtime secure config lookup for model access |
| IAM Roles/Policies | CDK generated under Learnfyra stack | Lambda execution and least-privilege service access |
| CloudWatch Log Group | /aws/lambda/learnfyra-{env}-lambda-* | Lambda execution logs and troubleshooting |

---

## Migration Sequence

### Phase 1: Deploy Learnfyra Resources

1. Deploy learnfyra stack for `dev`.
2. Verify API, frontend, Lambda, and bucket outputs.
3. Repeat for `staging`.
4. Repeat for `prod` only after validation.

### Phase 2: Migrate Data If Needed

Use this only if old worksheet data must be preserved.

1. Copy old worksheet bucket contents to the new worksheet bucket.
2. Validate object counts and key structure.
3. Confirm application reads from the new bucket names only.

### Phase 3: Cut Traffic Over

1. Update frontend/API references to learnfyra endpoints.
2. Update DNS/custom-domain mapping if used.
3. Watch traffic and error metrics for 24 to 48 hours.

### Phase 4: Delete Old Resources

1. Disable and delete old CloudFront distributions.
2. Delete old API Gateway resources.
3. Delete old Lambda functions.
4. Remove old SSM parameter paths.
5. Empty and delete old S3 buckets.
6. Delete old CloudFormation stacks.
7. Confirm no `edusheet` resources remain.

---

## Delete Order

Recommended old-resource teardown order:

1. CloudFront distribution
2. API Gateway
3. Lambda functions
4. SSM parameters
5. S3 buckets
6. CloudFormation stack
7. Optional CloudWatch log groups

Why this order:

1. Traffic stops before backends are removed.
2. S3 deletion is left late because it may need backup/manual emptying.
3. Stack deletion is last so CloudFormation can clean up anything still referenced.

---

## Required Checks Before Deletion

1. New learnfyra stack is healthy in the target environment.
2. No hardcoded old endpoints remain in frontend, workflows, or env config.
3. Any required S3 data has been copied or intentionally discarded.
4. No downstream stacks import old CloudFormation exports.
5. Old buckets are empty or explicitly backed up.

---

## Repo Cleanup Completed Here

This repository cleanup supports that migration by:

1. Renaming the infra test file to learnfyra naming.
2. Removing the old edusheet compatibility stack file.
3. Updating the infra lockfile package name.
4. Keeping the AWS inventory aligned with current learnfyra naming.

---

## Next Execution Step

Before touching live AWS resources, run discovery and diff checks per environment:

1. `cd infra/cdk`
2. `npx cdk diff --context env=dev`
3. `npx cdk diff --context env=staging`
4. `npx cdk diff --context env=prod`

If the diffs are acceptable, proceed with environment-by-environment cutover and then delete old edusheet resources.