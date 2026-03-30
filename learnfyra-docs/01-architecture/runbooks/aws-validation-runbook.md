# AWS Post-Deploy Validation Runbook

Run these checks after every deployment to any environment. Replace `{env}` with `dev`, `staging`, or `prod`.

## 1. Lambda Functions

```bash
# Verify all functions exist and are Active
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `learnfyra`) && contains(FunctionName, `{env}`)].{Name:FunctionName,State:State,Memory:MemorySize}' \
  --output table

# Invoke health function directly
aws lambda invoke \
  --function-name learnfyra-health-{env} \
  --payload '{}' \
  /tmp/health-response.json
cat /tmp/health-response.json
# Expected: {"statusCode":200,"body":"{\"status\":\"ok\"}"}

# Test generate function (non-destructive dry run)
aws lambda invoke \
  --function-name learnfyra-generate-{env} \
  --payload '{"httpMethod":"OPTIONS","headers":{},"body":"{}"}' \
  /tmp/options-response.json
cat /tmp/options-response.json
# Expected: {"statusCode":200,"headers":{"Access-Control-Allow-Origin":"*",...},"body":""}

# Check recent errors (last 1 hour)
aws logs filter-log-events \
  --log-group-name /aws/lambda/learnfyra-generate-{env} \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000) \
  --query 'events[].message'
```

## 2. API Gateway

```bash
# List APIs
aws apigateway get-rest-apis \
  --query 'items[?name==`learnfyra-{env}-api`].{Id:id,Name:name,CreatedDate:createdDate}'

# Export API_ID for subsequent commands
API_ID=$(aws apigateway get-rest-apis \
  --query 'items[?name==`learnfyra-{env}-api`].id' \
  --output text)

# Verify stages
aws apigateway get-stages \
  --rest-api-id $API_ID \
  --query 'item[].{Stage:stageName,LastUpdated:lastUpdatedDate}'

# Test health endpoint via API Gateway URL
curl -v https://${API_ID}.execute-api.us-east-1.amazonaws.com/{env}/api/health
# or via custom domain:
curl -v https://api.{env}.learnfyra.com/api/health
# Expected: 200 {"status":"ok"}

# Test CORS preflight
curl -X OPTIONS https://api.{env}.learnfyra.com/api/generate \
  -H "Origin: https://web.{env}.learnfyra.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
# Expected: 200, Access-Control-Allow-Origin header present
```

## 3. S3 Buckets

```bash
# Verify buckets exist
aws s3api list-buckets \
  --query 'Buckets[?contains(Name, `learnfyra-{env}`)].Name'

# Verify lifecycle rule on worksheets bucket
aws s3api get-bucket-lifecycle-configuration \
  --bucket learnfyra-{env}-s3-worksheets
# Expected: rule with expiration after 7 days on prefix worksheets/

# Verify block public access
aws s3api get-public-access-block \
  --bucket learnfyra-{env}-s3-worksheets
# Expected: all four flags true

# Test write permission (Lambda execution role)
# This is verified implicitly when generate endpoint works end-to-end

# Verify frontend bucket serves index.html
curl -v https://web.{env}.learnfyra.com/
# Expected: 200 with HTML content
```

## 4. DynamoDB Tables

```bash
# List all learnfyra tables
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `learnfyra`) || contains(@, `Learnfyra`)]'

# Verify QuestionBank table exists and has correct GSI
aws dynamodb describe-table \
  --table-name LearnfyraQuestionBank-{env} \
  --query 'Table.{Status:TableStatus,BillingMode:BillingModeSummary.BillingMode,GSIs:GlobalSecondaryIndexes[].IndexName}'
# Expected: ACTIVE, PAY_PER_REQUEST, GSI-1 index

# Verify Users table
aws dynamodb describe-table \
  --table-name LearnfyraUsers-{env} \
  --query 'Table.{Status:TableStatus,ItemCount:ItemCount}'

# Test read/write (dev only — creates test record)
# (skip in prod validation)
```

## 5. Cognito User Pool

```bash
# Verify user pool exists
aws cognito-idp list-user-pools --max-results 10 \
  --query 'UserPools[?Name==`learnfyra-{env}-user-pool`].{Id:Id,Name:Name,Status:Status}'

# Export USER_POOL_ID
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 \
  --query 'UserPools[?Name==`learnfyra-{env}-user-pool`].Id' \
  --output text)

# Verify domain is set (for Hosted UI)
aws cognito-idp describe-user-pool \
  --user-pool-id $USER_POOL_ID \
  --query 'UserPool.{Domain:Domain,EstimatedNumberOfUsers:EstimatedNumberOfUsers}'

# Verify Google IdP is configured
aws cognito-idp list-identity-providers \
  --user-pool-id $USER_POOL_ID \
  --query 'Providers[].{Name:ProviderName,Type:ProviderType}'
# Expected: [{Name: Google, Type: Google}]
```

## 6. Secrets Manager

```bash
# Verify all required secrets exist
aws secretsmanager list-secrets \
  --query 'SecretList[?contains(Name, `learnfyra/{env}`)].{Name:Name,LastRotated:LastRotatedDate}'

# Verify anthropic-api-key is accessible (returns metadata only)
aws secretsmanager describe-secret \
  --secret-id learnfyra/{env}/anthropic-api-key \
  --query '{Name:Name,ARN:ARN,LastChangedDate:LastChangedDate}'
```

## 7. CloudFront

```bash
# List distributions
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`learnfyra-{env}-cdn`].{Id:Id,Status:Status,Domain:DomainName,Enabled:Enabled}'

# Verify origins are correct
CF_ID=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`learnfyra-{env}-cdn`].Id' \
  --output text)

aws cloudfront get-distribution \
  --id $CF_ID \
  --query 'Distribution.DistributionConfig.Origins.Items[].{DomainName:DomainName,Id:Id}'
# Expected: S3 frontend bucket + API Gateway as origins
```

## 8. CloudWatch Alarms

```bash
# Check alarm states for this environment
aws cloudwatch describe-alarms \
  --alarm-name-prefix learnfyra-{env} \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Reason:StateReason}' \
  --output table
# Expected: all alarms in OK state

# Check if any alarms are in ALARM state
aws cloudwatch describe-alarms \
  --alarm-name-prefix learnfyra-{env} \
  --state-value ALARM \
  --query 'MetricAlarms[].AlarmName'
# Expected: empty array []
```

## 9. End-to-End Smoke Test

```bash
# Generate a worksheet (real API call — will use Anthropic API credits)
# Only run this in dev environment for post-deploy verification

curl -X POST https://api.dev.learnfyra.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "grade": 3,
    "subject": "Math",
    "topic": "Addition",
    "difficulty": "Easy",
    "questionCount": 5,
    "formats": ["html"]
  }'
# Expected: 200 with {worksheetId, downloadUrls, solveUrl}

# If worksheetId returned, test solve endpoint
WORKSHEET_ID="returned-uuid-here"
curl https://api.dev.learnfyra.com/api/solve/$WORKSHEET_ID
# Expected: 200 with questions array (no answers)
```

## Validation Sign-Off Checklist

After running the above checks, confirm:

```
[ ] All Lambda functions in Active state
[ ] Health endpoint returns 200
[ ] OPTIONS preflight returns 200 with CORS headers
[ ] All S3 buckets exist with correct lifecycle rules
[ ] DynamoDB tables exist with correct billing mode and GSIs
[ ] Cognito user pool exists with Google IdP configured
[ ] All Secrets Manager secrets accessible
[ ] CloudFront distribution in Deployed state
[ ] All CloudWatch alarms in OK state
[ ] End-to-end smoke test passed (dev only)
[ ] No errors in Lambda logs in the 5 minutes post-deploy
```
