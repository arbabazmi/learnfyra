# System Architecture Overview

## Platform Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              LEARNFYRA PLATFORM              │
                    └─────────────────────────────────────────────┘

  USERS                  EDGE                    COMPUTE                   DATA
  ──────               ──────────             ──────────────           ──────────────
  Teacher    ──HTTPS──► CloudFront ──/api/*──► API Gateway ──────────► Lambda Fns
  Student               (CDN+WAF)  ──/*──────► S3 Frontend           ► DynamoDB
  Parent                                                              ► S3 Worksheets
  Admin                                                               ► Secrets Mgr
                                                                      ► CloudWatch
```

## Detailed Data Flow

```
Browser (Angular 17+ / plain HTML Phase 1)
  │
  ▼
CloudFront Distribution
  ├── /* → S3 Frontend Bucket (static assets: HTML, CSS, JS)
  └── /api/* → API Gateway (REST)
                 │
                 ├── Lambda Authorizer (JWT validation — all protected routes)
                 │
                 ├── POST /api/generate    → learnfyra-generate Lambda (1024MB, 60s)
                 ├── GET  /api/download    → learnfyra-download Lambda (256MB, 30s)
                 ├── GET  /api/worksheets  → learnfyra-list Lambda (128MB, 10s)
                 ├── GET  /api/solve/:id   → learnfyra-solve Lambda (128MB, 10s)
                 ├── POST /api/submit      → learnfyra-submit Lambda (256MB, 15s)
                 ├── POST /api/auth/*      → learnfyra-auth Lambda (256MB, 15s)
                 ├── GET  /api/progress/*  → learnfyra-progress Lambda (256MB, 15s)
                 ├── GET  /api/classes/*   → learnfyra-classes Lambda (128MB, 10s)
                 ├── GET  /api/dashboard   → learnfyra-dashboard Lambda (256MB, 15s)
                 ├── GET  /api/admin/*     → learnfyra-admin Lambda (512MB, 30s)
                 └── GET  /api/health      → learnfyra-health Lambda (128MB, 5s)
```

## Lambda Function Inventory

| Function | Method + Path | Memory | Timeout | Cost Tier |
|---|---|---|---|---|
| learnfyra-generate | POST /api/generate | 1024MB | 60s | High (Claude API call) |
| learnfyra-download | GET /api/download | 256MB | 30s | Medium (S3 presigned URL) |
| learnfyra-list | GET /api/worksheets | 128MB | 10s | Low |
| learnfyra-solve | GET /api/solve/:id | 128MB | 10s | Low (S3 read) |
| learnfyra-submit | POST /api/submit | 256MB | 15s | Medium (scoring + DynamoDB write) |
| learnfyra-auth | POST /api/auth/* | 256MB | 15s | Medium (Cognito calls) |
| learnfyra-authorizer | (Lambda Authorizer) | 128MB | 5s | Low (JWT verify) |
| learnfyra-progress | GET /api/progress/* | 256MB | 15s | Medium (DynamoDB reads) |
| learnfyra-classes | GET/POST /api/classes/* | 128MB | 10s | Low |
| learnfyra-dashboard | GET /api/dashboard | 256MB | 15s | Medium (aggregate queries) |
| learnfyra-admin | GET/POST /api/admin/* | 512MB | 30s | High (multi-table ops) |
| learnfyra-health | GET /api/health | 128MB | 5s | Minimal |

All Lambda functions: ARM_64 (Graviton2), Node.js 18.x, esbuild bundling, X-Ray tracing on staging/prod.

## Cold Start Optimization

All Lambda handlers use lazy imports to minimize cold start time:

```javascript
let _generator;
const getGenerator = async () => {
  if (!_generator) {
    const mod = await import('../../src/ai/generator.js');
    _generator = mod.generateWorksheet;
  }
  return _generator;
};
```

This pattern defers module loading until the first invocation. Subsequent invocations within the same container reuse the cached module reference.

Additional cold start strategies:
- esbuild bundling (single file per handler, no node_modules traversal)
- ARM_64 architecture (faster initialization than x86_64)
- Lazy AWS SDK client instantiation (same pattern as above)
- Secrets Manager value cached in module scope after first fetch

## Data Architecture Summary

| Store | Purpose | Key Pattern |
|---|---|---|
| S3 worksheets bucket | PDF, DOCX, HTML, answer-key, metadata.json, solve-data.json | `worksheets/{year}/{month}/{day}/{uuid}/` |
| S3 frontend bucket | Static HTML, CSS, JS | `index.html`, `css/`, `js/` |
| DynamoDB QuestionBank | Reusable questions with dedupe | PK=questionId, GSI-1 by topic/type |
| DynamoDB Users | User accounts, roles, preferences | PK=userId |
| DynamoDB WorksheetAttempt | Student solve attempts and scores | PK=studentId, SK=worksheetId#{timestamp} |
| DynamoDB GenerationLog | AI generation audit trail | PK=worksheetId |
| DynamoDB Config | Platform config, model routing | PK=configKey |

## Environment Strategy

| Environment | Domain | Branch | Deploy Trigger |
|---|---|---|---|
| local | localhost:3000 | any | `node server.js` |
| dev | web.dev.learnfyra.com / api.dev.learnfyra.com | develop | push to develop |
| staging | web.staging.learnfyra.com / api.staging.learnfyra.com | staging | push to staging |
| prod | web.learnfyra.com / api.learnfyra.com | main | manual approval |

## Local Development Architecture

```
localhost:3000 (Express server.js)
  ├── GET  /              → serve frontend/index.html
  ├── GET  /solve.html    → serve frontend/solve.html
  ├── POST /api/generate  → calls generateHandler.handler(mockEvent, mockContext)
  ├── GET  /api/download  → calls downloadHandler.handler(mockEvent, mockContext)
  ├── GET  /api/solve/:id → calls solveHandler.handler(mockEvent, mockContext)
  └── POST /api/submit    → calls submitHandler.handler(mockEvent, mockContext)

APP_RUNTIME=local:
  - File system replaces S3 (worksheets written to worksheets-local/{uuid}/)
  - Local JSON adapter replaces DynamoDB (QB_ADAPTER=local)
  - No Cognito — JWT verified locally with LOCAL_JWT_SECRET
  - All handlers testable without AWS credentials
```

## Security Model

- All /api/* routes except /api/health and /api/auth/token require valid JWT in Authorization header
- Lambda Authorizer validates JWT signature, expiry, and role claim
- CORS headers on every Lambda response (including OPTIONS preflight)
- S3 worksheet bucket: block all public access, access via presigned URLs only (15-minute expiry)
- Secrets Manager: ANTHROPIC_API_KEY, LOCAL_JWT_SECRET, GOOGLE_CLIENT_SECRET per environment
- No PII stored in worksheet content (metadata.json contains only grade/subject/topic/difficulty)
