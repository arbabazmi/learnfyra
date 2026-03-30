# Admin Control Plane Operations Runbook

## Access Control Matrix

| Role | AWS Console | Secrets | Lambda Config | DynamoDB | CloudWatch | User Management |
|---|---|---|---|---|---|---|
| Super Admin | Full | Read + Rotate | Full | Full | Full | Full |
| Ops Engineer | Read | Read | Update Lambda env | Read | Full | None |
| Product Manager | None | None | None | Read only | Read | None |
| Finance | Billing only | None | None | None | Cost metrics | None |

## Environment Isolation

Each environment (dev / staging / prod) is a completely separate CDK stack with its own:
- AWS account (recommended) or separate resource naming if single account
- Cognito User Pool
- DynamoDB tables
- S3 buckets
- Lambda functions
- API Gateway
- Secrets Manager secrets

**Never use production credentials in development work.**

## Common Admin Operations

### Rotate Anthropic API Key

```bash
# 1. Generate new key at console.anthropic.com
# 2. Update Secrets Manager
aws secretsmanager update-secret \
  --secret-id learnfyra/prod/anthropic-api-key \
  --secret-string '{"ANTHROPIC_API_KEY":"sk-ant-NEW_KEY_HERE"}'

# 3. Lambda reads from Secrets Manager at cold start — wait for next cold start OR
# 4. Force cold start by updating Lambda env var (touch deployment)
aws lambda update-function-configuration \
  --function-name learnfyra-generate-prod \
  --environment Variables={FORCE_REFRESH=1}
# Then remove the dummy var:
aws lambda update-function-configuration \
  --function-name learnfyra-generate-prod \
  --environment Variables={}

# 5. Verify by invoking health endpoint
curl https://api.learnfyra.com/api/health
```

### Switch Active AI Model (Hot Swap)

The active Claude model is stored in DynamoDB Config table and read at runtime:

```bash
# View current config
aws dynamodb get-item \
  --table-name LearnfyraConfig-prod \
  --key '{"configKey": {"S": "ai/activeModel"}}'

# Switch to Haiku (cost-optimized)
aws dynamodb put-item \
  --table-name LearnfyraConfig-prod \
  --item '{
    "configKey": {"S": "ai/activeModel"},
    "value": {"S": "claude-haiku-20240307"},
    "updatedBy": {"S": "ops-engineer@learnfyra.com"},
    "updatedAt": {"S": "2026-03-28T12:00:00Z"},
    "reason": {"S": "Claude Sonnet API degraded - switching to Haiku fallback"}
  }'

# Switch back to Sonnet
aws dynamodb put-item \
  --table-name LearnfyraConfig-prod \
  --item '{
    "configKey": {"S": "ai/activeModel"},
    "value": {"S": "claude-sonnet-4-20250514"},
    "updatedBy": {"S": "ops-engineer@learnfyra.com"},
    "updatedAt": {"S": "2026-03-28T14:00:00Z"},
    "reason": {"S": "Claude Sonnet API restored"}
  }'
```

### Suspend a User

```bash
# Disable in Cognito
aws cognito-idp admin-disable-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username user@example.com

# Update role in DynamoDB Users table to 'suspended'
aws dynamodb update-item \
  --table-name LearnfyraUsers-prod \
  --key '{"userId": {"S": "USER_UUID"}}' \
  --update-expression 'SET #r = :r, suspendedAt = :t, suspendedBy = :by' \
  --expression-attribute-names '{"#r": "role"}' \
  --expression-attribute-values '{
    ":r": {"S": "suspended"},
    ":t": {"S": "2026-03-28T12:00:00Z"},
    ":by": {"S": "admin@learnfyra.com"}
  }'
```

### Enable Maintenance Mode

```bash
# Set maintenance mode flag in Config table
aws dynamodb put-item \
  --table-name LearnfyraConfig-prod \
  --item '{
    "configKey": {"S": "platform/maintenanceMode"},
    "value": {"S": "true"},
    "message": {"S": "Scheduled maintenance — back at 14:00 UTC"},
    "endsAt": {"S": "2026-03-28T14:00:00Z"},
    "updatedBy": {"S": "admin@learnfyra.com"}
  }'

# Lambda handlers check this config key and return 503 when enabled
# Frontend checks /api/health and shows maintenance banner when 503 received
```

### Flag a Worksheet for Review

```bash
# Add flag to worksheet metadata in S3
aws s3 cp s3://learnfyra-prod-s3-worksheets/worksheets/2026/03/28/UUID/metadata.json \
  /tmp/metadata.json

# Edit /tmp/metadata.json to add: "flagged": true, "flagReason": "...", "flaggedBy": "..."

aws s3 cp /tmp/metadata.json \
  s3://learnfyra-prod-s3-worksheets/worksheets/2026/03/28/UUID/metadata.json
```

## Emergency Procedures

### Complete Service Outage

1. Check AWS Service Health Dashboard: https://health.aws.amazon.com/
2. Check CloudWatch dashboard for error patterns
3. If Lambda issue: invoke health function directly (see deployment.md)
4. If API Gateway issue: check stage deployment status
5. If S3 issue: check bucket policy and IAM role
6. Enable maintenance mode (see above) to prevent user confusion
7. If CDK deploy caused the outage: run rollback (see deployment.md)
8. Notify users via status page update

### Secrets Rotation Emergency

If API key is compromised:
1. Immediately invalidate the compromised key at the provider (Anthropic console / Google Cloud console)
2. Generate a new key
3. Update Secrets Manager (see "Rotate Anthropic API Key" above)
4. Force Lambda cold start to pick up new key
5. Audit CloudWatch logs for any unauthorized usage in the 24 hours before rotation
6. Document the incident: what was exposed, what was accessed, remediation taken

### Rate Limit Emergency

If the platform is receiving unexpected high traffic that is degrading service:
1. Increase API Gateway throttle limits temporarily
2. Add IP-based rate limiting in WAF if traffic appears to be a bot or abuse
3. Contact AWS Support if DDoS suspected (they have free DDoS response)
4. Communicate to users if legitimate traffic surge is causing slowness

## Secrets Management Policy

- All secrets are stored in AWS Secrets Manager, never in code or environment variable files
- Secret rotation schedule: API keys — on compromise or annually; JWT secrets — automated 90-day
- Least privilege: each Lambda function has read access only to the secrets it needs
- Audit: AWS CloudTrail logs all Secrets Manager access
- No secrets in GitHub — use GitHub Secrets for CI/CD, which inject into CDK at deploy time
