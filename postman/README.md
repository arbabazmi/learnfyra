# Postman Collection — Quick Setup Guide

**Last Updated:** April 2, 2026
**Collection Version:** 2.0 — 41 Endpoints

---

## 30-Second Setup

1. **Download Collection:** `postman/Learnfyra-Complete-API.postman_collection.json`
2. **Open Postman** → Import → Select JSON file
3. **Download Environment:** Import the environment file for your target (see below)
4. **Start Local Server:** `npm run dev` (http://localhost:3000) — for local testing only
5. **Run Collection:**
   - Open collection
   - Start with **"1. Auth"** folder → Run "Register (Student)" then "Login (Student)"
   - Tokens auto-capture into collection variables
   - Run other folders in order

---

## Files Included

| File | Purpose |
|------|---------|
| `Learnfyra-Complete-API.postman_collection.json` | 41 endpoints across 11 feature groups |
| `Learnfyra-Dev-API.postman_collection.json` | Same endpoints, Dev-targeted (local/dev URL) |
| `Learnfyra-Local.postman_environment.json` | Environment: `baseUrl = http://localhost:3000` |
| `Learnfyra-Staging.postman_environment.json` | Environment: `baseUrl = https://api.qa.learnfyra.com` |
| `Learnfyra-Production.postman_environment.json` | Environment: `baseUrl = https://api.learnfyra.com` |
| `ENDPOINT_REFERENCE_CARD.md` | Quick reference for all 41 endpoints |
| `POSTMAN_TESTING_GUIDE.md` | Full testing guide with workflows and troubleshooting |

---

## 11 Feature Groups

1. Auth (8 endpoints — Register, Login, Logout, Refresh, Forgot/Reset Password, OAuth)
2. Worksheet (4 endpoints — Generate, Solve, Submit, Download)
3. Student (3 endpoints — Get/Update Profile, Join Class)
4. Dashboard (3 endpoints — Stats, Recent Worksheets, Subject Progress)
5. Progress (4 endpoints — Save, History, Insights, Parent View)
6. Class (2 endpoints — Create Class, List Students)
7. Analytics (1 endpoint — Class Analytics)
8. Rewards (2 endpoints — Student Rewards, Class Rewards)
9. Certificates (2 endpoints — List, Download)
10. Question Bank (4 endpoints — List, Add, Get by ID, Track Reuse)
11. Admin (8 endpoints — Policies CRUD + Repeat Cap + Audit Events)

**Total: 41 endpoints**

---

## Environment URLs

| Environment | Base URL | Auth Mode |
|-------------|----------|-----------|
| Local Dev | http://localhost:3000 | Mock (bcrypt + JSON files) |
| Dev (AWS) | https://api.dev.learnfyra.com | Hybrid (email/password + Google OAuth via Cognito) |
| QA / Staging | https://api.qa.learnfyra.com | Hybrid |
| Production | https://api.learnfyra.com | Hybrid |

---

## Common Workflows

### Workflow A: Complete Worksheet Solve
```
1. POST Auth/Register (Student)
2. POST Auth/Login (Student)         → captures studentToken, studentId
3. POST Worksheet/Generate           → captures worksheetId
4. GET  Worksheet/Solve/{worksheetId}
5. POST Worksheet/Submit (with answers)
6. GET  Worksheet/Download
```

### Workflow B: Teacher Creates Class and Reviews Students
```
1. POST Auth/Register (Teacher)
2. POST Auth/Login (Teacher)          → captures teacherToken
3. POST Class/Create Class            → captures classId, inviteCode
4. POST Student/Join Class (student)  → uses inviteCode
5. GET  Class/List Class Students
6. GET  Analytics/Get Class Analytics
```

### Workflow C: Question Bank CRUD
```
1. POST Auth/Login (Admin)            → captures adminToken
2. POST QB/Add Question               → captures questionId
3. GET  QB/Get Question by ID
4. POST QB/Track Question Reuse
5. GET  QB/List Questions
```

### Workflow D: Progress and Rewards
```
1. POST Auth/Login (Student)
2. POST Worksheet/Generate + Submit
3. POST Progress/Save Progress
4. GET  Progress/Get Progress History
5. GET  Rewards/Get Student Rewards
6. GET  Certificates/List Certificates
```

---

## Collection Variables (auto-captured)

| Variable | Populated by | Used by |
|----------|-------------|---------|
| `studentToken` | Login (Student) | All student-role endpoints |
| `teacherToken` | Login (Teacher) | Teacher, class, analytics endpoints |
| `adminToken` | Login (Admin) | Admin control plane, QB writes |
| `worksheetId` | Generate Worksheet | Solve, Submit, Progress |
| `classId` | Create Class | Students list, Analytics, Rewards |
| `studentId` | Login (Student) | Rewards, Progress |
| `childId` | Set manually | Progress/Parent view |
| `certificateId` | List Certificates | Download Certificate |
| `questionId` | Add Question | Get by ID, Track Reuse |
| `inviteCode` | Create Class | Join Class |

---

## First-Time Testing (5 minutes)

1. **Start server:** `npm run dev`
2. **Open Postman** → Import collection + Local environment
3. **Select environment:** Learnfyra — Local Development
4. **Run Auth folder:**
   - `Register (Student)` → creates user
   - `Login (Student)` → auto-captures `studentToken`
5. **Run Worksheet folder:**
   - `Generate Worksheet` → auto-captures `worksheetId`
   - `Get Solve Page` → returns questions only (no answers)
   - `Submit Answers & Score` → returns score breakdown
   - `Download Worksheet File`
6. **Verify:** All responses show 200 OK

---

## Switching Environments

### Local Development
```
Environment: Learnfyra — Local Development
baseUrl: http://localhost:3000
Auth: Mock adapter — bcrypt + data-local/users.json
Run: npm run dev
```

### QA / Staging
```
Environment: Learnfyra — QA / Staging (AWS)
baseUrl: https://api.qa.learnfyra.com
Auth: Cognito (hybrid mode)
Use valid staging credentials
```

### Production
```
Environment: Learnfyra — Production (AWS)
baseUrl: https://api.learnfyra.com
Auth: Cognito (hybrid mode)
Use test accounts only — never real user PII
```

---

## Test Results Indicators

| Response | Status | Meaning |
|----------|--------|---------|
| 200 OK | Pass | Request successful |
| 201 Created | Pass | Resource created |
| 400 Bad Request | Fail | Invalid input (check body/params) |
| 401 Unauthorized | Fail | No/invalid token — re-login |
| 403 Forbidden | Fail | Wrong role — use correct token |
| 404 Not Found | Fail | Resource does not exist |
| 409 Conflict | Fail | Duplicate (e.g., question already in bank) |
| 500 Internal Server Error | Fail | Server error — check logs |

---

## Debugging Tips

**Token not auto-capturing?**
- Check test script on Login endpoint
- Verify response has a `token` field
- Manual fallback: copy token from response → Collection Variables → paste

**Worksheet endpoint returns 404?**
- Confirm `worksheetId` was captured after Generate
- Generate creates local file in `worksheets-local/{uuid}/`
- Re-run Generate if needed

**403 Forbidden on teacher endpoint?**
- Confirm you ran Login (Teacher) and `teacherToken` is populated
- Teacher token is required for: Create Class, List Students, Analytics, Rewards/Class

**Admin endpoint returns 403?**
- Run Login (Admin) to populate `adminToken`
- Admin role required for: all `/api/admin/*` and QB write operations

**CORS error?**
- Postman bypasses browser CORS automatically
- If browser testing: check `ALLOWED_ORIGIN` env var on server

---

## Headless / CI Testing

```bash
# Using newman (install: npm install -g newman)
newman run postman/Learnfyra-Complete-API.postman_collection.json \
  --environment postman/Learnfyra-Local.postman_environment.json \
  --reporters cli,html
```

---

## Next: Full Testing Guide

For complete endpoint documentation, request/response examples, and troubleshooting:
Read: [POSTMAN_TESTING_GUIDE.md](./POSTMAN_TESTING_GUIDE.md)

---

**Quick Links:**
- Collection JSON: `./Learnfyra-Complete-API.postman_collection.json`
- Full Guide: `./POSTMAN_TESTING_GUIDE.md`
- Endpoint Reference: `./ENDPOINT_REFERENCE_CARD.md`
- Architecture: `../architecture/`
- Tests: `../tests/`

---

**Collection Version:** 2.0
**Last Updated:** April 2, 2026
**Status:** Ready for testing all 41 implemented endpoints
