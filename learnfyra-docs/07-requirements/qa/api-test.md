# Complete API Test Matrix

This document covers all endpoints for manual and automated API testing. Use with Postman or curl.

## Postman Setup

### Environment Variables
```
base_url = http://localhost:3000 (local) or https://api.dev.learnfyra.com (dev)
access_token = (populated after login)
refresh_token = (populated after login)
worksheet_id = (populated after generate)
class_id = (populated after create class)
```

### Pre-request Script (for authenticated requests)
```javascript
// Auto-refresh token if expired
const token = pm.environment.get('access_token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  const isExpired = payload.exp < Math.floor(Date.now() / 1000);
  if (isExpired) {
    pm.sendRequest({
      url: pm.environment.get('base_url') + '/api/auth/refresh',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      body: { mode: 'raw', raw: JSON.stringify({ refreshToken: pm.environment.get('refresh_token') }) }
    }, (err, res) => {
      if (!err) pm.environment.set('access_token', res.json().accessToken);
    });
  }
}
```

---

## Worksheet Endpoints

| Method | Path | Auth | Test Case | Expected |
|---|---|---|---|---|
| POST | /api/generate | None | Valid grade 3 Math Multiplication | 200, worksheetId, downloadUrls |
| POST | /api/generate | None | Grade 1 ELA | 200, questions array in solve-data |
| POST | /api/generate | None | Grade 10 Science | 200 |
| POST | /api/generate | None | questionCount=5 | 200, exactly 5 questions |
| POST | /api/generate | None | questionCount=30 | 200, exactly 30 questions |
| POST | /api/generate | None | questionCount=4 (too low) | 400 VALIDATION_ERROR |
| POST | /api/generate | None | questionCount=31 (too high) | 400 VALIDATION_ERROR |
| POST | /api/generate | None | grade=0 | 400 VALIDATION_ERROR |
| POST | /api/generate | None | grade=11 | 400 VALIDATION_ERROR |
| POST | /api/generate | None | invalid topic | 400 VALIDATION_ERROR |
| POST | /api/generate | None | formats=[] | 400 VALIDATION_ERROR |
| GET | /api/download | None | Valid worksheetId + file=worksheet-pdf | 200, url, expiresAt |
| GET | /api/download | None | Non-existent worksheetId | 404 WORKSHEET_NOT_FOUND |
| GET | /api/download | None | Invalid file type | 400 INVALID_FILE_TYPE |
| GET | /api/worksheets | Bearer | List my worksheets | 200, worksheets array |
| GET | /api/topics | None | grade=3&subject=Math | 200, topics array |
| OPTIONS | /api/generate | None | CORS preflight | 200, CORS headers |

## Auth Endpoints

See `07-requirements/qa/auth-qa.md` for full auth test matrix.

## Solve Endpoints

| Method | Path | Auth | Test Case | Expected |
|---|---|---|---|---|
| GET | /api/solve/:id | None | Valid worksheetId | 200, questions without answers |
| GET | /api/solve/:id | None | Non-existent worksheetId | 404 WORKSHEET_NOT_FOUND |
| GET | /api/solve/:id | None | Path traversal: ../../../etc/passwd | 400 INVALID_WORKSHEET_ID |
| GET | /api/solve/:id | None | Verify no answer fields in response | 200, no `answer` key in any question |
| POST | /api/submit | None | All correct answers | 200, percentage=100 |
| POST | /api/submit | None | All wrong answers | 200, percentage=0 |
| POST | /api/submit | None | No answers provided | 400 NO_ANSWERS_PROVIDED |
| POST | /api/submit | None | Missing worksheetId | 400 MISSING_WORKSHEET_ID |
| POST | /api/submit | None | Invalid question number | 400 INVALID_QUESTION_NUMBER |
| POST | /api/submit | Bearer (student) | Authenticated submit | 200, attemptId present |
| POST | /api/submit | None | Guest submit | 200, no attemptId |
| POST | /api/submit | None | fill-in-the-blank case-insensitive | "photosynthesis" matches "Photosynthesis" |
| POST | /api/submit | None | timeTaken field | 200, timeTaken echoed in response |
| OPTIONS | /api/submit | None | CORS preflight | 200, CORS headers |

## Progress Endpoints

| Method | Path | Auth | Test Case | Expected |
|---|---|---|---|---|
| GET | /api/progress/me | Bearer (student) | Get own progress | 200, totalAttempts, avgScore, streak |
| GET | /api/progress/me | Bearer (teacher) | Teacher accessing own progress | 200 |
| GET | /api/progress/me | None | No token | 401 NO_TOKEN |
| GET | /api/progress/history | Bearer | Paginated history | 200, attempts array |
| GET | /api/progress/history | Bearer | With limit=5 | 200, max 5 attempts |
| GET | /api/dashboard | Bearer (teacher) | Teacher dashboard | 200, classes list |
| GET | /api/dashboard | Bearer (parent) | Parent dashboard | 200, child progress |
| GET | /api/dashboard/class/:id | Bearer (teacher) | Valid class | 200, studentCount, avgScore |
| GET | /api/dashboard/class/:id | Bearer (other teacher) | Not your class | 403 NOT_CLASS_OWNER |
| GET | /api/dashboard/child | Bearer (parent) | Parent with linked child | 200, child progress |
| GET | /api/dashboard/child | Bearer (parent no child) | Parent without linked child | 404 NO_CHILD_LINKED |

## Class Endpoints

| Method | Path | Auth | Test Case | Expected |
|---|---|---|---|---|
| POST | /api/classes | Bearer (teacher) | Create class | 200, classId, joinCode |
| POST | /api/classes | Bearer (student) | Student tries to create | 403 INSUFFICIENT_ROLE |
| GET | /api/classes/me | Bearer (student) | Student class list | 200, classes array |
| GET | /api/classes/me | Bearer (teacher) | Teacher class list | 200, classes with studentCount |
| POST | /api/classes/join | Bearer (student) | Valid join code | 200, className, teacherName |
| POST | /api/classes/join | Bearer (student) | Invalid join code | 404 INVALID_JOIN_CODE |
| POST | /api/classes/join | Bearer (student) | Already enrolled | 409 ALREADY_ENROLLED |
| GET | /api/classes/:id/students | Bearer (teacher) | Owner views roster | 200, students array |
| GET | /api/classes/:id/students | Bearer (other teacher) | Non-owner | 403 NOT_CLASS_OWNER |
| POST | /api/classes/:id/assignments | Bearer (teacher) | Assign worksheet | 200, assignmentId |
| DELETE | /api/classes/:id/students/:sid | Bearer (teacher) | Remove student | 200 |

## Certificate Endpoints

| Method | Path | Auth | Test Case | Expected |
|---|---|---|---|---|
| POST | /api/certificates/generate | Bearer (student) | Score >= 80% | 200, certificateId, downloadUrl |
| POST | /api/certificates/generate | Bearer (student) | Score < 80% | 400 SCORE_BELOW_THRESHOLD |
| POST | /api/certificates/generate | Bearer (student) | Duplicate (already issued) | 200, same certificateId (idempotent) |
| GET | /api/certificates/:id | None | Valid certificateId | 200, studentName, worksheetTitle |
| GET | /api/certificates/:id | None | Non-existent | 404 |

## Health Endpoint

| Method | Path | Auth | Test Case | Expected |
|---|---|---|---|---|
| GET | /api/health | None | Always | 200, {status: ok} |
| GET | /api/health | None | During maintenance mode | 200 (health exempt) |
