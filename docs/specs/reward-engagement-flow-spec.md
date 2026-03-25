# Learnfyra Reward Engagement Flow Specification
# File: docs/specs/reward-engagement-flow-spec.md
# Version: 1.0
# Date: 2026-03-24
# Status: Design specification only, no code in this phase

---

## Module Name

Reward Based Engagement for Students and Teachers

---

## Goal

Increase consistent practice and teaching follow-through while preserving educational integrity, fairness, and privacy.

---

## Design Principles

1. Learning-first rewards, not game-first addiction loops
2. Positive reinforcement only, no public shaming
3. Low-friction visibility for students, actionable controls for teachers
4. Parent-friendly plain language
5. Accessibility and reduced-motion support by default

---

## Reward Mechanics

### 1) Points

Point sources:

1. Correct answers
2. Completion with minimum quality threshold
3. Bonus for strong accuracy
4. Limited bonus for improvement trend

Point constraints:

1. Daily cap to prevent farming
2. Retake dampening on repeated attempts of the same worksheet
3. No points for suspicious low-effort submissions

### 2) Badges

Badge families:

1. Completion milestones
2. Topic mastery
3. Improvement and resilience
4. Healthy consistency streaks
5. Teacher-awarded positive behavior badges

Badge rules:

1. Only positive badges
2. Badge unlocks are idempotent
3. Badge revocation only for proven abuse with audit trail

### 3) Streaks

Streak definition:

1. One valid practice day requires minimum question count and minimum score threshold
2. Multiple submissions in a day count as one streak day

Streak protection:

1. Limited freeze tokens for occasional missed days
2. Clear timezone policy based on account profile or platform standard

### 4) Class Goals

Teacher-controlled shared goals:

1. Completion target
2. Accuracy target
3. Topic challenge target

Class goal behavior:

1. Progress visible to class
2. Student contribution shown in non-shaming form
3. Celebration when completed, supportive messaging when not completed

---

## Anti-Gaming and Fairness Rules

1. Rate limit repeated submissions
2. Detect suspicious random-answer patterns
3. Detect impossible speed completion
4. Throttle point gain on repeated retakes
5. Flag suspicious attempts for teacher review
6. Never expose punitive public labels
7. Keep leaderboards optional and disabled by default

---

## Student Flow

1. Student submits worksheet
2. Score and correctness calculated
3. Reward engine evaluates points, badges, and streak changes
4. Student sees post-submit reward summary
5. Student dashboard updates progress and next target

Flow rule:

1. Reward celebrations occur after submission, not during active solving

---

## Teacher Flow

1. Teacher views class engagement panel
2. Teacher reviews class goals and weak-topic alignment
3. Teacher can tune class reward settings
4. Teacher can review suspicious attempts and decide on overrides
5. Teacher can award custom positive badges where appropriate

---

## Parent Flow

1. Parent views child progress summary
2. Parent sees strengths, weak areas, and growth trend
3. Parent can log offline score updates
4. Parent receives suggested next-practice guidance

---

## Data Requirements

Reward state per student must track:

1. Total points
2. Daily points
3. Weekly points
4. Current streak
5. Longest streak
6. Freeze token count
7. Badge list with unlock timestamps
8. Last reward evaluation timestamp
9. Suspicious attempt counter

Precomputed class reward summary must track:

1. Class total points
2. Active participation rate
3. Goal progress metrics
4. Engagement tier counts

---

## Acceptance Criteria

### Student Rewards

1. Given a valid submission, when reward evaluation runs, then points are updated and visible in the student summary.
2. Given badge conditions are met, when evaluation completes, then the new badge unlock appears once and persists.
3. Given streak conditions are met, when a valid daily submission is recorded, then current streak increments by one day.

### Anti-Gaming

1. Given a suspicious submission pattern, when anti-gaming checks run, then reward bonuses are blocked and attempt is flagged.
2. Given repeated retakes in a short window, when rewards are evaluated, then point gains are dampened according to policy.

### Teacher and Parent

1. Given teacher opens class engagement, when data loads, then engagement and goal progress render from precomputed aggregates.
2. Given parent opens child view, when data loads, then only linked-child reward and progress data is visible.

### System Consistency

1. Given incremental aggregate updates have drifted, when daily recompute runs, then student and class reward aggregates are reconciled.
2. Given concurrent submissions, when reward updates are applied, then totals remain consistent and do not double count.

---

## MVP and Phase Plan

### MVP

1. Points, badges, and streaks
2. Teacher class engagement view
3. Parent child progress view
4. Anti-gaming baseline checks
5. Precomputed reward and analytics aggregates

### Phase 2

1. Class goals expansion and optional leaderboard controls
2. Richer badge catalog and custom teacher badge workflows
3. Advanced intervention recommendations from reward plus performance trends

---

## Privacy and Compliance

1. Reward data treated as education records
2. Access controlled by role and ownership boundaries
3. No public display of low performance indicators
4. Optional social comparison features require explicit enablement

---

## Related Documents

1. Module architecture and mode control: [docs/specs/auth-online-offline-reporting-spec.md](docs/specs/auth-online-offline-reporting-spec.md)
2. UX reward design details: [docs/design/ux-rewards-engagement-spec.md](docs/design/ux-rewards-engagement-spec.md)
3. QA reward coverage: [docs/qa/rewards-gamification-qa-spec.md](docs/qa/rewards-gamification-qa-spec.md)
4. QA auth/reporting coverage: [docs/qa/auth-mode-reporting-qa-spec.md](docs/qa/auth-mode-reporting-qa-spec.md)

---

## Summary

This specification introduces a balanced reward layer that motivates students, equips teachers and parents with clear engagement signals, and stays aligned with a low-cost architecture using DynamoDB plus precomputed statistics.

---

## Implementation Readiness References

1. Local and AWS parity strategy: [docs/LOCAL_DEV_STRATEGY.md](docs/LOCAL_DEV_STRATEGY.md)
2. Implementation checklist: [docs/IMPLEMENTATION_READINESS_CHECKLIST.md](docs/IMPLEMENTATION_READINESS_CHECKLIST.md)
