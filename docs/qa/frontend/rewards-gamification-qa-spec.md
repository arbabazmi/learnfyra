# QA Acceptance & Risk Checklist: Learnfyra Rewards Flow

**Feature ID:** LFR-REWARDS-001  
**QA Owner:** QA Agent  
**Date:** March 24, 2026  
**Status:** Pre-Implementation — Requirements Definition  
**Related:** Student Authentication (LFR-002), Online Solve (LFR-001)

---

## Overview

This QA specification covers testing for Learnfyra's rewards and gamification system with DynamoDB precomputed statistics. The rewards flow includes:
- **Points System** — earn points per worksheet, question, or accuracy
- **Badges** — achievement unlocks (e.g., "Perfect Score", "5-Day Streak")
- **Streaks** — consecutive daily practice tracking
- **Leaderboards** — class rankings with privacy controls
- **Class Goals** — collaborative targets set by teachers

**Key Architecture Assumption:** Precomputed aggregates stored in DynamoDB (points totals, streak counters, badge counts) with eventual consistency guarantees. Recomputation jobs run nightly to ensure accuracy.

---

## 1. Test Matrix: Points, Badges, Streaks, Leaderboards, Class Goals

### 1.1 Points System Test Matrix

| Test ID | Scenario | Input | Expected Behavior | Boundary/Edge Case |
|---------|----------|-------|-------------------|-------------------|
| **PTS-001** | First worksheet completion | Student completes 10/10 worksheet | +10 points to totalPoints, history record created | First-time user: verify no prior points |
| **PTS-002** | Partial credit scoring | Student scores 7/10 | +7 points added | Verify fractional questions (e.g., 0.5 points) round correctly |
| **PTS-003** | Zero-score submission | Student scores 0/10 | 0 points added, attempt logged | Verify no negative points awarded |
| **PTS-004** | Bonus points for speed | Student finishes in <50% estimated time | +10 base points + 2 bonus = 12 total | Time threshold varies by difficulty (Easy: 40%, Hard: 60%) |
| **PTS-005** | Bonus points for perfect score | Student scores 10/10 | +10 base + 5 bonus = 15 total | Verify bonus only awarded once per unique worksheet |
| **PTS-006** | Retry penalty | Student retakes same worksheet (2nd attempt) | Points awarded but marked as "retry" (50% value) | 3rd+ attempts: 25% value or 0? |
| **PTS-007** | Concurrent submissions | 2 worksheets submitted within 1 second | Both processed, points added independently | Race condition: verify no duplicate awards |
| **PTS-008** | Points rollback on cheating detection | System flags answer pattern as suspicious | Points deducted, attempt marked invalid | Negative balance protection: min 0 points |
| **PTS-009** | Daily points cap | Student earns 500 points in one day | Cap enforced at 500/day for fairness | Verify cap resets at midnight UTC |
| **PTS-010** | Historical points query | Teacher views student points over 30 days | Returns daily breakdown + cumulative total | Large dataset: test with 365+ days of data |
| **PTS-011** | Points migration (schema change) | DBA updates points formula retroactively | Batch recomputation job updates all records | Idempotency: running twice yields same result |
| **PTS-012** | Points for offline worksheet upload | Teacher uploads CSV with scores | Points calculated and backfilled with upload timestamp | Verify timestamp is upload date, not completion date |

**Precomputed Fields to Test:**
- `totalPoints` (student-level aggregate)
- `classPoints` (class-level aggregate)
- `subjectPoints` (per-subject aggregate, e.g., Math: 320, ELA: 180)
- `dailyPointsHistory[]` (time-series array for charts)

---

### 1.2 Badges System Test Matrix

| Test ID | Scenario | Condition | Expected Behavior | Edge Case |
|---------|----------|-----------|-------------------|-----------|
| **BDG-001** | First badge unlock | Student scores 10/10 for first time | Badge "Perfect Score I" awarded, notification shown | Verify notification only shown once |
| **BDG-002** | Tiered badge progression | Student scores 10/10 three times | Badges: "Perfect Score I" → "II" → "III" awarded sequentially | Verify tiers don't skip (can't get III without I and II) |
| **BDG-003** | Streak badge unlock | Student completes 5 days in a row | Badge "5-Day Streak" unlocked | Verify badge persists even if streak breaks later |
| **BDG-004** | Multiple badges unlock simultaneously | Single worksheet triggers 3 badge conditions | All 3 badges awarded, all 3 notifications shown | Verify notification order (highest-tier first) |
| **BDG-005** | Badge revoke on rule violation | Student gets perfect score badge, later flagged for cheating | Badge revoked, removed from profile | Verify badge history audit log records revocation |
| **BDG-006** | Rare badge unlock (1% of users) | Student achieves "Math Master" (100 worksheets + 90% avg) | Badge awarded, marked as "rare" in UI | Verify rarity % updates dynamically |
| **BDG-007** | Badge unlock near midnight | Condition met at 23:59:58 UTC | Badge awarded with timestamp, streak day counted correctly | Timezone handling: verify student local time doesn't affect UTC logic |
| **BDG-008** | Badge unlock after account merge | OAuth account links to existing local account with badges | Both badge sets merged, no duplicates | Verify badge IDs unique across merge |
| **BDG-009** | Teacher-specific badge | Teacher assigns 50 worksheets | Badge "Super Teacher" unlocked | Verify student badges and teacher badges are separate |
| **BDG-010** | Badge unlock with missing data | Worksheet submission missing topic field | Badge "Topic Explorer" fails to unlock gracefully | Verify no crash, warning logged |
| **BDG-011** | Badge query performance | Student profile loads with 50+ badges | Page loads in <2 seconds, badges sorted by unlock date | Verify pagination or lazy loading for 100+ badges |
| **BDG-012** | Badge unlock idempotency | System recomputes badges for student | Duplicate badge not created, single record updated | Run batch job 3x, verify badge count unchanged |

**Precomputed Fields to Test:**
- `badgesEarned[]` (array of badge IDs + unlock timestamps)
- `badgeCount` (integer, updated on each unlock)
- `rareBadgeCount` (count of badges with <5% unlock rate)

---

### 1.3 Streaks System Test Matrix

| Test ID | Scenario | Input | Expected Behavior | Edge Case |
|---------|----------|-------|-------------------|-----------|
| **STR-001** | First day of streak | Student completes first worksheet ever | `currentStreak = 1`, `longestStreak = 1` | Verify `lastActivityDate = today` |
| **STR-002** | Streak continues (consecutive days) | Student completes worksheet on Day 2 | `currentStreak = 2`, `longestStreak = 2` | Verify 2+ worksheets same day counted as 1 day |
| **STR-003** | Streak breaks (missed day) | Student completes worksheet on Day 1, skip Day 2, complete Day 3 | `currentStreak = 1` (reset), `longestStreak = 1` | Verify `lastActivityDate` updated to Day 3 |
| **STR-004** | Streak maintained across time zones | Student in PST completes at 23:00 PST, travels to EST, completes at 02:00 EST (next day UTC) | `currentStreak = 2` (UTC days differ) | Verify UTC date used, not local time |
| **STR-005** | Streak freeze (grace period) | Student uses "Streak Freeze" power-up, skips Day 2 | `currentStreak = 2` maintained, freeze consumed | Verify max 2 freezes per month |
| **STR-006** | Streak recovery notification | Student breaks 10-day streak | Notification: "Your streak ended. Start a new one today!" | Verify notification tone is encouraging, not punitive |
| **STR-007** | Longest streak record | `currentStreak = 15` exceeds previous `longestStreak = 12` | `longestStreak` updated to 15 | Verify historical longest never decreases |
| **STR-008** | Streak at year boundary | Student has 5-day streak, completes on Dec 31 and Jan 1 | `currentStreak = 7` continues across year | Verify no reset at calendar year rollover |
| **STR-009** | Streak with offline worksheet upload | Teacher uploads score for student on Day 2 (backdated) | Streak logic: if upload date ≤ 1 day after last activity, maintain streak | Verify upload timestamp vs completion timestamp handling |
| **STR-010** | Concurrent worksheet submissions on same day | Student submits 3 worksheets within 1 minute | `currentStreak` increments by 1 only, not 3 | Verify daily uniqueness check |
| **STR-011** | Streak query during maintenance window | Student queries streak while recompute job running | Returns cached value or eventual consistency warning | Verify no crash, graceful degradation |
| **STR-012** | Streak for guest users | Guest student completes worksheets 3 days in row (no login) | No streak tracked (requires authentication) | Verify guest banner prompts "Sign in to track streaks" |

**Precomputed Fields to Test:**
- `currentStreak` (integer, updated on each worksheet completion)
- `longestStreak` (integer, historical max, never decreases)
- `lastActivityDate` (ISO-8601 date, UTC)
- `streakFreezes` (integer, consumed count, max 2/month)
- `streakHistory[]` (time-series: `[{ date: "2026-03-01", streakValue: 5 }]`)

---

### 1.4 Leaderboards System Test Matrix

| Test ID | Scenario | Scope | Expected Behavior | Privacy/Edge Case |
|---------|----------|-------|-------------------|-------------------|
| **LDR-001** | Class leaderboard (default) | Teacher views Class 3A leaderboard | Top 10 students ranked by `totalPoints`, ties broken by `lastActivityDate` | Verify student's own rank always shown even if outside top 10 |
| **LDR-002** | Weekly leaderboard reset | Teacher sets leaderboard to "weekly" mode | Points reset every Monday 00:00 UTC, historical data archived | Verify Monday edge case (submissions at 23:59 Sun vs 00:01 Mon) |
| **LDR-003** | Subject-specific leaderboard | Student views "Math" leaderboard for Class 3A | Ranks based on `subjectPoints.Math` only | Verify students with 0 Math points excluded or ranked last |
| **LDR-004** | School-wide leaderboard (opt-in) | Admin enables school-wide leaderboard | All classes combined, students opt-in via privacy settings | Verify default = opt-out, requires explicit consent |
| **LDR-005** | Anonymous leaderboard mode | Parent disables child's name display | Leaderboard shows "Student A", "Student B" instead of names | Verify student can still see their own real name |
| **LDR-006** | Leaderboard with tied scores | 3 students have 250 points, submitted at same timestamp (race condition) | Tie broken by `studentId` (alphanumeric sort) or shared rank | Verify UI shows "Rank 2 (tied)" for all 3 |
| **LDR-007** | Leaderboard update latency | Student completes worksheet, immediately checks leaderboard | Rank updates within 5 seconds (eventual consistency) | Verify stale cache not shown >30 seconds |
| **LDR-008** | Leaderboard pagination | Class has 150 students | Leaderboard paginates 25 per page, API supports cursor-based pagination | Verify DynamoDB query with `LastEvaluatedKey` |
| **LDR-009** | Leaderboard for small class | Class has 2 students only | Both students shown, no "insufficient data" message | Verify min class size = 1 student |
| **LDR-010** | Historical leaderboard snapshot | Teacher views leaderboard snapshot from "March 1-7" | Archived data retrieved, no live updates | Verify snapshot immutability (no retroactive changes) |
| **LDR-011** | Leaderboard cheater removal | Student flagged for cheating, points deducted | Rank recalculated, cheater drops 10 positions | Verify real-time rank updates for all affected students |
| **LDR-012** | Leaderboard with deleted student | Student account deleted (GDPR request) | Leaderboard excludes deleted student, ranks adjust | Verify historical snapshots redacted or anonymized |
| **LDR-013** | Leaderboard stress test | Query leaderboard with 10,000 students (district-wide) | Returns top 100 in <3 seconds via DynamoDB GSI | Verify DynamoDB capacity mode (on-demand vs provisioned) |

**Precomputed Fields to Test:**
- `classRank` (integer, student's rank in class, updated nightly)
- `schoolRank` (integer, opt-in only, updated nightly)
- `weeklyPoints` (resets Monday 00:00 UTC)
- `leaderboardVisibility` (enum: visible | anonymous | hidden)

---

### 1.5 Class Goals System Test Matrix

| Test ID | Scenario | Goal Type | Expected Behavior | Edge Case |
|---------|----------|-----------|-------------------|-----------|
| **CGO-001** | Teacher sets class goal | "Reach 1000 total class points by Friday" | Goal stored with target, deadline, progress bar shown to class | Verify goal visibility: teacher + students in class only |
| **CGO-002** | Class goal progress tracking | Class earns 250 points (25% of 1000) | Progress bar updates to 25%, "750 to go!" message | Verify progress updates in real-time (<10 seconds latency) |
| **CGO-003** | Class goal achieved | Class reaches 1000 points before deadline | Goal marked "Achieved ✅", celebration notification to all students | Verify achievement timestamp recorded, cannot be unachieved even if points deducted later |
| **CGO-004** | Class goal failed | Deadline passes, class at 800/1000 points | Goal marked "Not Achieved", no negative messaging | Verify UI shows encouraging message: "Great effort! Try again next week." |
| **CGO-005** | Multiple active goals | Teacher sets 3 goals: points, completion rate, streak | All 3 progress bars shown, updated independently | Verify max 5 active goals per class to avoid UI clutter |
| **CGO-006** | Goal with streak requirement | "10 students maintain 5-day streak" | Progress: "7/10 students have 5+ day streak" | Verify only current streaks count, not historical `longestStreak` |
| **CGO-007** | Goal recalculation after cheating detected | Class at 950/1000 points, cheater's 100 points deducted | Progress drops to 850/1000, goal timeline updated | Verify retroactive deduction doesn't mark goal as "failed" if still achievable |
| **CGO-008** | Goal deadline extension | Teacher extends deadline from Friday to Monday | New deadline shown, progress timeline adjusted | Verify no retroactive goal achievement (if extended after original deadline passed) |
| **CGO-009** | Goal contribution leaderboard | Sub-leaderboard shows "Top Contributors to Class Goal" | Students ranked by points earned toward current goal only | Verify resets when new goal starts |
| **CGO-010** | Goal for multi-class group | Teacher groups Class 3A + 3B for shared goal | Aggregates points from both classes | Verify student can only see their class's contribution breakdown |
| **CGO-011** | Goal notification triggers | Class reaches 50%, 75%, 100% of goal | Notifications sent at each milestone | Verify max 1 notification per milestone (no duplicates if recalculated) |
| **CGO-012** | Goal with custom reward | Teacher sets custom reward: "Pizza party if goal met" | Reward text shown in goal card, no automated fulfillment | Verify reward is informational only, no API integration required (MVP) |
| **CGO-013** | Goal data retention | Goal completed 90 days ago | Goal archived, visible in "Past Goals" history tab | Verify DynamoDB TTL or lifecycle policy for goals >1 year old |

**Precomputed Fields to Test:**
- `classGoalProgress` (object: `{ goalId, currentValue, targetValue, deadline }`)
- `activeGoalsCount` (integer, max 5 per class)
- `goalContributions[]` (per-student contribution to current goals)

---

## 2. Anti-Cheat Test Cases

### 2.1 Answer Pattern Detection

| Test ID | Scenario | Detection Method | Expected Behavior | False Positive Check |
|---------|----------|------------------|-------------------|---------------------|
| **AC-001** | Sequential answer pattern | Student answers A, B, C, D, A, B, C, D | Flag as suspicious (pattern confidence >80%) | Verify legitimate random sequence not flagged |
| **AC-002** | All same answer | Student selects "B" for all 20 questions | Auto-flag, require manual review | Verify true/false questions exempt (only 2 options) |
| **AC-003** | Impossibly fast submission | 20-question worksheet submitted in 30 seconds | Flag as suspicious (avg <2 sec per question) | Verify retake submissions with memorized answers allowed if >5 min |
| **AC-004** | Copy-paste detection | Student answers with identical formatting/whitespace to answer key | Flag if text match >95% including whitespace | Verify short answers like "42" or "Yes" not flagged |
| **AC-005** | Identical submissions (collusion) | Two students submit identical answers within 1 minute | Both flagged, teacher notified | Verify multiple-choice with 4 options has 1/256 chance for 8-question match |
| **AC-006** | Answer time distribution anomaly | Student answers Q1-Q15 in 10 min, Q16-Q20 in 5 seconds | Flag rapid completion of final questions | Verify students who review answers at end not penalized |
| **AC-007** | Browser dev tools detection | Student opens dev tools, modifies DOM to show answers | `console.log` trap logs dev tools open event | Verify false positives: students who resize window |
| **AC-008** | Tab switching detection | Student switches tabs 15 times during worksheet | Warning logged, displayed to teacher as "high tab switches" | Verify legitimate use case: looking up definitions not auto-flagged |
| **AC-009** | Repeated answer edits before submit | Student changes Q5 answer 8 times in 10 seconds | Flag as suspicious (possible external help) | Verify legitimate uncertainty (2-3 edits) not flagged |
| **AC-010** | Perfect score on first attempt (hard difficulty) | Student scores 20/20 on "Hard" worksheet, first attempt, avg time | Review profile: if new account, flag for review | Verify students with 90%+ historical avg not flagged |
| **AC-011** | IP address mismatch | Student account logs in from 2 IPs 1000 miles apart within 10 minutes | Flag as potential account sharing | Verify VPN/proxy users not auto-banned (warning only) |
| **AC-012** | Batch upload score manipulation | Teacher uploads offline scores, all students suspiciously high | Flag for admin review if class avg >95% (vs historical 75%) | Verify one-time class improvement (new curriculum) not flagged |

**Anti-Cheat Precomputed Flags:**
- `suspiciousAttemptCount` (integer, increments on each flag)
- `lastFlaggedDate` (timestamp)
- `autoReviewRequired` (boolean, if ≥3 flags in 7 days)

---

### 2.2 Multi-Account Detection

| Test ID | Scenario | Detection Method | Expected Behavior | Privacy Consideration |
|---------|----------|------------------|-------------------|----------------------|
| **MAC-001** | Same device/browser fingerprint | Two student accounts log in from same browser fingerprint | Flag as potential sibling account or single-player abuse | Verify family accounts (parent + 2 children) not flagged |
| **MAC-002** | Similar naming pattern | Accounts "JohnDoe123", "JohnDoe456", "JohnDoe789" | Flag for manual review | Verify common names (John Smith) not flagged |
| **MAC-003** | Email pattern matching | `student+1@gmail.com`, `student+2@gmail.com` (same base email) | Link accounts as "related", no auto-ban | Verify teacher explicitly allows sibling linking |
| **MAC-004** | Rapid account creation | 5 accounts created from same IP within 10 minutes | Rate-limit: max 3 accounts per IP per day | Verify school computer lab (shared IP) not blocked |
| **MAC-005** | Score farming (alts) | Student creates 3 accounts, completes worksheets, earns rewards | Detect via device fingerprint + gameplay pattern similarity | Verify legitimate siblings not penalized |

---

## 3. Recompute Consistency Tests for Precomputed Aggregates

### 3.1 Nightly Batch Recomputation

| Test ID | Scenario | Workflow | Expected Consistency | Recovery Case |
|---------|----------|----------|---------------------|---------------|
| **RCP-001** | Full recompute job (nightly 02:00 UTC) | Lambda scans all DynamoDB records, recalculates `totalPoints`, `badgeCount`, `currentStreak` | All student records match live aggregates within 0.1% variance | If variance >0.1%, flag for manual review |
| **RCP-002** | Incremental recompute (hourly) | Lambda queries last 1 hour of worksheet submissions, updates affected students only | Updates processed in <5 minutes for 1000 submissions/hour | If job times out, retry with smaller batch size (500) |
| **RCP-003** | Recompute after schema migration | DBA adds new field `weeklyPoints`, triggers backfill job | All historical records updated with `weeklyPoints = 0` default | Verify no overwrite of existing `totalPoints` |
| **RCP-004** | Recompute with missing data | Student record missing `lastActivityDate` | Job fills with first worksheet submission date or account creation date | Verify no crash, logs warning for each missing field |
| **RCP-005** | Recompute idempotency | Job runs 3 times in 1 day (manual trigger + automated) | Final aggregates identical after each run | Verify no duplicate badge unlocks or points awarded |
| **RCP-006** | Recompute performance test | Job processes 100,000 student records | Completes in <30 minutes, DynamoDB RCU/WCU within budget | Verify no throttling errors (ProvisionedThroughputExceededException) |
| **RCP-007** | Recompute rollback on failure | Job fails at 50% completion (Lambda timeout) | Partial updates rolled back, job restarts from checkpoint | Verify DynamoDB transactions or checkpoint markers |
| **RCP-008** | Leaderboard recalculation | Nightly job recalculates `classRank` for all students | Ranks updated consistently, no duplicate ranks within class | Verify ties handled: shared rank or alphanumeric sort |
| **RCP-009** | Streak recomputation edge case | Student completed worksheets on Days 1, 2, 4, 5, 7 (gaps on 3 and 6) | Recompute confirms `longestStreak = 2` (Days 4-5), `currentStreak = 1` | Verify job correctly identifies streak breaks |
| **RCP-010** | Badge recomputation after rule change | Badge rule updated: "Perfect Score I" now requires 3 perfect scores (was 1) | Job revokes badges from students with <3 perfect scores | Verify audit log records revocation reason |
| **RCP-011** | Class goal progress sync | Recompute job recalculates `classGoalProgress` for 50 active goals | All goal progress bars match sum of student contributions | Verify goal progress never exceeds 100% |
| **RCP-012** | Recompute monitoring/alerting | Job completes but detects 500 records with >1% variance | CloudWatch alarm triggered, SNS email sent to DevOps | Verify alarm threshold: >0.5% variance for >100 records |

**Recompute Job Metrics to Monitor:**
- Job duration (target <30 min)
- Records processed (count)
- Error rate (target <0.01%)
- Variance rate (% of records with inconsistencies)

---

### 3.2 Event-Driven Aggregate Updates (DynamoDB Streams)

| Test ID | Scenario | Trigger | Expected Behavior | Failure Mode |
|---------|----------|---------|-------------------|--------------|
| **EVT-001** | Worksheet submission triggers points update | DynamoDB Streams event: new WorksheetAttempt record | Lambda reads stream, updates `totalPoints` in Students table | If Lambda fails, DLQ captures event for retry |
| **EVT-002** | Badge unlock triggers notification | Badge awarded, DynamoDB Streams event fires | SNS publishes notification to student's device | Verify idempotency: badge unlock event processed once only |
| **EVT-003** | Streak update triggers badge check | `currentStreak` increments to 5 | Lambda checks badge conditions, awards "5-Day Streak" badge | Verify circular dependency: badge unlock doesn't re-trigger stream |
| **EVT-004** | Leaderboard update on points change | Student's `totalPoints` updated | GSI on `classId + totalPoints` auto-updates, no manual Lambda needed | Verify GSI update latency <5 seconds |
| **EVT-005** | Class goal progress update | Student completes worksheet, `classGoalProgress` stale | Stream Lambda aggregates new points, updates goal progress | Verify eventual consistency: progress bar updates within 10 seconds |
| **EVT-006** | Concurrent stream events (race condition) | 2 worksheets submitted by same student simultaneously | Both events processed independently, `totalPoints` incremented twice | Verify atomic increment (no lost updates) |
| **EVT-007** | Stream processing lag during peak traffic | 1000 worksheet submissions in 1 minute | Stream processes with <1 min delay, no events dropped | Verify DynamoDB Streams retention (24 hours) if Lambda throttled |
| **EVT-008** | Stream event with malformed data | WorksheetAttempt record missing `score` field | Lambda skips record, logs error, continues processing | Verify DLQ for manual investigation |

---

## 4. Fairness & Privacy Checks

### 4.1 Fairness Test Cases

| Test ID | Scenario | Fairness Concern | Expected Behavior | Mitigation |
|---------|----------|------------------|-------------------|------------|
| **FAR-001** | Point inflation for advanced topics | Hard worksheets award 20 points, Easy award 5 points | Students selecting Hard have 4x earning potential | Normalize points: Easy 10, Medium 10, Hard 10 (difficulty affects badge unlock, not raw points) |
| **FAR-002** | Leaderboard advantage for high-frequency users | Student completes 10 worksheets/day, others do 1/day | High-frequency user dominates leaderboard | Implement daily points cap (500/day) or "quality over quantity" scoring |
| **FAR-003** | Streak bias toward daily access | Students without daily internet access can't maintain streaks | Streak system disadvantages low-connectivity students | Implement "Streak Freeze" power-up (2/month) or weekly activity alternative |
| **FAR-004** | Subject-specific leaderboard prevents well-rounded students | Student excels in Math (500 pts) and ELA (400 pts), but Math-only leaderboard shows Math specialists | Combined leaderboards favor specialists | Offer "All-Around Achiever" badge for balanced performance across subjects |
| **FAR-005** | Badge unlock timing favors early adopters | Rare badge "First 100 Users" awarded in first month | New students can never unlock this badge | Limit time-gated badges, focus on skill-based achievements |
| **FAR-006** | Class goal penalizes small classes | Class of 5 students must reach 1000 points (200/student), class of 25 needs 40/student | Small classes have unrealistic targets | Scale goals by class size: target = `basePoints × studentCount` |
| **FAR-007** | Offline students disadvantaged | Student completes worksheets offline (teacher uploads CSV), no real-time points | Delayed points update affects leaderboard ranking | Backdate points to worksheet completion date (from CSV), not upload date |
| **FAR-008** | Grade-level fairness | Grade 1 worksheets have 5 questions, Grade 10 have 30 questions | Grade 10 students earn 6x more points per worksheet | Normalize points per question (2 points/question), not per worksheet |
| **FAR-009** | Retry penalty discourages learning | Student scores 3/10, retries, scores 9/10 (retry = 50% points = 4.5) | Penalty discourages productive retry | Award 100% points for retries if score improves by ≥50% |
| **FAR-010** | Teacher favoritism detection | Teacher manually adjusts student points (CSV upload with inflated scores) | Admin review identifies unusual class avg (95% vs school avg 78%) | Flag classes with >2 standard deviations above mean for audit |

**Fairness Metrics to Monitor:**
- Points distribution (histogram by grade, subject, student segment)
- Leaderboard churn rate (% of top 10 that changes weekly)
- Badge unlock rate by demographic (avoid creating "unreachable" badges)

---

### 4.2 Privacy Test Cases

| Test ID | Scenario | Privacy Concern | Expected Behavior | COPPA/FERPA Compliance |
|---------|----------|-----------------|-------------------|----------------------|
| **PRV-001** | Leaderboard displays student names | Full names visible to entire class (25 students) | Privacy: student/parent can opt out, show "Student A" instead | FERPA: leaderboard is "directory information", requires opt-in consent |
| **PRV-002** | Public school-wide leaderboard | 1000 students across school, names visible district-wide | Default to opt-out, require explicit consent for public display | Verify parental consent required for students <13 (COPPA) |
| **PRV-003** | Badge unlock notification exposes student performance | Notification: "Emma scored 10/10!" sent to entire class | Disable broadcast notifications, make opt-in only | FERPA: educational records cannot be shared without consent |
| **PRV-004** | Historical leaderboard reveals performance trends | Teacher views archived leaderboard from 6 months ago | Historical data available to teacher only, not students | Verify data retention policy: delete after 1 year |
| **PRV-005** | Class goal progress shows individual contributions | Progress bar tooltip: "Top contributor: John (250 points)" | Hide individual contributions in public view, show aggregate only | Verify students can see own contribution privately |
| **PRV-006** | Parent views child's leaderboard rank | Parent logs in, sees "Your child ranks 18/25 in Math" | Parent sees child's rank but NOT other students' names/scores | COPPA: parent can access own child's data only |
| **PRV-007** | Student profile displays badges publicly | Student profile page shows 15 badges (viewable by classmates) | Privacy: default to classmates-only, option to hide from all | Verify profile visibility settings: public / class-only / private |
| **PRV-008** | API exposes student data in response | `GET /api/students/leaderboard` returns names, emails, scores | Exclude email addresses, return only anonymized IDs for non-teachers | Verify rate limiting (max 100 requests/min) to prevent scraping |
| **PRV-009** | Deleted account still visible in leaderboard history | Student requests account deletion (GDPR/CCPA), name persists in archived leaderboards | Anonymize name to "Deleted User [ID]", retain aggregate stats | GDPR: right to erasure, retain data only if legally required |
| **PRV-010** | Exported class reports contain PII | Teacher exports CSV with student names, emails, scores | Include privacy warning: "Contains PII, do not share externally" | FERPA: electronic records have same protections as paper |
| **PRV-011** | Screenshot leaderboard (cannot prevent) | Student screenshots leaderboard, shares on social media | UI watermark: date + class name + "Confidential" | Educate users: leaderboard data is educational record (policy only, no tech enforcement) |
| **PRV-012** | Third-party analytics tracking | Google Analytics tracks student leaderboard page views | Disable third-party trackers on student-facing pages | COPPA: no tracking of students <13 without parental consent |

**Privacy Precomputed Flags:**
- `leaderboardVisibility` (enum: visible | anonymous | hidden)
- `badgeDisplayPreference` (enum: public | class | private)
- `parentalConsentCollected` (boolean, required for <13 years old)

---

## 5. QA Sign-Off Checklist (Run Before Production Deploy)

### must-pass criteria

- [ ] **Points System:** All 12 test cases in Section 1.1 pass with 0 failures
- [ ] **Badges System:** All 12 test cases in Section 1.2 pass, badge unlock notifications tested
- [ ] **Streaks System:** All 12 test cases in Section 1.3 pass, timezone edge cases verified
- [ ] **Leaderboards System:** All 13 test cases in Section 1.4 pass, privacy settings enforced
- [ ] **Class Goals System:** All 13 test cases in Section 1.5 pass, deadline edge cases verified
- [ ] **Anti-Cheat:** At least 10/12 cases in Section 2.1 pass (2 false positives allowed), DLQ monitored
- [ ] **Recompute Consistency:** All 12 test cases in Section 3.1 pass, variance <0.1%
- [ ] **Event-Driven Updates:** All 8 test cases in Section 3.2 pass, DLQ empty after test run
- [ ] **Fairness:** All 10 test cases in Section 4.1 pass, no demographic bias detected in metrics
- [ ] **Privacy:** All 12 test cases in Section 4.2 pass, COPPA/FERPA compliance verified by legal

### Performance & Scale Gates

- [ ] **Load Test:** 10,000 concurrent students submit worksheets, all points updated within 30 seconds
- [ ] **DynamoDB Capacity:** On-demand mode handles burst traffic without throttling (ProvisionedThroughputExceededException = 0)
- [ ] **Recompute Job:** Completes in <30 minutes for 100,000 student records
- [ ] **Leaderboard Query:** Returns top 100 students in <2 seconds for queries with 10,000 students
- [ ] **Badge Unlock:** Notification delivered within 5 seconds of condition met
- [ ] **Streak Update:** `currentStreak` visible in UI within 10 seconds of worksheet submission

### Security & Compliance Gates

- [ ] **PII Encryption:** All student names, emails encrypted at rest (DynamoDB encryption enabled)
- [ ] **API Rate Limiting:** 100 requests/min per user, 429 status returned when exceeded
- [ ] **CORS Policy:** Frontend domain whitelisted, no `Access-Control-Allow-Origin: *` in production
- [ ] **IAM Permissions:** Lambda functions follow least-privilege (no `s3:*`, no `dynamodb:*` wildcards)
- [ ] **Parental Consent:** Students <13 cannot opt into public leaderboard without parent approval
- [ ] **Data Retention:** Leaderboard snapshots deleted after 1 year (DynamoDB TTL configured)

### Monitoring & Alerting Setup

- [ ] **CloudWatch Alarms:** Configured for recompute job errors (>1% failure rate)
- [ ] **SNS Notifications:** DevOps notified if DynamoDB throttling detected
- [ ] **Variance Alert:** Alarm triggers if >0.5% of records have inconsistent aggregates
- [ ] **Anti-Cheat Queue:** DLQ monitored daily, flagged attempts reviewed manually
- [ ] **Badge Unlock Failures:** Logged to CloudWatch, alert if >10 failures/hour

---

## 6. Known Limitations & Future Enhancements

### Current Limitations (MVP Scope)

1. **No Real-Time Leaderboard:** Updates every 5-10 seconds due to eventual consistency (acceptable for MVP)
2. **No Personalized Badge Recommendations:** Badge discovery is manual (future: AI-powered suggestions)
3. **No Social Features:** No friend challenges, no team-based competitions (future: multiplayer mode)
4. **No Badge Trading/Marketplace:** Badges are non-transferable (future: consider trade mechanics with teacher approval)
5. **Limited Anti-Cheat:** Pattern detection only, no proctoring or webcam verification (acceptable for K-10 education)

### Future Testing Needs

- **Multi-School Federation:** Test leaderboards across districts (500+ schools)
- **Internationalization:** Test streak logic with non-US timezones, localized badge names
- **Accessibility:** Test leaderboard screen reader compatibility, badge icons with alt text
- **Mobile Apps:** Test native iOS/Android rewards UI, push notification delivery
- **Gamification Fatigue:** Long-term study: do students engage less after 6 months? (requires user research)

---

## 7. Test Data Sets & Fixtures

### Pre-Populated Test Accounts

| Student ID | Name | Profile | Test Purpose |
|------------|------|---------|--------------|
| `test-student-001` | Alice Perfect | 20 worksheets, 100% accuracy, 15-day streak | Test badge unlocks, leaderboard top rank |
| `test-student-002` | Bob Average | 10 worksheets, 75% accuracy, 3-day streak | Test mid-tier performance, no rare badges |
| `test-student-003` | Charlie Struggling | 5 worksheets, 40% accuracy, broken streak | Test encouragement UI, no negative messaging |
| `test-student-004` | Dana Cheater | Flagged 3x for suspicious patterns | Test anti-cheat review queue, teacher notification |
| `test-student-005` | Emma Privacy | Opted out of leaderboard, badges hidden | Test privacy settings, anonymized display |
| `test-student-006` | Frank Offline | 15 worksheets uploaded via CSV (no online account) | Test offline workflow, backfilled points |

### Test Classes

| Class ID | Name | Student Count | Test Purpose |
|----------|------|---------------|--------------|
| `test-class-small` | Mrs. Johnson's 2A | 5 students | Test small-class goal scaling |
| `test-class-medium` | Mr. Lee's 4B | 25 students | Test typical class size, leaderboard pagination |
| `test-class-large` | Ms. Garcia's District | 150 students | Test performance at scale, leaderboard caching |

---

## 8. QA Tools & Automation

### Recommended Testing Tools

- **Unit Tests:** Jest with DynamoDB Local for precomputed aggregate logic
- **Integration Tests:** Postman/Newman for API endpoint testing (points, badges, leaderboards)
- **Load Testing:** Artillery.io for 10,000 concurrent worksheet submissions
- **Anti-Cheat Testing:** Selenium scripts to simulate suspicious behavior (rapid clicks, tab switches)
- **Recompute Testing:** AWS Lambda Local Invoke + DynamoDB Streams replay
- **Privacy Compliance:** OWASP ZAP for API security scanning (no PII leakage in responses)

### CI/CD Integration

- **Pre-Merge:** All unit tests must pass, coverage >80%
- **Staging Deploy:** Run integration test suite (all 100+ test cases), must have 0 failures
- **Production Deploy:** Canary deployment (5% of traffic), monitor error rate for 1 hour before full rollout

---

## Appendix: DynamoDB Schema Assumptions (For Testing)

### Students Table

```
PK: studentId (UUID)
Attributes:
  - totalPoints (number, precomputed)
  - subjectPoints (map: { Math: 320, ELA: 180, Science: 150 })
  - badgesEarned (list: [{ badgeId, unlockedAt }])
  - badgeCount (number, precomputed)
  - currentStreak (number, precomputed)
  - longestStreak (number, precomputed)
  - lastActivityDate (string, ISO-8601)
  - classRank (number, precomputed, updated nightly)
  - leaderboardVisibility (string: visible | anonymous | hidden)
  - suspiciousAttemptCount (number)
```

### WorksheetAttempts Table

```
PK: studentId
SK: worksheetId#timestamp
Attributes:
  - score, totalPoints, percentage
  - timeTaken (seconds)
  - answers[] (list: { questionNumber, studentAnswer, isCorrect, pointsEarned })
  - flagged (boolean, anti-cheat)
  - flagReason (string)
```

### ClassGoals Table

```
PK: classId
SK: goalId
Attributes:
  - goalType (string: points | streak | completion)
  - targetValue (number)
  - currentValue (number, precomputed)
  - deadline (string, ISO-8601)
  - status (string: active | achieved | failed)
  - achievedAt (string, ISO-8601, nullable)
```

### Badges Table (Reference Data)

```
PK: badgeId
Attributes:
  - name (string: "Perfect Score I")
  - description (string)
  - condition (object: { type: "perfectScore", count: 1 })
  - iconUrl (string)
  - rarity (number: 0.0-1.0, % of users who unlocked)
  - tier (number: 1-5)
```

---

**QA Sign-Off:**  
Date: _____________  
QA Lead: _____________  
Status: ☐ Approved for Production ☐ Blocked (see comments)  
Comments: _____________________________________________

