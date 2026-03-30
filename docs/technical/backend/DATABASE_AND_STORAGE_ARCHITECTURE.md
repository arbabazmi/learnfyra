# Database & Data Flow Architecture

**Date:** March 26, 2026  
**Status:** Current Implementation  
**Focus Area:** DynamoDB, S3 Storage, Data Models

---

## 1. Storage Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    LEARNFYRA STORAGE STRATEGY                        │
├──────────────────────────────────────────────────────────────────────┤

┌─────────────────────┐              ┌──────────────────────────────┐
│  DynamoDB Tables    │              │  S3 Buckets                  │
│  (Semi-structured)  │              │  (Object Storage)            │
│                     │              │                              │
│  • Users (auth)     │              │  • worksheets                │
│  • Classes          │              │    (PDFs, docs, JSON)        │
│  • Submissions      │              │                              │
│  • Progress         │              │  • Frontend                  │
│  • Rewards          │              │    (HTML, CSS, JS, images)   │
│  • Memberships      │              │                              │
│                     │              │  • Logs                      │
│ On-Disk Fallback:   │              │    (CloudWatch → S3)         │
│ • data-local/       │              │                              │
│   users.json        │              │                              │
│   classes.json      │              │                              │
│   memberships.json  │              │                              │
│                     │              │                              │
└─────────────────────┘              └──────────────────────────────┘
        │                                    │
        └────────────────┬───────────────────┘
                         │
           ┌─────────────┴──────────────┐
           │                            │
           ▼                            ▼
    ┌─────────────┐           ┌────────────────┐
    │  Caching    │           │  Archival &    │
    │  (TTL=1hr)  │           │  Lifecycle     │
    │             │           │  (7-day expiry)│
    │ Last read   │           │                │
    │ Last written│           │ Move to        │
    │ Ttl expires │           │ Glacier after  │
    └─────────────┘           │ 90 days        │
                              └────────────────┘
```

---

## 2. DynamoDB Table Schemas

```
┌──────────────────────────────────────────────────────────────────────┐
│                      USERS Table (Authentication)                    │
├──────────────────────────────────────────────────────────────────────┤

Partition Key: email (String, required)
Sort Key: None
TTL: None (persist indefinitely)

Attributes:
┌─────────────────────────┬──────────┬─────────────────────────────────┐
│ Attribute               │ Type     │ Description                     │
├─────────────────────────┼──────────┼─────────────────────────────────┤
│ email (PK)              │ String   │ Unique user identifier          │
│ userId                  │ String   │ UUID v4                        │
│ hashedPassword          │ String   │ bcrypt hash (if email/pwd auth) │
│ firstName               │ String   │ User's first name               │
│ lastName                │ String   │ User's last name                │
│ role                    │ String   │ Super-Admin|Teacher|Student|Parent│
│ profilePicUrl           │ String   │ Optional profile picture S3 URL │
│ createdAt               │ Number   │ Unix timestamp (ms)             │
│ updatedAt               │ Number   │ Last modified timestamp         │
│ lastLoginAt             │ Number   │ Last login (tracking)           │
│ isActive                │ Boolean  │ Account status                  │
│ oauthProviders          │ Map      │ { google, microsoft, etc }      │
│ emailVerified           │ Boolean  │ Email confirmation status       │
│ twoFactorSecret         │ String   │ Optional 2FA TOTP secret        │
│ preferences             │ Map      │ { theme, notifications, etc }   │
│ schoolName              │ String   │ (teacher/student)              │
│ gradeLevel              │ String   │ (teacher/student)              │
│ studentUnitCode         │ String   │ (student) - joins class        │
│ parentEmail             │ String   │ (student) - parent contact      │
└─────────────────────────┴──────────┴─────────────────────────────────┘

GSI #1: userId-index
  Partition Key: userId
  Use: Query by UUID instead of email (API internal lookups)

INDEXES:
  - Global Secondary Index on role (range query by role)
  - Global Secondary Index on createdAt (time-range queries)
  - TTL: None (user accounts persist)

RCU/WCU: 10/10 on-demand (scaling with traffic)


┌──────────────────────────────────────────────────────────────────────┐
│                    CLASSES Table (Teacher/Classroom)                 │
├──────────────────────────────────────────────────────────────────────┤

Partition Key: classId (String, UUID v4)
Sort Key: None
TTL: None

Attributes:
┌──────────────────────┬──────────┬─────────────────────────────────┐
│ Attribute            │ Type     │ Description                     │
├──────────────────────┼──────────┼─────────────────────────────────┤
│ classId (PK)         │ String   │ UUID v4                        │
│ teacherId            │ String   │ FK to Users.userId             │
│ className            │ String   │ e.g., "3rd Grade Math - Period 2"│
│ gradeLevel           │ Number   │ 1-10                            │
│ subject              │ String   │ Math, ELA, Science, Social      │
│ joinCode             │ String   │ Easy join code for students     │
│ studentIds           │ List     │ [userId1, userId2, ...]        │
│ worksheetIds         │ List     │ [worksheetId1, worksheetId2] (LIMIT 80KB)│
│ createdAt            │ Number   │ Unix timestamp                  │
│ updatedAt            │ Number   │ Last modified                   │
│ isActive             │ Boolean  │ Archive/active status           │
│ settings             │ Map      │ { discussionEnabled, etc }      │
│ rosters              │ Map      │ { importedAt, source, etc }     │
└──────────────────────┴──────────┴─────────────────────────────────┘

GSI #1: teacherId-index
  Partition Key: teacherId
  Use: Query all classes for a teacher

LIMIT WARNING: worksheetIds list capped at 80KB (~1000 worksheet IDs)
  Solution: If class > 1000 worksheets, use separate Assignments table

RCU/WCU: 10/10 on-demand


┌──────────────────────────────────────────────────────────────────────┐
│                 SUBMISSIONS Table (Student Work)                     │
├──────────────────────────────────────────────────────────────────────┤

Partition Key: worksheetId (String)
Sort Key: studentId (String)
TTL: None
Notes: Composite key allows fast lookup (worksheet) + secondary filter (student)

Attributes:
┌──────────────────────┬──────────┬──────────────────────────────────┐
│ Attribute            │ Type     │ Description                      │
├──────────────────────┼──────────┼──────────────────────────────────┤
│ worksheetId (PK)     │ String   │ UUID v4                         │
│ studentId (SK)       │ String   │ UUID v4                         │
│ classId              │ String   │ FK to Classes                   │
│ submittedAt          │ Number   │ Unix timestamp (completion time)│
│ score                │ Number   │ e.g., 8 (total points earned)  │
│ totalPoints          │ Number   │ e.g., 10 (total possible)       │
│ percentage           │ Number   │ 80 (percentage)                │
│ timeTaken            │ Number   │ Seconds (845)                   │
│ timed                │ Boolean  │ Was timed mode?                 │
│ answers              │ List     │ [{number, answer}, ...]         │
│ results              │ List     │ [{number, correct, points}, ...] │
│ flagged              │ Boolean  │ Suspicious activity?            │
│ teacherNotes         │ String   │ Optional feedback               │
│ retryCount           │ Number   │ Number of attempts              │
│ bestScore            │ Number   │ Highest score if multiple tries │
└──────────────────────┴──────────┴──────────────────────────────────┘

GSI #1: studentId-index
  Partition Key: studentId
  Sort Key: submittedAt (descending)
  Use: Get all submissions by a student, sorted by date

GSI #2: classId-index
  Partition Key: classId
  Sort Key: submittedAt
  Use: Get all class submissions for analytics

RCU/WCU: 20/20 on-demand (write-heavy during submission)


┌──────────────────────────────────────────────────────────────────────┐
│                PROGRESS Table (Student Mastery Tracking)             │
├──────────────────────────────────────────────────────────────────────┤

Partition Key: studentId (String)
Sort Key: topic (String, e.g., "Grade3.Math.Multiplication")
TTL: None

Attributes:
┌──────────────────────┬──────────┬──────────────────────────────────┐
│ Attribute            │ Type     │ Description                      │
├──────────────────────┼──────────┼──────────────────────────────────┤
│ studentId (PK)       │ String   │ UUID v4                         │
│ topic (SK)           │ String   │ Grade.Subject.Topic             │
│ masteryLevel         │ Number   │ 0-100 (proficiency %)           │
│ attemptCount         │ Number   │ Total worksheets on this topic  │
│ successCount         │ Number   │ Successful attempts (>70%)      │
│ averageScore         │ Number   │ Mean of attempts                │
│ lastAttemptAt        │ Number   │ Most recent worksheet date      │
│ nextRecommendedLevel │ String   │ Easy|Medium|Hard (adaptive)     │
│ skillGaps            │ List     │ Sub-topics to reinforce         │
│ locked               │ Boolean  │ Prerequisite not met?           │
└──────────────────────┴──────────┴──────────────────────────────────┘

GSI #1: topic-index
  Use: Find all students mastering a specific skill (class-wide analysis)

RCU/WCU: 5/5 on-demand


┌──────────────────────────────────────────────────────────────────────┐
│                  REWARDS Table (Gamification)                        │
├──────────────────────────────────────────────────────────────────────┤

Partition Key: studentId (String)
Sort Key: None
TTL: None

Attributes:
┌──────────────────────┬──────────┬──────────────────────────────────┐
│ Attribute            │ Type     │ Description                      │
├──────────────────────┼──────────┼──────────────────────────────────┤
│ studentId (PK)       │ String   │ UUID v4                         │
│ totalPoints          │ Number   │ Lifetime points earned          │
│ badges               │ List     │ ["Perfect10","Speedster", ...]  │
│ tier                 │ String   │ Bronze|Silver|Gold|Platinum     │
│ streakDays           │ Number   │ Consecutive days solving        │
│ achievements         │ Map      │ { achievementId: unlock_date }  │
│ claimedRewards       │ List     │ Claimed tangible rewards        │
│ lastActivityAt       │ Number   │ Last engagement time            │
│ leaderboardRank      │ Number   │ Current class rank              │
└──────────────────────┴──────────┴──────────────────────────────────┘

RCU/WCU: 10/10 on-demand


┌──────────────────────────────────────────────────────────────────────┐
│         MEMBERSHIPS Table (Class Enrollment Tracking)                │
├──────────────────────────────────────────────────────────────────────┤

Partition Key: studentId-classId (composite: "{studentId}#{classId}")
Sort Key: joinedAt (Number, UTC ms)

Attributes:
┌──────────────────────┬──────────┬──────────────────────────────────┐
│ Attribute            │ Type     │ Description                      │
├──────────────────────┼──────────┼──────────────────────────────────┤
│ studentId            │ String   │ UUID v4                         │
│ classId              │ String   │ UUID v4                         │
│ joinedAt             │ Number   │ Enrollment date (timestamp)     │
│ role                 │ String   │ Student|delegate (future TA)    │
│ isActive             │ Boolean  │ Still enrolled?                 │
│ leftAt               │ Number   │ Disenrollment date (if left)    │
└──────────────────────┴──────────┴──────────────────────────────────┘

RCU/WCU: 5/5 on-demand
```

---

## 3. S3 Bucket Structure & Storage Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                   S3 BUCKET: WORKSHEETS (Private)                    │
├──────────────────────────────────────────────────────────────────────┤

Bucket Name: learnfyra-{env}-s3-worksheets

Key Structure:
───────────────

worksheets/{year}/{month}/{day}/{worksheetId}/
  ├── worksheet.pdf                    [Immutable, public via presigned URL]
  ├── worksheet.docx                   [Immutable, public via presigned URL]
  ├── worksheet.html                   [Immutable, public via presigned URL]
  ├── answer-key.pdf                   [Private to teacher only]
  ├── answer-key.docx                  [Private to teacher only]
  ├── answer-key.html                  [Private to teacher only]
  ├── metadata.json                    [Scheme: teacherId, createdAt, etc]
  └── solve-data.json                  [Schema: questions + answers for scoring]

Bucket Settings:
  • Block All Public Access: YES (use presigned URLs only)
  • Versioning: ON (prod only)
  • Server-Side Encryption: AES-256 (default)
  • Lifecycle Rules:
      - worksheets/* expiry: 7 days → delete
      - answer-key/* expiry: 90 days → delete
      - archive/* → Glacier: 365 days, then delete after 5 years
  
  • Access Logs: Enabled (log to separate learnfyra-{env}-s3-logs)
  • CORS Policy (allows presigned URL downloads from CloudFront)
  • Replication: ON (prod only, cross-region backup)

Object Naming Convention:
  • All lowercase
  • Hyphens only (no underscores)
  • Date-based partitioning for fast cleanup


PRESIGNED URL GENERATION (backend/handlers/downloadHandler.js):

const s3Client = new S3Client({
  region: process.env.AWS_REGION
});

const presignedUrl = await getSignedUrl(
  s3Client,
  new GetObjectCommand({
    Bucket: process.env.WORKSHEET_BUCKET_NAME,
    Key: `worksheets/2026/03/25/${worksheetId}/worksheet.pdf`
  }),
  { expiresIn: 24 * 3600 }  // 24 hours expiry
);

// Return to teacher (e.g., "https://s3.amazonaws.com/...?...")


┌──────────────────────────────────────────────────────────────────────┐
│                    S3 BUCKET: FRONTEND (Public)                      │
├──────────────────────────────────────────────────────────────────────┤

Bucket Name: learnfyra-{env}-s3-frontend

Key Structure:
───────────────

/
├── index.html                         [Teacher app home]
├── login.html                         [Auth page]
├── solve.html                         [Student solve interface]
├── css/
│   ├── styles.css                     [Main styles]
│   └── solve.css                      [Solve page styles]
├── js/
│   ├── app.js                         [Teacher SPA logic]
│   ├── solve.js                       [Student solve logic]
│   ├── auth.js                        [Authentication hooks]
│   └── api.js                         [API client library]
├── images/
│   ├── logo.svg
│   ├── icons/
│   └── backgrounds/
├── teacher/
│   ├── dashboard.html
│   ├── class-management.html
│   └── js/teacher-ui.js
└── student/
    ├── dashboard.html
    ├── my-classes.html
    └── js/student-ui.js

Bucket Settings:
  • Block All Public Access: NO (CloudFront public)
  • Static Website Hosting: ENABLED
  • Index Document: index.html
  • Error Document: 404.html (via CloudFront)
  • Versioning: ON
  • Encryption: AES-256
  • Access Logs: Enabled
  • Cache Control: max-age=31536000 (CSS/JS/images)
  • CloudFront Origin: YES (distribution in front)


┌──────────────────────────────────────────────────────────────────────┐
│                     S3 BUCKET: LOGS (Private)                        │
├──────────────────────────────────────────────────────────────────────┤

Bucket Name: learnfyra-{env}-s3-logs

Receives logs from:
  • API Gateway access logs
  • S3 worksheets bucket access logs
  • CloudFront access logs
  • Lambda logs (via CloudWatch → S3 export)

Key Structure:
───────────────

api-gateway-logs/{date}/
s3-access-logs/{date}/
cloudfront-logs/{date}/
lambda-logs/{date}/

Settings:
  • Private (no public access)
  • Lifecycle: 30-day retention → delete
  • Encryption: AES-256
```

---

## 4. Data Access Patterns & Query Patterns

```
┌──────────────────────────────────────────────────────────────────────┐
│                     QUERY PATTERN REFERENCE                          │
├──────────────────────────────────────────────────────────────────────┤

USE CASE: Teacher views class roster
──────────────────────────────────────
  Query:    USERS table (GSI: classId-index)
  Pattern:  Partition: classId = "class-uuid"
            Sort: createdAt DESC (newest first)
  Result:   ~25 students per class
  RCU Cost: ~1-2 RCU


USE CASE: Student submits worksheet answers
─────────────────────────────────────────────
  Op 1:   Write SUBMISSIONS (worksheetId, studentId)
  Op 2:   Update PROGRESS (masteryLevel calculation)
  Op 3:   Update REWARDS (points, streak)
  Cost:   ~3 WCU per submission
  Latency: ~100-200ms


USE CASE: Teacher views class analytics
─────────────────────────────────────────
  Query 1: SUBMISSIONS (GSI: classId-index)
           Filter: summittedAt BETWEEN [start, end]
  Query 2: PROGRESS (GSI: topic-index)
           Filter: studentIds IN [...]
  Result:  Aggregated score distribution, mastery by skill
  RCU:     ~5-10 RCU (depending on class size)


USE CASE: Student views own progress
──────────────────────────────────────
  Query:   PROGRESS table
           Partition: studentId
           Sort key range: topic BEGINS_WITH "Grade3" (optional filter)
  Result:  Topics with mastery levels
  RCU:     ~1 RCU


USE CASE: Dashboard leaderboard (class)
───────────────────────────────────────
  Query 1: REWARDS (for all classmates) or scan PROGRESS
  Query 2: Sort by totalPoints DESC, limit TOP 10
  Result:  Student names + scores + ranks
  RCU:     ~5-10 RCU (scan is expensive; consider caching TTL=1h)


OPTIMIZATION STRATEGIES
───────────────────────

✓ Use GSIs (Global Secondary Indexes) for common queries
✓ Cache frequent reads (TTL=1 hour) in Lambda memory
✓ Batch WriteItem for multiple updates (max 25 items)
✓ Use Query over Scan whenever possible (Scan is ~5x more expensive)
✓ Filter on non-key attributes AFTER query (reduces consumed RCU)
✓ Consider DynamoDB Streams for real-time sync to Elasticsearch (future)
✓ Archive old submissions to S3 (standard Glacier) after 90 days (lifecycle)
```

---

## 5. Local Storage Fallback (Developer Mode)

```
LOCAL STORAGE DIRECTORY: data-local/
──────────────────────────────────

Purpose: Development mode uses JSON files instead of DynamoDB
         (no AWS account required for local testing)

Files:
  • users.json                     [User profiles & auth]
  • classes.json                   [Class rosters]
  • memberships.json               [Student-class enrollments]
  • submissions.json               [Student answer submissions]
  • progress.json                  [Student mastery tracking]
  • rewards.json                   [Gamification data]
  • parentLinks.json               [Parent-student relationships]
  • certificates.json              [Completion certificates]

Adapter Pattern (src/db/):
──────────────────────

  src/db/dynamoAdapter.js          ← Production (DynamoDB)
  src/db/localAdapter.js           ← Development (JSON files)
  src/db/schema.js                 ← Shared validation

In server.js:

  const dbAdapter = process.env.DATABASE_TYPE === 'local'
    ? new LocalAdapter()
    : new DynamoAdapter();

  // Usage is identical:
  const user = await dbAdapter.getUser(email);
  await dbAdapter.saveSubmission(data);

Development servers use LOCAL by default, AWS Lambda always uses DYNAMO.
```

---

**Document Status:** Production-Ready  
**Last Updated:** March 26, 2026  
**References:** AWS DynamoDB Best Practices, Design Patterns
