# Developer Backend Auth Test Runbook

## Prerequisites

```bash
# Ensure server is running
node server.js
# Server listens on http://localhost:3000
```

## Automated Test Gates

Before any commit, run:

```bash
# All unit tests must pass
npm test

# Coverage must be >= 80%
npm run test:coverage

# Syntax check all modified files
node --check src/auth/cognitoClient.js
node --check backend/handlers/authHandler.js
node --check backend/middleware/authorizer.js
```

## Auth Route Tests (curl)

### Health Check (no auth required)
```bash
curl -s http://localhost:3000/api/health | jq .
# Expected: {"status":"ok","version":"...","runtime":"local"}
```

### Guest Worksheet Generation (no auth required)
```bash
curl -s -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"grade":3,"subject":"Math","topic":"Addition","difficulty":"Easy","questionCount":5,"formats":["html"]}' \
  | jq '{worksheetId: .worksheetId, hasDownloadUrls: (.downloadUrls | keys)}'
# Expected: {worksheetId: "uuid-...", hasDownloadUrls: ["html"]}
```

### Token Endpoint (local mode — returns mock token)
```bash
curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"TestPassword123!"}' \
  | jq .
# Expected: {"accessToken":"...", "refreshToken":"...", "role":"teacher"}
```

### Protected Route Without Token (should fail 401)
```bash
curl -s http://localhost:3000/api/progress/me \
  -H "Content-Type: application/json" \
  | jq .
# Expected: {"error":"Unauthorized","code":"NO_TOKEN"}
```

### Protected Route With Valid Token
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"TestPassword123!"}' \
  | jq -r '.accessToken')

curl -s http://localhost:3000/api/progress/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
# Expected: 200 with progress data (empty for new user)
```

### Protected Route With Expired Token (should fail 401)
```bash
# Use a known expired token
curl -s http://localhost:3000/api/progress/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid" \
  | jq .
# Expected: {"error":"Unauthorized","code":"TOKEN_EXPIRED"}
```

### Refresh Token
```bash
REFRESH=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"TestPassword123!"}' \
  | jq -r '.refreshToken')

curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | jq .
# Expected: {"accessToken":"new-token..."}
```

### Logout
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"TestPassword123!"}' \
  | jq -r '.accessToken')

curl -s -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
# Expected: {"message":"Logged out"}

# Verify token is now invalid
curl -s http://localhost:3000/api/progress/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
# Expected: {"error":"Unauthorized","code":"TOKEN_REVOKED"}
```

### CORS Preflight
```bash
curl -s -X OPTIONS http://localhost:3000/api/generate \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v 2>&1 | grep -E "Access-Control|< HTTP"
# Expected: 200, Access-Control-Allow-Origin: *, Access-Control-Allow-Methods: GET,POST,OPTIONS
```

## Role-Based Access Tests

### Teacher-Only Routes (student should get 403)
```bash
STUDENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"TestPassword123!","role":"student"}' \
  | jq -r '.accessToken')

curl -s -X POST http://localhost:3000/api/classes \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Class"}' \
  | jq .
# Expected: {"error":"Forbidden","code":"INSUFFICIENT_ROLE"}
```

### Admin-Only Routes
```bash
# Regular teacher should not access admin routes
TEACHER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"TestPassword123!","role":"teacher"}' \
  | jq -r '.accessToken')

curl -s http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  | jq .
# Expected: {"error":"Forbidden","code":"INSUFFICIENT_ROLE"}
```

## Validation Checklist

```
[ ] npm test passes with 0 failures
[ ] npm run test:coverage shows >= 80% line coverage
[ ] Health endpoint returns 200 without token
[ ] Guest generate works without token
[ ] Token endpoint returns accessToken + refreshToken
[ ] Protected route returns 401 without token
[ ] Protected route returns 200 with valid token
[ ] Protected route returns 401 with expired token
[ ] Refresh token endpoint returns new accessToken
[ ] Logout invalidates token
[ ] CORS preflight returns 200 with correct headers
[ ] Role-based routes return 403 for insufficient role
[ ] Admin routes blocked for non-admin users
```
