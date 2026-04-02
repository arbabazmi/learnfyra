# Learnfyra API — Quick Endpoint Reference Card

**Generated:** April 2, 2026
**Collection Version:** 2.0 — 41 Endpoints

---

## Auth (8 endpoints — no token required)

| # | Endpoint | Method | Notes |
|---|----------|--------|-------|
| 1 | `/api/auth/register` | POST | `{email, password, role, displayName}` |
| 2 | `/api/auth/login` | POST | `{email, password}` — returns JWT |
| 3 | `/api/auth/logout` | POST | `{}` |
| 4 | `/api/auth/refresh` | POST | `{refreshToken}` |
| 5 | `/api/auth/forgot-password` | POST | `{email}` |
| 6 | `/api/auth/reset-password` | POST | `{token, newPassword}` |
| 7 | `/api/auth/oauth/:provider` | POST | Initiates OAuth (e.g. google) |
| 8 | `/api/auth/callback/:provider` | GET | `?code=...&state=...` |

**Quick start:** Register → Login → capture token from response

---

## Unauthenticated (1 endpoint)

| # | Endpoint | Method | Notes |
|---|----------|--------|-------|
| 9 | `/api/download` | GET | `?key=worksheets/...` — S3 presigned URL or local file |

---

## JWT Protected (Bearer token required for all below)

### Worksheet (endpoints 10-12)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 10 | `/api/generate` | POST | Any | `{grade, subject, topic, difficulty, questionCount, format, includeAnswerKey, generationMode, provenanceLevel}` |
| 11 | `/api/solve/:worksheetId` | GET | Any | Returns questions only — no answers, no explanations |
| 12 | `/api/submit` | POST | Any | `{worksheetId, answers[], timeTaken, timed}` — returns score + breakdown |

### Student (endpoints 13-15)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 13 | `/api/student/profile` | GET | Student | Returns profile + class memberships |
| 14 | `/api/student/profile` | PATCH | Student | `{grade?, displayName?}` |
| 15 | `/api/student/join-class` | POST | Student | `{inviteCode}` |

### Dashboard (endpoints 16-18)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 16 | `/api/dashboard/stats` | GET | Any | Summary counts |
| 17 | `/api/dashboard/recent-worksheets` | GET | Any | Last N worksheets |
| 18 | `/api/dashboard/subject-progress` | GET | Any | Per-subject score summary |

### Progress (endpoints 19-22)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 19 | `/api/progress/save` | POST | Student | `{worksheetId, subject, grade, score, totalPoints, timeTaken, answers[]}` |
| 20 | `/api/progress/history` | GET | Student | `?limit=20&offset=0` |
| 21 | `/api/progress/insights` | GET | Student | `?limit=20` |
| 22 | `/api/progress/parent/:childId` | GET | Parent/Teacher | `?limit=20` |

### Class (endpoints 23-24)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 23 | `/api/class/create` | POST | Teacher | `{className, grade, subject}` — returns classId + inviteCode |
| 24 | `/api/class/:id/students` | GET | Teacher | Returns array of student profiles |

### Analytics (endpoint 25)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 25 | `/api/analytics/class/:id` | GET | Teacher | Topic breakdown with weak-topic flags |

### Rewards (endpoints 26-27)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 26 | `/api/rewards/student/:id` | GET | Student | Points, streaks, badges, freeze tokens |
| 27 | `/api/rewards/class/:id` | GET | Teacher | Class leaderboard aggregate |

### Certificates (endpoints 28-29)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 28 | `/api/certificates` | GET | Student | `?limit=20&offset=0` |
| 29 | `/api/certificates/:id/download` | GET | Student | HTML certificate |

### Question Bank (endpoints 30-33)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 30 | `/api/qb/questions` | GET | None | `?grade=&subject=&difficulty=&type=` |
| 31 | `/api/qb/questions` | POST | Admin | `{grade, subject, topic, difficulty, type, question, options?, answer, explanation, points}` |
| 32 | `/api/qb/questions/:id` | GET | None | Single question with full metadata |
| 33 | `/api/qb/questions/:id/reuse` | POST | Admin | Increments reuseCount |

### Admin (endpoints 34-41)

| # | Endpoint | Method | Token | Notes |
|---|----------|--------|-------|-------|
| 34 | `/api/admin/policies` | GET | Admin | Returns all system policies |
| 35 | `/api/admin/policies/model-routing` | PUT | Admin | Requires `Idempotency-Key` header |
| 36 | `/api/admin/policies/budget-usage` | PUT | Admin | Requires `Idempotency-Key` header |
| 37 | `/api/admin/policies/validation-profile` | PUT | Admin | Requires `Idempotency-Key` header |
| 38 | `/api/admin/policies/repeat-cap` | GET | Admin | |
| 39 | `/api/admin/policies/repeat-cap` | PUT | Admin | Requires `Idempotency-Key` header |
| 40 | `/api/admin/policies/repeat-cap/overrides` | PUT | Admin | Requires `Idempotency-Key` header |
| 41 | `/api/admin/audit/events` | GET | Admin | `?limit=50&offset=0` |

---

## Environment URLs

| Environment | Base URL |
|-------------|----------|
| Local Dev | http://localhost:3000 |
| Dev (AWS) | https://api.dev.learnfyra.com |
| QA / Staging | https://api.qa.learnfyra.com |
| Production | https://api.learnfyra.com |

---

## Auth Modes

| Environment | Mode |
|-------------|------|
| Local | Mock adapter — bcrypt + `data-local/users.json` |
| AWS (all envs) | Hybrid — email/password + Google OAuth via Cognito |

---

## HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input (check body/params) |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions (wrong role) |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate entry (e.g., question already in bank) |
| 500 | Server Error | Unexpected error — check server logs |

---

## Auth Token Usage

1. POST `/api/auth/register` to create an account
2. POST `/api/auth/login` to receive a JWT
3. Set `Authorization: Bearer <token>` on all protected requests
4. Token expiry: 24 hours. Use `/api/auth/refresh` to renew without re-login.

---

## Debug Mode (Dev environment only)

Set `DEBUG_MODE=true` on the dev server to expose `_debug` field in error responses:

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

---

## Collection Variables (auto-populated by test scripts)

| Variable | Populated by | Used by |
|----------|-------------|---------|
| `studentToken` | Login (Student) | All student-role endpoints |
| `teacherToken` | Login (Teacher) | Teacher/class/analytics endpoints |
| `adminToken` | Login (Admin) | Admin endpoints |
| `worksheetId` | Generate Worksheet | Solve, Submit, Download, Progress |
| `classId` | Create Class | Class students, Analytics, Rewards |
| `studentId` | Login (Student) | Rewards, Progress parent view |
| `childId` | (set manually) | Progress parent view |
| `certificateId` | List Certificates | Download Certificate |
| `questionId` | Add Question | Get Question, Track Reuse |
| `inviteCode` | Create Class | Join Class |

---

## Quick Testing Commands

```bash
# Start local server
npm run dev              # Express server on http://localhost:3000

# Automated tests
npm test                 # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage    # With coverage report (gate: 80%)
```

---

## Status Summary

- **Total Endpoints:** 41
- **Auth:** 8 endpoints (no token required)
- **Unauthenticated:** 1 endpoint (download)
- **JWT Protected:** 32 endpoints
- **Requires Admin role:** 9 endpoints (QB write + Admin control plane)
- **Requires Teacher role:** 5 endpoints (class management, analytics, rewards/class)
- **Requires Student role:** 8 endpoints (profile, join class, progress, certificates)

**Overall:** ALL READY FOR TESTING

---

**Last Updated:** April 2, 2026
**Print-Friendly:** Save this page as PDF for reference
