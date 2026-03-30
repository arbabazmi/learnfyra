# Postman Collection — Quick Setup Guide

## 30-Second Setup

1. **Download Collection:** `postman/Learnfyra-Complete-API.postman_collection.json`
2. **Open Postman** → Import → Select JSON file
3. **Start Local Server:** `npm run dev` (http://localhost:3000)
4. **Run Collection:**
   - Open collection
   - Collection Variables are pre-configured (baseUrl, tokens, IDs)
   - Start with **"1. Authentication"** folder → Run "Login (Student)" and "Login (Teacher)"
   - Tokens auto-capture into variables
   - Run other folders in any order

---

## Files Included

| File | Purpose |
|------|---------|
| `Learnfyra-Complete-API.postman_collection.json` | 30+ ready-to-use endpoints organized in 10 feature groups |
| `POSTMAN_TESTING_GUIDE.md` | Complete testing documentation with workflows, examples, and troubleshooting |
| `Learnfyra-Dev-API.postman_collection.json` | (Older) Basic collection; use Complete API instead |

---

## What's Tested

✅ **10 Feature Groups:**
1. Authentication (Register, Login, Logout)
2. Worksheet Generation & Delivery (Generate, Solve, Submit, Download)
3. Student Routes (Profile, Join Class)
4. Teacher Routes (Create Class, List Students)
5. Progress Tracking (Save, History)
6. Analytics (Class Performance)
7. Rewards & Gamification (Points, Streaks, Badges)
8. Certificates (List, Download)
9. Question Bank (CRUD, Deduplication)
10. Admin Control Plane (Policies)

✅ **30+ Endpoints** across all handlers  
✅ **Happy Path Tests** pre-configured  
✅ **Auto-Capture** of tokens and IDs into collection variables  

---

## Common Workflows

### Workflow A: Complete Worksheet Solve
```
1. POST Auth/Register (Student)
2. POST Auth/Login (Student) → captures studentToken
3. POST Worksheet/Generate → captures worksheetId
4. GET Worksheet/Solve/{worksheetId}
5. POST Worksheet/Submit (with answers)
6. GET Worksheet/Download
```

### Workflow B: Teacher Creates Class & Reviews Students
```
1. POST Auth/Register (Teacher)
2. POST Auth/Login (Teacher) → captures teacherToken
3. POST Teacher/Create Class → captures classId & inviteCode
4. GET Teacher/List Class Students
5. GET Analytics/Get Class Analytics
```

### Workflow C: Question Bank Adds & Reuses
```
1. POST QB/Add Question → captures questionId
2. GET QB/Get Question by ID
3. POST QB/Track Question Reuse (multiple times)
4. GET QB/List Questions (verify reuse count increased)
```

---

## Pre-Configured Variables

| Variable | Initial Value | Purpose |
|----------|---------------|---------|
| `baseUrl` | http://localhost:3000 | API base URL (local or AWS) |
| `studentToken` | (empty) | Captured after Login (Student) |
| `teacherToken` | (empty) | Captured after Login (Teacher) |
| `adminToken` | (empty) | Captured after Login (Admin) |
| `worksheetId` | (empty) | Captured after Generate Worksheet |
| `classId` | (empty) | Captured after Create Class |
| `studentId` | (empty) | Captured after Login (Student) |
| `questionId` | (empty) | Captured after Add Question |

---

## First-Time Testing (5 minutes)

1. **Start server:** `npm run dev`
2. **Open Postman** → Import collection
3. **Collection Variables:** Verify `baseUrl = http://localhost:3000`
4. **Run Auth Folder:**
   - `Register (Student)` → Creates user
   - `Login (Student)` → Auto-captures studentToken
5. **Run Worksheet Folder:**
   - `Generate Worksheet` → Auto-captures worksheetId
   - `Get Solve Page` → Returns questions only
   - `Submit Answers & Score` → Returns results
   - `Download Worksheet File` → Shows file URL
6. **Verify:** All 4 responses show 200 OK ✅

---

## Switching Environments

### Local Development
```
baseUrl = http://localhost:3000
Run: npm run dev
Auth: Mock adapter (bcrypt + JSON files)
```

### Staging
```
baseUrl = https://d123456.cloudfront.net (or API Gateway URL)
Auth: Cognito
Update: Valid credentials for staging users
```

### Production
```
baseUrl = https://www.learnfyra.com (or production CloudFront)
Auth: Cognito
⚠️ Use test accounts only
```

---

## Test Results Indicators

| Response | Status | Meaning |
|----------|--------|---------|
| 200 OK | ✅ | Request successful |
| 201 Created | ✅ | Resource created |
| 400 Bad Request | ❌ | Invalid input (check body/params) |
| 401 Unauthorized | ❌ | No/invalid token (re-login) |
| 403 Forbidden | ❌ | Wrong role (use correct token) |
| 404 Not Found | ❌ | Resource doesn't exist |
| 409 Conflict | ❌ | Duplicate (e.g., question already in bank) |
| 500 Internal Server Error | ❌ | Server error (check logs) |

---

## Debugging Tips

**Token not auto-capturing?**
- Check Post-request script in Login endpoint
- Verify response contains `token` field
- Manual: Copy token from response → Collection Variables → paste

**Worksheet endpoint returns 404?**
- Confirm `worksheetId` variable is populated after Generate
- Generate creates local file in `worksheets-local/{uuid}/`
- Verify directory exists before running Solve/Submit

**403 Forbidden on teacher endpoint?**
- Confirm you used Teacher token (not Student)
- POST Login (Teacher) is required
- Verify token was captured into `teacherToken` variable

**CORS errors?**
- Postman bypasses browser CORS automatically
- If browser testing needed, check `ALLOWED_ORIGIN` env var
- Local dev: set `ALLOWED_ORIGIN=http://localhost:3000`

---

## Collection Runners & Automation

**Run All Endpoints:**
```
Postman → Collection → Run
Select: "Learnfyra-Complete-API"
Run → All tests execute with captured variables
```

**Export Results:**
```
After run: Export results as HTML/JSON for reports
```

**Headless Testing (CI/CD):**
```bash
# (Not yet configured; requires newman package)
newman run postman/Learnfyra-Complete-API.postman_collection.json \
  --environment postman/local-environment.json \
  --reporters cli,html
```

---

## Next: Full Testing Guide

For complete endpoint documentation, examples, and troubleshooting:  
👉 **Read:** [POSTMAN_TESTING_GUIDE.md](./POSTMAN_TESTING_GUIDE.md)

---

**Quick Links:**
- 📦 [Collection JSON](./Learnfyra-Complete-API.postman_collection.json)
- 📖 [Full Guide](./POSTMAN_TESTING_GUIDE.md)
- 🏗️ [Architecture](../architecture/)
- 🧪 [Tests](../tests/)
- 🚀 [Deployment Runbook](../operations/runbooks/cloud-engineering-aws-validation-runbook.md)

---

**Collection Version:** 1.0  
**Last Updated:** March 27, 2026  
**Status:** Ready for testing all implemented endpoints
