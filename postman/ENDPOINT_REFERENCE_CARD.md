# Learnfyra API — Quick Endpoint Reference Card

**Generated:** March 27, 2026  
**Collection Version:** 1.0 — All Ready Endpoints (30+)

---

## 🔐 Authentication (6 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/auth/register` | POST | None | ✅ Ready |
| `/api/auth/login` | POST | None | ✅ Ready |
| `/api/auth/logout` | POST | None | ✅ Ready |
| `/api/auth/oauth/:provider` | POST | None | ✅ Ready |
| `/api/auth/callback/:provider` | GET | None | ✅ Ready |

**Quick Start:** Register → Login → Capture token

---

## 📝 Worksheet Generation & Delivery (4 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/generate` | POST | Optional | ✅ Ready |
| `/api/solve/:worksheetId` | GET | None | ✅ Ready |
| `/api/submit` | POST | None | ✅ Ready |
| `/api/download?key=...` | GET | None | ✅ Ready |

**Quick Start:** Generate → Solve → Submit → Download

---

## 👨‍🎓 Student Routes (2 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/student/profile` | GET | Bearer | ✅ Ready |
| `/api/student/join-class` | POST | Bearer | ✅ Ready |

**Requires:** Student role + Bearer token

---

## 👩‍🏫 Teacher Routes (2 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/class/create` | POST | Bearer | ✅ Ready |
| `/api/class/:id/students` | GET | Bearer | ✅ Ready |

**Requires:** Teacher role + Bearer token

---

## 📊 Progress Tracking (2 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/progress/save` | POST | Bearer | ✅ Ready |
| `/api/progress/history` | GET | Bearer | ✅ Ready |

**Requires:** Student role + Bearer token

---

## 📈 Analytics (1 endpoint)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/analytics/class/:id` | GET | Bearer | ✅ Ready |

**Requires:** Teacher role + Bearer token

---

## 🎁 Rewards & Gamification (2 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/rewards/student/:id` | GET | Bearer | ✅ Ready |
| `/api/rewards/class/:id` | GET | Bearer | ✅ Ready |

**Requires:** Bearer token

---

## 🎓 Certificates (2 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/certificates/list` | GET | Bearer | ✅ Ready |
| `/api/certificates/:id` | GET | Bearer | ✅ Ready |

**Requires:** Student role + Bearer token

---

## 📚 Question Bank (4 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/qb/questions` | GET | None | ✅ Ready |
| `/api/qb/questions` | POST | None | ✅ Ready |
| `/api/qb/questions/:id` | GET | None | ✅ Ready |
| `/api/qb/questions/:id/reuse` | POST | None | ✅ Ready |

**Note:** Deduplication on POST by (grade, subject, topic, type, question-text)

---

## ⚙️ Admin Control Plane (2 endpoints)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/admin/policies` | GET | Admin Bearer | ✅ Ready |
| `/api/admin/policies` | PUT | Admin Bearer | ✅ Ready |

**Requires:** Admin role + Bearer token + Idempotency-Key header

---

## 🧪 Testing Commands

```bash
# Local development
npm run dev              # Start Express server on http://localhost:3000

# Automated tests
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage    # With coverage report

# Postman (Import collection from postman/Learnfyra-Complete-API.postman_collection.json)
# Then run collection via Postman UI → Run button
```

---

## 📥 HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input (see error message) |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions (wrong role) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry (e.g., question in bank) |
| 500 | Server Error | Unexpected error (check logs) |

---

## 🔑 Auth Tokens

**How to Get:**
1. POST `/api/auth/register` → create account
2. POST `/api/auth/login` → receive JWT token
3. Use token in Authorization header: `Bearer <token>`

**Token Format:** JWT (JSON Web Token)  
**Expiry:** 24 hours (default)  
**Refresh:** Re-login to get new token

---

## 🌐 Environment URLs

| Environment | Base URL |
|-------------|----------|
| Local Dev | http://localhost:3000 |
| Staging | https://d123456.cloudfront.net (placeholder) |
| Production | https://www.learnfyra.com |

---

## 📦 Request/Response Format

**All requests:** `Content-Type: application/json`  
**All responses:** JSON

**Example request:**
```json
{
  "grade": 4,
  "subject": "Math",
  "topic": "Factors"
}
```

**Example response:**
```json
{
  "success": true,
  "worksheetId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": { ... }
}
```

---

## 🚀 Import into Postman

1. Download: `postman/Learnfyra-Complete-API.postman_collection.json`
2. Postman → Import → Select JSON
3. Configure: `baseUrl` variable to your environment
4. Run → Choose folder → Execute

---

## 📖 Full Documentation

For detailed workflows, examples, and troubleshooting:
- **Setup:** `postman/README.md`
- **Complete Guide:** `postman/POSTMAN_TESTING_GUIDE.md`
- **Collection:** `postman/Learnfyra-Complete-API.postman_collection.json`

---

## ✅ Status Summary

- **Total Endpoints:** 30+
- **Authentication:** ✅ 6/6 ready
- **Worksheet:** ✅ 4/4 ready
- **Student:** ✅ 2/2 ready
- **Teacher:** ✅ 2/2 ready
- **Progress:** ✅ 2/2 ready
- **Analytics:** ✅ 1/1 ready
- **Rewards:** ✅ 2/2 ready
- **Certificates:** ✅ 2/2 ready
- **Question Bank:** ✅ 4/4 ready
- **Admin:** ✅ 2/2 ready

**Overall:** 🟢 **ALL READY FOR TESTING**

---

**Last Updated:** March 27, 2026  
**Print-Friendly:** Save this page as PDF for reference
