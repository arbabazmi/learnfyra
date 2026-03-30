# M06 — Class & Relationship Management

## Module Summary

M06 manages the relationships between teachers, students, and parents. It enables teachers to create classes, assign worksheets, and track class performance. Parents are linked to student accounts to access their child's progress.

## Data Model

### Classes Table

```
Table: LearnfyraClasses-{env}
PK: classId (String, UUID v4)
```

| Attribute | Type | Description |
|---|---|---|
| classId | String | UUID v4, PK |
| teacherId | String | Teacher's userId |
| name | String | Class name (e.g., "Period 3 Math") |
| grade | Number | Grade level (optional — class may span grades) |
| subject | String | Subject focus (optional) |
| joinCode | String | 6-character alphanumeric invite code |
| createdAt | String | ISO-8601 |
| studentCount | Number | Precomputed, updated on join/leave |
| archivedAt | String | ISO-8601 or null |

### Class Memberships Table

```
Table: LearnfyraClassMemberships-{env}
PK: classId (String)
SK: studentId (String)
```

| Attribute | Type | Description |
|---|---|---|
| classId | String | PK |
| studentId | String | SK |
| joinedAt | String | ISO-8601 |
| status | String | active \| removed |
| removedAt | String | ISO-8601 or null |

GSI on studentId: enables "list all classes for a student" query.

### Parent-Student Link

Stored in the Users table:

| Attribute | Type | Description |
|---|---|---|
| linkedStudentId | String | On parent record — the student's userId |
| linkedParentIds | List | On student record — list of parent userIds |

A student can have up to 2 linked parents. A parent can only be linked to one student (Phase 1).

## Teacher Workflow

### Create Class

```
POST /api/classes
Body: { name: "Period 3 Math", grade: 5, subject: "Math" }

Response:
{
  "classId": "uuid",
  "name": "Period 3 Math",
  "joinCode": "AB3X7K",
  "grade": 5,
  "subject": "Math"
}
```

### Assign Worksheet to Class

```
POST /api/classes/{classId}/assignments
Body: { worksheetId: "uuid", dueDate: "2026-04-01T23:59:00Z" }

Response: { assignmentId: "uuid", worksheetId, classId, dueDate }
```

This creates an Assignment record. Students in the class see the assigned worksheet in their dashboard. Completion is tracked via WorksheetAttempt records cross-referenced with the Assignment.

### View Class Roster

```
GET /api/classes/{classId}/students

Response:
{
  "classId": "uuid",
  "students": [
    {
      "studentId": "uuid",
      "name": "Student Name",
      "avgScore": 78.5,
      "lastActive": "2026-03-28T14:00:00Z",
      "completedAssignments": 3,
      "totalAssignments": 5
    }
  ]
}
```

## Student Workflow

### Join Class by Code

```
POST /api/classes/join
Body: { joinCode: "AB3X7K" }

Response:
{
  "classId": "uuid",
  "className": "Period 3 Math",
  "teacherName": "Ms. Smith"
}
```

### View My Classes

```
GET /api/classes/me

Response:
{
  "classes": [
    {
      "classId": "uuid",
      "name": "Period 3 Math",
      "teacherName": "Ms. Smith",
      "pendingAssignments": 2
    }
  ]
}
```

## Parent Workflow

### Link to Student Account

```
POST /api/auth/link-child
Body: { childEmail: "student@school.com", relationship: "parent" }

Response: { linkedStudentId: "uuid", studentName: "Student Name" }
```

The student receives a notification (email or in-app) to confirm the link. Once confirmed, the parent can access the child's progress dashboard.

### View Child Progress

See `02-modules/reporting.md` — GET /api/dashboard/child.

## Teacher Dashboard Data Points

The teacher dashboard (GET /api/dashboard/class/{classId}) surfaces:

| Data Point | Source |
|---|---|
| Class average score | Aggregated from WorksheetAttempt |
| Students below 60% | Flagged from precomputed avgScore |
| Top topics attempted | Most frequent topics in class attempts |
| Assignment completion rate | Assignments vs completed WorksheetAttempts |
| Individual student drill-down | GET /api/dashboard/student/{studentId} |
| Class streak | Days any student in the class completed work |

## Parent Dashboard Data Points

The parent dashboard (GET /api/dashboard/child) surfaces:

| Data Point | Source |
|---|---|
| Child's overall average | precomputed avgScore |
| Subject breakdown | subjectAvgScores map |
| Weak areas | weakAreas list |
| Strong areas | strongAreas list |
| Recent attempts | Last 5 WorksheetAttempts |
| Current streak | streak field |
| Pending assignments | Assignments from class memberships |

## API Endpoints

See `04-api-contracts/reporting-api.md` for full schemas.

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | /api/classes | Bearer | teacher | Create class |
| GET | /api/classes/me | Bearer | student | List my classes |
| GET | /api/classes/{id} | Bearer | teacher | Get class details |
| GET | /api/classes/{id}/students | Bearer | teacher | List class students |
| POST | /api/classes/{id}/assignments | Bearer | teacher | Assign worksheet |
| POST | /api/classes/join | Bearer | student | Join class by code |
| DELETE | /api/classes/{id}/students/{sid} | Bearer | teacher | Remove student |
| POST | /api/auth/link-child | Bearer | parent | Link to student |

## Acceptance Criteria

**AC-1:** Given a teacher creates a class, when POST /api/classes is called, then a classId and 6-character joinCode are returned.

**AC-2:** Given a student uses a valid joinCode, when POST /api/classes/join is called, then a ClassMembership record is created and the student appears in the teacher's class roster.

**AC-3:** Given a teacher assigns a worksheet to a class, when POST /api/classes/{id}/assignments is called, then all enrolled students see the assignment in GET /api/classes/me.

**AC-4:** Given a parent sends a link request with the student's email, when the student confirms, then GET /api/dashboard/child returns the student's progress data.

**AC-5:** Given a student leaves a class, when DELETE removes their membership, then they no longer receive new assignments from that class and their existing completion data is preserved.

**AC-6:** Given a teacher archives a class, when PATCH /api/classes/{id} sets archivedAt, then the class no longer appears in student GET /api/classes/me but historical data is preserved.
