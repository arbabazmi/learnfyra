# EduSheet AI — Deployment Guide

Deployments are driven by **GitHub Actions**. Pushing to a branch triggers the
corresponding pipeline automatically. No local AWS credentials or CDK CLI needed.

---

## How Deployments Work

| Branch pushed to | Pipeline triggered | Environment |
|---|---|---|
| `develop` | `deploy-dev.yml` | Dev |
| `staging` | `deploy-staging.yml` | Staging |
| `main` | `deploy-prod.yml` (needs manual approval) | Production |

Each pipeline: runs tests → assumes IAM role via OIDC → deploys CDK stack →
syncs frontend to S3 → invalidates CloudFront cache.

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
- Add condition: `token.actions.githubusercontent.com:sub` = `repo:YOUR_GITHUB_USERNAME/edusheet-ai:*`

**Attach these permissions policies to the role:**
- `AmazonS3FullAccess`
- `AWSLambda_FullAccess`
- `AmazonAPIGatewayAdministrator`
- `CloudFrontFullAccess`
- `AmazonSSMFullAccess`
- `AWSCloudFormationFullAccess`
- `IAMFullAccess` *(CDK needs this to create Lambda execution roles)*

> For simplicity, you can attach `AdministratorAccess` instead of all the above.

Note the role ARN — it looks like `arn:aws:iam::123456789012:role/YourRoleName`.

**Or use this AWS CLI command to create the trust policy:**
```bash
# Replace YOUR_GITHUB_USERNAME and YOUR_AWS_ACCOUNT_ID
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/edusheet-ai:*"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
EOF

aws iam create-role \
  --role-name edusheet-github-actions-deploy \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name edusheet-github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

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
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::123456789012:role/edusheet-github-actions-deploy` | From Step 1 |
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
| `dev` | Development deploys | None (auto-deploys on push to `develop`) |
| `staging` | Staging deploys | None (auto-deploys on push to `staging`) |
| `production` | Production deploys | **Add required reviewers** (yourself or your team) |

The `production` environment gate is what triggers the manual approval step
before `deploy-prod.yml` can deploy to AWS.

---

## Deploying

### First deploy to dev
```bash
git checkout -b develop
git push origin develop
```
The `deploy-dev.yml` pipeline runs automatically. Watch it at:
`https://github.com/YOUR_GITHUB_USERNAME/edusheet-ai/actions`

### Promote to staging
```bash
git checkout staging
git merge develop
git push origin staging
```

### Promote to production
```bash
git checkout main
git merge staging
git push origin main
# → GitHub will pause and ask for manual approval before deploying
```

---

## Resource Naming Convention

All AWS resources follow `edusheet-{env}-{service-type}`:

| Resource | Dev | Staging | Prod |
|---|---|---|---|
| Worksheet S3 bucket | `edusheet-dev-s3-worksheets` | `edusheet-staging-s3-worksheets` | `edusheet-prod-s3-worksheets` |
| Frontend S3 bucket | `edusheet-dev-s3-frontend` | `edusheet-staging-s3-frontend` | `edusheet-prod-s3-frontend` |
| Generate Lambda | `edusheet-dev-lambda-generate` | `edusheet-staging-lambda-generate` | `edusheet-prod-lambda-generate` |
| Download Lambda | `edusheet-dev-lambda-download` | `edusheet-staging-lambda-download` | `edusheet-prod-lambda-download` |
| API Gateway | `edusheet-dev-apigw` | `edusheet-staging-apigw` | `edusheet-prod-apigw` |
| SSM param | `/edusheet/dev/anthropic-api-key` | `/edusheet/staging/anthropic-api-key` | `/edusheet/prod/anthropic-api-key` |

---

## Pipeline Summary

```
ci.yml            Every PR → tests + coverage gate + CDK synth dry run
deploy-dev.yml    Push to develop → test → deploy dev
deploy-staging.yml Push to staging → test + coverage → deploy staging
deploy-prod.yml   Push to main → test + coverage → manual approval → deploy prod
```

Each deploy pipeline also writes the Anthropic API key to SSM automatically,
so you never need to touch SSM manually after the first bootstrap.

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
