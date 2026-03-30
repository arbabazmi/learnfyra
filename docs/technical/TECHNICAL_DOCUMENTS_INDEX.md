# Technical Documentation Index

**Date:** March 26, 2026  
**Status:** Complete Technical Reference Library  
**Last Updated:** March 26, 2026

---

## Purpose

This document serves as the **master index** for all technical documentation in the Learnfyra platform. It provides:

1. **Quick-find guide** to technical documents
2. **Recommended reading order** by role (Backend Dev, Frontend Dev, DevOps, QA, Architect)
3. **Cross-references** between documents
4. **Visual architecture diagrams** in one place
5. **Technical decision records** and justifications

All technical documents are organized in the `docs/technical/` folder.

---

## Technical Documents by Category

### 1. **System Architecture & Overview**

| Document | Focus | Best For | Read Time |
|----------|-------|----------|-----------|
| [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) | Platform architecture, data flow, module breakdown, question types, storage schema | Architects, new team members, system designers | 30 min |
| [aws-services-technical-reference.md](aws-services-technical-reference.md) | AWS service inventory, costs, specifications | DevOps, cost analysts, AWS infrastructure planning | 20 min |

### 2. **Compute & Serverless**

| Document | Focus | Best For | Read Time |
|----------|-------|----------|-----------|
| [LAMBDA_SERVERLESS_ARCHITECTURE.md](LAMBDA_SERVERLESS_ARCHITECTURE.md) | Lambda function topology, cold start optimization, handler patterns, monitoring, IAM | Backend developers, DevOps, Lambda optimization specialists | 35 min |

### 3. **Data Layer**

| Document | Focus | Best For | Read Time |
|----------|-------|----------|-----------|
| [DATABASE_AND_STORAGE_ARCHITECTURE.md](DATABASE_AND_STORAGE_ARCHITECTURE.md) | DynamoDB schemas, S3 structure, query patterns, local storage fallback | Backend developers, data architects, database engineers | 40 min |

### 4. **Deployment & CI/CD**

| Document | Focus | Best For | Read Time |
|----------|-------|----------|-----------|
| [CI_CD_DEPLOYMENT_ARCHITECTURE.md](CI_CD_DEPLOYMENT_ARCHITECTURE.md) | GitHub Actions workflows, environment promotion, CDK deployment strategy, secrets management | DevOps, release managers, infrastructure engineers | 45 min |

---

## Reading Paths by Role

### 🏗️ **Solution Architect / Tech Lead**

**Goal:** Understand the entire system, tradeoffs, and design decisions

**Reading Order:**
1. [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) — START HERE
2. [LAMBDA_SERVERLESS_ARCHITECTURE.md](LAMBDA_SERVERLESS_ARCHITECTURE.md) — Compute strategy
3. [DATABASE_AND_STORAGE_ARCHITECTURE.md](DATABASE_AND_STORAGE_ARCHITECTURE.md) — Data strategy
4. [CI_CD_DEPLOYMENT_ARCHITECTURE.md](CI_CD_DEPLOYMENT_ARCHITECTURE.md) — Deployment strategy
5. [aws-services-technical-reference.md](aws-services-technical-reference.md) — Services & costs

**Time Commitment:** ~2-3 hours

**Key Outputs:**
- Can explain platform architecture to stakeholders
- Understands all design tradeoffs (DynamoDB vs RDS, Lambda vs ECS, etc.)
- Can guide architectural decisions for new features

---

### 💻 **Backend Developer**

**Goal:** Build Lambda handlers, APIs, and business logic

**Reading Order:**
1. [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) — Data flows, question types
2. [LAMBDA_SERVERLESS_ARCHITECTURE.md](LAMBDA_SERVERLESS_ARCHITECTURE.md) — Handler patterns, optimization
3. [DATABASE_AND_STORAGE_ARCHITECTURE.md](DATABASE_AND_STORAGE_ARCHITECTURE.md) — Data access patterns
4. Refer to: Implementation guides in `backend/handlers/`

**Time Commitment:** ~1-2 hours

**Key Skills to Acquire:**
- ✅ Write Lambda handlers following canonical pattern
- ✅ Query DynamoDB efficiently (use GSIs, not scans)
- ✅ Handle S3 presigned URLs
- ✅ Implement error handling with proper CORS headers
- ✅ Optimize cold starts with lazy loading

---

### 🎨 **Frontend Developer**

**Goal:** Build React/HTML UX, integrate APIs

**Reading Order:**
1. [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) — API endpoints, data flow (focus on section 1 & 2)
2. Refer to: Frontend component specs (in `docs/design/`)

**Time Commitment:** ~30 min

**Key Skills:**
- ✅ Understand solve.html flow (timer, answer capture, submit)
- ✅ Call API endpoints with proper error handling
- ✅ Implement auth token management
- ✅ Handle presigned URL downloads

---

### 🚀 **DevOps / Infrastructure Engineer**

**Goal:** Deploy, monitor, scale the platform

**Reading Order:**
1. [aws-services-technical-reference.md](aws-services-technical-reference.md) — Services inventory
2. [CI_CD_DEPLOYMENT_ARCHITECTURE.md](CI_CD_DEPLOYMENT_ARCHITECTURE.md) — Pipelines & CDK
3. [LAMBDA_SERVERLESS_ARCHITECTURE.md](LAMBDA_SERVERLESS_ARCHITECTURE.md) — Monitoring & alarms
4. [DATABASE_AND_STORAGE_ARCHITECTURE.md](DATABASE_AND_STORAGE_ARCHITECTURE.md) — Storage lifecycle

**Time Commitment:** ~2 hours

**Key Responsibilities:**
- ✅ Manage GitHub Actions workflows
- ✅ Maintain AWS CDK stack
- ✅ Monitor CloudWatch dashboards & alarms
- ✅ Handle secrets in Secrets Manager
- ✅ Manage S3 lifecycle policies
- ✅ Plan disaster recovery & backups

---

### 🧪 **QA / Test Engineer**

**Goal:** Test systems, find bugs, verify deployments

**Reading Order:**
1. [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) — Accept criteria, question types
2. [LAMBDA_SERVERLESS_ARCHITECTURE.md](LAMBDA_SERVERLESS_ARCHITECTURE.md) — Lambda testing patterns
3. [DATABASE_AND_STORAGE_ARCHITECTURE.md](DATABASE_AND_STORAGE_ARCHITECTURE.md) — Test data management

**Time Commitment:** ~1-1.5 hours

**Key Test Areas:**
- ✅ Generate → Solve → Submit flow
- ✅ Question type scoring scenarios
- ✅ Authentication/authorization
- ✅ Error responses (4xx, 5xx)
- ✅ Performance baselines (Lambda duration, API latency)
- ✅ Data consistency across environments

---

## Document Quick Reference

### Section Locations: Top-Level Architecture

**Find this topic...** → **In this document:**

| What I'm Looking For | Document | Section |
|---|---|---|
| Platform overview diagram | SYSTEM_ARCHITECTURE_OVERVIEW | §1: Platform Architecture |
| Data flow: Generate → Solve → Submit | SYSTEM_ARCHITECTURE_OVERVIEW | §2: Data Flow |
| Module breakdown & responsibilities | SYSTEM_ARCHITECTURE_OVERVIEW | §3: Module Breakdown |
| Auth & JWT flow | SYSTEM_ARCHITECTURE_OVERVIEW | §4: Authentication Flow |
| Question type scoring rules | SYSTEM_ARCHITECTURE_OVERVIEW | §5: Question Scoring |
| Worksheet JSON schema | SYSTEM_ARCHITECTURE_OVERVIEW | §6: Storage Schema |
| Environment variables | SYSTEM_ARCHITECTURE_OVERVIEW | §7: Env Variables |

### Lambda Deep Dives

| What I'm Looking For | Document | Section |
|---|---|---|
| Lambda function topology | LAMBDA_SERVERLESS_ARCHITECTURE | §1: Lambda Topology |
| Cold start optimization | LAMBDA_SERVERLESS_ARCHITECTURE | §2: Cold Start Optimization |
| Canonical handler pattern | LAMBDA_SERVERLESS_ARCHITECTURE | §3: Handler Pattern |
| Lambda event types from API Gateway | LAMBDA_SERVERLESS_ARCHITECTURE | §4: Event Types |
| Performance monitoring & alarms | LAMBDA_SERVERLESS_ARCHITECTURE | §5: Performance |
| Reserved concurrency strategy | LAMBDA_SERVERLESS_ARCHITECTURE | §6: Concurrency |
| CDK Lambda construct | LAMBDA_SERVERLESS_ARCHITECTURE | §7: CDK Pattern |

### Database & Storage

| What I'm Looking For | Document | Section |
|---|---|---|
| S3 vs DynamoDB strategy | DATABASE_AND_STORAGE_ARCHITECTURE | §1: Storage Overview |
| DynamoDB table schemas | DATABASE_AND_STORAGE_ARCHITECTURE | §2: DynamoDB Schemas |
| S3 bucket structure | DATABASE_AND_STORAGE_ARCHITECTURE | §3: S3 Buckets |
| Query patterns & examples | DATABASE_AND_STORAGE_ARCHITECTURE | §4: Query Patterns |
| Local storage (JSON fallback) | DATABASE_AND_STORAGE_ARCHITECTURE | §5: Local Storage |

### CI/CD & Deployment

| What I'm Looking For | Document | Section |
|---|---|---|
| GitHub Actions pipeline diagram | CI_CD_DEPLOYMENT_ARCHITECTURE | §1: Pipeline Overview |
| CI workflow (lint/test/build) | CI_CD_DEPLOYMENT_ARCHITECTURE | §2: CI Workflow |
| Deploy workflows (dev/staging/prod) | CI_CD_DEPLOYMENT_ARCHITECTURE | §3: Deploy Workflows |
| Environment protection & secrets | CI_CD_DEPLOYMENT_ARCHITECTURE | §4: Secrets Management |
| Dev → Staging → Prod promotion | CI_CD_DEPLOYMENT_ARCHITECTURE | §5: Promotion Timeline |
| CDK deployment strategy | CI_CD_DEPLOYMENT_ARCHITECTURE | §6: CDK Strategy |
| CDK stack dependencies | CI_CD_DEPLOYMENT_ARCHITECTURE | §7: Resource Graph |

---

## Key Decision Records (Why We Built It This Way)

### 1. Why Lambda + API Gateway (not ECS / EC2)?

**Decision:** Serverless compute (Lambda) for all backend workloads

**Reasons:**
- ✅ **Cost**: ~$50-120/mo vs ~$500+/mo for ECS
- ✅ **Scaling**: Auto-scales to zero; no idle capacity
- ✅ **Ops overhead**: AWS manages patching, no infrastructure to maintain
- ✅ **Simplicity**: Deploy individual functions vs managing containers

**Tradeoff:** Cold starts (~1.5s) mitigated by lazy loading & warm container reuse

---

### 2. Why DynamoDB (not PostgreSQL / RDS)?

**Decision:** DynamoDB for auth, classes, submissions; S3 for worksheets

**Reasons:**
- ✅ **Schemaless**: Easy model evolution without migrations
- ✅ **Serverless**: No capacity planning; pay per request
- ✅ **Speed**: Microsecond latency for key lookups
- ✅ **Global Secondary Indexes**: Fast queries on non-key attributes

**Tradeoff:** Complex aggregations harder; solved with batch exports to Analytics

**Future:** Consider Elasticsearch for text search (not critical MVP)

---

### 3. Why JSON Storage for Worksheets (not DynamoDB)?

**Decision:** Store worksheet JSON in S3; only metadata in DynamoDB

**Reasons:**
- ✅ **Cost**: S3 cheaper than DynamoDB for large objects (~5KB+ per worksheet)
- ✅ **Immutable**: Worksheets don't change post-generation
- ✅ **Lifecycle**: 7-day auto-expiry via S3 rules (no manual cleanup)
- ✅ **Reusability**: Same JSON used for PDF, HTML, scoring

**Tradeoff:** Two calls (DynamoDB metadata + S3 JSON); acceptable latency

---

### 4. Why ARM_64 Lambda (not x86)?

**Decision:** All Lambda functions ARM_64 architecture

**Reasons:**
- ✅ **Cost**: 20% cheaper than x86
- ✅ **Speed**: Actual performance better for Node.js workloads
- ✅ **AWS Graviton**: Better chip design than x86 for this workload

**No Tradeoff:** Full AWS SDK support, no compatibility issues

---

### 5. Why Multi-Tier Environments (dev/staging/prod)?

**Decision:** Three separate AWS accounts & CloudFormation stacks

**Reasons:**
- ✅ **Safety**: Prod isolated from testing; accidental deletes don't affect users
- ✅ **Cost**: Dev cheaper than prod (on-demand, no reserved capacity)
- ✅ **Iteration**: Fast feedback loop (dev deploys in <5min)
- ✅ **Staging**: Full integration test before prod (smoke tests auto-run)

**Consequence:** 3x infrastructure cost; worth it for reliability

---

### 6. Why GitHub Actions (not Jenkins / GitLab CI)?

**Decision:** GitHub native Actions for CI/CD

**Reasons:**
- ✅ **Integration**: Native to GitHub; no sysinc overhead
- ✅ **Cost**: Generous free tier (3000 min/month)
- ✅ **Simplicity**: YAML workflows, no Jenkins plugin jungle
- ✅ **Matrix builds**: Easy multi-environment testing

**Limitation**: No local debugging; mitigated by good test coverage

---

## Monitoring & Observability Checklist

### CloudWatch Metrics (Automatic)

```
✅ Lambda Duration (p50, p99)
✅ Lambda Errors (count, %)
✅ API Gateway Requests (count, latency)
✅ API Gateway Errors (4xx, 5xx)
✅ DynamoDB Consumed RCU/WCU
✅ S3 Request count & latency
✅ CloudFront Requests & cache hit rate
```

### CloudWatch Alarms (Configured)

```
✅ Lambda error rate > 1% in 5 min → Slack
✅ Lambda throttles > 0 → Page on-call
✅ API latency p99 > 2s → Slack
✅ DynamoDB throttles > 0 → Scale concurrency
✅ S3 4xx errors spike → Investigate
✅ CloudFront 5xx > 10 in 1 min → Rollback?
```

### Manual Dashboards

- **Backend Observability Dashboard** (CloudWatch)
  - Request volume per endpoint
  - Error rate by handler
  - Top latencies
  - Database metrics

- **Cost Dashboard** (AWS Cost Explorer)
  - Monthly spend by service
  - Forecast vs budget
  - Trends & anomalies

---

## Appendix: File Manifest

All technical documents located in `docs/technical/`:

```
docs/technical/
├── SYSTEM_ARCHITECTURE_OVERVIEW.md                      ← START HERE
├── LAMBDA_SERVERLESS_ARCHITECTURE.md
├── DATABASE_AND_STORAGE_ARCHITECTURE.md
├── CI_CD_DEPLOYMENT_ARCHITECTURE.md
├── aws-services-technical-reference.md
└── TECHNICAL_DOCUMENTS_INDEX.md                          ← YOU ARE HERE
```

---

## Links to Related Documentation

**Specification Documents** (in `docs/specs/`):
- [Online Solve Spec](../specs/online-solve-spec.md) — Feature requirements
- [API Security & Auth](../specs/api-security-auth-model.md) — Security model

**Design Documents** (in `docs/design/`):
- [Learnfyra UI Spec v3](../design/learnfyra-ui-spec-v3.md) — UX/UI guidelines

**Operational Docs** (in `docs/operations/`):
- [Platform Technical Status](../operations/PLATFORM_TECHNICAL_STATUS.md) — Current state
- [Next Phase Dossier](../operations/NEXT_PHASE_MASTER_DOSSIER.md) — Roadmap

**Implementation Guides** (in these files):
- `backend/handlers/` — Handler implementations (follow canonical pattern)
- `src/ai/`, `src/solve/` — Business logic
- `infra/cdk/lib/` — CDK stack code

---

## Questions & Troubleshooting

**Q: Where do I find the Lambda cold start benchmark?**  
A: [LAMBDA_SERVERLESS_ARCHITECTURE.md](LAMBDA_SERVERLESS_ARCHITECTURE.md) § 2 — ~1.5s after lazy loading

**Q: How do I query a DynamoDB table efficiently?**  
A: [DATABASE_AND_STORAGE_ARCHITECTURE.md](DATABASE_AND_STORAGE_ARCHITECTURE.md) § 4 — Use GSI, never scan

**Q: What's the deploy procedure to production?**  
A: [CI_CD_DEPLOYMENT_ARCHITECTURE.md](CI_CD_DEPLOYMENT_ARCHITECTURE.md) § 5 — Requires 2 approvals, 24h wait option

**Q: What environment variables does my Lambda need?**  
A: [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) § 7 — Full reference

**Q: How are secrets managed?**  
A: [CI_CD_DEPLOYMENT_ARCHITECTURE.md](CI_CD_DEPLOYMENT_ARCHITECTURE.md) § 4 — GitHub Secrets → AWS Secrets Manager

---

**Document Status:** Complete & Current  
**Maintained By:** Technical Architecture Team  
**Last Review:** March 26, 2026  
**Next Review:** June 2026 (or after major architecture change)
