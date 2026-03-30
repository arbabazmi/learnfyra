# M05 — Progress & Reporting

## Module Summary

M05 provides progress tracking and reporting for students, teachers, and parents. It aggregates worksheet attempt data from DynamoDB WorksheetAttempt table and surfaces insights through role-specific dashboards.

## User Story Summary

- **Student:** I want to see my scores over time so I can track my improvement.
- **Teacher:** I want to see class performance by topic so I can identify struggling students.
- **Parent:** I want to see my child's progress so I can support their learning.

## Precomputed Aggregates

To support fast dashboard queries, aggregates are precomputed and stored in the Users table after each WorksheetAttempt write:

| Field | Computed From | Stored In |
|---|---|---|
| totalAttempts | count of all attempts | Users table |
| avgScore | mean percentage across all attempts | Users table |
| streak | consecutive calendar days with at least 1 attempt | Users table |
| lastActive | most recent completedAt timestamp | Users table |
| weakAreas | topics with avgScore < 60% | Users table (list) |
| strongAreas | topics with avgScore > 85% | Users table (list) |
| subjectAvgScores | avgScore per subject | Users table (map) |

These fields are updated **inline within `submitHandler`** (not via DynamoDB Streams) after each attempt, by calling `aggregator.js`.

### aggregator.js — Concurrent Write Safety (ADR-013)

`avgScore` is updated using the **incremental mean formula** applied atomically via a DynamoDB `UpdateItem` with `ConditionExpression`:

```
newAvg = oldAvg + (newPercentage - oldAvg) / newTotalAttempts
```

The `UpdateExpression` uses DynamoDB `ADD` for `totalAttempts` (atomic counter) and sets `avgScore` using the formula above. A `ConditionExpression` on the pre-update `totalAttempts` value prevents two concurrent submits from corrupting the average:

```javascript
// aggregator.js pattern
await dynamodb.update({
  Key: { userId },
  UpdateExpression: 'ADD totalAttempts :one SET avgScore = :newAvg, lastActive = :now',
  ConditionExpression: 'totalAttempts = :expectedTotal',
  ExpressionAttributeValues: {
    ':one': 1,
    ':expectedTotal': currentTotal,
    ':newAvg': currentAvg + (newPct - currentAvg) / (currentTotal + 1),
    ':now': new Date().toISOString()
  }
});
```

If the condition fails (another write changed `totalAttempts`), `aggregator.js` retries using `withRetry` from `src/utils/retryUtils.js` (max 3 retries, exponential backoff).

**Local dev:** The same `UpdateItem` call runs against `dynamodb-local` on `http://localhost:8000`. Set `DYNAMODB_ENDPOINT=http://localhost:8000` in `.env` to route the DynamoDB client to local Docker.

## Student Progress API

### GET /api/progress/me

Returns the authenticated student's full progress profile.

Response:
```json
{
  "userId": "uuid",
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
      "worksheetId": "uuid",
      "topic": "Multiplication",
      "score": 9,
      "totalPoints": 10,
      "percentage": 90,
      "completedAt": "2026-03-28T14:00:00Z"
    }
  ]
}
```

### GET /api/progress/history

Returns paginated attempt history for the authenticated student.

Query params: `limit` (default 20), `lastKey` (DynamoDB pagination cursor).

## Teacher Dashboard API

### GET /api/dashboard/class/{classId}

Returns class-level analytics for a teacher.

Response includes:
- Class average score by subject and topic
- List of students with their avgScore and recent activity
- Students below 60% average (flagged for intervention)
- Most attempted topics in the class
- Worksheet assignment list with completion rates

### GET /api/dashboard/student/{studentId}

Returns a single student's progress profile (teacher view — includes all attempt data).

## Parent Dashboard API

### GET /api/dashboard/child

Returns the authenticated parent's linked child's progress profile. Same structure as student's /api/progress/me but accessed via parent token.

Parents can only access their linked child's data. The link is stored in the Users table (`linkedStudentId` field on parent records).

## Completion Certificates (MVP)

Phase 1 includes a basic completion certificate generated when a student achieves:
- 80%+ score on a worksheet attempt, OR
- Completes a teacher-assigned worksheet

Certificate generation:
```javascript
// POST /api/certificates/generate
// {worksheetId, attemptId, studentId}
// Returns: certificate PDF download URL (stored in S3)
```

Certificate PDF content:
- Student name (from Users table)
- Worksheet title
- Score achieved
- Date completed
- Learnfyra logo/branding
- Certificate ID (UUID, for basic verification)

Certificate storage: `s3://learnfyra-{env}-s3-worksheets/certificates/{userId}/{uuid}.pdf`

Phase 2 certificates: persistent verifiable certificates with QR code, optional branding, and public verification URL.

## Certificates DynamoDB Table

```
Table: LearnfyraCertificates-{env}
PK: certificateId (String, UUID v4)
```

| Attribute | Type | Description |
|---|---|---|
| certificateId | String | UUID v4, PK |
| userId | String | Student user ID (GSI partition key) |
| worksheetId | String | Worksheet the certificate is for |
| attemptId | String | The specific attempt |
| score | Number | Score achieved |
| percentage | Number | Percentage achieved |
| issuedAt | String | ISO-8601 |
| studentName | String | Student display name at time of issue |
| worksheetTitle | String | Worksheet title |
| s3Key | String | S3 key for certificate PDF |

Issuance rule: one certificate per worksheetId per student (subsequent attempts do not re-issue).

## Phase 2 — Rewards & Gamification (Deferred)

The following is scoped to Phase 2 and is not built in Phase 1:

**Points System:**
- Base points: 10 per completed worksheet
- Accuracy bonus: +5 for >= 90%, +3 for >= 75%, +1 for >= 60%
- Speed bonus: +3 for completing timed mode under 80% of time limit
- Streak multiplier: 1.5x after 3 consecutive days, 2x after 7 days
- Subject mastery bonus: +20 when strong area threshold (85%) first achieved

**Badge Categories:**
- Subject mastery badges (Math Wizard, Science Explorer, etc.)
- Streak badges (3-day, 7-day, 30-day)
- Score badges (Perfect Score, High Achiever)
- Activity badges (First Worksheet, 10 Worksheets, 50 Worksheets)

**Badge precomputed fields** (stored in Users table, updated after each attempt):
- badgeCount, recentBadges[], highestStreak, totalPoints

These fields are not implemented in Phase 1 but the Users table schema includes placeholder attributes for seamless Phase 2 addition.

## File Structure

```
backend/handlers/
  progressHandler.js   — GET /api/progress/me, GET /api/progress/history
  dashboardHandler.js  — GET /api/dashboard/class/:id, GET /api/dashboard/student/:id
  certificateHandler.js — POST /api/certificates/generate, GET /api/certificates/:id

src/reporting/
  aggregator.js        — computes and updates precomputed fields after each attempt
  certificateBuilder.js — builds certificate PDF content
```

## Acceptance Criteria

**AC-1:** Given a student has completed 5 worksheets, when they call GET /api/progress/me, then the response includes totalAttempts=5, avgScore, streak, weakAreas, and strongAreas.

**AC-2:** Given a teacher calls GET /api/dashboard/class/{classId}, when the class has 3 students, then the response includes all 3 students with their individual avgScore and a class average.

**AC-3:** Given a student achieves 80%+ on a worksheet, when scoring completes, then a certificate record is created in DynamoDB and the certificate PDF is written to S3.

**AC-4:** Given a parent is linked to a student account, when they call GET /api/dashboard/child, then they receive the same progress data as the student's /api/progress/me response.

**AC-5:** Given a student's avgScore on "Fractions" drops below 60%, when the teacher views the class dashboard, then the student appears in the "needs intervention" list.

**AC-6:** Given a parent tries to access another student's progress (not their linked child), when they call GET /api/dashboard/child, then they receive 403 Forbidden.
