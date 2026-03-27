# Business Analysis: Student Authentication & Progress Tracking

**Feature ID:** LFR-002  
**Author:** BA Agent  
**Date:** March 24, 2026  
**Status:** Draft — Pending Review  
**Related:** Extends online-solve feature (LFR-001)

---

## Feature: Student Authentication & Progress Tracking System

### User Story

**As a student**, I want to solve worksheets in guest mode or create an account, so that I can practice offline or track my progress online over time.

**As a teacher/parent**, I want to view student progress with detailed analytics, so that I can identify knowledge gaps and provide targeted support.

**As a developer**, I want the system to support both online (real-time sync) and offline (manual upload) modes, so that the platform works in low-connectivity environments.

---

## Core User Roles

1. **Guest Student** — no account, downloads worksheets, cannot track progress
2. **Authenticated Student** — has account, can solve online with progress tracking
3. **Teacher** — manages classes, assigns worksheets, views analytics for multiple students
4. **Parent** — views analytics for their child(ren) only
5. **School Admin** (phase 2) — manages multiple teachers and classes

---

## Acceptance Criteria

### AC-1: Guest Mode Access
```
Given a student visits the Learnfyra platform without logging in
When they generate a worksheet
Then they can download PDF/DOCX/HTML formats
And they can solve online but results are NOT saved
And they see a banner: "Sign in to save your progress"
```

### AC-2: Student Account Creation with OAuth
```
Given a student clicks "Sign In" and selects "Google"
When they complete OAuth flow successfully
Then a student account is created with profile from OAuth provider
And they are redirected to dashboard with "Welcome, [Name]"
And their account type is stored as "oauth:google"

Given a student selects "Sign in with Microsoft/GitHub"
When OAuth completes successfully
Then account is created with provider-specific ID mapping
And student can log in with any linked OAuth provider
```

### AC-3: Student Account Creation with Local Credentials
```
Given a student clicks "Sign In" → "Create Account" → "Email & Password"
When they enter email, password (min 8 chars, 1 uppercase, 1 number), and confirm password
Then a local account is created with bcrypt-hashed password stored in RDS/DynamoDB
And they receive email verification link (SendGrid/SES)
And they cannot solve worksheets online until email is verified
And their account type is stored as "local:email"
```

### AC-4: Online Practice Requires Authentication
```
Given a student clicks "Solve Online" on a generated worksheet
When they are NOT logged in
Then they see modal: "Sign in required to solve online"
And they can click "Sign In" or "Continue as Guest" (download only)

Given an authenticated student clicks "Solve Online"
When they submit answers
Then worksheet ID, student ID, answers, score, timestamp are saved to database
And they see results page with historical comparison: "Your average: 82%, This attempt: 90%"
```

### AC-5: Offline Practice with Manual Score Upload
```
Given a teacher downloads a worksheet PDF for a class
When students complete it on paper
Then teacher can navigate to "Upload Scores" page
And upload CSV format: studentName, worksheetId, score, date
And system validates against stored answer key
And updates student records in database

Given teacher uploads scores for studentName not in system
When CSV is processed
Then student is auto-created with type "offline:manual"
And flagged for teacher to claim/link to real account later
```

### AC-6: Student Progress Storage Schema
```
Given a student completes an online worksheet
When results are saved
Then the following data is stored in DynamoDB:
  - studentId (PK)
  - worksheetId + attemptTimestamp (SK)
  - grade, subject, topic, difficulty
  - classId (if assigned by teacher)
  - totalScore, totalPoints, percentage
  - answers[] → { questionNumber, studentAnswer, correctAnswer, isCorrect, points }
  - timeTaken, timedMode (boolean)
  - createdAt, updatedAt

And GSI-1 allows query by: classId + subject + topic
And GSI-2 allows query by: studentId + subject (for per-subject analytics)
```

### AC-7: Teacher Dashboard with Class Management
```
Given a teacher logs in
When they navigate to "Classes"
Then they see list of classes they created
And can create new class with: className, grade, subject, students[]
And can generate invite code (6-char alphanumeric)
And students can join class by entering invite code

Given teacher views a class
When they click "Class Analytics"
Then they see:
  - Average score per topic (bar chart)
  - Student rankings (table, sortable)
  - Weakest topics (bottom 3 by class average)
  - Worksheet completion rate (%)
And can export data as CSV
```

### AC-8: Student Weakness Identification (Creative Analytics)
```
Given a teacher views student progress
When they select a student and subject
Then they see:
  - Topic mastery heatmap (green = >80%, yellow = 50-79%, red = <50%)
  - Question type accuracy breakdown (pie chart)
  - Progress over time line graph (last 30 days)
  - "Focus Areas" card: bottom 3 topics with recommended practice worksheets

Given a parent logs in
When they view their child's profile
Then they see same analytics as teacher but only for their child
And "Suggested Practice" button → generates worksheet targeting weak topics
```

### AC-9: AWS Service Integration
```
Given the authentication system is deployed to production
When a student signs in with OAuth
Then AWS Cognito user pool validates identity
And Lambda authorizer validates JWT token on all /api/student/* routes
And DynamoDB stores student profile, progress, and class mappings

Given student completes online worksheet
When results are saved
Then Lambda function writes to DynamoDB in <500ms (p99)
And S3 bucket stores worksheet JSON at worksheets/{year}/{month}/{day}/{uuid}/solve-data.json
And CloudWatch logs capture all attempts for audit trail
```

### AC-10: Boundary Cases
```
Given a student attempts same worksheet 10 times
When viewing progress
Then all 10 attempts are stored with attemptNumber
And dashboard shows "best score" and "most recent score"

Given a student with account type "oauth:google" also creates "local:email" account with same email
When they log in with either method
Then system detects duplicate email and prompts: "Link accounts?"
And if confirmed, both auth methods point to same studentId

Given teacher uploads score CSV with 500 students
When processing
Then Lambda function processes in batches of 25 (DynamoDB batch write limit)
And returns summary: "450 successful, 50 failed (errors attached)"

Given student is in 3 classes for same subject (Math)
When completing worksheet
Then system prompts: "Which class is this for?" dropdown
And saves classId in worksheet attempt record
```

---

## AWS Services Involved

### Authentication
- **AWS Cognito** → User pools for OAuth (Google, Microsoft, GitHub) and local email/password
- **Lambda Authorizer** → JWT validation for all authenticated API routes

### Data Storage
- **DynamoDB** → Students table, Classes table, WorksheetAttempts table, ClassMemberships table
- **S3** → Worksheet JSON files (already exists, extended with student attempt metadata)
- **RDS Aurora Serverless (optional)** → If relational queries needed for complex class analytics

### Backend
- **Lambda Functions** → New: authHandler, studentHandler, classHandler, progressHandler, analyticsHandler
- **API Gateway** → /api/auth/*, /api/student/*, /api/class/*, /api/progress/*, /api/analytics/*

### Email & Notifications
- **Amazon SES or SendGrid** → Email verification, password reset, class invite emails

### Monitoring
- **CloudWatch** → Logs, metrics (sign-ins per day, worksheet completions)
- **X-Ray** → Trace student workflow: sign-in → solve → results save

---

## Out of Scope

### Excluded from this feature:
- ❌ **School district-level admin accounts** → Phase 2
- ❌ **Student-to-student collaboration/chat** → Not planned
- ❌ **Real-time leaderboards during worksheet solve** → May add in Phase 2
- ❌ **Mobile native apps (iOS/Android)** → Web-first, responsive design only
- ❌ **Payment/subscription tiers** → Free tier only for MVP
- ❌ **SSO integration with school LMS (Canvas, Schoology)** → Phase 2
- ❌ **Gamification (badges, achievements)** → Phase 2
- ❌ **AI-powered study recommendations beyond weak topics** → Phase 2
- ❌ **Offline mobile app with local storage** → Web only for MVP
- ❌ **Parent-teacher messaging** → Out of scope

### Deferred to Phase 2:
- 🔄 **School admin role** with multi-teacher management
- 🔄 **Advanced analytics**: predictive modeling, learning curve projections
- 🔄 **Bulk class creation** via CSV upload
- 🔄 **Webhook integrations** for third-party gradebooks
- 🔄 **Custom analytics dashboards** (teacher-configurable)

---

## Dependencies

### Internal (Learnfyra codebase):
1. **Online Solve Feature (LFR-001)** → Must be complete and stable
   - student saves depend on existing worksheet JSON structure
2. **DBA Agent** → Define DynamoDB table schemas before DEV starts
3. **IaC Agent** → Provision Cognito user pool + DynamoDB tables before Lambda deploy

### External Services:
1. **Google OAuth 2.0 API** → Requires app registration, client ID/secret
2. **Microsoft Azure AD** → For Microsoft account OAuth
3. **GitHub OAuth** → For developer/teacher accounts (optional)
4. **Email service (SES or SendGrid)** → For verification emails
5. **Domain + SSL cert** → For OAuth redirect URIs (must be HTTPS)

### Data Dependencies:
- Existing worksheet generation flow must save `solve-data.json` to S3 (already in LFR-001)
- Frontend must pass `studentId` and `classId` to submit handler

---

## Open Questions

### Authentication:
1. **Q:** Should we support passwordless email login (magic link)?  
   **Decision needed from:** Product Owner  
   **Impact:** Reduces friction but adds complexity (time-limited tokens, email sending latency)

2. **Q:** Do we support single student having multiple roles (e.g., student in one class, teacher in another)?  
   **Default assumption:** No. Separate accounts for teacher vs student roles.  
   **Validate with:** Product/UX team

### Data Retention:
3. **Q:** How long do we store worksheet attempts? Forever or archive after X months?  
   **Default assumption:** Retain all data in DynamoDB, lifecycle-archive to S3 Glacier after 1 year.  
   **Validate with:** Legal/Compliance, AWS cost analysis

4. **Q:** Do we store PII (student full name, email) in same table as worksheet data?  
   **Recommendation:** Separate tables: `Students` (PII) and `WorksheetAttempts` (denormalized studentId only).  
   **Requires:** GDPR/FERPA compliance review

### Class Management:
5. **Q:** Can a student join multiple classes for the same subject (e.g., Math Class A and Math Class B)?  
   **Default assumption:** Yes, and worksheet submit prompts for classId.  
   **Validate with:** UX team for modal design

6. **Q:** Can teachers co-teach a class (multiple teachers per class)?  
   **Default assumption:** Phase 2. MVP = 1 teacher per class.  
   **Validate with:** Product

### Analytics:
7. **Q:** What is the algorithm for "suggested practice worksheets" based on weak topics?  
   **Proposal:** If student scores <70% on a topic across last 3 attempts, suggest difficulty=Easy worksheet for that topic.  
   **Requires:** BA to define rule engine, DEV to implement

8. **Q:** Should parent accounts be auto-linked to student accounts, or does student send invite?  
   **Security concern:** Parent must prove relationship. Suggest: teacher creates parent account + links to student.  
   **Alternative:** Student emails invite link, parent claims with email verification.  
   **Validate with:** UX + Legal

### Performance:
9. **Q:** Expected scale: How many students per class? Worksheets per student per month?  
   **Assumption for MVP:** 30 students/class, 10 worksheets/student/month = 300 worksheet saves/month/class.  
   **DynamoDB provisioning:** On-demand mode for MVP, switch to provisioned if costs exceed $50/month.  
   **Validate with:** Product for target user base

### Offline Mode:
10. **Q:** When teacher uploads scores via CSV, do we validate against answer key or trust teacher input?  
    **Recommendation:** Trust teacher input (they may adjust partial credit). Optionally flag if score > totalPoints.  
    **Validate with:** Product

---

## MVP vs Phase 2 Split

### ✅ MVP (v1.0 — Target: 6 weeks from spec approval)

**Must-Have (Blocks Launch):**
- ✅ Guest mode (download worksheets, no login required)
- ✅ Student registration: Google OAuth + local email/password
- ✅ Email verification for local accounts
- ✅ Online solve saves to student account (authenticated only)
- ✅ Teacher can create classes, generate invite codes
- ✅ Students join classes via invite code
- ✅ Teacher dashboard: class list, student list, basic score table
- ✅ Student dashboard: my worksheets, my scores, subject breakdown
- ✅ DynamoDB tables: Students, Classes, ClassMemberships, WorksheetAttempts
- ✅ Lambda functions: authHandler, studentHandler, classHandler, progressHandler
- ✅ AWS Cognito user pool with Google OAuth configured
- ✅ Basic analytics: average score per topic (bar chart), student ranking table

**Nice-to-Have (Launch Without if Time-Constrained):**
- 🟡 Microsoft + GitHub OAuth (can add post-launch)
- 🟡 Offline CSV upload for teacher score entry → Manual workaround: teacher uses "Guest + track separately" until Phase 2
- 🟡 Parent accounts → Teachers can download reports as PDF for parents in MVP

### 🚀 Phase 2 (v2.0 — 3 months post-launch)

**Advanced Features:**
- 🔄 Parent accounts with student linking
- 🔄 Offline CSV score upload (teacher manually enters scores for paper worksheets)
- 🔄 School admin role (manages multiple teachers)
- 🔄 Advanced analytics:
  - Topic mastery heatmap
  - Question type accuracy breakdown
  - Progress over time line graph
  - AI-suggested practice targeting weak areas
- 🔄 Real-time leaderboards (opt-in per class)
- 🔄 Bulk operations (create 100 students via CSV, assign worksheet to 5 classes at once)
- 🔄 Webhook integrations for LMS gradebook sync
- 🔄 Export analytics as PDF report (branded, printable for parent-teacher conferences)

### 📊 Success Metrics for MVP

**Launch Criteria (All Must Pass):**
- [ ] 95% of OAuth logins complete in <3 seconds
- [ ] DynamoDB write latency p99 <500ms for worksheet save
- [ ] Zero critical security bugs (OWASP Top 10)
- [ ] Mobile responsive: works on iPhone SE, iPad, Android phone
- [ ] Load test: 100 concurrent students solving worksheets → no errors
- [ ] Teacher can create class, invite 5 students, view results in <5 minutes

**Post-Launch KPIs (Track for Phase 2 Justification):**
- Student sign-up rate: >30% of worksheet generators create accounts
- Retention: >60% of students return within 7 days
- Teacher adoption: >10 teachers create classes in first month
- Analytics usage: >50% of teachers view class analytics at least once/week

---

## Technical Notes for DEV/IaC Agents

### DynamoDB Table Design Recommendations (DBA to finalize):
```
Table: Students
  PK: studentId (uuid)
  Attributes: email, authType (oauth:google | local:email), profileData, createdAt, lastLoginAt
  GSI-1: email (unique, for lookup during login)

Table: Classes
  PK: classId (uuid)
  Attributes: teacherId, className, grade, subject, inviteCode (6-char), createdAt

Table: ClassMemberships
  PK: classId
  SK: studentId
  Attributes: joinedAt, status (active | archived)

Table: WorksheetAttempts
  PK: studentId
  SK: worksheetId#attemptTimestamp (ISO-8601)
  Attributes: grade, subject, topic, difficulty, classId, totalScore, totalPoints, percentage,
              answers[], timeTaken, timedMode, createdAt
  GSI-1: classId#subject#topic (for class analytics queries)
  GSI-2: studentId#subject (for student per-subject analytics)
```

### Lambda Function Signatures (DEV to implement):
```javascript
POST /api/auth/register          → authHandler.register()
POST /api/auth/login             → authHandler.login()
POST /api/auth/oauth/callback    → authHandler.oauthCallback()
GET  /api/student/profile        → studentHandler.getProfile()
POST /api/student/join-class     → studentHandler.joinClass()
GET  /api/student/progress       → progressHandler.getStudentProgress()
POST /api/class/create           → classHandler.createClass()
GET  /api/class/:id/students     → classHandler.getClassStudents()
GET  /api/analytics/class/:id    → analyticsHandler.getClassAnalytics()
POST /api/progress/save          → progressHandler.saveWorksheetAttempt()  (called by submitHandler)
```

### Frontend Pages to Create (UI to design):
```
/login                   Login/register modal (OAuth buttons + email/password form)
/student/dashboard       Student home: recent worksheets, scores, subject breakdown
/student/profile         Account settings, linked OAuth providers
/teacher/dashboard       Teacher home: class list, recent activity
/teacher/classes         Class management: create, invite, view students
/teacher/class/:id       Single class view: student list, assign worksheets, view analytics
/teacher/analytics/:classId  Charts and graphs for class performance
/parent/dashboard        (Phase 2) Parent view of child progress
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| OAuth provider downtime (Google) prevents login | **High** | Implement local email/password fallback, cache user sessions for 7 days |
| DynamoDB hot partition (all students in one class write simultaneously) | **Medium** | Use `studentId` as PK (distributes writes), `worksheetId#timestamp` as SK |
| Cognito cold start latency (first login >5s) | **Medium** | Pre-warm Lambda authorizer, cache Cognito JWKS endpoint |
| Email verification emails going to spam | **High** | Use AWS SES with verified domain (SPF/DKIM), test with Gmail/Outlook |
| FERPA compliance for student data | **Critical** | Encrypt at rest (DynamoDB encryption), encrypt in transit (HTTPS), no PII in logs, add data deletion API |
| Teacher uploads CSV with wrong worksheet ID | **Low** | Validate worksheetId exists in S3 before saving, return friendly error |

---

## QA Test Scenarios (Minimum for MVP Sign-Off)

**Authentication:**
1. Student registers with Google OAuth → profile created
2. Student registers with email/password → verification email sent → clicks link → account activated
3. Student tries to solve online without login → blocked with "Sign in required" modal
4. Student logs in, solves worksheet, logs out, logs back in → sees saved progress

**Class Management:**
5. Teacher creates class → gets invite code → shares with student → student joins → appears in teacher's student list
6. Student tries to join class with invalid invite code → friendly error message
7. Teacher views class analytics → sees bar chart with topic averages

**Progress Tracking:**
8. Student completes worksheet online → score/answers saved to DynamoDB within 1 second
9. Student views dashboard → sees list of completed worksheets with scores
10. Teacher views student progress → sees per-topic accuracy breakdown

**Boundary Cases:**
11. Student attempts same worksheet 10 times → all 10 saved, dashboard shows "best: 90%, latest: 85%"
12. Teacher uploads CSV with 200 students → processes successfully
13. Student completes worksheet but is in 3 Math classes → prompted to select which class

**Performance:**
14. Load test: 100 students solve worksheets concurrently → all saves succeed, p99 latency <1s
15. Analytics page with 30 students, 300 worksheet attempts → renders in <3 seconds

---

## Definition of Done

**This feature is complete when:**
- [ ] All MVP acceptance criteria pass QA validation
- [ ] DynamoDB tables provisioned in dev/staging/prod
- [ ] AWS Cognito user pool configured with Google OAuth
- [ ] Lambda functions deployed and tested in staging
- [ ] Frontend UI passes UX review and mobile responsive test
- [ ] Security review complete (no high/critical vulnerabilities)
- [ ] Documentation written: teacher onboarding guide, student FAQ, API docs
- [ ] Load test passes: 100 concurrent users, <1s p99 latency
- [ ] Privacy policy updated to mention student data storage
- [ ] FERPA compliance checklist signed off by legal

---

## Next Steps

1. **BA + Product Owner** → Review open questions (mark date), prioritize MVP vs Phase 2 features
2. **BA + DBA** → Finalize DynamoDB schema, write to schema doc
3. **BA + IaC** → Review AWS service list, estimate monthly cost ($X/month for Y users)
4. **BA → DEV** → Hand off this spec + schema → DEV builds Lambda handlers + frontend pages
5. **BA → QA** → Hand off acceptance criteria → QA writes test cases
6. **BA → UI** → Hand off user stories → UI designs login flow, dashboard mockups
7. **BA → DevOps** → Notify of new AWS services (Cognito, DynamoDB) → update IaC/CDK

**Estimated Timeline:**
- Spec approval: 2 days
- DBA schema finalization: 3 days
- IaC/Cognito setup: 5 days
- DEV implementation: 20 days
- QA testing: 10 days
- Staging deploy + review: 5 days
- **Total: 6 weeks to MVP launch**

---

**Document Status:** ✅ Ready for Review  
**Next Reviewer:** Product Owner, then DBA for schema validation  
**Questions/Feedback:** Tag @ba-agent in Slack or comment in this doc
