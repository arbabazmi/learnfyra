# Learnfyra System Architecture Overview

**Date:** March 26, 2026  
**Status:** Current Implementation  
**Version:** 3.0 — Online Solve & Answer Validation Edition

---

## 1. Platform Architecture Diagram

```
                        ┌──────────────────────────────────────────────────┐
                        │          INTERNET / USER BROWSERS                │
                        └────────────────────┬─────────────────────────────┘
                                             │
                        ┌────────────────────▼─────────────────────────────┐
                        │   CloudFront (CDN + Edge Routing)                │
                        │   - HTTPS, caching, WAF, custom domain           │
                        └────────────────────┬─────────────────────────────┘
                                 ┌───────────┴───────────┐
                    ┌────────────▼──────────┐   ┌───────▼──────────────┐
                    │  Static Frontend      │   │  API Gateway         │
                    │  (S3 + CloudFront)    │   │  (REST Endpoints)    │
                    │                       │   │                      │
                    │ - index.html          │   │ Endpoints:           │
                    │ - login.html          │   │ • POST /api/auth/*   │
                    │ - solve.html          │   │ • POST /api/generate │
                    │ - css, js, images     │   │ • GET  /api/solve    │
                    │ - student/teacher     │   │ • POST /api/submit   │
                    │   dashboards          │   │ • GET  /api/download │
                    │                       │   │ • etc...             │
                    └───────────────────────┘   └───────┬──────────────┘
                                                        │
                ┌───────────────────────────────────────┼───────────────────────────────────────┐
                │                                       │                                       │
    ┌───────────▼──────────────┐     ┌────────────────▼─────────────┐     ┌──────────────────▼──┐
    │  Lambda Functions        │     │  Lambda Functions           │     │  Lambda Functions   │
    │  (Core Services)         │     │  (Feature Services)         │     │  (Admin Services)   │
    │                          │     │                             │     │                     │
    │ • generate               │     │ • solve                     │     │ • admin             │
    │ • download               │     │ • submit                    │     │ • analytics         │
    │ • auth                   │     │ • progress                  │     │ • class             │
    │ • student                │     │ • rewards                   │     │ • certificates      │
    │                          │     │ • question-bank             │     │ • question-bank     │
    │                          │     │                             │     │                     │
    └────┬─────────────────────┘     └────┬──────────────┬─────────┘     └──────────┬──────────┘
         │                                │              │                         │
         └────────────────┬────────────────┴──────┬───────┴─────────────┬──────────┘
                          │                      │                     │
        ┌─────────────────▼──────────────┬─────────────┐      ┌────────▼─────────┐
        │                                │             │      │                  │
    ┌───▼──────────────┐  ┌──────────────▼──┐  ┌──────▼───┐  │  AWS Services    │
    │                  │  │                 │  │          │  │                  │
    │  S3 Worksheets   │  │ Parameter Store │  │ DynamoDB │  │ • CloudWatch     │
    │  (Object Storage)│  │                 │  │ (Auth)   │  │ • X-Ray          │
    │                  │  │ • anthropic-key │  │          │  │ • IAM            │
    │ worksheets/      │  │ • jwt-secret    │  │ sessions │  │ • ACM            │
    │ {uuid}/          │  │                 │  │ members  │  │ • Route53        │
    │ • worksheet.pdf  │  │                 │  │ classes  │  │ • SNS/SES        │
    │ • worksheet.docx │  │                 │  │ progres  │  │                  │
    │ • worksheet.html │  └─────────────────┘  │          │  │                  │
    │ • answer-key.pdf │                       │          │  │                  │
    │ • solve-data.json│                       └──────────┘  │                  │
    │ • metadata.json  │                                      │                  │
    │                  │                                      │                  │
    └──────────────────┘                                      │                  │
                                                               │                  │
    ┌──────────────────┐  ┌──────────────────┐  ┌─────────┐  │                  │
    │  S3 Frontend     │  │  Logs & Metrics  │  │   ACM   │  │                  │
    │  (Static Files)  │  │  (CloudWatch)    │  │   TLS   │  │                  │
    │                  │  │                  │  │ Certs   │  │                  │
    │ css/             │  │ API access logs  │  │         │  │                  │
    │ js/              │  │ Lambda logs      │  │         │  │                  │
    │ images/          │  │ CloudWatch Logs  │  │         │  │                  │
    │ html files       │  │ Metrics          │  │         │  │                  │
    │                  │  │ Dashboards       │  │         │  │                  │
    └──────────────────┘  └──────────────────┘  └─────────┘  └──────────────────┘
                                                                     │
                                                    ┌────────────────┘
                                                    │
                                        ┌───────────▼─────────────┐
                                        │  Anthropic Claude API   │
                                        │  (AI Model Service)     │
                                        │  - Question generation  │
                                        │  - Answer creation      │
                                        │  - Curriculum mapping   │
                                        └─────────────────────────┘
```

---

## 2. Data Flow: Generate → Solve → Submit

```
         TEACHER / ADMIN
              │
              ▼
    ┌─────────────────────────┐
    │ Fill Generation Form    │
    │ • Grade (1-10)          │
    │ • Subject (Math/ELA...)  │
    │ • Topic                 │
    │ • Question Count        │
    │ • Difficulty Level      │
    └──────┬──────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ POST /api/generate           │
    │ (Lambda: generateHandler)    │
    └──────┬───────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ Call Claude AI (Anthropic)           │
    │ • Build curriculum prompt            │
    │ • Request questions + answers        │
    │ • Map to CCSS/NGSS standards         │
    └──────┬───────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────┐
    │ Generate Outputs                       │
    │ • PDF (via Puppeteer)                  │
    │ • DOCX (via docx npm)                  │
    │ • HTML                                 │
    │ • Answer Key                           │
    │ • Metadata JSON                        │
    │ • solve-data.json (questions+answers)  │
    └──────┬─────────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────┐
    │ Store to S3 Worksheets Bucket          │
    │ s3://learnfyra-{env}-s3-worksheets/   │
    │   worksheets/{year}/{month}/{day}/{uuid}/
    │   ├── worksheet.pdf                    │
    │   ├── worksheet.docx                   │
    │   ├── worksheet.html                   │
    │   ├── answer-key.pdf                   │
    │   ├── solving-data.json ◄── KEY FILE   │
    │   └── metadata.json                    │
    └──────┬─────────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────┐
    │ Return Response to Teacher             │
    │ {                                      │
    │   worksheetId: "uuid-v4",              │
    │   pdfUrl: "presigned-s3-url-pdf",      │
    │   docxUrl: "presigned-s3-url-docx",    │
    │   htmlUrl: "presigned-s3-url-html",    │
    │   answerKeyUrl: "presigned-url",       │
    │   "Solve Online" button ◄── NEW        │
    │ }                                      │
    └────────────────────────────────────────┘
           │
           └─────────────────────────────────────┐
                                                 │
                                    ─────────────────────────────
                                   │ Teacher shares link to student  │
                                    ─────────────────────────────
                                                 │
                                                 ▼
                                    ┌────────────────────────────┐
                                    │ GET /api/solve/{worksheetId}
                                    │ (Lambda: solveHandler)     │
                                    └────────┬───────────────────┘
                                             │
                                             ▼
                                    ┌────────────────────────────────┐
                                    │ Read solve-data.json from S3   │
                                    │ Extract QUESTIONS ONLY         │
                                    │ (NOT answers, NOT explanations)│
                                    └────────┬─────────────────────┘
                                             │
                                             ▼
                   ┌─────────────────────────────────────────┐
                   │ Render solve.html                       │
                   │ • Interactive form with input fields    │
                   │ • Timer (optional: timed mode)          │
                   │ • "Submit" button                       │
                   └────────┬────────────────────────────────┘
                            │
                            ▼
                 ┌──────────────────────────┐
                 │  STUDENT SOLVING FLOW   │
                 │                          │
                 │ 1. Choose Timed/Untimed │
                 │ 2. Answer questions      │
                 │ 3. Review (optional)     │
                 │ 4. Click Submit          │
                 │    OR timer expires      │
                 └──────┬───────────────────┘
                        │
                        ▼
              ┌─────────────────────────────────┐
              │ POST /api/submit                │
              │ {                               │
              │   worksheetId,                  │
              │   answers: [                    │
              │     {number, answer},           │
              │     {number, answer}            │
              │   ],                            │
              │   timeTaken,                    │
              │   timed                        │
              │ }                               │
              │ (Lambda: submitHandler)         │
              └──────┬────────────────────────┘
                     │
                     ▼
              ┌──────────────────────────────┐
              │ Load solve-data.json         │
              │ Compare Answers              │
              │ • Multiple choice: exact     │
              │ • Fill-in-blank: fuzzy       │
              │ • Short answer: keywords     │
              │ • True/False: exact          │
              │ • Matching: per-pair         │
              └──────┬─────────────────────┘
                     │
                     ▼
              ┌──────────────────────────────┐
              │ Calculate Score              │
              │ • totalScore = sum correct   │
              │ • percentage = (total/max)*100
              │ • per-question breakdown     │
              └──────┬─────────────────────┘
                     │
                     ▼
              ┌──────────────────────────────────────┐
              │ Build Response                       │
              │ {                                    │
              │   totalScore: 8,                     │
              │   totalPoints: 10,                   │
              │   percentage: 80,                    │
              │   timeTaken: 845,                    │
              │   results: [                         │
              │     {                                │
              │       number: 1,                     │
              │       correct: true,                 │
              │       studentAnswer: "B",            │
              │       correctAnswer: "B",            │
              │       explanation: "6×7=42",         │
              │       pointsEarned: 1                │
              │     },                               │
              │     ...                              │
              │   ]                                  │
              │ }                                    │
              └──────┬───────────────────────────────┘
                     │
                     ▼
              ┌──────────────────────────────┐
              │ Render Results Page          │
              │ • ✅/❌ per question         │
              │ • Score prominently displayed│
              │ • Explanations visible       │
              │ • Time taken shown           │
              │ • "Try Again" / "New Sheet"  │
              │   buttons                    │
              └──────────────────────────────┘
```

---

## 3. Module Breakdown & Responsibilities

```
┌────────────────────────────────────────────────────────────────────┐
│                     LEARNFYRA PLATFORM                             │
└────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND LAYER                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  index.html  │  │ login.html   │  │  solve.html  │  ◄─ NEW   │
│  │              │  │              │  │              │           │
│  │ Teacher app  │  │ Auth flow    │  │ Student      │           │
│  │ • Generate   │  │ • Register   │  │ solving      │           │
│  │ • Manage     │  │ • Login      │  │ • Timed mode │           │
│  │ • View       │  │ • OAuth      │  │ • Untimed    │           │
│  │   results    │  │              │  │ • Results    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  frontned/js/                                              │ │
│  │  • app.js (generation & download flow)                    │ │
│  │  • solve.js (NEW: timer, input capture, submit, scoring)  │ │
│  │  • auth.js (login/logout handling)                        │ │
│  │  • dashboard.js (teacher/student dashboards)              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  frontend/css/                                             │ │
│  │  • styles.css (main theme: teal/orange)                   │ │
│  │  • solve.css (NEW: solve page styles)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  API GATEWAY + CLOUDFRONT ROUTING                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /api/auth/register      ──┐                               │
│  POST /api/auth/login            ├──► Auth Lambda               │
│  POST /api/auth/logout         ──┘                              │
│                                                                  │
│  POST /api/generate            ──► Generate Lambda              │
│  GET  /api/download            ──► Download Lambda              │
│                                                                  │
│  GET  /api/solve/{id}          ──┐                              │
│  POST /api/submit                ├──► Solve/Submit Lambdas ◄─ NEW
│                                ──┘                              │
│  GET  /api/progress            ──► Progress Lambda              │
│  POST /api/submit-answer          ──► Analytics Lambda          │
│                                                                  │
│  GET  /api/class/:id           ──┐                              │
│  POST /api/class                  ├──► Class Lambda             │
│  PATCH /api/class/:id          ──┘                              │
│                                                                  │
│  GET  /api/rewards             ──► Rewards Lambda               │
│  POST /api/claim-reward           ──► Student Lambda            │
│                                                                  │
│  GET  /api/questions/          ──┐                              │
│  POST /api/questions/add          ├──► Question Bank Lambda     │
│  DELETE /api/questions/:id     ──┘                              │
│                                                                  │
│  GET  /api/admin/analytics     ──► Admin Lambda                 │
│  GET  /api/admin/settings         ──► Admin Lambda              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  BACKEND LAYER (Node.js Lambda Handlers)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  backend/handlers/                                              │
│  ├── authHandler.js           Auth, JWT, OAuth                 │
│  ├── generateHandler.js        AI worksheet generation         │
│  ├── downloadHandler.js        S3 presigned URLs               │
│  ├── solveHandler.js ◄─ NEW    Retrieve solve-safe questions   │
│  ├── submitHandler.js ◄─ NEW   Score answers, return results   │
│  ├── progressHandler.js        Track student progress          │
│  ├── analyticsHandler.js       Log submission data             │
│  ├── classHandler.js           Manage teacher classes          │
│  ├── rewardsHandler.js         Gamification & rewards          │
│  ├── studentHandler.js         Student profile management      │
│  ├── questionBankHandler.js    Custom question management      │
│  ├── certificatesHandler.js    Certificate generation          │
│  └── adminHandler.js           Super-admin operations          │
│                                                                  │
│  backend/middleware/                                            │
│  ├── authMiddleware.js         JWT verification, role checks   │
│  └── validator.js              Input validation & sanitization │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION LOGIC LAYER (src/)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  src/ai/                                                        │
│  ├── client.js                 Anthropic Claude API wrapper     │
│  ├── generator.js              Worksheet generation logic       │
│  ├── promptBuilder.js          Curriculum-aware prompts         │
│  └── topics.js                 Grade/subject/topic mappings     │
│                                                                  │
│  src/solve/ ◄─ NEW                                              │
│  ├── scorer.js                 Answer comparison & scoring      │
│  └── resultBuilder.js          Score summary + breakdown        │
│                                                                  │
│  src/exporters/                                                 │
│  ├── pdfExporter.js            PDF generation (Puppeteer)       │
│  ├── docxExporter.js           DOCX generation (docx npm)       │
│  ├── htmlExporter.js           HTML worksheet templates         │
│  └── answerKey.js              Answer key generation           │
│                                                                  │
│  src/auth/                                                      │
│  ├── jwt.js                    JWT token generation/validation  │
│  ├── oauth.js                  OAuth provider integration       │
│  └── roles.js                  RBAC (Super-Admin, Teacher, Stu) │
│                                                                  │
│  src/db/                                                        │
│  ├── dynamoAdapter.js          DynamoDB access layer           │
│  ├── localAdapter.js           Local JSON file storage          │
│  └── schema.js                 Data validation schemas          │
│                                                                  │
│  src/templates/                                                 │
│  ├── worksheet.html.js         Question rendering templates     │
│  └── styles.css.js             Global stylesheet generation     │
│                                                                  │
│  src/utils/                                                     │
│  ├── fileUtils.js              S3/filesystem operations         │
│  ├── logger.js                 Structured logging               │
│  ├── retryUtils.js             Exponential backoff retries      │
│  └── validators.js             Input validation helpers         │
│                                                                  │
│  src/cli/                                                       │
│  ├── prompts.js                Interactive CLI interface        │
│  ├── validator.js              Command-line input validation    │
│  └── batchRunner.js            Batch generation/processing      │
│                                                                  │
│  src/rewards/                                                   │
│  └── gamification.js           Points, badges, leaderboards    │
│                                                                  │
│  src/questionBank/                                              │
│  └── adapter.js                Custom Q&A management           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STORAGE & INTEGRATION LAYER                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  S3 Worksheets Bucket                                           │
│  ├── worksheets/               Worksheet artifacts & metadata   │
│  │   └── {uuid}/               Per-worksheet directory          │
│  │       ├── worksheet.pdf                                      │
│  │       ├── worksheet.docx                                     │
│  │       ├── worksheet.html                                     │
│  │       ├── answer-key.pdf                                     │
│  │       ├── answer-key.docx                                    │
│  │       ├── solve-data.json ◄─ NEW: questions + answers        │
│  │       └── metadata.json                                      │
│  │                                                              │
│  │ S3 Frontend Bucket                                           │
│  ├── index.html                                                 │
│  ├── login.html                                                 │
│  ├── solve.html ◄─ NEW                                          │
│  ├── css/, js/, images/                                        │
│  └── student/, teacher/ dashboards                             │
│                                                                  │
│  DynamoDB Tables (Auth/Data)                                    │
│  ├── Users (email, hashedPwd, roles, profile)                  │
│  ├── Classes (teacherId, students, worksheets)                 │
│  ├── Submissions (studentId, worksheetId, score, time)         │
│  ├── Progress (studentId, topic, mastery, achievements)        │
│  └── Rewards (studentId, points, badges, tiers)                │
│                                                                  │
│  Local Storage (Development)                                    │
│  ├── data-local/users.json                                      │
│  ├── data-local/classes.json                                    │
│  ├── data-local/memberships.json                               │
│  ├── data-local/parentLinks.json                               │
│  ├── data-local/certificates.json                              │
│  └── worksheets-local/{uuid}/solve-data.json ◄─ NEW            │
│                                                                  │
│  Anthropic Claude API                                           │
│  ├── Generate content (questions, answers, explanations)        │
│  ├── Curriculum enrichment (map to CCSS/NGSS standards)        │
│  └── Natural language scoring (optional future)                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER (AWS CDK)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  infra/cdk/                                                     │
│  ├── lib/learnfyra-stack.ts    Main CDK stack definition        │
│  ├── lib/constructs/           Reusable CDK constructs          │
│  │   ├── api.ts                API Gateway + Lambda routing     │
│  │   ├── storage.ts            S3 buckets & lifecycle rules     │
│  │   ├── auth.ts               DynamoDB auth tables            │
│  │   ├── cdn.ts                CloudFront distribution         │
│  │   ├── monitoring.ts         CloudWatch alarms & dashboards  │
│  │   └── secrets.ts            Secrets Manager integration     │
│  └── bin/learnfyra.ts          CDK app entry point             │
│                                                                  │
│  AWS Services (per environment)                                 │
│  ├── Lambda Functions (ARM_64, 128MB-1024MB)                   │
│  ├── API Gateway (REST API)                                     │
│  ├── S3 Buckets (private, presigned URLs, lifecycle)           │
│  ├── CloudFront Distribution (edge caching)                    │
│  ├── DynamoDB Tables (auth, sessions, data)                    │
│  ├── CloudWatch (logs, metrics, alarms, dashboards)            │
│  ├── Secrets Manager (ANTHROPIC_API_KEY, JWT_SECRET)           │
│  ├── X-Ray (distributed tracing: staging/prod only)            │
│  ├── IAM Roles & Policies (least privilege)                    │
│  ├── ACM (HTTPS certificates)                                   │
│  ├── Route53 (DNS & custom domains)                            │
│  └── SNS/SES (notifications, alerts, emails)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CI/CD & DEPLOYMENT LAYER                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  .github/workflows/                                             │
│  ├── ci.yml                    Lint, test, coverage (all PRs)   │
│  ├── deploy-dev.yml            Deploy to dev (develop branch)   │
│  ├── deploy-staging.yml        Deploy to staging (staging)      │
│  └── deploy-prod.yml           Deploy to prod (main, manual app)
│                                                                  │
│  Environments (env-based deployment)                            │
│  ├── dev                       Testing, feature validation      │
│  ├── staging                   Pre-prod, smoke tests            │
│  └── prod                      Production, manual approval      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Authentication & Authorization Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                         │
└────────────────────────────────────────────────────────────────┘

                           ┌─────────┐
                           │ Browser │
                           └────┬────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
              ┌─────▼──────┐          ┌──────▼──────┐
              │   OAuth    │          │  Email/Pwd  │
              │  Provider  │          │   Direct    │
              └─────┬──────┘          └──────┬──────┘
                    │                        │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ POST /api/auth/login   │
                    │ (authHandler)          │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼──────────────────┐
                    │ Query DynamoDB Users Table   │
                    │ Verify password / OAuth code │
                    └───────────┬──────────────────┘
                                │
                    ┌───────────▼──────────────────────┐
                    │ Generate JWT Token               │
                    │ • sub (userId)                   │
                    │ • role (Super-Admin|Teacher|Stu) │
                    │ • exp (1 hour)                   │
                    │ • iat (issued at)                │
                    └───────────┬──────────────────────┘
                                │
                    ┌───────────▼──────────────────────┐
                    │ Set HttpOnly Secure Cookie       │
                    │ + Return JWT in response         │
                    └──────────────────────────────────┘
                                │
                    ┌───────────▼────────────────┐
                    │ Browser Stores JWT         │
                    │ (cookie or localStorage)   │
                    └───────────┬────────────────┘
                                │
                   ┌────────────▼────────────────┐
                   │ Subsequent API Requests     │
                   │ Include JWT in header:      │
                   │ Authorization: Bearer <JWT> │
                   └────────────┬─────────────────┘
                                │
                   ┌────────────▼────────────────────┐
                   │ authmiddleware.js                │
                   │ • Verify JWT signature          │
                   │ • Check exp claim               │
                   │ • Extract userId & role         │
                   └────────────┬────────────────────┘
                                │
                   ┌────────────▼────────────────────┐
                   │ Role-Based Access Control       │
                   │ • Super-Admin: All endpoints    │
                   │ • Teacher: Generate, class mgmt │
                   │ • Student: Solve, progress, own │
                   │   data only                     │
                   └────────────┬────────────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │ Proceed to Handler OR    │
                    │ Return 401/403 + Error   │
                    └──────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  ROLE HIERARCHY & PERMISSIONS                  │
└────────────────────────────────────────────────────────────────┘

    SUPER-ADMIN
    ├── Manage all teachers, students, classes
    ├── View platform analytics
    ├── Configure system settings
    ├── Manage question bank (all)
    ├── Create/publish courses
    ├── Check logs & errors
    └── (Inherits Teacher + Student permissions)

    TEACHER
    ├── Create worksheets (POST /api/generate)
    ├── Download worksheet files
    ├── Create/manage classes
    ├── Add students to classes
    ├── Assign worksheets to classes
    ├── View class-level progress & analytics
    ├── Manage own question bank
    ├── View student submissions
    └── (Inherits Student permissions)

    STUDENT
    ├── View assigned worksheets
    ├── Solve worksheets online
    ├── Submit answers
    ├── View own score & results
    ├── View own progress
    ├── Earn rewards & badges
    ├── View own profile
    └── (Least privilege)

    PARENT (Future)
    ├── View child's progress
    ├── View child's scores
    └── Receive reports
```

---

## 5. Question Type → Scoring Rules

```
┌────────────────────────────────────────────────────────────────┐
│              QUESTION TYPES & SCORING LOGIC                    │
└────────────────────────────────────────────────────────────────┘

├─ MULTIPLE-CHOICE
│  ├─ Input:       Radio buttons (A/B/C/D)
│  ├─ Comparison:  Exact string match (case-sensitive)
│  ├─ Storage:     { answer: "B" }
│  ├─ Correct:     Student "B" === Stored "B" → 1 point
│  └─ Wrong:       Student "A" !== Stored "B" → 0 points
│
├─ TRUE/FALSE
│  ├─ Input:       Radio buttons (True/False)
│  ├─ Comparison:  Exact string match (case-insensitive)
│  ├─ Storage:     { answer: "True" }
│  ├─ Correct:     Student "true" === Stored "True" → 1 point
│  └─ Wrong:       Student "False" !== Stored "True" → 0 points
│
├─ FILL-IN-THE-BLANK
│  ├─ Input:       Text input field
│  ├─ Comparison:  Fuzzy/case-insensitive trimmed match
│  ├─ Storage:     { answer: "42" }
│  ├─ Correct:     Student "42" or " 42 " matches "42" → 1 point
│  ├─ Wrong:       Student "41" or "4.2" ≠ "42" → 0 points
│  └─ Fuzzy:       Student "The answer is 42" → check if "42" exists
│
├─ SHORT-ANSWER
│  ├─ Input:       Textarea (up to 200 chars)
│  ├─ Comparison:  Keyword presence + fuzzy match
│  ├─ Storage:     { answer: "Photosynthesis converts light energy" }
│  ├─ Keywords:    ['Photosynthesis', 'light', 'energy']
│  ├─ Partial:     Student includes 2/3 keywords → 0.67 points
│  ├─ Full:        Student includes all keywords → 1 point
│  └─ Wrong:       No keywords found → 0 points
│
├─ MATCHING
│  ├─ Input:       Dropdown selects for each item
│  ├─ Comparison:  Per-pair exact match
│  ├─ Storage:     { answer: { "Item A": "Option 1", "Item B": "Option 2" } }
│  ├─ Scoring:     Points = (correct_pairs / total_pairs) × max_points
│  ├─ Correct:     2/2 pairs match → 1 point
│  ├─ Partial:     1/2 pairs match → 0.5 points
│  └─ Wrong:       0/2 pairs match → 0 points
│
├─ SHOW-YOUR-WORK (Multi-part)
│  ├─ Input:       Textarea (work) + text input (final answer)
│  ├─ Scoring:     Only final answer scored (work is optional reference)
│  ├─ Storage:     { answer: { work: "optional", final: "42" } }
│  ├─ Correct:     Final answer matches stored answer → 1 point
│  └─ Wrong:       Final answer ≠ stored answer → 0 points
│
└─ WORD-PROBLEM (Multi-part)
   ├─ Input:       Textarea (work) + text input (final answer)
   ├─ Scoring:     Only final answer scored (work for reference)
   ├─ Storage:     { answer: { work: "optional", final: "120 miles" } }
   ├─ Correct:     Final answer matches (case/space insensitive) → 1 point
   └─ Wrong:       Final answer ≠ stored answer → 0 points


   SCORING ENGINE (src/solve/scorer.js)
   
   for each (studentAnswer, storedAnswer, questionType) {
     
     switch(questionType) {
       case 'multiple-choice':
       case 'true-false':
         score = (studentAnswer === storedAnswer) ? points : 0;
         break;
       
       case 'fill-in-the-blank':
         normalized_student = trim_lowercase(studentAnswer);
         normalized_correct = trim_lowercase(storedAnswer);
         score = (normalized_student === normalized_correct) ? points : 0;
         break;
       
       case 'short-answer':
         keywords = extract_keywords(storedAnswer);
         match_count = count_keyword_matches(studentAnswer, keywords);
         score = (match_count / keywords.length) × points;
         break;
       
       case 'matching':
         pairs_correct = 0;
         for each pair in storedAnswer {
           if (studentAnswer[pair.item] === storedAnswer[pair.item]) {
             pairs_correct++;
           }
         }
         score = (pairs_correct / storedAnswer.length) × points;
         break;
       
       case 'show-your-work':
       case 'word-problem':
         normalized_student = trim_lowercase(studentAnswer.final);
         normalized_correct = trim_lowercase(storedAnswer.final);
         score = (normalized_student === normalized_correct) ? points : 0;
         break;
     }
     
     totalScore += score;
   }
   
   percentage = (totalScore / totalPoints) × 100;
```

---

## 6. Storage Schema: Worksheet JSON

```json
{
  "$schema": "learnfyra/worksheet/v1",
  "worksheetId": "550e8400-e29b-41d4-a716-446655440000",
  "generatedAt": "2026-03-26T17:00:00Z",
  "title": "Grade 4 Multiplication Mastery",
  "grade": 4,
  "subject": "Math",
  "topic": "Multiplication",
  "difficulty": "Medium",
  "standards": [
    "CCSS.MATH.4.NBT.B.5",
    "CCSS.MATH.4.NBT.B.6"
  ],
  "estimatedTime": "25 minutes",
  "timerSeconds": 1500,
  "totalPoints": 10,
  "instructions": "Solve each problem. Show your work where indicated.",
  
  "questions": [
    {
      "number": 1,
      "type": "multiple-choice",
      "question": "What is 6 × 7?",
      "options": ["A. 36", "B. 42", "C. 48", "D. 54"],
      "answer": "B",
      "explanation": "6 × 7 = 42. Remember, skip counting by 6s: 6, 12, 18, 24, 30, 36, 42.",
      "points": 1
    },
    {
      "number": 2,
      "type": "fill-in-the-blank",
      "question": "8 × 9 = ___",
      "answer": "72",
      "explanation": "8 × 9 = 72. You can use an array (8 rows of 9) or repeated addition.",
      "points": 1
    },
    {
      "number": 3,
      "type": "true-false",
      "question": "True or False: 5 × 5 = 25",
      "answer": "True",
      "explanation": "This is true. 5 × 5 = 25 (a perfect square).",
      "points": 1
    },
    {
      "number": 4,
      "type": "short-answer",
      "question": "Explain how multiplication relates to repeated addition. Use an example.",
      "answer": "Multiplication is a faster way to show repeated addition. For example, 3 × 4 means 4 + 4 + 4.",
      "explanation": "Multiplication groups equal amounts. 3 × 4 = 12, the same as 4 + 4 + 4 = 12.",
      "points": 1
    },
    {
      "number": 5,
      "type": "matching",
      "question": "Match each multiplication problem to its answer.",
      "pairs": [
        { "problem": "2 × 6", "option": "A. 12" },
        { "problem": "3 × 4", "option": "B. 16" },
        { "problem": "4 × 4", "option": "C. 14" }
      ],
      "answer": {
        "2 × 6": "A. 12",
        "3 × 4": "A. 12",
        "4 × 4": "B. 16"
      },
      "explanation": "2 × 6 = 12, 3 × 4 = 12, 4 × 4 = 16.",
      "points": 1
    },
    {
      "number": 6,
      "type": "word-problem",
      "question": "Sarah has 7 boxes of crayons. Each box has 8 crayons. How many crayons does Sarah have altogether?",
      "answer": {
        "work": "optional",
        "final": "56"
      },
      "explanation": "7 × 8 = 56 crayons. You can use skip counting, arrays, or repeated addition.",
      "points": 1
    },
    {
      "number": 7,
      "type": "show-your-work",
      "question": "Solve: 9 × 12 = ___. Show your work.",
      "answer": {
        "work": "optional",
        "final": "108"
      },
      "explanation": "9 × 12 = 108. You could break this into (9 × 10) + (9 × 2) = 90 + 18 = 108.",
      "points": 1
    }
  ]
}
```

---

## 7. Environment Variables Reference

```
╔════════════════════════════════════════════════════════════════╗
║          ENVIRONMENT VARIABLES BY DEPLOYMENT LAYER            ║
╚════════════════════════════════════════════════════════════════╝

LOCAL DEVELOPMENT (.env FILE)
├─ ANTHROPIC_API_KEY=sk-ant-<key>
├─ ANTHROPIC_MODEL=claude-sonnet-4-20250514
├─ NODE_ENV=development
├─ DEFAULT_OUTPUT_DIR=./worksheets
├─ PORT=3000
├─ DATABASE_TYPE=local
└─ STUDENT_FEATURE_FLAGS=online-solve,rewards-beta

AWS LAMBDA ENVIRONMENT (Injected by CDK)
├─ ANTHROPIC_API_KEY        ← from Secrets Manager
├─ ANTHROPIC_MODEL=claude-sonnet-4-20250514
├─ NODE_ENV=dev|staging|prod
├─ WORKSHEET_BUCKET_NAME    ← S3 bucket for worksheets
├─ FRONTEND_BUCKET_NAME     ← S3 bucket for frontend
├─ ALLOWED_ORIGIN           ← CloudFront domain (CORS)
├─ DATABASE_TYPE=dynamodb
├─ AUTH_TABLE_NAME          ← DynamoDB Users table
├─ CLASSES_TABLE_NAME       ← DynamoDB Classes table
├─ SUBMISSIONS_TABLE_NAME   ← DynamoDB Submissions table
├─ PROGRESS_TABLE_NAME      ← DynamoDB Progress table
├─ REWARDS_TABLE_NAME       ← DynamoDB Rewards table
├─ JWT_SECRET               ← from Secrets Manager
├─ AWS_ACCOUNT_ID
├─ AWS_REGION=us-east-1
└─ FEATURE_FLAGS=online-solve,rewards,question-bank

GITHUB ACTIONS SECRETS
├─ AWS_ACCESS_KEY_ID        ← IAM deploy user key
├─ AWS_SECRET_ACCESS_KEY    ← IAM deploy user secret
├─ AWS_REGION=us-east-1
├─ ANTHROPIC_API_KEY_DEV    ← Anthropic key for dev
├─ ANTHROPIC_API_KEY_STAGING← Anthropic key for staging
└─ ANTHROPIC_API_KEY_PROD   ← Anthropic key for production
```

---

## 8. Related Technical Documents

This document references and complements:

- [AWS Services Technical Reference](aws-services-technical-reference.md) — detailed AWS service inventory
- [Worksheet Architecture](../worksheet_architecture.md) — worksheet generation architecture
- [Technical Review Map](../TECHNICAL_REVIEW_MAP.md) — code review standards and practices

---

**Last Updated:** March 26, 2026  
**Maintained By:** Technical Architecture Team  
**Status:** Production-Ready
