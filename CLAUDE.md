# EduSheet AI — Agent Teams System Prompt
# File: CLAUDE.md (project root)
# Version: 3.0 — Online Solve & Answer Validation Edition
# Updated: March 2026

## Project Overview
EduSheet AI generates AI-powered, USA curriculum-aligned worksheets for Grades 1–10.
It runs as both a local CLI and a serverless web app deployed on AWS.
**Students can now solve worksheets online, get instant scoring, and review answers — with optional timed mode.**

Repository: https://github.com/arbabazmi/edusheet-ai
Stack: Node.js 18+, Anthropic Claude API, Puppeteer, docx npm, Inquirer, Jest
AWS: Lambda, S3, API Gateway, CloudFront, Secrets Manager
IaC: AWS CDK (TypeScript)
CI/CD: GitHub Actions

---

## Current Project State (March 2026) — READ BEFORE DOING ANY WORK

### ALREADY BUILT — do not rebuild, only extend
- src/ai/           → client.js, generator.js, promptBuilder.js, topics.js
- src/cli/          → prompts.js, validator.js, batchRunner.js
- src/exporters/    → index.js, htmlExporter.js, pdfExporter.js, docxExporter.js, answerKey.js
- src/templates/    → worksheet.html.js, styles.css.js
- src/utils/        → fileUtils.js, logger.js, retryUtils.js
- tests/            → unit/ and integration/ with fixtures
- frontend/         → index.html, css/styles.css, js/app.js (modern teal/orange UI)
- backend/handlers/ → generateHandler.js, downloadHandler.js
- backend/middleware/→ validator.js (with optional student/class field validation)
- server.js         → local Express dev server with full field passthrough
- infra/cdk/        → AWS CDK stack (TypeScript)
- .github/workflows/→ CI/CD pipelines (ci, deploy-dev, deploy-staging, deploy-prod)

### NEEDS WORK
- frontend/         → configure for S3 static hosting + CloudFront URLs (local dev works via server.js)

### NOT YET BUILT — Online Solve & Answer Validation (feature/online-solve)
- frontend/solve.html              → Interactive solve page (renders questions, timer, input fields)
- frontend/js/solve.js             → Solve page logic (timer, answer capture, submit, scoring)
- frontend/css/solve.css           → Solve page styles (or extend styles.css)
- backend/handlers/submitHandler.js→ POST /api/submit — validates student answers against answer key
- backend/handlers/solveHandler.js → GET /api/solve/{id} — returns worksheet questions (no answers)
- src/solve/                       → scoring engine, answer comparator, result builder
- src/solve/scorer.js              → compares student answers to correct answers, calculates score
- src/solve/resultBuilder.js       → builds result HTML/JSON with score, correct/incorrect breakdown
- Worksheet JSON storage: S3 solve-data.json (prod) / local worksheets-local/{uuid}/solve-data.json (dev)
  → JSON chosen over DynamoDB: write-once-read-many, small per worksheet, no extra AWS service cost,
    native to Node.js, works with S3 lifecycle rules, no cross-worksheet querying needed
- tests/unit/scorer.test.js        → scoring engine tests
- tests/unit/submitHandler.test.js → submit handler tests
- tests/integration/solve.test.js  → end-to-end solve flow tests

---

## Feature: Online Solve & Answer Validation (v3.0)

### User Stories
1. As a **student**, I want to solve a worksheet online so that I don't need to print it.
2. As a **student**, I want to choose timed or untimed mode so that I can practice under test conditions or at my own pace.
3. As a **student**, I want to see my score and which answers were correct/incorrect after submitting so I can learn from my mistakes.
4. As a **teacher**, I want students to get instant feedback with explanations so they can self-study.

### Flow — How Online Solve Works
```
┌─────────────────────────────────────────────────────────────┐
│ GENERATE FLOW (existing)                                     │
│                                                              │
│  Teacher fills form → POST /api/generate → Claude AI         │
│  → worksheet JSON (questions + answers) saved to storage     │
│  → returns worksheetId + download links + "Solve Online" btn │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ SOLVE FLOW (NEW)                                             │
│                                                              │
│  Student clicks "Solve Online" → GET /api/solve/{id}         │
│  → returns questions ONLY (no answers, no explanations)      │
│  → renders solve.html with interactive form                  │
│                                                              │
│  Student chooses:                                            │
│    ☐ Timed mode (countdown from estimatedTime)               │
│    ☐ Untimed mode (no timer, solve at own pace)              │
│                                                              │
│  Student fills answers → clicks "Submit"                     │
│  → POST /api/submit { worksheetId, answers[], timeTaken }    │
│  → server compares answers against stored answer key         │
│  → returns score + per-question breakdown                    │
│                                                              │
│  Results page shows:                                         │
│    ✓ Total score (e.g. 8/10 — 80%)                          │
│    ✓ Per-question: correct ✅ / incorrect ❌ + explanation   │
│    ✓ Time taken                                              │
│    ✓ "Try Again" / "Generate New" buttons                    │
└─────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
```
Given a generated worksheet exists in storage
When the student clicks "Solve Online"
Then they see the questions rendered as interactive form inputs (no answers visible)

Given the student is on the solve page
When they select "Timed Mode"
Then a countdown timer starts from the worksheet's estimatedTime
And the worksheet auto-submits when time runs out

Given the student is on the solve page
When they select "Untimed Mode"
Then no timer is shown and they can submit whenever ready

Given the student has filled in answers
When they click "Submit" (or timer expires)
Then POST /api/submit is called with their answers
And the response includes total score, per-question results, and explanations

Given the student views results
When they see the score breakdown
Then correct answers show ✅ with points earned
And incorrect answers show ❌ with the correct answer + explanation
And the total score and percentage are displayed prominently

Given a worksheet is generated
When the system stores it
Then questions AND answers are saved as JSON to S3 (prod) or local file (dev)
And the worksheetId is a UUID that maps to the stored JSON
```

### Question Type → Input Mapping
| Question Type       | Solve UI Input                              | Scoring Rule                        |
|--------------------|--------------------------------------------|-------------------------------------|
| multiple-choice    | Radio buttons (A/B/C/D)                     | Exact match on option letter        |
| true-false         | Radio buttons (True/False)                  | Exact match                         |
| fill-in-the-blank  | Text input                                  | Case-insensitive, trimmed match     |
| short-answer       | Textarea                                    | Case-insensitive keyword match      |
| matching           | Dropdown selects for each pair              | Exact match per pair                |
| show-your-work     | Textarea + final answer input               | Score final answer only             |
| word-problem       | Textarea + final answer input               | Score final answer only             |

### Worksheet Storage Schema (extends existing)
```json
{
  "worksheetId": "uuid-v4",
  "generatedAt": "ISO-8601",
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "estimatedTime": "20 minutes",
  "timerSeconds": 1200,
  "totalPoints": 10,
  "questions": [
    {
      "number": 1,
      "type": "multiple-choice",
      "question": "What is 6 × 7?",
      "options": ["A. 36", "B. 42", "C. 48", "D. 54"],
      "answer": "B",
      "explanation": "6 × 7 = 42",
      "points": 1
    }
  ]
}
```

### Submit Request / Response Schema
```json
// POST /api/submit
// Request:
{
  "worksheetId": "uuid-v4",
  "studentName": "optional string",
  "answers": [
    { "number": 1, "answer": "B" },
    { "number": 2, "answer": "True" },
    { "number": 3, "answer": "42" }
  ],
  "timeTaken": 845,
  "timed": true
}

// Response:
{
  "worksheetId": "uuid-v4",
  "totalScore": 8,
  "totalPoints": 10,
  "percentage": 80,
  "timeTaken": 845,
  "timed": true,
  "results": [
    {
      "number": 1,
      "correct": true,
      "studentAnswer": "B",
      "correctAnswer": "B",
      "explanation": "6 × 7 = 42",
      "pointsEarned": 1,
      "pointsPossible": 1
    },
    {
      "number": 2,
      "correct": false,
      "studentAnswer": "True",
      "correctAnswer": "False",
      "explanation": "The Sun is a star, not a planet.",
      "pointsEarned": 0,
      "pointsPossible": 1
    }
  ]
}
```

### S3 Key Structure for Solve Data
```
edusheet-ai-worksheets-{env}/
  worksheets/{year}/{month}/{day}/{uuid}/
    worksheet.pdf
    worksheet.docx
    worksheet.html
    answer-key.pdf
    answer-key.docx
    metadata.json
    solve-data.json          ← NEW: full worksheet JSON with answers for scoring
```

Local storage (dev mode):
```
worksheets-local/{uuid}/
  solve-data.json
  worksheet.html
  answer-key.html
```

### New API Endpoints
```
GET  /api/solve/{worksheetId}     → returns questions only (no answers)
POST /api/submit                  → validates answers, returns score
```

### New Lambda Functions (IaC agent adds to CDK)
```
edusheet-solve    GET  /api/solve/{id}  10s  128MB
edusheet-submit   POST /api/submit      15s  256MB
```

### File Structure for Online Solve
```
frontend/
  solve.html                  ← solve page (standalone HTML served by CloudFront/Express)
  js/solve.js                 ← timer, answer capture, submit, results rendering
  css/solve.css               ← solve page styles (matches main theme)

backend/handlers/
  solveHandler.js             ← GET /api/solve/{id} — reads solve-data.json, strips answers
  submitHandler.js            ← POST /api/submit — reads solve-data.json, scores answers

src/solve/
  scorer.js                   ← answer comparison logic per question type
  resultBuilder.js            ← builds score summary + per-question breakdown

tests/unit/
  scorer.test.js              ← scoring engine unit tests
  submitHandler.test.js       ← submit handler tests
  solveHandler.test.js        ← solve handler tests
tests/integration/
  solve.test.js               ← full solve flow integration test
```

---

## Agent Teams Setup

### Enable Agent Teams
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
claude --teammate-mode
```
Requires Claude Code v2.1.32+. Uses ~3-4x tokens vs single session — worth it for parallel work.

### Team Structure
```
ORCHESTRATOR (main session — you)
├── ba-agent      → requirements and specs
├── dev-agent     → application and Lambda code
├── qa-agent      → tests and verification
├── dba-agent     → data schemas and curriculum
├── devops-agent  → AWS services and CI/CD pipelines
└── iac-agent     → AWS CDK infrastructure code
```

### When to use Agent Teams vs Subagents
Use Agent Teams (--teammate-mode) when:
- Building multiple layers simultaneously (Lambda handler + CDK stack + tests)
- Agents need to share discoveries mid-task (DEV tells IaC about new env vars)
- Parallel workstreams that would block each other sequentially

Use subagents (.claude/agents/) when:
- Single focused task (fix one bug, write one spec, add one test)
- No cross-agent coordination needed

---

## Agent 1: BA — Business Analyst

Triggers: requirements, spec, user story, acceptance criteria, feature,
          scope, what should this do, business rules, clarify

Responsibilities:
- Write feature specs BEFORE any code or infrastructure is created
- Define acceptance criteria in Given/When/Then format
- Identify AWS-specific considerations (which services, data flow, costs)
- **Advise DEV agent** on exactly what to build, which files, function signatures
- **Advise QA agent** on what to test, boundary values, edge cases
- Never write code or CDK — only specs and documentation
- Track feature completion: review QA results, confirm "done" or request fixes

Output format every time:
```
## Feature: [Name]
### User Story
As a [teacher/student/developer], I want [action], so that [benefit].
### Acceptance Criteria
Given [context] When [action] Then [result]
(minimum 3 criteria — include at least 1 AWS/deployment criteria for backend features)
### Out of Scope
### AWS Services Involved
### Dependencies
### Open Questions
```

BA rules:
- Align all educational content to CCSS (Math/ELA) and NGSS (Science)
- Always test boundary cases: Grade 1, Grade 10, 5 questions, 30 questions
- For any feature touching AWS: specify the service, expected latency, cost impact

---

## Agent 2: DEV — Application Developer

Triggers: build, implement, code, create file, write function, fix bug,
          add feature, make it work, refactor, Lambda handler

Responsibilities:
- Write Node.js ESM application code and Lambda handlers
- Optimize for Lambda cold starts
- Never hardcode secrets — always process.env
- Read existing code before modifying — never assume what's there

Coding standards:
```javascript
/**
 * @file backend/handlers/generateHandler.js
 * @description Lambda handler for worksheet generation
 */

// Lazy imports for cold start optimization
let worksheetGenerator;
const getGenerator = async () => {
  if (!worksheetGenerator) {
    const { generateWorksheet } = await import('../../src/ai/generator.js');
    worksheetGenerator = generateWorksheet;
  }
  return worksheetGenerator;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  try {
    const body = JSON.parse(event.body || '{}');
    // ... implementation
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
```

Lambda rules:
- context.callbackWaitsForEmptyEventLoop = false on every handler
- Always return statusCode + headers (with CORS) + body
- Use /tmp for temporary files in Lambda (max 512MB)
- Timeouts: generate=60s, download=30s, list=10s
- Memory: generate=1024MB, download=256MB, list=128MB
- Read ANTHROPIC_API_KEY from process.env (CDK/Secrets Manager injects it)

File structure:
- Application code: src/ (already built — extend only)
- Lambda handlers: backend/handlers/
- Lambda middleware: backend/middleware/
- Lambda utils: backend/utils/

---

## Agent 3: QA — Quality Assurance Engineer

Triggers: test, verify, check, bug, broken, assert, coverage, edge case,
          regression, validate, QA review, does it work

Responsibilities:
- Write Jest unit and integration tests
- Write Lambda handler tests using mock API Gateway events
- Mock all AWS SDK calls — never call real AWS in tests
- Maintain 80%+ coverage

Lambda test pattern:
```javascript
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Mock = mockClient(S3Client);
beforeEach(() => s3Mock.reset());

const mockEvent = (body) => ({
  httpMethod: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  pathParameters: null,
  queryStringParameters: null
});

const mockContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'edusheet-generate',
  getRemainingTimeInMillis: () => 60000
};

it('returns 200 with valid worksheet request', async () => {
  s3Mock.on(PutObjectCommand).resolves({});
  const result = await handler(mockEvent({ grade: 3, subject: 'Math' }), mockContext);
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toHaveProperty('worksheetUrl');
});
```

QA checklist after every DEV or IaC task:
```
□ node --check passes on all modified files
□ No regressions in existing tests
□ Happy path + error path + OPTIONS (CORS preflight) tested
□ Boundary values tested (grade 1, grade 10, 5 questions, 30 questions)
□ CORS headers present on all Lambda responses
□ S3 presigned URL format is correct
□ Coverage still above 80% (npm run test:coverage)
□ No AWS credentials or secrets in test files
```

Rules:
- Use aws-sdk-client-mock for all AWS SDK mocking
- Integration tests must clean up any S3 objects created
- Every bug fix needs a failing regression test written first
- CDK stack tests go in infra/test/ using @aws-cdk/assertions

---

## Agent 4: DBA — Data Architect

Triggers: schema, data model, json structure, config, curriculum,
          topics list, grade data, data validation, S3 structure, metadata

Responsibilities:
- Own worksheet JSON schema and S3 key structure
- Maintain curriculum mappings in src/ai/topics.js
- Define metadata stored with every worksheet
- Validate data accuracy against CCSS/NGSS standards

Canonical Worksheet JSON Schema v1 — do not change without updating this file:
```json
{
  "$schema": "edusheet-ai/worksheet/v1",
  "title": "string",
  "grade": "integer 1-10",
  "subject": "enum: Math | ELA | Science | Social Studies | Health",
  "topic": "string",
  "difficulty": "enum: Easy | Medium | Hard | Mixed",
  "standards": ["CCSS or NGSS code strings"],
  "estimatedTime": "string e.g. 20 minutes",
  "instructions": "string",
  "totalPoints": "integer",
  "questions": [{
    "number": "integer starting at 1",
    "type": "enum: multiple-choice|fill-in-the-blank|short-answer|true-false|matching|show-your-work|word-problem",
    "question": "string",
    "options": ["A B C D — multiple-choice only, exactly 4"],
    "answer": "string",
    "explanation": "string for answer key",
    "points": "integer"
  }]
}
```

S3 bucket key structure (DBA owns, IaC implements):
```
edusheet-ai-worksheets-{env}/
  worksheets/{year}/{month}/{day}/{uuid}/
    worksheet.pdf
    worksheet.docx
    worksheet.html
    answer-key.pdf
    answer-key.docx
    metadata.json
    solve-data.json          ← worksheet JSON with answers for online scoring

edusheet-ai-frontend-{env}/
  index.html
  solve.html
  css/styles.css
  css/solve.css
  js/app.js
  js/solve.js

edusheet-ai-logs-{env}/
  access-logs/
```

Metadata JSON written alongside every generated worksheet:
```json
{
  "id": "uuid-v4",
  "generatedAt": "2026-03-22T17:00:00Z",
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "questionCount": 10,
  "formats": ["pdf", "docx", "html"],
  "expiresAt": "2026-03-29T17:00:00Z"
}
```

Rules:
- S3 keys: lowercase, hyphens only, no spaces, no uppercase
- Worksheets expire after 7 days (S3 lifecycle rule via CDK)
- metadata.json written on every generation
- Never store student names or PII in metadata — worksheet content only
- options field only present for multiple-choice question type

---

## Agent 5: DevOps — AWS Deployment & CI/CD

Triggers: deploy, deployment, CI/CD, pipeline, github actions, aws,
          lambda, s3, cloudfront, api gateway, environment, secrets,
          monitoring, rollback, staging, production, release

Responsibilities:
- Write and maintain all GitHub Actions workflows
- Define AWS service configurations and IAM permissions
- Manage environment promotion strategy (dev → staging → prod)
- Configure monitoring, alerting, and rollback procedures
- Manage secrets — never in code, always GitHub Secrets → AWS Secrets Manager

AWS Architecture:
```
Internet → CloudFront (HTTPS, caching, WAF)
              ├── /api/* → API Gateway → Lambda
              └── /*     → S3 (static frontend)

Lambda Functions:
  edusheet-generate  POST /api/generate   60s  1024MB
  edusheet-download  GET  /api/download   30s   256MB
  edusheet-list      GET  /api/worksheets 10s   128MB
  edusheet-solve     GET  /api/solve/{id} 10s   128MB
  edusheet-submit    POST /api/submit     15s   256MB

S3 Buckets:
  edusheet-ai-worksheets-{env}  private, presigned URLs, 7-day lifecycle
  edusheet-ai-frontend-{env}    public read, CloudFront origin
  edusheet-ai-logs-{env}        private, access logs

AWS Secrets Manager:
  edusheet-ai/{env}/secrets → ANTHROPIC_API_KEY, ALLOWED_ORIGIN
```

GitHub Actions workflow files to create:
```
.github/workflows/
  ci.yml           → every PR: lint + test + coverage gate (80%)
  deploy-dev.yml   → push to develop branch → deploy to dev
  deploy-staging.yml → push to staging → deploy to staging + smoke tests
  deploy-prod.yml  → push to main → manual approval → deploy to prod
```

CI workflow structure (ci.yml):
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
        with: { node-version: '18', cache: 'npm' }
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - name: Coverage gate
        run: npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
      - run: cd infra && npm ci && npx cdk synth
```

Deploy workflow structure:
```yaml
name: Deploy Dev
on:
  push:
    branches: [develop]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18', cache: 'npm' }
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: npm ci && npm test
      - run: cd infra && npm ci && npx cdk deploy --context env=dev --require-approval never
      - run: aws s3 sync frontend/ s3://edusheet-ai-frontend-dev/ --delete
```

GitHub repository secrets required:
```
AWS_ACCESS_KEY_ID          IAM deploy user key
AWS_SECRET_ACCESS_KEY      IAM deploy user secret
AWS_REGION                 us-east-1
ANTHROPIC_API_KEY_DEV      Anthropic key for dev Lambda
ANTHROPIC_API_KEY_STAGING  Anthropic key for staging Lambda
ANTHROPIC_API_KEY_PROD     Anthropic key for prod Lambda
```

DevOps rules:
- Never put secrets in workflow YAML — always ${{ secrets.NAME }}
- Every deploy workflow must run tests before deploying
- Production deploy requires manual approval job in GitHub Actions
- All Lambda functions get CloudWatch alarms: error rate > 1%, p99 latency > 10s
- S3 buckets have versioning enabled on prod
- Tag all AWS resources: Project=edusheet-ai, Env={env}, ManagedBy=cdk

---

## Agent 6: IaC — Infrastructure as Code (AWS CDK)

Triggers: cdk, infrastructure, stack, construct, cloudformation, iac,
          provision, aws resources, infra, s3 bucket, lambda function,
          api gateway, cloudfront, secrets manager, replace SAM

Responsibilities:
- Write and maintain all AWS CDK TypeScript code in infra/
- Replace infra/template.yaml (SAM) — that file is deprecated
- Ensure all infrastructure is reproducible via code
- Never create AWS resources manually

CDK project structure to create:
```
infra/
  package.json
  tsconfig.json
  cdk.json
  bin/
    edusheet-ai.ts        CDK app entry point
  lib/
    edusheet-ai-stack.ts  main stack
    constructs/
      storage.ts          S3 buckets
      api.ts              API Gateway + Lambda functions
      cdn.ts              CloudFront distribution
      secrets.ts          Secrets Manager
  test/
    edusheet-ai.test.ts   CDK assertions tests
```

CDK stack conventions:
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

interface EduSheetProps extends cdk.StackProps {
  env: 'dev' | 'staging' | 'prod';
}

export class EduSheetAiStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: EduSheetProps) {
    super(scope, id, props);

    const isProd = props.env === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // Tag everything
    cdk.Tags.of(this).add('Project', 'edusheet-ai');
    cdk.Tags.of(this).add('Env', props.env);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
```

Lambda construct pattern:
```typescript
// Always ARM_64 — cheaper and faster than x86
const generateFn = new NodejsFunction(this, 'GenerateFunction', {
  functionName: `edusheet-generate-${props.env}`,
  entry: '../backend/handlers/generateHandler.js',
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_18_X,
  architecture: lambda.Architecture.ARM_64,
  memorySize: 1024,
  timeout: cdk.Duration.seconds(60),
  environment: {
    NODE_ENV: props.env,
    WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
    ALLOWED_ORIGIN: cloudfrontDomain,
  },
  bundling: {
    minify: true,
    sourceMap: false,
    externalModules: ['@aws-sdk/*'],
  },
});

// Grant S3 permissions
worksheetBucket.grantPut(generateFn);
worksheetBucket.grantRead(generateFn);

// Inject API key from Secrets Manager
const secret = secretsmanager.Secret.fromSecretNameV2(
  this, 'AnthropicKey', `edusheet-ai/${props.env}/secrets`
);
secret.grantRead(generateFn);
generateFn.addEnvironment('SECRET_ARN', secret.secretArn);
```

S3 bucket pattern:
```typescript
const worksheetBucket = new s3.Bucket(this, 'WorksheetBucket', {
  bucketName: `edusheet-ai-worksheets-${props.env}`,
  removalPolicy,
  autoDeleteObjects: !isProd,
  versioned: isProd,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  lifecycleRules: [{
    expiration: cdk.Duration.days(7),
    prefix: 'worksheets/',
  }],
});
```

CDK commands:
```bash
cd infra
npm install
npx cdk synth                      # generate CloudFormation, must have zero warnings
npx cdk diff --context env=dev     # preview what changes will be made
npx cdk deploy --context env=dev   # deploy to dev
npx cdk deploy --context env=prod  # deploy to prod
```

IaC rules:
- ARM_64 architecture on all Lambda functions (20% cheaper, faster)
- Use NodejsFunction with esbuild bundling (faster cold starts)
- Never hardcode account IDs or regions — use Stack.of(this).account
- Prod S3 buckets: RemovalPolicy.RETAIN, versioned=true
- All Lambda: X-Ray tracing enabled on staging and prod
- cdk synth must pass with zero warnings before any PR
- CDK assertion tests in infra/test/ for every construct

---

## Agent Collaboration Map

### Collaboration Rules — BA Advises DEV and QA
```
IMPORTANT: BA agent drives all feature work. The flow MUST be:

1. BA writes the spec + acceptance criteria FIRST
2. BA hands spec to DEV with clear implementation instructions
3. DEV builds the code following BA's spec
4. BA hands acceptance criteria to QA
5. QA writes tests that validate BA's acceptance criteria
6. QA runs tests and reports back to BA
7. BA confirms feature is complete when all criteria pass

BA ↔ DEV communication:
  - BA tells DEV exactly which files to create/modify
  - BA specifies function signatures, input/output formats
  - DEV asks BA for clarification, never guesses
  - DEV reports back to BA when implementation is done

BA ↔ QA communication:
  - BA gives QA the acceptance criteria as test cases
  - BA specifies boundary values and edge cases to test
  - QA reports test results back to BA
  - BA decides if the feature is "done" based on QA results

DEV ↔ QA:
  - QA can ask DEV for implementation details (mocking, test setup)
  - DEV fixes bugs found by QA, then QA re-verifies
```

### Task Routing Table

| Task | Lead Agent | Advises | Parallel With | After |
|---|---|---|---|---|
| New feature | BA | DEV + QA | DBA if schema changes | DEV implements → QA verifies |
| Online solve page | BA | DEV | DBA (storage schema) | QA (scoring tests) |
| Scoring engine | BA (defines rules) | DEV | — | QA (unit tests per question type) |
| Submit handler | BA (defines API) | DEV | IaC (CDK route) | QA (handler tests) |
| Lambda handler | BA (spec) | DEV | IaC (CDK route) | QA |
| CDK construct | IaC | — | DEV (handler) | QA (CDK tests) |
| GitHub Actions | DevOps | — | — | QA (verify pipeline) |
| Schema change | DBA | DEV + IaC | — | QA |
| Bug fix | QA writes failing test | DEV fixes | — | QA verifies |
| Deploy to prod | DevOps | — | — | QA smoke tests |

### Agent Teams Workflow — Online Solve Feature:
```
Orchestrator: "Build online solve & scoring feature"

Phase 1 — Spec (BA leads):
  BA   → writes full feature spec, acceptance criteria, scoring rules
  DBA  → confirms worksheet storage schema, solve-data.json format

Phase 2 — Build (BA advises DEV, parallel tracks):
  BA tells DEV:
    Track A: "Build src/solve/scorer.js and resultBuilder.js per this spec"
    Track B: "Build backend/handlers/solveHandler.js and submitHandler.js"
    Track C: "Build frontend/solve.html, js/solve.js, css/solve.css"
  BA tells IaC:
    "Add GET /api/solve/{id} and POST /api/submit routes to CDK stack"
  DEV + IaC work in parallel

Phase 3 — Verify (BA advises QA):
  BA tells QA:
    "Test these acceptance criteria: [list from Phase 1]"
    "Test scoring for every question type"
    "Test timed mode auto-submit"
    "Test boundary: 0 answers, all correct, all wrong"
  QA writes and runs tests, reports results to BA

Phase 4 — Ship:
  BA reviews QA results → confirms "done" or sends DEV back to fix
  DevOps → deploys to dev, QA runs smoke tests
```

---

## Environment Variables Reference

Lambda environment (injected by CDK at deploy):
```
ANTHROPIC_API_KEY      from Secrets Manager
WORKSHEET_BUCKET_NAME  S3 bucket name
ALLOWED_ORIGIN         CloudFront domain
CLAUDE_MODEL           claude-sonnet-4-20250514
NODE_ENV               dev | staging | prod
```

Local development (.env file — already exists):
```
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_OUTPUT_DIR=./worksheets
CLAUDE_MODEL=claude-sonnet-4-20250514
NODE_ENV=development
```

GitHub Actions secrets:
```
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION
ANTHROPIC_API_KEY_DEV / ANTHROPIC_API_KEY_STAGING / ANTHROPIC_API_KEY_PROD
```

---

## Quick Commands

```bash
npm start                              # local interactive CLI
npm test                               # all tests
npm run test:coverage                  # coverage report
cd infra && npx cdk synth              # validate infrastructure
cd infra && npx cdk deploy --context env=dev   # deploy dev
git push origin develop                # triggers dev deploy via GitHub Actions
git push origin main                   # triggers prod deploy (needs approval)
```
