/**
 * @file src/rewards/rewardsEngine.js
 * @description MVP rewards engine. Calculates points, updates streaks, checks
 * badge unlock conditions, and persists the reward profile via the db adapter.
 *
 * All timestamps and "today" comparisons use UTC dates (YYYY-MM-DD) so the
 * engine behaves consistently regardless of server timezone.
 */

import { getDbAdapter } from '../db/index.js';
import { detectGaming } from './antiGaming.js';
import { BADGES } from './badgeDefinitions.js';

const REWARDS_TABLE = 'rewardProfiles';
const DAILY_POINTS_CAP = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's UTC date string (YYYY-MM-DD).
 * @returns {string}
 */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the UTC date string for yesterday relative to the given date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
function yesterdayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds a blank reward profile for a new student.
 * @param {string} studentId
 * @returns {Object}
 */
function buildDefaultProfile(studentId) {
  return {
    id: studentId,
    lifetimePoints: 0,
    monthlyPoints: 0,
    dailyPoints: 0,
    dailyPointsDate: null,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    freezeTokens: 0,
    badges: [],
    totalAttempts: 0,
    perfectScoreCount: 0,
    topicStats: {},
    suspiciousAttemptCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Point calculation ────────────────────────────────────────────────────────

/**
 * Calculates raw points (before multipliers) from the attempt parameters.
 *
 * @param {Object} params
 * @param {number} params.score
 * @param {number} params.questionCount
 * @param {string} params.difficulty
 * @param {number} params.timeTaken
 * @param {number} params.estimatedTime
 * @param {boolean} params.isFirstAttempt
 * @param {boolean} params.isTimedMode
 * @returns {number} Raw integer points before any multiplier
 */
function calculateRawPoints({
  score,
  questionCount,
  difficulty,
  timeTaken,
  estimatedTime,
  isFirstAttempt,
  isTimedMode,
}) {
  let points = Math.floor((score / 100) * questionCount);

  // Accuracy bonus
  if (score === 100) {
    points += 5;
  }

  // Speed bonus — only in timed mode, only when estimated time is known
  if (isTimedMode && estimatedTime > 0 && timeTaken < estimatedTime * 0.5) {
    points += 3;
  }

  // First attempt bonus
  if (isFirstAttempt && score >= 80) {
    points += 2;
  }

  // Challenge bonus
  if (difficulty === 'Hard') {
    points += 10;
  }

  return points;
}

// ─── Streak management ────────────────────────────────────────────────────────

/**
 * Updates the streak fields on the profile in-place based on today's date.
 * A valid streak day requires questionCount >= 5 AND score >= 60.
 * Returns true when a freeze token was consumed.
 *
 * @param {Object} profile - Mutable reward profile
 * @param {number} score
 * @param {number} questionCount
 * @returns {boolean} Whether a freeze token was consumed
 */
function updateStreak(profile, score, questionCount) {
  const today = todayUTC();
  const isValidDay = questionCount >= 5 && score >= 60;
  let frozeUsed = false;

  if (!isValidDay) {
    // Submission doesn't qualify — streak state unchanged, lastActiveDate unchanged
    return frozeUsed;
  }

  const last = profile.lastActiveDate;

  if (last === null) {
    // First ever valid submission
    profile.currentStreak = 1;
  } else if (last === today) {
    // Already recorded a valid submission today — no change to streak count
    return frozeUsed;
  } else if (last === yesterdayOf(today)) {
    // Consecutive day — extend streak
    profile.currentStreak += 1;

    // Award a freeze token every 7 days (on the day the milestone is hit)
    if (profile.currentStreak % 7 === 0 && profile.freezeTokens < 3) {
      profile.freezeTokens = Math.min(profile.freezeTokens + 1, 3);
    }
  } else {
    // Missed at least one day — check freeze tokens
    if (profile.freezeTokens > 0) {
      profile.freezeTokens -= 1;
      profile.currentStreak += 1;
      frozeUsed = true;
    } else {
      profile.currentStreak = 1;
    }
  }

  if (profile.currentStreak > profile.longestStreak) {
    profile.longestStreak = profile.currentStreak;
  }

  profile.lastActiveDate = today;
  return frozeUsed;
}

// ─── Topic stats ──────────────────────────────────────────────────────────────

/**
 * Updates topicStats for the given topic in-place and returns the previous
 * avgScore (before this attempt), or null if this is the first entry.
 *
 * @param {Object} profile - Mutable reward profile
 * @param {string} topic
 * @param {number} score
 * @returns {number|null} The avgScore before this attempt was added
 */
function updateTopicStats(profile, topic, score) {
  if (!profile.topicStats) {
    profile.topicStats = {};
  }

  const existing = profile.topicStats[topic];
  const previousAvg = existing ? existing.avgScore : null;

  if (!existing) {
    profile.topicStats[topic] = {
      count: 1,
      totalScore: score,
      avgScore: score,
      perfectCount: score === 100 ? 1 : 0,
    };
  } else {
    const newCount = existing.count + 1;
    const newTotal = existing.totalScore + score;
    profile.topicStats[topic] = {
      count: newCount,
      totalScore: newTotal,
      avgScore: Math.round(newTotal / newCount),
      perfectCount: existing.perfectCount + (score === 100 ? 1 : 0),
    };
  }

  return previousAvg;
}

// ─── Daily cap ────────────────────────────────────────────────────────────────

/**
 * Applies the daily points cap and returns the actual points to award.
 * Resets dailyPoints when the date has rolled over.
 *
 * @param {Object} profile - Mutable reward profile
 * @param {number} points - Points to add before cap
 * @returns {number} Points actually awarded (may be less than points)
 */
function applyDailyCap(profile, points) {
  const today = todayUTC();

  if (profile.dailyPointsDate !== today) {
    // New day — reset daily counter
    profile.dailyPoints = 0;
    profile.dailyPointsDate = today;
  }

  const remaining = DAILY_POINTS_CAP - profile.dailyPoints;
  const awarded = Math.max(0, Math.min(points, remaining));
  profile.dailyPoints += awarded;
  return awarded;
}

// ─── Badge evaluation ─────────────────────────────────────────────────────────

/**
 * Checks every badge the student has not yet unlocked. Returns an array of
 * badge objects for badges newly unlocked by this attempt.
 *
 * @param {Object} profile - Mutable reward profile (badges array updated in place)
 * @param {Object} attempt - Attempt context passed to each badge check()
 * @returns {Object[]} Newly unlocked badge objects (id, name, emoji, description, earnedAt)
 */
function evaluateBadges(profile, attempt) {
  const alreadyOwned = new Set(profile.badges.map((b) => b.id));
  const newBadges = [];
  const now = new Date().toISOString();

  for (const badge of BADGES) {
    if (alreadyOwned.has(badge.id)) continue;

    let unlocked = false;
    try {
      unlocked = badge.check(profile, attempt);
    } catch {
      // A badge check must never crash the engine
      unlocked = false;
    }

    if (unlocked) {
      const earned = {
        id: badge.id,
        name: badge.name,
        emoji: badge.emoji,
        description: badge.description,
        earnedAt: now,
      };
      profile.badges.push(earned);
      newBadges.push(earned);
    }
  }

  return newBadges;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calculates and persists rewards for a single worksheet submission.
 *
 * Point rules applied in order:
 *  1. Base:             floor(score / 100 * questionCount)
 *  2. Accuracy bonus:   +5 if score === 100
 *  3. Speed bonus:      +3 if isTimedMode AND timeTaken < estimatedTime * 0.5 (estimatedTime > 0)
 *  4. First attempt:    +2 if isFirstAttempt AND score >= 80
 *  5. Challenge bonus:  +10 if difficulty === 'Hard'
 *  6. Streak mult:      points * (1 + currentStreak / 10)
 *  7. Topic mastery:    additional 20% if topic was weak (avgScore < 70) before this attempt
 *  8. Gaming mult:      0 if gaming detected, else 1
 *  9. Daily cap:        200 points per day per student
 *
 * @param {Object} params
 * @param {string}   params.studentId
 * @param {string}   params.worksheetId
 * @param {number}   params.score                  - 0-100
 * @param {number}   params.questionCount
 * @param {string}   params.difficulty             - 'Easy'|'Medium'|'Hard'
 * @param {number}   params.timeTaken              - seconds
 * @param {number}   params.estimatedTime          - seconds (0 if unknown)
 * @param {boolean}  params.isFirstAttempt
 * @param {boolean}  params.isTimedMode
 * @param {string}   params.topic
 * @param {Array<{answer: string}>} params.answers - for anti-gaming check
 * @param {number|null} params.previousScore       - score on prior attempt, null if first
 * @param {number}   params.worksheetAttemptCount  - total attempts including current
 * @returns {Promise<{
 *   pointsEarned: number,
 *   totalPoints: number,
 *   newBadges: Object[],
 *   currentStreak: number,
 *   freezeTokens: number,
 *   gamingWarning: string|null
 * }>}
 */
export async function calculateRewards({
  studentId,
  worksheetId,
  score,
  questionCount,
  difficulty,
  timeTaken,
  estimatedTime,
  isFirstAttempt,
  isTimedMode,
  topic,
  answers,
  previousScore,
  worksheetAttemptCount,
}) {
  const db = getDbAdapter();

  // ── 1. Load or create profile ──────────────────────────────────────────────
  let profile = await db.getItem(REWARDS_TABLE, studentId);
  if (!profile) {
    profile = buildDefaultProfile(studentId);
  }

  // ── 2. Anti-gaming check ───────────────────────────────────────────────────
  const gaming = detectGaming(answers ?? [], timeTaken, estimatedTime);
  const gamingWarning = gaming.warnings.length > 0 ? gaming.warnings[0] : null;

  if (gaming.isGaming) {
    profile.suspiciousAttemptCount += 1;
  }

  // ── 3. Increment attempt counters ─────────────────────────────────────────
  profile.totalAttempts += 1;
  if (score === 100) {
    profile.perfectScoreCount += 1;
  }

  // ── 4. Update topic stats (before badge check reads them) ─────────────────
  const previousTopicAvg = updateTopicStats(profile, topic, score);

  // ── 5. Update streak ──────────────────────────────────────────────────────
  updateStreak(profile, score, questionCount);

  // ── 6. Build attempt context for badge evaluation ─────────────────────────
  const improvement =
    !isFirstAttempt && previousScore !== null ? score - previousScore : 0;

  const attempt = {
    score,
    questionCount,
    topic,
    difficulty,
    isFirstAttempt,
    worksheetId,
    improvement,
    previousScore: previousScore ?? null,
    worksheetAttemptCount,
  };

  // ── 7. Evaluate badges (after stats are updated) ──────────────────────────
  const newBadges = evaluateBadges(profile, attempt);

  // ── 8. Calculate points ───────────────────────────────────────────────────
  let points = calculateRawPoints({
    score,
    questionCount,
    difficulty,
    timeTaken,
    estimatedTime,
    isFirstAttempt,
    isTimedMode,
  });

  // Streak multiplier: 1 + (currentStreak / 10)
  const streakMult = 1 + profile.currentStreak / 10;
  points = Math.floor(points * streakMult);

  // Topic mastery multiplier: +20% for revisiting a previously weak topic
  // previousTopicAvg is the avg *before* this attempt was folded in.
  if (previousTopicAvg !== null && previousTopicAvg < 70) {
    points = Math.floor(points * 1.2);
  }

  // Anti-gaming multiplier (0 zeroes everything out)
  points = Math.floor(points * gaming.pointsMultiplier);

  // Daily cap
  const pointsEarned = applyDailyCap(profile, points);

  // ── 9. Accumulate totals ──────────────────────────────────────────────────
  profile.lifetimePoints += pointsEarned;
  profile.monthlyPoints = (profile.monthlyPoints ?? 0) + pointsEarned;

  // ── 10. Persist ───────────────────────────────────────────────────────────
  profile.updatedAt = new Date().toISOString();
  await db.putItem(REWARDS_TABLE, profile);

  return {
    pointsEarned,
    totalPoints: profile.lifetimePoints,
    newBadges,
    currentStreak: profile.currentStreak,
    freezeTokens: profile.freezeTokens,
    gamingWarning,
  };
}
