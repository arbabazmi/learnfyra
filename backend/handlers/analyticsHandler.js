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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];

/**
 * Parses and validates a bounded integer query parameter.
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {{ value: number, error: string|null }}
 */
function parseIntParam(value, fallback, min, max) {
  if (value == null || value === '') return { value: fallback, error: null };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { value: fallback, error: `Value must be an integer between ${min} and ${max}.` };
  }
  return { value: parsed, error: null };
}

/**
 * Resolves display name from user record.
 * @param {Object|null} user
 * @returns {string}
 */
function resolveDisplayName(user) {
  if (!user) return 'Student';
  return user.displayName || user.name || user.fullName || user.email || 'Student';
}

/**
 * GET /api/analytics/class/:id
 * Returns a per-topic performance breakdown for all students in the class.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {string} classId - Class UUID from the path parameter
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleClassAnalytics(decoded, classId) {
  if (!classId) {
    return errorResponse(400, 'Class ID is required.');
  }

  if (!UUID_REGEX.test(classId)) {
    return errorResponse(400, 'Invalid class ID format.');
  }

  const db = getDbAdapter();

  const classRecord = await db.getItem('classes', classId);
  if (!classRecord) {
    return errorResponse(404, 'Class not found.');
  }

  if (classRecord.teacherId !== decoded.sub) {
    return errorResponse(403, 'Forbidden.');
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
 * GET /api/analytics/student/:id
 * Returns teacher-view student attempts, topic breakdown, and aggregates.
 *
 * @param {Object} decoded
 * @param {string} studentId
 * @param {Object} queryStringParameters
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleStudentAnalytics(decoded, studentId, queryStringParameters) {
  if (!studentId) {
    return errorResponse(400, 'Student ID is required.');
  }

  if (!UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'Invalid student ID format.');
  }

  const qs = queryStringParameters || {};
  const classId = qs.classId;
  const subject = qs.subject;

  const limitParsed = parseIntParam(qs.limit, 100, 1, 500);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 500.');
  }

  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be an integer greater than or equal to 0.');
  }

  if (classId != null && classId !== '' && !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'Invalid class ID format.');
  }

  if (subject != null && subject !== '' && !VALID_SUBJECTS.includes(subject)) {
    return errorResponse(400, `subject must be one of: ${VALID_SUBJECTS.join(', ')}.`);
  }

  const db = getDbAdapter();

  if (classId) {
    const classRecord = await db.getItem('classes', classId);
    if (!classRecord) {
      return errorResponse(404, 'Class not found.');
    }
    if (classRecord.teacherId !== decoded.sub) {
      return errorResponse(403, 'Forbidden.');
    }
  }

  const user = await db.getItem('users', studentId);
  if (!user) {
    return errorResponse(404, 'Student not found.');
  }

  const allAttempts = await db.queryByField('attempts', 'studentId', studentId);
  const classFiltered = classId
    ? allAttempts.filter((attempt) => attempt.classId === classId)
    : allAttempts;
  const subjectFiltered = subject
    ? classFiltered.filter((attempt) => attempt.subject === subject)
    : classFiltered;

  const sortedAttempts = [...subjectFiltered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const pagedAttempts = sortedAttempts
    .slice(offsetParsed.value, offsetParsed.value + limitParsed.value)
    .map((attempt) => ({
      attemptId: attempt.attemptId,
      worksheetId: attempt.worksheetId,
      classId: attempt.classId,
      grade: attempt.grade,
      subject: attempt.subject,
      topic: attempt.topic,
      difficulty: attempt.difficulty,
      totalScore: attempt.totalScore,
      totalPoints: attempt.totalPoints,
      percentage: attempt.percentage,
      timeTaken: attempt.timeTaken,
      timed: attempt.timed,
      answers: attempt.answers,
      createdAt: attempt.createdAt,
    }));

  const topicBuckets = new Map();
  for (const attempt of subjectFiltered) {
    const topic = attempt.topic || 'Unknown';
    const key = `${attempt.subject || 'Unknown'}:::${topic}`;
    if (!topicBuckets.has(key)) {
      topicBuckets.set(key, {
        subject: attempt.subject || 'Unknown',
        topic,
        attempts: 0,
        totalScore: 0,
        totalPoints: 0,
      });
    }
    const bucket = topicBuckets.get(key);
    bucket.attempts += 1;
    bucket.totalScore += Number(attempt.totalScore) || 0;
    bucket.totalPoints += Number(attempt.totalPoints) || 0;
  }

  const topicBreakdown = [...topicBuckets.values()].map((bucket) => {
    const averageScore = bucket.totalPoints > 0
      ? Math.round((bucket.totalScore / bucket.totalPoints) * 100)
      : 0;
    return {
      subject: bucket.subject,
      topic: bucket.topic,
      attempts: bucket.attempts,
      averageScore,
      weakFlag: averageScore < 70,
    };
  });

  const aggregates = (await db.listAll('aggregates'))
    .filter((record) => record.studentId === studentId)
    .map((record) => ({
      subject: record.subject,
      attemptCount: record.attemptCount,
      averagePercentage: record.averagePercentage,
      lastAttemptAt: record.lastAttemptAt,
    }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      studentId,
      displayName: resolveDisplayName(user),
      attempts: pagedAttempts,
      topicBreakdown,
      aggregates,
      totalAttempts: subjectFiltered.length,
      pagination: {
        limit: limitParsed.value,
        offset: offsetParsed.value,
        returned: pagedAttempts.length,
      },
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
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);
    requireRole(decoded, ['teacher']);

    const path = event.path || event.routeKey || '';

    const studentMatch = path.match(/\/api\/analytics\/student\/([^/]+)$/);
    if (studentMatch && event.httpMethod === 'GET') {
      const studentId =
        (event.pathParameters && event.pathParameters.id) || studentMatch[1];
      return await handleStudentAnalytics(decoded, studentId, event.queryStringParameters || {});
    }

    const classId =
      (event.pathParameters && event.pathParameters.id) || null;

    return await handleClassAnalytics(decoded, classId);
  } catch (err) {
    console.error('analyticsHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
