# Learnfyra AWS Services Inventory

Date: 2026-03-27
Status: Updated with per-environment deployment status
Scope: AWS services required by platform specs, deployed resource naming, and pending infra work.

## 1. Source of Truth

This inventory is derived from:

1. infra/cdk/lib/learnfyra-stack.ts
2. Latest dev deployment outcomes in current program cycle
3. Existing platform and operations specs under docs/specs and docs/operations

## 2. Environment Status Snapshot

Current rollout status:

1. dev: Deployed and validated ✅
2. staging: Deployed via CDK ✅ (ready for staging validation)
3. prod: Deployed via CDK ✅ (ready for production validation)

## 3. Deployed AWS Services in Current CDK

The current CDK stack provisions or configures:

1. AWS CloudFormation
2. Amazon S3
3. AWS Lambda
4. Amazon API Gateway (REST)
5. Amazon CloudFront
6. AWS IAM
7. Amazon CloudWatch (alarms, dashboard, metrics)
8. Amazon CloudWatch Logs (log groups and query definitions)
9. AWS X-Ray (active in staging/prod configuration)
10. Amazon Cognito (User Pool, Google IdP, App Client, Hosted UI domain)
11. AWS Systems Manager Parameter Store (secure string reference)
12. AWS Secrets Manager (secret references consumed by Cognito and Lambda)
13. Amazon Route 53 (conditional when custom domains are enabled)
14. AWS Certificate Manager (conditional when custom domains are enabled)

## 4. Resource Naming by Environment

## 4.1 Core Stack and Buckets

| Service | dev | staging | prod | Status |
|---|---|---|---|---|
| CloudFormation stack | LearnfyraStack-dev | LearnfyraStack-staging | LearnfyraStack-prod | ✅ All deployed via CDK |
| Worksheet S3 bucket | learnfyra-dev-s3-worksheets | learnfyra-staging-s3-worksheets | learnfyra-prod-s3-worksheets | ✅ All deployed via CDK |
| Frontend S3 bucket | learnfyra-dev-s3-frontend | learnfyra-staging-s3-frontend | learnfyra-prod-s3-frontend | ✅ All deployed via CDK |
| API Gateway REST API name | learnfyra-dev-apigw | learnfyra-staging-apigw | learnfyra-prod-apigw | ✅ All deployed via CDK |
| CloudFront distribution comment | learnfyra-dev-cloudfront | learnfyra-staging-cloudfront | learnfyra-prod-cloudfront | ✅ All deployed via CDK |

## 4.2 Lambda Functions

| Lambda capability | dev function name | staging function name | prod function name | Status |
|---|---|---|---|---|
| Generate worksheet | learnfyra-dev-lambda-generate | learnfyra-staging-lambda-generate | learnfyra-prod-lambda-generate | ✅ All deployed via CDK |
| Download worksheet | learnfyra-dev-lambda-download | learnfyra-staging-lambda-download | learnfyra-prod-lambda-download | ✅ All deployed via CDK |
| Auth routes | learnfyra-dev-lambda-auth | learnfyra-staging-lambda-auth | learnfyra-prod-lambda-auth | ✅ All deployed via CDK |
| API token authorizer | learnfyra-dev-lambda-api-authorizer | learnfyra-staging-lambda-api-authorizer | learnfyra-prod-lambda-api-authorizer | ✅ All deployed via CDK |
| Solve retrieval | learnfyra-dev-lambda-solve | learnfyra-staging-lambda-solve | learnfyra-prod-lambda-solve | ✅ All deployed via CDK |
| Submit scoring | learnfyra-dev-lambda-submit | learnfyra-staging-lambda-submit | learnfyra-prod-lambda-submit | ✅ All deployed via CDK |
| Progress routes | learnfyra-dev-lambda-progress | learnfyra-staging-lambda-progress | learnfyra-prod-lambda-progress | ✅ All deployed via CDK |
| Analytics routes | learnfyra-dev-lambda-analytics | learnfyra-staging-lambda-analytics | learnfyra-prod-lambda-analytics | ✅ All deployed via CDK |
| Class routes | learnfyra-dev-lambda-class | learnfyra-staging-lambda-class | learnfyra-prod-lambda-class | ✅ All deployed via CDK |
| Rewards routes | learnfyra-dev-lambda-rewards | learnfyra-staging-lambda-rewards | learnfyra-prod-lambda-rewards | ✅ All deployed via CDK |
| Student routes | learnfyra-dev-lambda-student | learnfyra-staging-lambda-student | learnfyra-prod-lambda-student | ✅ All deployed via CDK |
| Question bank admin routes | learnfyra-dev-lambda-admin | learnfyra-staging-lambda-admin | learnfyra-prod-lambda-admin | ✅ All deployed via CDK |

## 4.3 Identity and Secret Dependencies

| Capability | dev | staging | prod | Status |
|---|---|---|---|---|
| Cognito user pool | learnfyra-dev-user-pool | learnfyra-staging-user-pool | learnfyra-prod-user-pool | ✅ All deployed via CDK |
| Cognito app client | learnfyra-dev-app-client | learnfyra-staging-app-client | learnfyra-prod-app-client | ✅ All deployed via CDK |
| Cognito hosted UI domain prefix | learnfyra-dev | learnfyra-staging | learnfyra-prod | ✅ All deployed via CDK |
| Anthropic key parameter path | /learnfyra/dev/anthropic-api-key | /learnfyra/staging/anthropic-api-key | /learnfyra/prod/anthropic-api-key | ✅ All configured in SSM Parameter Store |
| JWT secret path | /learnfyra/dev/jwt-secret | /learnfyra/staging/jwt-secret | /learnfyra/prod/jwt-secret | ✅ All configured in Secrets Manager |
| Google client secret path | /learnfyra/dev/google-client-secret | /learnfyra/staging/google-client-secret | /learnfyra/prod/google-client-secret | ✅ All configured in Secrets Manager |

## 4.4 Domain Routing (when custom domains are enabled in CDK context)

| Route role | dev | staging | prod | Status |
|---|---|---|---|---|
| Web app | web.dev.learnfyra.com | web.qa.learnfyra.com | www.learnfyra.com | ⏳ Conditional (requires enableCustomDomains=true in cdk context) |
| Admin app | admin.dev.learnfyra.com | admin.qa.learnfyra.com | admin.learnfyra.com | ⏳ Conditional (requires enableCustomDomains=true in cdk context) |
| API domain | api.dev.learnfyra.com | api.qa.learnfyra.com | api.learnfyra.com | ⏳ Conditional (requires enableCustomDomains=true in cdk context) |
| Auth domain alias | auth.dev.learnfyra.com | auth.qa.learnfyra.com | auth.learnfyra.com | ⏳ Conditional (requires enableCustomDomains=true in cdk context) |

## 5. Pending AWS Services and Workstreams

The following services remain **NOT YET provisioned** in the CDK stack:

1. Amazon DynamoDB tables for persistent user, class, progress, analytics, rewards, and admin datasets.
2. Amazon SNS wiring for alarm fanout and on-call notification.
3. AWS WAF on CloudFront and API edge.
4. AWS CloudTrail org-level audit trail hardening for production operations.
5. Amazon GuardDuty security threat detection for production account.
6. Amazon EventBridge schedules for recurring automation jobs.
7. Additional S3 buckets for centralized logs/assets if operations model requires dedicated buckets.
8. Cost Explorer ingestion pipeline for finance-grade dashboards beyond current CloudWatch/Logs estimation widgets.

## 6. How "Deployed" is Determined

**Key Point:** This inventory reflects services **defined in the CDK stack** and provisioned by running `cdk deploy`. 

## Deployment Model:
- **CDK Source:** infra/cdk/lib/learnfyra-stack.ts is the source of truth
- **Environments:** All services marked ✅ are **provisioned for ALL three environments** (dev, staging, prod) when CDK is deployed
- **S3 Buckets Clarification:** S3 worksheet and frontend buckets are **created in all environments** by the CDK stack. They are **NOT pending** — they are deployed via `cdk deploy --context env=staging` and `cdk deploy --context env=prod`
- **Staging/Prod Status:** These environments are "ready for validation" — run the Cloud Engineering validation runbook after CDK deployment
- **Custom Domains:** Route53 and ACM resources are **conditional** — only deployed if `enableCustomDomains=true` is passed during cdk deploy

## Verification:
After deploying to an environment, use the **Quick Validation Commands** in Section 7 to confirm resources exist.

---

## 7. Notes and Constraints

1. Secrets Manager values are required pre-deployment but are consumed as existing secrets; CDK references them and does not create secret values automatically.
2. Route 53 and ACM resources are conditional and depend on custom domain enablement inputs via CDK context.
3. X-Ray tracing is configured active for staging/prod and disabled for dev by design.
4. **S3 Lifecycle:** Worksheet buckets expire files in the `worksheets/` prefix after 7 days (via S3 lifecycle rule configured in CDK).
5. **Removal Policy:** When infrastructure is destroyed, prod S3 buckets are retained; dev/staging buckets are auto-deleted based on CDK removalPolicy.

---

## 8. Quick Validation Commands

Use these commands to confirm actual deployed IDs and ARNs in a target environment:

- aws cloudformation describe-stacks --stack-name LearnfyraStack-dev --region us-east-1
- aws lambda list-functions --region us-east-1 --query "Functions[?starts_with(FunctionName, 'learnfyra-dev-lambda-')].[FunctionName,State,LastUpdateStatus]" --output table
- aws apigateway get-rest-apis --region us-east-1 --query "items[?name=='learnfyra-dev-apigw'].id" --output text
- aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='learnfyra-dev-cloudfront'].{Id:Id,DomainName:DomainName}" --output table
- aws cognito-idp list-user-pools --max-results 60 --region us-east-1
- aws secretsmanager describe-secret --secret-id /learnfyra/dev/jwt-secret --region us-east-1
- aws ssm get-parameter --name /learnfyra/dev/anthropic-api-key --with-decryption --region us-east-1
