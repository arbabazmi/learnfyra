/**
 * @file src/rewards/badgeDefinitions.js
 * @description MVP badge definitions for Learnfyra reward system.
 * Each badge has a check(profile, attempt) function that returns true when
 * the badge should be unlocked.
 *
 * Profile shape:
 *   {
 *     badges: string[],            // already-unlocked badge ids
 *     totalAttempts: number,
 *     currentStreak: number,
 *     longestStreak: number,
 *     perfectScoreCount: number,
 *     topicStats: {
 *       [topic: string]: { count: number, totalScore: number, avgScore: number, perfectCount: number }
 *     }
 *   }
 *
 * Attempt shape:
 *   {
 *     score: number,               // 0-100
 *     questionCount: number,
 *     topic: string,
 *     difficulty: string,
 *     isFirstAttempt: boolean,
 *     worksheetId: string,
 *     improvement: number,         // score delta vs previous attempt (0 if first)
 *     previousScore: number|null,  // score on previous attempt of same worksheet
 *     worksheetAttemptCount: number
 *   }
 */

/**
 * @typedef {Object} Badge
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} description
 * @property {function(Object, Object): boolean} check
 */

/** @type {Badge[]} */
export const BADGES = [
  {
    id: 'first-steps',
    name: 'First Steps',
    emoji: '🎯',
    description: 'Complete your first worksheet',
    check: (profile) => profile.totalAttempts === 1,
  },
  {
    id: 'dedicated-learner',
    name: 'Dedicated Learner',
    emoji: '📚',
    description: 'Complete 10 worksheets',
    check: (profile) => profile.totalAttempts >= 10,
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    emoji: '🔥',
    description: 'Maintain a 7-day streak',
    check: (profile) => profile.currentStreak >= 7,
  },
  {
    id: 'silver-star',
    name: 'Silver Star',
    emoji: '⭐',
    description: 'Score 80%+ on 3 worksheets in the same topic',
    check: (profile, attempt) => {
      const stats = profile.topicStats?.[attempt.topic];
      return stats !== undefined && stats.count >= 3 && stats.avgScore >= 80;
    },
  },
  {
    id: 'gold-star',
    name: 'Gold Star',
    emoji: '🌟',
    description: 'Score 90%+ on 5 worksheets in the same topic',
    check: (profile, attempt) => {
      const stats = profile.topicStats?.[attempt.topic];
      return stats !== undefined && stats.count >= 5 && stats.avgScore >= 90;
    },
  },
  {
    id: 'platinum-star',
    name: 'Platinum Star',
    emoji: '💫',
    description: 'Score 95%+ on 10 worksheets in the same topic',
    check: (profile, attempt) => {
      const stats = profile.topicStats?.[attempt.topic];
      return stats !== undefined && stats.count >= 10 && stats.avgScore >= 95;
    },
  },
  {
    id: 'perfect10',
    name: 'Perfect10',
    emoji: '🎓',
    description: 'Earn 10 perfect scores (100%) in any subject',
    check: (profile) => profile.perfectScoreCount >= 10,
  },
  {
    id: 'rising-star',
    name: 'Rising Star',
    emoji: '📈',
    description: 'Improve your score by 20%+ on a retake',
    check: (profile, attempt) =>
      !attempt.isFirstAttempt && attempt.improvement >= 20,
  },
  {
    id: 'comeback-kid',
    name: 'Comeback Kid',
    emoji: '🚀',
    description: 'Score 90%+ after a previous score below 70%',
    check: (profile, attempt) =>
      !attempt.isFirstAttempt &&
      attempt.previousScore !== null &&
      attempt.previousScore < 70 &&
      attempt.score >= 90,
  },
  {
    id: 'persistent-learner',
    name: 'Persistent Learner',
    emoji: '💪',
    description: 'Attempt the same worksheet 3 or more times',
    check: (profile, attempt) => attempt.worksheetAttemptCount >= 3,
  },
];

/**
 * Returns a badge definition by its id, or null if not found.
 *
 * @param {string} id - Badge id
 * @returns {Badge|null}
 */
export function getBadgeById(id) {
  return BADGES.find((b) => b.id === id) ?? null;
}
