# Developer Backend and Auth Testing Runbook

Date: 2026-03-27
Audience: Backend Developers, QA Engineers
Scope: Local and deployed API behavior testing for auth and backend routes.

**Applies to:** Local development (localhost:3000) and deployed environments (dev, staging, prod).

** How to use:** This guide covers both local testing (sections 1-6) and deployed API testing (sections 7-8).

## 1. Prerequisites

1. Node.js 20.x installed.
2. npm available.
3. Local repository dependencies installed.
4. For deployed API checks: valid test user credentials and token.

## 2. Automated Test Gates

Run from repository root:

```powershell
npm test
```

Optional targeted runs:

```powershell
npm run test:unit
npm run test:integration
npm run test:coverage
```

Pass criteria:
1. All suites pass.
2. No regression in auth, generate, solve, submit, progress, class, student, analytics, rewards, admin flows.

## 3. Start Local Server

```powershell
npm run dev
```

Base URL:

http://localhost:3000

## 4. Local Auth API Validation

1. Register

```powershell
curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"teacher.local@test.com","password":"Passw0rd!","role":"teacher","displayName":"Local Teacher"}'
```

2. Login

```powershell
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"teacher.local@test.com","password":"Passw0rd!"}'
```

3. Refresh

```powershell
curl -X POST http://localhost:3000/api/auth/refresh `
  -H "Content-Type: application/json" `
  -d '{"refreshToken":"<refresh-token-from-login-if-present>"}'
```

4. Logout

```powershell
curl -X POST http://localhost:3000/api/auth/logout `
  -H "Content-Type: application/json" `
  -d '{}'
```

5. OAuth initiate

```powershell
curl -X POST http://localhost:3000/api/auth/oauth/google
```

6. OAuth callback

```powershell
curl "http://localhost:3000/api/auth/callback/google?code=mock-code&state=mock-state"
```

## 5. Protected Route Validation

Capture token and call protected endpoints:

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/login" -ContentType "application/json" -Body '{"email":"teacher.local@test.com","password":"Passw0rd!"}'
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
```

Example requests:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/class/create" -Headers $headers -ContentType "application/json" -Body '{"name":"QA Class"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/generate" -Headers $headers -ContentType "application/json" -Body '{"grade":3,"subject":"Math","topic":"Addition","difficulty":"Easy","questionCount":10,"format":"PDF"}'
```

## 6. Core API Smoke Checklist

Validate:

1. POST /api/generate
2. GET /api/solve/:worksheetId
3. POST /api/submit
4. POST /api/progress/save
5. GET /api/progress/history
6. POST /api/class/create
7. GET /api/analytics/class/:classId
8. GET /api/rewards/student/:studentId
9. GET /api/student/profile
10. POST /api/student/join-class
11. GET /api/qb/questions

Pass criteria:

1. No 5xx responses.
2. Missing token returns 401 on protected routes.
3. Wrong role returns 403 on restricted routes.
4. CORS headers are present on success and failure responses.

## 7. Deployed API External Smoke

Base URLs:

1. https://api.dev.learnfyra.com/api
2. https://fcciuafjrj.execute-api.us-east-1.amazonaws.com/dev/api

Minimum external journey:

1. Register and login.
2. Generate worksheet.
3. Open solve endpoint with worksheet id.
4. Submit answers.
5. Save and fetch progress.

## 8. Troubleshooting Hints

1. Unauthorized errors: verify JWT token format and expiration.
2. OAuth callback errors: verify AUTH_MODE and callback URL configuration.
3. 5xx errors: inspect local server logs or Lambda CloudWatch logs.
4. CORS errors: verify OPTIONS handling and Access-Control-Allow-* headers.

## 9. Related Documents

1. Cloud engineering validation runbook:
- docs/operations/runbooks/cloud-engineering-aws-validation-runbook.md

2. AWS services inventory and deployment status:
- docs/operations/inventory/aws-services-inventory.md
