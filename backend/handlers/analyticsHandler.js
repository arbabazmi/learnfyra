/**
 * @file backend/handlers/analyticsHandler.js
 * @description Lambda-compatible handler for teacher analytics routes.
 *
 * Routes:
 *   GET /api/analytics/class/:id — class-level topic performance breakdown (teacher only)
 *
 * Requires a valid Bearer JWT with the 'teacher' role.
 *
 * Algorithm:
 *   1. Load all active memberships for the requested class.
 *   2. Collect all attempt records where studentId is in the membership set.
 *   3. Group attempts by topic; compute per-topic average score percentage.
 *   4. Flag topics as "weak" when the average score is below 70%.
 *
 * Local dev:  APP_RUNTIME unset → localDbAdapter (JSON files in data-local/)
 * Lambda/AWS: APP_RUNTIME=aws   → DynamoDB adapter (not yet implemented)
 */

import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';

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
 * GET /api/analytics/class/:id
 * Returns a per-topic performance breakdown for all students in the class.
 *
 * @param {string} classId - Class UUID from the path parameter
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleClassAnalytics(classId) {
  if (!classId) {
    return errorResponse(400, 'Class ID is required.');
  }

  const db = getDbAdapter();

  const classRecord = await db.getItem('classes', classId);
  if (!classRecord) {
    return errorResponse(404, 'Class not found.');
  }

  // Collect the set of student IDs enrolled in this class
  const memberships = await db.queryByField('memberships', 'classId', classId);
  const activeMemberships = memberships.filter((m) => m.status === 'active');
  const studentIds = new Set(activeMemberships.map((m) => m.studentId));

  if (studentIds.size === 0) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        classId,
        topicBreakdown: [],
        totalStudents: 0,
        totalAttempts: 0,
      }),
    };
  }

  // Gather all attempt records for every enrolled student.
  // localDbAdapter does not support multi-value queries, so we fan out.
  const attemptArrays = await Promise.all(
    [...studentIds].map((sid) => db.queryByField('attempts', 'studentId', sid))
  );
  const allAttempts = attemptArrays.flat();

  // Group by topic, accumulating earned points and possible points
  const topicMap = new Map();
  for (const attempt of allAttempts) {
    const topic = attempt.topic || 'Unknown';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { totalScore: 0, totalPoints: 0, attempts: 0 });
    }
    const bucket = topicMap.get(topic);
    bucket.totalScore  += attempt.totalScore  ?? 0;
    bucket.totalPoints += attempt.totalPoints ?? 0;
    bucket.attempts    += 1;
  }

  // Build the breakdown array sorted alphabetically by topic name
  const topicBreakdown = [...topicMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, stats]) => {
      const averageScore = stats.totalPoints > 0
        ? Math.round((stats.totalScore / stats.totalPoints) * 100)
        : 0;
      return {
        topic,
        attempts: stats.attempts,
        averageScore,
        weakFlag: averageScore < 70,
      };
    });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      classId,
      topicBreakdown,
      totalStudents: studentIds.size,
      totalAttempts: allAttempts.length,
    }),
  };
}

/**
 * Lambda handler — GET /api/analytics/class/:id
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
    requireRole(decoded, ['teacher']);

    const classId =
      (event.pathParameters && event.pathParameters.id) || null;

    return await handleClassAnalytics(classId);
  } catch (err) {
    console.error('analyticsHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
