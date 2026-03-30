# Deployment Guide

## Domain Routing Plan

| Environment | Web URL | API URL | Admin URL | Auth URL |
|---|---|---|---|---|
| dev | web.dev.learnfyra.com | api.dev.learnfyra.com | admin.dev.learnfyra.com | auth.dev.learnfyra.com |
| staging | web.staging.learnfyra.com | api.staging.learnfyra.com | admin.staging.learnfyra.com | auth.staging.learnfyra.com |
| prod | web.learnfyra.com | api.learnfyra.com | admin.learnfyra.com | auth.learnfyra.com |

## DNS Prerequisites (Route 53 + ACM)

Before deploying any environment, complete these prerequisites:

### Step 1: Route 53 Hosted Zone
A hosted zone for `learnfyra.com` must exist in Route 53.

```bash
# Get hosted zone ID
aws route53 list-hosted-zones --query 'HostedZones[?Name==`learnfyra.com.`].Id' --output text
# → /hostedzone/ZXXXXXXXXXXXXXXXXXXXX
```

Add the hosted zone ID to CDK context:
```json
// infra/cdk.json
{
  "context": {
    "hostedZoneId": "ZXXXXXXXXXXXXXXXXXXXX",
    "hostedZoneName": "learnfyra.com"
  }
}
```

### Step 2: ACM Certificate (us-east-1 required for CloudFront)

```bash
# Request wildcard certificate (covers all subdomains)
aws acm request-certificate \
  --domain-name "*.learnfyra.com" \
  --subject-alternative-names "learnfyra.com" \
  --validation-method DNS \
  --region us-east-1

# Wait for validation (add CNAME records to Route 53)
aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID --region us-east-1
```

Add certificate ARN to CDK context:
```json
{
  "context": {
    "certificateArn": "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID"
  }
}
```

### Step 3: Google OAuth Client IDs

Create separate OAuth clients in Google Cloud Console for each environment:

| Environment | Authorized Origins | Authorized Redirect URIs |
|---|---|---|
| dev | https://web.dev.learnfyra.com | https://auth.dev.learnfyra.com/oauth2/idpresponse |
| staging | https://web.staging.learnfyra.com | https://auth.staging.learnfyra.com/oauth2/idpresponse |
| prod | https://web.learnfyra.com | https://auth.learnfyra.com/oauth2/idpresponse |

Client IDs and secrets are stored in Secrets Manager: `learnfyra/{env}/auth-config`.

## CDK Deploy Commands

```bash
cd infra
npm install

# Validate (required before any deploy — must show zero warnings)
npx cdk synth --context env=dev

# Deploy dev
npx cdk deploy --context env=dev --require-approval never

# Deploy staging
npx cdk deploy --context env=staging --require-approval never

# Deploy prod (will prompt for confirmation in CI)
npx cdk deploy --context env=prod --require-approval broadening
```

## Frontend Deploy (S3 Sync)

After CDK deploys the S3 bucket, sync frontend assets:

```bash
# Dev
aws s3 sync frontend/ s3://learnfyra-dev-s3-frontend/ --delete

# Staging
aws s3 sync frontend/ s3://learnfyra-staging-s3-frontend/ --delete

# Prod
aws s3 sync frontend/ s3://learnfyra-prod-s3-frontend/ --delete
```

The `--delete` flag removes files from S3 that no longer exist locally.

## Post-Deploy Validation

Run these checks after each environment deploy:

```bash
# Health check
curl -f https://api.{env}.learnfyra.com/api/health
# Expected: {"status":"ok","version":"..."}

# CORS preflight
curl -X OPTIONS https://api.{env}.learnfyra.com/api/generate \
  -H "Origin: https://web.{env}.learnfyra.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
# Expected: 200, Access-Control-Allow-Origin header present

# Frontend loads
curl -f https://web.{env}.learnfyra.com/
# Expected: 200, HTML response

# CloudFront invalidation (if frontend assets changed)
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

## AWS Validation Runbook

Full post-deploy validation for all AWS services:

### Lambda Validation
```bash
# Invoke health function directly
aws lambda invoke \
  --function-name learnfyra-health-{env} \
  --payload '{}' \
  /tmp/response.json && cat /tmp/response.json

# Check recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/learnfyra-generate-{env} \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)
```

### API Gateway Validation
```bash
# List APIs
aws apigateway get-rest-apis --query 'items[?name==`learnfyra-{env}-api`]'

# Test endpoint directly
aws apigateway test-invoke-method \
  --rest-api-id API_ID \
  --resource-id RESOURCE_ID \
  --http-method GET \
  --path-with-query-string /api/health
```

### S3 Validation
```bash
# Verify bucket exists and lifecycle rule is set
aws s3api get-bucket-lifecycle-configuration \
  --bucket learnfyra-{env}-s3-worksheets

# Verify block public access
aws s3api get-public-access-block \
  --bucket learnfyra-{env}-s3-worksheets
```

### DynamoDB Validation
```bash
# Verify tables exist
aws dynamodb list-tables --query 'TableNames[?contains(@, `learnfyra`)]'

# Verify GSI on QuestionBank
aws dynamodb describe-table \
  --table-name LearnfyraQuestionBank-{env} \
  --query 'Table.GlobalSecondaryIndexes'
```

### CloudFront Validation
```bash
# Verify distribution status
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`learnfyra-{env}-cdn`].{Id:Id,Status:Status,Domain:DomainName}'
```

### Cognito Validation
```bash
# Verify user pool
aws cognito-idp list-user-pools --max-results 10 \
  --query 'UserPools[?Name==`learnfyra-{env}-user-pool`]'
```

## Rollback Procedure

### Lambda Rollback
```bash
# List versions
aws lambda list-versions-by-function \
  --function-name learnfyra-generate-{env}

# Rollback by pointing alias to previous version
aws lambda update-alias \
  --function-name learnfyra-generate-{env} \
  --name live \
  --function-version PREVIOUS_VERSION
```

### CDK Stack Rollback
```bash
# CloudFormation will detect drift and can rollback
aws cloudformation rollback-stack \
  --stack-name LearnfyraStack-{env}

# Or use CDK rollback (experimental)
npx cdk rollback --context env={env}
```

### Frontend Rollback
```bash
# S3 versioning is enabled on prod — restore previous version
aws s3api list-object-versions \
  --bucket learnfyra-prod-s3-frontend \
  --prefix index.html

# Restore specific version
aws s3api copy-object \
  --bucket learnfyra-prod-s3-frontend \
  --copy-source learnfyra-prod-s3-frontend/index.html?versionId=VERSION_ID \
  --key index.html
```

## Rebrand Migration Notes (edusheet → learnfyra)

If migrating from legacy edusheet-* resource names to learnfyra-* naming:

**Delete order (dependencies matter):**
1. Delete CloudFront distribution (wait for it to fully disable — can take 15 min)
2. Delete API Gateway stage, then API
3. Delete Lambda functions (all learnfyra-* Lambda functions)
4. Delete Lambda Layers
5. Empty S3 buckets, then delete buckets
6. Delete DynamoDB tables (ensure data is migrated first if needed)
7. Delete Cognito User Pools
8. Delete Secrets Manager secrets (with recovery window)
9. Delete CloudWatch log groups
10. Delete IAM roles (Lambda execution roles)

**Do not delete:**
- Route 53 hosted zone (DNS records stay)
- ACM certificate (reused by new stack)
- SNS topics (if actively receiving alerts)
