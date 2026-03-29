# AWS Architecture

## Deployed AWS Services

### API Gateway
- Type: REST API
- Stage: `{env}` (dev / staging / prod)
- All routes except `/api/health` and `/api/auth/token` protected by Lambda Authorizer
- Throttle: 1000 req/s burst, 500 req/s steady (configurable per environment)
- Request validation on POST endpoints (JSON schema validation at Gateway level)

### Lambda Functions

| Function Name | Runtime | Arch | Memory | Timeout | Environment |
|---|---|---|---|---|---|
| learnfyra-generate-{env} | Node.js 18.x | ARM_64 | 1024MB | 60s | all |
| learnfyra-download-{env} | Node.js 18.x | ARM_64 | 256MB | 30s | all |
| learnfyra-list-{env} | Node.js 18.x | ARM_64 | 128MB | 10s | all |
| learnfyra-solve-{env} | Node.js 18.x | ARM_64 | 128MB | 10s | all |
| learnfyra-submit-{env} | Node.js 18.x | ARM_64 | 256MB | 15s | all |
| learnfyra-auth-{env} | Node.js 18.x | ARM_64 | 256MB | 15s | all |
| learnfyra-authorizer-{env} | Node.js 18.x | ARM_64 | 128MB | 5s | all |
| learnfyra-progress-{env} | Node.js 18.x | ARM_64 | 256MB | 15s | all |
| learnfyra-classes-{env} | Node.js 18.x | ARM_64 | 128MB | 10s | all |
| learnfyra-dashboard-{env} | Node.js 18.x | ARM_64 | 256MB | 15s | all |
| learnfyra-admin-{env} | Node.js 18.x | ARM_64 | 512MB | 30s | all |
| learnfyra-health-{env} | Node.js 18.x | ARM_64 | 128MB | 5s | all |

X-Ray tracing: enabled on staging + prod. Disabled on dev to reduce cost.

### S3 Buckets

| Bucket Name | Purpose | Access | Lifecycle |
|---|---|---|---|
| learnfyra-{env}-s3-worksheets | PDF/DOCX/HTML/JSON files | Private, presigned URLs | 7-day auto-delete on `worksheets/` prefix |
| learnfyra-{env}-s3-frontend | Static HTML/CSS/JS | Public read via CloudFront | No expiry |
| learnfyra-{env}-s3-logs | CloudFront + S3 access logs | Private | 90-day auto-delete |

Prod buckets: `RemovalPolicy.RETAIN`, `versioned=true`.
Dev/staging buckets: `RemovalPolicy.DESTROY`, `autoDeleteObjects=true`.

### DynamoDB Tables

| Table Name | Billing | Purpose |
|---|---|---|
| LearnfyraQuestionBank-{env} | PAY_PER_REQUEST | Question storage with dedupe |
| LearnfyraUsers-{env} | PAY_PER_REQUEST | User accounts, roles |
| LearnfyraWorksheetAttempt-{env} | PAY_PER_REQUEST | Solve attempts and scores |
| LearnfyraGenerationLog-{env} | PAY_PER_REQUEST | AI generation audit |
| LearnfyraConfig-{env} | PAY_PER_REQUEST | Platform config, model routing |

Prod tables: `RemovalPolicy.RETAIN`, point-in-time recovery enabled.

### CloudFront

- Distribution per environment
- Origins: S3 frontend (default) + API Gateway (path `/api/*`)
- HTTPS only (redirect HTTP to HTTPS)
- Price class: PriceClass_100 (US/EU/Canada) for dev; PriceClass_All for prod
- Custom domains with ACM certificates (us-east-1 region required for CloudFront)

### Cognito

- User Pool per environment: `learnfyra-{env}-user-pool`
- Hosted UI enabled for Google OAuth
- Google OAuth client IDs: separate per environment (dev/staging/prod)
- App client: public client, PKCE flow, no client secret
- Token validity: access=1h, refresh=30d, id=1h
- User attributes: email (required), name, custom:role

### Secrets Manager

| Secret Name | Contents |
|---|---|
| learnfyra/{env}/anthropic-api-key | ANTHROPIC_API_KEY |
| learnfyra/{env}/auth-config | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, LOCAL_JWT_SECRET |
| learnfyra/{env}/app-config | ALLOWED_ORIGIN, WORKSHEET_BUCKET_NAME |

Secrets rotation: manual for API keys, automated 90-day rotation for JWT secret.

### CloudWatch

#### CloudWatch Alarms (DOP-08)

Configured per Lambda function on staging and prod:

**Anomaly Detection Alarms:**
- `learnfyra-{fn}-errors-anomaly` — triggers when error count exceeds ±2σ band
- `learnfyra-{fn}-duration-anomaly` — triggers when p99 duration exceeds ±2σ band
- Evaluation: 5 consecutive 1-minute periods

**Concurrent Execution Alarms:**
- `learnfyra-generate-concurrent` — alarm when concurrency > 80% of account limit
- `learnfyra-submit-concurrent` — alarm when concurrency > 80% of account limit

**API Gateway Alarms:**
- `learnfyra-api-4xx` — alarm when 4xx rate > 5% of requests
- `learnfyra-api-5xx` — alarm when 5xx rate > 1% of requests
- `learnfyra-api-throttle` — alarm when throttle count > 10/minute
- `learnfyra-api-surge` — alarm when request rate increases > 300% in 5 minutes

All alarms notify SNS topic: `learnfyra-{env}-ops-alerts`.

#### CloudWatch Dashboard Widgets (DOP-08, 14 widgets)

1. Lambda invocations — all functions
2. Lambda errors — all functions
3. Lambda duration p50/p95/p99 — generate, submit
4. Lambda concurrent executions — all functions
5. API Gateway 4xx/5xx rates
6. API Gateway throttle count
7. API Gateway request count
8. S3 GetObject requests — worksheets bucket
9. S3 PutObject requests — worksheets bucket
10. DynamoDB consumed read capacity — QuestionBank
11. DynamoDB consumed write capacity — QuestionBank
12. DynamoDB consumed read capacity — WorksheetAttempt
13. Cost anomaly detection — estimated charges
14. CloudFront requests vs cache hit rate

#### CloudWatch Logs Insights Query Pack (DOP-07)

**Query 1: Generation Errors**
```
fields @timestamp, worksheetId, grade, subject, errorType, errorMessage
| filter level = 'ERROR' and handler = 'generate'
| sort @timestamp desc
| limit 50
```

**Query 2: Slow Generations (> 30s)**
```
fields @timestamp, worksheetId, durationMs, grade, subject, topic
| filter handler = 'generate' and durationMs > 30000
| sort durationMs desc
| limit 20
```

**Query 3: Submit Score Distribution**
```
fields @timestamp, worksheetId, percentage
| filter handler = 'submit'
| stats count() as attempts, avg(percentage) as avgScore, min(percentage) as minScore, max(percentage) as maxScore by bin(1h)
```

**Query 4: Auth Failures**
```
fields @timestamp, userId, errorType, ipAddress
| filter handler = 'auth' and level = 'ERROR'
| stats count() as failures by userId, errorType
| sort failures desc
| limit 20
```

## Resource Naming Patterns

All AWS resources follow these naming patterns (lowercase, hyphens only):

| Resource Type | Pattern |
|---|---|
| Lambda function | `learnfyra-{function}-{env}` |
| S3 bucket | `learnfyra-{env}-s3-{purpose}` |
| DynamoDB table | `Learnfyra{Table}-{env}` (PascalCase table name) |
| Cognito User Pool | `learnfyra-{env}-user-pool` |
| API Gateway | `learnfyra-{env}-api` |
| CloudFront distribution | `learnfyra-{env}-cdn` |
| SNS topic | `learnfyra-{env}-{purpose}` |
| CloudWatch alarm | `learnfyra-{env}-{fn}-{metric}` |
| Secrets Manager | `learnfyra/{env}/{secret-name}` |

## IAM Permissions Matrix

| Lambda Function | S3 Permissions | DynamoDB Permissions | Secrets |
|---|---|---|---|
| learnfyra-generate | PutObject (worksheets) | PutItem (GenerationLog) | anthropic-api-key, app-config |
| learnfyra-download | GetObject (worksheets) | GetItem (GenerationLog) | app-config |
| learnfyra-solve | GetObject (worksheets) | — | — |
| learnfyra-submit | GetObject (worksheets) | PutItem (WorksheetAttempt) | — |
| learnfyra-auth | — | GetItem/PutItem (Users) | auth-config |
| learnfyra-authorizer | — | GetItem (Users) | auth-config |
| learnfyra-progress | — | Query (WorksheetAttempt) | — |
| learnfyra-admin | — | Full CRUD (all tables) | all |

## CDK Stack Organization

```
infra/
  bin/learnfyra.ts          — CDK app entry, instantiates LearnfyraStack per env
  lib/learnfyra-stack.ts    — main stack, composes constructs
  lib/constructs/
    storage.ts              — S3 buckets (worksheet, frontend, logs)
    database.ts             — DynamoDB tables
    compute.ts              — Lambda functions, API Gateway, Lambda Authorizer
    cdn.ts                  — CloudFront, custom domain, ACM cert
    secrets.ts              — Secrets Manager secrets
    monitoring.ts           — CloudWatch alarms, dashboard, SNS
    auth.ts                 — Cognito User Pool, Hosted UI
  test/
    learnfyra.test.ts       — CDK assertion tests
```

CDK context keys:
```json
{
  "env": "dev",
  "domainName": "learnfyra.com",
  "certificateArn": "arn:aws:acm:us-east-1:...",
  "hostedZoneId": "Z..."
}
```

CDK deploy commands:
```bash
cd infra
npx cdk synth --context env=dev          # validate, zero warnings required
npx cdk diff --context env=dev           # preview changes
npx cdk deploy --context env=dev         # deploy to dev
npx cdk deploy --context env=prod        # deploy to prod (manual approval required)
```
