# Learnfyra — Phase 1 Requirements & Module Breakdown
**Document ID:** LFR-MODULE-001  
**Author:** BA Agent  
**Date:** March 25, 2026  
**Status:** Requirements Specification  
**Effort Mode:** Standard  

---

## Executive Summary

This document defines the complete Phase 1 module structure for Learnfyra, an AI-powered worksheet generation platform for Grades 1-10 aligned with USA curriculum standards (CCSS/NGSS). Phase 1 establishes the foundational authentication, worksheet generation, online solving, and progress tracking capabilities required for a production-ready educational platform.

**Phase 1 Goals:**
- Enable multi-role authentication (student, teacher, parent) with OAuth and local accounts
- Build intelligent worksheet generation with question bank and reuse
- Support both online (real-time) and offline (print + manual upload) workflows
- Track student progress and identify learning gaps
- Deploy on AWS with serverless architecture

**Out of Phase 1:** Rewards/gamification, admin console, advanced analytics, school district features

---

## Table of Contents
1. [Module Overview](#1-module-overview)
2. [User Stories by Role](#2-user-stories-by-role)
3. [Functional Requirements per Module](#3-functional-requirements-per-module)
4. [Acceptance Criteria](#4-acceptance-criteria)
5. [Phase 1 Scope Boundaries](#5-phase-1-scope-boundaries)
6. [Dependencies & Build Sequence](#6-dependencies--build-sequence)
7. [Open Questions](#7-open-questions)

---

## 1. Module Overview

### Module 1: Authentication & Identity Management (AUTH)
**Purpose:** Provide secure multi-role login with OAuth and local accounts  
**Scope:**
- Student, teacher, parent role support
- Google OAuth + Microsoft/GitHub OAuth (any public provider)
- Local email/password accounts as fallback
- Email verification for local accounts
- JWT-based session management
- Auth gate for online features

**Auth Environment Configuration (Google OAuth metadata):**

| Environment | Client ID | Project ID | Auth URL | Token URL | Cert URL | JavaScript Origins |
|---|---|---|---|---|---|---|
| Prod | 1079696386286-edsmfmdk6j8073qnm05ui6b2c6o655o.apps.googleusercontent.com | learnfyra | https://accounts.google.com/o/oauth2/auth | https://oauth2.googleapis.com/token | https://www.googleapis.com/oauth2/v1/certs | https://www.learnfyra.com, https://admin.learnfyra.com |
| Dev | 1079696386286-m95l3vrmh157sgji4njii0afftoglc9b.apps.googleusercontent.com | learnfyra | https://accounts.google.com/o/oauth2/auth | https://oauth2.googleapis.com/token | https://www.googleapis.com/oauth2/v1/certs | https://dev.learnfyra.com |
| QA | 1079696386286-hjn155lvt8sr4cc0g1e3f8mfvs6mgbk.apps.googleusercontent.com | learnfyra | https://accounts.google.com/o/oauth2/auth | https://oauth2.googleapis.com/token | https://www.googleapis.com/oauth2/v1/certs | TBD |

**Security Note:**
- OAuth client secrets and signing keys MUST be stored outside this repository (AWS Secrets Manager or equivalent secure store).
- Only non-secret OAuth metadata (client ID, endpoints, allowed origins) is documented here.

**Key Services:** AWS Cognito, Lambda Authorizer, SES/SendGrid  
**Data Storage:** DynamoDB Users table  

---

### Module 2: Worksheet Generation Engine (GENERATOR)
**Purpose:** Generate curriculum-aligned questions with AI, reuse via question bank  
**Scope:**
- Multi-model AI strategy (AWS Bedrock: Nova Micro default, Claude Haiku/Sonnet advanced)
- Question Bank (DynamoDB) for reuse and cost optimization
- Five-stage pipeline: Request → Check Bank → Generate → Validate → Assemble
- Support 7 question types: multiple-choice, true-false, fill-in-blank, short-answer, matching, show-your-work, word-problem
- Standards alignment verification (CCSS/NGSS)
- Metadata-driven assembly and randomization

**Key Services:** AWS Bedrock (Anthropic, Titan, Nova), Step Functions, DynamoDB (Question Bank + Worksheets), S3  
**Data Storage:** Questions table, Worksheets table, S3 JSON files  

**Sub-Modules:**
- **2.1 Question Bank** — Storage, lookup, deduplication
- **2.2 AI Generation** — Multi-model orchestration, prompt management
- **2.3 Validation** — Standards alignment check, quality scoring
- **2.4 Assembly Engine** — Randomization, difficulty balancing
- **2.5 Rendering** — HTML, PDF (Puppeteer), DOCX export

---

### Module 3: Online Solve & Submission (SOLVE)
**Purpose:** Enable students to complete worksheets online with instant scoring  
**Scope:**
- Interactive solve UI with per-question-type input mapping
- Timed mode (countdown) vs untimed mode
- Auto-submit on timer expiration
- Client-side answer capture and submission
- Server-side scoring engine with case-insensitive matching
- Results page with correct/incorrect breakdown + explanations

**Key Services:** Lambda (solveHandler, submitHandler), S3 (solve-data.json), DynamoDB (WorksheetAttempts)  
**Data Storage:** S3 worksheet JSON, DynamoDB attempts table  

**Sub-Modules:**
- **3.1 Solve UI** — Question rendering, answer inputs, timer
- **3.2 Scoring Engine** — Answer comparison per question type
- **3.3 Result Builder** — Score calculation, per-question feedback

---

### Module 4: Progress Tracking & Reporting (PROGRESS)
**Purpose:** Store student attempts and surface learning gaps  
**Scope:**
- Persistent storage of all online attempts linked to student + class + subject
- Offline workflow: teacher/parent uploads scores for printed worksheets
- Student dashboard: past attempts, average score, weak topics
- Teacher dashboard: class analytics, per-student breakdown, weak topic identification
- Parent dashboard: single-child view with weak topic recommendations

**Key Services:** DynamoDB (WorksheetAttempts, Classes, ClassMemberships), Lambda analytics functions  
**Data Storage:** DynamoDB with GSI for class/subject queries  

**Sub-Modules:**
- **4.1 Attempt Storage** — Write path for online/offline results
- **4.2 Student Dashboard** — Personal analytics and history
- **4.3 Teacher Dashboard** — Class management, multi-student analytics
- **4.4 Parent Dashboard** — Child-specific progress view
- **4.5 Offline Score Upload** — CSV import for printed worksheets

---

### Module 5: Class & User Management (CLASSES)
**Purpose:** Enable teachers to organize students and assign worksheets  
**Scope:**
- Teacher creates classes with invite codes
- Students join via 6-character alphanumeric code
- Teacher assigns worksheets to class or individual students
- Students can be in multiple classes for same subject
- Parent links to child accounts (parent-child relationship)

**Key Services:** DynamoDB (Classes, ClassMemberships, ParentStudentLinks)  
**Data Storage:** DynamoDB relational tables  

---

### Module 6: Infrastructure & Deployment (INFRA)
**Purpose:** AWS CDK-managed infrastructure with multi-environment support  
**Scope:**
- S3 buckets: worksheets (private), frontend (public), logs
- Lambda functions: generate, solve, submit, auth, progress, class
- API Gateway: REST API with CORS, rate limiting
- CloudFront: CDN for frontend + API caching
- DynamoDB: 5 tables (Users, Questions, Worksheets, WorksheetAttempts, Classes)
- Cognito: User pools for OAuth + local accounts
- Secrets Manager: API keys, OAuth secrets
- CloudWatch: Metrics, logs, alarms
- CI/CD: GitHub Actions (dev/staging/prod)

**Key Services:** All AWS services orchestrated via CDK  
**Environments:** dev, staging, prod  

---

## 2. User Stories by Role

### 2.1 Student (Guest — No Account)
```
As a guest student,
I want to generate and download worksheets without signing up,
So that I can practice immediately without creating an account.

As a guest student,
I want to see a "Sign in to track progress" banner,
So that I understand the benefit of creating an account.
```

### 2.2 Student (Authenticated)
```
As a student,
I want to log in with my Google account,
So that I don't need to remember another password.

As a student with no OAuth access,
I want to create an account with email and password,
So that I can still use online features.

As a logged-in student,
I want to solve worksheets online in timed or untimed mode,
So that I can practice under test conditions or at my own pace.

As a student,
I want to see my score immediately after submitting,
So that I get instant feedback on my understanding.

As a student,
I want to review which answers were correct/incorrect with explanations,
So that I can learn from my mistakes.

As a student,
I want to view all my past attempts on my dashboard,
So that I can track my improvement over time.

As a student,
I want to see my weak topics highlighted,
So that I know what to practice next.

As a student,
I want to join my teacher's class with an invite code,
So that my progress is visible to my teacher.
```

### 2.3 Teacher
```
As a teacher,
I want to create an account with Google or email/password,
So that I can manage my classes online.

As a teacher,
I want to create classes and generate invite codes,
So that students can easily join my class.

As a teacher,
I want to generate worksheets for specific topics and difficulty levels,
So that I can assign targeted practice.

As a teacher,
I want students' online solve results to be saved automatically,
So that I can monitor progress without manual data entry.

As a teacher,
I want to upload offline scores via CSV for printed worksheets,
So that paper-based practice is also tracked.

As a teacher,
I want to see class-wide analytics showing average scores and weak topics,
So that I can identify where my class needs help.

As a teacher,
I want to view individual student progress with topic mastery heatmaps,
So that I can provide personalized support.

As a teacher,
I want to export class analytics as CSV,
So that I can use data in my school's grading system.
```

### 2.4 Parent
```
As a parent,
I want to create an account and link to my child's student account,
So that I can monitor their learning at home.

As a parent,
I want to view my child's progress in simple language,
So that I understand their strengths and weaknesses.

As a parent,
I want to see recommended practice topics based on weak areas,
So that I know what to work on with my child.

As a parent,
I want to upload scores for worksheets my child completed offline,
So that all practice is captured in one place.

As a parent,
I want to generate worksheets targeting my child's weak topics,
So that I can provide effective at-home practice.
```

---

## 3. Functional Requirements per Module

### Module 1: Authentication & Identity Management

#### FR-AUTH-001: OAuth Provider Support
- System MUST support Google OAuth 2.0
- System MUST support at least one additional public OAuth provider (Microsoft, GitHub, Apple)
- System SHALL store provider-specific user IDs and map to internal userId
- System SHALL support multiple OAuth providers per user account (account linking)

#### FR-AUTH-002: Local Account Creation
- System MUST support email + password account creation
- Password MUST meet criteria: min 8 chars, 1 uppercase, 1 number, 1 special char
- System MUST hash passwords with bcrypt (cost factor 12)
- System MUST send email verification link via SES/SendGrid
- System SHALL block online solve until email verified

#### FR-AUTH-003: Role-Based Access Control
- System MUST support roles: student, teacher, parent
- System SHALL assign default role based on signup flow (student/teacher selection)
- System MUST enforce role-based permissions on all API endpoints
- Parent accounts SHALL require child account linking before dashboard access

#### FR-AUTH-004: Session Management
- System MUST issue JWT tokens with 7-day expiration
- System MUST refresh tokens on valid API requests
- System SHALL log out users after 30 days of inactivity
- System MUST implement Lambda Authorizer for all authenticated routes

#### FR-AUTH-005: Auth Gate for Online Features
- System MUST show "Sign in required" modal when guest clicks "Solve Online"
- Modal SHALL offer: Sign In (OAuth + local) or Continue as Guest (download only)
- System SHALL redirect authenticated users directly to solve page

---

### Module 2: Worksheet Generation Engine

#### FR-GEN-001: Question Bank Storage
- System MUST store generated questions in DynamoDB with schema:
  ```
  question_id (PK), grade, subject, topic, difficulty, type,
  question, options[], answer, explanation, standards[],
  model_used, token_cost, quality_score, created_at, reuse_count
  ```
- System SHALL deduplicate questions on insert (hash of question text + answer)
- System SHALL maintain request-scoped exclusion during worksheet assembly so the same student request/session does not receive repeated or near-duplicate questions
- System SHALL enforce a default future-session repeat cap of 10% for the same student at the same grade and difficulty
- System SHALL allow admin-configured repeat-cap overrides at student, teacher, or parent scope with valid range 0% to 100%
- System MUST support queries: by grade+subject+topic+difficulty+type

#### FR-GEN-002: Multi-Model AI Strategy
- System MUST default to AWS Bedrock Nova Micro for cost optimization
- System SHALL fallback to Claude Haiku if Nova fails quality validation
- System MAY use Claude Sonnet for advanced question types (show-your-work, word-problem)
- System MUST log model_used and token_cost for every generated question

#### FR-GEN-003: Five-Stage Generation Pipeline
1. **Request** — Accept grade, subject, topic, difficulty, questionCount
2. **Check Bank** — Query DynamoDB for existing questions, randomize selection, exclude duplicates already chosen for the current worksheet session
3. **Generate** — If insufficient, call Bedrock to generate only the remaining unique questions
4. **Validate** — Standards alignment check, answer format verification, duplicate/near-duplicate screening against already selected questions
5. **Assemble** — Combine bank + new questions, run final uniqueness check, save to S3 as worksheet JSON

#### FR-GEN-004: Standards Alignment
- System MUST embed CCSS codes for Math/ELA or NGSS codes for Science
- System SHALL reject questions with no matching standard
- System MUST display standards on answer key

#### FR-GEN-005: Question Type Support
System MUST support input/output for:
1. **multiple-choice** — 4 options (A/B/C/D), single correct answer
2. **true-false** — boolean answer
3. **fill-in-the-blank** — text input, case-insensitive match
4. **short-answer** — textarea, keyword-based scoring
5. **matching** — pairs, exact match per pair
6. **show-your-work** — textarea for steps + final answer input
7. **word-problem** — textarea for work + final answer input

#### FR-GEN-006: Worksheet Assembly
- System MUST randomize question order
- System SHALL balance difficulty (if "Mixed" selected): 40% easy, 40% medium, 20% hard
- System MUST calculate totalPoints = sum(question.points)
- System MUST estimate completion time = questionCount × 2 minutes (baseline)

#### FR-GEN-007: Export Formats
- System MUST generate: HTML, PDF (Puppeteer with headless Chrome), DOCX
- System MUST generate separate answer key files
- System SHALL store all files in S3 with 7-day expiration

---

### Module 3: Online Solve & Submission

#### FR-SOLVE-001: Solve Page Rendering
- System MUST render questions without answers/explanations
- System MUST map question type to UI input:
  - multiple-choice → radio buttons
  - true-false → radio buttons
  - fill-in-blank → text input
  - short-answer → textarea (max 500 chars)
  - matching → dropdown selects per pair
  - show-your-work → textarea + final answer input
  - word-problem → textarea + final answer input

#### FR-SOLVE-002: Timed vs Untimed Mode
- System MUST offer mode selection before solve starts
- Timed mode: countdown timer from worksheet.timerSeconds
- Untimed mode: no timer, submit button always enabled
- System SHALL auto-submit when timer reaches 0 (with confirmation modal)

#### FR-SOLVE-003: Answer Submission
- System MUST POST to /api/submit with:
  ```json
  {
    "worksheetId": "uuid",
    "studentId": "uuid",
    "answers": [{"number": 1, "answer": "B"}],
    "timeTaken": 845,
    "timed": true,
    "classId": "uuid" (optional)
  }
  ```

#### FR-SOLVE-004: Scoring Engine Rules
- **multiple-choice, true-false, matching** → exact match (case-insensitive)
- **fill-in-blank** → exact match (case-insensitive, trimmed)
- **short-answer** → keyword match (configurable per question)
- **show-your-work, word-problem** → score final answer only (partial credit Phase 2)

#### FR-SOLVE-005: Result Response
- System MUST return score + per-question breakdown:
  ```json
  {
    "totalScore": 8,
    "totalPoints": 10,
    "percentage": 80,
    "results": [
      {
        "number": 1,
        "correct": true,
        "studentAnswer": "B",
        "correctAnswer": "B",
        "explanation": "6 × 7 = 42",
        "pointsEarned": 1
      }
    ]
  }
  ```

#### FR-SOLVE-006: Auth Requirement
- System MUST require authentication for online solve
- System SHALL save attempt to DynamoDB with studentId on submit
- Guest users SHALL be blocked with redirect to auth modal

---

### Module 4: Progress Tracking & Reporting

#### FR-PROG-001: Attempt Storage Schema
DynamoDB WorksheetAttempts table:
```
PK: studentId#worksheetId#attemptTimestamp
Attributes:
  studentId, worksheetId, attemptNumber,
  grade, subject, topic, difficulty,
  classId (optional), assignedByTeacherId (optional),
  totalScore, totalPoints, percentage,
  answers[] → {number, studentAnswer, correctAnswer, isCorrect, pointsEarned},
  timeTaken, timedMode,
  createdAt, updatedAt
```
GSI-1: classId + subject + topic (for class analytics)  
GSI-2: studentId + subject + createdAt (for per-subject progress)

#### FR-PROG-002: Student Dashboard
System MUST display:
- Total worksheets completed (all time, this week)
- Average score (all subjects, per subject)
- Weak topics: subjects/topics with <70% average
- Recent attempts (last 10)
- Best score per worksheet (if multiple attempts)

#### FR-PROG-003: Teacher Dashboard — Class Analytics
System MUST display for selected class:
- Average score per topic (bar chart, sortable)
- Student list with: name, worksheets completed, average score
- Weakest topics: bottom 3 by class average
- Worksheet completion rate (%)
- Allow export as CSV

#### FR-PROG-004: Teacher Dashboard — Individual Student View
System MUST display:
- Topic mastery heatmap (green >80%, yellow 50-79%, red <50%)
- Question type accuracy breakdown (pie chart)
- Progress over time line graph (last 30 days)
- "Focus Areas" section: bottom 3 topics with generate worksheet button

#### FR-PROG-005: Parent Dashboard
- Display same as Teacher > Individual Student but restricted to linked child(ren)
- "Suggested Practice" button → generates worksheet with weak topics pre-selected

#### FR-PROG-006: Offline Score Upload (CSV)
System MUST accept CSV with columns:
```
studentName, worksheetId, score, totalPoints, completedDate
```
- System SHALL match studentName to existing student or create placeholder
- System SHALL validate worksheetId exists
- System SHALL save as WorksheetAttempts with attemptSource="offline"
- System MUST return summary: "X successful, Y failed (errors: ...)"

---

### Module 5: Class & User Management

#### FR-CLASS-001: Class Creation
- Teacher MUST provide: className, grade, subject
- System SHALL generate 6-character alphanumeric invite code (unique)
- System SHALL store in DynamoDB Classes table:
  ```
  classId (PK), teacherId, className, grade, subject,
  inviteCode, createdAt, isActive
  ```

#### FR-CLASS-002: Student Join Flow
- Student enters invite code on "Join Class" page
- System SHALL validate code, add to ClassMemberships table:
  ```
  PK: classId#studentId
  Attributes: classId, studentId, joinedAt, isActive
  ```
- Student SHALL see confirmation: "You joined [ClassName]"

#### FR-CLASS-003: Multi-Class Support
- Student CAN be in multiple classes for same subject
- During online solve, if student in >1 class for subject, system SHALL prompt:
  "Which class is this for?" dropdown
- System SHALL save classId in WorksheetAttempts

#### FR-CLASS-004: Parent-Child Linking
- Parent enters child's email on "Link Child" page
- System SHALL send verification email to child account
- Child clicks link to approve
- System SHALL store in ParentStudentLinks table:
  ```
  PK: parentId#studentId
  Attributes: parentId, studentId, linkedAt, verifiedAt
  ```

---

### Module 6: Infrastructure & Deployment

#### FR-INFRA-001: S3 Bucket Structure
```
learnfyra-{env}-s3-worksheets/
  worksheets/{year}/{month}/{day}/{uuid}/
    worksheet.pdf, worksheet.docx, worksheet.html,
    answer-key.pdf, answer-key.docx,
    metadata.json, solve-data.json

learnfyra-{env}-s3-frontend/
  index.html, solve.html, dashboard.html,
  css/, js/

learnfyra-{env}-s3-logs/
  access-logs/
```

#### FR-INFRA-002: Lambda Functions
| Function | Route | Timeout | Memory | Concurrency |
|----------|-------|---------|--------|-------------|
| learnfyra-generate | POST /api/generate | 60s | 1024MB | 25 |
| learnfyra-solve | GET /api/solve/{id} | 10s | 128MB | 50 |
| learnfyra-submit | POST /api/submit | 15s | 256MB | 50 |
| learnfyra-auth | POST /api/auth/* | 10s | 128MB | 50 |
| learnfyra-progress | GET /api/progress/* | 10s | 256MB | 25 |
| learnfyra-class | POST /api/class/* | 10s | 128MB | 25 |

#### FR-INFRA-003: DynamoDB Tables
1. **Users** — PK: userId, Attributes: email, role, authProvider, profileData
2. **Questions** — PK: questionId, GSI: grade+subject+topic+difficulty
3. **Worksheets** — PK: worksheetId, Attributes: metadata, questionIds[], createdAt
4. **WorksheetAttempts** — PK: studentId#worksheetId#timestamp, GSI-1: classId+subject, GSI-2: studentId+subject
5. **Classes** — PK: classId, Attributes: teacherId, inviteCode, students[]

#### FR-INFRA-004: Cognito User Pools
- One user pool per environment (dev/staging/prod)
- OAuth providers: Google (required), Microsoft (optional), GitHub (optional)
- Password policy enforced on local accounts
- Email verification required for local accounts
- MFA optional for teachers/parents (Phase 2)

#### FR-INFRA-005: CloudWatch Alarms
- Lambda error rate >1% → alert ops team
- Lambda p99 latency >5s → alert ops team
- DynamoDB throttled requests >10/min → alert ops team
- S3 bucket size >100GB → alert ops team (cost control)

#### FR-INFRA-006: CI/CD Pipelines
- **ci.yml** → Pull requests: lint, test, coverage gate (80%), CDK synth
- **deploy-dev.yml** → Push to develop → auto-deploy to dev
- **deploy-staging.yml** → Push to staging → auto-deploy + smoke tests
- **deploy-prod.yml** → Push to main → manual approval → deploy to prod

---

## 4. Acceptance Criteria

### AC-AUTH-001: Google OAuth Login (Student)
```
Given a student clicks "Sign In" and selects "Google"
When they complete Google OAuth flow successfully
Then a student account is created with email, name, profile picture from Google
And they are redirected to student dashboard with "Welcome, [Name]"
And their account type is stored as "oauth:google"
And JWT token is issued with 7-day expiration
```

### AC-AUTH-002: Local Account Creation (Student)
```
Given a student selects "Create Account" → "Email & Password"
When they enter email "student@example.com", password "SecurePass1!", confirm password
Then account is created with bcrypt-hashed password (cost 12)
And email verification link is sent via SES
And they see message: "Check your email to verify account"
And they CANNOT solve worksheets online until email verified
And clicking verification link sets emailVerified=true and redirects to dashboard
```

### AC-AUTH-003: Auth Gate on Online Solve
```
Given a guest user lands on worksheet result page
When they click "Solve Online"
Then modal appears: "Sign in required to track progress"
And modal shows: [Sign In with Google] [Sign In with Email] [Continue as Guest]
And "Continue as Guest" closes modal and shows download buttons only

Given an authenticated student clicks "Solve Online"
When they are logged in with valid JWT
Then they are redirected directly to solve page with questions rendered
```

### AC-GEN-001: Question Bank Reuse
```
Given a teacher requests worksheet: Grade 3, Math, Multiplication, Medium, 10 questions
When Question Bank contains 8 matching questions
Then system retrieves 8 from bank and generates 2 new questions via Bedrock
And new questions are validated and saved to Question Bank
And the 10 selected questions are unique within that worksheet request/session
And 10 questions are assembled into worksheet JSON
And worksheet.pdf, .docx, .html, answer key are generated and uploaded to S3
```

### AC-GEN-004: Future-Session Repeat Cap and Admin Override
```
Given the same student requests another worksheet with the same grade and difficulty in a future session
When no override is configured
Then the system allows at most 10% repeated questions from prior exposure for that student profile

Given an admin configures an override for student, teacher, or parent scope
When effective repeat cap is set between 0% and 100%
Then worksheet assembly enforces the configured cap for applicable future sessions
And any candidate exceeding the cap is replaced before final worksheet output
```

### AC-GEN-002: Multi-Model Fallback
```
Given system generates question with Nova Micro
When quality_score < 0.7 (validation fails)
Then system retries with Claude Haiku
And if still fails, logs error and excludes from worksheet
And includes fallback questions from Question Bank
And logs model performance metrics to CloudWatch
```

### AC-GEN-003: Standards Alignment
```
Given a worksheet is generated for Grade 5, Math, Fractions
When questions are created
Then every question MUST have standards field with CCSS code (e.g., "5.NF.A.1")
And answer key displays standards under each question
And worksheet metadata includes list of all standards covered
```

### AC-SOLVE-001: Timed Mode Auto-Submit
```
Given student starts worksheet in Timed Mode with 20-minute timer
When timer reaches 0 seconds
Then modal appears: "Time's up! Your answers will be submitted."
And after 5 seconds or manual confirm, answers are submitted to /api/submit
And scoring runs and results page is displayed
```

### AC-SOLVE-002: Scoring Accuracy
```
Given student submits worksheet with answers:
  Q1 (multiple-choice): student="B", correct="B" → 1/1 point
  Q2 (fill-in-blank): student="forty two", correct="42" → 0/1 point (no fuzzy match Phase 1)
  Q3 (true-false): student="True", correct="true" → 1/1 point (case-insensitive)
When scoring engine processes answers
Then totalScore = 2, totalPoints = 3, percentage = 67
And results page shows Q1 ✅, Q2 ❌, Q3 ✅
```

### AC-PROG-001: Attempt Storage
```
Given authenticated student submits worksheet
When POST /api/submit completes
Then DynamoDB WorksheetAttempts table receives record:
  PK: studentId#worksheetId#2026-03-25T14:30:00Z
  Attributes: studentId={uuid}, worksheetId={uuid}, attemptNumber=1,
              grade=3, subject="Math", topic="Multiplication",
              totalScore=8, totalPoints=10, percentage=80,
              answers=[...], timeTaken=845, timedMode=true
And write completes in <500ms (p99)
And CloudWatch logs capture full request/response
```

### AC-PROG-002: Student Dashboard Weak Topics
```
Given student has completed 10 worksheets:
  - Math Multiplication: 90%, 85%, 92% → average 89%
  - Math Division: 65%, 70%, 62% → average 66%
  - Math Fractions: 50%, 55%, 52% → average 52%
When student views dashboard
Then "Weak Topics" section shows:
  1. Math Fractions — 52% average
  2. Math Division — 66% average
And each has button: "Practice This Topic" → pre-fills generate form
```

### AC-PROG-003: Teacher Class Analytics
```
Given teacher views Class "5th Grade Math" with 25 students
When they navigate to "Class Analytics"
Then they see:
  - Bar chart: Average score by topic (Multiplication 88%, Division 72%, Fractions 65%)
  - Table: 25 students, columns (Name, Worksheets Completed, Avg Score), sortable
  - Card: "Weakest Topics" → 1. Fractions (65%), 2. Division (72%), 3. Geometry (75%)
  - Export CSV button → downloads full data
And all data queries use DynamoDB GSI-1 (classId + subject)
```

### AC-PROG-004: Offline Score Upload
```
Given teacher uploads CSV with 50 rows:
  studentName,worksheetId,score,totalPoints,completedDate
  "Alice Smith",{uuid},8,10,2026-03-20
  "Bob Jones",{uuid},7,10,2026-03-20
  ...
When system processes upload
Then 48 students matched by name and records saved to WorksheetAttempts
And 2 students not found → created as placeholder with type="offline:manual"
And response shows: "48 successful, 2 new students created, 0 failed"
```

### AC-CLASS-001: Class Creation & Join
```
Given teacher creates class "5th Grade Math Section A", Grade 5, Subject Math
When class is saved
Then system generates inviteCode="A3X9K2" (6 chars, alphanumeric, unique)
And teacher sees: "Share this code with students: A3X9K2"

Given student clicks "Join Class" and enters "A3X9K2"
When code is validated
Then student is added to ClassMemberships table
And student dashboard shows "Classes: 5th Grade Math Section A"
And teacher sees student name in class roster
```

### AC-CLASS-002: Multi-Class Worksheet Attribution
```
Given student "Alice" is in 2 classes for Math: "5A" and "5B"
When Alice solves worksheet online
Then before starting solve, modal appears: "Which class is this for?" dropdown [5A, 5B]
And Alice selects "5A"
Then WorksheetAttempts record saves classId for "5A"
And teacher of "5A" sees attempt in class analytics
And teacher of "5B" does NOT see this attempt
```

### AC-INFRA-001: Multi-Environment Deployment
```
Given developer pushes to develop branch
When GitHub Actions ci.yml passes (tests + coverage 80%+)
Then deploy-dev.yml triggers
And CDK deploys to learnfyra-dev-* resources (S3, Lambda, DynamoDB, Cognito)
And frontend is synced to learnfyra-dev-s3-frontend
And smoke tests run: GET /api/health returns 200
And CloudWatch logs confirm deployment

Given code is merged to main branch
When deploy-prod.yml workflow runs
Then manual approval step blocks deployment
And after approval, CDK deploys to learnfyra-prod-* resources
And production smoke tests run on real URLs
```

---

## 5. Phase 1 Scope Boundaries

### ✅ IN SCOPE (Phase 1 MVP)
- Multi-role auth: student, teacher, parent
- Google OAuth + 1 additional OAuth (Microsoft or GitHub)
- Local email/password accounts with verification
- Worksheet generation with AI (multi-model Bedrock)
- Question Bank with reuse and cost optimization
- 7 question types supported
- Online solve with timed/untimed modes
- Instant scoring and feedback
- Student dashboard with progress and weak topics
- Teacher dashboard with class analytics
- Parent dashboard with child progress
- Offline score upload via CSV
- Class creation and student invite codes
- S3 storage with 7-day expiration
- DynamoDB for all operational data
- CloudFront CDN for frontend
- CI/CD pipelines for dev/staging/prod
- Basic monitoring with CloudWatch

### ❌ OUT OF SCOPE (Phase 2 or Future)
- **Gamification/Rewards** → Badges, points, streaks, leaderboards (deferred to Phase 2)
- **Admin Console** → Internal ops tool for monitoring, content review, incident management (Phase 2)
- **School Admin Role** → District-level multi-teacher management (Phase 2)
- **Advanced Analytics** → Predictive modeling, learning curves, AI recommendations (Phase 2)
- **SSO with School LMS** → Canvas, Schoology, Google Classroom integration (Phase 2)
- **Real-Time Collaboration** → Multiple students solving same worksheet together (not planned)
- **Mobile Native Apps** → iOS/Android apps (web-first, responsive design only)
- **Payment/Subscriptions** → Free tier only for MVP
- **Parent-Teacher Messaging** → Communication features (not planned)
- **Adaptive Difficulty** → AI adjusting difficulty mid-worksheet (Phase 2)
- **Question Partial Credit** → Show-your-work step-by-step scoring (Phase 2)
- **Bulk Class Import** → CSV upload for 100+ students (Phase 2)
- **Custom Analytics Dashboards** → Teacher-configurable widgets (Phase 2)
- **Offline Mobile App** → Local storage for worksheets (not planned)

### 🔄 DEFERRED TO PHASE 2 (Designed, Not Built)
- **UX Rewards System** → Full spec exists in [docs/design/ux-rewards-engagement-spec.md](docs/design/ux-rewards-engagement-spec.md)
- **Admin Console** → Full spec exists in [docs/design/frontend/admin-console-ux-spec.md](docs/design/frontend/admin-console-ux-spec.md)
- **School Admin Role** → Mentioned in auth spec, not built Phase 1

---

## 6. Dependencies & Build Sequence

### 6.1 Critical Path (Must Build in Order)
```
Phase 1A: Foundation (Week 1-2)
├── INFRA: AWS CDK setup (S3, Lambda skeleton, DynamoDB tables)
├── AUTH: Cognito user pools, Google OAuth integration
└── AUTH: Local account creation + email verification

Phase 1B: Core Generation (Week 3-4)
├── GENERATOR: Question Bank schema + DynamoDB tables
├── GENERATOR: Bedrock integration (Nova Micro + Claude Haiku)
├── GENERATOR: Validation engine (standards alignment)
├── GENERATOR: Assembly + rendering (HTML/PDF/DOCX)
└── GENERATOR: S3 storage with metadata

Phase 1C: Online Solve (Week 5-6)
├── SOLVE: Solve UI (frontend/solve.html, js/solve.js)
├── SOLVE: Timer implementation (timed/untimed modes)
├── SOLVE: Submit handler (POST /api/submit)
├── SOLVE: Scoring engine per question type
└── SOLVE: Results page with feedback

Phase 1D: Progress Tracking (Week 7-8)
├── PROGRESS: WorksheetAttempts table + GSIs
├── PROGRESS: Student dashboard (past attempts, weak topics)
├── PROGRESS: Teacher dashboard (class analytics)
├── PROGRESS: Parent dashboard (child progress)
└── PROGRESS: Offline score upload (CSV import)

Phase 1E: Classes & Polish (Week 9-10)
├── CLASSES: Class creation + invite codes
├── CLASSES: Student join flow
├── CLASSES: Parent-child linking
├── INFRA: Monitoring + CloudWatch alarms
├── INFRA: CI/CD pipelines (dev/staging/prod)
└── QA: End-to-end testing + load testing
```

### 6.2 Module Dependencies
```
INFRA (base)
  ↓
AUTH (Cognito + Lambda Authorizer)
  ↓
GENERATOR (Question Bank + Bedrock) → SOLVE (requires worksheet JSON)
  ↓                                       ↓
  ↓                                   PROGRESS (requires attempt data)
  ↓                                       ↓
  └───────────────→ CLASSES (requires auth + progress)
```

### 6.3 Parallel Workstreams
Once INFRA + AUTH are complete, these can be built in parallel:
- **Team A:** GENERATOR (DEV + DBA + IaC)
- **Team B:** SOLVE frontend (UI Agent + DEV)
- **Team C:** PROGRESS analytics (DBA + DEV)

CLASSES module requires PROGRESS completion, so builds last.

### 6.4 External Dependencies
| Dependency | Blocker For | Lead Time | Owner |
|------------|-------------|-----------|-------|
| Google OAuth API registration | AUTH module | 1 day | DevOps |
| AWS account setup (dev/staging/prod) | INFRA | 1 day | DevOps |
| Domain registration (learnfyra.com) | Cognito OAuth redirect URLs | 3-5 days | DevOps |
| SSL certificate (ACM) | CloudFront HTTPS | 1 day (after DNS) | DevOps |
| SendGrid or SES email approval | Email verification | 2-3 days | DevOps |
| Bedrock model access (Claude, Nova) | GENERATOR | Same-day (AWS account needs Bedrock enabled) | DevOps |

---

## 7. Open Questions

### 7.1 Authentication & Identity
**Q1:** Should we support Apple Sign-In as third OAuth provider, or stick with Microsoft/GitHub?  
**Impact:** Microsoft has better school adoption, GitHub targets teacher/developer users, Apple targets consumer/parent users.  
**Recommendation:** Start with Google + Microsoft for school alignment, add Apple in Phase 2 for parent/consumer adoption.

**Q2:** How should system handle duplicate accounts (same email, different OAuth providers)?  
**Options:**  
  A) Block duplicate, force user to pick one OAuth provider  
  B) Auto-link accounts, allow login with any provider  
  C) Prompt user: "You already have an account with this email, link accounts?"  
**Recommendation:** Option C — prompt for linking, gives user control.

**Q3:** Should parent accounts be able to solve worksheets, or view-only?  
**Impact:** If parents can solve, we need parent-specific dashboards and attempt attribution.  
**Recommendation:** Phase 1 view-only, Phase 2 add "Practice Together" mode where parent can solve with child.

### 7.2 Worksheet Generation
**Q4:** What is maximum questionCount per worksheet?  
**Impact:** Higher counts increase generation cost and latency. Current architecture assumes 5-30 questions.  
**Recommendation:** Hard limit 30 questions Phase 1, add "Multi-Page Worksheet" feature Phase 2 for 50-100 questions.

**Q5:** Should Question Bank be shared across all grades/subjects, or isolated per teacher?  
**Options:**  
  A) Global shared bank — all teachers benefit from reuse  
  B) Per-teacher private bank — teacher controls quality  
  C) Hybrid — shared + private banks  
**Recommendation:** Option A for Phase 1 (cost optimization), add private banks Phase 2.

**Q6:** How to handle question quality issues (factually incorrect, inappropriate)?  
**Recommendation:** Phase 1 — teacher can flag question (writes to FlaggedQuestions table), ops team reviews manually.  
Phase 2 — Admin Console with quality review queue.

### 7.3 Progress Tracking & Analytics
**Q7:** Should student dashboards show comparison to class average?  
**Concern:** May discourage struggling students.  
**Recommendation:** Phase 1 — show personal progress only. Phase 2 — add opt-in "Compare to Class" toggle.

**Q8:** How long to retain student attempt data?  
**Options:**  
  A) Forever (no expiration)  
  B) 1 year rolling window  
  C) Configurable by teacher (1 month to forever)  
**Recommendation:** Option A for Phase 1 (simple), add data retention policy controls Phase 2.

**Q9:** Should we precompute analytics aggregates, or compute on-demand?  
**Impact:** On-demand queries with DynamoDB GSIs may hit throttle limits for large classes (>100 students).  
**Recommendation:** Phase 1 — on-demand for classes <50 students. Phase 2 — add DynamoDB Streams → Lambda → precompute to separate Analytics table for classes >50.

### 7.4 Infrastructure & Operations
**Q10:** What is expected peak load for Phase 1 launch?  
**Needed for:** Lambda concurrency limits, DynamoDB provisioning.  
**Assumptions:** 1,000 concurrent users, 50 worksheets generated/min, 200 solve submissions/min.  
**Action:** Conduct load testing during Phase 1E before production launch.

**Q11:** Should we use DynamoDB On-Demand or Provisioned capacity?  
**Options:**  
  A) On-Demand — auto-scaling, pay per request (simpler)  
  B) Provisioned — cheaper at scale, requires capacity planning  
**Recommendation:** On-Demand for Phase 1 (unpredictable traffic), migrate to Provisioned in Phase 2 after traffic patterns known.

**Q12:** CDN caching strategy for CloudFront?  
**Question:** Should API responses be cached, or only static frontend?  
**Recommendation:** Cache static frontend (1 day TTL), cache GET /api/solve/{id} (1 hour TTL), no cache for POST endpoints.

### 7.5 Cross-Cutting Concerns
**Q13:** GDPR/COPPA compliance for student data?  
**Impact:** If targeting EU or collecting data from students <13, need parental consent flows.  
**Recommendation:** Phase 1 — USA-only, require teacher/school permission (not individual parental consent). Phase 2 — add GDPR consent flows for international.

**Q14:** Should we support multiple languages (i18n)?  
**Impact:** UI localization + curriculum alignment for non-USA standards.  
**Recommendation:** Phase 1 English-only. Phase 2 add Spanish (USA bilingual schools), then international expansion.

**Q15:** Accessibility (WCAG) compliance level?  
**Recommendation:** WCAG 2.1 AA for Phase 1 (screen reader support, keyboard navigation, color contrast). AAA for Phase 2.

---

## Document Metadata

**Prepared By:** BA Agent (Learnfyra Business Analysis Team)  
**Reviewed By:** [Pending — needs Product Owner + Engineering Lead sign-off]  
**Next Steps:**  
1. Product Owner reviews and approves scope  
2. DBA Agent defines full DynamoDB schemas (Tables + GSIs)  
3. IaC Agent creates CDK stack for infrastructure  
4. DevOps Agent provisions AWS accounts (dev/staging/prod) and registers OAuth apps  
5. DEV Agent begins Phase 1A implementation  

**Related Documents:**
- [docs/design/platform/student-authentication-and-progress-tracking-spec.md](docs/design/platform/student-authentication-and-progress-tracking-spec.md)
- [docs/design/ux-rewards-engagement-spec.md](docs/design/ux-rewards-engagement-spec.md)
- [docs/design/frontend/admin-console-ux-spec.md](docs/design/frontend/admin-console-ux-spec.md)
- [docs/architecture/diagrams/worksheet_architecture.md](docs/architecture/diagrams/worksheet_architecture.md)
- [docs/specs/backend/auth-online-offline-reporting-spec.md](docs/specs/backend/auth-online-offline-reporting-spec.md)
- [CLAUDE.md](CLAUDE.md) — Agent Teams System Prompt

**Change Log:**
- 2026-03-25: Initial requirements specification created

---

**END OF DOCUMENT**
