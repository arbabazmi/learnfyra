# Reporting, Class & Certificate API Contracts (M05 + M06)

**Status: FROZEN — RC-BE-01 (2026-03-26)**

---

## M05 — Progress & Reporting

### GET /api/progress/me

Get the authenticated student's full progress profile.

**Auth:** Bearer token (student role)

**Response 200:**
```json
{
  "userId": "uuid-v4",
  "totalAttempts": 24,
  "avgScore": 78.5,
  "streak": 3,
  "lastActive": "2026-03-28T14:00:00Z",
  "weakAreas": ["Long Division", "Fractions"],
  "strongAreas": ["Multiplication", "Geometry"],
  "subjectAvgScores": {
    "Math": 82.0,
    "ELA": 75.0,
    "Science": 68.5
  },
  "recentAttempts": [
    {
      "worksheetId": "uuid-v4",
      "topic": "Multiplication",
      "score": 9,
      "totalPoints": 10,
      "percentage": 90,
      "completedAt": "2026-03-28T14:00:00Z"
    }
  ]
}
```

---

### GET /api/progress/history

Get paginated attempt history for the authenticated student.

**Auth:** Bearer token (student role)

**Query Parameters:**
- `limit` (optional, default 20)
- `lastKey` (optional): pagination cursor

**Response 200:**
```json
{
  "attempts": [
    {
      "worksheetId": "uuid-v4",
      "grade": 3,
      "subject": "Math",
      "topic": "Multiplication",
      "difficulty": "Medium",
      "score": 8,
      "totalPoints": 10,
      "percentage": 80,
      "timeTaken": 845,
      "timed": true,
      "completedAt": "2026-03-28T14:00:00Z"
    }
  ],
  "count": 20,
  "lastKey": "pagination-cursor"
}
```

---

### GET /api/dashboard

Get the appropriate dashboard based on the authenticated user's role.

**Auth:** Bearer token (teacher or parent role)

**Response 200 (Teacher):** Same as GET /api/dashboard/class listing (list of teacher's classes with summary stats)

**Response 200 (Parent):** Same as GET /api/dashboard/child

---

### GET /api/dashboard/class/:classId

Get class-level analytics for a teacher.

**Auth:** Bearer token (teacher role, must own the class)

**Response 200:**
```json
{
  "classId": "uuid-v4",
  "name": "Period 3 Math",
  "grade": 5,
  "subject": "Math",
  "studentCount": 25,
  "classAvgScore": 74.2,
  "students": [
    {
      "studentId": "uuid-v4",
      "name": "Student Name",
      "avgScore": 78.5,
      "totalAttempts": 12,
      "lastActive": "2026-03-28T14:00:00Z",
      "completedAssignments": 3,
      "totalAssignments": 5,
      "needsIntervention": false
    }
  ],
  "needsInterventionCount": 4,
  "topTopics": ["Multiplication", "Division", "Fractions"],
  "pendingAssignments": 2
}
```

**Error 403 — Teacher does not own this class:**
```json
{ "error": "Forbidden", "code": "NOT_CLASS_OWNER" }
```

---

### GET /api/dashboard/student/:studentId

Get a single student's progress (teacher view).

**Auth:** Bearer token (teacher role, student must be in one of teacher's classes)

**Response 200:** Same structure as GET /api/progress/me

---

### GET /api/dashboard/child

Get the authenticated parent's linked child's progress.

**Auth:** Bearer token (parent role with linkedStudentId)

**Response 200:** Same structure as GET /api/progress/me

**Error 404 — No child linked:**
```json
{ "error": "Not Found", "code": "NO_CHILD_LINKED" }
```

---

## M05 — Certificates

### POST /api/certificates/generate

Generate a completion certificate for a worksheet attempt.

**Auth:** Bearer token (student role, or teacher on behalf of student)

**Request:**
```json
{
  "worksheetId": "uuid-v4",
  "attemptId": "userId#worksheetId#2026-03-28T12:00:00Z"
}
```

**Issuance rule:** Only issued when `percentage >= 80`. Returns existing certificate if one already exists for this worksheetId+userId combination.

**Response 200:**
```json
{
  "certificateId": "uuid-v4",
  "downloadUrl": "https://presigned-s3-url/certificate.pdf",
  "issuedAt": "2026-03-28T14:00:00Z",
  "percentage": 85,
  "worksheetTitle": "Grade 3 Math — Multiplication"
}
```

**Error 400 — Score below threshold:**
```json
{ "error": "Bad Request", "code": "SCORE_BELOW_THRESHOLD", "requiredPercentage": 80, "achieved": 75 }
```

---

### GET /api/certificates/:certificateId

Get a certificate by ID (for verification or re-download).

**Auth:** None (public verification link)

**Response 200:**
```json
{
  "certificateId": "uuid-v4",
  "studentName": "Student Name",
  "worksheetTitle": "Grade 3 Math — Multiplication",
  "percentage": 85,
  "issuedAt": "2026-03-28T14:00:00Z",
  "downloadUrl": "https://presigned-s3-url/certificate.pdf"
}
```

---

## M06 — Class Management

### POST /api/classes

Create a new class.

**Auth:** Bearer token (teacher role)

**Request:**
```json
{
  "name": "Period 3 Math",
  "grade": 5,
  "subject": "Math"
}
```

**Response 200:**
```json
{
  "classId": "uuid-v4",
  "name": "Period 3 Math",
  "grade": 5,
  "subject": "Math",
  "joinCode": "AB3X7K",
  "createdAt": "2026-03-28T12:00:00Z"
}
```

---

### GET /api/classes/me

List classes for the authenticated user.

**Auth:** Bearer token (student or teacher)

**Response 200 (Student):**
```json
{
  "classes": [
    {
      "classId": "uuid-v4",
      "name": "Period 3 Math",
      "teacherName": "Ms. Smith",
      "grade": 5,
      "subject": "Math",
      "pendingAssignments": 2,
      "joinedAt": "2026-02-01T10:00:00Z"
    }
  ]
}
```

**Response 200 (Teacher):**
```json
{
  "classes": [
    {
      "classId": "uuid-v4",
      "name": "Period 3 Math",
      "grade": 5,
      "subject": "Math",
      "studentCount": 25,
      "joinCode": "AB3X7K",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /api/classes/:classId/students

List students enrolled in a class.

**Auth:** Bearer token (teacher role, must own class)

**Response 200:**
```json
{
  "classId": "uuid-v4",
  "students": [
    {
      "studentId": "uuid-v4",
      "name": "Student Name",
      "email": "student@school.com",
      "avgScore": 78.5,
      "lastActive": "2026-03-28T14:00:00Z",
      "completedAssignments": 3,
      "totalAssignments": 5,
      "joinedAt": "2026-02-01T10:00:00Z"
    }
  ]
}
```

---

### POST /api/classes/join

Join a class using a join code.

**Auth:** Bearer token (student role)

**Request:**
```json
{ "joinCode": "AB3X7K" }
```

**Response 200:**
```json
{
  "classId": "uuid-v4",
  "className": "Period 3 Math",
  "teacherName": "Ms. Smith"
}
```

**Error 404 — Invalid join code:**
```json
{ "error": "Not Found", "code": "INVALID_JOIN_CODE" }
```

**Error 409 — Already enrolled:**
```json
{ "error": "Conflict", "code": "ALREADY_ENROLLED" }
```

---

### POST /api/classes/:classId/assignments

Assign a worksheet to a class.

**Auth:** Bearer token (teacher role, must own class)

**Request:**
```json
{
  "worksheetId": "uuid-v4",
  "dueDate": "2026-04-01T23:59:00Z"
}
```

**Response 200:**
```json
{
  "assignmentId": "uuid-v4",
  "worksheetId": "uuid-v4",
  "classId": "uuid-v4",
  "dueDate": "2026-04-01T23:59:00Z",
  "assignedAt": "2026-03-28T12:00:00Z"
}
```

---

### DELETE /api/classes/:classId/students/:studentId

Remove a student from a class.

**Auth:** Bearer token (teacher role, must own class)

**Response 200:**
```json
{ "message": "Student removed from class" }
```

---

## Cross-Module Integration Contracts

### submitHandler → progressHandler

After scoring a submit, the submitHandler triggers progress aggregate update:

```javascript
// Called inline within submitHandler (not a separate API call)
await updateProgressAggregates(userId, {
  subject, topic, grade, difficulty,
  score, totalPoints, percentage,
  timeTaken, timed, completedAt
});
```

### submitHandler → certificateHandler

If `percentage >= 80`, the submitHandler may optionally trigger certificate generation (or the frontend can call POST /api/certificates/generate explicitly).
