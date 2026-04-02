# Learnfyra AWS Services Technical Reference

Date: 2026-03-26
Status: Current implementation reference
Primary infrastructure source: [infra/cdk/lib/learnfyra-stack.ts](c:\arbab-github\learnfyra\infra\cdk\lib\learnfyra-stack.ts)

## Scope

This document lists the AWS services currently used by the Learnfyra platform infrastructure, based on the active CDK stack.

Stack names by environment:

| Environment | CloudFormation Stack Name |
|---|---|
| dev | `LearnfyraStack-dev` |
| staging | `LearnfyraStack-staging` |
| prod | `LearnfyraStack-prod` |

## Cost Notes

- Costs below are rough expected ranges, not billing guarantees.
- They depend on traffic, storage growth, number of requests, log volume, and whether custom domains are enabled.
- Dev usually stays low cost.
- Staging and prod can increase materially if API traffic, PDF generation, CloudFront transfer, or CloudWatch retention grows.

## AWS Services In Use

| AWS Service | Objective / Description | Purpose in Learnfyra | Stack Name | Provisioned Service / Resource Name | Possible Expected Cost |
|---|---|---|---|---|---|
| Amazon S3 | Object storage for generated worksheet files and frontend hosting assets. | Stores worksheets, answer keys, metadata, and frontend static files. | `LearnfyraStack-{env}` | `learnfyra-{env}-s3-worksheets`, `learnfyra-{env}-s3-frontend` | Dev: typically `< $1-$5/month`. Staging/prod: variable with storage and transfer; can grow with downloads and frontend traffic. |
| AWS Lambda | Serverless compute for API handlers. | Runs backend business logic for generation, download, auth, solve, submit, progress, analytics, class, rewards, student, and admin/question-bank APIs. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-generate`, `learnfyra-{env}-lambda-download`, `learnfyra-{env}-lambda-auth`, `learnfyra-{env}-lambda-solve`, `learnfyra-{env}-lambda-submit`, `learnfyra-{env}-lambda-progress`, `learnfyra-{env}-lambda-analytics`, `learnfyra-{env}-lambda-class`, `learnfyra-{env}-lambda-rewards`, `learnfyra-{env}-lambda-student`, `learnfyra-{env}-lambda-admin` | Dev: often `< $5-$15/month` under light use. Prod can range from low to high depending on invocation count, duration, and PDF generation workload. |
| Amazon API Gateway (REST) | Public HTTP API layer in front of Lambda. | Exposes backend endpoints for generation, auth, solve/submit, progress, class, rewards, analytics, question bank, and admin flows. | `LearnfyraStack-{env}` | REST API name pattern: `learnfyra-{env}-apigw` | Dev: typically low, around `< $5/month` for limited traffic. Prod scales by request volume and data transfer. |
| Amazon CloudFront | CDN and edge routing layer. | Serves frontend assets globally and routes `/api/*` traffic to API Gateway while caching static content. | `LearnfyraStack-{env}` | Distribution comment/name marker: `learnfyra-{env}-cloudfront` | Dev: usually `< $1-$10/month`. Prod varies with bandwidth, requests, and cache hit rate; can become a meaningful recurring cost under public traffic. |
| AWS Systems Manager Parameter Store | Parameter/config store for runtime secrets and environment configuration. | Supplies Anthropic API key path and JWT secret values to infrastructure/runtime configuration. | `LearnfyraStack-{env}` | `/learnfyra/{env}/anthropic-api-key`, `/learnfyra/{env}/jwt-secret` | Standard parameters are usually negligible. Secure or advanced parameter usage can add small monthly charges. |
| AWS Identity and Access Management (IAM) | Access control for AWS resources. | Grants Lambda permissions to read/write S3 objects, read parameters, and emit logs. | `LearnfyraStack-{env}` | Auto-generated Lambda execution roles and inline policies | No direct extra charge for IAM itself. |
| Amazon CloudWatch | Monitoring, metrics, alarms, dashboards, and log-driven observability. | Tracks Lambda/API health, latency, error rate, throttling, anomaly detection, and operational dashboards. | `LearnfyraStack-{env}` | CloudWatch alarms, dashboard `BackendObservabilityDashboard`, API alarms, Lambda alarms | Usually a few dollars in dev. Staging/prod can range from `$5-$30+/month` depending on metrics, alarms, dashboards, anomaly detection, and API volume. |
| Amazon CloudWatch Logs | Centralized log storage for API Gateway and Lambda logs. | Captures API access logs, Lambda execution logs, and queryable operational records. | `LearnfyraStack-{env}` | Log group pattern includes `/aws/apigateway/learnfyra-{env}-access-logs` and Lambda log groups with one-month retention | Usually low in dev. Can grow noticeably with verbose logging, many invocations, and retained log volume. |
| AWS X-Ray | Distributed tracing service. | Provides request tracing for staging and prod Lambda/API execution paths. | `LearnfyraStack-{env}` | Enabled through Lambda tracing mode in staging/prod | Often low at small scale, but grows with trace volume. Dev is disabled, so no dev tracing cost. |
| AWS Certificate Manager (ACM) | TLS certificate management for custom domains. | Supports HTTPS certificates for CloudFront and API Gateway custom domains when enabled. | `LearnfyraStack-{env}` | Imported certificate ARNs for CloudFront and API Gateway | Public ACM certificates used with supported AWS services are typically `$0` certificate cost. |
| Amazon Route 53 | DNS routing and alias records for application domains. | Creates DNS records for API, web, admin, and dev auth domain mappings when custom domains are enabled. | `LearnfyraStack-{env}` | `ApiDomainRecord`, `WebDomainRecord`, `WwwDomainRecord`, `AdminDomainRecord`, `AuthDomainRecordDev` | Hosted zone cost is typically around `$0.50/month` per hosted zone plus DNS query charges. |

## Lambda Service Breakdown

| Lambda Function | Objective / Description | Purpose | Stack Name | Function Name Pattern | Possible Expected Cost |
|---|---|---|---|---|---|
| Generate | Worksheet generation and exporter orchestration. | Creates worksheet outputs and stores generated artifacts. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-generate` | Highest Lambda cost risk due to longer runtime and PDF/export workload. |
| Download | Presigned URL and download flow support. | Returns or mediates worksheet downloads. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-download` | Low to moderate unless download traffic becomes high. |
| Auth | Authentication route handler. | Handles register, login, logout, OAuth-related routes. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-auth` | Usually low. |
| Solve | Worksheet retrieval for online solving. | Returns solve-safe worksheet payloads without leaking answers. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-solve` | Usually low. |
| Submit | Submission scoring handler. | Scores answers and returns results. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-submit` | Usually low to moderate. |
| Progress | Progress tracking APIs. | Saves attempts and returns progress/history data. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-progress` | Usually low. |
| Analytics | Teacher/student analytics APIs. | Aggregates performance and reporting responses. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-analytics` | Usually low. |
| Class | Class management APIs. | Creates classes and returns rosters. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-class` | Usually low. |
| Rewards | Rewards and engagement APIs. | Returns student/class reward views. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-rewards` | Usually low. |
| Student | Student profile and class join APIs. | Supports profile retrieval and membership workflows. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-student` | Usually low. |
| Admin | Question bank admin API surface in current stack wiring. | Provides admin-backed API routes for question bank operations. | `LearnfyraStack-{env}` | `learnfyra-{env}-lambda-admin` | Usually low. |

## Monitoring and Observability Resources

| AWS Service Area | Objective / Description | Purpose | Stack Name | Resource Name / Pattern | Possible Expected Cost |
|---|---|---|---|---|---|
| CloudWatch Alarms | Threshold-based alerting for API and Lambda health. | Detects errors, p95 latency, throttling, anomaly spikes, and concurrency pressure. | `LearnfyraStack-{env}` | Examples: `ApiGateway5xxAlarm`, `ApiGatewayLatencyP95Alarm`, `{FunctionId}LambdaErrorsAlarm`, `{FunctionId}LambdaErrorRateAlarm` | Small to moderate recurring cost depending on alarm count. |
| CloudWatch Dashboard | Visual operational dashboard. | Consolidates backend service health and cost/usage widgets. | `LearnfyraStack-{env}` | `BackendObservabilityDashboard` | Usually low cost unless dashboards grow significantly. |
| CloudWatch Logs Insights Query Definitions | Saved log queries for ops and cost analysis. | Speeds investigation of errors, auth failures, latency hotspots, and estimated cost usage. | `LearnfyraStack-{env}` | `LambdaTopErrorsQueryDefinition`, `ApiAuthFailuresQueryDefinition`, `CostByFunctionQueryDefinition`, `CostEstimationQueryDefinition` | Definition objects are low cost; query execution cost depends on scanned log volume. |
| CloudWatch Anomaly Detection | Statistical anomaly detection on invocation behavior. | Flags unusual traffic patterns for Lambda functions. | `LearnfyraStack-{env}` | `{FunctionId}InvocationAnomalyDetector`, `{FunctionId}InvocationAnomalyAlarm` | Moderate incremental monitoring cost depending on count and frequency. |

## Conditional Services Used When Custom Domains Are Enabled

| AWS Service | Objective / Description | Purpose in Learnfyra | Stack Name | Provisioned Service / Resource Name | Possible Expected Cost |
|---|---|---|---|---|---|
| AWS Certificate Manager (CloudFront certificate import) | Imports existing certificate for CDN domains. | Enables HTTPS for `web`, `www`, and `admin` domain names on CloudFront. | `LearnfyraStack-{env}` | Imported via `cloudFrontCertificateArn` | Public certificate itself is typically `$0`. |
| AWS Certificate Manager (API certificate import) | Imports existing certificate for API domain. | Enables HTTPS for regional API custom domain. | `LearnfyraStack-{env}` | Imported via `apiCertificateArn` | Public certificate itself is typically `$0`. |
| Amazon API Gateway Custom Domain | Regional custom API entrypoint. | Maps branded API host to the API Gateway stage. | `LearnfyraStack-{env}` | `ApiCustomDomain`, `ApiBasePathMapping` | Small additional API custom-domain cost may apply. |
| Amazon Route 53 Records | DNS alias and CNAME records. | Connects branded domains to API Gateway and CloudFront. | `LearnfyraStack-{env}` | `ApiDomainRecord`, `WebDomainRecord`, `WwwDomainRecord`, `AdminDomainRecord`, `AuthDomainRecordDev` | Low incremental DNS cost beyond hosted zone and query charges. |

## Resource Naming Summary

| Resource Type | Naming Pattern |
|---|---|
| CloudFormation stack | `LearnfyraStack-{env}` |
| Worksheet bucket | `learnfyra-{env}-s3-worksheets` |
| Frontend bucket | `learnfyra-{env}-s3-frontend` |
| REST API | `learnfyra-{env}-apigw` |
| CloudFront comment | `learnfyra-{env}-cloudfront` |
| Anthropic SSM parameter | `/learnfyra/{env}/anthropic-api-key` |
| JWT secret parameter | `/learnfyra/{env}/jwt-secret` |
| Lambda functions | `learnfyra-{env}-lambda-*` |

## Current Deployed Dev Outputs

Based on the latest successful dev deployment:

| Output | Value |
|---|---|
| Stack | `LearnfyraStack-dev` |
| API Gateway URL | `https://fcciuafjrj.execute-api.us-east-1.amazonaws.com/dev/` |
| Frontend URL | `https://d2l8xz2utfrthp.cloudfront.net` |
| CloudFront Distribution ID | `E5NP5C6MLGUZP` |
| Frontend bucket | `learnfyra-dev-s3-frontend` |
| Worksheet bucket | `learnfyra-dev-s3-worksheets` |

## Additional Table: Monthly Cost Scenario (1,000 users, 10,000 worksheets)

This scenario estimates monthly AWS cost for current active services under the following workload:

- Active users (students + teachers): 1,000
- Worksheets generated per month: 10,000
- Average worksheet artifacts retained under 7-day lifecycle
- Moderate API/solve/submit usage and standard observability enabled

### Assumptions Used

| Assumption Item | Value Used for Estimate |
|---|---|
| Worksheet generation invocations | 10,000 per month |
| Additional API calls (solve/submit/auth/progress/etc.) | ~120,000 per month |
| Avg Lambda duration (blended across all handlers) | generate heavy, others light |
| CloudFront egress | ~120 GB per month |
| S3 average storage footprint after lifecycle averaging | 40-80 GB-month equivalent |
| CloudWatch logs ingestion and retention | moderate |
| Custom domain enabled | yes (Route 53 + API custom domain mapping path) |

### Estimated Monthly Cost by Service (Current Stack)

| AWS Service | Estimated Monthly Cost (USD) | Notes |
|---|---:|---|
| AWS Lambda | 8-22 | Main driver is worksheet generation runtime (PDF/export-heavy path). |
| Amazon API Gateway (REST) | 1-6 | Depends on total request volume and payload sizes. |
| Amazon CloudFront | 10-28 | Driven mostly by data transfer and request count. |
| Amazon S3 (worksheets + frontend) | 2-10 | Storage + request + transfer components; lifecycle helps control cost. |
| Amazon CloudWatch (alarms, dashboards, metrics) | 3-10 | Alarm count and anomaly detection can increase this. |
| CloudWatch Logs / Logs Insights | 4-14 | Depends on log verbosity and query scan volume. |
| AWS X-Ray (staging/prod) | 1-5 | Trace volume dependent. |
| AWS Systems Manager Parameter Store | 0-2 | Typically small unless advanced/secure-heavy usage grows. |
| Amazon Route 53 | 1-4 | Hosted zone + DNS queries. |
| AWS Certificate Manager (public certs) | 0 | Public ACM certificates for supported services are typically no direct charge. |
| AWS IAM | 0 | No direct service charge. |

### AI Model Cost Assumptions (Worksheet Generation)

The AWS table above does not include third-party AI model charges. For Learnfyra, worksheet generation uses Anthropic models and must be added separately.

| AI Cost Assumption Item | Value Used for Estimate |
|---|---|
| Worksheet generations per month | 10,000 |
| Average input tokens per generation | 6,000-10,000 |
| Average output tokens per generation | 800-1,500 |
| Estimated monthly input tokens | 60M-100M |
| Estimated monthly output tokens | 8M-15M |
| Model mix | Mostly low-cost model with premium escalation on harder/longer prompts |

### Estimated Monthly AI Model Cost (Not AWS)

| Cost Component | Estimated Monthly Cost (USD) | Notes |
|---|---:|---|
| Anthropic API model usage | 120-600 | Wide range based on token volume, model mix (low-cost vs premium), retries, and prompt size. |

### Estimated Total Monthly Cost (Current Active Stack + AI Model)

| Scenario | Estimated Total (USD / month) |
|---|---:|
| Lower-usage within this workload model | 150 |
| Expected blended range | 220-690 |
| Higher-usage (heavier generation and premium model share) | 780 |

### Estimated Total Monthly Cost (AWS-Only, Excluding AI Model)

| Scenario | Estimated Total (USD / month) |
|---|---:|
| Lower-usage within this workload model | 30 |
| Expected blended range | 45-90 |
| Higher-usage (heavier downloads/logs/runtime) | 110 |

### Notes on Planned-but-Not-Yet-Provisioned Services

If later enabled, DynamoDB, Cognito, Secrets Manager, EventBridge, WAF, SNS, GuardDuty, and CloudTrail will add incremental AWS cost beyond the totals above.


## Platform Services To Capture (Requested Coverage)

The following services are part of the platform target architecture and are now explicitly captured here even when not yet provisioned by the active CDK stack.

| AWS Service | Objective / Description | Purpose in Learnfyra | Stack Name | Service Name / Resource Naming Pattern | Implementation Status | Possible Expected Cost |
|---|---|---|---|---|---|---|
| Amazon DynamoDB | Managed NoSQL database for low-latency key-value and document access. | Persistent store for user profiles, attempts, aggregates, class goals, admin users, audit events, and system config. | Planned to be added to `LearnfyraStack-{env}` or split data stack | Examples from architecture docs: `learnfyra-{env}-student-profiles`, `learnfyra-{env}-class-goals`, `learnfyra-{env}-admin-users`, `learnfyra-{env}-audit-events`, `learnfyra-{env}-system-config` | Planned / not provisioned in current CDK | Dev: low (often `< $5-$20/month` with light on-demand usage). Prod varies with read/write throughput and storage. |
| Amazon Cognito | Managed identity service for sign-up/sign-in and JWT issuance. | User authentication and role-scoped access for student, teacher, parent, and admin flows. | Planned for `LearnfyraStack-{env}` auth layer | Suggested naming: `learnfyra-{env}-user-pool`, `learnfyra-{env}-app-client`, `learnfyra-{env}-identity-pool` | Planned / not provisioned in current CDK | Can be low at small MAU levels; scales with monthly active users and advanced auth features. |
| AWS Secrets Manager | Managed secret storage with rotation support. | Secure storage for provider API keys and operational secrets beyond Parameter Store. | Planned for `LearnfyraStack-{env}` or secrets stack | Naming pattern from specs: `learnfyra/{env}/{provider}-api-key` | Planned / not provisioned in current CDK | Usually modest per secret plus API-call costs; increases with number of secrets and rotation frequency. |
| Amazon EventBridge | Event bus and scheduler for event-driven automation. | Scheduled jobs for streak checks, secret rotation, exports, and backend housekeeping workflows. | Planned for `LearnfyraStack-{env}` automation layer | Suggested names: `learnfyra-{env}-event-bus`, scheduled rules for rewards/ops jobs | Planned / not provisioned in current CDK | Typically low at small event volumes; grows with event count and schedule frequency. |
| AWS WAF | Web application firewall for edge/API protection. | Rate limiting, bot/abuse controls, and request filtering in front of CloudFront/API traffic. | Planned for edge/security layer attached to `LearnfyraStack-{env}` distribution/API | Suggested pattern: `learnfyra-{env}-waf-webacl` | Planned / not provisioned in current CDK | Fixed web ACL/rule costs plus request inspection costs; can become meaningful under high traffic. |
| Amazon SNS | Pub/Sub notifications and alarm fanout. | Sends operational alerts from CloudWatch alarms to email/Slack/on-call integrations. | Planned for observability/ops layer in `LearnfyraStack-{env}` | Suggested pattern: `learnfyra-{env}-alerts-topic` | Planned / not provisioned in current CDK | Generally low for moderate notification volume; charges per publish and delivery channel. |
| Amazon GuardDuty | Managed threat detection across AWS accounts/workloads. | Continuous security monitoring and anomaly detection for account and workload activity. | Usually account-level security service, optionally referenced by env stack docs | Account-level detector; optionally tagged per env context | Planned / not provisioned by current application CDK | Baseline plus data-source analysis costs; varies by CloudTrail/VPC Flow/DNS event volume. |
| AWS CloudTrail | API activity audit logging service. | Governance, forensic investigation, and compliance-grade audit trail for AWS actions. | Typically account-level with optional env-aligned log destinations | Suggested naming: trail with logs in `learnfyra-{env}-s3-logs` or centralized org trail bucket | Planned / not provisioned by current application CDK | One management event trail is often low/no extra base cost; data events and advanced configurations add cost. |

### Recommended Stack Placement for These Services

| Service | Recommended Stack Placement |
|---|---|
| DynamoDB | `LearnfyraStack-{env}` initially, optional future split to `LearnfyraDataStack-{env}` |
| Cognito | `LearnfyraStack-{env}` auth section or separate `LearnfyraAuthStack-{env}` |
| Secrets Manager | `LearnfyraStack-{env}` or shared security stack |
| EventBridge | `LearnfyraStack-{env}` automation section |
| WAF | `LearnfyraStack-{env}` edge section, associated to CloudFront/API |
| SNS | `LearnfyraStack-{env}` observability section |
| GuardDuty | Account/security baseline (outside app stack lifecycle) |
| CloudTrail | Account/security baseline (outside app stack lifecycle) |

## Notes

- This document reflects the services currently used by the CDK stack, not every service mentioned in long-term roadmap documents.
- DynamoDB, Cognito, Secrets Manager, EventBridge, WAF, SNS, GuardDuty, and CloudTrail are now captured in the table above; they remain planned and not yet provisioned by the active application CDK stack.
- For a roadmap inventory, also see [docs/operations/inventory/aws-services-inventory.md](c:\arbab-github\learnfyra\docs\operations\inventory\aws-services-inventory.md).