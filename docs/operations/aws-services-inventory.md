# Learnfyra AWS Services Inventory

Date: 2026-03-25
Status: Consolidated from current specs + infra/cdk
Scope: Required AWS services, current implementation status, resource naming, ARN patterns

---

## 1. Sources Scanned

- CLAUDE.md
- docs/specs/online-solve-spec.md
- docs/specs/auth-online-offline-reporting-spec.md
- docs/specs/reward-engagement-flow-spec.md
- docs/specs/feature-reward-engagement-system.md
- docs/specs/super-admin-model-control-plane-spec.md
- docs/specs/super-admin-platform-operations-spec.md
- docs/operations/admin-control-plane-operations-spec.md
- infra/cdk/bin/app.ts
- infra/cdk/lib/learnfyra-stack.ts
- infra/cdk/test/learnfyra-stack.test.ts

---

## 2. What Is Already Done in Infra (CDK)

Current CDK stack provisions these services today:

1. Amazon S3
2. AWS Lambda
3. Amazon API Gateway (REST)
4. Amazon CloudFront
5. AWS Systems Manager Parameter Store (reads existing secure parameter)
6. AWS Identity and Access Management (IAM policies for Lambda access)
7. AWS X-Ray tracing (enabled for staging and prod Lambdas)

### 2.1 Provisioned Resource Names by Environment

The stack supports env values: dev, staging, prod.

- S3 worksheet bucket: learnfyra-{env}-s3-worksheets
- S3 frontend bucket: learnfyra-{env}-s3-frontend
- Lambda generate: learnfyra-{env}-lambda-generate
- Lambda download: learnfyra-{env}-lambda-download
- API Gateway REST API name: learnfyra-{env}-apigw
- CloudFront comment/name marker: learnfyra-{env}-cloudfront
- SSM secure parameter path consumed by Lambda: /learnfyra/{env}/anthropic-api-key

### 2.2 Implemented Configuration Highlights

- Worksheet bucket is private, encrypted (SSE-S3), lifecycle 7 days under worksheets/.
- Frontend bucket is private and served through CloudFront Origin Access Identity.
- Lambda runtime is nodejs20.x, architecture is arm64.
- Generate Lambda: 1024 MB, 60 sec timeout.
- Download Lambda: 256 MB, 30 sec timeout.
- API Gateway has CORS enabled and stage name = {env}.
- CloudFront routes /api/* to API Gateway and static files to S3.
- X-Ray tracing mode is active in staging/prod and disabled in dev.

---

## 3. Resource ARN and Identifier Reference

Note: Exact ARNs need deployed account ID and region. This repo currently provides deterministic names, so ARN formats are listed below.

### 3.1 S3

- Worksheet bucket ARN:
  arn:aws:s3:::learnfyra-{env}-s3-worksheets
- Worksheet object ARN pattern:
  arn:aws:s3:::learnfyra-{env}-s3-worksheets/*
- Frontend bucket ARN:
  arn:aws:s3:::learnfyra-{env}-s3-frontend
- Frontend object ARN pattern:
  arn:aws:s3:::learnfyra-{env}-s3-frontend/*

### 3.2 Lambda

- Generate function ARN pattern:
  arn:aws:lambda:{region}:{account-id}:function:learnfyra-{env}-lambda-generate
- Download function ARN pattern:
  arn:aws:lambda:{region}:{account-id}:function:learnfyra-{env}-lambda-download

### 3.3 API Gateway

- REST API execute endpoint pattern:
  https://{api-id}.execute-api.{region}.amazonaws.com/{env}
- REST API ARN pattern:
  arn:aws:apigateway:{region}::/restapis/{api-id}
- Stage ARN pattern:
  arn:aws:apigateway:{region}::/restapis/{api-id}/stages/{env}

### 3.4 CloudFront

- Distribution ID: created at deploy time, exported as stack output DistributionId
- Distribution domain: created at deploy time, exported as stack output FrontendUrl
- Distribution ARN pattern:
  arn:aws:cloudfront::{account-id}:distribution/{distribution-id}

### 3.5 Parameter Store (SSM)

- Secure string parameter name used by generate Lambda:
  /learnfyra/{env}/anthropic-api-key
- Parameter ARN pattern:
  arn:aws:ssm:{region}:{account-id}:parameter/learnfyra/{env}/anthropic-api-key

### 3.6 CloudFormation Outputs (already defined)

- FrontendUrl
- DistributionId
- ApiGatewayUrl
- WorksheetBucketName
- FrontendBucketName

---

## 4. AWS Services Required by Specs But Not Yet Provisioned in Current CDK

These are required in docs but are not currently defined in infra/cdk/lib/learnfyra-stack.ts.

1. AWS Secrets Manager
- For provider API keys, admin secrets, and rotation workflows.
- Expected secret naming pattern in specs: learnfyra/{env}/{provider}-api-key

2. Amazon DynamoDB
- For users, attempts, aggregates, rewards, admin users, audit events, system config.
- Example specified tables include:
  - learnfyra-{env}-student-profiles
  - learnfyra-{env}-class-goals
  - learnfyra-{env}-admin-users
  - learnfyra-{env}-audit-events
  - learnfyra-{env}-system-config

3. Amazon Cognito
- For teacher/student/admin authentication and role-scoped access.

4. Amazon EventBridge (CloudWatch Events)
- For scheduled jobs (streak checks, secret rotation, exports, reconciliations).

5. Amazon CloudWatch (expanded)
- Custom dashboards, alarms, and operational metrics beyond default logs/metrics.

6. Amazon SNS
- Alerting and on-call notifications from alarms and automation workflows.

7. AWS WAF
- Rate limiting and abuse/IP blocking on CloudFront/API edge.

8. AWS Cost Explorer API integration
- For cost dashboards and anomaly analysis in admin operations.

9. AWS CloudTrail
- For full audit trail and incident forensics.

10. Amazon GuardDuty
- Threat detection (explicitly referenced in operations guidance).

11. Amazon Athena + S3 archival flow (optional/phase-based)
- For long-term audit-log querying after archive.

12. Amazon S3 additional buckets (planned)
- learnfyra-{env}-s3-assets (badge/media assets)
- learnfyra-{env}-s3-logs (logs/archive per operations strategy)

13. Additional Lambda functions (planned)
- solve/submit deployment wiring in AWS
- rewards-dashboard
- streak-check
- secret-rotator
- rotation-validator
- log-exporter
- admin API function set

---

## 5. Gap Summary (Infra vs Spec)

- Implemented now: Core generate/download delivery path (S3 + Lambda + API Gateway + CloudFront + SSM parameter read).
- Missing for full platform target: auth, persistence, admin control plane, rewards persistence, cost/security ops automation.
- Immediate next infra additions for online solve parity on AWS:
  1) add solve and submit Lambda routes
  2) add S3 solve-data/result object policies
  3) add required monitoring alarms

---

## 6. Quick Verification Commands (after deployment)

Use these commands to replace ARN patterns with exact values:

- Lambda:
  aws lambda get-function --function-name learnfyra-dev-lambda-generate --query Configuration.FunctionArn --output text

- S3 bucket location and name confirmation:
  aws s3api get-bucket-location --bucket learnfyra-dev-s3-worksheets

- API Gateway ID:
  aws apigateway get-rest-apis --query "items[?name=='learnfyra-dev-apigw'].id" --output text

- CloudFront distribution:
  aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='learnfyra-dev-cloudfront'].{Id:Id,DomainName:DomainName}" --output table

- SSM parameter ARN:
  aws ssm get-parameter --name /learnfyra/dev/anthropic-api-key --with-decryption --query Parameter.ARN --output text
