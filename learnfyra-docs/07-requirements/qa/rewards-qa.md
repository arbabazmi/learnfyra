# Rewards & Gamification QA Spec (Phase 2)

**Note: Rewards are out of scope for Phase 1. This spec documents the planned Phase 2 behavior for when the rewards system is built.**

---

## Points System Tests

| ID | Scenario | Expected |
|---|---|---|
| PTS-001 | Complete worksheet (any score) | +10 base points |
| PTS-002 | Score >= 90% | +10 base + 5 accuracy bonus = 15 points |
| PTS-003 | Score 75-89% | +10 base + 3 accuracy bonus = 13 points |
| PTS-004 | Score 60-74% | +10 base + 1 accuracy bonus = 11 points |
| PTS-005 | Score < 60% | +10 base only = 10 points |
| PTS-006 | Complete in < 80% of time limit (timed mode) | +3 speed bonus applied |
| PTS-007 | Complete in >= 80% of time limit | No speed bonus |
| PTS-008 | Complete in untimed mode | No speed bonus (timed=false) |
| PTS-009 | 3-day streak multiplier | Points × 1.5 |
| PTS-010 | 7-day streak multiplier | Points × 2.0 |
| PTS-011 | First strong area achievement (avgScore > 85% on topic) | +20 subject mastery bonus |
| PTS-012 | Total points field updated after each attempt | totalPoints in Users table incremented |

## Badge Award Tests

| ID | Scenario | Expected Badge |
|---|---|---|
| BDG-001 | Complete first worksheet | "First Step" badge |
| BDG-002 | Complete 10 worksheets | "Getting Started" badge |
| BDG-003 | Complete 50 worksheets | "Dedicated Learner" badge |
| BDG-004 | First 100% score | "Perfect Score" badge |
| BDG-005 | Average Math score > 85% | "Math Wizard" badge |
| BDG-006 | Average Science score > 85% | "Science Explorer" badge |
| BDG-007 | Average ELA score > 85% | "Word Master" badge |
| BDG-008 | 3-day login/attempt streak | "3-Day Streak" badge |
| BDG-009 | 7-day login/attempt streak | "7-Day Streak" badge |
| BDG-010 | 30-day login/attempt streak | "Monthly Warrior" badge |
| BDG-011 | Badge awarded only once per type | Duplicate badge not stored |
| BDG-012 | Badge visible in student dashboard | GET /api/progress/me includes recentBadges |

## Streak Tests

| ID | Scenario | Expected |
|---|---|---|
| STR-001 | Complete worksheet on consecutive days | streak increments |
| STR-002 | Miss a day | streak resets to 0 or 1 (current day) |

## Precomputed Fields

For performance, these fields are precomputed and stored in Users table:

| Field | Type | Updated When |
|---|---|---|
| totalPoints | Number | After each attempt |
| badgeCount | Number | When new badge awarded |
| recentBadges | List | Last 5 badges, updated when new badge awarded |
| highestStreak | Number | When current streak exceeds previous high |
| streakUpdatedAt | String | Date of last streak update |

These fields are NOT implemented in Phase 1. The Users table schema includes placeholder attributes so Phase 2 addition is non-breaking.
