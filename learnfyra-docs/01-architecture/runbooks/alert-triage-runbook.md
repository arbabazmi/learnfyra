# Alert Triage Runbook (DOP-08)

## Overview

This runbook guides on-call engineers through investigating CloudWatch alarms. All alarms notify SNS topic `learnfyra-{env}-ops-alerts`.

## Alarm Reference

| Alarm Name Pattern | Trigger | Severity |
|---|---|---|
| `learnfyra-{fn}-errors-anomaly` | Error count exceeds ±2σ band | P1 |
| `learnfyra-{fn}-duration-anomaly` | p99 duration exceeds ±2σ band | P2 |
| `learnfyra-generate-concurrent` | Concurrency > 80% of account limit | P1 |
| `learnfyra-submit-concurrent` | Concurrency > 80% of account limit | P2 |
| `learnfyra-api-4xx` | 4xx rate > 5% of requests | P2 |
| `learnfyra-api-5xx` | 5xx rate > 1% of requests | P1 |
| `learnfyra-api-throttle` | Throttle count > 10/minute | P2 |
| `learnfyra-api-surge` | Request rate +300% in 5 minutes | P1 |

---

## Runbook 1: Error Anomaly Alarm

**Alarm:** `learnfyra-{fn}-errors-anomaly`

**Investigation steps:**

1. Open CloudWatch Logs for the alarming function:
   ```
   Log group: /aws/lambda/learnfyra-{fn}-{env}
   ```

2. Run the "Generation Errors" Logs Insights query (see `01-architecture/aws-architecture.md` Query 1).

3. Identify error pattern:
   - `AnthropicAuthError` → API key expired or invalid → rotate in Secrets Manager
   - `ValidationError` → bad request from frontend → check frontend request format
   - `S3Error` → S3 bucket permissions or bucket missing → check IAM role, bucket existence
   - `DynamoDBError` → table throttled or missing → check DynamoDB table status
   - `TimeoutError` → Lambda execution exceeding timeout → check if Claude API is slow

4. For `AnthropicAuthError`:
   ```bash
   # Rotate key in Secrets Manager
   aws secretsmanager update-secret \
     --secret-id learnfyra/{env}/anthropic-api-key \
     --secret-string '{"ANTHROPIC_API_KEY":"sk-ant-NEW_KEY"}'
   ```

5. Check if alarm is self-resolving (brief spike) or sustained (ongoing issue).

6. If sustained: page team lead, open P1 incident ticket.

---

## Runbook 2: Duration Anomaly Alarm

**Alarm:** `learnfyra-{fn}-duration-anomaly`

**Investigation steps:**

1. Run the "Slow Generations" Logs Insights query (see `01-architecture/aws-architecture.md` Query 2).

2. Identify cause:
   - Consistent slow (all invocations slow) → external dependency issue (Claude API, DynamoDB)
   - Sporadic slow (some invocations slow) → likely cold starts or large payloads

3. For Claude API latency:
   ```bash
   # Check Anthropic status page: https://status.anthropic.com
   # Test directly:
   curl -X POST https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-haiku-20240307","max_tokens":100,"messages":[{"role":"user","content":"ping"}]}'
   ```

4. If Claude API is degraded: switch active model in M07 Admin panel to a faster model (e.g., Haiku).

5. For cold start spikes: consider provisioned concurrency on `learnfyra-generate` if sustained.

---

## Runbook 3: Concurrent Execution Alarm

**Alarm:** `learnfyra-generate-concurrent` or `learnfyra-submit-concurrent`

**Investigation steps:**

1. Check current account-level concurrency limit:
   ```bash
   aws lambda get-account-settings
   # ReservedConcurrentExecutions shows current limit
   ```

2. Check per-function concurrency:
   ```bash
   aws lambda get-function-concurrency --function-name learnfyra-generate-{env}
   ```

3. Check CloudWatch metric `ConcurrentExecutions` for the function over the last 15 minutes.

4. Determine if traffic is legitimate or a bot/abuse pattern:
   - Check API Gateway access logs for unusual IP patterns or user-agent strings
   - If abuse: add WAF rule to block offending IP range

5. If legitimate traffic surge:
   - Increase Lambda reserved concurrency limit (request via AWS Support if needed)
   - Scale API Gateway throttle limits
   - Consider SQS queue in front of generate Lambda for smoothing

---

## Runbook 4: API Throttle / Surge Alarm

**Alarm:** `learnfyra-api-throttle` or `learnfyra-api-surge`

**Investigation steps:**

1. Open API Gateway access logs in CloudWatch:
   ```
   Log group: API-Gateway-Execution-Logs_{api-id}/{env}
   ```

2. Identify the endpoint being throttled or surging:
   ```
   # Logs Insights query:
   fields @timestamp, resourcePath, httpMethod, status, ip
   | filter status = '429'
   | stats count() by resourcePath, ip
   | sort count() desc
   ```

3. If `/api/generate` is throttled: this is expected under heavy load. Check if students are
   getting proper error feedback (429 with retry-after header).

4. If surge is legitimate (viral growth, scheduled class activity):
   - Temporarily increase API Gateway throttle limits in CDK and redeploy
   - Monitor cost impact in CloudWatch billing metrics

5. If surge appears to be an attack:
   - Enable AWS WAF rate limiting rule on CloudFront distribution
   - Contact AWS Support for DDoS mitigation if needed

---

## Runbook 5: API 5xx Error Spike

**Alarm:** `learnfyra-api-5xx`

**Investigation steps:**

1. Identify which Lambda function is returning 5xx:
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/learnfyra-generate-{env} \
     --filter-pattern '"statusCode":500' \
     --start-time $(date -d '30 minutes ago' +%s000)
   ```

2. Check if 5xx is from Lambda execution error or Lambda timeout:
   - Execution error: check error message in logs
   - Timeout: look for `Task timed out` in logs → increase timeout or reduce workload

3. Common 5xx causes and fixes:
   - `ANTHROPIC_API_KEY` missing from env → check Secrets Manager + Lambda env vars
   - `WORKSHEET_BUCKET_NAME` missing → check CDK stack was deployed successfully
   - Out of memory → increase Lambda memory in CDK (generate: 1024MB, submit: 256MB)
   - Unhandled promise rejection → check for missing `await` in async handler

4. If 5xx is caused by a bad deploy: trigger rollback (see `01-architecture/deployment.md`).

---

## Escalation Path

| Severity | Response Time | Action |
|---|---|---|
| P1 | 15 minutes | Page on-call engineer, open incident ticket, notify team lead |
| P2 | 2 hours | Email team channel, investigate during business hours |
| P3 | Next business day | Log in backlog, investigate when convenient |

P1 criteria: data loss risk, complete service outage, auth not working, payments impacted.
P2 criteria: degraded performance, elevated error rates, partial feature outage.
P3 criteria: anomaly without user impact, cost spikes within budget.
