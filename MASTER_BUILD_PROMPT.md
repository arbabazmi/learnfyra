# EduSheet AI — Master Build Prompt
# Paste this entire prompt into Claude Code to start the Agent Teams session.
# Make sure CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is set in ~/.claude/settings.json

---

## YOUR MISSION

You are the Team Lead for EduSheet AI. Before writing a single line of new code,
you must audit the entire project to understand exactly what exists and what works.
Then build everything missing, in the correct order, using specialized teammates.

Do NOT assume anything is working. Verify first. Build second.

---

## PHASE 1 — FULL PROJECT AUDIT (Team Lead does this alone, no teammates yet)

Perform a complete audit of the project. Read every file. Run every test.
Produce a written audit report before spawning any teammates.

### Step 1 — Read the project structure
```
Read CLAUDE.md, REQUIREMENTS.md, and package.json first.
Then read every file in:
- src/ai/
- src/cli/
- src/exporters/
- src/templates/
- src/utils/
- backend/handlers/
- backend/middleware/
- frontend/
- infra/
- tests/unit/
- tests/integration/
- tests/fixtures/
```

### Step 2 — Run all existing tests
```
cd C:/arbab-github/edusheet-ai
npm install
npm test
npm run test:coverage
```

### Step 3 — Run the CLI locally to verify it works end to end
```
node index.js
```
Try generating one worksheet: Grade 3, Math, Multiplication, Medium, 10 questions, PDF format.
Verify the output file is created and is not empty or corrupted.

### Step 4 — Check what frontend exists
Look inside frontend/ and answer:
- Is there a real web UI or just placeholder HTML?
- Does the frontend call any backend API?
- Is it connected to anything?

### Step 5 — Check what backend exists
Look inside backend/handlers/ and answer:
- Do the Lambda handlers actually work?
- Do they call the Claude API correctly?
- Do they return proper responses with CORS headers?
- Are they connected to the frontend?

### Step 6 — Check what infra exists
Look inside infra/ and answer:
- Is there a SAM template.yaml or CDK stack?
- Has anything ever been deployed to AWS?
- Are there any CDK files at all?

### Step 7 — Write the Audit Report
Before doing ANYTHING else, write a clear audit report in this format:

```
=== EDUSHEET AI — AUDIT REPORT ===

CLI APPLICATION
  Status: [WORKING / BROKEN / PARTIAL]
  Issues found: [list any bugs or missing pieces]

TESTS
  Unit tests:        [X passing / Y failing]
  Integration tests: [X passing / Y failing]
  Coverage:          [X%]
  Issues found: [list any failures]

FRONTEND
  Status: [COMPLETE / PLACEHOLDER / MISSING]
  What exists: [describe what is actually there]
  Connected to backend: [YES / NO]
  Issues found: [list problems]

BACKEND (Lambda Handlers)
  Status: [COMPLETE / BROKEN / PARTIAL]
  generateHandler: [WORKING / BROKEN / MISSING]
  downloadHandler: [WORKING / BROKEN / MISSING]
  Issues found: [list problems]

INFRASTRUCTURE
  CDK stack: [EXISTS / MISSING]
  SAM template: [EXISTS / MISSING]
  Ever deployed to AWS: [YES / NO / UNKNOWN]
  Issues found: [list problems]

GITHUB ACTIONS
  .github/workflows/: [EXISTS / MISSING]
  ci.yml:             [EXISTS / MISSING]
  deploy-staging.yml: [EXISTS / MISSING]
  deploy-prod.yml:    [EXISTS / MISSING]

=== WHAT NEEDS TO BE BUILT ===
1. [list in priority order]
2.
3.
...

=== RECOMMENDED BUILD ORDER ===
[explain which phase to tackle first and why]
```

DO NOT proceed to Phase 2 until this audit report is complete.
Show me the audit report and wait for my confirmation before spawning any teammates.

---

## PHASE 2 — FIX EVERYTHING BROKEN (only after audit confirms issues)

After I confirm the audit report, fix all broken or failing items before
building anything new. Do not build on top of broken foundations.

Spawn a dev-agent teammate to fix any issues found in:
- Failing unit tests
- Failing integration tests
- Broken CLI behavior
- Broken Lambda handlers

Spawn a qa-agent teammate in parallel to:
- Verify each fix actually resolves the issue
- Re-run the full test suite after fixes
- Confirm coverage is above 80%

Wait for both teammates to complete and confirm everything is GREEN before Phase 3.

---

## PHASE 3 — BUILD THE WEB APPLICATION (if frontend is missing or incomplete)

Only start this phase after Phase 2 is complete and all tests pass.

Spawn a dev-agent teammate to build a complete, production-ready web frontend at frontend/:

The web app must:
- Be a single-page application (plain HTML + CSS + JS, no framework needed)
- Have a clean, teacher-friendly UI
- Let the user select: Grade (1-10), Subject, Topic, Difficulty, Question Count
- Topics must update dynamically based on selected Grade and Subject
- Have a "Generate Worksheet" button that calls the backend API
- Show a loading spinner while the worksheet is being generated
- Display download buttons for PDF, DOCX, and HTML once generated
- Display a separate download button for the Answer Key
- Show a friendly error message if generation fails
- Be fully responsive (works on desktop and tablet)
- Use the color scheme: primary #4F46E5 (indigo), white background, clean sans-serif font

The frontend must call these API endpoints:
- POST /api/generate  → send { grade, subject, topic, difficulty, questionCount, format }
- GET  /api/download?key=S3_KEY → download a specific file

Spawn a qa-agent teammate in parallel to:
- Review the frontend HTML/JS for correctness
- Verify the API calls match what the Lambda handlers expect
- Check that all form validations work (no empty submissions)
- Check that loading and error states work correctly

---

## PHASE 4 — FIX OR BUILD LAMBDA HANDLERS (if backend is incomplete)

Only start after Phase 3 frontend is done.

Spawn a dev-agent teammate to ensure backend/handlers/ are production-ready:

generateHandler.js must:
- Accept POST body: { grade, subject, topic, difficulty, questionCount, format }
- Validate all inputs (grade 1-10, valid subject, valid format)
- Call the Anthropic Claude API using src/ai/generator.js logic
- Generate the worksheet in the requested format (PDF / DOCX / HTML)
- Upload the generated file to S3 (worksheets bucket)
- Upload the answer key to S3 (answer-keys bucket)
- Return: { success: true, worksheetUrl, answerKeyUrl, metadata }
- Return proper error responses with CORS headers on failure

downloadHandler.js must:
- Accept GET with query param: key=S3_KEY
- Generate a presigned S3 URL (expires in 1 hour)
- Return: { downloadUrl: presignedUrl }
- Return 404 if key does not exist

Both handlers must:
- Include CORS headers on ALL responses (including errors)
- Never expose raw Error objects in responses
- Read ANTHROPIC_API_KEY from environment variable (set via SSM in prod)

Spawn a qa-agent teammate to:
- Write unit tests for both handlers (mock AWS SDK and Anthropic API)
- Write integration tests that test the full generate → upload → download flow
- Verify CORS headers are present on all responses
- Verify error responses are structured correctly

---

## PHASE 5 — BUILD AWS CDK INFRASTRUCTURE

Only start after Phases 3 and 4 are complete.

Spawn a devops-agent teammate to build infra/cdk/ from scratch:

```
infra/cdk/
├── bin/
│   └── app.ts
├── lib/
│   └── edusheet-stack.ts
├── test/
│   └── edusheet-stack.test.ts
├── cdk.json
├── tsconfig.json
└── package.json
```

The CDK stack must create:
1. S3 bucket — frontend (public, static website hosting)
2. S3 bucket — worksheets (private, presigned URL access only)
   - Lifecycle rule: delete temp/ after 1 day
   - Lifecycle rule: delete worksheets/ and answer-keys/ after 7 days
3. Lambda — generateHandler (Node 18, 1024MB memory, 29s timeout)
4. Lambda — downloadHandler (Node 18, 256MB memory, 10s timeout)
5. API Gateway — REST API
   - POST /api/generate → generateHandler
   - GET  /api/download → downloadHandler
   - CORS enabled on all routes
6. CloudFront distribution
   - /* → frontend S3 bucket
   - /api/* → API Gateway (caching disabled)
7. SSM Parameter Store — read Anthropic API key (SecureString, pre-created manually)

Tag all resources: { Project: 'edusheet-ai', Environment: env }
Support env context: dev / staging / prod via --context env=dev

Spawn a devops-agent teammate to also:
- Write the CDK test file
- Run npx cdk synth --context env=dev to verify the stack compiles
- Document the one-time SSM setup command in a DEPLOY.md file

---

## PHASE 6 — BUILD CI/CD PIPELINES

Only start after Phase 5 CDK stack is verified.

Spawn a cicd-agent teammate to create .github/workflows/:

ci.yml (runs on every PR and push to main/develop):
- Install dependencies
- Run all tests
- Run CDK synth (dry run, no AWS credentials needed)

deploy-staging.yml (runs on push to develop):
- Run tests first (must pass)
- Deploy CDK stack with --context env=staging
- Sync frontend/ to S3 frontend-staging bucket
- Invalidate CloudFront cache

deploy-prod.yml (runs on push to main):
- Run tests first (must pass, this is a hard requirement)
- Deploy CDK stack with --context env=prod
- Sync frontend/ to S3 frontend-prod bucket
- Invalidate CloudFront cache

Also create DEPLOY.md documenting:
- How to set up AWS credentials for GitHub Actions (step by step)
- How to create the SSM parameter for the Anthropic API key
- How to run the first manual CDK bootstrap and deploy
- What GitHub Secrets need to be set and where to find their values

---

## PHASE 7 — FIRST DEPLOYMENT TO AWS (dev environment)

Only start after all phases above are complete and all tests pass.

Spawn a devops-agent teammate to do the first real AWS deployment:

```bash
# Step 1 — Bootstrap CDK (one time only)
cd infra/cdk
npm install
npx cdk bootstrap --context env=dev

# Step 2 — Deploy the stack
npx cdk deploy --all --context env=dev

# Step 3 — Note all outputs (CloudFront URL, bucket names, API URL)

# Step 4 — Sync frontend to S3
aws s3 sync frontend/ s3://edusheet-ai-frontend-dev --delete

# Step 5 — Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

After deployment, spawn a qa-agent teammate to:
- Open the CloudFront URL and verify the web app loads
- Generate one test worksheet (Grade 3, Math, Multiplication, Medium, 10 questions)
- Verify the PDF downloads correctly
- Verify the Answer Key downloads correctly
- Report the live URL back to me

---

## IMPORTANT RULES FOR ALL TEAMMATES

1. Always read CLAUDE.md before starting any task
2. Never skip a phase — each phase depends on the previous one being complete
3. Never deploy to prod — only deploy to dev in this session
4. Always report back to the Team Lead when a phase is complete
5. If you find something unexpected, stop and report it before continuing
6. The Team Lead must confirm between each phase before the next starts

---

## START NOW

Begin Phase 1. Read all files, run all tests, and produce the Audit Report.
Show me the report before doing anything else.
