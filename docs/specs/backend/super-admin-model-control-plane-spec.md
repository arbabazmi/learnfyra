# Learnfyra Super Admin: Model Control Plane Specification
# File: docs/specs/super-admin-model-control-plane-spec.md
# Version: 1.0
# Date: 2026-03-24
# Status: Design specification — operations and deployment only, no code

---

## Module Name

Super Admin Model Control Plane — Multi-Provider AI Model Management and Operations

---

## Implementation Readiness References

1. Local and AWS parity strategy: [docs/technical/platform/LOCAL_DEV_STRATEGY.md](docs/technical/platform/LOCAL_DEV_STRATEGY.md)
2. Implementation checklist: [docs/IMPLEMENTATION_READINESS_CHECKLIST.md](docs/IMPLEMENTATION_READINESS_CHECKLIST.md)
3. Operations runbook: [docs/operations/runbooks/admin-control-plane-operations-spec.md](docs/operations/runbooks/admin-control-plane-operations-spec.md)

---

## Problem Statement

Learnfyra currently uses only Anthropic Claude API for worksheet generation. As the platform scales, operational requirements emerge:

1. **Multi-provider support**: Need ability to failover to OpenAI, Google AI, or other providers
2. **Cost optimization**: Different models have different pricing — need ability to shift load based on cost/performance
3. **Model experimentation**: Product team needs safe way to test new models without breaking production
4. **Operational safety**: Model configuration changes are high-risk and need approval gates
5. **Observability**: No visibility into model performance, latency, error rates, or costs
6. **Emergency response**: When a model fails or degrades, need instant rollback without redeploying code

This module creates a **control plane** that separates model configuration from application code, enabling:
- Hot-swap between AI providers without code changes
- Gradual rollout of model changes with instant rollback
- Real-time monitoring of model health and economics
- Change approval workflow for production model updates
- Environment isolation with different model configs per env

---

## Non-Negotiable Rules

1. **Secrets never in code**: All API keys stored in AWS Secrets Manager, rotated quarterly
2. **Environment isolation**: Dev/staging/prod have separate secrets, separate model configs, zero cross-environment access
3. **Approval gate for prod**: All production model configuration changes require stakeholder approval before deployment
4. **Instant rollback**: Rollback must execute in < 30 seconds without code deployment
5. **Cost alerting**: Alert when hourly model costs exceed threshold (dev: $5/hr, staging: $10/hr, prod: $50/hr)
6. **Zero downtime**: Model configuration changes must not cause service interruption
7. **Audit trail**: Every config change logged with who/what/when/why
8. **Fail secure**: If secrets rotation fails, system must reject requests (not fall back to cached keys)
9. **Provider redundancy**: System must support at least 2 AI providers simultaneously for failover
10. **Model versioning**: Model configurations versioned in Git, deployed via IaC only

---

## User Roles

### Super Admin
**Who**: CTO, Lead DevOps Engineer, Platform Owner  
**Access**: Full read/write to all environments, approve production changes  
**Restrictions**: Cannot bypass change approval workflow, all changes audited

### Operations Engineer
**Who**: On-call engineers, DevOps team members  
**Access**: Read all environments, write dev/staging, emergency rollback in prod  
**Restrictions**: Cannot approve own changes, cannot modify secrets directly

### Product Manager
**Who**: Product leadership reviewing model performance  
**Access**: Read-only dashboards (cost, latency, error rates, usage)  
**Restrictions**: No infrastructure access, no secret access

### Finance Reviewer
**Who**: Finance team monitoring AI spend  
**Access**: Read-only cost dashboards and alerts  
**Restrictions**: No model configuration access, no secret access

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Control Plane (reads config + secrets at request time)                  │
│                                                                          │
│  Lambda Function (generateHandler)                                      │
│    ↓                                                                     │
│  src/ai/client.js (model router)                                        │
│    ↓                                                                     │
│  Reads: AWS Systems Manager Parameter Store                             │
│    /learnfyra/{env}/model-config                                        │
│      {                                                                   │
│        "version": "v3",                                                  │
│        "activeProvider": "anthropic",                                    │
│        "providers": {                                                    │
│          "anthropic": {                                                  │
│            "enabled": true,                                              │
│            "model": "claude-sonnet-4-20250514",                          │
│            "secretArn": "arn:aws:secretsmanager:...:anthropic-key",     │
│            "maxTokens": 8000,                                            │
│            "temperature": 0.7,                                           │
│            "timeout": 60000,                                             │
│            "weight": 100                                                 │
│          },                                                              │
│          "openai": {                                                     │
│            "enabled": false,                                             │
│            "model": "gpt-4o",                                            │
│            "secretArn": "arn:aws:secretsmanager:...:openai-key",        │
│            "maxTokens": 8000,                                            │
│            "temperature": 0.7,                                           │
│            "timeout": 60000,                                             │
│            "weight": 0                                                   │
│          }                                                               │
│        },                                                                │
│        "fallback": {                                                     │
│          "enabled": true,                                                │
│          "provider": "openai",                                           │
│          "retryCount": 2                                                 │
│        },                                                                │
│        "canary": {                                                       │
│          "enabled": false,                                               │
│          "provider": null,                                               │
│          "trafficPercent": 0                                             │
│        }                                                                 │
│      }                                                                   │
│    ↓                                                                     │
│  Reads: AWS Secrets Manager (fetches API key for active provider)       │
│    arn:aws:secretsmanager:{region}:{account}:secret:learnfyra/{env}/... │
│    {                                                                     │
│      "providerName": "anthropic",                                        │
│      "apiKey": "sk-ant-...",                                             │
│      "createdAt": "2026-03-24T10:00:00Z",                                │
│      "rotatedAt": "2026-03-24T10:00:00Z",                                │
│      "expiresAt": "2026-06-24T10:00:00Z"                                 │
│    }                                                                     │
│    ↓                                                                     │
│  Calls AI Provider API (Anthropic, OpenAI, Google, etc.)                │
│    ↓                                                                     │
│  Emits CloudWatch Metrics + Logs                                        │
│    - ModelInvocationCount (by provider, model, env)                     │
│    - ModelLatencyMillis (p50, p95, p99)                                 │
│    - ModelErrorCount (by error type)                                    │
│    - ModelTokensUsed (prompt + completion)                              │
│    - ModelCostEstimate (calculated from token usage + pricing table)    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Monitoring and Alerting (CloudWatch + SNS)                              │
│                                                                          │
│  CloudWatch Alarms:                                                      │
│    - ModelErrorRate > 5% over 5 minutes → page on-call                   │
│    - ModelLatencyP99 > 30s over 5 minutes → page on-call                 │
│    - ModelCostHourly > threshold → alert finance + ops                   │
│    - SecretRotationFailed → page security team                           │
│                                                                          │
│  CloudWatch Dashboard:                                                   │
│    - Request volume by provider/model (last 24h)                         │
│    - Latency percentiles (p50/p95/p99)                                   │
│    - Error rate breakdown (by error type)                                │
│    - Estimated cost trend (hourly/daily/monthly)                         │
│    - Token usage (prompt vs completion)                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Change Management (GitHub + AWS CDK + Manual Approval)                  │
│                                                                          │
│  1. Engineer creates PR with model config change in infra/config/       │
│     model-config-{env}.json                                              │
│  2. CI runs config validation tests (schema, provider availability)     │
│  3. PR review by peer engineer (non-prod) or Super Admin (prod)         │
│  4. Merge to branch triggers deployment:                                 │
│     - develop → auto-deploy to dev                                       │
│     - staging → auto-deploy to staging + run smoke tests                 │
│     - main → manual approval gate → deploy to prod                       │
│  5. CDK updates SSM Parameter with new config (versioned)               │
│  6. Lambda picks up new config on next request (no restart needed)      │
│  7. CloudWatch alarms monitor for regressions                            │
│  8. If alarm fires → instant rollback via Parameter Store version revert│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Secrets Strategy: Multi-Provider API Keys

### Secret Structure in AWS Secrets Manager

Each AI provider has a separate secret per environment:

```
Secret Name: learnfyra/{env}/anthropic-api-key
Secret ARN:  arn:aws:secretsmanager:us-east-1:{account}:secret:learnfyra/{env}/anthropic-api-key-xxxxxx
Secret Value (JSON):
{
  "providerName": "anthropic",
  "apiKey": "sk-ant-api03-...",
  "createdAt": "2026-03-24T10:00:00Z",
  "rotatedAt": "2026-03-24T10:00:00Z",
  "expiresAt": "2026-06-24T10:00:00Z",
  "rotationSchedule": "90 days",
  "createdBy": "super-admin@learnfyra.com",
  "rotatedBy": "auto-rotation-lambda"
}

Secret Name: learnfyra/{env}/openai-api-key
Secret Value (JSON):
{
  "providerName": "openai",
  "apiKey": "sk-proj-...",
  "createdAt": "2026-03-24T10:00:00Z",
  "rotatedAt": "2026-03-24T10:00:00Z",
  "expiresAt": "2026-06-24T10:00:00Z",
  "rotationSchedule": "90 days",
  "createdBy": "super-admin@learnfyra.com",
  "rotatedBy": "manual"
}

Secret Name: learnfyra/{env}/google-ai-api-key
Secret Value (JSON):
{
  "providerName": "google",
  "apiKey": "AIza...",
  "createdAt": "2026-03-24T10:00:00Z",
  "rotatedAt": "2026-03-24T10:00:00Z",
  "expiresAt": "2026-06-24T10:00:00Z",
  "rotationSchedule": "90 days",
  "createdBy": "super-admin@learnfyra.com",
  "rotatedBy": "manual"
}
```

**Naming convention**: `learnfyra/{env}/{provider}-api-key`  
**Supported providers**: anthropic, openai, google, cohere, mistral (extensible)

### Secret Access Policy (IAM)

Lambda functions read secrets via IAM role with least-privilege policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadModelSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:{account}:secret:learnfyra/{env}/*-api-key-*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    }
  ]
}
```

**No write permissions**: Lambda cannot modify secrets — only read.  
**No cross-env access**: Dev Lambda cannot read staging/prod secrets.

### Secret Rotation Policy

| Environment | Rotation Frequency | Method | Approval |
|-------------|-------------------|--------|----------|
| dev         | 90 days           | Auto (Lambda) or Manual | Any Super Admin |
| staging     | 90 days           | Manual only | Any Super Admin |
| prod        | 90 days           | Manual only | 2 Super Admins required |

**Rotation procedure**:
1. Super Admin generates new API key from provider console
2. Super Admin updates secret in AWS Secrets Manager (new version created)
3. Test new key in dev environment first
4. Update staging after 24h observation in dev
5. Update prod after 48h observation in staging
6. Old key remains valid for 7 days (grace period)
7. After 7 days, revoke old key from provider

**Automated rotation** (dev only):
- AWS Lambda function `learnfyra-secret-rotator-dev` runs on schedule
- Calls provider API to generate new key (if provider supports programmatic rotation)
- Updates Secrets Manager with new key
- Sends SNS notification to ops team
- If rotation fails → CloudWatch alarm → page on-call

**Emergency rotation** (security incident):
1. Revoke compromised key from provider immediately
2. Generate new key
3. Update all environments simultaneously
4. Deploy config update to all environments
5. Verify with smoke tests
6. Post-mortem within 24 hours

### Secret Caching Strategy

**Problem**: Fetching secrets from Secrets Manager adds latency (~50ms per call) and cost ($0.05 per 10,000 API calls).

**Solution**: Cache secrets in Lambda memory with TTL:

```javascript
// Pseudocode — implementation placeholder
let secretCache = new Map();
const SECRET_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSecret(secretArn) {
  const cached = secretCache.get(secretArn);
  if (cached && Date.now() - cached.fetchedAt < SECRET_TTL_MS) {
    return cached.value;
  }
  const secret = await secretsManager.getSecretValue({ SecretId: secretArn });
  secretCache.set(secretArn, { value: secret, fetchedAt: Date.now() });
  return secret;
}
```

**Cache TTL**: 5 minutes (balance freshness vs cost)  
**Cache invalidation**: Lambda restart or TTL expiry  
**Security**: Cache only in Lambda memory, never in CloudFront or client

### Fail-Secure Behavior

If secret fetch fails (network error, permissions error, secret deleted):
1. **Do not fall back to cached key** — security risk
2. Return 503 Service Unavailable to client
3. Emit CloudWatch metric `SecretFetchError`
4. CloudWatch alarm fires → page on-call
5. Client receives error: "AI service temporarily unavailable"
6. Retry after 30 seconds

**Never** return worksheet with partial data or fall back to default key.

---

## Environment Separation

Each environment is completely isolated — no shared resources, no cross-environment access.

### Environment Configuration Matrix

| Resource | Dev | Staging | Prod |
|----------|-----|---------|------|
| AWS Account | 123456789012 | 123456789012 | 123456789012 |
| Region | us-east-1 | us-east-1 | us-east-1 |
| VPC | learnfyra-dev-vpc | learnfyra-staging-vpc | learnfyra-prod-vpc |
| Secrets Path | `/learnfyra/dev/*` | `/learnfyra/staging/*` | `/learnfyra/prod/*` |
| Config Path | `/learnfyra/dev/model-config` | `/learnfyra/staging/model-config` | `/learnfyra/prod/model-config` |
| Lambda Role | learnfyra-lambda-dev | learnfyra-lambda-staging | learnfyra-lambda-prod |
| CloudWatch Log Group | `/aws/lambda/learnfyra-dev-*` | `/aws/lambda/learnfyra-staging-*` | `/aws/lambda/learnfyra-prod-*` |
| S3 Buckets | `learnfyra-dev-*` | `learnfyra-staging-*` | `learnfyra-prod-*` |
| API Gateway | `api-dev.learnfyra.com` | `api-staging.learnfyra.com` | `api.learnfyra.com` |
| CloudFront | `dev.learnfyra.com` | `staging.learnfyra.com` | `learnfyra.com` |
| Model Provider | Anthropic only | Anthropic + OpenAI | Anthropic (primary) + OpenAI (fallback) |
| Cost Threshold Alert | $5/hour | $10/hour | $50/hour |
| Error Rate Alarm | 10% | 5% | 5% |
| Latency P99 Alarm | 60s | 45s | 30s |

### IAM Boundary Policies

Each Lambda role has a permissions boundary preventing cross-environment access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAccessToOtherEnvironments",
      "Effect": "Deny",
      "Action": "*",
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:learnfyra/staging/*",
        "arn:aws:secretsmanager:*:*:secret:learnfyra/prod/*",
        "arn:aws:ssm:*:*:parameter/learnfyra/staging/*",
        "arn:aws:ssm:*:*:parameter/learnfyra/prod/*",
        "arn:aws:s3:::learnfyra-staging-*",
        "arn:aws:s3:::learnfyra-prod-*"
      ]
    }
  ]
}
```

This policy is attached as a **boundary** — even if Lambda role grants access, boundary denies it.

### Model Configuration Per Environment

**Dev**: Experiments and breaking changes allowed
```json
{
  "version": "v5",
  "activeProvider": "anthropic",
  "providers": {
    "anthropic": {
      "enabled": true,
      "model": "claude-sonnet-4-20250514",
      "secretArn": "arn:aws:secretsmanager:us-east-1:xxxx:secret:learnfyra/dev/anthropic-api-key-xxx",
      "maxTokens": 8000,
      "temperature": 0.8,
      "timeout": 90000,
      "weight": 80
    },
    "openai": {
      "enabled": true,
      "model": "gpt-4o-mini",
      "secretArn": "arn:aws:secretsmanager:us-east-1:xxxx:secret:learnfyra/dev/openai-api-key-xxx",
      "maxTokens": 8000,
      "temperature": 0.8,
      "timeout": 90000,
      "weight": 20
    }
  },
  "fallback": {
    "enabled": true,
    "provider": "openai",
    "retryCount": 2
  },
  "canary": {
    "enabled": true,
    "provider": "openai",
    "trafficPercent": 20
  }
}
```

**Staging**: Production-like, stable configs only
```json
{
  "version": "v3",
  "activeProvider": "anthropic",
  "providers": {
    "anthropic": {
      "enabled": true,
      "model": "claude-sonnet-4-20250514",
      "secretArn": "arn:aws:secretsmanager:us-east-1:xxxx:secret:learnfyra/staging/anthropic-api-key-xxx",
      "maxTokens": 8000,
      "temperature": 0.7,
      "timeout": 60000,
      "weight": 100
    },
    "openai": {
      "enabled": true,
      "model": "gpt-4o",
      "secretArn": "arn:aws:secretsmanager:us-east-1:xxxx:secret:learnfyra/staging/openai-api-key-xxx",
      "maxTokens": 8000,
      "temperature": 0.7,
      "timeout": 60000,
      "weight": 0
    }
  },
  "fallback": {
    "enabled": true,
    "provider": "openai",
    "retryCount": 2
  },
  "canary": {
    "enabled": false,
    "provider": null,
    "trafficPercent": 0
  }
}
```

**Prod**: Minimal changes, highest stability
```json
{
  "version": "v2",
  "activeProvider": "anthropic",
  "providers": {
    "anthropic": {
      "enabled": true,
      "model": "claude-sonnet-4-20250514",
      "secretArn": "arn:aws:secretsmanager:us-east-1:xxxx:secret:learnfyra/prod/anthropic-api-key-xxx",
      "maxTokens": 8000,
      "temperature": 0.7,
      "timeout": 60000,
      "weight": 100
    },
    "openai": {
      "enabled": false,
      "model": "gpt-4o",
      "secretArn": "arn:aws:secretsmanager:us-east-1:xxxx:secret:learnfyra/prod/openai-api-key-xxx",
      "maxTokens": 8000,
      "temperature": 0.7,
      "timeout": 60000,
      "weight": 0
    }
  },
  "fallback": {
    "enabled": false,
    "provider": null,
    "retryCount": 0
  },
  "canary": {
    "enabled": false,
    "provider": null,
    "trafficPercent": 0
  }
}
```

**Note**: Prod starts with single provider (Anthropic), fallback disabled. Fallback enabled only after testing in staging for 7+ days.

---

## Change Approval Workflow

All model configuration changes follow this workflow. Changes to code that do NOT touch model config follow standard CI/CD without additional approval.

### Change Types and Approval Requirements

| Change Type | Dev | Staging | Prod | Approval Required |
|-------------|-----|---------|------|------------------|
| Model parameter tweak (temperature, maxTokens) | Auto | Auto after dev 24h | Manual approval | 1 Super Admin |
| Switch active provider (Anthropic → OpenAI) | Auto | Manual approval | Manual approval | 2 Super Admins + Product Manager |
| Enable/disable fallback | Auto | Manual approval | Manual approval | 2 Super Admins |
| Add new provider | Auto | Auto after dev 48h | Manual approval | 2 Super Admins + Security review |
| Rotate API key | Auto | Manual | Manual | 1 Super Admin + notification to all |
| Emergency rollback | N/A | Operations Engineer can execute | Operations Engineer can execute | Post-rollback review within 4h |

### GitHub PR Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│ Step 1: Engineer Creates PR                                          │
│                                                                       │
│  Changes: infra/config/model-config-{env}.json                       │
│  PR Title: "[Model Config] Switch dev to GPT-4o for cost comparison" │
│  PR Body: MUST include:                                              │
│    - Change justification                                            │
│    - Expected impact (cost, latency, quality)                        │
│    - Rollback plan                                                   │
│    - Testing plan                                                    │
└──────────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Step 2: CI Validation (GitHub Actions)                               │
│                                                                       │
│  Jobs:                                                                │
│    ✓ JSON schema validation (model-config matches schema)            │
│    ✓ Provider availability check (API endpoint reachable)            │
│    ✓ Secret ARN validation (secret exists in target env)             │
│    ✓ Config version increment check (version bumped)                 │
│    ✓ CDK synth (no CloudFormation errors)                            │
│                                                                       │
│  If any job fails → PR blocked, cannot merge                         │
└──────────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Step 3: Peer Review                                                  │
│                                                                       │
│  Dev/Staging: 1 engineer approval required                           │
│  Prod:        2 Super Admin approvals required + security review     │
│                                                                       │
│  Reviewers check:                                                    │
│    □ Justification is clear and valid                                │
│    □ Expected impact is documented                                   │
│    □ Rollback plan is feasible                                       │
│    □ Testing plan is comprehensive                                   │
│    □ Config diff is correct (no typos, no unintended changes)        │
└──────────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Step 4: Merge and Deploy                                             │
│                                                                       │
│  Branch → Environment:                                               │
│    - develop → dev (auto-deploy)                                     │
│    - staging → staging (auto-deploy after dev soak time)             │
│    - main → prod (manual approval gate in GitHub Actions)            │
│                                                                       │
│  Deployment steps:                                                   │
│    1. GitHub Actions runs CDK deploy                                 │
│    2. CDK updates SSM Parameter with new config (creates new version)│
│    3. Lambda picks up new config on next invocation                  │
│    4. CloudWatch monitors for error rate / latency spike             │
│    5. If spike detected → alarm fires → automated rollback triggered │
└──────────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Step 5: Post-Deployment Monitoring                                   │
│                                                                       │
│  First 15 minutes:                                                   │
│    - Operations Engineer watches dashboard live                      │
│    - Automated alarms check error rate, latency, cost                │
│    - If alarm fires → instant rollback                               │
│                                                                       │
│  First 24 hours:                                                     │
│    - CloudWatch dashboard reviewed every 4 hours                     │
│    - Cost trend compared to baseline                                 │
│    - Quality spot-checks (manual review of generated worksheets)     │
│                                                                       │
│  After 24 hours:                                                     │
│    - Change marked as "stable"                                       │
│    - Can proceed to next environment                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Production Approval Gate (GitHub Actions)

Production deploys require manual approval in GitHub Actions.

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy to Production
on:
  push:
    branches: [main]
    paths:
      - 'infra/config/model-config-prod.json'
jobs:
  await-approval:
    runs-on: ubuntu-latest
    environment: production-model-change  # GitHub environment with required reviewers
    steps:
      - name: Request Approval
        run: |
          echo "Production model configuration change requires 2 Super Admin approvals"
          echo "Reviewers: Check PR description for justification and rollback plan"
  
  deploy:
    needs: await-approval
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate Config
        run: npm run validate:model-config -- --env=prod
      - name: Deploy
        run: cd infra/cdk && npx cdk deploy --context env=prod --require-approval never
      - name: Notify Ops Team
        run: |
          # Send Slack/email notification that prod model config changed
```

**GitHub environment protection rules** for `production-model-change`:
- Required reviewers: 2 members of "Super Admins" team
- Deployment branches: `main` only
- No self-approval: PR author cannot be one of the approvers

### Emergency Rollback Procedure

If production experiences issues after model config change (error rate spike, latency spike, quality degradation):

**Instant Rollback (< 30 seconds)**:

```bash
# Operations Engineer executes from laptop (with AWS CLI configured)
aws ssm put-parameter \
  --name /learnfyra/prod/model-config \
  --value file://rollback-config.json \
  --type String \
  --overwrite

# OR revert to previous version
aws ssm get-parameter-history \
  --name /learnfyra/prod/model-config \
  --max-results 5

# Find last known good version, copy value
aws ssm put-parameter \
  --name /learnfyra/prod/model-config \
  --value '{...last known good config...}' \
  --type String \
  --overwrite
```

Lambda picks up reverted config within 5 minutes (cache TTL). To force immediate pickup: trigger CloudWatch Event to restart Lambda (cold start fetches new config).

**Automated Rollback**:

CloudWatch Alarm action can trigger Lambda function `learnfyra-auto-rollback-prod` that:
1. Fetches previous parameter version
2. Overwrites current parameter with previous version
3. Sends SNS notification to ops team: "Auto-rollback executed, reason: [alarm name]"
4. Creates incident ticket in PagerDuty

**Post-Rollback**:
- Within 4 hours: Incident review meeting with Super Admins
- Within 24 hours: Post-mortem document published
- Before next prod deploy: Reproduce issue in staging, validate fix

---

## Monitoring and Alerting

### CloudWatch Metrics

Custom metrics emitted by `src/ai/client.js` on every model invocation:

| Metric Name | Dimensions | Unit | Description |
|-------------|-----------|------|-------------|
| `ModelInvocationCount` | Provider, Model, Env | Count | Total requests to AI provider |
| `ModelSuccessCount` | Provider, Model, Env | Count | Successful responses (status 200) |
| `ModelErrorCount` | Provider, Model, Env, ErrorType | Count | Failed requests by error type |
| `ModelLatencyMillis` | Provider, Model, Env | Milliseconds | End-to-end latency (request → response) |
| `ModelTokensPrompt` | Provider, Model, Env | Count | Tokens in prompt (input) |
| `ModelTokensCompletion` | Provider, Model, Env | Count | Tokens in completion (output) |
| `ModelTokensTotal` | Provider, Model, Env | Count | Prompt + completion tokens |
| `ModelCostEstimate` | Provider, Model, Env | USD | Estimated cost based on tokens × pricing |
| `ModelTimeoutCount` | Provider, Model, Env | Count | Requests exceeding timeout threshold |
| `ModelFallbackCount` | Provider, Model, Env | Count | Requests that used fallback provider |
| `SecretFetchLatencyMillis` | Env | Milliseconds | Time to fetch secret from Secrets Manager |
| `SecretCacheHitRate` | Env | Percent | % of requests served from cache |

**Metric emission strategy**:
- Fire-and-forget to CloudWatch (async, no blocking)
- Batch metrics every 10 seconds to reduce API calls
- If metric emission fails → log error but do not fail request

### CloudWatch Alarms

#### High Priority (page on-call immediately)

| Alarm Name | Threshold | Evaluation Period | Action |
|-----------|-----------|-------------------|--------|
| `ModelErrorRate-Prod-High` | Error rate > 5% | 2 of last 3 datapoints (5 min each) | SNS → PagerDuty → page on-call |
| `ModelLatencyP99-Prod-High` | P99 > 30s | 2 of last 3 datapoints (5 min each) | SNS → PagerDuty → page on-call |
| `ModelTimeoutRate-Prod-High` | Timeout rate > 2% | 2 of last 3 datapoints (5 min each) | SNS → PagerDuty → page on-call |
| `SecretRotationFailed-Prod` | Any failure | 1 datapoint | SNS → Security Team + Ops |

#### Medium Priority (alert Slack, no page)

| Alarm Name | Threshold | Evaluation Period | Action |
|-----------|-----------|-------------------|--------|
| `ModelCostHourly-Prod-High` | > $50/hour | 1 datapoint (1 hour) | SNS → Slack #ops + Finance email |
| `ModelLatencyP95-Prod-Medium` | P95 > 20s | 3 of last 5 datapoints (5 min each) | SNS → Slack #ops |
| `ModelFallbackRate-Prod-High` | Fallback rate > 10% | 2 of last 3 datapoints (5 min each) | SNS → Slack #ops |
| `SecretCacheHitRate-Prod-Low` | < 80% | 3 datapoints (5 min each) | SNS → Slack #ops (investigate cache config) |

#### Low Priority (dashboard only, no alert)

| Metric | Monitor For | Review Frequency |
|--------|------------|------------------|
| `ModelInvocationCount` | Unexpected traffic spikes/drops | Daily |
| `ModelTokensTotal` | Token usage trends | Weekly |
| `ModelSuccessCount` | Baseline success rate | Daily |

### CloudWatch Dashboard

Dashboard URL: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Learnfyra-Model-Control-Plane`

**Dashboard layout** (6 widgets):

```
┌────────────────────────────────────────────────────────────────┐
│ Widget 1: Request Volume (last 24h)                            │
│   Line chart: ModelInvocationCount by Provider                 │
│   Shows: anthropic (blue), openai (orange), google (green)     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Widget 2: Error Rate (last 24h)                                │
│   Line chart: (ModelErrorCount / ModelInvocationCount) × 100   │
│   Red horizontal line at 5% (alarm threshold)                  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Widget 3: Latency Percentiles (last 24h)                       │
│   Line chart: p50 (green), p95 (yellow), p99 (red)             │
│   Red horizontal line at 30s (alarm threshold)                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Widget 4: Cost Estimate (last 7 days)                          │
│   Stacked area chart: Cost by Provider                         │
│   Annotation: Budget threshold line                            │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Widget 5: Token Usage (last 24h)                               │
│   Stacked area chart: Prompt tokens (blue), Completion (orange)│
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Widget 6: Fallback Rate (last 24h)                             │
│   Line chart: (ModelFallbackCount / ModelInvocationCount) × 100│
│   Shows fallback usage (should be near 0% in normal operation) │
└────────────────────────────────────────────────────────────────┘
```

**Dashboard access**:
- Super Admins: Full access (all environments)
- Operations Engineers: Read-only (all environments)
- Product Managers: Read-only (prod only)
- Finance Reviewers: Read-only cost widget only (prod only)

### Cost Threshold Alerting

Cost monitoring uses custom CloudWatch metric `ModelCostEstimate` calculated from token usage.

**Pricing table** (hard-coded in `src/ai/client.js`, updated quarterly):

```javascript
const MODEL_PRICING = {
  'claude-sonnet-4-20250514': {
    prompt: 0.003,      // $ per 1K tokens
    completion: 0.015   // $ per 1K tokens
  },
  'gpt-4o': {
    prompt: 0.005,
    completion: 0.015
  },
  'gpt-4o-mini': {
    prompt: 0.00015,
    completion: 0.0006
  }
};

function calculateCost(provider, model, promptTokens, completionTokens) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0; // Unknown model, skip cost tracking
  const promptCost = (promptTokens / 1000) * pricing.prompt;
  const completionCost = (completionTokens / 1000) * pricing.completion;
  return promptCost + completionCost;
}
```

**Hourly cost alarm**:
- CloudWatch aggregates `ModelCostEstimate` metric over 1-hour window
- If sum exceeds threshold → alarm fires
- Thresholds:
  - Dev: $5/hour (low traffic, mostly testing)
  - Staging: $10/hour (moderate traffic, pre-prod validation)
  - Prod: $50/hour (high traffic, real users)

**Cost spike investigation**:
1. Check CloudWatch Logs for anomalous request patterns (DDoS, bot traffic)
2. Check if question count or difficulty changed (longer prompts = higher cost)
3. Check if model changed (some models cost 10× more)
4. Check if fallback triggered repeatedly (2× cost if both primary + fallback called)

---

## Safe Rollout Procedures

### Canary Deployment

Canary deployment sends a small % of traffic to new provider/model while keeping majority on stable provider.

**Config example** (staging):
```json
{
  "version": "v4",
  "activeProvider": "anthropic",
  "providers": {
    "anthropic": {
      "enabled": true,
      "model": "claude-sonnet-4-20250514",
      "weight": 95
    },
    "openai": {
      "enabled": true,
      "model": "gpt-4o",
      "weight": 5
    }
  },
  "canary": {
    "enabled": true,
    "provider": "openai",
    "trafficPercent": 5
  }
}
```

**How canary works**:
1. Client generates random number 0-100
2. If random < `canary.trafficPercent` → route to canary provider
3. Else → route to active provider
4. Both providers emit same metrics, tagged with provider name
5. Compare metrics side-by-side in dashboard

**Canary rollout schedule**:
- Day 1-2: 5% traffic to canary
- Day 3-4: 20% traffic (if no quality/latency issues)
- Day 5-6: 50% traffic
- Day 7+: 100% traffic → canary becomes active provider

**Canary abort conditions**:
- Error rate on canary > 2× error rate on active
- Latency on canary > 1.5× latency on active
- Quality spot-check fails (manual review finds canary worksheets worse)

If abort condition met → set `canary.trafficPercent = 0` immediately, investigate root cause.

### Feature Flag (Provider Toggle)

Each provider has `enabled: true/false` flag. To safely enable new provider:

**Phase 1: Disabled but configured**
```json
"openai": {
  "enabled": false,
  "model": "gpt-4o",
  "secretArn": "...",
  "weight": 0
}
```
Code loads config, validates secret exists, but never calls provider. Use this to verify infrastructure is ready.

**Phase 2: Enabled for fallback only**
```json
"anthropic": {
  "enabled": true,
  "weight": 100
},
"openai": {
  "enabled": true,
  "weight": 0
},
"fallback": {
  "enabled": true,
  "provider": "openai"
}
```
OpenAI only called if Anthropic fails. Low risk, tests OpenAI integration.

**Phase 3: Canary traffic**
```json
"anthropic": {
  "enabled": true,
  "weight": 95
},
"openai": {
  "enabled": true,
  "weight": 5
}
```
5% of requests go to OpenAI. Monitor for 48 hours.

**Phase 4: Primary provider**
```json
"anthropic": {
  "enabled": true,
  "weight": 0
},
"openai": {
  "enabled": true,
  "weight": 100
}
```
OpenAI becomes primary. Anthropic kept as fallback.

### Blue/Green Deployment (Parameter Store Versions)

AWS SSM Parameter Store supports versioning. Use this for instant rollback.

**Current config** (version 5):
```json
{
  "version": "v5",
  "activeProvider": "anthropic"
}
```

**Deploy new config** (version 6):
```bash
aws ssm put-parameter \
  --name /learnfyra/prod/model-config \
  --value file://model-config-v6.json \
  --type String \
  --overwrite
```

Lambda calls `getParameter` (fetches latest version by default).

**Rollback to version 5**:
```bash
aws ssm get-parameter-history \
  --name /learnfyra/prod/model-config \
  --max-results 10

# Copy value from version 5
aws ssm put-parameter \
  --name /learnfyra/prod/model-config \
  --value '{...version 5 config...}' \
  --type String \
  --overwrite
```

**Lambda picks up rollback** within 5 minutes (secret cache TTL). To force immediate: trigger CloudWatch Event to restart all Lambda instances.

### Health Check Before Rollout

Before deploying new model config to staging/prod, run smoke test in dev:

```bash
# Smoke test script (runs in CI before deploy)
npm run smoke-test:model-config -- --env=dev

# Script does:
# 1. Generates 5 worksheets with new config
# 2. Checks all return 200 status
# 3. Checks latency < 30s for all
# 4. Checks worksheet quality (valid JSON, expected fields present)
# 5. If any check fails → exit 1 → block deployment
```

---

## Audit Trail and Logging

Every model configuration change and secret rotation logged for compliance.

### CloudWatch Logs

Log group: `/learnfyra/{env}/model-control-plane`

**Log events**:
```json
{
  "timestamp": "2026-03-24T15:30:00.000Z",
  "event": "ModelConfigChanged",
  "environment": "prod",
  "version": "v5 → v6",
  "changedBy": "super-admin@learnfyra.com",
  "changedVia": "GitHub PR #342",
  "changes": {
    "activeProvider": "anthropic → openai",
    "anthropic.weight": "100 → 0",
    "openai.weight": "0 → 100"
  },
  "approvers": ["super-admin@learnfyra.com", "cto@learnfyra.com"]
}

{
  "timestamp": "2026-03-24T15:35:12.456Z",
  "event": "ModelInvocation",
  "environment": "prod",
  "provider": "openai",
  "model": "gpt-4o",
  "latencyMs": 2340,
  "promptTokens": 1250,
  "completionTokens": 890,
  "cost": 0.0199,
  "status": "success"
}

{
  "timestamp": "2026-03-24T15:40:00.000Z",
  "event": "SecretRotated",
  "environment": "prod",
  "secretName": "learnfyra/prod/anthropic-api-key",
  "rotatedBy": "super-admin@learnfyra.com",
  "rotationMethod": "manual",
  "oldKeyExpiry": "2026-03-31T00:00:00Z",
  "newKeyExpiry": "2026-06-24T00:00:00Z"
}

{
  "timestamp": "2026-03-24T15:42:15.000Z",
  "event": "ModelErrorRateAlarmFired",
  "environment": "prod",
  "provider": "openai",
  "errorRate": 7.2,
  "threshold": 5.0,
  "action": "PagerDuty incident created",
  "incidentId": "P1234567"
}

{
  "timestamp": "2026-03-24T15:45:00.000Z",
  "event": "ModelConfigRolledBack",
  "environment": "prod",
  "version": "v6 → v5",
  "rolledBackBy": "ops-engineer@learnfyra.com",
  "reason": "Error rate alarm - openai returning 429 rate limit errors",
  "rollbackMethod": "automated",
  "rollbackLatencySeconds": 27
}
```

**Log retention**:
- Dev: 7 days
- Staging: 30 days
- Prod: 365 days (compliance requirement)

### CloudTrail Audit

AWS CloudTrail logs all API calls to AWS services (Secrets Manager, SSM, Lambda).

**Events tracked**:
- `GetSecretValue` — who fetched which secret
- `PutParameter` — who changed model config
- `InvokeFunction` — Lambda invocations
- `PutMetricData` — CloudWatch metric submissions

**CloudTrail retention**: 90 days in CloudWatch Logs, then archived to S3 (7 years retention for compliance).

### Change History in Git

All model configs versioned in Git: `infra/config/model-config-{env}.json`

Git commit message template:
```
[Model Config] <one-line summary>

Environment: dev | staging | prod
Change Type: provider switch | parameter tweak | new provider | emergency rollback
Justification: <why this change is needed>
Testing: <how this was tested in lower env>
Rollback Plan: <how to revert if issues found>
Approvers: @super-admin1 @super-admin2

Related PR: #342
Related Incident: INC-2026-03-24-001 (if emergency change)
```

GitHub PR review history serves as audit trail for who approved what changes.

---

## Operational Runbooks

### Runbook 1: Add New AI Provider

**When**: Product team wants to test new AI provider (e.g., Cohere, Mistral, Google Gemini)

**Steps**:
1. **Obtain API key** from provider
   - Create account with corporate email
   - Generate API key
   - Document pricing ($ per 1K tokens)
2. **Store secret in AWS Secrets Manager** (dev first)
   ```bash
   aws secretsmanager create-secret \
     --name learnfyra/dev/cohere-api-key \
     --secret-string '{"providerName":"cohere","apiKey":"...","createdAt":"...",...}' \
     --region us-east-1
   ```
3. **Update model config** in `infra/config/model-config-dev.json`
   ```json
   "providers": {
     "cohere": {
       "enabled": false,
       "model": "command-r-plus",
       "secretArn": "arn:aws:secretsmanager:...",
       "maxTokens": 8000,
       "temperature": 0.7,
       "timeout": 60000,
       "weight": 0
     }
   }
   ```
4. **Update Lambda IAM role** to grant read access to new secret
5. **Deploy to dev** via PR to `develop` branch
6. **Test in dev** — generate 20 worksheets, verify quality
7. **Enable for canary** — set `"enabled": true, "weight": 5`
8. **Monitor for 48 hours** — compare metrics with primary provider
9. **If metrics acceptable** → promote to staging
10. **Repeat testing in staging** for 7 days
11. **If no issues** → promote to prod with Super Admin approval

**Rollback**: Set `"enabled": false` in config, redeploy.

### Runbook 2: Rotate API Key

**When**: Quarterly rotation (90 days) or emergency (key compromised)

**Steps (Manual Rotation)**:
1. **Generate new key** from provider console
2. **Update secret in Secrets Manager**
   ```bash
   aws secretsmanager update-secret \
     --secret-id learnfyra/prod/anthropic-api-key \
     --secret-string '{"providerName":"anthropic","apiKey":"NEW_KEY","rotatedAt":"..."}' \
     --region us-east-1
   ```
3. **Wait 5 minutes** for Lambda cache to expire (or force cold start)
4. **Test** — generate 1 worksheet, verify success
5. **Wait 7 days** (grace period) — old key still valid for emergency rollback
6. **Revoke old key** from provider console after 7 days
7. **Document rotation** in compliance log

**Emergency Rotation** (key compromised):
1. **Revoke old key immediately** from provider console
2. **Generate and deploy new key** (steps above)
3. **Force Lambda cold start** (via CLI or restart CloudWatch Event)
4. **Test** immediately
5. **Post-mortem** — how was key compromised, how to prevent recurrence

### Runbook 3: Emergency Rollback (Production)

**When**: After model config change, error rate or latency spike detected

**Steps**:
1. **Identify issue** — CloudWatch alarm fires, on-call paged
2. **Verify issue is model-related** — check dashboard, compare before/after metrics
3. **Execute rollback** — from laptop with AWS CLI:
   ```bash
   aws ssm get-parameter-history \
     --name /learnfyra/prod/model-config \
     --max-results 5
   
   # Find last known good version (before the change)
   aws ssm put-parameter \
     --name /learnfyra/prod/model-config \
     --value '{...last known good config...}' \
     --type String \
     --overwrite
   ```
4. **Force Lambda cold start** (optional, for immediate effect):
   ```bash
   aws lambda update-function-configuration \
     --function-name learnfyra-generate-prod \
     --environment Variables={FORCE_RESTART=true}
   ```
5. **Verify rollback successful** — generate test worksheet, check metrics
6. **Notify stakeholders** — post in Slack #ops, create incident ticket
7. **Schedule post-mortem** — within 4 hours, required attendees: on-call engineer, Super Admin who approved change, Product Manager
8. **Document incident** — add to `/docs/incidents/YYYY-MM-DD-model-config-rollback.md`

**Rollback SLA**: < 30 seconds from decision to execute rollback

### Runbook 4: Cost Spike Investigation

**When**: CloudWatch alarm fires: "ModelCostHourly-Prod-High"

**Steps**:
1. **Check CloudWatch metrics** — which provider/model caused spike?
2. **Check request volume** — did traffic increase unexpectedly?
3. **Check average tokens per request** — did prompt/completion length increase?
4. **Check for DDoS or bot traffic** — CloudFront access logs, unusual IP patterns
5. **Check recent config changes** — did we switch to more expensive model?
6. **If legitimate traffic spike** — acceptable, just notify Finance team
7. **If bot traffic** — enable WAF rate limiting, block abusive IPs
8. **If model misconfiguration** — revert to cheaper model or reduce token limits
9. **Update cost threshold** if spike was legitimate and expected to continue

**Cost spike thresholds** (when to escalate):
- 2× baseline cost → investigate (could be normal growth)
- 5× baseline cost → escalate to CTO
- 10× baseline cost → emergency: disable expensive provider, force fallback to cheaper provider

### Runbook 5: Provider API Outage

**When**: Primary AI provider API is down (e.g., Anthropic returns 503 errors for > 5 minutes)

**Steps**:
1. **Verify outage** — check provider status page, test from dev environment
2. **Enable fallback provider** if not already enabled:
   ```json
   "fallback": {
     "enabled": true,
     "provider": "openai",
     "retryCount": 2
   }
   ```
3. **Deploy config update** (emergency deploy, skip approval for outage response)
4. **Monitor fallback performance** — ensure fallback provider is handling load
5. **Notify users** if degraded quality (fallback model may produce different output)
6. **Wait for primary provider to recover**
7. **Disable fallback** after primary provider stable for 1 hour
8. **Post-mortem** — calculate revenue impact, discuss multi-provider load balancing

**Provider outage SLA**:
- Detection: < 5 minutes (CloudWatch alarm)
- Fallback enabled: < 10 minutes
- Customer-facing impact: minimal (automatic failover)

---

## Success Metrics

How to measure success of the model control plane:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Deployment speed** | < 15 min from PR merge to production | GitHub Actions workflow duration |
| **Rollback speed** | < 30 seconds | Time from alarm to rollback completion |
| **Model uptime** | 99.9% | (1 - ModelErrorCount / ModelInvocationCount) × 100 |
| **Mean time to recovery (MTTR)** | < 1 hour | Time from incident start to resolution |
| **Cost predictability** | ±10% variance from forecast | Compare actual vs forecasted monthly model spend |
| **Secret rotation compliance** | 100% rotated within 90 days | Audit trail review |
| **Change approval compliance** | 100% prod changes have 2+ approvals | GitHub PR review audit |
| **Alarm accuracy** | < 5% false positive rate | Alarm fires that did not require action / total alarms |

**Quarterly review**: DevOps team presents dashboard to leadership showing these metrics.

---

## Dependencies and Prerequisites

Before implementing this control plane, ensure:

1. **AWS infrastructure**:
   - [ ] AWS Account with admin access
   - [ ] AWS Secrets Manager enabled in all regions
   - [ ] AWS Systems Manager Parameter Store enabled
   - [ ] CloudWatch Logs retention policies configured
   - [ ] SNS topics for alarms created
   - [ ] PagerDuty integration configured

2. **GitHub setup**:
   - [ ] GitHub Actions enabled
   - [ ] GitHub Secrets configured (AWS credentials, etc.)
   - [ ] GitHub Environment protection rules configured for `production-model-change`
   - [ ] Branch protection rules on `main` and `staging` branches

3. **AI provider accounts**:
   - [ ] Anthropic account with API key (primary)
   - [ ] OpenAI account with API key (fallback)
   - [ ] Budgets configured on provider dashboards
   - [ ] Billing alerts enabled

4. **Team access**:
   - [ ] Super Admins designated (at least 2 people)
   - [ ] Operations Engineers have AWS console + CLI access
   - [ ] On-call rotation configured in PagerDuty

5. **Documentation**:
   - [ ] Runbooks published in internal wiki
   - [ ] Contact list for escalations
   - [ ] Provider status page URLs bookmarked

---

## Out of Scope

This spec does NOT cover:

1. **Fine-tuning models** — All models used as-is from providers
2. **Model caching** — No semantic caching or prompt caching (future optimization)
3. **Model orchestration** — No LangChain, LlamaIndex, or agent frameworks (future consideration)
4. **Student data in prompts** — No PII sent to AI providers (worksheet content only)
5. **Model quality scoring** — No automated quality evaluation (manual spot-checks only)
6. **Cost allocation by customer** — All costs tracked at environment level, not per-teacher or per-school
7. **Multi-region deployment** — All infrastructure in `us-east-1` only
8. **Model training or self-hosted models** — Cloud API providers only
9. **Real-time model selection** — Active provider set per environment, not per request
10. **A/B testing framework** — Canary deployment is manual, not automated experimentation platform

---

## Future Enhancements (Post-V1)

After initial control plane is stable (3+ months in production), consider:

1. **Automated model quality scoring**: Use a judge model (e.g., GPT-4) to score worksheet quality, alert if quality drops below threshold
2. **Semantic caching**: Cache worksheet prompts + results to reduce redundant API calls
3. **Load-based provider selection**: Route to cheapest available provider based on real-time pricing + latency
4. **Multi-region failover**: Deploy to `us-west-2` as backup, auto-failover if `us-east-1` region has issues
5. **Model performance benchmarks**: Automated testing of new model versions against quality/latency/cost benchmarks
6. **Cost allocation by school**: Tag requests with school ID, break down costs per customer (requires DynamoDB tracking)
7. **Prompt versioning**: Version prompt templates separately from model config, A/B test prompt improvements
8. **Model fine-tuning**: Fine-tune models on Learnfyra-specific worksheet corpus for better quality
9. **GraphQL API for control plane**: Super Admin UI to change model configs without editing JSON files
10. **Automated canary analysis**: ML-based anomaly detection to auto-promote or auto-abort canary deployments

---

## Stakeholder Sign-Off

This spec requires approval from:

- [ ] **CTO** — overall architecture and cost implications
- [ ] **Lead DevOps Engineer** — feasibility of implementation and runbooks
- [ ] **Product Manager** — alignment with product roadmap
- [ ] **Finance Lead** — cost monitoring and alerting strategy
- [ ] **Security Lead** — secrets management and access control

**Approval date**: _____________  
**Implementation target**: Q2 2026  
**Review date**: 90 days after production deployment

---

## Appendix: Model Config JSON Schema

Full JSON schema for model configuration (validated in CI):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://learnfyra.com/schemas/model-config.json",
  "title": "Learnfyra Model Configuration",
  "type": "object",
  "required": ["version", "activeProvider", "providers"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^v[0-9]+$",
      "description": "Config version, must increment on each change"
    },
    "activeProvider": {
      "type": "string",
      "enum": ["anthropic", "openai", "google", "cohere", "mistral"],
      "description": "Primary AI provider"
    },
    "providers": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["enabled", "model", "secretArn", "maxTokens", "temperature", "timeout", "weight"],
        "properties": {
          "enabled": {
            "type": "boolean",
            "description": "Whether this provider is enabled"
          },
          "model": {
            "type": "string",
            "description": "Model identifier from provider"
          },
          "secretArn": {
            "type": "string",
            "pattern": "^arn:aws:secretsmanager:",
            "description": "AWS Secrets Manager ARN for API key"
          },
          "maxTokens": {
            "type": "integer",
            "minimum": 1000,
            "maximum": 200000,
            "description": "Maximum tokens for completion"
          },
          "temperature": {
            "type": "number",
            "minimum": 0,
            "maximum": 2,
            "description": "Sampling temperature"
          },
          "timeout": {
            "type": "integer",
            "minimum": 10000,
            "maximum": 300000,
            "description": "Request timeout in milliseconds"
          },
          "weight": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "Traffic weight for load balancing"
          }
        }
      }
    },
    "fallback": {
      "type": "object",
      "required": ["enabled"],
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "provider": {
          "type": ["string", "null"],
          "enum": ["anthropic", "openai", "google", "cohere", "mistral", null]
        },
        "retryCount": {
          "type": "integer",
          "minimum": 0,
          "maximum": 5
        }
      }
    },
    "canary": {
      "type": "object",
      "required": ["enabled"],
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "provider": {
          "type": ["string", "null"],
          "enum": ["anthropic", "openai", "google", "cohere", "mistral", null]
        },
        "trafficPercent": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100
        }
      }
    }
  }
}
```

**Schema validation**: CI runs `npm run validate:model-config` on every PR, blocks merge if schema validation fails.

---

*End of specification*
