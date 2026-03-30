# Learnfyra — Backend Technical Design v2

**Document ID:** LF-ARCH-BACKEND-002
**Author:** architect-agent
**Date:** 2026-03-27
**Status:** Implementation-Ready
**Effort Mode:** standard
**Supersedes:** DATABASE_AND_STORAGE_ARCHITECTURE.md, LAMBDA_SERVERLESS_ARCHITECTURE.md (both kept as historical record)

Cross-references: M01 Auth, M02 QuestionBank, M03 Generator, M04 Solve/Submit, M05 Progress, M06 Classes, M07 Admin

---

## Section 1: Architecture Overview

### 1.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          LEARNFYRA SYSTEM ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────────┘

  Angular 17+ Frontend (S3 Static Hosting)
       │
       ▼
  CloudFront CDN (HTTPS, WAF, edge caching)
       │
       ├──── /* ──────────────────────────► S3 learnfyra-{env}-s3-frontend
       │                                    (index.html, Angular bundles, assets)
       │
       └──── /api/* ──────────────────────► API Gateway REST API
                                             learnfyra-{env}-apigw
                                                   │
                       ┌───────────────────────────┤
                       │   Lambda Authorizer        │
                       │   (JWT validation,         │
                       │   JWKS from Cognito,       │
                       │   300s TTL cache)          │
                       └───────────────────────────┤
                                                    │
            ┌───────────────────────────────────────┼──────────────────────────┐
            │                                       │                          │
            ▼                                       ▼                          ▼
   Lambda: authHandler              Lambda: generateHandler         Lambda: solveHandler
   (register, login,                (bank-first assembly,           (GET /api/solve/:id)
    logout, refresh,                 AI gap-fill via Bedrock,
    oauth, callback)                 Step Functions [FUTURE])       Lambda: submitHandler
            │                               │                       (POST /api/submit)
            ▼                               ▼
   Cognito User Pool             QuestionBank Table (DynamoDB)      Lambda: progressHandler
   (Google OAuth + local)        Worksheets Table (DynamoDB)        Lambda: analyticsHandler
   DynamoDB Users Table          S3: solve-data.json                Lambda: classHandler
                                 S3: worksheet files                Lambda: studentHandler
                                                                    Lambda: rewardsHandler
                                                                    Lambda: adminHandler
                                                                            │
                                                                            ▼
                                                              DynamoDB tables:
                                                              Users, QuestionBank,
                                                              Worksheets, WorksheetAttempts,
                                                              Classes, ClassMemberships,
                                                              ParentStudentLinks,
                                                              AdminConfig, GenerationLog

       Secrets / Config:
       ├── AWS Secrets Manager: /learnfyra/{env}/jwt-secret
       ├── AWS Secrets Manager: /learnfyra/{env}/google-client-secret
       ├── SSM Parameter Store: /learnfyra/{env}/anthropic-api-key
       └── Cognito: learnfyra-{env}-user-pool

       Monitoring:
       └── CloudWatch: per-Lambda error alarms, p95 duration alarms,
                       error-rate alarms, API GW 5xx alarm
```

### 1.2 Environment Strategy

| Aspect | dev | qa (staging) | prod |
|---|---|---|---|
| API throttle (rate/burst) | 2/5 per second | 10/20 per second | 10/20 per second |
| Generate Lambda memory | 512 MB | 1024 MB | 1024 MB |
| Lambda tracing (X-Ray) | DISABLED | ACTIVE | ACTIVE |
| S3 versioning | off | off | on |
| S3/DynamoDB removal policy | DESTROY | DESTROY | RETAIN |
| Cognito domain prefix | learnfyra-dev | learnfyra-staging | learnfyra-prod |
| Google OAuth client ID (dev) | 1079696386286-m95l3vrmh157sgji4njii0afftoglc9b... | — | — |
| Google OAuth client ID (staging) | — | 1079696386286-hjn155lvt8sr4cc0g1e3f8mfvs6mgbk... | — |
| Google OAuth client ID (prod) | — | — | 1079696386286-edsmfmdk6j8073qnm05ui6b2c6o655o... |
| OAUTH_CALLBACK_BASE_URL | https://dev.learnfyra.com | https://qa.learnfyra.com | https://www.learnfyra.com |
| MAX_RETRIES (AI) | 1 | 0 | 0 |
| DynamoDB table names | learnfyra-dev-* | learnfyra-staging-* | learnfyra-prod-* |
| CloudFront custom domain | optional | optional | yes (learnfyra.com) |

### 1.3 Authentication Flow

```
Angular Frontend
    │
    │  1. User clicks "Login with Google"
    ▼
POST /api/auth/oauth/google
    │
    │  Returns: { authorizationUrl: "https://learnfyra-{env}.auth.{region}.amazoncognito.com/oauth2/authorize?..." }
    │  (PKCE code_challenge embedded, CSRF state signed with JWT_SECRET)
    ▼
Browser → Cognito Hosted UI → Google OAuth Consent
    │
    │  Google authenticates, redirects to Cognito callback URL
    ▼
Cognito → GET /api/auth/callback/google?code=...&state=...
    │
    │  cognitoAdapter.js:
    │    1. Validates CSRF state signature
    │    2. Exchanges code + code_verifier for Cognito tokens
    │    3. Fetches user info from Cognito /oauth2/userInfo
    │    4. Upserts user in DynamoDB Users table (PK: USER#{cognitoSub})
    │    5. Issues HS256 access token (1h) + refresh token (30d) via tokenUtils.js
    │
    │  Returns: { userId, email, role, displayName, token, refreshToken }
    ▼
Angular stores access token in memory (NOT localStorage)
    │
    │  All subsequent API calls:
    │  Authorization: Bearer <access_token>
    ▼
API Gateway → Lambda Authorizer (apiAuthorizerHandler.js)
    │
    │  Validates JWT:
    │    - Signature check using JWT_SECRET (HS256) or Cognito JWKS (RS256 future)
    │    - Expiry check
    │    - Extracts: userId (sub), email, role
    │  Returns: IAM Allow policy with context { userId, email, role }
    ▼
Lambda Handler receives event.requestContext.authorizer.{ userId, email, role }
```

---

## Section 2: DynamoDB Table Design

All table names follow the pattern `learnfyra-{env}-{tablename}`. CDK uses `appEnv` to inject the environment suffix.

**Design philosophy:** Single-table is NOT forced where access patterns are clearly scoped to one entity type. Multiple well-defined tables are used rather than one mega-table. Cross-table joins are replaced by denormalization (storing teacherId in worksheet records, classId in attempt records).

### 2.1 Table: learnfyra-{env}-users

**Purpose:** User identity and profile storage for all roles. (M01)

| Key | Pattern | Example |
|---|---|---|
| PK | `USER#{userId}` | `USER#a1b2c3d4-...` |
| SK | `PROFILE` | `PROFILE` |

**Attributes:**

| Attribute | Type | Required | Description |
|---|---|---|---|
| PK | String | YES | `USER#{cognitoSub}` — Cognito sub is the canonical userId |
| SK | String | YES | `PROFILE` (fixed) |
| userId | String | YES | UUID — same as Cognito sub |
| email | String | YES | Normalized lowercase |
| displayName | String | YES | Full name from OAuth or registration |
| role | String | YES | `student` / `teacher` / `parent` / `admin` |
| provider | String | YES | `google` / `local` |
| linkedProviders | List | NO | Array of provider strings for multi-provider linking |
| passwordHash | String | NO | bcrypt hash — only for `local` provider accounts |
| linkedChildIds | List | NO | Array of student userId strings — only for `parent` role |
| activeFlag | Boolean | YES | `true` — set to `false` by admin deactivation |
| createdAt | String | YES | ISO-8601 |
| lastLogin | String | NO | ISO-8601 — updated on each successful login |
| repeatCapOverride | Number | NO | Admin-configured repeat cap (0–100) for this user |

**GSI-1: Role-by-CreatedAt (admin user listing)**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-users-gsi-role` |
| GSI PK | `roleIndex` = `ROLE#{role}` |
| GSI SK | `createdAt` (ISO-8601 sortable) |
| Projection | ALL |
| Access Pattern | List all users by role, sorted by creation date (admin UI FR-ADMIN-001, FR-ADMIN-002) |

**GSI-2: Email lookup (auth dedup)**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-users-gsi-email` |
| GSI PK | `email` |
| GSI SK | — (no range key) |
| Projection | KEYS_ONLY + userId, role, activeFlag, passwordHash, provider |
| Access Pattern | Look up user by email on login (REQ-AUTH-003), check duplicate on register (REQ-AUTH-002) |

---

### 2.2 Table: learnfyra-{env}-question-bank

**Purpose:** Store reusable AI-generated questions with curriculum metadata, deduplication, and reuse tracking. (M02, M03)

| Key | Pattern | Example |
|---|---|---|
| PK | `QUESTION#{questionId}` | `QUESTION#7f3a2e1b-...` |
| SK | `METADATA` | `METADATA` |

**Attributes:**

| Attribute | Type | Required | Description |
|---|---|---|---|
| PK | String | YES | `QUESTION#{questionId}` |
| SK | String | YES | `METADATA` |
| questionId | String | YES | UUID v4 |
| grade | Number | YES | 1–10 |
| subject | String | YES | Math / ELA / Science / Social Studies / Health |
| topic | String | YES | e.g., "Multiplication" |
| difficulty | String | YES | Easy / Medium / Hard |
| type | String | YES | multiple-choice / fill-in-the-blank / short-answer / true-false / matching / show-your-work / word-problem |
| questionText | String | YES | The question string |
| options | List | NO | A/B/C/D strings — multiple-choice only |
| answer | String | YES | Authoritative correct answer |
| explanation | String | YES | Explanation for answer key and post-submit review |
| standard | String | NO | CCSS or NGSS code |
| hash | String | YES | SHA-256 of normalized(questionText + answer) — used for deduplication |
| modelUsed | String | YES | e.g., `claude-sonnet-4-20250514` |
| promptVersion | String | NO | Prompt version tag |
| reuseCount | Number | YES | Incremented on each reuse (default: 0) |
| qualityFlag | String | NO | `approved` / `flagged` / `pending` — admin content review |
| createdAt | String | YES | ISO-8601 |
| points | Number | YES | Point value (default: 1) |

**GSI-1: Curriculum lookup (primary question bank query)**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-qb-gsi-curriculum` |
| GSI PK | `curriculumKey` = `GRADE#{grade}#SUBJECT#{subject}` |
| GSI SK | `topicDiffKey` = `TOPIC#{topic}#DIFF#{difficulty}` |
| Projection | ALL |
| Access Pattern | Get banked questions by grade + subject + topic + difficulty (bank-first assembly, REQ-GEN-002) |

**GSI-2: Difficulty scan (model routing)**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-qb-gsi-difficulty` |
| GSI PK | `diffKey` = `DIFFICULTY#{difficulty}` |
| GSI SK | `subjectGradeKey` = `SUBJECT#{subject}#GRADE#{grade}` |
| Projection | KEYS_ONLY + questionId, type, reuseCount |
| Access Pattern | Count available questions by difficulty for model tier decisions (REQ-GEN-004) |

**GSI-3: Hash deduplication check**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-qb-gsi-hash` |
| GSI PK | `hash` |
| GSI SK | — |
| Projection | KEYS_ONLY |
| Access Pattern | Prevent storing duplicate questions on AI generation (REQ-GEN-006) |

---

### 2.3 Table: learnfyra-{env}-worksheets

**Purpose:** Worksheet generation records linking teachers to generated content, supporting async status polling. (M02, M03)

| Key | Pattern | Example |
|---|---|---|
| PK | `WORKSHEET#{worksheetId}` | `WORKSHEET#b9e7d1c4-...` |
| SK | `METADATA` | `METADATA` |

**Attributes:**

| Attribute | Type | Required | Description |
|---|---|---|---|
| PK | String | YES | `WORKSHEET#{worksheetId}` |
| SK | String | YES | `METADATA` |
| worksheetId | String | YES | UUID v4 |
| teacherId | String | YES | userId of requesting teacher — from JWT |
| grade | Number | YES | 1–10 |
| subject | String | YES | |
| topic | String | YES | |
| difficulty | String | YES | Easy / Medium / Hard / Mixed |
| questionCount | Number | YES | Total questions requested |
| format | String | YES | pdf / docx / html |
| status | String | YES | `PENDING` / `COMPLETED` / `FAILED` |
| s3Prefix | String | NO | S3 key prefix: `worksheets/{year}/{month}/{day}/{uuid}/` |
| totalPoints | Number | NO | Sum of question points |
| modelUsed | String | NO | Primary AI model used |
| stepFunctionExecutionArn | String | NO | ARN when async Step Functions path used |
| questionIds | List | NO | Array of questionIds — references into question bank |
| createdAt | String | YES | ISO-8601 |
| expiresAt | String | YES | ISO-8601 — 7 days after creation (aligned with S3 lifecycle) |
| assignedClassIds | List | NO | Classes this worksheet has been assigned to |
| studentName | String | NO | Optional personalization |

**GSI-1: Teacher worksheets**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-worksheets-gsi-teacher` |
| GSI PK | `teacherKey` = `TEACHER#{teacherId}` |
| GSI SK | `createdAt` |
| Projection | ALL |
| Access Pattern | List all worksheets generated by a teacher (M05 dashboard, REQ-GEN-014) |

---

### 2.4 Table: learnfyra-{env}-worksheet-attempts

**Purpose:** Persist every student online solve attempt with answers, scoring, and session metadata. (M04, M05)

| Key | Pattern | Example |
|---|---|---|
| PK | `STUDENT#{studentId}` | `STUDENT#a1b2c3-...` |
| SK | `WORKSHEET#{worksheetId}#ATTEMPT#{attemptId}` | `WORKSHEET#b9e7-...#ATTEMPT#c3d4-...` |

**Rationale:** The most frequent access pattern from M05 is "all attempts for student X, optionally filtered by worksheet." Student-first PK with compound SK allows both queries with SK begins_with.

**Attributes:**

| Attribute | Type | Required | Description |
|---|---|---|---|
| PK | String | YES | `STUDENT#{studentId}` |
| SK | String | YES | `WORKSHEET#{worksheetId}#ATTEMPT#{attemptId}` |
| attemptId | String | YES | UUID v4 |
| studentId | String | YES | userId — from JWT |
| worksheetId | String | YES | UUID v4 — FK to Worksheets table |
| classId | String | NO | If solved as a class assignment |
| teacherId | String | NO | Denormalized from worksheet — enables teacher queries without join |
| grade | Number | YES | Denormalized from worksheet |
| subject | String | YES | Denormalized |
| topic | String | YES | Denormalized |
| difficulty | String | YES | Denormalized |
| mode | String | YES | `practice` / `test` / `timed` |
| status | String | YES | `COMPLETED` / `ABANDONED` |
| score | Number | YES | Raw score (sum of pointsEarned) |
| totalPoints | Number | YES | Maximum possible points |
| percentage | Number | YES | Integer 0–100 |
| timeTaken | Number | YES | Seconds taken |
| timed | Boolean | YES | Was this a timed attempt |
| answers | Map | YES | `{ "1": "B", "2": "True" }` — student answers by question number |
| results | List | YES | Full result array from submitHandler |
| startedAt | String | YES | ISO-8601 |
| submittedAt | String | YES | ISO-8601 |
| rewardsGranted | Map | NO | `{ xp: N, badgesEarned: [...] }` |

**GSI-1: Teacher class analytics**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-attempts-gsi-teacher` |
| GSI PK | `teacherSubjectKey` = `TEACHER#{teacherId}#SUBJECT#{subject}` |
| GSI SK | `submittedAt` |
| Projection | INCLUDE: studentId, worksheetId, score, totalPoints, percentage, topic, difficulty, timeTaken |
| Access Pattern | Teacher views class performance by subject over time (M05 analytics) |

**GSI-2: Class-level attempt aggregation**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-attempts-gsi-class` |
| GSI PK | `classKey` = `CLASS#{classId}` |
| GSI SK | `submittedAt` |
| Projection | INCLUDE: studentId, worksheetId, score, totalPoints, percentage, topic, subject, difficulty |
| Access Pattern | Teacher views all attempts within a class (GET /api/analytics/class/{id}) |

---

### 2.5 Table: learnfyra-{env}-classes

**Purpose:** Teacher-created class records with invite codes. Class membership records use the same table with a different SK pattern. (M06)

**Class metadata record:**

| Key | Pattern |
|---|---|
| PK | `CLASS#{classId}` |
| SK | `METADATA` |

**Attributes:** classId, teacherId, className, subject, grade, inviteCode, activeFlag, createdAt, studentCount (denormalized)

**Membership record (same table, different SK):**

| Key | Pattern |
|---|---|
| PK | `CLASS#{classId}` |
| SK | `MEMBER#{studentId}` |

**Attributes:** studentId, studentName (denormalized), joinedAt, activeFlag

**GSI-1: Teacher classes**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-classes-gsi-teacher` |
| GSI PK | `teacherKey` = `TEACHER#{teacherId}` |
| GSI SK | `createdAt` |
| Projection | ALL |
| Access Pattern | Teacher views their classes |

**GSI-2: Invite code lookup**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-classes-gsi-invite` |
| GSI PK | `inviteCode` |
| GSI SK | — |
| Projection | KEYS_ONLY + classId, teacherId, className, subject, grade, activeFlag |
| Access Pattern | Student joins class by invite code |

**GSI-3: Student membership lookup**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-classes-gsi-student` |
| GSI PK | `studentKey` = `STUDENT#{studentId}` |
| GSI SK | `joinedAt` |
| Projection | INCLUDE: classId, className, teacherId, subject, grade |
| Access Pattern | Student views enrolled classes |

---

### 2.6 Table: learnfyra-{env}-parent-links

**Purpose:** Parent-child relationship tracking with access control enforcement. (M01, M05, M06)

| Key | Pattern |
|---|---|
| PK | `PARENT#{parentId}` |
| SK | `CHILD#{childId}` |

**Attributes:** parentId, childId, linkedAt, verifiedFlag

**GSI-1: Reverse child-parent lookup**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-parent-links-gsi-child` |
| GSI PK | `childKey` = `CHILD#{childId}` |
| GSI SK | — |
| Projection | ALL |
| Access Pattern | Given a child, find their parent(s) — access control enforcement (REQ-AUTH-018) |

---

### 2.7 Table: learnfyra-{env}-admin-config

**Purpose:** System-wide operational configuration managed by admin users. (M07)

| Key | Pattern | Example |
|---|---|---|
| PK | `CONFIG#{configType}` | `CONFIG#MODEL_ROUTING` |
| SK | `CURRENT` or `VERSION#{n}` | `CURRENT` |

**Standard CONFIG payloads:**

`CONFIG#MODEL_ROUTING / CURRENT`:
```json
{
  "defaultMode": "auto",
  "allowPremium": true,
  "premiumEscalation": {
    "missingCountThreshold": 15,
    "hardQuestionCountThreshold": 10
  },
  "fallbackOrder": ["low", "default", "premium"]
}
```

`CONFIG#REPEAT_CAP_POLICY / CURRENT`:
```json
{
  "defaultCapPercent": 10,
  "studentOverrides": {},
  "teacherOverrides": {},
  "parentOverrides": {}
}
```

`CONFIG#BUDGET_LIMITS / CURRENT`:
```json
{
  "dailyUsdSoftLimit": 100,
  "dailyUsdHardLimit": 150,
  "perRequestMaxUsd": 0.50
}
```

---

### 2.8 Table: learnfyra-{env}-generation-log

**Purpose:** AI generation audit trail including token usage, latency, and model selection. (M02, M07)

| Key | Pattern |
|---|---|
| PK | `GENERATION#{requestId}` |
| SK | `METADATA` |

**Attributes:** requestId, worksheetId, teacherId, inputParams (Map), bankedQuestions, aiGeneratedQuestions, modelUsed, totalTokensUsed, estimatedCostUsd, latencyMs, status, errorDetails, createdAt, ttl (90-day DynamoDB TTL)

**GSI-1: Teacher usage tracking**

| Property | Value |
|---|---|
| GSI Name | `learnfyra-{env}-genlog-gsi-teacher` |
| GSI PK | `teacherKey` = `TEACHER#{teacherId}` |
| GSI SK | `createdAt` |
| Projection | INCLUDE: worksheetId, modelUsed, totalTokensUsed, estimatedCostUsd, status |
| Access Pattern | Admin views AI usage per teacher, quota enforcement (REQ-GEN-013, FR-ADMIN-009) |

---

## Section 3: API Endpoint Inventory

All routes prefixed `/api`. CORS headers on all responses including errors.

### 3.1 M01 — Authentication

| Method | Route | Auth | Role | Handler | Description |
|---|---|---|---|---|---|
| POST | /api/auth/register | No | — | authHandler.js | Local email/password registration |
| POST | /api/auth/login | No | — | authHandler.js | Local email/password login |
| POST | /api/auth/logout | No | — | authHandler.js | Client-side token invalidation |
| POST | /api/auth/refresh | No | — | authHandler.js | Exchange refresh token for new access token |
| POST | /api/auth/oauth/{provider} | No | — | authHandler.js | Return Cognito OAuth authorization URL |
| GET | /api/auth/callback/{provider} | No | — | authHandler.js | OAuth callback — exchange code, issue JWT |
| OPTIONS | /api/auth/* | No | — | API GW | CORS preflight |

Rate limits: `/api/auth/register` and `/api/auth/login` at 1 req/s burst 2 (API GW method-level throttle).

### 3.2 M02/M03 — Worksheet Generation

| Method | Route | Auth | Role | Handler | Description |
|---|---|---|---|---|---|
| POST | /api/generate | Yes | teacher, admin | generateHandler.js | Generate worksheet — bank-first + AI pipeline |
| GET | /api/download | Yes | teacher, admin, student | downloadHandler.js | Presigned S3 URL for worksheet download |
| GET | /api/worksheets/{id}/status | Yes | teacher | worksheetStatusHandler.js | Poll async generation status [PLANNED] |
| OPTIONS | /api/generate | No | — | API GW | CORS preflight |
| OPTIONS | /api/download | No | — | API GW | CORS preflight |

### 3.3 M02 — Question Bank Admin

| Method | Route | Auth | Role | Handler | Description |
|---|---|---|---|---|---|
| GET | /api/qb/questions | Yes | admin | questionBankHandler.js | List questions with curriculum filters |
| POST | /api/qb/questions | Yes | admin | questionBankHandler.js | Manually add question to bank |
| GET | /api/qb/questions/{id} | Yes | admin | questionBankHandler.js | Get single question |
| PUT | /api/qb/questions/{id}/flag | Yes | admin | questionBankHandler.js | Flag/approve question |

### 3.4 M04 — Online Solve & Submit

| Method | Route | Auth | Role | Handler | Description |
|---|---|---|---|---|---|
| GET | /api/solve/{worksheetId} | Yes | student, teacher | solveHandler.js | Return questions WITHOUT answer/explanation |
| POST | /api/submit | Yes | student | submitHandler.js | Score submission, return results, write attempt to DynamoDB |
| OPTIONS | /api/solve/{worksheetId} | No | — | API GW | CORS preflight |
| OPTIONS | /api/submit | No | — | API GW | CORS preflight |

### 3.5 M05 — Progress & Reporting

| Method | Route | Auth | Role | Handler | Description |
|---|---|---|---|---|---|
| POST | /api/progress/save | Yes | student | progressHandler.js | Save worksheet attempt (offline or fallback) |
| GET | /api/progress/history | Yes | student | progressHandler.js | Student's attempt history + weak-topic aggregates |
| GET | /api/analytics/class/{id} | Yes | teacher | analyticsHandler.js | Class-level performance summary |
| GET | /api/progress/student/{id} | Yes | teacher, parent | progressHandler.js | View specific student's progress [PLANNED] |
| POST | /api/progress/offline | Yes | teacher, parent | progressHandler.js | Upload offline worksheet scores [PLANNED] |
| GET | /api/analytics/teacher | Yes | teacher | analyticsHandler.js | Teacher's aggregate stats [PLANNED] |

### 3.6 M06 — Class & Relationship Management

| Method | Route | Auth | Role | Handler | Description |
|---|---|---|---|---|---|
| POST | /api/class/create | Yes | teacher | classHandler.js | Create class, generate invite code |
| GET | /api/class/{id}/students | Yes | teacher | classHandler.js | List students in class |
| POST | /api/class/{id}/assign | Yes | teacher | classHandler.js | Assign worksheet to class [PLANNED] |
| GET | /api/student/profile | Yes | student | studentHandler.js | Student profile + enrolled classes |
| POST | /api/student/join-class | Yes | student | studentHandler.js | Join class by invite code |
| POST | /api/parent/link-child | Yes | parent | studentHandler.js | Request parent-child link [PLANNED] |
| GET | /api/parent/children | Yes | parent | studentHandler.js | List linked children [PLANNED] |
| GET | /api/parent/child/{id}/progress | Yes | parent | progressHandler.js | View linked child's progress [PLANNED] |

### 3.7 M07 — Admin Control Plane

| Method | Route | Auth | Role | Handler | Description |
|---|---|---|---|---|---|
| GET | /api/admin/policy | Yes | admin | adminHandler.js | Get current operational policy |
| PUT | /api/admin/policy | Yes | admin | adminHandler.js | Update policy — writes new version |
| GET | /api/admin/users | Yes | admin | adminHandler.js | List users with role filter [PLANNED] |
| PUT | /api/admin/users/{id}/role | Yes | admin | adminHandler.js | Change user role [PLANNED] |
| PUT | /api/admin/users/{id}/active | Yes | admin | adminHandler.js | Deactivate/reactivate account [PLANNED] |
| GET | /api/admin/worksheets | Yes | admin | adminHandler.js | List worksheets with metadata [PLANNED] |
| GET | /api/admin/generation-log | Yes | admin | adminHandler.js | AI usage statistics [PLANNED] |

---

## Section 4: Lambda Function Inventory

All functions: ARM_64 (except generateHandler — see note), `NodejsFunction` with esbuild, `context.callbackWaitsForEmptyEventLoop = false`, CORS on all responses.

| Function Name | Handler File | Arch | Memory | Timeout | DynamoDB Tables | S3 Access | Key Env Vars |
|---|---|---|---|---|---|---|---|
| `learnfyra-{env}-lambda-auth` | authHandler.js | ARM_64 | 256 MB | 15s | users (R/W) | None | JWT_SECRET, AUTH_MODE, OAUTH_CALLBACK_BASE_URL, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID, COGNITO_DOMAIN, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-api-authorizer` | apiAuthorizerHandler.js | ARM_64 | 128 MB | 5s | None | None | JWT_SECRET, AUTH_MODE |
| `learnfyra-{env}-lambda-generate` | generateHandler.js | X86_64* | 512MB/1024MB | 60s | question-bank (R/W), worksheets (W), generation-log (W) | worksheets bucket (R/W) | WORKSHEET_BUCKET_NAME, CLAUDE_MODEL, SSM_PARAM_NAME, QB_ADAPTER, DYNAMODB_TABLE_QUESTION_BANK, DYNAMODB_TABLE_WORKSHEETS, DYNAMODB_TABLE_GENERATION_LOG, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-download` | downloadHandler.js | ARM_64 | 256 MB | 30s | None | worksheets bucket (R) | WORKSHEET_BUCKET_NAME, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-solve` | solveHandler.js | ARM_64 | 128 MB | 10s | None | worksheets bucket (R) | WORKSHEET_BUCKET_NAME, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-submit` | submitHandler.js | ARM_64 | 256 MB | 15s | worksheet-attempts (W) **[NEEDED]** | worksheets bucket (R) | WORKSHEET_BUCKET_NAME, DYNAMODB_TABLE_ATTEMPTS **[NEEDED]**, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-progress` | progressHandler.js | ARM_64 | 256 MB | 15s | worksheet-attempts (R/W) **[NEEDED]** | None | JWT_SECRET, AUTH_MODE, DYNAMODB_TABLE_ATTEMPTS **[NEEDED]**, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-analytics` | analyticsHandler.js | ARM_64 | 256 MB | 15s | worksheet-attempts (R) **[NEEDED]** | None | JWT_SECRET, AUTH_MODE, DYNAMODB_TABLE_ATTEMPTS **[NEEDED]**, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-class` | classHandler.js | ARM_64 | 128 MB | 10s | classes (R/W) **[NEEDED]** | None | JWT_SECRET, AUTH_MODE, DYNAMODB_TABLE_CLASSES **[NEEDED]**, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-student` | studentHandler.js | ARM_64 | 128 MB | 10s | classes (R/W), users (R) **[NEEDED]** | None | JWT_SECRET, AUTH_MODE, DYNAMODB_TABLE_CLASSES, DYNAMODB_TABLE_USERS **[NEEDED]**, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-rewards` | rewardsHandler.js | ARM_64 | 128 MB | 10s | worksheet-attempts (R) **[NEEDED]** | None | JWT_SECRET, AUTH_MODE, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-admin` | adminHandler.js | ARM_64 | 256 MB | 15s | admin-config (R/W), question-bank (R/W) **[NEEDED]** | None | JWT_SECRET, AUTH_MODE, DYNAMODB_TABLE_ADMIN_CONFIG, DYNAMODB_TABLE_QUESTION_BANK **[NEEDED]**, ALLOWED_ORIGIN |
| `learnfyra-{env}-lambda-pre-token-generation` | preTokenGenerationHandler.js | ARM_64 | 128 MB | 5s | users (R) **[NEW]** | None | DYNAMODB_TABLE_USERS |
| `learnfyra-{env}-lambda-post-confirmation` | postConfirmationHandler.js | ARM_64 | 128 MB | 5s | users (W) **[NEW]** | None | DYNAMODB_TABLE_USERS |

*X86_64 for generateHandler because @sparticuz/chromium does not provide an ARM Lambda binary. All other functions run ARM_64 for ~20% cost/performance benefit.

**[NEEDED]** = DynamoDB table or env var wiring not yet present in CDK stack. **[NEW]** = New handler file must be written.

---

## Section 5: Step Functions Workflow (Async Generation)

### 5.1 Current vs Target State

**Current:** POST /api/generate is synchronous. Works for ≤10–15 questions but will timeout for 30–50 question worksheets (60s Lambda limit).

**Target:** Step Functions async pipeline when AI is needed for > 8 questions. Synchronous path kept for fully-banked requests.

### 5.2 State Machine: learnfyra-{env}-sfn-worksheet-generator

**Trigger:** generateHandler.js calls `StartExecution` when `missingCount > MAX_SYNC_THRESHOLD` (recommended: 8). Returns `{ worksheetId, status: "PENDING" }` immediately.

**States:**
```
BankLookup → EvaluateBankCoverage →
  if missingCount > 0: AIGenerationMap (parallel batches, MaxConcurrency: 3) →
  Validation → Assembly → StoreAndRender → UpdateStatus (COMPLETED)
  on any failure: → GenerationFailed (FAILED)
```

**Batch sizing:** 5 questions per Map iteration. 10 questions = 2 batches. 50 questions = 10 batches.

### 5.3 Client Polling

```
GET /api/worksheets/{worksheetId}/status

PENDING:  { "worksheetId": "...", "status": "PENDING" }
COMPLETED: { "worksheetId": "...", "status": "COMPLETED", "downloadUrl": "https://..." }
FAILED:   { "worksheetId": "...", "status": "FAILED", "error": "..." }
```

Angular polling strategy: exponential backoff starting 2s, max 30s, timeout after 5 minutes.

### 5.4 CDK Resources Needed (Phase 3)

- `AWS::StepFunctions::StateMachine` construct
- 4–5 new focused Lambda functions (bank-lookup, ai-batch, validate-questions, assemble, store-worksheet)
- `stateMachine.grantStartExecution(generateFn)`
- `GENERATOR_STATE_MACHINE_ARN` injected into generateFn env

---

## Section 6: Cognito Setup

### 6.1 User Pool

| Property | Value |
|---|---|
| Resource name | `learnfyra-{env}-user-pool` |
| Self sign-up | Disabled |
| Sign-in alias | Email only |
| Auto verify | Email |
| Removal policy (prod) | RETAIN |
| Removal policy (dev/staging) | DESTROY |

### 6.2 App Client

| Property | Value |
|---|---|
| Client name | `learnfyra-{env}-app-client` |
| Client secret | None (public client — PKCE) |
| Auth flows | Authorization Code Grant |
| OAuth scopes | openid, email, profile |
| Callback URLs | `{callbackBaseUrl}/api/auth/callback/google` |
| Supported IdPs | Google |

### 6.3 Identity Providers

**Google OAuth:**
- Client ID: environment-specific (documented in module-breakdown-phase1.md — not a secret)
- Client secret: resolved from AWS Secrets Manager at deploy time: `/learnfyra/{env}/google-client-secret`
- Attribute mapping: `email → email`, `name → fullname`

### 6.4 Lambda Triggers (Add to CDK)

| Trigger | Purpose | Handler |
|---|---|---|
| Pre-token-generation | Inject `custom:role` into Cognito access token — eliminates DynamoDB lookup per request in authorizer | preTokenGenerationHandler.js [NEW] |
| Post-confirmation | Upsert user record in DynamoDB after email verification | postConfirmationHandler.js [NEW] |

### 6.5 CDK Wiring

```typescript
userPool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION, preTokenFn);
userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationFn);
```

---

## Section 7: Lambda Authorizer Design

### 7.1 Properties

| Property | Value |
|---|---|
| Function name | `learnfyra-{env}-lambda-api-authorizer` |
| Handler | `backend/handlers/apiAuthorizerHandler.js` |
| Architecture | ARM_64 |
| Memory | 128 MB |
| Timeout | 5 seconds |
| Identity source | `method.request.header.Authorization` |
| Results cache TTL | 300 seconds |

### 7.2 Token Validation

1. Extract Bearer token from Authorization header
2. Verify JWT signature with JWT_SECRET (HS256)
3. Check expiry — reject if expired
4. Extract claims: `sub` (userId), `email`, `role`
5. Build IAM Allow policy for `arn:aws:execute-api:{region}:{account}:{apiId}/*`
6. Attach context: `{ userId: sub, email, role }`
7. On any failure: return Deny policy (never throw — throwing bypasses cache)

**FUTURE:** RS256 validation against Cognito JWKS endpoint: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json`

### 7.3 Context Forwarding to Handlers

```javascript
const userId = event.requestContext.authorizer.userId;
const role   = event.requestContext.authorizer.role;
const email  = event.requestContext.authorizer.email;
```

### 7.4 CORS and OPTIONS

OPTIONS requests do NOT invoke the authorizer. API Gateway's `defaultCorsPreflightOptions` handles OPTIONS at the gateway layer before the authorizer runs.

---

## Section 8: Environment Variables Reference

| Env Var | Lambda(s) | Source | Notes |
|---|---|---|---|
| `NODE_ENV` | All | CDK context `appEnv` | `dev` / `staging` / `prod` |
| `ALLOWED_ORIGIN` | All | CDK — CloudFront domain | `*` in dev without custom domain |
| `JWT_SECRET` | auth, authorizer, progress, analytics, class, rewards, student | Secrets Manager `/learnfyra/{env}/jwt-secret` | Resolved at deploy |
| `AUTH_MODE` | auth, authorizer, progress, analytics, class, rewards, student | CDK hardcoded | `cognito` |
| `OAUTH_CALLBACK_BASE_URL` | auth | CDK — CloudFront domain | `https://dev.learnfyra.com` |
| `COGNITO_USER_POOL_ID` | auth | CDK — Cognito construct output | Resolved at deploy |
| `COGNITO_APP_CLIENT_ID` | auth | CDK — Cognito construct output | Resolved at deploy |
| `COGNITO_DOMAIN` | auth | CDK constructed | `https://learnfyra-{env}.auth.{region}.amazoncognito.com` |
| `WORKSHEET_BUCKET_NAME` | generate, download, solve, submit | CDK — S3 bucket name | `learnfyra-{env}-s3-worksheets` |
| `CLAUDE_MODEL` | generate | CDK hardcoded | `claude-sonnet-4-20250514` |
| `SSM_PARAM_NAME` | generate | CDK hardcoded | `/learnfyra/{env}/anthropic-api-key` |
| `QB_ADAPTER` | generate, admin | CDK | `local` → migrate to `dynamodb` |
| `DYNAMODB_TABLE_USERS` | auth, student | CDK table name output | `learnfyra-{env}-users` **[NEEDED]** |
| `DYNAMODB_TABLE_QUESTION_BANK` | generate, admin | CDK table name output | `learnfyra-{env}-question-bank` **[NEEDED]** |
| `DYNAMODB_TABLE_WORKSHEETS` | generate | CDK table name output | `learnfyra-{env}-worksheets` **[NEEDED]** |
| `DYNAMODB_TABLE_ATTEMPTS` | submit, progress, analytics, rewards | CDK table name output | `learnfyra-{env}-worksheet-attempts` **[NEEDED]** |
| `DYNAMODB_TABLE_CLASSES` | class, student | CDK table name output | `learnfyra-{env}-classes` **[NEEDED]** |
| `DYNAMODB_TABLE_PARENT_LINKS` | auth, student, progress | CDK table name output | `learnfyra-{env}-parent-links` **[NEEDED]** |
| `DYNAMODB_TABLE_ADMIN_CONFIG` | admin, generate | CDK table name output | `learnfyra-{env}-admin-config` **[NEEDED]** |
| `DYNAMODB_TABLE_GENERATION_LOG` | generate | CDK table name output | `learnfyra-{env}-generation-log` **[NEEDED]** |
| `GENERATOR_STATE_MACHINE_ARN` | generate | CDK Step Functions output | Required for async path **[FUTURE]** |

**[NEEDED]** = Not yet in CDK. Must be added with DynamoDB table constructs (Section 10).

---

## Section 9: Cross-Module Integration Points

### 9.1 Auth Token Flow

```
Login → tokenUtils.signToken({ sub: userId, email, role }) → JWT
Angular stores in memory → injects Authorization: Bearer {token}
API GW → Lambda Authorizer validates → context { userId, email, role }
Handler reads event.requestContext.authorizer.{ userId, email, role }
assertRole(['teacher']) for fine-grained RBAC
```

### 9.2 Worksheet → Solve Relationship

```
1. POST /api/generate → generateHandler assembles questions → uploads:
   - worksheets/{date}/{uuid}/worksheet.pdf (+ docx, html)
   - worksheets/{date}/{uuid}/solve-data.json  ← CRITICAL (answers included)
   - Writes to learnfyra-{env}-worksheets DynamoDB table

2. Teacher shares worksheetId with students

3. GET /api/solve/{worksheetId} → solveHandler reads solve-data.json
   → STRIPS answer and explanation → returns safe question list

4. POST /api/submit → submitHandler reads solve-data.json (authoritative answers)
   → calls scorer.js → resultBuilder.js → returns results
   → SHOULD write attempt to worksheet-attempts table atomically [see Risk 2]

5. GET /api/progress/history → reads attempt records from DynamoDB
```

### 9.3 Current Gap: Two-Call Progress Pattern

```
CURRENT (two-call):
  POST /api/submit → scores, returns results (no DB write)
  POST /api/progress/save → client calls this to persist the attempt

RECOMMENDED (single-call, OD-1):
  POST /api/submit → scores AND writes attempt to DynamoDB atomically
  POST /api/progress/save → deprecated or repurposed for offline-only
```

### 9.4 Class → Worksheet Assignment

```
1. Teacher generates worksheet → gets worksheetId
2. POST /api/class/{classId}/assign { worksheetId, dueDate }
3. classHandler validates teacher owns class → writes:
   PK: CLASS#{classId}, SK: ASSIGNMENT#{worksheetId}
   Attributes: { assignedAt, dueDate, assignedBy: teacherId }

4. Student submits attempt → classId resolved from student's enrolled classes
   vs worksheet's assignedClassIds → stored on attempt record → enables class analytics
```

### 9.5 Parent-Child Access Control

```
Parent calls GET /api/parent/child/{childId}/progress:
1. role = 'parent' enforced by assertRole
2. Query learnfyra-{env}-parent-links: PK=PARENT#{parentId}, SK=CHILD#{childId}
3. Not found or verifiedFlag=false → 403
4. Found → proceed to query worksheet-attempts for child's data
```

---

## Section 10: CDK Stack Additions Needed

### 10.1 New DynamoDB Tables (8 tables)

Pattern for each:
```typescript
const usersTable = new dynamodb.Table(this, 'UsersTable', {
  tableName: `learnfyra-${appEnv}-users`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy,
  pointInTimeRecovery: isProd,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
});
usersTable.addGlobalSecondaryIndex({
  indexName: `learnfyra-${appEnv}-users-gsi-role`,
  partitionKey: { name: 'roleIndex', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

| Table | Construct ID | TTL Attribute |
|---|---|---|
| learnfyra-{env}-users | UsersTable | — |
| learnfyra-{env}-question-bank | QuestionBankTable | — |
| learnfyra-{env}-worksheets | WorksheetsTable | `expiresAt` |
| learnfyra-{env}-worksheet-attempts | WorksheetAttemptsTable | — |
| learnfyra-{env}-classes | ClassesTable | — |
| learnfyra-{env}-parent-links | ParentLinksTable | — |
| learnfyra-{env}-admin-config | AdminConfigTable | — |
| learnfyra-{env}-generation-log | GenerationLogTable | `ttl` (90-day) |

### 10.2 IAM Grants Matrix

| Table | Lambda | Grant |
|---|---|---|
| UsersTable | authFn, studentFn | grantReadWriteData |
| QuestionBankTable | generateFn, adminFn | grantReadWriteData |
| WorksheetsTable | generateFn | grantWriteData |
| WorksheetAttemptsTable | submitFn, progressFn, analyticsFn, rewardsFn | grantReadWriteData |
| ClassesTable | classFn, studentFn | grantReadWriteData |
| ParentLinksTable | authFn, progressFn, studentFn | grantReadWriteData |
| AdminConfigTable | adminFn | grantReadWriteData; generateFn: grantReadData |
| GenerationLogTable | generateFn | grantWriteData |

### 10.3 Environment Variable Injections

```typescript
generateFn.addEnvironment('DYNAMODB_TABLE_QUESTION_BANK', questionBankTable.tableName);
generateFn.addEnvironment('DYNAMODB_TABLE_WORKSHEETS', worksheetsTable.tableName);
generateFn.addEnvironment('DYNAMODB_TABLE_GENERATION_LOG', generationLogTable.tableName);
authFn.addEnvironment('DYNAMODB_TABLE_USERS', usersTable.tableName);
submitFn.addEnvironment('DYNAMODB_TABLE_ATTEMPTS', worksheetAttemptsTable.tableName);
progressFn.addEnvironment('DYNAMODB_TABLE_ATTEMPTS', worksheetAttemptsTable.tableName);
analyticsFn.addEnvironment('DYNAMODB_TABLE_ATTEMPTS', worksheetAttemptsTable.tableName);
classFn.addEnvironment('DYNAMODB_TABLE_CLASSES', classesTable.tableName);
studentFn.addEnvironment('DYNAMODB_TABLE_CLASSES', classesTable.tableName);
studentFn.addEnvironment('DYNAMODB_TABLE_USERS', usersTable.tableName);
rewardsFn.addEnvironment('DYNAMODB_TABLE_ATTEMPTS', worksheetAttemptsTable.tableName);
adminFn.addEnvironment('DYNAMODB_TABLE_ADMIN_CONFIG', adminConfigTable.tableName);
adminFn.addEnvironment('DYNAMODB_TABLE_QUESTION_BANK', questionBankTable.tableName);
```

### 10.4 Cognito Lambda Triggers (Add to CDK)

```typescript
const preTokenFn = new NodejsFunction(this, 'PreTokenGenerationFunction', {
  functionName: `learnfyra-${appEnv}-lambda-pre-token-generation`,
  entry: resolveHandlerEntry('preTokenGenerationHandler.js'),
  architecture: lambda.Architecture.ARM_64,
  memorySize: 128,
  timeout: cdk.Duration.seconds(5),
  bundling,
  environment: { NODE_ENV: appEnv, DYNAMODB_TABLE_USERS: usersTable.tableName },
});
usersTable.grantReadData(preTokenFn);
userPool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION, preTokenFn);

const postConfirmationFn = new NodejsFunction(this, 'PostConfirmationFunction', {
  functionName: `learnfyra-${appEnv}-lambda-post-confirmation`,
  entry: resolveHandlerEntry('postConfirmationHandler.js'),
  architecture: lambda.Architecture.ARM_64,
  memorySize: 128,
  timeout: cdk.Duration.seconds(5),
  bundling,
  environment: { NODE_ENV: appEnv, DYNAMODB_TABLE_USERS: usersTable.tableName },
});
usersTable.grantWriteData(postConfirmationFn);
userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationFn);
```

### 10.5 New API Routes to Add

```
GET  /api/worksheets/{worksheetId}/status  → worksheetStatusHandler.js (new Lambda)
POST /api/class/{classId}/assign           → classHandler.js (new route)
POST /api/parent/link-child                → studentHandler.js
GET  /api/parent/children                  → studentHandler.js
GET  /api/parent/child/{id}/progress       → progressHandler.js
GET  /api/admin/users                      → adminHandler.js
PUT  /api/admin/users/{id}/role            → adminHandler.js
PUT  /api/admin/users/{id}/active          → adminHandler.js
GET  /api/admin/worksheets                 → adminHandler.js
GET  /api/admin/generation-log             → adminHandler.js
```

### 10.6 New Files Needed (dev-agent handoff)

| File | Status | Purpose |
|---|---|---|
| `backend/handlers/preTokenGenerationHandler.js` | MISSING | Cognito trigger — inject custom:role |
| `backend/handlers/postConfirmationHandler.js` | MISSING | Cognito trigger — upsert user in DynamoDB |
| `backend/handlers/worksheetStatusHandler.js` | MISSING | GET /api/worksheets/{id}/status polling |
| `src/db/dynamodbAdapter.js` | MISSING | DynamoDB implementation of getDbAdapter() interface |
| `src/questionBank/dynamodbAdapter.js` | MISSING | DynamoDB question bank adapter (replaces local JSON) |

---

## Section 11: Open Risks and Decisions

### Risk 1 — HIGH: QB_ADAPTER=local is broken in Lambda production

**What:** `QB_ADAPTER=local` causes generateHandler to read from `data-local/*.json` files. These don't exist in Lambda runtime. Question bank feature is non-functional in AWS.

**Mitigation:** Write `src/questionBank/dynamodbAdapter.js`, create DynamoDB table in CDK, switch `QB_ADAPTER=dynamodb`. This is a P0 blocker for production question bank.

### Risk 2 — HIGH: submitHandler does not persist attempts to DynamoDB

**What:** POST /api/submit scores the worksheet but does not write to any database. Attempt is lost if client fails to call POST /api/progress/save.

**Mitigation:** Move DynamoDB write into submitHandler atomically. Deprecate /api/progress/save for online mode (keep for offline-only).

### Risk 3 — MEDIUM: Lambda Authorizer may require DynamoDB lookup for role claim

**What:** Without the pre-token-generation Cognito trigger, apiAuthorizerHandler.js cannot get the user's role from the JWT alone — must query DynamoDB on every request.

**Mitigation A (preferred):** Add Cognito pre-token-generation trigger to inject `custom:role` claim.
**Mitigation B:** DynamoDB lookup with 300s cache on token value (~10–20ms per request per 5 minutes).

### Risk 4 — MEDIUM: Solve endpoint auth inconsistency (spec vs CDK)

**What:** GET /api/solve/{worksheetId} has tokenAuthorizer in CDK but M04 spec says auth not required. Decision needed.

**Recommendation:** Require auth. Logged-in solve ensures attempt can be saved to correct student. Update spec to match CDK.

### Risk 5 — MEDIUM: Admin role not yet in VALID_ROLES

**What:** TASK-AUTH-003 (in-progress). Admin user creation flow (seeding, not self-registration) must be documented.

### Risk 6 — LOW: No Step Functions for large worksheets

**What:** Sync generate path will timeout for 30+ question requests needing AI.

**Mitigation:** Phase 3. Keep sync path for ≤8 AI questions; Step Functions for larger requests.

### Open Decisions

| ID | Question | Options | Recommendation | Blocking |
|---|---|---|---|---|
| OD-1 | Should POST /api/submit write to DynamoDB atomically? | (A) Yes (B) Keep two-call pattern | A — atomic is safer | M05 progress tracking |
| OD-2 | Should GET /api/solve require auth? | (A) Yes (B) Allow unauthenticated | A — require auth, update spec | M04 spec alignment |
| OD-3 | Cognito pre-token trigger vs DynamoDB per-request lookup? | (A) Trigger (B) DynamoDB | A — lower latency and cost | M01 Cognito setup |
| OD-4 | Step Functions threshold (sync vs async)? | 8 / 10 / 15 questions | 8 questions from AI triggers async | M03 scalability |
| OD-5 | DynamoDB billing mode? | PAY_PER_REQUEST vs PROVISIONED | PAY_PER_REQUEST for MVP | All tables |

---

## Section 12: Validation Plan (QA Test Matrix)

### M01 Auth
- Happy path: register → login → access protected route → refresh → logout
- Wrong password → 401 (no field hint); expired token → 401; missing header → 401
- Student calls teacher route → 403; admin role enforced on admin-only endpoints
- OAuth: Google consent URL returned; callback issues JWT
- OPTIONS: 200 with CORS headers on all auth routes
- Rate limiting: excess login attempts throttled

### M02/M03 Generator
- Teacher JWT → 200 + worksheetId; student JWT → 403; no JWT → 401
- Bank hit: AI not called for covered questions
- Bank miss: AI called, questions stored to bank with hash dedup
- solve-data.json present in S3 after generation
- Invalid request body → 400 with field error

### M04 Solve/Submit
- GET /api/solve/{validId} → no `answer` or `explanation` in any question
- GET /api/solve/{unknownId} → 404
- POST /api/submit all correct → percentage=100; empty answers → all zero
- Scoring: all 7 question types pass the scoring rule matrix
- OPTIONS → 200 + CORS on both endpoints

### M05 Progress
- POST /api/progress/save → attempt record in DynamoDB
- GET /api/progress/history → only authenticated student's records
- Teacher views class analytics; student gets 403 on class analytics
- Parent without link → 403; parent with link → 200

### M06 Classes
- Teacher creates class → inviteCode 6-char alphanumeric generated
- Student joins with valid code → membership written; invalid code → 404
- Teacher lists students → own class only visible

### M07 Admin
- GET/PUT /api/admin/policy → 200 for admin; 403 for teacher/student
- PUT policy → version incremented, new CONFIG version written
- Admin config change reflected in next worksheet generation

---

## Section 13: Rollout Plan

### Phase 1 — DynamoDB Integration (Current Priority)
1. DynamoDB tables added to CDK (`cdk synth` passes zero warnings)
2. `src/db/dynamodbAdapter.js` written — same interface as localDbAdapter
3. `QB_ADAPTER=dynamodb` switched in CDK
4. All `DYNAMODB_TABLE_*` env vars injected into relevant Lambdas
5. Deploy to dev; integration tests run against real DynamoDB
6. M01–M04 flows verified end-to-end on dev

### Phase 2 — Cognito + Auth Hardening
1. Cognito Lambda triggers added (pre-token-generation, post-confirmation)
2. submitHandler atomic DynamoDB write implemented (OD-1)
3. Parent-child link creation endpoint built
4. Admin user seeding script written and run in staging
5. Deploy to staging → QA smoke tests
6. Deploy to prod (manual approval in GitHub Actions)

### Phase 3 — Step Functions Async Generation
1. New Lambda functions for pipeline stages
2. Step Functions state machine in CDK
3. generateHandler threshold logic added
4. Worksheet status polling endpoint added
5. Angular frontend polling UI built
6. Load test: 50-question worksheet generation succeeds end-to-end

---

## Appendix A: File Status Summary

| File | Module | Status |
|---|---|---|
| `backend/handlers/authHandler.js` | M01 | EXISTS — extend for admin role, DynamoDB |
| `backend/handlers/apiAuthorizerHandler.js` | M01 | EXISTS — extend with role claim |
| `backend/handlers/generateHandler.js` | M02/M03 | EXISTS — add generation-log write |
| `backend/handlers/downloadHandler.js` | M02 | EXISTS |
| `backend/handlers/solveHandler.js` | M04 | EXISTS |
| `backend/handlers/submitHandler.js` | M04 | EXISTS — add atomic DynamoDB write |
| `backend/handlers/progressHandler.js` | M05 | EXISTS — switch to DynamoDB adapter |
| `backend/handlers/analyticsHandler.js` | M05 | EXISTS — switch to DynamoDB adapter |
| `backend/handlers/classHandler.js` | M06 | EXISTS — switch to DynamoDB adapter |
| `backend/handlers/studentHandler.js` | M06 | EXISTS — switch to DynamoDB adapter |
| `backend/handlers/rewardsHandler.js` | M05 | EXISTS — switch to DynamoDB adapter |
| `backend/handlers/adminHandler.js` | M07 | EXISTS — switch to DynamoDB adapter |
| `backend/handlers/questionBankHandler.js` | M02 | EXISTS — switch to DynamoDB adapter |
| `backend/handlers/preTokenGenerationHandler.js` | M01 | **MISSING — write new** |
| `backend/handlers/postConfirmationHandler.js` | M01 | **MISSING — write new** |
| `backend/handlers/worksheetStatusHandler.js` | M03 | **MISSING — write new** |
| `src/db/dynamodbAdapter.js` | ALL | **MISSING — write new** |
| `src/questionBank/dynamodbAdapter.js` | M02 | **MISSING — write new** |
| `infra/cdk/lib/learnfyra-stack.ts` | INFRA | EXISTS — add 8 DynamoDB tables + GSIs + grants |

---

*Handoff targets:*
- *dev-agent: Section 10.6 missing handler files + DynamoDB adapters*
- *devops-agent: Section 10.1–10.5 CDK additions, Section 8 env vars, Section 13 rollout*
- *qa-agent: Section 12 test matrix*

*End of Learnfyra Backend Technical Design v2*
