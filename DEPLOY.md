# Learnfyra — Deployment Guide

Deployments are driven by **GitHub Actions**. CI still runs automatically on
push and pull request events, while environment deployments are controlled by
workflow policy. No local AWS credentials or CDK CLI needed for normal deploys.

---

## How Deployments Work

| Action | Pipeline triggered | Environment |
|---|---|---|
| Manually run from GitHub Actions | `deploy-dev.yml` | Dev |
| Push to `staging` | `deploy-staging.yml` | Staging |
| Manually run from GitHub Actions | `deploy-prod.yml` (still needs manual approval) | Production |

Each pipeline: runs tests → assumes IAM role via OIDC → deploys CDK stack →
syncs frontend to S3 → invalidates CloudFront cache.

Current operating policy:

- Dev deploys are manual-only.
- Staging still auto-deploys on push to `staging`.
- Production no longer auto-deploys on push to `main`.
- Production workflow remains available for intentional manual runs and still
  requires the GitHub `production` environment approval gate.

---

## One-Time Setup (do this before the first push)

### Step 1 — Create the GitHub Actions IAM Role in AWS

GitHub Actions authenticates to AWS using **OIDC** (no long-lived access keys).
You create one IAM role, store its ARN in GitHub, and the pipeline assumes it automatically.

**In AWS Console → IAM → Identity providers → Add provider:**
- Provider type: `OpenID Connect`
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

**Then create an IAM Role → Trusted entity: Web identity:**
- Identity provider: `token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`
- Add condition: `token.actions.githubusercontent.com:sub` = `repo:YOUR_GITHUB_USERNAME/learnfyra:*`

**Attach these permissions policies to the role:**
- `AmazonS3FullAccess`
- `AWSLambda_FullAccess`
- `AmazonAPIGatewayAdministrator`
- `CloudFrontFullAccess`
- `AmazonSSMFullAccess`
- `AWSCloudFormationFullAccess`
- `IAMFullAccess` *(CDK needs this to create Lambda execution roles)*

> For simplicity, you can attach `AdministratorAccess` instead of all the above.

The role has already been created as **`learnfyra-GitHubActionsDeployRole`**.

Its ARN follows this pattern:
```
arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/learnfyra-GitHubActionsDeployRole
```
Replace `YOUR_AWS_ACCOUNT_ID` with your 12-digit AWS account ID — this is the value
you store in the `AWS_DEPLOY_ROLE_ARN` secret (see Step 3).

---

### Step 2 — CDK Bootstrap (one time per AWS account/region)

Run this once from your local machine (requires AWS CLI with admin credentials):

```bash
cd infra/cdk
npm install
npx cdk bootstrap aws://YOUR_AWS_ACCOUNT_ID/us-east-1
```

---

### Step 3 — Configure GitHub Repository Secrets and Variables

Go to your GitHub repo → **Settings → Secrets and variables → Actions**.

#### Secrets (encrypted — for sensitive values)

| Secret name | Value | Where to find it |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::123456789012:role/learnfyra-GitHubActionsDeployRole` | From Step 1 |
| `ANTHROPIC_API_KEY_DEV` | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_API_KEY_STAGING` | `sk-ant-...` | Same |
| `ANTHROPIC_API_KEY_PROD` | `sk-ant-...` | Same |

#### Variables (non-sensitive — visible in logs)

| Variable name | Value | Notes |
|---|---|---|
| `AWS_ACCOUNT_ID` | `123456789012` | Your 12-digit AWS account ID |
| `AWS_REGION` | `us-east-1` | Region to deploy to |

> **Secrets vs Variables:** Use **Secrets** for API keys and role ARNs (masked in logs).
> Use **Variables** for non-sensitive config like region and account ID (shown in logs).

---

### Step 4 — Configure GitHub Environments

Go to **Settings → Environments** and create three environments:

| Environment name | Purpose | Protection rules |
|---|---|---|
| `dev` | Development deploys | None (manual workflow only) |
| `staging` | Staging deploys | None (auto-deploys on push to `staging`) |
| `production` | Production deploys | **Add required reviewers** (yourself or your team) |

The `production` environment gate is what triggers the manual approval step
before `deploy-prod.yml` can deploy to AWS.

---

## Deploying

### Deploy to dev manually
1. Open **GitHub → Actions → Deploy — Dev**.
2. Click **Run workflow**.
3. Select the branch you want to deploy from.
4. Start the workflow and monitor the job output.

This is now the only supported path for dev deployment.

### Promote to staging
```bash
git checkout staging
git merge develop
git push origin staging
```

The `deploy-staging.yml` pipeline still runs automatically on push to `staging`.

### Production workflow

Production no longer auto-deploys from pushes to `main`.

If you intentionally decide to deploy prod later:

1. Open **GitHub → Actions → Deploy — Production**.
2. Click **Run workflow**.
3. Select the branch you want to deploy from.
4. Approve the `production` environment gate when GitHub prompts for approval.

---

## Manual Deploy Commands (Local Terminal)

Use these when you want to deploy directly from your machine without going through GitHub Actions.
Requires: AWS CLI configured with credentials for account `796929287685`, and `cd infra/cdk` first.

### Dev (deployed — run again after code changes)
```powershell
cd infra/cdk
npx cdk deploy `
  --context env=dev `
  --context enableCustomDomains=true `
  --context rootDomainName=learnfyra.com `
  --context hostedZoneId=Z027880820G9W7LYJRE7H `
  --context apiCertificateArn=arn:aws:acm:us-east-1:796929287685:certificate/abb068ee-3a48-4546-bb30-b494d7fe1ea7 `
  --require-approval never `
  --outputs-file cdk-outputs.json
```
After deploy, sync frontend:
```powershell
aws s3 sync ../../frontend/ s3://learnfyra-dev-s3-frontend/ --delete --region us-east-1
```

### QA / Staging (run when ready — creates web.qa / api.qa / admin.qa)
```powershell
cd infra/cdk
npx cdk deploy `
  --context env=staging `
  --context enableCustomDomains=true `
  --context rootDomainName=learnfyra.com `
  --context hostedZoneId=Z027880820G9W7LYJRE7H `
  --context cloudFrontCertificateArn=arn:aws:acm:us-east-1:796929287685:certificate/abb068ee-3a48-4546-bb30-b494d7fe1ea7 `
  --context apiCertificateArn=arn:aws:acm:us-east-1:796929287685:certificate/abb068ee-3a48-4546-bb30-b494d7fe1ea7 `
  --require-approval never `
  --outputs-file cdk-outputs.json
```
After deploy, sync frontend + invalidate CloudFront:
```powershell
$bucket = (Get-Content cdk-outputs.json | ConvertFrom-Json).'LearnfyraStack-staging'.FrontendBucketName
$distId = (Get-Content cdk-outputs.json | ConvertFrom-Json).'LearnfyraStack-staging'.DistributionId
aws s3 sync ../../frontend/ s3://$bucket/ --delete --region us-east-1
aws cloudfront create-invalidation --distribution-id $distId --paths "/*"
```

### Production (run when ready — creates learnfyra.com / api.learnfyra.com / admin.learnfyra.com)
```powershell
cd infra/cdk
npx cdk deploy `
  --context env=prod `
  --context enableCustomDomains=true `
  --context rootDomainName=learnfyra.com `
  --context hostedZoneId=Z027880820G9W7LYJRE7H `
  --context cloudFrontCertificateArn=arn:aws:acm:us-east-1:796929287685:certificate/abb068ee-3a48-4546-bb30-b494d7fe1ea7 `
  --context apiCertificateArn=arn:aws:acm:us-east-1:796929287685:certificate/abb068ee-3a48-4546-bb30-b494d7fe1ea7 `
  --require-approval never `
  --outputs-file cdk-outputs.json
```
After deploy, sync frontend + invalidate CloudFront:
```powershell
$bucket = (Get-Content cdk-outputs.json | ConvertFrom-Json).'LearnfyraStack-prod'.FrontendBucketName
$distId = (Get-Content cdk-outputs.json | ConvertFrom-Json).'LearnfyraStack-prod'.DistributionId
aws s3 sync ../../frontend/ s3://$bucket/ --delete --region us-east-1
aws cloudfront create-invalidation --distribution-id $distId --paths "/*"
```

### Dev Resources — Live (Deployed March 25, 2026)
| Resource | URL |
|---|---|
| Frontend | `http://web.dev.learnfyra.com` |
| API | `https://api.dev.learnfyra.com` |
| Admin | `http://admin.dev.learnfyra.com` |
| Auth | `https://auth.dev.learnfyra.com` |
| API Gateway (direct) | `https://fcciuafjrj.execute-api.us-east-1.amazonaws.com/dev/` |
| Frontend S3 (direct) | `http://learnfyra-dev-s3-frontend.s3-website-us-east-1.amazonaws.com` |

---

## Resource Naming Convention

All AWS resources follow `learnfyra-{env}-{service-type}`:

| Resource | Dev | Staging | Prod |
|---|---|---|---|
| Worksheet S3 bucket | `learnfyra-dev-s3-worksheets` | `learnfyra-staging-s3-worksheets` | `learnfyra-prod-s3-worksheets` |
| Frontend S3 bucket | `learnfyra-dev-s3-frontend` | `learnfyra-staging-s3-frontend` | `learnfyra-prod-s3-frontend` |
| Generate Lambda | `learnfyra-dev-lambda-generate` | `learnfyra-staging-lambda-generate` | `learnfyra-prod-lambda-generate` |
| Download Lambda | `learnfyra-dev-lambda-download` | `learnfyra-staging-lambda-download` | `learnfyra-prod-lambda-download` |
| API Gateway | `learnfyra-dev-apigw` | `learnfyra-staging-apigw` | `learnfyra-prod-apigw` |
| SSM param | `/learnfyra/dev/anthropic-api-key` | `/learnfyra/staging/anthropic-api-key` | `/learnfyra/prod/anthropic-api-key` |

---

## Pipeline Summary

```
ci.yml            Every PR → tests + coverage gate + CDK synth dry run
deploy-dev.yml    Manual run → test → deploy dev
deploy-staging.yml Push to staging → test + coverage → deploy staging
deploy-prod.yml   Manual run → test + coverage → manual approval → deploy prod
```

Each deploy pipeline also writes the Anthropic API key to SSM automatically,
so you never need to touch SSM manually after the first bootstrap.

---

## Custom Domains (learnfyra.com)

For environment subdomains and routing strategy, use:

- docs/operations/domain-routing-plan-learnfyra-com.md

CDK supports optional domain provisioning through context values:

- enableCustomDomains
- rootDomainName
- hostedZoneId
- cloudFrontCertificateArn
- apiCertificateArn

When `enableCustomDomains` is not provided, stack behavior remains unchanged.

---

## Troubleshooting

**Pipeline fails at "Configure AWS credentials"**
→ Check `AWS_DEPLOY_ROLE_ARN` secret is set correctly and the OIDC provider
  exists in your AWS account (Step 1).

**CDK deploy fails with "This CDK CLI is not compatible with the CDK library"**
→ Run `cd infra/cdk && npm ci` locally, commit the updated `package-lock.json`.

**`npx cdk bootstrap` fails with "Policy contains a statement with one or more invalid principals"**
→ The OIDC provider wasn't created before the role. Complete Step 1 fully before bootstrapping.

**CloudFront URL returns 403**
→ Wait 5–10 minutes after first deploy for CloudFront to fully propagate.
  Then re-run the cache invalidation step manually if needed.
