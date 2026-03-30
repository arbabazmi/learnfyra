# Learnfyra Auth, Practice Modes, and Reporting Specification
# File: docs/specs/backend/auth-online-offline-reporting-spec.md
# Version: 1.0
# Date: 2026-03-24
# Branch: feature/ui-redesign
# Status: Design specification only, no code in this phase

---

## Module Name

Student Identity, Practice Mode Control, and Teacher Parent Reporting

---

## Problem Statement

Learnfyra currently focuses on worksheet generation and solving. The next module must add identity and progress intelligence so students, teachers, and parents can use online and offline workflows while preserving learning history and surfacing weaknesses.

This module introduces:

1. Student access model with login and guest paths
2. Strict mode policy where online practice requires authentication
3. Offline workflow for print and manual scoring
4. Persistent result storage linked to class and subject
5. Reporting that reveals strengths, weaknesses, and trends

---

## Non Negotiable Rules

1. Online solve requires login for students
2. Guest mode is offline only
3. OAuth login must include Google and at least one additional free provider
4. Local account fallback must exist for students without OAuth accounts
5. Every stored result must be traceable by student, class, subject, worksheet, and attempt timestamp
6. Teachers and parents must be able to update offline scores
7. Reports must identify weak topics and weak question patterns, not just display averages
8. DynamoDB is the primary operational database for this module
9. Dashboards and reports must read from precomputed aggregates, not ad hoc full scans

---

## User Roles

1. Student Guest
2. Student Authenticated
3. Teacher
4. Parent

Phase 2 optional role:

1. School Admin

---

## User Stories

### Student

1. As a student without an account, I want to download worksheets and practice offline so I can use Learnfyra immediately.
2. As a student, I want to log in with Google or another free OAuth option so I can practice online and track progress.
3. As a student without OAuth access, I want to create a local account so I can still use online practice and saved history.
4. As a logged-in student, I want to see my past attempts and weak topics so I can improve deliberately.

### Teacher

1. As a teacher, I want online student attempts stored automatically by class and subject so I can monitor performance.
2. As a teacher, I want to upload or edit offline scores for printed worksheets so paper usage still contributes to analytics.
3. As a teacher, I want visual reports that show weak topics, weak question types, and student groups at risk so I can plan interventions.

### Parent

1. As a parent, I want to view my child progress online in simple language so I can support learning at home.
2. As a parent, I want to submit offline scores for downloaded worksheets so all practice is captured.
3. As a parent, I want recommended next practice based on weak areas so I know what to assign next.

---

## Experience and Flow

### Student Entry Flow

1. Student lands on worksheet result page
2. Student chooses one of two paths:
3. Download and practice offline as guest
4. Sign in to practice online

Behavior rule:

1. If not authenticated and student clicks online solve, show auth gate
2. Auth gate offers OAuth and local account options

### Online Practice Flow

1. Authenticated student opens solve page
2. Select timed or untimed mode
3. Submit answers
4. System saves:
5. Worksheet metadata
6. Per-question student answer
7. Correct answer
8. Correct or wrong state
9. Score and percentage
10. Subject, topic, class mapping
11. Attempt timestamp and time taken
12. Student sees result breakdown and historical comparison

### Offline Practice Flow

1. Student or teacher downloads worksheet
2. Student solves on paper
3. Teacher or parent updates score manually through upload or entry form
4. System stores offline result with source marked as offline-manual
5. Offline results join analytics with online results but remain source tagged

### Teacher and Parent Analytics Flow

1. Open dashboard
2. Filter by class, student, subject, topic, date range, and mode source
3. Review insights and report cards
4. Export CSV and printable summary

---

## Authentication Strategy

### Supported Methods

1. OAuth provider Google
2. OAuth provider GitHub or Microsoft as second free provider
3. Local email and password account fallback

### Account Linking Rules

1. If same email appears across OAuth and local signup, prompt user to link identities
2. Linked identities map to one internal student record

### Session and Access Rules

1. Guest users cannot access online solve submission endpoints
2. Logged-in users can access online solve and history
3. Teacher and parent roles have scoped access to permitted students only

---

## Data Model Requirements

### Storage and Compute Decision

This module will use:

1. DynamoDB for operational entities and fast lookups
2. S3 for worksheet files and optional cold archives
3. Precomputed aggregate records for report rendering

### Minimal Low-Cost Table Set

1. users
2. attempts
3. aggregates-student
4. aggregates-class-subject
5. reward-state

### Aggregate Update Triggers

1. Online attempt submitted
2. Offline score created
3. Offline score updated
4. Attempt invalidated or corrected

### Recompute and Drift Control

1. Incremental precompute on each write event
2. Daily reconciliation recompute job
3. Idempotent update rules to prevent double counting

Each attempt record must include:

1. attemptId
2. studentId
3. roleSource student or teacher-parent upload
4. worksheetId
5. classId nullable
6. grade
7. subject
8. topic
9. difficulty
10. timed flag
11. timeTaken seconds
12. totalScore
13. totalPoints
14. percentage
15. answers array with questionNumber, studentAnswer, correctAnswer, correct, pointsEarned, pointsPossible
16. createdAt
17. updatedAt
18. submissionSource online or offline-manual

Each student profile must include:

1. studentId
2. displayName
3. authMethods linked
4. parentLink nullable
5. classMemberships
6. createdAt
7. lastActiveAt

---

## Reporting and Analytics

### Required Report Types

1. Student progress trend over time
2. Class topic mastery heatmap
3. Subject weakness ranking
4. Question type accuracy breakdown
5. Timed versus untimed performance comparison
6. Offline versus online performance comparison
7. Intervention list for at-risk students

### Creative Insight Cards

1. Focus This Week card with top three weak topics and suggested worksheet targets
2. Slip Pattern card detecting errors concentrated in a question type such as word problems or matching
3. Confidence Drift card showing decline despite high completion rate
4. Recovery Tracker card showing improvement after targeted practice

### Visualization Recommendations

1. Heatmap for topic mastery by student and class
2. Bar chart for weak subjects and weak topics
3. Line chart for score trend and consistency
4. Distribution chart for class score spread
5. Table with sortable student performance and risk flags

### Mandatory Precomputed Metrics

1. Student overall points and score average
2. Student subject-level and topic-level weakness counters
3. Class subject average and completion rate
4. Class topic weakness ranking
5. Timed versus untimed performance comparison
6. Offline versus online performance comparison

---

## Acceptance Criteria

### Authentication and Mode Control

1. Given a student is not logged in, when they click online solve, then they are required to authenticate before starting online practice.
2. Given a student is not logged in, when they choose guest mode, then they can only download and practice offline.
3. Given a student selects Google login, when OAuth succeeds, then student can start online solve immediately.
4. Given a student has no OAuth account, when they create a local account, then they can access online solve after verification policy is met.

### Online Result Storage

1. Given an authenticated student submits answers, when scoring completes, then result and per-question correctness are saved to persistent storage.
2. Given stored result exists, when student opens history, then attempts are grouped by subject and class context where available.

### Offline Score Updates

1. Given teacher or parent has a printed worksheet result, when they submit manual score update, then the system stores it as offline-manual source.
2. Given offline score conflicts with an existing online attempt, when save occurs, then both attempts remain traceable and conflict is flagged for review.

### Reporting and Weakness Detection

1. Given teacher filters a class and subject, when report renders, then weakest topics and weakest question types are shown.
2. Given parent views child dashboard, when report renders, then data is limited to linked child accounts only.
3. Given no data exists for selected filters, when report renders, then a clear empty state and next-step guidance is shown.

### Boundary and Scale

1. Given student has at least ten attempts on the same worksheet, when history is viewed, then all attempts remain available with best and latest indicators.
2. Given teacher uploads large offline score batch, when processing finishes, then system returns success and error summary by row.

---

## API Surface Proposal

### Auth and Profile

1. POST auth oauth callback
2. POST auth local signup
3. POST auth local login
4. POST auth link account
5. GET student profile

### Practice and Results

1. POST attempt submit online
2. GET student attempts
3. GET student attempt detail
4. POST teacher-parent offline score
5. POST offline score batch upload

### Reporting

1. GET teacher class analytics
2. GET teacher student analytics
3. GET parent child analytics
4. GET weakness recommendations

---

## Security and Compliance Requirements

1. Role-based access control for student, teacher, parent routes
2. Data isolation by ownership and class permissions
3. Secure token validation for all authenticated endpoints
4. Password hashing for local auth credentials
5. Encryption at rest for profile and attempt records
6. Audit logs for score overrides and bulk uploads
7. COPPA-aware parental consent path for underage students
8. FERPA-aware access boundaries and export controls

---

## MVP and Phase Plan

### MVP

1. Student login with Google plus one additional OAuth provider
2. Local account fallback
3. Guest offline-only path
4. Online solve auth gate
5. Persistent attempt storage with per-question correctness
6. Teacher and parent manual offline score entry
7. Core dashboards with weakness by class and subject
8. Reward state tracking for points, badges, and streaks

### Phase 2

1. Bulk offline CSV upload
2. Advanced comparative analytics and predictive risk alerts
3. Parent child multi-account management improvements
4. Assignment automation and suggested worksheet generation from weakness trends
5. School admin hierarchy and cross-class rollups
6. Expanded class goals and optional leaderboard engagement controls

---

## Cost Guardrails

1. Keep GSI count minimal in MVP
2. Avoid report-time heavy scans for dashboard pages
3. Serve UI analytics from precomputed aggregate rows
4. Use TTL for transient or stale non-critical records
5. Recompute in bounded batches with retry and dead-letter handling

---

## Out of Scope for This Module

1. Native iOS or Android apps
2. Peer chat or student social features
3. Paid subscription tiers
4. LMS integrations such as Canvas or Schoology in MVP
5. Real-time classroom leaderboards

---

## Open Questions

1. Which second OAuth provider should be prioritized after Google, GitHub or Microsoft
2. Should local-account email verification be mandatory for online solve or allowed with limited capabilities
3. Should offline upload conflicts default to append-as-new or replace-latest policy
4. How long should detailed per-question answer history be retained
5. Should teacher-parent score overrides require mandatory rationale text

---

## Design Deliverables for Next Step

1. Auth and mode selection wireframes
2. Student history and dashboard wireframes
3. Teacher class analytics and intervention views
4. Parent child progress view with plain-language insights
5. Reporting glossary and metric definition sheet to keep calculations consistent across UI and backend

---

## QA Coverage Reference

Validation depth and test matrix for this module are detailed in [docs/qa/backend/auth-mode-reporting-qa-spec.md](docs/qa/backend/auth-mode-reporting-qa-spec.md).

Reward-specific acceptance and risk coverage are detailed in [docs/qa/rewards-gamification-qa-spec.md](docs/qa/rewards-gamification-qa-spec.md).

Reward mechanics and engagement flow are defined in [docs/specs/reward-engagement-flow-spec.md](docs/specs/reward-engagement-flow-spec.md).

---

## Summary

This module establishes a dual-mode learning model:

1. Guest for quick offline access
2. Authenticated for full online practice and persistent analytics

It also ensures teachers and parents can combine online and offline evidence into one progress record, with reports designed to reveal actionable weaknesses by class and subject.

---

## Implementation Readiness References

1. Local and AWS parity strategy: [docs/technical/platform/LOCAL_DEV_STRATEGY.md](docs/technical/platform/LOCAL_DEV_STRATEGY.md)
2. Implementation checklist: [docs/IMPLEMENTATION_READINESS_CHECKLIST.md](docs/IMPLEMENTATION_READINESS_CHECKLIST.md)