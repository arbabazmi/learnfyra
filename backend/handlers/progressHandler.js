/**
 * @file backend/handlers/progressHandler.js
 * @description Lambda-compatible handler for student progress routes.
 *
 * Routes:
 *   POST /api/progress/save    — record a worksheet attempt and update aggregate stats
 *   GET  /api/progress/history — return the authenticated student's attempt history
 *
 * Both routes require a valid Bearer JWT.
 *
 * Attempt record stored in the 'attempts' table.
 * Aggregate record stored in the 'aggregates' table, keyed by
 * "{studentId}#{subject}" so per-subject stats are easy to update in place.
 *
 * Local dev:  APP_RUNTIME unset → localDbAdapter (JSON files in data-local/)
 * Lambda/AWS: APP_RUNTIME=aws   → DynamoDB adapter (not yet implemented)
 */

import { randomUUID } from 'crypto';
import { validateToken } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';

// ── Lazy-load rewardsEngine for cold start optimisation ───────────────────────
let _rewardsEngine;

/**
 * Returns calculateRewards, importing the module on first call.
 * @returns {Promise<Function>}
 */
async function getRewardsEngine() {
  if (!_rewardsEngine) {
    const mod = await import('../../src/rewards/rewardsEngine.js');
    _rewardsEngine = mod.calculateRewards;
  }
  return _rewardsEngine;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

/**
 * Builds a standard error response.
 * @param {number} statusCode
 * @param {string} message
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * POST /api/progress/save
 * Body: { worksheetId, grade, subject, topic, difficulty, classId?,
 *         totalScore, totalPoints, percentage, answers, timeTaken, timed }
 * Creates an attempt record and updates the aggregate for this student+subject.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleSave(decoded, body) {
  const {
    worksheetId,
    grade,
    subject,
    topic,
    difficulty,
    classId,
    totalScore,
    totalPoints,
    percentage,
    answers,
    timeTaken,
    timed,
  } = body || {};

  // Required field validation
  if (!worksheetId || !grade || !subject || !topic || !difficulty) {
    return errorResponse(400, 'worksheetId, grade, subject, topic, and difficulty are required.');
  }

  if (totalScore === undefined || totalScore === null ||
      totalPoints === undefined || totalPoints === null ||
      percentage === undefined || percentage === null) {
    return errorResponse(400, 'totalScore, totalPoints, and percentage are required.');
  }

  if (!Array.isArray(answers)) {
    return errorResponse(400, 'answers must be an array.');
  }

  const db = getDbAdapter();
  const now = new Date().toISOString();
  const attemptId = randomUUID();

  // Query previous attempts for this student so we can detect first-attempt
  // status and pass the previous score to the rewards engine.
  const previousAttempts = await db.queryByField('attempts', 'studentId', decoded.sub);
  const worksheetAttempts = previousAttempts.filter((a) => a.worksheetId === worksheetId);
  const isFirstAttempt = worksheetAttempts.length === 0;
  const previousScore = worksheetAttempts.length > 0
    ? worksheetAttempts.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0].percentage
    : null;
  const previousAttemptCount = worksheetAttempts.length;

  const attempt = {
    attemptId,
    studentId: decoded.sub,
    worksheetId,
    classId: classId || null,
    grade,
    subject,
    topic,
    difficulty,
    totalScore,
    totalPoints,
    percentage,
    answers,
    timeTaken: typeof timeTaken === 'number' ? timeTaken : 0,
    timed: Boolean(timed),
    submissionSource: 'online',
    createdAt: now,
    updatedAt: now,
  };

  await db.putItem('attempts', attempt);

  // ── Reward calculation (non-fatal) ──────────────────────────────────────────
  let rewards = null;
  try {
    const calculateRewards = await getRewardsEngine();
    rewards = await calculateRewards({
      studentId: decoded.sub,
      worksheetId,
      score: percentage,
      questionCount: totalPoints, // use totalPoints as proxy for question count
      difficulty: difficulty || 'Medium',
      timeTaken: timeTaken || 0,
      estimatedTime: 0, // not available at this endpoint
      isFirstAttempt,
      isTimedMode: Boolean(timed),
      topic: topic || 'General',
      answers: answers || [],
      previousScore: previousScore || null,
      worksheetAttemptCount: previousAttemptCount + 1,
    });
  } catch (rewardErr) {
    console.error('Reward calculation failed (non-fatal):', rewardErr);
  }

  // Update / create the aggregate record for this student + subject combo.
  // The aggregate is keyed by "{studentId}#{subject}" so getItem can find it.
  const aggregateId = `${decoded.sub}#${subject}`;
  const existing = await db.getItem('aggregates', aggregateId);

  if (existing) {
    const newAttemptCount = existing.attemptCount + 1;
    const newTotalScore   = existing.totalScore + totalScore;
    const newTotalPoints  = existing.totalPoints + totalPoints;
    await db.updateItem('aggregates', aggregateId, {
      attemptCount: newAttemptCount,
      totalScore:   newTotalScore,
      totalPoints:  newTotalPoints,
      averagePercentage: newTotalPoints > 0
        ? Math.round((newTotalScore / newTotalPoints) * 100)
        : 0,
      lastAttemptAt: now,
      updatedAt: now,
    });
  } else {
    await db.putItem('aggregates', {
      id: aggregateId,
      studentId: decoded.sub,
      subject,
      attemptCount: 1,
      totalScore,
      totalPoints,
      averagePercentage: totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0,
      lastAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ attemptId, message: 'Saved.', rewards }),
  };
}

/**
 * GET /api/progress/history
 * Returns all attempts for the authenticated student, sorted by createdAt descending.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleHistory(decoded) {
  const db = getDbAdapter();

  const allAttempts = await db.queryByField('attempts', 'studentId', decoded.sub);

  const sorted = [...allAttempts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const attempts = sorted.map((a) => ({
    attemptId: a.attemptId,
    worksheetId: a.worksheetId,
    grade: a.grade,
    subject: a.subject,
    topic: a.topic,
    difficulty: a.difficulty,
    totalScore: a.totalScore,
    totalPoints: a.totalPoints,
    percentage: a.percentage,
    timeTaken: a.timeTaken,
    timed: a.timed,
    createdAt: a.createdAt,
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ attempts }),
  };
}

/**
 * Lambda handler — POST /api/progress/save and GET /api/progress/history
 *
 * @param {Object} event - API Gateway event or Express-shaped mock event
 * @param {Object} [context] - Lambda context (optional in local dev)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  if (context?.callbackWaitsForEmptyEventLoop !== undefined) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);

    const path = event.path || event.routeKey || '';
    const method = event.httpMethod || 'GET';

    if (path.endsWith('/save') && method === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON in request body.');
      }

      return await handleSave(decoded, body);
    }

    if (path.endsWith('/history') && method === 'GET') {
      return await handleHistory(decoded);
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('progressHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
