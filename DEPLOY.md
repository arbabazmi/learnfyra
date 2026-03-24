# EduSheet AI — Deployment Guide

## Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js 18+
- AWS CDK CLI: `npm install -g aws-cdk`

## One-Time Setup

### 1. Create the Anthropic API key in SSM Parameter Store

```bash
# Dev
aws ssm put-parameter \
  --name "/edusheet/dev/anthropic-api-key" \
  --value "sk-ant-YOUR_KEY_HERE" \
  --type SecureString \
  --region us-east-1

# Staging
aws ssm put-parameter \
  --name "/edusheet/staging/anthropic-api-key" \
  --value "sk-ant-YOUR_KEY_HERE" \
  --type SecureString \
  --region us-east-1

# Prod
aws ssm put-parameter \
  --name "/edusheet/prod/anthropic-api-key" \
  --value "sk-ant-YOUR_KEY_HERE" \
  --type SecureString \
  --region us-east-1
```

### 2. Bootstrap CDK (one time per AWS account/region)

```bash
cd infra/cdk
npm install
npx cdk bootstrap --context env=dev
```

## Deploy

### Dev environment
```bash
cd infra/cdk
npx cdk deploy --context env=dev --require-approval never
```

### Staging
```bash
cd infra/cdk
npx cdk deploy --context env=staging
```

### Production (requires manual confirmation)
```bash
cd infra/cdk
npx cdk deploy --context env=prod
```

## After Deploy — Sync Frontend & Invalidate Cache

After each deploy, sync the frontend files and clear the CloudFront cache:

```bash
# Replace DEV_BUCKET and DIST_ID with values from the CDK deploy output
aws s3 sync frontend/ s3://edusheet-dev-s3-frontend/ --delete

aws cloudfront create-invalidation \
  --distribution-id DIST_ID \
  --paths "/*"
```

CDK outputs the bucket names and CloudFront distribution ID at the end of `cdk deploy`.

## Resource Naming Convention

All AWS resources follow the pattern `edusheet-{env}-{service-type}`:

| Resource | Dev | Staging | Prod |
|---|---|---|---|
| Worksheet S3 bucket | `edusheet-dev-s3-worksheets` | `edusheet-staging-s3-worksheets` | `edusheet-prod-s3-worksheets` |
| Frontend S3 bucket | `edusheet-dev-s3-frontend` | `edusheet-staging-s3-frontend` | `edusheet-prod-s3-frontend` |
| Generate Lambda | `edusheet-dev-lambda-generate` | `edusheet-staging-lambda-generate` | `edusheet-prod-lambda-generate` |
| Download Lambda | `edusheet-dev-lambda-download` | `edusheet-staging-lambda-download` | `edusheet-prod-lambda-download` |
| API Gateway | `edusheet-dev-apigw` | `edusheet-staging-apigw` | `edusheet-prod-apigw` |
| SSM param | `/edusheet/dev/anthropic-api-key` | `/edusheet/staging/anthropic-api-key` | `/edusheet/prod/anthropic-api-key` |

## GitHub Actions Secrets Required

Set these in: GitHub repository → Settings → Secrets and variables → Actions

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM deploy user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM deploy user secret |
| `AWS_REGION` | `us-east-1` |
| `ANTHROPIC_API_KEY_DEV` | Anthropic API key for dev Lambda |
| `ANTHROPIC_API_KEY_STAGING` | Anthropic API key for staging Lambda |
| `ANTHROPIC_API_KEY_PROD` | Anthropic API key for prod Lambda |

The deploy workflows upload each key to SSM Parameter Store during the pipeline run,
so the Lambda functions can read it at runtime without hardcoding anything.

## CDK Commands Reference

```bash
# From infra/cdk/
npx cdk synth --context env=dev      # Preview CloudFormation template (no deploy)
npx cdk diff --context env=dev       # Show what will change vs deployed stack
npx cdk deploy --context env=dev     # Deploy to dev
npx cdk destroy --context env=dev    # Tear down dev (never run on prod)
npx cdk ls                           # List all stacks
```

## IAM Permissions for Deploy User

The IAM user used by GitHub Actions needs these managed policies:
- `AmazonS3FullAccess`
- `AWSLambda_FullAccess`
- `AmazonAPIGatewayAdministrator`
- `CloudFrontFullAccess`
- `AmazonSSMFullAccess`
- `AWSCloudFormationFullAccess`
- `IAMFullAccess` (needed for CDK to create Lambda execution roles)

Or attach the AWS-managed `AdministratorAccess` policy for simplicity in non-prod setups.
