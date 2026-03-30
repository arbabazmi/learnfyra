# CI/CD Architecture

## Pipeline Overview

```
Developer pushes code
     │
     ├── PR to any branch → CI workflow (lint + test + coverage gate)
     │
     ├── Push to develop  → deploy-dev workflow
     │
     ├── Push to staging  → deploy-staging workflow + smoke tests
     │
     └── Push to main     → deploy-prod workflow (manual approval required)
```

## GitHub Actions Workflows

### ci.yml — Runs on Every PR

```yaml
name: CI
on:
  pull_request:
    branches: [main, develop, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - name: Coverage gate (80% minimum)
        run: npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
      - name: Validate CDK synth
        run: cd infra && npm ci && npx cdk synth --context env=dev
      - name: Check all new files
        run: |
          for f in $(git diff --name-only HEAD~1 -- '*.js'); do
            node --check "$f"
          done
```

### deploy-dev.yml — Runs on Push to develop

```yaml
name: Deploy Dev
on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: npm ci && npm test
      - run: cd infra && npm ci && npx cdk deploy --context env=dev --require-approval never
      - run: aws s3 sync frontend/ s3://learnfyra-dev-s3-frontend/ --delete
      - name: Smoke test
        run: curl -f https://api.dev.learnfyra.com/api/health
```

### deploy-staging.yml — Runs on Push to staging

```yaml
name: Deploy Staging
on:
  push:
    branches: [staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: npm ci && npm test
      - run: cd infra && npm ci && npx cdk deploy --context env=staging --require-approval never
      - run: aws s3 sync frontend/ s3://learnfyra-staging-s3-frontend/ --delete
      - name: Full smoke test suite
        run: npm run test:smoke -- --env=staging
```

### deploy-prod.yml — Runs on Push to main (Manual Approval)

```yaml
name: Deploy Production
on:
  push:
    branches: [main]

jobs:
  approve:
    runs-on: ubuntu-latest
    environment: production   # GitHub environment with required reviewers
    steps:
      - name: Await manual approval
        run: echo "Waiting for manual approval in GitHub environment..."

  deploy:
    needs: approve
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: npm ci && npm test
      - run: cd infra && npm ci && npx cdk deploy --context env=prod --require-approval never
      - run: aws s3 sync frontend/ s3://learnfyra-prod-s3-frontend/ --delete
      - name: Production smoke test
        run: curl -f https://api.learnfyra.com/api/health
```

## Environment Promotion Gates

### local → dev
- `npm test` passes (all unit tests)
- `npm run test:coverage` shows >= 80% line coverage
- Manual smoke test on localhost:3000 documented (run ID or screenshot)
- `node --check` passes on all new/modified files
- `cdk synth --context env=dev` passes with zero warnings

### dev → staging
- All CI checks pass on the PR
- Dev deploy workflow succeeds
- Dev smoke test endpoint returns 200
- CloudWatch shows no ERROR-level logs in dev for 30 minutes post-deploy
- PR reviewed and approved by at least 1 team member

### staging → prod
- Full regression test suite passes on staging environment
- CloudWatch alarms healthy for 24 hours post-staging deploy
- No P0 or P1 issues open in GitHub Issues
- Manual sign-off from team lead in GitHub PR review
- Production deploy approved via GitHub environment protection rule

## Branch Strategy

| Branch | Purpose | Auto-deploy to |
|---|---|---|
| `feature/*` | Individual feature work | None |
| `fix/*` | Bug fixes | None |
| `develop` | Integration branch | dev environment |
| `staging` | Pre-prod validation | staging environment |
| `main` | Production | prod (manual approval) |

Merge flow: `feature/* → develop → staging → main`

## GitHub Repository Secrets Setup

```
Settings → Secrets and variables → Actions:

Repository secrets (shared across all environments):
  AWS_REGION = us-east-1

Environment secrets (per environment):
  dev environment:
    AWS_ACCESS_KEY_ID        (IAM user with dev deploy permissions)
    AWS_SECRET_ACCESS_KEY
    ANTHROPIC_API_KEY_DEV

  staging environment:
    AWS_ACCESS_KEY_ID        (IAM user with staging deploy permissions)
    AWS_SECRET_ACCESS_KEY
    ANTHROPIC_API_KEY_STAGING

  production environment:
    AWS_ACCESS_KEY_ID        (IAM user with prod deploy permissions)
    AWS_SECRET_ACCESS_KEY
    ANTHROPIC_API_KEY_PROD
    Required reviewers: [team lead GitHub username]
```

## IAM Deploy User Permissions

Each environment has a dedicated IAM user `learnfyra-deploy-{env}` with least-privilege permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["cloudformation:*"], "Resource": "arn:aws:cloudformation:us-east-1:*:stack/LearnfyraStack-{env}/*" },
    { "Effect": "Allow", "Action": ["lambda:*"], "Resource": "arn:aws:lambda:us-east-1:*:function:learnfyra-*-{env}" },
    { "Effect": "Allow", "Action": ["s3:*"], "Resource": ["arn:aws:s3:::learnfyra-{env}-*", "arn:aws:s3:::learnfyra-{env}-*/*"] },
    { "Effect": "Allow", "Action": ["apigateway:*"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["iam:PassRole", "iam:GetRole", "iam:CreateRole"], "Resource": "arn:aws:iam::*:role/learnfyra-*" }
  ]
}
```

## npm Scripts

```json
{
  "scripts": {
    "start": "node index.js",
    "server": "node server.js",
    "test": "node --experimental-vm-modules node_modules/jest-cli/bin/jest.js",
    "test:coverage": "node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --coverage",
    "test:watch": "node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --watch",
    "test:integration": "node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/integration"
  }
}
```

Note on Windows Jest: Use the full path `node_modules/jest-cli/bin/jest.js` instead of `node_modules/.bin/jest` because `.bin/jest` is a bash shim that does not work on Windows.
