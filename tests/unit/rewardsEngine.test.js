/**
 * @file tests/unit/rewardsEngine.test.js
 * @description Unit tests for src/rewards/rewardsEngine.js — calculateRewards.
 * The db adapter is mocked so no real file I/O occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── UUID fixtures ────────────────────────────────────────────────────────────

const VALID_STUDENT_ID  = '11111111-1111-4111-8111-111111111111';
const VALID_WORKSHEET_ID = '55555555-5555-4555-8555-555555555555';

// ─── Mock ../../src/db/index.js BEFORE any dynamic import ─────────────────────

const mockGetItem = jest.fn();
const mockPutItem = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem: mockGetItem,
    putItem:  mockPutItem,
  })),
}));

// ─── Dynamic imports (must come AFTER all mockModule calls) ──────────────────

const { getDbAdapter } = await import('../../src/db/index.js');
const { calculateRewards } = await import('../../src/rewards/rewardsEngine.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's UTC date string (YYYY-MM-DD), matching the engine's todayUTC().
 */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the UTC date string for yesterday.
 */
function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a UTC date string for N days ago.
 */
function daysAgoUTC(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds a varied (non-gaming) answers array with the given length.
 */
function variedAnswers(count) {
  const pool = ['A','C','B','D','C','A','D','B','C','A'];
  return Array.from({ length: count }, (_, i) => ({ answer: pool[i % pool.length] }));
}

/**
 * Minimal base params for a single calculateRewards call.
 * Caller can override any field.
 */
function baseParams(overrides = {}) {
  return {
    studentId:            VALID_STUDENT_ID,
    worksheetId:          VALID_WORKSHEET_ID,
    score:                80,
    questionCount:        10,
    difficulty:           'Medium',
    timeTaken:            300,
    estimatedTime:        600,
    isFirstAttempt:       true,
    isTimedMode:          false,
    topic:                'Multiplication',
    answers:              variedAnswers(10),
    previousScore:        null,
    worksheetAttemptCount: 1,
    ...overrides,
  };
}

/**
 * Default empty profile returned when no record exists in the db.
 */
function emptyProfile(overrides = {}) {
  return {
    id:                   VALID_STUDENT_ID,
    lifetimePoints:       0,
    monthlyPoints:        0,
    dailyPoints:          0,
    dailyPointsDate:      '2000-01-01',
    currentStreak:        0,
    longestStreak:        0,
    lastActiveDate:       null,
    freezeTokens:         0,
    badges:               [],
    totalAttempts:        0,
    perfectScoreCount:    0,
    topicStats:           {},
    suspiciousAttemptCount: 0,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no existing profile (engine builds a new one)
  mockGetItem.mockResolvedValue(null);
  mockPutItem.mockResolvedValue({});
});

// ─── Points calculation ───────────────────────────────────────────────────────

describe('calculateRewards — base points (80% on 10 questions)', () => {

  it('awards base+firstAttempt points for 80% on 10 questions', async () => {
    // score=80, questionCount=10 → base = floor(80/100 * 10) = 8
    // isFirstAttempt=true, score>=80 → +2 = 10
    // lastActiveDate=null → streak 0→1 after update; streakMult = 1 + 1/10 = 1.1
    // floor(10 * 1.1) = 11; no gaming, daily cap has room → pointsEarned = 11
    const result = await calculateRewards(baseParams({
      score: 80,
      questionCount: 10,
      isFirstAttempt: true,
      isTimedMode: false,
      difficulty: 'Medium',
    }));
    expect(result.pointsEarned).toBe(11);
  });

  it('awards base=8 without first-attempt bonus when isFirstAttempt=false', async () => {
    // base=8, no first-attempt bonus (false), streak=0→1 after update
    // streakMult = 1 + 1/10 = 1.1; floor(8 * 1.1) = 8
    const result = await calculateRewards(baseParams({
      score: 80,
      questionCount: 10,
      isFirstAttempt: false,
      isTimedMode: false,
      difficulty: 'Medium',
    }));
    expect(result.pointsEarned).toBe(8);
  });

});

describe('calculateRewards — accuracy bonus (100% on 10 questions)', () => {

  it('awards base=10 plus accuracy bonus=5 for a perfect score', async () => {
    // base=10 + accuracy=5 = 15, firstAttempt+score>=80 → +2 = 17
    // streak=0 after update, mult=1+1/10=1.1 → floor(17*1.1)=18
    // Hmm — let me think carefully:
    // After engine: totalAttempts=1, profile.lastActiveDate=null → streak becomes 1
    // streakMult = 1 + 1/10 = 1.1
    // points = floor(17 * 1.1) = floor(18.7) = 18
    const result = await calculateRewards(baseParams({
      score: 100,
      questionCount: 10,
      isFirstAttempt: true,
      isTimedMode: false,
      difficulty: 'Medium',
      questionCount: 10,
    }));
    // base(10) + accuracy(5) + firstAttempt(2) = 17; streak goes 0→1 after update
    // streakMult = 1 + 1/10 = 1.1; floor(17 * 1.1) = 18
    expect(result.pointsEarned).toBe(18);
  });

});

describe('calculateRewards — speed bonus', () => {

  it('awards speed bonus +3 when timed, score=50%, timeTaken < estimatedTime*0.5', async () => {
    // score=50, questionCount=10 → base=5
    // timed=true, timeTaken=250 < 600*0.5=300 → speed +3 = 8
    // isFirstAttempt=false → no first-attempt bonus
    // difficulty=Medium → no challenge
    // streak=0→1 after update (score>=60? No, 50 < 60 → streak NOT updated)
    // Wait: score=50 < 60 → isValidDay=false → streak stays 0
    // streakMult = 1 + 0/10 = 1 → floor(8 * 1) = 8
    const result = await calculateRewards(baseParams({
      score: 50,
      questionCount: 10,
      isFirstAttempt: false,
      isTimedMode: true,
      timeTaken: 250,
      estimatedTime: 600,
      difficulty: 'Medium',
    }));
    expect(result.pointsEarned).toBe(8);
  });

});

describe('calculateRewards — first attempt bonus', () => {

  it('awards +2 bonus when isFirstAttempt=true and score>=80', async () => {
    // base=8, firstAttempt+score>=80 → +2 = 10
    // streak 0→1, mult=1.1, floor(10*1.1)=11
    const result = await calculateRewards(baseParams({
      score: 80,
      questionCount: 10,
      isFirstAttempt: true,
      isTimedMode: false,
      difficulty: 'Medium',
    }));
    expect(result.pointsEarned).toBe(11);
  });

  it('does NOT award first attempt bonus when score < 80', async () => {
    // base=7 (70%), no first-attempt (score<80), no speed
    // streak 0→1 (70>=60), mult=1.1, floor(7*1.1)=7
    const result = await calculateRewards(baseParams({
      score: 70,
      questionCount: 10,
      isFirstAttempt: true,
      isTimedMode: false,
      difficulty: 'Medium',
    }));
    expect(result.pointsEarned).toBe(7);
  });

});

describe('calculateRewards — Hard difficulty challenge bonus', () => {

  it('awards +10 challenge bonus for Hard difficulty', async () => {
    // score=80, base=8, firstAttempt+score>=80 → +2, Hard → +10 = 20
    // streak 0→1, mult=1.1, floor(20*1.1)=22
    const result = await calculateRewards(baseParams({
      score: 80,
      questionCount: 10,
      isFirstAttempt: true,
      isTimedMode: false,
      difficulty: 'Hard',
    }));
    expect(result.pointsEarned).toBe(22);
  });

});

describe('calculateRewards — gaming detected zeroes points', () => {

  it('pointsEarned is 0 when all answers are the same letter (all A)', async () => {
    const result = await calculateRewards(baseParams({
      score: 80,
      questionCount: 10,
      answers: Array(10).fill({ answer: 'A' }),
    }));
    expect(result.pointsEarned).toBe(0);
  });

  it('gamingWarning is RANDOM_PATTERN when all answers are the same letter', async () => {
    const result = await calculateRewards(baseParams({
      answers: Array(10).fill({ answer: 'A' }),
    }));
    expect(result.gamingWarning).toBe('RANDOM_PATTERN');
  });

});

describe('calculateRewards — daily cap at 200 points', () => {

  it('caps points earned when dailyPoints is already at 195', async () => {
    // Profile already has 195 daily points today; earning 10 raw → capped to 5
    const today = todayUTC();
    mockGetItem.mockResolvedValue(emptyProfile({
      dailyPoints: 195,
      dailyPointsDate: today,
    }));
    // score=100, base=10+accuracy5+firstAttempt2=17
    // streak 0→1, mult=1.1, floor(17*1.1)=18 → but cap remaining=5
    const result = await calculateRewards(baseParams({
      score: 100,
      questionCount: 10,
      isFirstAttempt: true,
      isTimedMode: false,
      difficulty: 'Medium',
    }));
    expect(result.pointsEarned).toBe(5);
  });

});

describe('calculateRewards — streak multiplier', () => {

  it('applies 2x multiplier for currentStreak=10 after update', async () => {
    // Profile starts with currentStreak=9, lastActiveDate=yesterday
    // After update: streak becomes 10
    // streakMult = 1 + 10/10 = 2
    // base=8 (80%), firstAttempt+score>=80 → +2 = 10
    // floor(10 * 2) = 20
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 9,
      longestStreak: 9,
      lastActiveDate: yesterdayUTC(),
    }));
    const result = await calculateRewards(baseParams({
      score: 80,
      questionCount: 10,
      isFirstAttempt: true,
      isTimedMode: false,
      difficulty: 'Medium',
    }));
    expect(result.pointsEarned).toBe(20);
  });

});

// ─── Streak logic ─────────────────────────────────────────────────────────────

describe('calculateRewards — streak: first ever submission', () => {

  it('streak becomes 1 when lastActiveDate is null', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({ lastActiveDate: null, currentStreak: 0 }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.currentStreak).toBe(1);
  });

});

describe('calculateRewards — streak: consecutive day', () => {

  it('streak increments when lastActiveDate is yesterday', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: yesterdayUTC(),
    }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.currentStreak).toBe(4);
  });

});

describe('calculateRewards — streak: same day does not increment', () => {

  it('streak stays the same when lastActiveDate is today', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: todayUTC(),
    }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.currentStreak).toBe(5);
  });

});

describe('calculateRewards — streak: freeze token consumed on missed day', () => {

  it('streak continues and freezeTokens decrements when a day is missed with a token', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 4,
      longestStreak: 4,
      lastActiveDate: daysAgoUTC(2),
      freezeTokens: 1,
    }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.currentStreak).toBe(5);
    expect(result.freezeTokens).toBe(0);
  });

});

describe('calculateRewards — streak: reset on missed day with no freeze tokens', () => {

  it('streak resets to 1 when a day is missed and freezeTokens is 0', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 4,
      longestStreak: 4,
      lastActiveDate: daysAgoUTC(2),
      freezeTokens: 0,
    }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.currentStreak).toBe(1);
  });

});

describe('calculateRewards — streak: not updated for invalid day (questionCount < 5)', () => {

  it('streak is not updated when questionCount is 4', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: yesterdayUTC(),
    }));
    const result = await calculateRewards(baseParams({
      score: 80,
      questionCount: 4,
    }));
    // questionCount < 5 → isValidDay=false → streak unchanged at 3
    expect(result.currentStreak).toBe(3);
  });

});

describe('calculateRewards — streak: not updated when score < 60', () => {

  it('streak is not updated when score is 50', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: yesterdayUTC(),
    }));
    const result = await calculateRewards(baseParams({
      score: 50,
      questionCount: 10,
    }));
    // score < 60 → isValidDay=false → streak unchanged at 3
    expect(result.currentStreak).toBe(3);
  });

});

// ─── Freeze token grant ───────────────────────────────────────────────────────

describe('calculateRewards — freeze token granted at streak milestone 7', () => {

  it('freezeTokens increases by 1 when streak reaches 7', async () => {
    // currentStreak=6, lastActiveDate=yesterday → streak becomes 7, 7%7===0 → grant token
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 6,
      longestStreak: 6,
      lastActiveDate: yesterdayUTC(),
      freezeTokens: 0,
    }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.freezeTokens).toBe(1);
  });

  it('freezeTokens stays at 3 when cap is already reached', async () => {
    // currentStreak=6, freezeTokens already at 3 → no new token
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 6,
      longestStreak: 6,
      lastActiveDate: yesterdayUTC(),
      freezeTokens: 3,
    }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.freezeTokens).toBe(3);
  });

});

// ─── Badge unlock ─────────────────────────────────────────────────────────────

describe('calculateRewards — badge: first-steps', () => {

  it('first-steps badge is returned in newBadges on the first ever attempt', async () => {
    // Profile starts at totalAttempts=0; engine increments to 1 before badge check
    mockGetItem.mockResolvedValue(emptyProfile({ totalAttempts: 0 }));
    const result = await calculateRewards(baseParams());
    expect(result.newBadges.some((b) => b.id === 'first-steps')).toBe(true);
  });

  it('first-steps badge is NOT returned when the student already has it', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({
      totalAttempts: 5,
      badges: [{ id: 'first-steps', name: 'First Steps', emoji: '🎯', description: 'Complete your first worksheet', earnedAt: '2026-01-01T00:00:00Z' }],
    }));
    const result = await calculateRewards(baseParams());
    expect(result.newBadges.some((b) => b.id === 'first-steps')).toBe(false);
  });

});

describe('calculateRewards — badge: week-warrior', () => {

  it('week-warrior badge is unlocked when streak reaches 7', async () => {
    // currentStreak=6 + yesterday → becomes 7 after update → week-warrior unlocks
    mockGetItem.mockResolvedValue(emptyProfile({
      currentStreak: 6,
      longestStreak: 6,
      lastActiveDate: yesterdayUTC(),
    }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    expect(result.newBadges.some((b) => b.id === 'week-warrior')).toBe(true);
  });

});

describe('calculateRewards — badge: silver-star', () => {

  it('silver-star badge is unlocked when topic count=3 and avgScore>=80', async () => {
    // Pre-seed 2 previous attempts on 'Multiplication' with avgScore that when
    // combined with score=85 on the 3rd attempt gives avgScore >= 80.
    // 2 existing: totalScore=170, count=2, avgScore=85. New: score=85.
    // After update: count=3, totalScore=255, avgScore=85 → silver-star unlocks.
    mockGetItem.mockResolvedValue(emptyProfile({
      totalAttempts: 2,
      topicStats: {
        Multiplication: {
          count: 2,
          totalScore: 170,
          avgScore: 85,
          perfectCount: 0,
        },
      },
    }));
    const result = await calculateRewards(baseParams({
      score: 85,
      topic: 'Multiplication',
      isFirstAttempt: false,
      worksheetAttemptCount: 3,
    }));
    expect(result.newBadges.some((b) => b.id === 'silver-star')).toBe(true);
  });

});

// ─── Return shape ─────────────────────────────────────────────────────────────

describe('calculateRewards — return shape', () => {

  it('returns an object with all required keys', async () => {
    const result = await calculateRewards(baseParams());
    expect(result).toHaveProperty('pointsEarned');
    expect(result).toHaveProperty('totalPoints');
    expect(result).toHaveProperty('newBadges');
    expect(result).toHaveProperty('currentStreak');
    expect(result).toHaveProperty('freezeTokens');
    expect(result).toHaveProperty('gamingWarning');
  });

  it('gamingWarning is null for a clean submission', async () => {
    const result = await calculateRewards(baseParams());
    expect(result.gamingWarning).toBeNull();
  });

  it('gamingWarning is RANDOM_PATTERN when all answers are the same letter', async () => {
    const result = await calculateRewards(baseParams({
      answers: Array(10).fill({ answer: 'A' }),
    }));
    expect(result.gamingWarning).toBe('RANDOM_PATTERN');
  });

  it('newBadges is an array', async () => {
    const result = await calculateRewards(baseParams());
    expect(Array.isArray(result.newBadges)).toBe(true);
  });

  it('totalPoints reflects lifetimePoints accumulated on the profile', async () => {
    mockGetItem.mockResolvedValue(emptyProfile({ lifetimePoints: 50 }));
    const result = await calculateRewards(baseParams({ score: 80, questionCount: 10 }));
    // totalPoints = 50 + pointsEarned
    expect(result.totalPoints).toBe(50 + result.pointsEarned);
  });

});
