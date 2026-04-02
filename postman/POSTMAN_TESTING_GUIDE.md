# Postman API Testing Guide — Learnfyra Complete API

**Date:** April 2, 2026
**Scope:** Testing all 41 implemented endpoints across 11 feature groups — authentication, worksheet generation/solve, student/teacher routes, dashboard, progress tracking, analytics, rewards, certificates, question bank, and admin control plane.

---

## 1. Quick Start

### Prerequisites
- **Postman** v10 or higher
- **Local server** running: `npm run dev` (serves http://localhost:3000)
- OR **AWS endpoints** deployed via CDK (use the appropriate environment file)

### Import Collection
1. Download `postman/Learnfyra-Complete-API.postman_collection.json`
2. Open Postman → Import → Select the JSON file
3. Import the matching environment file:
   - Local: `Learnfyra-Local.postman_environment.json`
   - Staging: `Learnfyra-Staging.postman_environment.json`
   - Production: `Learnfyra-Production.postman_environment.json`
4. Select the imported environment from the environment dropdown (top-right)

### Collection Variables (auto-populated)
```
baseUrl:       set from environment file (or override manually)
studentToken:  auto-captured by Login (Student) test script
teacherToken:  auto-captured by Login (Teacher) test script
adminToken:    auto-captured by Login (Admin) test script
worksheetId:   auto-captured by Generate Worksheet test script
classId:       auto-captured by Create Class test script
studentId:     auto-captured by Login (Student) test script
inviteCode:    auto-captured by Create Class test script
certificateId: auto-captured by List Certificates test script
questionId:    auto-captured by Add Question test script
childId:       set manually (UUID of a child user for parent view)
```

---

## 2. Environment URLs

| Environment | Base URL | Auth Mode |
|-------------|----------|-----------|
| Local Dev | http://localhost:3000 | Mock adapter — bcrypt + `data-local/users.json` |
| Dev (AWS) | https://api.dev.learnfyra.com | Hybrid — email/password + Google OAuth via Cognito |
| QA / Staging | https://api.qa.learnfyra.com | Hybrid |
| Production | https://api.learnfyra.com | Hybrid |

---

## 3. API Groups and Workflows

### Group 1: Auth (8 endpoints — no token required)

Covers registration, login, token management, and OAuth.

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/auth/register` | POST | None | `{email, password, role, displayName}` |
| `/api/auth/login` | POST | None | `{email, password}` — auto-captures token |
| `/api/auth/logout` | POST | None | `{}` — always returns 200 |
| `/api/auth/refresh` | POST | None | `{refreshToken}` — auto-captures new token |
| `/api/auth/forgot-password` | POST | None | `{email}` — sends reset email |
| `/api/auth/reset-password` | POST | None | `{token, newPassword}` |
| `/api/auth/oauth/:provider` | POST | None | Initiates OAuth flow (provider: google) |
| `/api/auth/callback/:provider` | GET | None | `?code=...&state=...` — completes OAuth |

**Test Flow:**
```
1. POST Register (Student)    body: {email, password, role:"student", displayName}
2. POST Register (Teacher)    body: {email, password, role:"teacher", displayName}
3. POST Login (Student)       → auto-captures studentToken + studentId
4. POST Login (Teacher)       → auto-captures teacherToken
5. POST Login (Admin)         → auto-captures adminToken
6. POST Logout (optional)     → always 200, client clears token
```

**Token refresh flow:**
```
1. POST Login → captures both token (JWT) and refreshToken
2. When JWT expires (24h): POST Refresh → {refreshToken} → new JWT
3. Test scripts auto-capture new token into studentToken variable
```

---

### Group 2: Worksheet (4 endpoints)

Lifecycle: Generate → Solve (no answers) → Submit (score) → Download (file)

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/generate` | POST | Bearer (any role) | Full worksheet JSON + solve-data saved server-side |
| `/api/solve/:worksheetId` | GET | Bearer (any role) | Returns questions ONLY — answers/explanations stripped |
| `/api/submit` | POST | Bearer (any role) | Scores answers against stored key; returns full breakdown |
| `/api/download` | GET | None | `?key=worksheets/...` — S3 presigned URL (AWS) or local file |

**Test Flow:**
```
1. POST Generate Worksheet
   Header: Authorization: Bearer {{studentToken}}
   Body: {grade:4, subject:"Math", topic:"Factors and Multiples", difficulty:"Easy",
          questionCount:10, format:"HTML", includeAnswerKey:true,
          generationMode:"auto", provenanceLevel:"summary"}
   → auto-captures worksheetId into collection variable

2. GET Solve/{{worksheetId}}
   Header: Authorization: Bearer {{studentToken}}
   → returns {questions: [{number, type, question, options?},...]}
   → answers and explanations are NOT included

3. POST Submit
   Header: Authorization: Bearer {{studentToken}}
   Body: {worksheetId, answers:[{number,answer},...], timeTaken:600, timed:false}
   → returns {totalScore, totalPoints, percentage, results:[...]}

4. GET Download
   URL: {{baseUrl}}/api/download?key=worksheets/2026/04/01/{{worksheetId}}/worksheet.html
   → returns presigned URL (AWS) or streams file (local)
```

**generationMode values:** `auto` | `bank-first` | `ai-only`
**provenanceLevel values:** `none` | `summary` | `full`

---

### Group 3: Student (3 endpoints)

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/student/profile` | GET | Student Bearer | Returns profile + class memberships |
| `/api/student/profile` | PATCH | Student Bearer | `{grade?, displayName?}` — partial update |
| `/api/student/join-class` | POST | Student Bearer | `{inviteCode}` — 6-char alphanumeric from teacher |

**Test Flow:**
```
1. GET Student Profile
   Header: Authorization: Bearer {{studentToken}}
   Response: {userId, email, displayName, grade, role, classes:[...]}

2. PATCH Student Profile
   Header: Authorization: Bearer {{studentToken}}
   Body: {grade:5, displayName:"Updated Name"}
   Response: {userId, email, displayName, grade}

3. POST Join Class
   Header: Authorization: Bearer {{studentToken}}
   Body: {inviteCode:"{{inviteCode}}"}
   Response: {success:true, classId}
```

---

### Group 4: Dashboard (3 endpoints)

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/dashboard/stats` | GET | Bearer | Aggregate counts (worksheets completed, avg score, streak) |
| `/api/dashboard/recent-worksheets` | GET | Bearer | Latest N worksheet attempts |
| `/api/dashboard/subject-progress` | GET | Bearer | Per-subject average score breakdown |

```
1. GET Dashboard Stats
   Header: Authorization: Bearer {{studentToken}}
   Response: {worksheetsCompleted:12, avgScore:78, currentStreak:5, lifetimePoints:340}

2. GET Recent Worksheets
   Header: Authorization: Bearer {{studentToken}}
   Response: {worksheets:[{id, subject, topic, score, date},...]}

3. GET Subject Progress
   Header: Authorization: Bearer {{studentToken}}
   Response: {subjects:[{name:"Math", avgScore:82, attemptCount:7},...]}
```

---

### Group 5: Progress (4 endpoints)

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/progress/save` | POST | Student Bearer | Records attempt; triggers rewards engine |
| `/api/progress/history` | GET | Student Bearer | `?limit=20&offset=0` — paginated attempts |
| `/api/progress/insights` | GET | Student Bearer | `?limit=20` — AI-generated insights on weak areas |
| `/api/progress/parent/:childId` | GET | Parent/Teacher Bearer | `?limit=20` — parent view of child's history |

**Test Flow:**
```
1. POST Save Progress
   Header: Authorization: Bearer {{studentToken}}
   Body: {worksheetId, subject:"Math", grade:4, score:8, totalPoints:10,
          timeTaken:600, answers:[{number:1,answer:"B"}]}
   Response: {attemptId, lifetimePoints, currentStreak, rewards:{...}}

2. GET Progress History
   Header: Authorization: Bearer {{studentToken}}
   URL: {{baseUrl}}/api/progress/history?limit=20&offset=0
   Response: {attempts:[{attemptId,subject,score,createdAt},...], total:15}

3. GET Performance Insights
   Header: Authorization: Bearer {{studentToken}}
   URL: {{baseUrl}}/api/progress/insights?limit=20
   Response: {insights:[{subject:"Math", weakTopics:["Fractions",...], recommendation},...]}

4. GET Parent View Child Progress
   Header: Authorization: Bearer {{parentToken}}
   URL: {{baseUrl}}/api/progress/parent/{{childId}}?limit=20
   Response: {attempts:[...], aggregates:[{subject, avgScore},...]}
```

---

### Group 6: Class (2 endpoints)

Requires teacher Bearer token.

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/class/create` | POST | Teacher Bearer | Auto-generates inviteCode |
| `/api/class/:id/students` | GET | Teacher Bearer | Returns enrolled student profiles |

**Test Flow:**
```
1. POST Create Class
   Header: Authorization: Bearer {{teacherToken}}
   Body: {className:"4th Grade Math", grade:4, subject:"Math"}
   Response: {classId, inviteCode, className, grade, subject, students:[]}
   → auto-captures classId + inviteCode

2. GET Class Students
   Header: Authorization: Bearer {{teacherToken}}
   URL: {{baseUrl}}/api/class/{{classId}}/students
   Response: {students:[{userId, email, displayName, joinedAt},...]}
```

---

### Group 7: Analytics (1 endpoint)

Requires teacher Bearer token.

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/analytics/class/:id` | GET | Teacher Bearer | Topic breakdown — flagged:true when avgScore < 0.70 |

```
GET Class Analytics
Header: Authorization: Bearer {{teacherToken}}
URL: {{baseUrl}}/api/analytics/class/{{classId}}
Response: {
  classId,
  topicBreakdown: [
    {topic:"Factors", avgScore:0.82, attemptCount:24, flagged:false},
    {topic:"Fractions", avgScore:0.58, attemptCount:18, flagged:true}
  ],
  overallAvg: 0.72
}
```

---

### Group 8: Rewards (2 endpoints)

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/rewards/student/:id` | GET | Student Bearer | Points, streaks, badges, freeze tokens |
| `/api/rewards/class/:id` | GET | Teacher Bearer | Class leaderboard aggregate |

```
1. GET Student Rewards
   Header: Authorization: Bearer {{studentToken}}
   URL: {{baseUrl}}/api/rewards/student/{{studentId}}
   Response: {lifetimePoints:250, currentStreak:5, badges:["Beginner","Math Star"], freezeTokens:1}

2. GET Class Rewards
   Header: Authorization: Bearer {{teacherToken}}
   URL: {{baseUrl}}/api/rewards/class/{{classId}}
   Response: {classId, students:[{userId,displayName,points,streak,badges},...], topStudent}
```

---

### Group 9: Certificates (2 endpoints)

Requires student Bearer token.

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/certificates` | GET | Student Bearer | `?limit=20&offset=0` — paginated list |
| `/api/certificates/:id/download` | GET | Student Bearer | HTML certificate for given ID |

```
1. GET List Certificates
   Header: Authorization: Bearer {{studentToken}}
   URL: {{baseUrl}}/api/certificates?limit=20&offset=0
   Response: {certificates:[{id, title, subject, awardedAt},...], total:3}
   → auto-captures certificateId from first result

2. GET Download Certificate
   Header: Authorization: Bearer {{studentToken}}
   URL: {{baseUrl}}/api/certificates/{{certificateId}}/download
   Response: HTML-rendered certificate (Content-Type: text/html)
```

---

### Group 10: Question Bank (4 endpoints)

GET endpoints are unauthenticated. POST endpoints require Bearer token.

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/api/qb/questions` | GET | None | `?grade=&subject=&difficulty=&type=` |
| `/api/qb/questions` | POST | Admin Bearer | Deduplication by (grade, subject, topic, type, question-text) |
| `/api/qb/questions/:id` | GET | None | Single question with full metadata |
| `/api/qb/questions/:id/reuse` | POST | Admin Bearer | Increments reuseCount |

**Test Flow:**
```
1. GET List Questions
   URL: {{baseUrl}}/api/qb/questions?grade=4&subject=Math&difficulty=Easy&type=multiple-choice
   Response: {questions:[{id,grade,subject,topic,type,question,options,reuseCount},...], total:42}

2. POST Add Question
   Header: Authorization: Bearer {{adminToken}}
   Body: {grade:4, subject:"Math", topic:"Fractions", difficulty:"Medium", type:"multiple-choice",
          question:"What is 1/2 of 20?", options:["A. 8","B. 10","C. 12","D. 15"],
          answer:"B", explanation:"1/2 × 20 = 10", points:1, standards:["CCSS.MATH.CONTENT.4.NF.B.3"]}
   Response: {id, status:"added"} or 409 Conflict if duplicate
   → auto-captures questionId

3. GET Get Question by ID
   URL: {{baseUrl}}/api/qb/questions/{{questionId}}
   Response: {id, grade, subject, topic, type, question, options, answer, explanation,
              standards, reuseCount, createdAt}

4. POST Track Question Reuse
   Header: Authorization: Bearer {{adminToken}}
   URL: {{baseUrl}}/api/qb/questions/{{questionId}}/reuse
   Response: {reuseCount:46}
```

**Deduplication rule:** Returns 409 Conflict if (grade, subject, topic, type, question-text) combination already exists (case-insensitive, trimmed).

---

### Group 11: Admin Control Plane (8 endpoints)

All endpoints require admin role Bearer token. All PUT requests require `Idempotency-Key` header.

**Idempotency:** Same Idempotency-Key within 24 hours returns the cached response — prevents duplicate updates.

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/admin/policies` | GET | Returns all system policies |
| `/api/admin/policies/model-routing` | PUT | `Idempotency-Key` required |
| `/api/admin/policies/budget-usage` | PUT | `Idempotency-Key` required |
| `/api/admin/policies/validation-profile` | PUT | `Idempotency-Key` required |
| `/api/admin/policies/repeat-cap` | GET | Current repeat cap policy |
| `/api/admin/policies/repeat-cap` | PUT | `Idempotency-Key` required |
| `/api/admin/policies/repeat-cap/overrides` | PUT | `Idempotency-Key` required |
| `/api/admin/audit/events` | GET | `?limit=50&offset=0` |

**Test Flow:**
```
1. POST Login (Admin) → captures adminToken

2. GET Admin Policies
   Header: Authorization: Bearer {{adminToken}}
   Response: {id:"global", version:1, modelRouting:{...}, budgetUsage:{...},
              repeatCapPolicy:{...}, updatedAt, updatedBy}

3. PUT Update Model Routing
   Headers: Authorization: Bearer {{adminToken}}, Idempotency-Key: model-routing-001
   Body: {defaultMode:"auto", allowPremium:true, premiumEscalation:{...},
          fallbackOrder:["low","default","premium"], reason:"LF-1001"}
   Response: {success:true, version:2}

4. PUT Update Budget Usage
   Headers: Authorization: Bearer {{adminToken}}, Idempotency-Key: budget-usage-001
   Body: {dailyUsdSoftLimit:100, dailyUsdHardLimit:150, softLimitBehavior:"log-only",
          hardLimitBehavior:"block-premium", reason:"LF-1002"}

5. GET Repeat Cap Policy
   Header: Authorization: Bearer {{adminToken}}

6. PUT Update Repeat Cap
   Headers: Authorization: Bearer {{adminToken}}, Idempotency-Key: repeat-cap-001
   Body: {enabled:true, defaultPercent:10, minPercent:0, maxPercent:100, reason:"LF-1004"}

7. PUT Set Repeat Cap Override (student-level)
   Headers: Authorization: Bearer {{adminToken}}, Idempotency-Key: override-001
   Body: {scope:"student", scopeId:"{{studentId}}", repeatCapPercent:15, isActive:true, reason:"LF-1005"}

8. GET Audit Events
   Header: Authorization: Bearer {{adminToken}}
   URL: {{baseUrl}}/api/admin/audit/events?limit=50&offset=0
   Response: {events:[{eventId, action, actor, timestamp, payload},...], total:128}
```

---

## 4. Testing Checklist

### Happy Path
- [ ] Auth flow: Register → Login → auto-capture tokens
- [ ] Token refresh works
- [ ] Generate worksheet with valid grade/subject/topic
- [ ] Solve endpoint returns questions only (no answers or explanations)
- [ ] Submit answers returns score breakdown with per-question results
- [ ] Download returns presigned URL or file
- [ ] Get/Update student profile works
- [ ] Student joins class with valid invite code
- [ ] Dashboard stats, recent worksheets, subject progress all return data
- [ ] Progress saves and history returns attempts with pagination
- [ ] Progress insights returns weak-topic analysis
- [ ] Teacher creates class and views students
- [ ] Analytics shows topic breakdown with weak flags (flagged:true when avgScore < 0.70)
- [ ] Rewards calculates points and streaks
- [ ] Certificates list and download work
- [ ] Question bank deduplication returns 409 on duplicate
- [ ] Admin policies GET/PUT round-trip works
- [ ] Repeat cap GET/PUT/override work
- [ ] Audit events paginate correctly

### Error Cases
- [ ] Register with duplicate email → 409
- [ ] Login with wrong password → 401
- [ ] Protected endpoint without token → 401
- [ ] Student token on teacher endpoint → 403
- [ ] Teacher token on admin endpoint → 403
- [ ] Generate with invalid grade (e.g., 11) → 400
- [ ] Submit answers for non-existent worksheetId → 404
- [ ] Question bank duplicate → 409
- [ ] Admin PUT without Idempotency-Key → 400

### Boundary Cases
- [ ] Generate worksheet with questionCount=1 and questionCount=30
- [ ] Grade 1 worksheet and Grade 10 worksheet
- [ ] Submit zero answers (empty answers array)
- [ ] Submit all correct answers (100%)
- [ ] Submit all wrong answers (0%)
- [ ] Progress history with limit=1, offset=0
- [ ] Certificates pagination with limit=1
- [ ] Analytics on empty class (no attempts yet)

---

## 5. Request/Response Examples

### 5.1 Generate Worksheet

**Request:**
```http
POST {{baseUrl}}/api/generate
Authorization: Bearer {{studentToken}}
Content-Type: application/json

{
  "grade": 4,
  "subject": "Math",
  "topic": "Factors and Multiples",
  "difficulty": "Easy",
  "questionCount": 10,
  "format": "HTML",
  "includeAnswerKey": true,
  "generationMode": "auto",
  "provenanceLevel": "summary"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "worksheetKey": "worksheets/2026/04/01/550e8400-e29b-41d4-a716-446655440000/worksheet.html",
  "answerKeyKey": "worksheets/2026/04/01/550e8400-e29b-41d4-a716-446655440000/answer-key.html",
  "requestId": "req-abc123",
  "metadata": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "solveUrl": "/solve.html?id=550e8400-e29b-41d4-a716-446655440000",
    "generatedAt": "2026-04-01T14:30:00Z",
    "grade": 4,
    "subject": "Math",
    "topic": "Factors and Multiples",
    "difficulty": "Easy"
  }
}
```

---

### 5.2 Submit Answers and Receive Score

**Request:**
```http
POST {{baseUrl}}/api/submit
Authorization: Bearer {{studentToken}}
Content-Type: application/json

{
  "worksheetId": "550e8400-e29b-41d4-a716-446655440000",
  "answers": [
    { "number": 1, "answer": "B" },
    { "number": 2, "answer": "True" },
    { "number": 3, "answer": "42" }
  ],
  "timeTaken": 600,
  "timed": false
}
```

**Response (200 OK):**
```json
{
  "worksheetId": "550e8400-e29b-41d4-a716-446655440000",
  "totalScore": 2,
  "totalPoints": 3,
  "percentage": 67,
  "timeTaken": 600,
  "timed": false,
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
    },
    {
      "number": 3,
      "correct": true,
      "studentAnswer": "42",
      "correctAnswer": "42",
      "explanation": "6 × 7 = 42",
      "pointsEarned": 1,
      "pointsPossible": 1
    }
  ]
}
```

---

### 5.3 Create Class (Teacher)

**Request:**
```http
POST {{baseUrl}}/api/class/create
Authorization: Bearer {{teacherToken}}
Content-Type: application/json

{
  "className": "4th Grade Math",
  "grade": 4,
  "subject": "Math"
}
```

**Response (200 OK):**
```json
{
  "classId": "33333333-3333-4333-8333-333333333333",
  "inviteCode": "ABC123",
  "className": "4th Grade Math",
  "grade": 4,
  "subject": "Math",
  "students": []
}
```

---

### 5.4 Admin Update Budget Policy

**Request:**
```http
PUT {{baseUrl}}/api/admin/policies/budget-usage
Authorization: Bearer {{adminToken}}
Idempotency-Key: budget-update-2026-04-01
Content-Type: application/json

{
  "dailyUsdSoftLimit": 100,
  "dailyUsdHardLimit": 150,
  "monthlyUsdSoftLimit": 2500,
  "monthlyUsdHardLimit": 3000,
  "softLimitBehavior": "log-only",
  "hardLimitBehavior": "block-premium",
  "reason": "LF-1002 quarterly budget review"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "version": 3,
  "updatedAt": "2026-04-01T15:00:00Z"
}
```

---

## 6. Debug Mode (Dev Environment)

On the dev server, set `DEBUG_MODE=true` in `.env` to expose `_debug` in error responses:

```json
{
  "error": "Validation failed",
  "_debug": {
    "field": "grade",
    "received": 11,
    "expected": "integer 1-10"
  }
}
```

This field is only present in dev. It does not appear in staging or production responses.

---

## 7. Environment-Specific Notes

### Local Development (http://localhost:3000)
- **Auth:** Mock adapter — bcrypt + `data-local/users.json`
- **Storage:** Worksheets saved to `worksheets-local/{uuid}/`
- **Question Bank:** Uses `localQuestionBankAdapter` — `data-local/question-bank.json`
- **No AWS charges:** All operations are local

```bash
npm run dev    # Express server on http://localhost:3000
```

### QA / Staging (https://api.qa.learnfyra.com)
- **Auth:** Cognito user pool — hybrid mode (email/password + Google OAuth)
- **Storage:** S3 bucket `learnfyra-staging-s3-worksheets`
- **API:** API Gateway + Lambda
- Use valid staging credentials; tokens are Cognito JWTs

### Production (https://api.learnfyra.com)
- Same stack as staging; RemovalPolicy.RETAIN on S3
- Use test accounts only — never real user PII in Postman requests

---

## 8. Running Test Suites

### Postman Collection Runner
1. Open Learnfyra-Complete-API collection
2. Click **Run** button (top-right in collection view)
3. Select all folders or a specific group
4. Run sequentially (recommended for token-dependent flow)
5. Review results: passed/failed with response codes

### Local Automated Tests
```bash
npm test                   # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # With coverage report (gate: 80%)
```

### Headless (Newman / CI)
```bash
# Install newman
npm install -g newman

# Run against local
newman run postman/Learnfyra-Complete-API.postman_collection.json \
  --environment postman/Learnfyra-Local.postman_environment.json \
  --reporters cli,html

# Run against staging
newman run postman/Learnfyra-Complete-API.postman_collection.json \
  --environment postman/Learnfyra-Staging.postman_environment.json \
  --reporters cli
```

---

## 9. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing/invalid Bearer token | Re-run Login; check Authorization header |
| 400 Bad Request | Invalid body/query params | Validate JSON syntax; check required fields |
| 404 Not Found | Resource does not exist | Verify worksheetId/classId; re-generate if needed |
| 409 Conflict | Duplicate question in bank | Question already exists; change question text |
| 403 Forbidden | Wrong role | Use correct token: student/teacher/admin |
| CORS error (browser) | Cross-origin blocked | Use Postman (bypasses CORS) or check ALLOWED_ORIGIN |
| Token expired | JWT expired after 24h | POST /api/auth/refresh or re-login |
| worksheetId not captured | Generate request failed | Check Generate response for metadata.id |
| inviteCode not populated | Create Class not run | Run Create Class before Join Class |
| Admin 403 | adminToken empty | Run Login (Admin) first |
| Idempotency-Key missing | PUT without header | Admin PUT endpoints require Idempotency-Key header |

---

## 10. Collection Maintenance

- **Add new endpoint:** Add request to matching folder in both collection files; update ENDPOINT_REFERENCE_CARD.md
- **Change base URL:** Update the environment JSON file; do not hardcode URLs in collection requests
- **Add token test script:** Follow the pattern in Login (Student) — `pm.collectionVariables.set('tokenName', body.token)`
- **Version control:** Keep all JSON collection files in `postman/`; commit after updates
- **Schema changes:** Notify DBA agent; update CLAUDE.md if S3 key structure or worksheet JSON schema changes

---

## 11. Next Steps After Testing

1. **All endpoints passing locally?** → Smoke test on dev (https://api.dev.learnfyra.com)
2. **Deploy to staging?** → Use Cloud Engineering validation runbook (`docs/operations/runbooks/cloud-engineering-aws-validation-runbook.md`)
3. **Performance testing?** → Use Newman with `--iteration-count 50`; monitor Lambda CloudWatch metrics
4. **Security testing?** → Run OWASP ZAP against deployed endpoints; check for token leakage in responses
5. **Load testing?** → Use k6 with realistic user distributions across grades and subjects

---

**Last Updated:** April 2, 2026
**Collection Version:** 2.0 (41 Endpoints)
