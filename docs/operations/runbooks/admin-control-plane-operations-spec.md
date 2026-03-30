# Learnfyra Admin Control Plane — Operations & Deployment Specification
# File: docs/operations/runbooks/admin-control-plane-operations-spec.md
# Version: 1.0
# Date: 2026-03-24
# Status: Operational Runbook — Reference for DevOps/SRE teams

---

## Document Purpose

This document defines operational procedures, access controls, alerting strategies, and emergency response protocols for the Learnfyra admin control plane. This is NOT a code specification — it is an operational runbook for production operations teams.

**Audience**: DevOps Engineers, SRE, On-call Engineers, Security Team, Platform Owners

**Scope**: All production operational aspects of:
- Multi-provider AI model routing and configuration
- Secrets management across all provider APIs
- Environment isolation and access boundaries
- Change management and approval workflows
- Monitoring, alerting, and incident response
- Disaster recovery and business continuity

---

## Table of Contents

1. [Environment Isolation & Access Boundaries](#1-environment-isolation--access-boundaries)
2. [Change Management & Approval Flows](#2-change-management--approval-flows)
3. [Alerting, Dashboards & SLO/SLA Controls](#3-alerting-dashboards--slosla-controls)
4. [Emergency Procedures](#4-emergency-procedures)
5. [Secrets & Key Rotation](#5-secrets--key-rotation)
6. [Retention & Backup Strategy](#6-retention--backup-strategy)
7. [Runbook Quick Reference](#7-runbook-quick-reference)

---

## 1. Environment Isolation & Access Boundaries

### 1.1 Environment Architecture

Learnfyra operates three completely isolated environments:

| Environment | AWS Account | Purpose | Data Isolation | Secret Rotation |
|-------------|-------------|---------|----------------|-----------------|
| **dev** | 123456789012 | Developer testing, experimental models | Synthetic data only | Manual, on-demand |
| **staging** | 234567890123 | Pre-production validation, load testing | Anonymized production mirror | Monthly |
| **production** | 345678901234 | Live customer traffic | Real customer data, PII compliance | Weekly |

**Cross-Environment Rules**:
- No shared AWS resources between environments (separate VPCs, S3 buckets, Lambda functions)
- No secret sharing — each environment has unique API keys for all providers
- No data replication from production to lower environments
- IAM policies enforce explicit environment boundary (tag-based access control)

### 1.2 Access Control Matrix

#### Super Admin (Break-Glass Only)
**Who**: CTO, VP Engineering (max 2 people)  
**AWS IAM Role**: `learnfyra-super-admin`  
**Access**:
- ✅ Read/Write: All environments (dev, staging, production)
- ✅ Secrets Manager: Read all secrets, manual rotation override
- ✅ Production deployments: Can approve via GitHub protected environment
- ✅ Emergency actions: Can execute rollback, disable providers, modify SLAs
- ❌ **Restrictions**: All actions logged to separate audit bucket, cannot delete CloudWatch logs

**MFA Requirements**: Hardware MFA (YubiKey), session duration: 1 hour max

#### Operations Engineer (Day-to-Day)
**Who**: DevOps team, on-call engineers (4-6 people)  
**AWS IAM Role**: `learnfyra-ops-engineer`  
**Access**:
- ✅ Read/Write: dev, staging only
- ✅ Read-Only: production (CloudWatch, dashboards, S3 metadata)
- ✅ Secrets Manager: Read-only dev/staging, NO production access
- ✅ Emergency rollback: Can execute production rollback via pre-approved Lambda (audit trail auto-generated)
- ✅ GitHub Actions: Can trigger staging deploys, cannot trigger production
- ❌ **Restrictions**: Cannot approve own PRs, cannot modify IAM policies, cannot delete logs

**MFA Requirements**: Software MFA (Google Authenticator), session duration: 8 hours

#### Product Manager (Observability)
**Who**: Product leadership, data analysts (3-5 people)  
**AWS IAM Role**: `learnfyra-product-viewer`  
**Access**:
- ✅ Read-Only: CloudWatch dashboards (all environments)
- ✅ Read-Only: Cost Explorer (model spend by provider)
- ✅ Read-Only: X-Ray traces (performance analysis)
- ❌ **Restrictions**: No Lambda access, no S3 direct access, no secrets, no IAM console

**MFA Requirements**: Software MFA, session duration: 12 hours

#### Finance Reviewer (Cost Control)
**Who**: Finance team tracking AI spend (2 people)  
**AWS IAM Role**: `learnfyra-finance-viewer`  
**Access**:
- ✅ Read-Only: AWS Cost Explorer (all environments)
- ✅ Read-Only: CloudWatch cost metrics dashboard
- ✅ SNS subscription: Cost alert notifications
- ❌ **Restrictions**: No CloudWatch Logs access (may contain PII), no S3, no Lambda

**MFA Requirements**: Software MFA, session duration: 24 hours

#### Developer (No Production Access)
**Who**: Application developers (10-20 people)  
**AWS IAM Role**: `learnfyra-developer`  
**Access**:
- ✅ Read/Write: dev environment only (via GitHub Actions, not direct console)
- ✅ Read-Only: staging CloudWatch logs (for debugging)
- ✅ GitHub: Can open PRs, cannot merge to main/staging
- ❌ **Restrictions**: No AWS console access to any environment, no secrets access

**MFA Requirements**: GitHub 2FA only (no AWS console access)

### 1.3 Access Request Procedures

#### Requesting Production Read Access (one-time exception)
**Use Case**: Developer debugging production issue during incident

**Procedure**:
1. Developer opens Slack request in #learnfyra-ops: "Need prod logs access for [incident ticket]"
2. On-call Operations Engineer validates incident ticket exists
3. Ops Engineer grants temporary AWS session via `aws sts assume-role` (4-hour session max)
4. Ops Engineer posts session credentials in private Slack DM (auto-expire in 4h)
5. After resolution, Ops Engineer revokes session via `aws sts revoke-session`
6. Audit log auto-generated: who accessed, when, what resources, incident ticket reference

**SLA**: Grant within 15 minutes during business hours, 30 minutes off-hours

#### Requesting Production Write Access (never granted)
**Policy**: Production write access is NEVER granted to individuals.

**Alternative**: All production changes via GitHub PRs → approval workflow → automated deployment.

#### Break-Glass Access (Super Admin only)
**Use Case**: Operations Engineer unavailable during P0 incident, immediate rollback needed

**Procedure**:
1. Super Admin acknowledges automated PagerDuty escalation
2. Super Admin assumes `learnfyra-super-admin` role (hardware MFA required)
3. Super Admin executes emergency action (rollback, provider disable)
4. Super Admin MUST post incident report in #learnfyra-incidents within 4 hours
5. Incident report includes: timeline, root cause, actions taken, preventive measures
6. Audit trail forwarded to security team for review

**Post-Incident**: Security team reviews audit logs within 24 hours, confirms no policy violations.

### 1.4 IAM Policy Enforcement

#### Tag-Based Access Control
All AWS resources tagged:
```json
{
  "Project": "learnfyra",
  "Environment": "production",
  "DataClassification": "confidential",
  "CostCenter": "ai-operations",
  "ManagedBy": "github-actions"
}
```

**IAM Policy Enforcement**:
```json
{
  "Effect": "Deny",
  "Action": "*",
  "Resource": "*",
  "Condition": {
    "StringNotEquals": {
      "aws:PrincipalTag/Environment": "${aws:ResourceTag/Environment}"
    }
  }
}
```
This prevents dev-role users from accessing staging/production resources even with ARN.

#### Service Control Policies (Organization Level)
- Production account: Deny region us-west-1, eu-west-1 (cost optimization, single region deployment)
- All accounts: Deny S3 public access (force presigned URLs only)
- All accounts: Deny disabling CloudTrail
- Production: Deny Lambda function deletion (prevent accidental deletion)

### 1.5 Network Isolation

| Environment | VPC CIDR | Lambda Subnets | S3 VPC Endpoint | Internet Egress |
|-------------|----------|----------------|-----------------|-----------------|
| dev | 10.0.0.0/16 | 10.0.1.0/24 | ✅ Yes | NAT Gateway (single AZ) |
| staging | 10.1.0.0/16 | 10.1.1.0/24, 10.1.2.0/24 | ✅ Yes | NAT Gateway (multi-AZ) |
| production | 10.2.0.0/16 | 10.2.1.0/24, 10.2.2.0/24, 10.2.3.0/24 | ✅ Yes | NAT Gateway (multi-AZ) |

**Security Groups**:
- Lambda functions: Outbound HTTPS (443) only to API endpoints (Anthropic, OpenAI, Google AI)
- No inbound rules (Lambda triggered via API Gateway, not direct)

**VPC Flow Logs**: Enabled on production VPC, retained 90 days, exported to S3 for SIEM.

---

## 2. Change Management & Approval Flows

### 2.1 Change Classification

| Change Type | Approval Required | Deployment Method | Rollback SLA | Examples |
|-------------|-------------------|-------------------|--------------|----------|
| **P0 - Emergency** | Post-approval within 4h | Manual via AWS CLI | Immediate | Provider outage failover, critical security patch |
| **P1 - High Risk** | Pre-approval (Super Admin) | GitHub Actions with manual gate | < 5 min | Production model swap, new provider enablement |
| **P2 - Medium Risk** | Pre-approval (Ops Engineer) | GitHub Actions automated | < 15 min | Model parameter tuning, cost threshold adjustments |
| **P3 - Low Risk** | Code review only | GitHub Actions automated | < 30 min | Dashboard updates, alert threshold tweaks |
| **P4 - No Impact** | None | GitHub Actions automated | N/A | Documentation updates, dev-only config changes |

### 2.2 Standard Change Approval Flow

#### P1 High-Risk Change: Production Model Configuration
**Scenario**: Switching from Claude Sonnet 4 to Claude Opus in production

**Workflow**:
```
┌────────────────────────────────────────────────────────────────────────┐
│ Day 1: Planning Phase                                                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Ops Engineer creates GitHub Issue:                                 │
│    Title: "Switch production to Claude Opus for cost optimization"    │
│    Labels: change-request, P1-high-risk, production                   │
│    Body includes:                                                      │
│      - Business justification (cost savings estimate)                 │
│      - Risk assessment (latency impact, quality impact)               │
│      - Testing evidence (staging test results with metrics)           │
│      - Rollback plan (revert to Sonnet 4 within 5 min)               │
│      - Success criteria (error rate < 1%, p99 latency < 15s)         │
│                                                                        │
│ 2. Ops Engineer opens draft PR against `main` branch:                 │
│    Files changed: infra/config/model-config-prod.json                 │
│    PR description references GitHub Issue                             │
│    PR marked as DRAFT (not ready for merge)                           │
│                                                                        │
│ 3. Automated review checks run:                                       │
│    ✅ JSON schema validation passes                                   │
│    ✅ Secret ARN exists in Secrets Manager                            │
│    ✅ Model version string format valid                               │
│    ⚠️  Cost estimate: +$120/day vs current model                      │
│    ⚠️  Requires 2 approvals (P1 change detected)                      │
│                                                                        │
│ 4. Ops Engineer shares PR + Issue in #learnfyra-changes Slack channel │
│    Super Admin tagged for approval                                    │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Day 2-3: Testing Phase (Staging)                                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Ops Engineer deploys identical change to staging first             │
│    Command: GitHub Actions → Deploy to Staging (auto-merge to staging)│
│                                                                        │
│ 2. Staging runs with new model for 48 hours minimum                   │
│    Monitoring: CloudWatch dashboard "Model Performance"               │
│      - Error rate: 0.05% (baseline: 0.03%, acceptable)                │
│      - P99 latency: 12.3s (baseline: 11.8s, acceptable)               │
│      - Cost: $8.20/day (baseline: $6.50/day, acceptable)              │
│      - Quality: Manual review of 50 generated worksheets (no issues)  │
│                                                                        │
│ 3. Ops Engineer updates PR with staging results                       │
│    Comment: "Staging validation complete, metrics attached"           │
│    PR moved from DRAFT to READY FOR REVIEW                            │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Day 4: Approval & Deployment                                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Super Admin reviews PR + staging metrics                           │
│    Decision matrix:                                                    │
│      ✅ Business value clear (cost savings)                           │
│      ✅ Staging validation passed (48h stable)                        │
│      ✅ Rollback plan verified (tested in staging)                    │
│      ✅ Success criteria defined and automated                        │
│    → Super Admin approves PR with comment: "Approved for production"  │
│                                                                        │
│ 2. GitHub Actions workflow detects approval:                          │
│    Production Deploy workflow → requires-approval gate                │
│    Super Admin clicks "Approve Deployment" button in GitHub UI        │
│                                                                        │
│ 3. Deployment executes (automated):                                   │
│    a. Upload new model-config-prod.json to Parameter Store            │
│    b. Trigger canary deployment (5% of traffic for 15 minutes)        │
│    c. Monitor canary metrics (error rate, latency, cost)              │
│    d. If canary passes: ramp to 50% for 30 minutes                    │
│    e. If 50% passes: ramp to 100%                                     │
│    f. If any stage fails: automatic rollback to previous config       │
│                                                                        │
│ 4. Post-deployment monitoring (first 2 hours):                        │
│    Ops Engineer watches dashboard live:                               │
│      - PagerDuty alert set to P1 if error rate > 1.5%                 │
│      - Slack notifications every 15 min with metric summary           │
│      - CloudWatch Insights queries for error analysis                 │
│                                                                        │
│ 5. Success confirmation:                                              │
│    After 2 hours stable:                                              │
│      - Ops Engineer posts in #learnfyra-changes: "Deployment SUCCESS" │
│      - GitHub Issue closed with "deployed to production" label        │
│      - Runbook updated if any lessons learned                         │
└────────────────────────────────────────────────────────────────────────┘
```

#### GitHub Branch Strategy for Changes
```
main         → production   (protected, requires 2 approvals + CI passing)
staging      → staging env  (protected, requires 1 approval + CI passing)
develop      → dev env      (open, auto-deploy on push)
feature/*    → dev env      (CI tests only, no auto-deploy)
hotfix/*     → all (emergency, skip staging if P0)
```

### 2.3 Emergency Change Procedure (P0)

**Trigger Conditions**:
- Production provider complete outage (HTTP 5xx rate > 50% for 5+ minutes)
- Security vulnerability disclosed (CVE affecting model provider SDK)
- Cost spike exceeding 3x normal rate (potential abuse or API key leak)
- P99 latency exceeding SLA (> 30s for > 10 minutes)

**Emergency Failover Workflow**:
```bash
# Executed by on-call Ops Engineer or Super Admin
# From laptop with AWS CLI configured + MFA authenticated

# Step 1: Verify production incident (do not assume)
aws cloudwatch get-metric-statistics \
  --namespace Learnfyra/Production \
  --metric-name ModelErrorRate \
  --dimensions Name=Provider,Value=anthropic \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average

# If error rate > 50%, proceed with emergency failover

# Step 2: Update active provider to failover (OpenAI)
aws ssm put-parameter \
  --name /learnfyra/production/model-config \
  --value file://emergency-failover-config.json \
  --overwrite \
  --type String \
  --tags Key=ChangeType,Value=P0-Emergency Key=ExecutedBy,Value=$(whoami)

# emergency-failover-config.json content:
# {
#   "activeProvider": "openai",
#   "emergencyMode": true,
#   "rollbackConfig": {
#     "previousProvider": "anthropic",
#     "automaticRollbackAfter": "2h"
#   }
# }

# Step 3: Invalidate Lambda environment cache (force config reload)
aws lambda update-function-configuration \
  --function-name learnfyra-generate-production \
  --environment Variables={FORCE_CONFIG_RELOAD=true}

# Step 4: Verify failover success (monitor next 5 minutes)
watch -n 10 'aws cloudwatch get-metric-statistics \
  --namespace Learnfyra/Production \
  --metric-name ModelSuccessRate \
  --dimensions Name=Provider,Value=openai \
  --start-time $(date -u -d "5 minutes ago" +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average'

# Step 5: Post incident report within 4 hours
# Required fields:
#   - Incident start time
#   - Detection method (automated alert vs manual discovery)
#   - Root cause (provider outage, configuration error, etc.)
#   - Mitigation steps taken
#   - Rollback plan if needed
#   - Preventive measures (update runbook, add monitoring, etc.)
```

**Post-Emergency Actions** (within 24 hours):
1. **Incident Report**: Ops Engineer writes detailed postmortem in GitHub Issue
2. **Root Cause Analysis**: Why did primary provider fail? Provider status page check.
3. **Rollback Decision**: If primary provider restored, plan rollback during low-traffic window
4. **Runbook Update**: Add lessons learned, update emergency procedures
5. **Alerting Tuning**: Adjust thresholds if false positive or late detection

### 2.4 Rollback Procedures

#### Automated Rollback (Canary Deployment Failure)
**Trigger**: Canary stage detects error rate > 2% or p99 latency > 20s

**Automated Actions**:
1. GitHub Actions workflow detects health check failure
2. Workflow executes Parameter Store update: revert to previous config version
3. Workflow posts Slack notification: "Production deployment rolled back automatically"
4. Workflow creates GitHub Issue: "Investigate deployment failure" with logs attached
5. On-call engineer paged via PagerDuty (P2 severity)

**Timeline**: Rollback completes within 30 seconds of detection

#### Manual Rollback (Post-Deployment Issue)
**Scenario**: Deployment completed successfully, but quality degradation detected 4 hours later

**Procedure**:
```bash
# Step 1: Get previous Parameter Store version
aws ssm get-parameter-history \
  --name /learnfyra/production/model-config \
  --max-results 5

# Output shows version history:
# Version 12: 2026-03-24 14:30 UTC (current, problematic)
# Version 11: 2026-03-23 09:15 UTC (previous stable)

# Step 2: Rollback to version 11
aws ssm put-parameter \
  --name /learnfyra/production/model-config \
  --value "$(aws ssm get-parameter --name /learnfyra/production/model-config --version 11 --query Parameter.Value --output text)" \
  --overwrite \
  --type String \
  --tags Key=ChangeType,Value=ManualRollback Key=RollbackReason,Value="Quality degradation" Key=ExecutedBy,Value=$(whoami)

# Step 3: Force Lambda config reload (same as emergency failover)
aws lambda update-function-configuration \
  --function-name learnfyra-generate-production \
  --environment Variables={FORCE_CONFIG_RELOAD=true}

# Step 4: Verify rollback (check metrics for 5 minutes)
# Monitor CloudWatch dashboard for error rate normalization

# Step 5: Document rollback in GitHub
# Update original deployment PR with comment:
# "Rolled back at [timestamp] due to [reason]. Metrics: [before/after comparison]"
```

**SLA**: Manual rollback completes within 5 minutes of decision to rollback.

### 2.5 Change Freeze Windows

**Scheduled Freeze Periods** (no production changes allowed):
- **End of Quarter**: Last 3 business days (finance close)
- **Holiday Weeks**: US Thanksgiving week, Dec 20 - Jan 2
- **Major Events**: During known high-traffic events (back-to-school season: Aug 15-30)

**Emergency-Only Changes During Freeze**:
- Security patches (CVE with CVSS > 7.0)
- Provider outages requiring failover
- Critical bug fixes affecting > 10% of users

**Freeze Override**: Requires Super Admin approval + incident ticket

---

## 3. Alerting, Dashboards & SLO/SLA Controls

### 3.1 Service Level Objectives (SLOs)

#### Production SLOs (Customer-Facing)

| Metric | SLO Target | Measurement Window | Breach Action |
|--------|------------|-------------------|---------------|
| **Availability** | 99.5% | Rolling 30 days | P1 incident if < 99%, P0 if < 98% |
| **Worksheet Generation Success Rate** | 98% | Hourly | Alert if < 95% for 2 consecutive hours |
| **P95 Latency** | < 15 seconds | Every 5 minutes | Warning if > 15s, critical if > 30s |
| **P99 Latency** | < 30 seconds | Every 5 minutes | Alert if > 30s for 10+ minutes |
| **Error Budget** | 0.5% (1% - 0.5% SLO breach) | Rolling 30 days | Freeze new features if budget exhausted |

#### Model Provider SLOs (Internal)

| Provider | Availability SLO | Latency SLO (P95) | Cost SLO | Failover Threshold |
|----------|------------------|-------------------|----------|-------------------|
| Anthropic Claude | 99.9% | < 12s | $0.015/request | Error rate > 5% for 5 min |
| OpenAI GPT-4 | 99.5% | < 10s | $0.012/request | Error rate > 5% for 5 min |
| Google Gemini | 99.0% | < 15s | $0.008/request | Error rate > 10% for 5 min |

**Failover Logic**:
- If primary provider breaches SLO, automatically failover to secondary (OpenAI)
- If secondary also fails, failover to tertiary (Google)
- If all providers fail, return HTTP 503 with retry-after header

### 3.2 CloudWatch Dashboards

#### Dashboard 1: Production Health Overview
**Audience**: Ops Engineer, Product Manager  
**Refresh**: Real-time (auto-refresh 30s)  
**Widgets**:
1. **Top Row - Critical Metrics**:
   - Request volume (requests/min, last 1 hour line chart)
   - Success rate (%, last 1 hour line chart with 98% threshold line)
   - P95/P99 latency (seconds, last 1 hour line chart with SLO thresholds)
   - Error rate by HTTP status code (pie chart, last 1 hour)

2. **Middle Row - Provider Breakdown**:
   - Active provider pie chart (% of requests by provider)
   - Provider latency comparison (bar chart, all providers side-by-side)
   - Provider error rate (line chart, last 24 hours)
   - Provider cost per request (bar chart, last 24 hours)

3. **Bottom Row - Resource Utilization**:
   - Lambda concurrent executions (line chart, last 1 hour)
   - Lambda duration (P50/P95/P99, last 1 hour)
   - Lambda memory usage (MB, last 1 hour)
   - Lambda throttles (count, last 1 hour — should always be zero)

**Access**: 
- Direct link: `https://console.aws.amazon.com/cloudwatch/dashboards/learnfyra-production-health`
- Shared as TV display in ops room (read-only)
- Exported as PNG snapshot every 1 hour to S3 for audit trail

#### Dashboard 2: Cost & Economics
**Audience**: Finance Reviewer, Product Manager, Super Admin  
**Refresh**: Every 15 minutes  
**Widgets**:
1. **Daily Cost Trends** (last 30 days line chart):
   - Total model API costs
   - Cost by provider (stacked area chart)
   - Cost per successful worksheet ($/worksheet)

2. **Cost Breakdown** (current month pie chart):
   - Model API costs (Anthropic, OpenAI, Google)
   - AWS infrastructure costs (Lambda, S3, CloudFront)
   - Data transfer costs

3. **Cost Alerts Status**:
   - Current hourly spend vs. threshold (gauge widget)
   - Daily spend vs. budget (progress bar)
   - Projected monthly spend (number with forecast)

4. **Cost Efficiency**:
   - Cost per successful request by provider (bar chart)
   - Failed request cost waste (pie chart, last 7 days)
   - Savings from caching (if implemented, estimated $)

**Access**:
- Finance team: read-only via IAM role
- Exported to CSV daily, emailed to finance@learnfyra.com

#### Dashboard 3: Model Performance & Quality
**Audience**: Product Manager, Ops Engineer  
**Refresh**: Every 5 minutes  
**Widgets**:
1. **Generation Metrics** (last 24 hours):
   - Total worksheets generated (count)
   - Average generation time (seconds)
   - Retry rate (% of requests requiring retry)

2. **Quality Proxies** (requires manual validation):
   - Average worksheet length (character count — proxy for completeness)
   - Question count distribution (histogram)
   - Model temperature variance (if configured)

3. **User Impact** (last 7 days):
   - Worksheet download rate (completed generations → downloads)
   - Failed generation reasons (pie chart: timeout, invalid response, rate limit)

**Access**: Product team read-only, exported weekly to data warehouse

### 3.3 CloudWatch Alarms

#### Critical Alarms (P0 - Immediate Page)

| Alarm Name | Metric | Threshold | Evaluation Period | Action |
|------------|--------|-----------|-------------------|--------|
| **ProductionDown** | HealthCheckFailure | >= 3 failures | 3 consecutive minutes | Page on-call + Slack #learnfyra-critical |
| **HighErrorRate** | HTTP 5xx rate | >= 5% | 5 out of 5 minutes | Page on-call + auto-failover to secondary provider |
| **AllProvidersDown** | All provider error rates | >= 50% | 3 out of 5 minutes | Page Super Admin + Slack #learnfyra-critical |
| **SecretAccessFailure** | Secrets Manager access errors | >= 1 error | 1 minute | Page Super Admin (potential key rotation issue) |
| **AbnormalCostSpike** | Hourly cost | >= 3x baseline | 2 consecutive data points | Page on-call + disable new request acceptance |

**PagerDuty Escalation**:
- P0 alarms → immediate SMS + phone call to on-call engineer
- If no acknowledgment within 5 minutes → escalate to Super Admin
- If no acknowledgment within 10 minutes → escalate to CTO

#### Warning Alarms (P1 - Slack Notification)

| Alarm Name | Metric | Threshold | Evaluation Period | Action |
|------------|--------|-----------|-------------------|--------|
| **LatencySLOBreach** | P99 latency | >= 30s | 10 out of 15 minutes | Slack #learnfyra-ops + create GitHub Issue |
| **ProviderDegraded** | Single provider error rate | >= 2% | 5 out of 10 minutes | Slack notification + monitor for failover |
| **LambdaThrottle** | Lambda throttle count | >= 10 | 5 minutes | Slack + investigate concurrency limits |
| **HighMemoryUsage** | Lambda memory usage | >= 90% | 3 out of 5 minutes | Slack + consider memory increase |
| **CostThresholdWarning** | Hourly cost | >= 1.5x baseline | 1 hour | Slack #learnfyra-ops + finance notification |

#### Informational Alarms (P2 - Slack Only, No Page)

| Alarm Name | Metric | Threshold | Evaluation Period | Action |
|------------|--------|-----------|-------------------|--------|
| **CanaryDeploymentComplete** | Canary success | 100% after 15 min | N/A | Slack #learnfyra-changes "Canary passed" |
| **SecretRotationComplete** | Secrets Manager rotation | Success | N/A | Slack #learnfyra-ops + audit log entry |
| **DailyHealthReport** | N/A (scheduled) | N/A | Daily at 9 AM UTC | Slack #learnfyra-daily with metrics summary |
| **MonthlyErrorBudget** | Error budget remaining | < 25% | End of month | Slack + feature freeze recommendation |

### 3.4 Service Level Agreements (SLAs) — Customer Commitments

#### Public SLA (Documented in Terms of Service)

| Service | Uptime Commitment | Monthly Credit |
|---------|-------------------|----------------|
| Worksheet Generation API | 99.5% | 10% credit if < 99.5%, 25% if < 99% |
| Worksheet Download (presigned URLs) | 99.9% | 10% credit if < 99.9% |
| Web Frontend (CloudFront) | 99.9% | No credit (AWS SLA pass-through) |

**Exclusions**:
- Scheduled maintenance (announced 48h in advance, max 2h/month)
- Force majeure (AWS region outage, natural disaster)
- Customer-side issues (invalid API auth, malformed requests)
- Abuse or excessive usage (> 1000 requests/hour from single user)

**Credit Claiming Process**:
1. Customer emails support@learnfyra.com with SLA breach claim
2. Support team validates with CloudWatch historical data
3. Credit applied to next invoice within 5 business days
4. Credits capped at 100% of monthly fee (no cash refunds)

#### Internal SLA (Incident Response Times)

| Severity | Response Time | Resolution Time | Escalation |
|----------|---------------|-----------------|------------|
| **P0 - Service Down** | 5 minutes | 1 hour (mitigation), 24 hours (root cause fix) | Immediate page to on-call |
| **P1 - Degraded Service** | 15 minutes | 4 hours (mitigation), 48 hours (permanent fix) | Slack + PagerDuty low-urgency |
| **P2 - Minor Issue** | 2 hours | 1 week | GitHub Issue, no page |
| **P3 - Enhancement** | 1 week | Best effort | Backlog grooming |

---

## 4. Emergency Procedures

### 4.1 Provider-Specific Outage Response

#### Scenario 1: Anthropic Complete Outage
**Detection**: CloudWatch alarm "AnthropicProviderDown" fires (error rate > 50% for 5 minutes)

**Immediate Response (0-5 minutes)**:
```bash
# Executed by on-call engineer via runbook automation
# Automated script: /opt/learnfyra/scripts/emergency-failover-anthropic.sh

#!/bin/bash
set -e

echo "[$(date)] Starting emergency failover from Anthropic to OpenAI"

# Step 1: Verify OpenAI health before failover
OPENAI_HEALTH=$(curl -s https://status.openai.com/api/v2/status.json | jq -r '.status.indicator')
if [ "$OPENAI_HEALTH" != "none" ]; then
  echo "WARNING: OpenAI also showing issues. Proceeding with caution."
fi

# Step 2: Update Parameter Store to switch to OpenAI
aws ssm put-parameter \
  --name /learnfyra/production/model-config \
  --value '{
    "activeProvider": "openai",
    "emergencyMode": true,
    "reason": "Anthropic provider outage detected",
    "fallbackProvider": "google"
  }' \
  --overwrite

# Step 3: Force Lambda config reload
aws lambda update-function-configuration \
  --function-name learnfyra-generate-production \
  --environment Variables={CONFIG_VERSION=$(date +%s)}

# Step 4: Notify team
curl -X POST $SLACK_WEBHOOK_URL -d '{
  "text": ":warning: EMERGENCY FAILOVER: Switched from Anthropic to OpenAI due to provider outage",
  "channel": "#learnfyra-critical"
}'

echo "[$(date)] Failover complete. Monitor dashboard for next 15 minutes."
```

**Monitoring Phase (5-20 minutes)**:
- Watch CloudWatch dashboard: "ModelSuccessRate" for OpenAI provider
- Expected: Error rate drops to < 1% within 2 minutes
- If OpenAI also failing: escalate to Scenario 3 (all providers down)

**Root Cause Validation**:
- Check Anthropic status page: https://status.anthropic.com
- Check X/Twitter: @AnthropicAI for incident announcements
- Check Anthropic Dashboard: review quota/billing status (ensure account not suspended)

**Recovery Planning**:
- If Anthropic restored within 1 hour: plan rollback during low-traffic window (3-5 AM UTC)
- If Anthropic down > 4 hours: OpenAI becomes primary, monitor costs (OpenAI typically 15% cheaper)
- Update incident timeline in #learnfyra-incidents Slack channel

#### Scenario 2: Gradual Service Degradation (P99 Latency Climbing)
**Detection**: P99 latency alarm fires (> 30s for 10+ minutes), but error rate still < 1%

**Diagnosis Phase (0-10 minutes)**:
```bash
# Step 1: Check if issue is provider-side or Lambda-side
aws cloudwatch get-metric-statistics \
  --namespace Learnfyra/Production \
  --metric-name ModelAPILatency \
  --dimensions Name=Provider,Value=anthropic Name=Operation,Value=generate \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Maximum,Average

# If ModelAPILatency is high: provider-side issue (downstream latency)
# If ModelAPILatency is normal but total latency high: Lambda issue (cold starts, memory)

# Step 2: Check Lambda cold start rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ColdStartCount \
  --dimensions Name=FunctionName,Value=learnfyra-generate-production \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Step 3: Check Lambda concurrency (throttling can cause queueing latency)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ConcurrentExecutions \
  --dimensions Name=FunctionName,Value=learnfyra-generate-production \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Maximum
```

**Mitigation Actions**:
- **If provider latency**: Switch to faster provider (OpenAI typically 30% faster than Anthropic)
- **If Lambda cold starts**: Increase provisioned concurrency (warm pool of Lambda instances)
- **If Lambda throttling**: Increase reserved concurrency limit (contact AWS support if at account limit)
- **If Lambda memory/CPU bound**: Increase memory allocation (1024MB → 2048MB, costs 2x but may be faster)

**Immediate Fix** (if provider latency):
```bash
# Switch to OpenAI for 2 hours, then re-evaluate
aws ssm put-parameter \
  --name /learnfyra/production/model-config \
  --value '{
    "activeProvider": "openai",
    "reason": "Temporary latency mitigation - Anthropic degraded",
    "automaticRollbackAfter": "2h"
  }' \
  --overwrite
```

#### Scenario 3: All Providers Simultaneously Down
**Detection**: CloudWatch alarm "AllProvidersDown" fires

**This is a black swan event. Possible causes**:
- AWS region outage (us-east-1 where Lambda runs)
- Internet connectivity issue from Lambda VPC
- DDoS attack on Learnfyra infrastructure
- Secrets Manager outage (cannot retrieve API keys)

**Emergency Response**:
```bash
# Step 1: Verify AWS service health
aws health describe-events \
  --filter eventTypeCategories=issue \
  --max-results 10

# Step 2: If AWS region issue, failover to disaster recovery region
# (Requires pre-configured multi-region setup — see Section 6.3)

# Step 3: If not AWS issue, enable graceful degradation mode
aws ssm put-parameter \
  --name /learnfyra/production/model-config \
  --value '{
    "gracefulDegradation": true,
    "returnCachedResults": true,
    "errorMessage": "AI generation temporarily unavailable. We are working to restore service."
  }' \
  --overwrite

# Step 4: Update status page
curl -X POST https://api.statuspage.io/v1/pages/$STATUSPAGE_ID/incidents \
  -H "Authorization: OAuth $STATUSPAGE_TOKEN" \
  -d '{
    "incident": {
      "name": "Worksheet generation service degraded",
      "status": "investigating",
      "impact_override": "major",
      "body": "We are investigating issues with worksheet generation. Other services remain operational."
    }
  }'
```

**Communication Plan**:
- **T+0 minutes**: Automated Slack notification to #learnfyra-critical
- **T+5 minutes**: Super Admin posts status in #general: "We are aware of service issues and investigating"
- **T+15 minutes**: Update public status page (status.learnfyra.com) with investigation status
- **T+30 minutes**: If still unresolved, email blast to all active users: "Service degradation notice"
- **T+1 hour**: If still unresolved, consider enabling maintenance mode (return HTTP 503 with retry-after)

### 4.2 Abuse Detection & Mitigation

#### Scenario: API Key Leaked, Excessive Usage Detected
**Detection**: CloudWatch alarm "AbnormalCostSpike" fires (hourly cost 3x baseline)

**Automated Rate Limiting** (API Gateway level):
```json
{
  "burstLimit": 1000,
  "rateLimit": 100,
  "quotaLimit": 10000,
  "quotaPeriod": "DAY"
}
```
This limits any single API consumer to 10,000 requests/day, preventing runaway abuse.

**Manual Investigation**:
```bash
# Step 1: Identify abusive IP addresses or API keys
aws logs insights query \
  --log-group-name /aws/lambda/learnfyra-generate-production \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, requestId, sourceIP, apiKey
    | stats count() by sourceIP
    | sort count desc
    | limit 20'

# Step 2: Block abusive IPs at WAF level
aws wafv2 update-ip-set \
  --name learnfyra-blocked-ips \
  --scope CLOUDFRONT \
  --id $WAF_IP_SET_ID \
  --addresses 203.0.113.45/32 # example abusive IP

# Step 3: Rotate compromised API key immediately
# (See Section 5.2 for emergency key rotation procedure)
```

**Cost Mitigation**:
- If cost spike is legitimate (viral traffic): increase budget, notify finance
- If cost spike is abuse: block offending sources, file abuse report with authorities if criminal
- If API key leaked on GitHub: notify GitHub Security to remove, rotate key, enable GitHub secret scanning

### 4.3 Data Breach Response

**Scenario**: Unauthorized access to production S3 bucket detected

**Immediate Containment** (within 15 minutes):
```bash
# Step 1: Disable all public access (should already be blocked by IAM, but confirm)
aws s3api put-public-access-block \
  --bucket learnfyra-production-worksheets \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Step 2: Revoke all active presigned URLs (set expiration to past)
# (Requires application code change to track presigned URLs and invalidate them)

# Step 3: Enable MFA delete on S3 bucket (prevent unauthorized deletion)
aws s3api put-bucket-versioning \
  --bucket learnfyra-production-worksheets \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "$MFA_DEVICE_ARN $MFA_CODE"

# Step 4: Review CloudTrail logs for unauthorized access
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=learnfyra-production-worksheets \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 1000 \
  > breach-investigation-cloudtrail.json
```

**Legal & Compliance** (within 72 hours per GDPR):
1. **Notify Data Protection Officer** (if EU users affected)
2. **Assess data exposed**: Worksheet content typically does not contain PII, but verify
3. **Notify affected users** (if PII like student names were stored in worksheets)
4. **File breach report**: With relevant authorities (FTC in US, ICO in UK, etc.)
5. **Forensic analysis**: Engage third-party security firm to investigate root cause

**Preventive Measures**:
- Enable S3 Object Lock (WORM compliance mode) on production bucket
- Enable GuardDuty for automated threat detection
- Implement S3 Access Logging with SIEM analysis
- Require MFA for all Super Admin AWS console access

---

## 5. Secrets & Key Rotation

### 5.1 Secrets Inventory

| Secret Name | AWS Secrets Manager ARN | Contains | Rotation Frequency | Used By |
|-------------|-------------------------|----------|-------------------|---------|
| `learnfyra/production/anthropic-key` | arn:aws:...:secret:anthropic-key-abc123 | Anthropic API key | Weekly (automated) | Lambda: learnfyra-generate |
| `learnfyra/production/openai-key` | arn:aws:...:secret:openai-key-def456 | OpenAI API key | Weekly (automated) | Lambda: learnfyra-generate |
| `learnfyra/production/google-ai-key` | arn:aws:...:secret:google-ai-key-ghi789 | Google AI API key | Weekly (automated) | Lambda: learnfyra-generate |
| `learnfyra/production/github-token` | arn:aws:...:secret:github-token-jkl012 | GitHub Actions deploy token | Monthly (manual) | GitHub Actions workflows |
| `learnfyra/production/slack-webhook` | arn:aws:...:secret:slack-webhook-mno345 | Slack alert webhook URL | Yearly (manual) | Lambda: CloudWatch alarm handler |
| `learnfyra/production/pagerduty-key` | arn:aws:...:secret:pagerduty-key-pqr678 | PagerDuty integration key | Yearly (manual) | CloudWatch alarm actions |

**Staging & Dev Secrets**: Separate Secrets Manager entries, completely isolated from production.

### 5.2 Automated Key Rotation — Provider API Keys

#### Rotation Schedule
- **Production**: Every 7 days (Sunday 2 AM UTC during lowest traffic)
- **Staging**: Every 30 days (first Monday of month)
- **Dev**: Manual on-demand only

#### Rotation Workflow (Automated via Lambda)
```yaml
# Lambda function: learnfyra-secret-rotator
# Triggered by: CloudWatch Events (cron schedule)
# IAM Role: Can read/write Secrets Manager, update Lambda env vars

Rotation Steps:
  1. Generate new API key via provider dashboard API
  2. Store new key in Secrets Manager as "pending" version
  3. Update Lambda environment variables to reference new key version
  4. Test new key with 10 sample requests
  5. If test passes: mark new key as "current", delete old key version after 24h grace period
  6. If test fails: rollback to old key, alert Ops Engineer, retry after 1 hour
```

**Critical Rule**: Old key must remain valid for 24 hours after rotation to allow in-flight requests to complete.

#### Manual Emergency Rotation (Compromised Key)
```bash
# Execute immediately upon discovery of key leak

# Step 1: Generate new API key from provider dashboard
# - Anthropic: https://console.anthropic.com/settings/keys
# - OpenAI: https://platform.openai.com/api-keys
# - Google: https://console.cloud.google.com/apis/credentials

# Step 2: Store new key in Secrets Manager (overwrites immediately)
aws secretsmanager put-secret-value \
  --secret-id learnfyra/production/anthropic-key \
  --secret-string "$NEW_API_KEY" \
  --version-stages AWSCURRENT

# Step 3: Delete compromised key from provider dashboard
# (Do NOT wait 24h grace period if key is actively being abused)

# Step 4: Force Lambda environment reload
aws lambda update-function-configuration \
  --function-name learnfyra-generate-production \
  --environment Variables={SECRET_VERSION=$(date +%s)}

# Step 5: Monitor for errors (compromised key may still be cached)
aws logs tail /aws/lambda/learnfyra-generate-production --follow

# Step 6: Document rotation in incident log
echo "$(date): Emergency rotation of Anthropic key due to GitHub leak [ticket-link]" \
  >> /var/log/learnfyra/secret-rotation-audit.log
```

### 5.3 Key Rotation Testing

**Pre-Rotation Validation** (automated, runs 1 hour before scheduled rotation):
```javascript
// Lambda function: learnfyra-rotation-validator
// Tests each provider's new key before rotation

const testNewKey = async (provider, newKeyArn) => {
  const client = await getProviderClient(provider, newKeyArn);
  
  const testRequest = {
    model: getProviderModel(provider),
    prompt: "Test: Generate one simple math problem for grade 3",
    max_tokens: 100
  };
  
  try {
    const response = await client.generate(testRequest);
    if (response.status === 200 && response.data.content) {
      console.log(`✅ ${provider} new key validated successfully`);
      return true;
    }
  } catch (error) {
    console.error(`❌ ${provider} new key validation failed: ${error.message}`);
    // Alert Ops Engineer: rotation will fail if not resolved
    await sendSlackAlert(`Key rotation pre-check failed for ${provider}`);
    return false;
  }
};
```

**Post-Rotation Monitoring** (24-hour observation window):
```bash
# CloudWatch Insights query to detect any authentication errors after rotation
aws logs insights query \
  --log-group-name /aws/lambda/learnfyra-generate-production \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message
    | filter @message like /authentication|api key|unauthorized|403|401/
    | stats count() by provider'

# Expected: Zero authentication errors
# If errors found: investigate immediately, may need manual rollback
```

### 5.4 Provider-Specific Rotation Procedures

#### Anthropic API Key Rotation
**Provider Support**: Anthropic allows up to 5 active API keys simultaneously (grace period built-in)

**Best Practice**:
1. Create new key in Anthropic Console
2. Deploy new key to production (both keys valid)
3. Monitor for 24 hours
4. Delete old key after validation

**Rotation Frequency**: Weekly (cost optimization — Anthropic charges per-key minimum)

#### OpenAI API Key Rotation
**Provider Support**: OpenAI allows 1 active "organization key" + unlimited "project keys"

**Best Practice**: Use project-scoped keys (learnfyra-production-project) for easier rotation

**Rotation Frequency**: Weekly

#### Google AI (Gemini) Key Rotation
**Provider Support**: Google Cloud service account keys (JSON keyfile)

**Best Practice**: Use Workload Identity Federation instead of static keys (eliminates rotation need)

**Rotation Frequency**: Monthly (if using static keys), N/A (if using Workload Identity)

---

## 6. Retention & Backup Strategy

### 6.1 Worksheet Data Retention

#### S3 Bucket Lifecycle Policy (Production)
```json
{
  "Rules": [
    {
      "Id": "DeleteWorksheets7Days",
      "Status": "Enabled",
      "Prefix": "worksheets/",
      "Expiration": {
        "Days": 7
      },
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 1
      }
    },
    {
      "Id": "ArchiveMetadata90Days",
      "Status": "Enabled",
      "Prefix": "metadata/",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

**Rationale**:
- Worksheets (PDF/DOCX files): Deleted after 7 days (users expected to download immediately)
- Metadata (JSON configuration, audit logs): Retained 1 year for compliance
- Cost optimization: Transition to cheaper storage classes after 30/90 days

#### User-Requested Data Deletion (GDPR Right to Erasure)
**Procedure**:
1. User submits deletion request via email to privacy@learnfyra.com
2. Support team verifies identity (email confirmation)
3. Support team runs deletion script:
   ```bash
   # Delete all worksheets associated with user email
   aws s3 rm s3://learnfyra-production-worksheets/worksheets/ \
     --recursive \
     --exclude "*" \
     --include "*user-email-hash-abc123*"
   
   # Overwrite metadata with anonymized placeholders
   aws s3api put-object \
     --bucket learnfyra-production-worksheets \
     --key metadata/user-abc123.json \
     --body /tmp/anonymized-metadata.json
   ```
4. Confirmation email sent to user within 30 days

### 6.2 CloudWatch Logs Retention

| Log Group | Retention Period | Export to S3 | Archive to Glacier |
|-----------|------------------|--------------|-------------------|
| `/aws/lambda/learnfyra-generate-production` | 90 days | Yes (daily) | After 90 days |
| `/aws/lambda/learnfyra-generate-staging` | 30 days | No | No |
| `/aws/lambda/learnfyra-generate-dev` | 7 days | No | No |
| `/aws/apigateway/learnfyra-production` | 90 days | Yes (daily) | After 90 days |
| `/aws/cloudtrail/learnfyra-audit` | 365 days | Yes (daily) | After 180 days |

**Audit Log Exports** (automated daily):
```bash
# Lambda function: learnfyra-log-exporter
# Triggered: CloudWatch Events (cron: 0 2 * * ? — daily at 2 AM UTC)

aws logs create-export-task \
  --log-group-name /aws/lambda/learnfyra-generate-production \
  --from $(date -u -d '1 day ago' +%s)000 \
  --to $(date -u +%s)000 \
  --destination learnfyra-production-audit-logs \
  --destination-prefix cloudwatch-exports/$(date -u +%Y/%m/%d)/
```

**Long-Term Audit Archive**:
- All CloudWatch logs exported to S3 nightly
- S3 bucket with Object Lock enabled (cannot be deleted for 7 years — compliance requirement)
- Glacier Deep Archive after 180 days (99.9% cost reduction)
- Total retention: 7 years (SOC 2 compliance requirement)

### 6.3 Disaster Recovery & Backup

#### Recovery Time Objective (RTO) & Recovery Point Objective (RPO)

| Component | RTO Target | RPO Target | Backup Method |
|-----------|------------|------------|---------------|
| **Lambda Functions** | 30 minutes | 0 (stateless, code in Git) | Git repository + CDK IaC |
| **S3 Worksheets** | 1 hour | 24 hours | Cross-region replication to us-west-2 |
| **Secrets Manager** | 15 minutes | 0 (synchronized) | AWS automatic cross-region replication |
| **CloudWatch Logs** | 4 hours | 24 hours | Daily S3 export to backup region |
| **Model Configuration** | 5 minutes | 0 (versioned) | Parameter Store version history + Git |

#### Multi-Region Disaster Recovery Setup

**Primary Region**: us-east-1 (N. Virginia)  
**DR Region**: us-west-2 (Oregon)

**S3 Cross-Region Replication**:
```json
{
  "Role": "arn:aws:iam::ACCOUNT:role/s3-crr-role",
  "Rules": [
    {
      "Status": "Enabled",
      "Priority": 1,
      "Filter": {
        "Prefix": "worksheets/"
      },
      "Destination": {
        "Bucket": "arn:aws:s3:::learnfyra-production-worksheets-dr-us-west-2",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": {
            "Minutes": 15
          }
        },
        "Metrics": {
          "Status": "Enabled"
        }
      }
    }
  ]
}
```

**DR Activation Procedure** (Regional Outage):
```bash
# Execute if us-east-1 region is down for > 1 hour

# Step 1: Verify regional outage (not just temporary blip)
aws health describe-events --region us-east-1 \
  | grep -i "region-wide"

# Step 2: Update Route 53 DNS to point to DR region
aws route53 change-resource-record-sets \
  --hosted-zone-id $ROUTE53_ZONE_ID \
  --change-batch file://dr-failover-dns.json

# dr-failover-dns.json content:
# {
#   "Changes": [{
#     "Action": "UPSERT",
#     "ResourceRecordSet": {
#       "Name": "api.learnfyra.com",
#       "Type": "A",
#       "AliasTarget": {
#         "HostedZoneId": "$CLOUDFRONT_DR_ZONE_ID",
#         "DNSName": "$CLOUDFRONT_DR_DOMAIN",
#         "EvaluateTargetHealth": true
#       }
#     }
#   }]
# }

# Step 3: Activate DR Lambda functions in us-west-2
aws lambda update-function-configuration \
  --function-name learnfyra-generate-production-dr \
  --region us-west-2 \
  --environment Variables={ACTIVE_MODE=primary}

# Step 4: Update status page
curl -X PATCH https://api.statuspage.io/v1/pages/$STATUSPAGE_ID/incidents/$INCIDENT_ID \
  -d '{"status": "monitoring", "body": "Failover to DR region complete. Service restored."}'

# Step 5: Monitor DR region metrics for next 4 hours
# Ensure error rates < 1%, latency comparable to primary region
```

**Recovery Test Schedule**:
- **Quarterly**: DR region activation test (Saturday 2 AM UTC, max 1 hour downtime)
- **Annually**: Full regional failover drill (includes customer notifications, RTO validation)

#### Backup Verification

**Monthly Backup Integrity Test**:
```bash
# Automated Lambda: learnfyra-backup-validator
# Verifies backups are restorable, not corrupted

# Step 1: Select random 100 worksheets from S3 backup
aws s3api list-objects-v2 \
  --bucket learnfyra-production-worksheets-backup \
  --max-keys 1000 \
  | jq -r '.Contents[].Key' \
  | shuf -n 100 \
  > /tmp/sample-worksheets.txt

# Step 2: Download and verify each file
while read KEY; do
  aws s3 cp s3://learnfyra-production-worksheets-backup/$KEY /tmp/worksheet.pdf
  
  # Verify PDF is valid (not corrupted)
  pdfinfo /tmp/worksheet.pdf &> /dev/null
  if [ $? -eq 0 ]; then
    echo "✅ $KEY valid"
  else
    echo "❌ $KEY CORRUPTED"
    # Alert Ops Engineer: backup integrity issue
    aws sns publish --topic-arn $SNS_BACKUP_ALERT --message "Backup corruption detected: $KEY"
  fi
done < /tmp/sample-worksheets.txt
```

**Backup Test Result**: Must have 100% pass rate. Any corruption triggers immediate investigation.

---

## 7. Runbook Quick Reference

### 7.1 Common Operational Tasks

#### Task: Check Production Health
```bash
# One-line health check
aws cloudwatch get-metric-statistics \
  --namespace Learnfyra/Production \
  --metric-name HealthCheckSuccessRate \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average \
  | jq -r '.Datapoints[-1].Average'

# Expected output: 1.0 (100% success)
# If < 0.95: investigate immediately
```

#### Task: Manually Trigger Model Failover
```bash
# Switch to secondary provider immediately
aws ssm put-parameter \
  --name /learnfyra/production/model-config \
  --value '{"activeProvider": "openai"}' \
  --overwrite

# Force Lambda reload
aws lambda update-function-configuration \
  --function-name learnfyra-generate-production \
  --environment Variables={CONFIG_VERSION=$(date +%s)}
```

#### Task: View Recent Production Errors
```bash
# Last 100 errors with timestamps
aws logs tail /aws/lambda/learnfyra-generate-production \
  --since 30m \
  --filter-pattern "ERROR" \
  --format short
```

#### Task: Check Current Hourly Cost
```bash
# Cost for last hour (approximate, based on CloudWatch metrics)
aws cloudwatch get-metric-statistics \
  --namespace Learnfyra/Production \
  --metric-name ModelAPICost \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  | jq -r '.Datapoints[0].Sum'

# Expected: < $50/hour in production
# If > $150/hour: investigate for abuse or configuration error
```

#### Task: Force Secret Rotation Now
```bash
# Emergency key rotation (skip schedule)
aws lambda invoke \
  --function-name learnfyra-secret-rotator \
  --payload '{"forceRotation": true, "provider": "anthropic"}' \
  /tmp/rotation-result.json

# Check result
cat /tmp/rotation-result.json | jq .
```

#### Task: Export Last 24h Logs for Compliance
```bash
# Export to S3 for legal/audit purposes
aws logs create-export-task \
  --log-group-name /aws/lambda/learnfyra-generate-production \
  --from $(date -u -d '24 hours ago' +%s)000 \
  --to $(date -u +%s)000 \
  --destination learnfyra-production-audit-logs \
  --destination-prefix compliance-export/$(date -u +%Y-%m-%d)/

# Download export after 15 minutes (S3 export delay)
sleep 900
aws s3 sync s3://learnfyra-production-audit-logs/compliance-export/$(date -u +%Y-%m-%d)/ ./logs/
```

### 7.2 Incident Response Checklists

#### P0 Incident Checklist
```
□ Incident detected (automatic alert or manual report)
□ On-call engineer acknowledges within 5 minutes
□ Initial assessment posted in #learnfyra-critical
□ Root cause hypothesis formed (provider issue, Lambda issue, config issue)
□ Mitigation action executed (failover, rollback, scale-up)
□ Service health validated (error rate < 1% for 5+ minutes)
□ Status page updated (investigating → monitoring → resolved)
□ Incident postmortem scheduled (within 48 hours)
□ Runbook updated with lessons learned
□ Preventive measures implemented (new alarms, config changes)
```

#### Deployment Checklist (Production)
```
□ PR opened with model config change
□ Staging deployment successful (48h validation)
□ Super Admin approval granted
□ Production deployment scheduled (low-traffic window if possible)
□ Ops Engineer available to monitor (not during off-hours unless urgent)
□ Rollback plan tested in staging
□ CloudWatch dashboard open and visible
□ PagerDuty on-call schedule confirmed (backup engineer available)
□ Deployment executed via GitHub Actions
□ Canary stage monitored (first 15 minutes)
□ Full deployment monitored (2 hours post-deploy)
□ Success confirmed, GitHub Issue closed
```

### 7.3 Contact Information

| Role | Primary Contact | Backup Contact | Escalation Path |
|------|----------------|----------------|-----------------|
| **On-Call Engineer** | PagerDuty auto-routing | ops@learnfyra.com | → Super Admin after 10 min no-ack |
| **Super Admin** | CTO (cto@learnfyra.com) | VP Eng (vpeng@learnfyra.com) | → CEO if both unavailable |
| **Security Team** | security@learnfyra.com | CISO mobile (redacted) | → AWS Support (Enterprise) |
| **AWS Support** | +1-800-AWS-SUPPORT | AWS Console Support Center | Priority: Business-critical |
| **Anthropic Support** | support@anthropic.com | Console chat (if available) | Response SLA: 4 hours |
| **OpenAI Support** | developers@openai.com | Forum post | Response SLA: 24 hours |

**Out-of-Hours Escalation**:
- P0 incidents: Call CTO mobile directly (do not wait for email)
- P1 incidents: PagerDuty low-urgency page (15-minute acknowledgment window)
- P2+ incidents: Wait until next business day unless customer-impacting

---

## Document Maintenance

**Ownership**: DevOps Team Lead  
**Review Cycle**: Quarterly (or after any P0 incident)  
**Last Updated**: 2026-03-24  
**Next Review**: 2026-06-24

**Change History**:
| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-03-24 | 1.0 | Initial operational specification | DevOps Agent |

**Related Documents**:
- [Super Admin Model Control Plane Spec](../specs/super-admin-model-control-plane-spec.md) — Feature design
- [Admin Model Routing QA Spec](../qa/admin-model-routing-qa-spec.md) — Testing procedures
- [AWS CDK Infrastructure Code](../../infra/cdk/README.md) — IaC implementation
- [GitHub Actions Workflows](../../.github/workflows/README.md) — CI/CD pipelines

---

**END OF OPERATIONS SPECIFICATION**
