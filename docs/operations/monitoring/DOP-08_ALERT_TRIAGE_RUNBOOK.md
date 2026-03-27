# DOP-08: Alert Triage Runbook
**Purpose**: Step-by-step guide to investigate and respond to DOP-08 cost/anomaly/throughput alarms  
**Audience**: On-call DevOps engineer, backend team lead  
**Last Updated**: 2026-03-26  

---

## Quick Reference: Alarm Severity & Response Times

| Alarm Type | Severity | Response SLA | Auto-Escalate? |
|---|---|---|---|
| Anomaly Detection | 🟡 Medium | 30 min | No |
| Concurrent Execution | 🟡 Medium | 30 min | No |
| API Throttle Detection | 🟡 Medium | 30 min | No |
| API Surge Detection | 🔴 High | 15 min | Yes → On-Call |
| Cost Spike (Custom Monitor) | 🟡 Medium | 1 hour | No |

---

## 1. Anomaly Detection Alarm: `{Function}-invocation-anomaly`

**Trigger**: Lambda function invocation count deviates ±2 standard deviations from 7-day baseline

**Example Alert**:
```
Alarm: learnfyra-prod-generate-invocation-anomaly
Status: ALARM (2 periods of high anomaly)
Reason: Invocations are 3.2σ above baseline
```

### Investigation Steps

#### Step 1: Confirm Anomaly is Real (Not Sensor Error)
```
1. Open CloudWatch Dashboard "learnfyra-prod-backend-observability"
2. Look at "Lambda Invocations by Function" widget
3. Find the Generate function graph
4. Is there a visible spike in the last 15 minutes?
   - YES → Proceed to Step 2
   - NO → Anomaly detector may be miscalibrated; document and close
```

#### Step 2: Quantify the Spike
```bash
# Run this Logs Insights query in CloudWatch Logs console:
# Navigate to: CloudWatch → Logs → Log Insights
# Log Group: /aws/lambda/learnfyra-prod-lambda-generate
# Run this query:

fields @functionName, @duration, @error
| stats count() as invocations, 
        pct(@duration, 50) as p50_ms, 
        pct(@duration, 95) as p95_ms,
        pct(@duration, 99) as p99_ms
  by @functionName
| display invocations, p50_ms, p95_ms, p99_ms

# Expected for Generate (normal):
#   invocations: 50-100/min
#   p95_ms: ~8,000ms
#   p99_ms: ~20,000ms

# If actual > normal by 3x, continue to Step 3
```

#### Step 3: Check Root Cause
Use the **DOP-07 Log Query**: `learnfyra-prod-top-errors-by-function`

```
Possible Causes:
1. Mass worksheet generation (intended)
   - Action: Verify with engineering; no action needed
   
2. Load test or performance benchmark (intended)
   - Action: Coordinate with team; monitor for errors
   
3. Cascading error retry loop (BUG)
   - Action: Check Generate function error logs
   - Run DOP-07 query: "high-latency-request-traces"
   - Look for timeout → crashed requests retrying
   
4. New feature deployment (intended)
   - Action: Cross-reference with recent deploy time
   - Review deployment logs
```

#### Step 4: Response

**If caused by legitimate activity (worksheet batch, load test)**:
```
1. Add comment to incident: "Anomaly is expected: [reason]"
2. Set alarm to OK manually (if safe)
3. No action needed; anomaly detector will re-baseline
4. Document in: docs/operations/DOP-08_KNOWN_SPIKES.md
```

**If caused by errors / unknown**:
```
1. Page on-call engineer
2. Run "Learnfyra Debug Checklist" (see Section 7)
3. If error-rate > 5%, trigger full incident response
```

---

## 2. Concurrent Execution Alarm: `{Function}-concurrent-threshold`

**Trigger**: Lambda function concurrent executions exceed threshold for 2 consecutive minutes

**Thresholds**:
- Generate: 50 concurrent
- All others: 20 concurrent

**Example Alert**:
```
Alarm: learnfyra-prod-submit-concurrent-threshold
Status: ALARM
Value: 23 concurrent executions (exceeded threshold of 20)
```

### Investigation Steps

#### Step 1: Check CloudWatch Dashboard
```
1. Open "learnfyra-prod-backend-observability" dashboard
2. Look at widget: "Critical Duration Profile (p50/p95/p99)"
3. Check if p95 or p99 duration is elevated for Submit function
4. Also check "Lambda Errors by Function (Top Trend)" widget
   - If error count up → errors are piling up (retry spike)
   - If error count normal → just high legitimate traffic
```

#### Step 2: Determine Cause
```
Cause Analysis:

IF Duration p95/p99 normal AND Errors normal:
  → Traffic spike is expected behavior
  → Action: Verify with product team; no action needed
  
IF Duration p95 > 1000ms:
  → Handler is slow; concurrent request queue building
  → Action: Check database latency or external API calls
  → Run: DOP-07 Query "high-latency-request-traces"
  
IF Errors spiking:
  → Handler crash/timeout; requests queuing for retry
  → Action: Check handler logs for exceptions
  → Run: DOP-07 Query "top-errors-by-function"
```

#### Step 3: Response

**If expected traffic spike**:
```
1. Verify concurrency is managed rate: ~invocations/rate
   concurrency = (invocations/min) / (duration_sec / 60)
   Example: 500 invites/min with 5s duration = ~42 concurrent
2. If within acceptable range, no action
3. Document if this is exam submission window, class creation, etc.
```

**If duration is elevated**:
```
1. Check CloudWatch X-Ray service map (prod only):
   - Open X-Ray console
   - Filter by Service "learnfyra-prod-lambda-submit"
   - Look at downstream calls (database, external APIs)
   - Are any services latent?
   
2. Check database connection pool:
   - Is there connection timeout?
   - Are too many concurrent connections being created?
   
3. If database is bottleneck:
   - Increase connection pool size
   - Enable read replicas if applicable
   - Page database admin
```

**If errors are spiking**:
```
1. Check handler error logs:
   - CloudWatch Logs console → /aws/lambda/learnfyra-prod-lambda-submit
   - Filter: @message like /error|exception/
   - Are all errors the same (same stack trace)?
   
2. If all same error:
   - Likely a deployment issue or external service failure
   - Check recent deployments (git log --oneline -n 20)
   - Check external service status (e.g., database)
   
3. If varied errors:
   - May be cascading failure or resource exhaustion
   - Proceed to "Learnfyra Debug Checklist" (Section 7)
```

---

## 3. API Throttle Detection Alarm: `api-throttle-detected`

**Trigger**: API Gateway request count exceeds 9,000 req/min (prod) or 3,000 req/min (dev)

**Interpretation**: Approaching 80% of estimated burst capacity

**Example Alert**:
```
Alarm: learnfyra-prod-api-throttle-detected
Status: ALARM
Value: 9,150 requests per minute over 5 minutes
```

### Investigation Steps

#### Step 1: Verify Traffic is Real
```
1. Open CloudWatch Dashboard
2. Look at "API Gateway Requests / 4XX / 5XX" widget
3. Are request count and 5XX errors both elevated?
   - YES → Throttling IS happening (requests being dropped)
   - NO → Traffic high but API responding normally
```

#### Step 2: Check API Health
```bash
# Run this query to find which route is consuming most requests:
# DOP-08 Query: "learnfyra-prod-cost-by-endpoint"

# Expected output:
# Route                    | Requests | 4XX | 5XX
# POST /api/generate       | 2,500    | 45  | 2
# POST /api/submit         | 3,100    | 120 | 8
# GET /api/progress/history| 2,450    | 30  | 1

# If ANY route has >1% 5XX rate → API is throttling responses
```

#### Step 3: Response Based on Root Cause

**If traffic is legitimate (e.g., class exam)**:
```
Action: No immediate intervention
Next steps:
1. Monitor for duration of event
2. If throttling continues >30 min, contact AWS support for rate limit increase
3. Document in: docs/operations/KNOWN_TRAFFIC_SPIKES
4. Plan capacity: If recurring, enable API caching or CDN edge Lambda
```

**If traffic source is unknown**:
```
Action: Investigate immediately
1. Check API access logs for source IPs:
   - Filter by 5XX responses
   - AWS CloudTrail or VPC Flow Logs
   
2. Check for DDoS signature:
   - Same source IP repeated?
   - Randomized endpoints?
   - If yes → Enable AWS Shield DDoS protection
   
3. Check for load test:
   - Coordinate with QA/ops teams
   - Verify schedule with on-call engineer
```

**If traffic is 4XX errors (client-side)**:
```
Action: Client issue, not a throttle
1. Check error logs: DOP-07 "4xx-5xx-route-hotspots" query
2. If mostly 400/401: Auth token issues (re-deploy, cache invalidation)
3. If mostly 404: Client calling wrong endpoint (coordinate with frontend team)
4. No action needed for throttle; monitor error rate
```

---

## 4. API Surge Detection Alarm: `api-surge-detected`

**Trigger**: >500 requests in 5 minutes (dev) or >10,000 req/5min (prod); indicates 2-3x normal spike

**Severity**: 🔴 HIGH — Possible DDoS or runaway process

**Example Alert**:
```
Alarm: learnfyra-prod-api-surge-detected
Status: ALARM
Value: 12,340 requests in 5-minute window
```

### Investigation Steps (Priority: FAST)

#### Step 1: Confirm Surge (< 2 minutes)
```
1. Check CloudWatch Dashboard "Daily Request Volume" widget
2. Is there a visible spike in the last 5 minutes?
3. Check API 5XX error count widget
   - If 5XX count normal → API handling surge (legitimate)
   - If 5XX count > 10 → API throttling / server errors
```

#### Step 2: Identify Source (< 3 minutes)
```
Run this query immediately:

# CloudWatch Logs Insights
# Log Group: /aws/apigateway/learnfyra-prod-access-logs

fields @timestamp, @json.ip, @json.routeKey, @json.status
| stats count() as hits by @json.ip, @json.routeKey
| sort hits desc
| limit 10

# Expected output:
IP          | Route              | Hits
203.0.113.X | POST /api/generate | 4,200
203.0.113.X | GET /api/solve/{id}| 3,100
203.0.113.X | POST /api/submit   | 2,045

# THIS IP IS FLOODING THE API!
```

#### Step 3: Quick Triage (< 5 minutes)
```
Decision Tree:

Q1: Is surge from single IP or multiple IPs?
  → Single IP: Likely compromised client or load test
  → Multiple IPs: Possible DDoS

Q2: Are all requests hitting the same route?
  → YES: Load test or bot targeting one endpoint
  → NO: Distributed attack or cascading client error

Q3: Check recent deployments (in last 30 minutes)?
  → YES: Deployment may have broken health check (infinite retry)
  → NO: Likely external attack
```

#### Step 4: Immediate Response

**If load test**:
```
1. Verify with ops/QA team immediately
2. If authorized: Monitor and allow to complete
3. If not authorized: See "Attack Detected" below
4. Set alarm to OK once surge ends
```

**If deployment error**:
```
1. Check recent git commits (git log -n 5)
2. Check deployment logs in GitHub Actions
3. If rollback needed:
   - Run: git revert [commit-id]
   - Push to develop (auto-deploy)
   - Verify in dev first before prod
```

**If DDoS attack detected**:
```
1. IMMEDIATE: Enable AWS WAF rules
   - Open AWS WAF console
   - Add rate-limiting rule: 2,000 req/5min per IP
   - Enable geo-blocking if surge is from unexpected region
   
2. ESCALATE: Page infrastructure lead
   - DDoS may require AWS Shield Advanced
   - Contact AWS Support immediately
   
3. MONITOR: Watch CloudWatch dashboard
   - If surge drops after WAF rule → DDoS confirmed
   - If surge persists → May be volumetric DDoS (need AWS Shield)
   
4. COMMUNICATE: Notify users if service affected
```

---

## 5. Cost Spike Alert (Custom AWS Budgets)

**Trigger**: Estimated monthly spend increased by >25% day-over-day

**Note**: Not yet implemented; placeholder for future DOP-09

---

## 6. General Debug Checklist

Use this checklist for **any** alarm that's unclear or multi-symptom:

### A. Check Recent Deployments
```bash
# Terminal command (has access to git repo)
git log --oneline -n 20 --all
# Check if any deploy was in last 30 minutes relative to alarm
# If yes, compare to production status: healthy/degraded
```

### B. Check All Correlated Alarms
```
1. Open CloudWatch Alarms console
2. Sort by "Last Updated" (newest first)
3. Are other alarms firing at the same time?
   Example:
   - submit-concurrent-threshold + submit-error-rate both HIGH
   → Submit handler crash, requests queuing
   
   - generate-invocation-anomaly + api-surge-detected
   → Mass worksheet export (intended or attack)
```

### C. Check Dashboard Widgets
```
1. Lambda Errors by Function: Any spikes?
2. API Requests / 4XX / 5XX: Error rate elevated?
3. Duration p95/p99: Any handler getting slow?
4. Log drill-down panels: Run queries in Section 5 of main doc
```

### D. Check Application Logs
```bash
# SSH to dev or query logs directly
# CloudWatch Logs console → /aws/lambda/{function-name}
# Filter: @message like /error|exception|timeout|fail/
# Look for repeated stack trace or error pattern
```

### E. Check External Dependencies
```
1. Database health:
   - EC2 console → RDS instance
   - Check CPU, connections, storage
   
2. External APIs (if applicable):
   - Anthropic API status: https://status.anthropic.com
   - AWS services: https://health.aws.amazon.com
   
3. Network connectivity:
   - VPC security groups: Are Lambda ingress rules correct?
   - NAT Gateway: Is IP quota exceeded?
```

### F. Ask Questions Before Escalating
```
[ ] Is this first time this alarm fired?
[ ] Was there a deployment in last 1 hour?
[ ] Is it a known scheduled event (exam, batch job)?
[ ] Are multiple services failing, or just one function?
[ ] Did error rate spike, or just invocation count?
[ ] Are customers reporting issues in Slack/email?
```

---

## 7. Escalation Path

### Level 1: Investigate (On-Call SHOULD handle)
```
Alarm Type: Anomaly Detection, Concurrent Execution, API Throttle
Time to Investigate: 15-30 minutes
If root cause is obvious: Resolve or document → Close ticket
```

### Level 2: Escalate to Backend Team Lead (If unkown after 15 min)
```
Context to provide:
- Which alarm fired
- Exact time it fired (UTC)
- Recent deployments (git log -n 5)
- CloudWatch query results (copy-paste from Logs Insights)
- Answer to Section 6 questions above

Example message:
"learnfyra-prod-submit-concurrent-threshold firing. 
 Deployed 12 min before alarm at 14:23 UTC.
 Errors normal but duration p95 = 3000ms (normal is 500ms).
 Database connections maxed? X-Ray traces show external API timeout."
```

### Level 3: Page Infrastructure Lead (If service degraded)
```
Triggers:
- API 5XX > 50/min for >10 minutes
- Cost spike > 2x normal (weekly)
- Multiple Lambda functions erroring
- Unable to identify root cause after 30 min

Severity: 🔴 SEV-1 (customer-facing outage)
Response SLA: 15 minutes
```

---

## 8. Post-Incident Review Template

After resolving any DOP-08 alarm, fill out this template:

```markdown
## Incident Report: [Alarm Name]
**Date**: [Date] [Time UTC]
**Duration**: [Minutes]
**Impact**: [None | Dev Only | Staging Affected | Prod Degraded | Prod Down]

### Root Cause
[Brief explanation]

### Timeline
- 14:23 UTC: Alarm fired
- 14:28 UTC: Root cause identified
- 14:32 UTC: Fix deployed / Mitigated
- 14:35 UTC: Monitoring confirms normal

### Resolution
[What was done to fix]

### Prevention
[What will prevent next time]

### Lessons Learned
[If applicable]
```

**Submit to**: `docs/operations/INCIDENTS.md`

---

## 9. Quick Commands Reference

### Check Lambda Function Errors
```bash
# CloudWatch Logs Insights query
# Log Group: /aws/lambda/learnfyra-{env}-lambda-{function}

fields @timestamp, @duration, @error, @message
| filter @error like //
| stats count() as errors by @error
| sort errors desc
```

### List All Active Alarms
```bash
# CloudWatch Alarms
# Filter: StateValue = ALARM
# Sort by LastUpdatedTime (newest first)
```

### Get Cost Estimate for Day
```bash
# CloudWatch query
# Metric: AWS/Lambda (Invocations) + AWS/Lambda (Duration)
# Period: 24 hours
# Estimate: (invocations × $0.20/1M + duration_hours × memory_gb × $0.0000166667)
```

### Test Anomaly Detection
```bash
# Generate synthetic traffic spike to test alarm:
# (Use caution in prod; test in dev first)

for i in {1..1000}; do
  aws lambda invoke \
    --function-name learnfyra-dev-lambda-test-spike \
    --payload '{}' \
    /dev/null &
done
wait

# Monitor: CloudWatch Dashboard "Daily Request Volume"
# Should see spike in 5 minutes
# Anomaly alarm should fire in ~10 minutes
```

---

## Contact & Escalation

| Role | Slack Handle | Email | Availability |
|---|---|---|---|
| **On-Call (Primary)** | @on-call-primary | on-call@learnfyra.io | 24/7 |
| **Backend Lead** | @backend-lead | backend-lead@learnfyra.io | Business hours + emergency |
| **DevOps Lead** | @devops-lead | devops@learnfyra.io | Business hours + emergency |
| **Incident Commander** | @ic-on-call | ic@learnfyra.io | SEV-1 only |
| **AWS Support (Prod)** | — | AWS Business Support | 24/7 (premium response) |

---

## Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-26 | DevOps Agent | Initial runbook for DOP-08 alarms |

---

## See Also
- [DOP-08: Cost/Anomaly and Throughput Visibility](./DOP-08_COST_ANOMALY_THROUGHPUT_VISIBILITY.md) — Alarm matrix and cost formulas
- [DOP-07: Log Analytics Query Pack](./DOP-07_LOG_ANALYTICS_QUERY_PACK.md) — Reusable Logs Insights queries
- [DOP-04: Monitoring Foundations](./PLATFORM_TECHNICAL_STATUS.md) — Baseline alarm setup
