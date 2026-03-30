# Feature Specification: Reward-Based Engagement System

## Feature: Gamified Learning Rewards for Students and Teachers

### User Stories

#### Student Stories
1. **As a student**, I want to earn points when I complete worksheets accurately, so that I feel motivated to practice more.

2. **As a student**, I want to unlock badges for learning milestones (e.g., "Multiplication Master"), so that I can celebrate my progress.

3. **As a student**, I want to maintain a practice streak by solving worksheets regularly, so that I build consistent study habits.

4. **As a student**, I want to see my personal progress over time without being compared publicly to others, so that I can learn at my own pace without pressure.

5. **As a younger student (Grades 1-3)**, I want visual rewards like colorful badges and animations, so that learning feels fun and exciting.

6. **As an older student (Grades 8-10)**, I want to track my improvement with detailed stats (accuracy trends, time spent), so that I can measure my readiness for tests.

#### Teacher Stories
7. **As a teacher**, I want to see class-wide engagement metrics (worksheets completed, average scores), so that I can identify students who need help.

8. **As a teacher**, I want to set class goals (e.g., "Complete 50 worksheets this week"), so that I can motivate collective effort.

9. **As a teacher**, I want to turn off leaderboards or public comparisons, so that struggling students don't feel discouraged.

10. **As a teacher**, I want to award custom badges to students for effort, improvement, or helping peers, so that I can recognize non-academic achievements.

11. **As a teacher**, I want to see which topics students struggle with most (based on repeated low scores), so that I can adjust my lesson plans.

---

## Reward Mechanics

### 1. Points System

#### Earning Points
- **Base Points**: Score percentage × question count
  - Example: 80% on 10 questions = 8 points
- **Accuracy Bonus**: +5 points for 100% correct
- **Speed Bonus**: +3 points if completed in < 50% of estimated time (timed mode only)
- **First Attempt Bonus**: +2 points if scored ≥80% on first try (no retakes)
- **Challenge Bonus**: +10 points for completing "Hard" difficulty worksheets

#### Point Multipliers
- **Streak Multiplier**: Points × (1 + streak_days / 10)
  - Day 1 = 1×, Day 5 = 1.5×, Day 10 = 2×
- **Topic Mastery Multiplier**: Extra 20% points for revisiting previously difficult topics

#### Points Display
- Real-time point animation on score results page
- Cumulative lifetime points
- Monthly points (resets 1st of each month for seasonal goals)

---

### 2. Badges System

#### Badge Categories

**Completion Badges**
- 🎯 First Steps (complete first worksheet)
- 📚 Dedicated Learner (10 worksheets)
- 🏆 Century Club (100 worksheets)
- 💎 Worksheet Legend (500 worksheets)

**Mastery Badges** (per subject + topic)
- ⭐ Silver Star (80%+ on 3 worksheets in same topic)
- 🌟 Gold Star (90%+ on 5 worksheets in same topic)
- 💫 Platinum Star (95%+ on 10 worksheets in same topic)

**Streak Badges**
- 🔥 Week Warrior (7-day streak)
- ⚡ Month Master (30-day streak)
- 🌈 Season Scholar (90-day streak)

**Perfect Score Badges**
- 🎓 Perfect10 (10 perfect scores in any subject)
- 🏅 Ace Squad (50 perfect scores)

**Growth Badges**
- 📈 Rising Star (improve score by 20%+ on retake)
- 🚀 Comeback Kid (score ≥90% after previous score <70%)
- 💪 Persistent Learner (attempt same worksheet 3+ times)

**Teacher-Awarded Badges** (custom)
- 🌟 [Teacher's Custom Text] — teacher manually grants

#### Badge Design Rules
- **Age-Appropriate**: Simple icons for K-5, detailed badges for 6-10
- **No Shaming**: No badges for "slowest" or "lowest" — only positive achievements
- **Privacy Default**: Badges visible only to student and teacher (not peers) unless student opts in

---

### 3. Streaks System

#### Streak Rules
- **Active Days**: Any day with ≥1 worksheet completed with ≥60% score counts
- **Freeze Token**: Students earn 1 freeze token per 7-day streak (max 3 saved)
- **Streak Recovery**: Use 1 freeze token to skip 1 missed day without breaking streak
- **Grace Period**: 24-hour timezone-aware grace window (e.g., submit by 11:59 PM local time)

#### Streak Display
- 🔥 Fire emoji with day count (visual prominence)
- Calendar view showing active days (green checkmarks)
- Motivational message when streak reaches milestones (7, 14, 30, 60, 90 days)

---

### 4. Class Goals System (Teacher-Controlled)

#### Goal Types
1. **Collective Worksheets**: "Complete 100 worksheets as a class this month"
2. **Participation Rate**: "80% of students complete ≥1 worksheet this week"
3. **Average Accuracy**: "Class average score ≥75% this month"
4. **Topic Challenge**: "Everyone complete ≥3 'Fractions' worksheets with 70%+ score"

#### Goal Progress
- Progress bar visible to all students in class
- Anonymous contribution (no individual names shown)
- Celebration animation when goal is met (confetti, success banner)

#### Class Rewards
- Unlock class-wide badge (e.g., "Teamwork Champions")
- Teacher can promise real-world reward (pizza party, extra recess) — tracked outside system

---

### 5. Completion Certificates (Download Option)

#### Certificate Trigger Rules
- Show "Download Certificate" when student completes worksheet with:
  - score >= 70%
  - question count >= 5
- Certificate includes: student name, worksheet topic, score, date, teacher/class (if available)

#### Certificate Types
- **Basic PDF Certificate (MVP)**: generated on demand from results page
- **Persistent Certificate (Phase 2)**: stored and re-downloadable from student profile/history
- **Verifiable Certificate (Phase 3)**: includes verification code/URL

#### Certificate Display Rules
- Student can download own certificate.
- Teacher can view issued certificates for their class.
- Parent can view linked child's certificates.
- Guest mode does not create persistent certificates by default.

---

## Anti-Gaming Rules

### 1. Attempt Throttling
- **Rate Limit**: Max 5 worksheet submissions per hour per student
- **Cooldown for Same Worksheet**: Must wait 15 minutes before re-attempting same worksheet
- **Detection**: If student submits identical worksheet >3 times in <5 minutes, flag for review

### 2. Random Answer Detection
- **Pattern Analysis**: If student selects all A's, all B's, or alternating A/B/C/D on multiple-choice
  - Zero points awarded + warning message: "Take your time and read each question carefully"
- **Low Effort Threshold**: If time spent < 10% of estimated time AND score < 50%
  - No points awarded + message: "This worksheet requires more time to complete thoughtfully"

### 3. Score Integrity
- **No Retroactive Points**: Changing answers after viewing results = no points for retake
- **One-Time Bonuses**: Perfect score bonus, first attempt bonus only count once per worksheet
- **Answer Key Abuse**: If student views answer key, then scores 100% on same worksheet within 2 hours
  - Points awarded but no bonuses + badge progress frozen for that topic

### 4. Streak Abuse Prevention
- **Minimum Effort**: Submitting 1-question worksheets doesn't count for streak
  - Requirement: ≥5 questions AND ≥60% score
- **Duplicate Topic Block**: Completing same worksheet 3× in one day only counts as 1 streak day

### 5. Teacher Controls
- **Reset Option**: Teacher can reset student's points/badges if gaming detected (with log/audit trail)
- **Disable Rewards**: Teacher can turn off rewards entirely for individual students or whole class
- **Manual Review**: Teacher dashboard shows flagged submissions for review

### 6. Privacy & Fairness
- **No Public Shaming**: Lowest scores, slowest times, broken streaks never displayed publicly
- **Opt-In Leaderboards**: Class leaderboards disabled by default; teacher + students must both opt in
- **Anonymous Comparison**: Students can see "You're in top 25%" without seeing names/exact ranks

---

## Acceptance Criteria

### AC1: Points Earned Correctly
**Given** a student completes a 10-question worksheet with 80% accuracy in timed mode  
**When** they submit within 50% of estimated time on their first attempt  
**Then** they earn: (8 base points) + (3 speed bonus) + (2 first attempt bonus) = 13 points  
**And** their total points increase by 13 × their current streak multiplier

### AC2: Badge Unlocked with Notification
**Given** a student has completed 9 worksheets in "Multiplication" topic with 90%+ on all  
**When** they complete the 10th "Multiplication" worksheet with 95%  
**Then** they unlock the "Platinum Star: Multiplication" badge  
**And** they see a celebratory animation on the results page  
**And** the badge appears in their profile badges collection

### AC3: Streak Maintained Across Days
**Given** a student has a 14-day active streak  
**When** they complete 1 worksheet with 70% score at 11:30 PM on Day 15  
**And** they submit nothing on Day 16  
**And** they complete 1 worksheet on Day 17  
**Then** their streak breaks (resets to 1)  
**Unless** they used a freeze token on Day 16, then streak continues to Day 17 = 17 days

### AC4: Anti-Gaming — Random Answers Rejected
**Given** a student submits a 20-question multiple-choice worksheet  
**When** all answers are "A" (or any single letter repeated)  
**And** the worksheet is completed in <10% of estimated time  
**Then** they receive 0 points  
**And** they see warning: "Take your time and read each question carefully"  
**And** their submission is flagged in teacher dashboard

### AC5: Class Goal Progress Updates in Real-Time
**Given** a teacher sets class goal: "Complete 50 worksheets this week"  
**When** students in the class submit worksheets  
**Then** the progress bar updates immediately (WebSocket or poll every 30s)  
**And** when the 50th worksheet is submitted  
**Then** all students in the class see celebration animation  
**And** all students unlock "Class Champion: [Teacher Name]'s Class" badge

### AC6: Teacher Can Disable Leaderboard
**Given** a teacher has leaderboards enabled for their class  
**When** they toggle "Disable Leaderboard" in class settings  
**Then** students in that class no longer see ranking or points comparison  
**And** individual points/badges still accumulate (visible only to individual student)  
**And** class goals remain visible

### AC7: Streak Freeze Token Earned and Used
**Given** a student reaches a 7-day streak  
**When** their streak counter hits day 7  
**Then** they earn 1 freeze token (displayed in streak UI)  
**And** on the next day they miss, they are prompted: "Use freeze token to save streak?"  
**And** if they click "Yes", token is consumed and streak continues

### AC8: AWS Lambda Performance — Reward Calculation
**Given** the reward calculation Lambda function (POST /api/submit includes scoring + points)  
**When** processing a worksheet submission  
**Then** reward calculation adds <500ms to submission response time  
**And** DynamoDB queries for streak/badge data complete in <200ms  
**And** total /api/submit latency remains <2 seconds at p95

### AC9: Badge Data Persists Across Sessions
**Given** a student earned "Week Warrior" badge last week  
**When** they log in today (new session)  
**Then** their badge collection still displays "Week Warrior"  
**And** DynamoDB stores badges in student profile record  
**And** S3 serves badge icon images via CloudFront CDN

### AC10: Completion Certificate Download
**Given** an authenticated student completes a worksheet with score >= 70% and >= 5 questions  
**When** results page is displayed  
**Then** a "Download Certificate" button is visible  
**And** clicking it downloads a valid PDF certificate.

### AC11: Certificate Access Authorization
**Given** a user attempts to access a certificate not in their authorized scope  
**When** certificate download API is called  
**Then** access is denied with authorization error.

---

## AWS Services Involved

### Primary Services
1. **DynamoDB Table: `learnfyra-{env}-student-profiles`**
   - Partition Key: `studentId` (UUID)
   - Sort Key: `profileType#timestamp` (e.g., `POINTS#2026-03-24`, `BADGE#multiplication-master`)
   - GSI: `classId-points-index` for class leaderboards
   - Stores: lifetime points, monthly points, active streak, freeze tokens, unlocked badges

2. **DynamoDB Table: `learnfyra-{env}-class-goals`**
   - Partition Key: `classId`
   - Sort Key: `goalId` (UUID)
   - Stores: goal type, target, progress, deadline, status

3. **Lambda Function: `learnfyra-submit`** (existing — extended)
   - NOW includes: score calculation → reward calculation → badge check → streak update
   - Timeout: increase from 15s to 20s
   - Memory: increase from 256MB to 512MB

4. **Lambda Function: `learnfyra-rewards-dashboard`** (new)
   - GET `/api/rewards/student/:studentId` → student's points, badges, streak
   - GET `/api/rewards/class/:classId` → class goals, progress, leaderboard (if enabled)
   - Timeout: 10s, Memory: 256MB

5. **S3 Bucket: `learnfyra-{env}-s3-assets`** (new)
   - Stores badge SVG/PNG icons
   - CloudFront distribution for fast delivery
   - Path: `/badges/{badge-id}.svg`

6. **CloudWatch Events** (EventBridge)
   - Scheduled rule: Daily at 12:01 AM UTC
   - Triggers Lambda: `learnfyra-streak-check` → breaks streaks for inactive students

### Data Flow
```
Student submits worksheet
  ↓
POST /api/submit → API Gateway → Lambda (learnfyra-submit)
  ↓
1. Score worksheet (existing logic)
2. Calculate points (base + bonuses + multipliers)
3. Check badges (query DynamoDB for progress toward badges)
4. Update streak (check last active day, increment or reset)
5. Update class goal progress (if student in class with active goal)
  ↓
Write to DynamoDB: student-profiles, class-goals
  ↓
Return JSON: { score, points, newBadges[], streak, classGoalProgress }
  ↓
Frontend: Display results + badge animations + streak fire 🔥
```

---

## Out of Scope

### Not Included in Reward System
1. **Real Money or Gift Cards**: No cryptocurrency, no cash prizes, no purchases
2. **External Integrations**: No ClassDojo, Kahoot, or third-party reward platforms (Phase 3+)
3. **Teacher Rewards**: Teachers don't earn points/badges (could be Phase 2+)
4. **Parent Dashboard**: Parents can't view rewards (could be Phase 2+)
5. **Social Sharing**: No "Share my badge on Twitter/Facebook" (privacy first)
6. **Physical Prizes**: System does NOT ship stickers, trophies, or physical goods
7. **Cross-School Leaderboards**: No regional/national rankings (privacy + legal concerns)
8. **AI-Generated Badges**: Badges are pre-designed SVGs, not dynamically generated images

---

## Dependencies

### Must Be Complete Before This Feature
1. ✅ **Online Solve & Submit Flow** (v3.0) — rewards depend on submission scoring
2. ✅ **Student/Class Fields in Worksheet Generation** — need `studentId` and `classId` in metadata
3. ✅ **User Authentication** (if not already built) — rewards require persistent student identities
   - If not built: students get a UUID stored in localStorage (anonymous mode)
   - Long-term: proper login with email/username

### Parallel Development (Can Build Simultaneously)
- **DBA agent**: Design DynamoDB schemas for `student-profiles` and `class-goals`
- **UI agent**: Design badge icons, animations, progress bars
- **DEV agent**: Build reward calculation engine (scorer.js → rewardsEngine.js)

### External Dependencies
- **Badge Icon Design**: Need 20-30 SVG icons designed (could use Figma + export, or stock icons)
- **Teacher Onboarding Docs**: Explain how to enable/disable rewards, set class goals
- **Privacy Policy Update**: Disclose student activity tracking, data retention

---

## Open Questions

### 1. Authentication & Student Identity
**Question**: Do students have individual accounts (login), or are they anonymous (UUID only)?  
**Impact**: If anonymous, rewards are lost if browser data is cleared. If login required, adds authentication complexity.  
**Recommendation**: Start with localStorage UUID (anonymous), add login in Phase 2.

### 2. Age-Gating for Rewards
**Question**: Should rewards be disabled for Grades 1-2 (ages 6-7)?  
**Concerns**: Very young students may not understand gamification, teachers may prefer simpler UI.  
**Recommendation**: Rewards ON by default for all grades, but teacher can disable per class.

### 3. Leaderboard Privacy — FERPA Compliance
**Question**: Does showing student names on leaderboards violate FERPA (USA education privacy law)?  
**Impact**: If yes, leaderboards must be opt-in by BOTH teacher AND student (or show initials only).  
**Recommendation**: Consult legal, default to opt-in + anonymous display ("Student A", "Student B").

### 4. Streak Timezone Handling
**Question**: If student's timezone is unknown, when does their "day" reset?  
**Impact**: Student in California submits at 11:59 PM PST — is that same day or next day in UTC?  
**Recommendation**: Use browser timezone (JavaScript `Intl.DateTimeFormat().resolvedOptions().timeZone`), fallback to account timezone if set, else UTC.

### 5. Badge Icon Licensing
**Question**: Can we use free icon packs (e.g., Font Awesome, Heroicons) for badges?  
**Impact**: Some licenses prohibit commercial use or require attribution.  
**Recommendation**: Use MIT/Apache licensed icons OR commission custom designs (budget ~$500-1000 for 30 badges).

### 6. Reward Expiration
**Question**: Do points expire? Do badges ever get revoked?  
**Impact**: If points expire, students may feel demotivated. If badges can't be revoked, gaming isn't fully preventable.  
**Recommendation**: Points never expire. Badges can ONLY be revoked by teacher with reason logged (abuse prevention).

### 7. Class Goals — Who Sets Them?
**Question**: Can students vote on class goals, or only teacher sets them?  
**Impact**: Student input increases buy-in but adds complexity (voting UI, moderation).  
**Recommendation**: MVP = teacher only. Phase 2 = student suggestions + teacher approval.

### 8. DynamoDB Cost at Scale
**Question**: At 10,000 active students, how much does DynamoDB cost per month?  
**Rough Estimate**:  
- 10,000 students × 5 worksheets/week = 50,000 writes/week = ~7,000 writes/day  
- Badge checks: 50,000 reads/week = ~7,000 reads/day  
- On-Demand pricing: ~$0.01 per 100 writes, $0.002 per 100 reads  
- Monthly: ~$90 writes + $18 reads = **~$108/month**  
**Decision**: Acceptable for MVP. Monitor in Phase 2, consider provisioned throughput if cost exceeds $500/month.

---

## MVP vs Phase 2

### MVP (Minimum Viable Product) — Ship This First

#### Core Features
✅ **Points System**
- Base points (accuracy × questions)
- Accuracy bonus (+5 for 100%)
- Streak multiplier
- Display on results page

✅ **Basic Badges** (10 badges total)
- First Steps (1st worksheet)
- Dedicated Learner (10 worksheets)
- Week Warrior (7-day streak)
- Silver/Gold/Platinum Stars (per topic, 80%/90%/95% thresholds)
- Perfect10 (10 perfect scores)

✅ **Streak System**
- Daily streak counter
- 24-hour grace period
- Freeze tokens (earn 1 per 7-day streak, max 3 stored)
- Visual fire icon 🔥

✅ **Anti-Gaming Rules**
- Attempt throttling (5/hour max)
- Random answer detection (all A's, all B's)
- Low-effort detection (time < 10% + score < 50%)

✅ **Teacher Dashboard — Basic**
- View class-wide stats (total worksheets, avg score)
- See flagged submissions
- Toggle leaderboard ON/OFF

#### MVP Scope Constraints
- **No Class Goals** (deferred to Phase 2)
- **No Custom Teacher-Awarded Badges** (pre-defined badges only)
- **No Leaderboards** (points/badges visible only to individual student + teacher)
- **No Parent View** (students and teachers only)
- **Anonymous Mode** (localStorage UUID, no login required)

#### MVP Success Metrics
- 50%+ students complete ≥2 worksheets in first week (engagement)
- Teachers rate rewards 8/10+ on "motivates students" survey
- <5% of submissions flagged for gaming behavior
- Reward calculation adds <1s to submission latency

---

### Phase 2 — Advanced Engagement

#### Additional Features
✅ **Class Goals System**
- Teacher-set collective goals (worksheets, accuracy, participation)
- Real-time progress bar
- Class-wide celebration when goal met

✅ **Expanded Badge Library** (30+ badges)
- Growth badges (Rising Star, Comeback Kid)
- Subject mastery badges (Math Champion, Science Explorer)
- Time-limited seasonal badges (Summer Scholar, Back-to-School Star)

✅ **Teacher-Awarded Custom Badges**
- Teacher creates badge with custom text (e.g., "Helped classmates")
- Manually grant to individual students

✅ **Optional Class Leaderboards**
- Opt-in by teacher AND students
- Anonymous display ("Top 5" with points, no names)
- Filters: This week, This month, All-time

✅ **Detailed Analytics Dashboard**
- Student: Accuracy trends over time, time-spent graph, topic strengths/weaknesses
- Teacher: Per-student breakdown, topic difficulty heatmap, engagement timeline

✅ **Streak Powerups**
- Double Points Day (use 3 freeze tokens to activate 2× points for 24 hours)
- Streak Shield (auto-freeze for 1 day, earned at 30-day streak)

✅ **Authentication & Profiles**
- Student login (email/password or Google SSO)
- Persistent profiles (rewards saved to account, not browser localStorage)
- Profile customization (avatar, banner color)

#### Phase 2 Success Metrics
- 70%+ students complete ≥3 worksheets/week (up from 50% in MVP)
- Class goal completion rate ≥60%
- Teachers use custom badges ≥5 times per month
- Student retention (return after 30 days) ≥40%

---

### Phase 3+ (Future Considerations)

#### Advanced Gamification
- Team competitions (student squads compete on challenges)
- Tournaments (bracket-style worksheet competitions)
- Unlockable themes (earn visual customizations for UI)

#### Parent Portal
- Parents view student's progress (if student grants permission)
- Weekly email summaries of achievements

#### Teacher Rewards
- Teachers earn badges for class engagement milestones
- Leaderboard of most active classes (school-level, opt-in)

#### External Integrations
- ClassDojo points sync
- Google Classroom assignment import
- Clever SSO integration

#### AI-Powered Personalization
- Claude suggests next worksheet based on student's weak topics
- Adaptive difficulty (if student scores 95%+ on 3 worksheets, auto-suggest "Hard" level)

---

## Technical Notes for DEV Agent

### DynamoDB Schema — Student Profiles (v1)

```javascript
{
  studentId: "uuid-v4",              // Partition Key
  profileType: "POINTS#2026-03-24",  // Sort Key (for point snapshots)
  
  // Stored in POINTS# items
  lifetimePoints: 1250,
  monthlyPoints: 340,                // Resets 1st of each month (Lambda cron job)
  
  // Stored in STREAK# item
  activeStreak: 14,
  lastActiveDate: "2026-03-24",
  freezeTokens: 2,
  streakHistory: [7, 14, 30, 60],    // Milestone dates
  
  // Stored in BADGE# items (one item per badge)
  badgeId: "week-warrior",
  badgeName: "Week Warrior",
  earnedAt: "2026-03-17T10:30:00Z",
  
  // Stored in PROGRESS# items (track progress toward multi-worksheet badges)
  topicId: "multiplication",
  worksheetsCompleted: 8,            // Progress toward Platinum Star (needs 10)
  avgScore: 93.5,
  
  // GSI for leaderboards
  classId: "teacher-uuid-class-1",   // GSI Partition Key
  points: 1250,                      // GSI Sort Key (for ranking)
  
  createdAt: "2026-03-01T00:00:00Z",
  updatedAt: "2026-03-24T10:30:00Z"
}
```

### DynamoDB Schema — Class Goals (v1)

```javascript
{
  classId: "teacher-uuid-class-1",   // Partition Key
  goalId: "goal-uuid-v4",            // Sort Key
  
  goalType: "COLLECTIVE_WORKSHEETS", // enum
  targetValue: 50,                   // Goal: 50 worksheets
  currentValue: 32,                  // Current progress
  deadline: "2026-03-31T23:59:59Z",
  status: "IN_PROGRESS",             // IN_PROGRESS | COMPLETED | EXPIRED
  
  createdBy: "teacher-uuid",
  createdAt: "2026-03-18T00:00:00Z",
  completedAt: null,                 // Set when currentValue >= targetValue
  updatedAt: "2026-03-24T10:30:00Z"
}
```

### Lambda Function Signature — Reward Calculation

```javascript
/**
 * @file backend/utils/rewardsEngine.js
 * @description Calculate points, check badges, update streak after worksheet submission
 */

export async function calculateRewards({
  studentId,
  classId,
  worksheetId,
  score,              // 0-100 percentage
  questionCount,
  difficulty,         // Easy | Medium | Hard
  timeTaken,          // seconds
  estimatedTime,      // seconds
  isFirstAttempt,     // boolean
  isTimedMode         // boolean
}) {
  // 1. Calculate base points
  // 2. Apply bonuses
  // 3. Fetch current streak, apply multiplier
  // 4. Check badge unlock conditions
  // 5. Update DynamoDB: student-profiles (points, badges, streak)
  // 6. Update DynamoDB: class-goals (increment progress if applicable)
  // 7. Return { pointsEarned, totalPoints, newBadges[], currentStreak }
}
```

### Anti-Gaming Detection — Pseudo-code

```javascript
function detectGaming(answers, timeTaken, estimatedTime) {
  const warnings = [];
  
  // Check 1: All same letter
  if (answers.every(a => a === answers[0])) {
    warnings.push('RANDOM_PATTERN');
  }
  
  // Check 2: Extremely fast
  if (timeTaken < estimatedTime * 0.1) {
    warnings.push('TOO_FAST');
  }
  
  // Check 3: Alternating pattern (A, B, C, D, A, B, C, D...)
  if (isAlternatingPattern(answers)) {
    warnings.push('ALTERNATING_PATTERN');
  }
  
  return {
    isGaming: warnings.length > 0,
    warnings,
    pointsMultiplier: warnings.length > 0 ? 0 : 1
  };
}
```

---

## Summary

This reward system balances:
- ✅ **Student Motivation**: Points, badges, streaks make learning feel like progress
- ✅ **Educational Integrity**: Bonuses reward accuracy and thoughtful effort, not speed-running
- ✅ **Teacher Control**: Teachers can disable features, set goals, review flagged submissions
- ✅ **Privacy**: No public shaming, leaderboards are opt-in, student data protected
- ✅ **Anti-Gaming**: Multiple safeguards prevent point farming and random guessing
- ✅ **Scalability**: DynamoDB + Lambda handle 10K+ students with <$200/month cost

**MVP ships lean** (points, basic badges, streaks, anti-gaming) — proven engagement before investing in leaderboards and class goals.

**Phase 2 adds depth** (class goals, custom badges, analytics) — for schools that want advanced features.

---

**Next Steps for Team:**
1. **DBA Agent**: Finalize DynamoDB schemas, write migration scripts
2. **UI Agent**: Design badge icons, animation mockups, dashboard wireframes
3. **DEV Agent**: Build `rewardsEngine.js`, extend `submitHandler.js` to call reward calculation
4. **QA Agent**: Write tests for anti-gaming rules, badge unlock conditions, streak logic
5. **IaC Agent**: Add DynamoDB tables, S3 badge assets bucket to CDK stack
6. **DevOps Agent**: Update CI/CD to deploy DynamoDB tables before Lambdas

---

**Document Version**: 1.0  
**Author**: BA Agent  
**Date**: March 24, 2026  
**Status**: Awaiting Stakeholder Review
