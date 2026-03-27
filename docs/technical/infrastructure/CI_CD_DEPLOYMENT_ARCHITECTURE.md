# CI/CD & Deployment Architecture

**Date:** March 26, 2026  
**Status:** Current Implementation  
**Focus Area:** GitHub Actions, AWS CDK, Multi-Environment Deployment

---

## 1. GitHub Actions CI/CD Pipeline Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                     GITHUB WORKFLOW PIPELINE                           │
└────────────────────────────────────────────────────────────────────────┘

                        DEVELOPER PUSHES CODE
                               │
                    ┌──────────┴──────────┐
                    │                     │
         PR to main/develop/staging    Direct push to branch
                    │                     │
                    ▼                     ▼
            ┌──────────────────┐   ┌──────────────────┐
            │  .github/        │   │  .github/        │
            │  workflows/      │   │  workflows/      │
            │  ci.yml          │   │  deploy-*.yml    │
            │                  │   │                  │
            │ Triggers:        │   │ Triggers:        │
            │ • pull_request   │   │ • push to branch │
            │   main|develop   │   │   develop    → dev
            │   staging        │   │   staging    → staging
            │                  │   │   main       → prod
            └────────┬─────────┘   └────────┬────────┘
                     │                      │
         ┌───────────▼──────────┐ ┌────────▼────────────┐
         │   CI JOB             │ │  DEPLOY JOB         │
         │   (lint/test/build)  │ │  (CDK/push/notify) │
         └───────────┬──────────┘ └────────┬────────────┘
                     │                     │
         ┌─────────────────────────────────▼───────┐
         │  Job outcomes & branch status check     │
         └──────────────────┬──────────────────────┘
                            │
                    ┌───────┴────────┐
                    │                │
                    ▼                ▼
              PR BLOCKED ->    MERGE ALLOWED
             (if CI fails)     (if all green)
                               │
                               ▼
                        DEPLOY TRIGGERED
```

---

## 2. CI Workflow Details (.github/workflows/ci.yml)

```
name: CI
on:
  pull_request:
    branches: [main, develop, staging]

jobs:
  lint-test-coverage:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0                    # for coverage diff
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci                          # clean install (vs npm install)
      
      - name: Lint code
        run: npm run lint
        continue-on-error: true              # warn on lint, don't fail
      
      - name: Run unit tests
        run: npm test -- --coverage
        env:
          NODE_ENV: test
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          fail_ci_if_error: true
      
      - name: Check coverage threshold
        run: npm run test:coverage:check
        # Fails if coverage < 80% for lines
      
      - name: CDK Synth Check
        run: |
          cd infra/cdk
          npm ci
          npx cdk synth --no-staging
        # Validates CDK code can generate CloudFormation
      
      - name: Comment PR with results
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const coverage = require('./coverage/coverage-summary.json');
            const lines = coverage.total.lines.pct;
            const comment = `
            ## Test Results ✅
            - Coverage: ${lines}%
            - Tests: PASSED
            - CDK Synth: OK
            `;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });


WORKFLOW VISUALIZATION
────────────────────

    ┌───────────────┐
    │ Lint          │  npm run lint
    │ (ESLint)      │  ~30s
    └───┬───────────┘
        │
    ┌───▼────────────────────┐
    │ Unit Tests             │  npm test --coverage
    │ (Jest)                 │  ~45s
    │ • Coverage report      │
    │ • Assert 80% gate      │
    └───┬────────────────────┘
        │
    ┌───▼────────────────────┐
    │ Coverage Upload        │  Codecov
    │ (Codecov action)       │  ~20s
    └───┬────────────────────┘
        │
    ┌───▼────────────────────┐
    │ CDK Synth              │  cdk synth --no-staging
    │ (Validate CDK)         │  ~30s
    └───┬────────────────────┘
        │
    ┌───▼────────────────────┐
    │ PR Comment             │  Summary posted
    │ (GitHub script)        │
    └───────────────────────┘
    
    TOTAL CI TIME: ~2-3 minutes
    STATUS CHECK: ✅ All green OR ❌ Blocks merge
```

---

## 3. Deploy Workflows (Multi-Environment)

```
┌────────────────────────────────────────────────────────────────────────┐
│        DEPLOY-DEV.yml (Triggers on push to develop branch)            │
└────────────────────────────────────────────────────────────────────────┘

name: Deploy Dev
on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: dev                    # GitHub Environment (protection)
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install frontend dependencies
        run: npm ci
      
      - name: Run tests (must pass before deploy)
        run: npm test
      
      - name: Build frontend
        run: npm run build
        env:
          NODE_ENV: production
          REACT_APP_API_URL: https://dev-api.learnfyra.com
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      
      - name: Deploy frontend to S3
        run: |
          aws s3 sync frontend/build/  \
            s3://learnfyra-dev-s3-frontend/  \
            --delete                    # Remove old files
      
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.DEV_CF_DIST_ID }} \
            --paths "/*"
      
      - name: Deploy CDK stack (infrastructure)
        run: |
          cd infra/cdk
          npm ci
          npx cdk deploy \
            --context env=dev \
            --require-approval never   # Auto-approve in dev
      
      - name: Run smoke tests
        run: npm run test:smoke:dev
        env:
          API_URL: https://dev-api.learnfyra.com
      
      - name: Notify Slack on success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_DEV }}
          payload: |
            {
              "text": "✅ Dev deploy complete",
              "blocks": [
                {"type": "section", "text": {"type": "mrkdwn", "text": "Dev deployment successful"}}
              ]
            }
      
      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_DEV }}
          payload: |
            {
              "text": "❌ Dev deploy FAILED",
              "blocks": [
                {"type": "section", "text": {"type": "mrkdwn", "text": "Dev deployment failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}}
              ]
            }


┌────────────────────────────────────────────────────────────────────────┐
│  DEPLOY-STAGING.yml (Triggers on push to staging branch)              │
└────────────────────────────────────────────────────────────────────────┘

Similar to dev, but:
  • Requires manual approval before deploy (GitHub protection rule)
  • Runs extended smoke tests
  • Generates performance baseline report
  • Requires coverage report artifact


┌────────────────────────────────────────────────────────────────────────┐
│  DEPLOY-PROD.yml (Triggers on push to main branch)                    │
└────────────────────────────────────────────────────────────────────────┘

Highest safety:
  1. Manual approval by 2 team members (required)
  2. Version tag creation (git tag v{date})
  3. Create GitHub Release with changelog
  4. Deploy to prod with canary traffic split (future)
  5. Roll back procedure documented & ready
  6. Post-deploy health checks mandatory
```

---

## 4. Environment Protection & Secrets Management

```
┌──────────────────────────────────────────────────────────────────────┐
│            GitHub Environments (Branch Protection)                   │
├──────────────────────────────────────────────────────────────────────┤

                REPOSITORY SETTINGS → Environments

  ┌─────────────┐
  │ dev         │
  │ (auto)      │  Auto-approve deploys
  │             │  All PRs allowed
  └─────────────┘
  
  ┌─────────────┐
  │ staging     │
  │ (manual)    │  Require approval from CODEOWNERS
  │             │  Limited branches: staging only
  └─────────────┘
  
  ┌─────────────┐
  │ prod        │
  │ (manual+)   │  Require 2 approvals
  │             │  Limited branches: main only
  │             │  Wait timer: 24 hours (for critical fixes)
  └─────────────┘


GitHub Secrets (.github/Actions secret store)
──────────────────────────────────────────────

SHARED (all environments):
  AWS_ACCESS_KEY_ID                (IAM deploy user key)
  AWS_SECRET_ACCESS_KEY            (IAM deploy user secret)
  AWS_REGION                       us-east-1
  CODECOV_TOKEN                    (for integration)
  SLACK_WEBHOOK_DEV                (notifications)
  SLACK_WEBHOOK_STAGING
  SLACK_WEBHOOK_PROD

ENVIRONMENT-SPECIFIC:
  
  Dev:
    ANTHROPIC_API_KEY_DEV          (Claude API key for dev)
    DEV_CF_DIST_ID                 (CloudFront distribution ID)
  
  Staging:
    ANTHROPIC_API_KEY_STAGING      (Claude API key for staging)
    STAGING_CF_DIST_ID
    STAGING_DOMAIN                 staging.learnfyra.com
  
  Prod:
    ANTHROPIC_API_KEY_PROD         (Claude API key for prod)
    PROD_CF_DIST_ID
    PROD_DOMAIN                    app.learnfyra.com
    PAGERDUTY_KEY                  (on-call alerting)

SECRETS NEVER STORED IN:
  ✗ .env files
  ✗ Code repository
  ✗ CloudFormation templates
  ✗ CDK code (except as references: process.env, Secrets Manager ARNs)

SECRETS ALWAYS RETRIEVED FROM:
  ✓ GitHub Secrets (at build time)
  ✓ AWS Secrets Manager (at runtime in Lambda)
```

---

## 5. Deployment Sequence (Develop → Staging → Production)

```
┌────────────────────────────────────────────────────────────────────────┐
│            MULTI-ENVIRONMENT PROMOTION PIPELINE                        │
└────────────────────────────────────────────────────────────────────────┘

TIMELINE: Feature Development → Production (1-2 weeks typical)

                 ┌──────────────────────────────────┐
                 │ Developer creates feature branch │
    ┌────────────┤ e.g., feature/online-solve      │
    │            └──────────────────────────────────┘
    │
    ▼
    (Local testing on localhost:3000)
    • npm start
    • Manual QA
    • npm test passes
    
    ▼
    ┌──────────────────────────────────────┐
    │ Push to develop branch                │
    │ git push origin feature/...           │
    │ → Auto-deploy to DEV via deploy-dev.yml
    │ → Smoke tests run                    │
    │ URL: https://dev-api.learnfyra.com   │
    └────────┬─────────────────────────────┘
             │ (1-2 days of testing in DEV)
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Create PR: develop → staging          │
    │ Code review required (CODEOWNERS)    │
    │ CI checks must pass                  │
    └────────┬─────────────────────────────┘
             │ (PR approved)
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Merge to staging branch               │
    │ → Auto-deploy to STAGING             │
    │ → Extended smoke tests (5-10 min)    │
    │ → Performance baselines measured     │
    │ URL: https://staging.learnfyra.com   │
    └────────┬─────────────────────────────┘
             │ (3-5 days of staging validation)
             │ Teachers/admins test in staging
             │ Performance benchmarks pass?
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Create PR: staging → main             │
    │ Code review + approval (2x)          │
    │ Changelog prepared                   │
    │ Rollback plan documented             │
    └────────┬─────────────────────────────┘
             │ (PR approved by 2 maintainers)
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Manual approval in GitHub Actions     │
    │ (required before prod deploy)        │
    │ • Maintainer approves deploy         │
    │ • Deployment starts                  │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Merge to main branch                  │
    │ (This triggers deploy-prod.yml)      │
    │ → Deploy CDK stack to prod           │
    │ → Canary 5% traffic (future)         │
    │ → 100% traffic rollout               │
    │ → Post-deploy health checks          │
    │ URL: https://app.learnfyra.com       │
    │ Slack notification sent              │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Feature is LIVE for all users         │
    │ Monitoring active (CloudWatch)       │
    │ Rollback channel open (if needed)    │
    └──────────────────────────────────────┘

ROLLBACK PROCEDURE (if prod deploy fails):
───────────────────────────────────────

  1. Monitor alerts (CloudWatch, Slack)
  2. If error rate > 5%, trigger rollback
  3. $ git revert <commit-hash>
  4. $ git push origin main (re-triggers deploy)
  5. CDK automatically reverts to previous stack
  6. Notify team on Slack
```

---

## 6. CDK Deployment Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│              AWS CDK DEPLOYMENT (infra/cdk/bin/learnfyra.ts)          │
└────────────────────────────────────────────────────────────────────────┘

INVOCATION COMMAND:

  cd infra/cdk
  npx cdk deploy --context env=dev --require-approval never

DEPLOYMENT FLOW:
  1. Parse CDK code (TypeScript → JavaScript)
  2. Synthesize CloudFormation template (JSON)
  3. Compare current stack to new template (cdk diff)
  4. Show changeset to user
  5. Wait for approval (--require-approval flag)
  6. Upload template to AWS CloudFormation
  7. CloudFormation creates/updates resources
  8. Monitor stack events until complete
  9. Return stack outputs (API URL, S3 bucket names, etc.)

CONTEXT VARIABLES:

  cdk.json defines context:
  ──────────────────────
  {
    "dev": {
      "certificateArn": "arn:aws:acm:...",
      "hostedZoneId": "Z...",
      "customDomain": "dev-api.learnfyra.com",
      "removalPolicy": "DESTROY"
    },
    "staging": {
      "certificateArn": "...",
      "hostedZoneId": "...",
      "customDomain": "staging.learnfyra.com",
      "removalPolicy": "DESTROY"
    },
    "prod": {
      "certificateArn": "...",
      "hostedZoneId": "...",
      "customDomain": "app.learnfyra.com",
      "removalPolicy": "RETAIN"
    }
  }

  Usage in CDK code:
  ─────────────────
  const env = this.node.tryGetContext('env');
  const config = this.node.tryGetContext(env);
  const removalPolicy = config.removalPolicy === 'DESTROY' 
    ? cdk.RemovalPolicy.DESTROY 
    : cdk.RemovalPolicy.RETAIN;


CLOUDFORMATION OUTPUTS:

  After deploy, CDK prints stack outputs:
  ────────────────────────────────────────

  Learnfyra-dev stack created.
  
  Outputs:
  ApiEndpoint = https://dev-api.learnfyra.com
  WorksheetBucket = learnfyra-dev-s3-worksheets
  FrontendBucket = learnfyra-dev-s3-frontend
  CloudFrontDistribution = d111111abcdef8.cloudfront.net
  DynamoUserTable = LearnfyraStack-dev-users-table
  DynamoClassesTable = LearnfyraStack-dev-classes-table
```

---

## 7. CDK Stack Dependencies & Resource Graph

```
LearnfyraStack (Main Stack)
│
├─ VPC (if private endpoint desired; not needed for serverless)
│
├─ S3 Buckets
│  ├─ Worksheets bucket (private, lifecycle)
│  ├─ Frontend bucket (public, static hosting)
│  └─ Logs bucket (private, access logs receiver)
│
├─ DynamoDB Tables
│  ├─ Users table (auth)
│  ├─ Classes table
│  ├─ Submissions table
│  ├─ Progress table
│  ├─ Rewards table
│  ├─ Memberships table
│  └─ Sessions table (optional, for distributed cache)
│
├─ Lambda Functions (12 total)
│  ├─ Generate Lambda (1GB, ARM_64)
│  ├─ Download Lambda
│  ├─ Auth Lambda
│  ├─ Solve Lambda
│  ├─ Submit Lambda
│  ├─ Progress Lambda
│  ├─ Analytics Lambda
│  ├─ Class Lambda
│  ├─ Rewards Lambda
│  ├─ Student Lambda
│  ├─ Question Bank Lambda
│  ├─ Admin Lambda
│  └─ Certificates Lambda
│
├─ API Gateway (REST API)
│  ├─ Resources (/api/generate, /api/solve/{id}, etc.)
│  ├─ Methods (GET, POST, etc.)
│  └─ Integration → Lambda functions
│
├─ CloudFront Distribution
│  ├─ Origins: API Gateway + S3 Frontend
│  ├─ Behaviors: /api/* → API, /* → S3
│  └─ Custom domain (if enabled)
│
├─ IAM Roles & Policies
│  ├─ Lambda execution role
│  │  ├─ S3: ReadWrite on worksheets, Read on frontend
│  │  ├─ DynamoDB: ReadWrite on all tables
│  │  ├─ CloudWatch: PutLogs
│  │  ├─ Secrets Manager: GetSecretValue
│  │  └─ X-Ray: WriteAccessPolicy (prod only)
│  │
│  └─ API Gateway service role (minimal)
│
├─ Secrets Manager
│  ├─ /learnfyra/dev/anthropic-api-key
│  ├─ /learnfyra/dev/jwt-secret
│  └─ (same for staging/prod)
│
├─ Systems Manager Parameter Store
│  ├─ /learnfyra/dev/allowed-origin
│  └─ /learnfyra/dev/slack-webhook
│
├─ CloudWatch
│  ├─ Log Groups (API Gateway, Lambda, CloudFront)
│  ├─ Dashboards (Backend Observability)
│  ├─ Alarms (error rate, throttles, latency)
│  └─ SNS topics for alerts
│
├─ Route53 (DNS)
│  ├─ Hosted Zone (if custom domain enabled)
│  ├─ A records (alias to CloudFront)
│  └─ CNAME records (api.learnfyra.com, etc.)
│
├─ AWS Certificate Manager (ACM)
│  └─ TLS certificates for custom domains
│
└─ SNS Topics
   ├─ deploy-notifications
   ├─ alerts-errors
   ├─ alerts-throttles
   └─ alerts-latency
     ├── Subscriptions:
     │   ├─ Slack webhook
     │   ├─ Email (ops team)
     │   └─ PagerDuty (on-call)
```

---

**Document Status:** Production-Ready  
**Last Updated:** March 26, 2026  
**References:** GitHub Actions Docs, AWS CDK Docs
