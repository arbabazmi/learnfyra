# M06-BE-01 - Class Relationship Backend Contracts
Status: implementation-ready
Task ID: M06-BE-01
Authors: backend-developer-agent + architect-agent
Updated: 2026-03-26

## Summary

This contract defines teacher class creation, student class join, teacher class roster view,
and relationship rules used by parent-scoped endpoints.

Implemented endpoints in current handlers:
- POST /api/class/create
- GET /api/class/:id/students
- GET /api/student/profile
- POST /api/student/join-class

Relationship dependency endpoint already defined in M05 contract and enforced in code:
- GET /api/progress/parent/:childId (uses parentLinks table)

## Standard Response Model

All responses are Lambda-compatible:

```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  },
  "body": "json-string"
}
```

Application errors in body:

```json
{ "error": "message." }
```

## Data Contracts

### classes

Primary key: `classId`

```json
{
  "classId": "uuid-v4",
  "teacherId": "uuid-v4",
  "className": "string (1-120)",
  "grade": "integer 1-10",
  "subject": "Math|ELA|Science|Social Studies|Health",
  "inviteCode": "string (6 uppercase alphanumeric)",
  "createdAt": "ISO-8601"
}
```

### memberships

Primary key: `id` where `id = {classId}#{studentId}`

```json
{
  "id": "{classId}#{studentId}",
  "classId": "uuid-v4",
  "studentId": "uuid-v4",
  "joinedAt": "ISO-8601",
  "status": "active|removed"
}
```

Duplicate membership prevention is enforced by deterministic ID and existence check.

### parentLinks

Primary key: `id` where `id = {parentId}#{childId}`

```json
{
  "id": "{parentId}#{childId}",
  "parentId": "uuid-v4",
  "childId": "uuid-v4",
  "status": "active|pending|revoked",
  "linkedAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

## Authorization Matrix

| Endpoint | Role Required | Ownership Rule |
|---|---|---|
| POST /api/class/create | teacher | teacherId set from JWT.sub |
| GET /api/class/:id/students | teacher | class.teacherId must equal JWT.sub |
| GET /api/student/profile | authenticated | userId must equal JWT.sub |
| POST /api/student/join-class | student | studentId set from JWT.sub |
| GET /api/progress/parent/:childId | parent | active parentLinks record for parent-child pair |

## Endpoint Contracts

### POST /api/class/create

Role: teacher

Request:

```json
{
  "className": "Grade 4 - Section A",
  "grade": 4,
  "subject": "Math"
}
```

Validation:
- className required, trimmed, length 1-120
- grade integer 1-10
- subject enum Math|ELA|Science|Social Studies|Health

Success 201:

```json
{
  "classId": "uuid-v4",
  "className": "Grade 4 - Section A",
  "grade": 4,
  "subject": "Math",
  "inviteCode": "A3K9FZ"
}
```

Errors:
- 400 invalid/missing fields
- 401 invalid token
- 403 non-teacher role

### GET /api/class/:id/students

Role: teacher

Path params:
- id: classId (UUID)

Validation:
- id required
- id must be UUID format
- class must exist
- ownership required: class.teacherId === JWT.sub

Success 200:

```json
{
  "classId": "uuid-v4",
  "className": "Grade 4 - Section A",
  "students": [
    {
      "userId": "uuid-v4",
      "displayName": "Alex Student",
      "email": "alex@example.com"
    }
  ]
}
```

Only memberships where `status === active` are included.

Errors:
- 400 missing/invalid classId
- 401 invalid token
- 403 non-teacher role or non-owner teacher
- 404 class not found

### GET /api/student/profile

Role: authenticated user

Success 200:

```json
{
  "userId": "uuid-v4",
  "email": "student@example.com",
  "role": "student",
  "displayName": "Alex Student",
  "classMemberships": ["uuid-v4", "uuid-v4"]
}
```

Only active memberships are returned in classMemberships.

Errors:
- 401 invalid token
- 404 user not found

### POST /api/student/join-class

Role: student

Request:

```json
{
  "inviteCode": "A3K9FZ"
}
```

Validation:
- inviteCode required
- inviteCode normalized via trim + uppercase

Behavior:
- resolve class by inviteCode
- create membership with id `{classId}#{studentId}` and status `active`
- if membership already exists, return 409

Success 200:

```json
{
  "classId": "uuid-v4",
  "className": "Grade 4 - Section A",
  "grade": 4,
  "subject": "Math"
}
```

Errors:
- 400 missing inviteCode or invalid JSON
- 401 invalid token
- 403 non-student role
- 404 class not found for invite code
- 409 already a member

## Invariants

1. Membership uniqueness: one student can have at most one active row per class via `id = classId#studentId`.
2. Ownership: teacher roster reads are scoped to owner teacher only.
3. Parent access requires active relationship row in parentLinks.
4. CORS headers must be present on all success and error responses.
5. Invite code uniqueness: inviteCode must be unique per class; duplicate values are treated as a data integrity error.

## Required M06-BE-02 Implementation Checklist

1. Add strict validation helpers for class and membership payloads.
2. Enforce teacher ownership in GET /api/class/:id/students.
3. Add UUID validation for classId path parameters.
4. Normalize invite code and keep duplicate membership prevention behavior.
5. Add tests for ownership denial and duplicate enrollment edge cases.

## Acceptance Criteria

Given a teacher with a valid JWT
When POST /api/class/create is called with valid payload
Then a class is created with teacherId bound to JWT.sub and a 6-char inviteCode.

Given a non-owner teacher
When GET /api/class/:id/students is called
Then the response is 403 and student roster is not exposed.

Given a student already enrolled in a class
When POST /api/student/join-class is called again with the same invite code
Then the API returns 409 and does not create a duplicate membership row.

Given an active parent-child link
When GET /api/progress/parent/:childId is called by that parent
Then access is authorized only for the linked child scope.
