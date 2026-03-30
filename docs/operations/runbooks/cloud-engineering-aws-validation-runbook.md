# Cloud Engineering AWS Validation Runbook

Date: 2026-03-27
Audience: Cloud Engineering, DevOps, SRE
Scope: Validate AWS deployment health, resource wiring, and environment readiness after deploy.

**Applies to:** dev, staging, prod environments. All services defined in the CDK stack are deployed to all three environments.

**How to use:** Replace `{env}` placeholder with your target environment name (dev, staging, or prod).

## 1. Preconditions

1. AWS CLI is authenticated to target account and region.
2. CloudFormation deploy has completed.
3. You know target environment: dev, staging, or prod.
4. You have read access to CloudFormation, API Gateway, Lambda, Cognito, CloudFront, Route53, SSM, Secrets Manager, CloudWatch, and Logs.

## 2. Environment Mapping

1. Stack name pattern: LearnfyraStack-{env}
2. Lambda name pattern: learnfyra-{env}-lambda-*
3. API name pattern: learnfyra-{env}-apigw
4. Worksheet bucket: learnfyra-{env}-s3-worksheets
5. Frontend bucket: learnfyra-{env}-s3-frontend
6. SSM Anthropic key path: /learnfyra/{env}/anthropic-api-key
7. Secrets Manager paths:
- /learnfyra/{env}/jwt-secret
- /learnfyra/{env}/google-client-secret

## 3. CloudFormation Validation

1. Stack status is CREATE_COMPLETE or UPDATE_COMPLETE.
2. No rollback events exist.
3. Outputs include API URL, frontend URL, distribution ID, and bucket names.

```powershell
aws cloudformation describe-stacks --stack-name LearnfyraStack-dev --region us-east-1
aws cloudformation describe-stack-events --stack-name LearnfyraStack-dev --region us-east-1 --max-items 50
```

## 4. API Gateway Validation

1. REST API exists and stage matches environment.
2. Auth routes and protected routes are present.
3. Custom domain and base path mapping are correct when domains are enabled.

```powershell
aws apigateway get-rest-apis --region us-east-1
aws apigateway get-stages --rest-api-id <api-id> --region us-east-1
aws apigateway get-domain-name --domain-name api.dev.learnfyra.com --region us-east-1
aws apigateway get-base-path-mappings --domain-name api.dev.learnfyra.com --region us-east-1
```

## 5. Lambda Validation

Validate all expected functions are present and healthy:

- generate
- download
- auth
- api-authorizer
- solve
- submit
- progress
- analytics
- class
- rewards
- student
- admin

Checks:
1. State is Active.
2. LastUpdateStatus is Successful.
3. Required environment variables exist.

```powershell
aws lambda list-functions --region us-east-1 --query "Functions[?starts_with(FunctionName, 'learnfyra-dev-lambda-')].[FunctionName,State,LastUpdateStatus]" --output table
aws lambda get-function-configuration --function-name learnfyra-dev-lambda-auth --region us-east-1
```

## 6. Cognito Validation

1. User pool exists: learnfyra-{env}-user-pool.
2. User pool client exists and has authorization code grant.
3. Google IdP is configured.
4. Hosted UI domain exists.

```powershell
aws cognito-idp list-user-pools --max-results 60 --region us-east-1
aws cognito-idp list-user-pool-clients --user-pool-id <pool-id> --region us-east-1
aws cognito-idp list-identity-providers --user-pool-id <pool-id> --region us-east-1
```

## 7. CloudFront and S3 Validation

1. CloudFront distribution status is Deployed.
2. Frontend S3 bucket has latest assets.
3. Worksheet bucket exists and is private.
4. Behavior for /api/* routes to API Gateway origin.

```powershell
aws cloudfront get-distribution --id <distribution-id>
aws s3 ls s3://learnfyra-dev-s3-frontend/ --recursive --human-readable --summarize
aws s3api get-bucket-policy-status --bucket learnfyra-dev-s3-worksheets
```

## 8. DNS and Certificates Validation

**Note:** This section applies **only if custom domains are enabled**. If CDK was deployed with `enableCustomDomains=false`, skip this section.

Validation checks:
1. web, admin, api, and auth domains resolve.
2. Certificate is valid for custom domains.
3. API and CloudFront aliases point to correct targets.

```powershell
nslookup web.dev.learnfyra.com
nslookup admin.dev.learnfyra.com
nslookup api.dev.learnfyra.com
nslookup auth.dev.learnfyra.com

# Or use AWS CLI to verify Route53 records
aws route53 list-resource-record-sets --hosted-zone-id <zone-id> --region us-east-1
```

**If custom domains are NOT enabled:**
- CloudFront auto-generates a domain name like `d123456.cloudfront.net`
- API Gateway uses `{api-id}.execute-api.us-east-1.amazonaws.com`
- Both are accessible without custom DNS setup

## 9. Secrets and Parameter Validation

1. Required secrets exist in Secrets Manager.
2. Anthropic parameter exists in SSM SecureString.
3. Never print secret values to shared logs.

```powershell
aws secretsmanager describe-secret --secret-id /learnfyra/dev/jwt-secret --region us-east-1
aws secretsmanager describe-secret --secret-id /learnfyra/dev/google-client-secret --region us-east-1
aws ssm get-parameter --name /learnfyra/dev/anthropic-api-key --with-decryption --region us-east-1
```

## 10. Observability Validation

1. API access log group exists.
2. Lambda log groups exist for all deployed functions.
3. CloudWatch alarms exist for Lambda errors, duration, and API health.
4. Dashboard and Logs Insights query definitions exist.

```powershell
aws logs describe-log-groups --region us-east-1 --log-group-name-prefix /aws/lambda/learnfyra-dev-lambda-
aws logs describe-log-groups --region us-east-1 --log-group-name-prefix /aws/apigateway/learnfyra-dev-access-logs
aws cloudwatch describe-alarms --region us-east-1 --alarm-name-prefix learnfyra-dev
```

## 11. Release Gate Decision

Mark environment as validated only if all checks pass:

1. CloudFormation healthy.
2. Lambda/API/Cognito/CloudFront healthy.
3. Secrets and SSM dependencies present.
4. Monitoring and logs present.
5. No unresolved P0/P1 deployment defects.

If any critical check fails, stop rollout to next environment and open an incident ticket.
