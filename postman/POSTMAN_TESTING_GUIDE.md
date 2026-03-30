# Postman API Testing Guide — Learnfyra Complete API

**Date:** March 27, 2026  
**Scope:** Testing all implemented and ready endpoints across authentication, worksheet generation, student/teacher routes, progress tracking, analytics, rewards, certificates, question bank, and admin functions.

---

## 1. Quick Start

### Prerequisites
- **Postman** (v10 or higher)
- **Local server** running: `npm run dev` (serves http://localhost:3000)
- OR **AWS endpoints** deployed via CDK

### Import Collection
1. Download [Learnfyra-Complete-API.postman_collection.json](./Learnfyra-Complete-API.postman_collection.json)
2. Open Postman → Import → Select the JSON file
3. Collection loads with all 10 feature groups and 30+ ready endpoints

### Set Environment Variables
Before running requests, configure collection variables:

```
baseUrl: http://localhost:3000 (for local) or CloudFront domain (for AWS)
studentToken: (auto-populated after Login (Student))
teacherToken: (auto-populated after Login (Teacher))
adminToken: (auto-populated after Login (Admin))
worksheetId: (auto-populated after Generate Worksheet)
classId: (auto-populated after Create Class)
studentId: (auto-populated after Login (Student))
```

---

## 2. API Groups & Workflow

### Group 1: Authentication (6 endpoints)
**Sequence:** Register → Login → Use tokens

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| Register (Student) | POST | ✅ Ready | Body: email, password, role, displayName |
| Register (Teacher) | POST | ✅ Ready | Same schema; role="teacher" |
| Register (Admin) | POST | ✅ Ready | Same schema; role="teacher" (for now) |
| Login (Student) | POST | ✅ Ready | Auto-captures token & userId into variables |
| Login (Teacher) | POST | ✅ Ready | Auto-captures token into teacherToken variable |
| Logout | POST | ✅ Ready | Always returns 200; client clears token |

**Test Flow:**
```
1. POST Register (Student) with email=student@example.com
2. POST Login (Student) → captures studentToken
3. POST Register (Teacher) with email=teacher@example.com
4. POST Login (Teacher) → captures teacherToken
5. POST Logout (optional)
```

---

### Group 2: Worksheet Generation & Delivery (4 endpoints)
**Lifecycle:** Generate → ViewWithoutAnswers → SubmitAnswers → Download

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| Generate Worksheet | POST | ✅ Ready | None (local), Token (AWS) | Auto-captures worksheetId |
| Get Solve Page | GET | ✅ Ready | None | Returns questions without answers/explanations |
| Submit Answers & Score | POST | ✅ Ready | None | Compares student answers against stored key; returns results |
| Download Worksheet | GET | ✅ Ready | None | Returns presigned S3 URL (AWS) or file path (local) |

**Test Flow:**
```
1. POST Generate Worksheet
   Input: grade=4, subject="Math", topic="Factors", questionCount=10, format="HTML"
   Response: { worksheetId, solveUrl, metadata }
   
2. GET Solve/{worksheetId}
   Response: { questions: [{number, type, question, options}, ...] } (NO answers)
   
3. POST Submit with answers
   Input: { worksheetId, answers: [{number, answer}, ...], timeTaken }
   Response: { totalScore, percentage, results: [{number, correct, pointsEarned, explanation}, ...] }
   
4. GET Download?key=...
   Response: Presigned URL for browser download
```

**Expected Behavior:**
- Generate returns questions with correct answers + explanations stored server-side
- Solve returns only questions (answers hidden from student)
- Submit scores the answers locally and returns full breakdown
- Download generates 1-hour presigned URL (AWS) or direct file (local)

---

### Group 3: Student Routes (2 endpoints)
**Requires:** Student Bearer token

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| Get Student Profile | GET | ✅ Ready | Required | Returns profile + class memberships |
| Join Class | POST | ✅ Ready | Required | Body: inviteCode (6-char alphanumeric) |

**Test Flow:**
```
1. POST Login (Student) to get studentToken
2. GET Student Profile
   Header: Authorization: Bearer {{studentToken}}
   Response: { userId, email, displayName, classes: [...] }
   
3. POST Join Class
   Header: Authorization: Bearer {{studentToken}}
   Body: { inviteCode: "ABC123" } (from teacher's Create Class response)
   Response: { success, classId }
```

---

### Group 4: Teacher Routes (2 endpoints)
**Requires:** Teacher Bearer token

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| Create Class | POST | ✅ Ready | Required | Auto-generates inviteCode; returns classId |
| List Class Students | GET | ✅ Ready | Required | Returns array of student profiles in class |

**Test Flow:**
```
1. POST Login (Teacher) to get teacherToken
2. POST Create Class
   Header: Authorization: Bearer {{teacherToken}}
   Body: { name: "4th Grade Math", subject: "Math", gradeLevel: 4, period: "Period 1" }
   Response: { classId, inviteCode, name, subject } (auto-captured to variables)
   
3. GET Class/{classId}/Students
   Header: Authorization: Bearer {{teacherToken}}
   Response: { students: [{userId, email, displayName, joinedAt}, ...] }
```

---

### Group 5: Progress Tracking (2 endpoints)
**Requires:** Student Bearer token

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| Save Progress | POST | ✅ Ready | Required | Records attempt; updates aggregate stats |
| Get Progress History | GET | ✅ Ready | Required | Returns array of attempts + subject aggregates |

**Test Flow:**
```
1. POST Save Progress
   Header: Authorization: Bearer {{studentToken}}
   Body: { worksheetId, subject: "Math", topic: "Factors", score: 8, totalPoints: 10, timeTakenSeconds: 600 }
   Response: { attemptId, lifetimePoints, currentStreak, rewards }
   
2. GET Progress History
   Header: Authorization: Bearer {{studentToken}}
   Response: { attempts: [{attemptId, subject, topic, score, createdAt}, ...], aggregates: [{subject, totalAttempts, avgScore}, ...] }
```

**Note:** Progress badges and streaks are calculated by rewardsEngine.js based on attempt patterns.

---

### Group 6: Analytics — Teacher View (1 endpoint)
**Requires:** Teacher Bearer token

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| Get Class Analytics | GET | ✅ Ready | Required | Aggregates all student attempts by topic |

**Test Flow:**
```
1. POST Create Class (get classId)
2. Have students join class and complete attempts
3. GET Analytics/Class/{classId}
   Header: Authorization: Bearer {{teacherToken}}
   Response: {
     classId,
     topicBreakdown: [
       { topic: "Factors", avgScore: 0.75, attemptCount: 12, flagged: false },
       { topic: "Primes", avgScore: 0.55, attemptCount: 8, flagged: true }  # Weak
     ],
     overallAvg: 0.68
   }
```

**Weak Topic Threshold:** flagged=true when avgScore < 0.70

---

### Group 7: Rewards & Gamification (2 endpoints)
**Requires:** Student (for self) or Teacher (for class)

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| Get Student Rewards | GET | ✅ Ready | Required (student role) | Returns points, streaks, badges, freeze tokens |
| Get Class Rewards | GET | ✅ Ready | Required (teacher role) | Aggregate leaderboard data |

**Test Flow:**
```
1. Student completes attempts → rewardsEngine calculates lifetimePoints, streaks
2. GET Rewards/Student/{studentId}
   Header: Authorization: Bearer {{studentToken}}
   Response: { lifetimePoints: 250, currentStreak: 5, badges: ["Beginner", "Math Star"], freezeTokens: 1 }
   
3. GET Rewards/Class/{classId}
   Header: Authorization: Bearer {{teacherToken}}
   Response: { classId, students: [{userId, displayName, points, streak, badges}, ...], topStudent }
```

---

### Group 8: Certificates (2 endpoints)
**Requires:** Student Bearer token

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| List Certificates | GET | ✅ Ready | Required | Paginated list; limit/offset params |
| Download Certificate | GET | ✅ Ready | Required | HTML certificate for given ID |

**Test Flow:**
```
1. Student earns certificates via achievements (e.g., 100% on hard worksheet)
2. GET Certificates/List?limit=10&offset=0
   Header: Authorization: Bearer {{studentToken}}
   Response: { certificates: [{id, title, awardedAt, subject}, ...], total: 5, page: 1 }
   
3. GET Certificates/{certificateId}
   Header: Authorization: Bearer {{studentToken}}
   Response: HTML-rendered certificate with student name, achievement, date
```

---

### Group 9: Question Bank (4 endpoints)
**Requires:** None (public read) or Admin token (write)

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| List Questions | GET | ✅ Ready | Optional | Query: grade, subject, topic, limit, offset |
| Add Question | POST | ✅ Ready | None (local) | Deduplication by (grade, subject, topic, type, question-text) |
| Get Question by ID | GET | ✅ Ready | None | Single question with full metadata |
| Track Question Reuse | POST | ✅ Ready | None | Increments reuseCount counter |

**Test Flow:**
```
1. GET QBank/Questions?grade=4&subject=Math&limit=20
   Response: { questions: [{id, grade, subject, topic, type, question, options, author, reuseCount}, ...], total: 150 }
   
2. POST QBank/Questions
   Body: { grade: 4, subject: "Math", topic: "Fractions", type: "multiple-choice", question: "1/2 + 1/4 = ?", options: [...], answer: "B", ... }
   Response: { id, status: "dedupe-check-passed", message: "Question added" } or { error: "Duplicate question" } (409)
   
3. GET QBank/Questions/{questionId}
   Response: { id, grade, subject, topic, type, question, options, answer, explanation, standards, author, reuseCount, createdAt }
   
4. POST QBank/Questions/{questionId}/Reuse
   Response: { reuseCount: 45 }
```

**Deduplication Rule:** Returns 409 Conflict if (grade, subject, topic, type, question-text) combination already exists (case-insensitive, trimmed).

---

### Group 10: Admin Control Plane (2 endpoints)
**Requires:** Admin Bearer token

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| Get Global Policies | GET | ✅ Ready | Admin role | Returns system-wide configuration |
| Update Policies | PUT | ✅ Ready | Admin role | Requires Idempotency-Key header |

**Test Flow:**
```
1. POST Login (Admin) to get adminToken
2. GET Admin/Policies
   Header: Authorization: Bearer {{adminToken}}
   Response: {
     id: "global",
     version: 1,
     modelRouting: { defaultMode: "auto", allowPremium: true, ... },
     budgetUsage: { dailyUsdSoftLimit: 100, dailyUsdHardLimit: 150, ... },
     repeatCapPolicy: { enabled: true, defaultPercent: 10, ... },
     updatedAt, updatedBy
   }
   
3. PUT Admin/Policies
   Header: Authorization: Bearer {{adminToken}}, Idempotency-Key: unique-key-123
   Body: { budgetUsage: { dailyUsdSoftLimit: 200, ... }, repeatCapPolicy: { enabled: false, ... } }
   Response: { success: true, version: 2, updatedAt }
```

**Idempotency:** Same Idempotency-Key within 24h returns cached response; prevents duplicate updates.

---

## 3. Testing Checklist

### Happy Path (all passing)
- [ ] Authentication flow: Register → Login → Auto-capture tokens
- [ ] Generate worksheet with valid grade/subject/topic
- [ ] Solve endpoint returns questions (no answers)
- [ ] Submit answers returns score breakdown
- [ ] Download returns presigned URL or file
- [ ] Student joins class with valid invite code
- [ ] Teacher creates class and views students
- [ ] Progress saves and history returns attempts
- [ ] Analytics shows topic breakdown with weak flags
- [ ] Rewards calculates points and streaks
- [ ] Certificates list and download work
- [ ] Question bank deduplication works
- [ ] Admin policies GET/PUT work

### Error Cases (validation/auth)
- [ ] Register with duplicate email → 409
- [ ] Login with wrong password → 401
- [ ] Protected endpoint without token → 401
- [ ] Protected endpoint with teacher role as student → 403
- [ ] Generate with invalid grade → 400
- [ ] Submit answers for non-existent worksheet → 404
- [ ] Question bank duplicate submission → 409
- [ ] Admin endpoint without admin role → 403

### Boundary Cases
- [ ] Generate worksheet with questionCount=1 and questionCount=50
- [ ] Submit partial answers (fewer than total questions)
- [ ] Student joins class and leaves
- [ ] Analytics on empty class (no attempts)
- [ ] Certificates pagination with limit=1, offset=0

---

## 4. Environment-Specific Notes

### Local Development (http://localhost:3000)
- **Auth:** Mock adapter uses bcrypt + local JSON files (data-local/users.json)
- **Storage:** Worksheets saved to worksheets-local/{uuid}/
- **Question Bank:** Uses localQuestionBankAdapter (data-local/question-bank.json)
- **No AWS charges:** All operations local

```bash
npm run dev
# Runs Express server on http://localhost:3000
```

### Staging/Production (AWS)
- **Auth:** Cognito user pool (configured in CDK stack)
- **Storage:** S3 buckets (learnfyra-{env}-s3-*)
- **API:** API Gateway + Lambda
- **Requires:** Valid auth tokens from Cognito; S3 presigned URLs for downloads

```bash
# Update baseUrl in Postman to CloudFront domain (e.g., https://d123456.cloudfront.net)
# Or use API Gateway URL directly (e.g., https://api.{env}.learnfyra.com/api)
```

---

## 5. Request/Response Examples

### 5.1 Generate Worksheet

**Request:**
```http
POST http://localhost:3000/api/generate
Content-Type: application/json

{
  "grade": 4,
  "subject": "Math",
  "topic": "Factors and Multiples",
  "difficulty": "Easy",
  "questionCount": 10,
  "format": "HTML",
  "includeAnswerKey": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "worksheetKey": "local/550e8400-e29b-41d4-a716-446655440000/worksheet.html",
  "answerKeyKey": "local/550e8400-e29b-41d4-a716-446655440000/answer-key.html",
  "requestId": "req-abc123",
  "metadata": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "solveUrl": "/solve.html?id=550e8400-e29b-41d4-a716-446655440000",
    "generatedAt": "2026-03-27T14:30:00Z",
    "grade": 4,
    "subject": "Math",
    "topic": "Factors and Multiples",
    "difficulty": "Easy"
  }
}
```

---

### 5.2 Submit Answers & Receive Score

**Request:**
```http
POST http://localhost:3000/api/submit
Content-Type: application/json

{
  "worksheetId": "550e8400-e29b-41d4-a716-446655440000",
  "studentName": "Alice",
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
  "totalScore": 8,
  "totalPoints": 10,
  "percentage": 80,
  "timeTaken": 600,
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

---

### 5.3 Create Class (Teacher)

**Request:**
```http
POST http://localhost:3000/api/class/create
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "4th Grade Math",
  "subject": "Math",
  "gradeLevel": 4,
  "period": "Period 1"
}
```

**Response (200 OK):**
```json
{
  "classId": "33333333-3333-4333-8333-333333333333",
  "inviteCode": "ABC123",
  "name": "4th Grade Math",
  "subject": "Math",
  "gradeLevel": 4,
  "period": "Period 1",
  "students": []
}
```

---

## 6. Running Test Suites

### Postman Collection Runner
1. Open Learnfyra-Complete-API collection
2. Click **Run** button (top-right)
3. Select all folders or specific group
4. Run sequentially (recommended for token flow)
5. Review results: passed/failed requests with response codes

### Local Test Suite
```bash
npm test
npm run test:unit
npm run test:integration
```

---

## 7. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing/invalid Bearer token | Re-login and recapture token; check Authorization header |
| 400 Bad Request | Invalid body/query params | Validate JSON syntax; check required fields |
| 404 Not Found | Resource doesn't exist | Verify worksheetId, classId exist; generate new worksheet if needed |
| 409 Conflict | Duplicate question submission | Question already exists in bank; use different question text |
| 403 Forbidden | Wrong role for endpoint | Use correct token (student/teacher/admin); teacher needs teacher role |
| CORS Error | Browser blocking cross-origin requests | Use Postman (bypasses browser CORS) or check ALLOWED_ORIGIN env var |
| Token expired | JWT expired (24h default) | Re-login and recapture token |

---

## 8. Next Steps After Testing

1. **All endpoints passing?** → Document any custom business logic or edge cases
2. **Deploy to staging?** → Use Cloud Engineering validation runbook (docs/operations/runbooks/cloud-engineering-aws-validation-runbook.md)
3. **Performance testing?** → Use Postman Collection Runner with higher iteration counts; monitor Lambda CloudWatch logs
4. **Security testing?** → Run OWASP ZAP or Burp Suite against deployed endpoints
5. **Load testing?** → Use Apache JMeter or k6 with realistic user distributions

---

## 9. Collection Maintenance

- **Update endpoints:** When new routes added to server.js or CDK stack, add corresponding Postman request
- **Version control:** Keep JSON collection in postman/ folder; commit after updates
- **Shared testing:** Export collection as JSON; import in team Postman workspace
- **Environment files:** Create Postman Environment JSON for dev/staging/prod to switch baseUrl easily

---

**Last Updated:** March 27, 2026  
**Collection Version:** 1.0 (All Ready Endpoints)
