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

// ── M05 Analytics Endpoints ────────────────────────────────────────────────────

/**
 * GET /api/classes/:classId/analytics
 * Returns class overview: assignment scores, completion rate, weak topics,
 * and students below the accuracy threshold.
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {string} classId - Class UUID
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleM05ClassAnalytics(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'Invalid class ID format.');
  }

  const db = getDbAdapter();

  let classRecord = await db.getItem('classes', `CLASS#${classId}`);
  if (!classRecord) classRecord = await db.getItem('classes', classId);
  if (!classRecord) {
    return errorResponse(404, 'Class not found.');
  }
  if (classRecord.teacherId !== decoded.sub) {
    return errorResponse(403, 'Forbidden.');
  }

  const accuracyThreshold = classRecord.accuracyThreshold ?? 60;

  // Query all StudentAssignmentStatus for this class
  const allStatuses = await db.queryByField('studentassignmentstatus', 'classId', classId);

  // Group by assignmentId to compute per-assignment stats
  const assignmentMap = new Map();
  for (const s of allStatuses) {
    if (!assignmentMap.has(s.assignmentId)) {
      assignmentMap.set(s.assignmentId, { total: 0, submitted: 0, totalScore: 0, totalPoints: 0 });
    }
    const bucket = assignmentMap.get(s.assignmentId);
    bucket.total += 1;
    if (s.status === 'submitted') {
      bucket.submitted += 1;
      bucket.totalScore += s.score ?? 0;
      bucket.totalPoints += s.totalPoints ?? 0;
    }
  }

  // Fetch assignment titles for enrichment
  const assignmentBreakdown = await Promise.all(
    [...assignmentMap.entries()].map(async ([assignmentId, stats]) => {
      let title = assignmentId;
      try {
        const a = await db.getItem('assignments', `ASSIGNMENT#${assignmentId}`);
        if (a) title = a.title || title;
      } catch { /* non-fatal */ }
      const averageScore = stats.totalPoints > 0
        ? Math.round((stats.totalScore / stats.totalPoints) * 100)
        : 0;
      const completionRate = stats.total > 0
        ? Math.round((stats.submitted / stats.total) * 100)
        : 0;
      return { assignmentId, title, averageScore, completionRate };
    })
  );

  // Overall completion rate
  const totalStudentAssignmentPairs = allStatuses.length;
  const totalSubmitted = allStatuses.filter(s => s.status === 'submitted').length;
  const overallCompletionRate = totalStudentAssignmentPairs > 0
    ? Math.round((totalSubmitted / totalStudentAssignmentPairs) * 100)
    : 0;

  // Get active students
  const memberships = await db.queryByField('memberships', 'classId', classId);
  const activeStudentIds = memberships.filter(m => m.status === 'active').map(m => m.studentId);

  // Fetch user progress for topic aggregation and threshold detection
  const progressRecords = await Promise.all(
    activeStudentIds.map(sid => db.getItem('rewardprofiles', sid).catch(() => null))
  );

  // Aggregate topic accuracy across all students
  const topicAccMap = new Map();
  const studentsBelowThreshold = [];

  for (let i = 0; i < activeStudentIds.length; i++) {
    const studentId = activeStudentIds[i];
    const prog = progressRecords[i];
    if (!prog) continue;

    // Aggregate per-topic accuracy
    if (prog.topicAccuracy && typeof prog.topicAccuracy === 'object') {
      for (const [topic, acc] of Object.entries(prog.topicAccuracy)) {
        if (!topicAccMap.has(topic)) topicAccMap.set(topic, []);
        topicAccMap.get(topic).push(Number(acc) || 0);
      }
    }

    // Check if student is below accuracy threshold
    const overallAcc = prog.overallAccuracy ?? prog.averageAccuracy ?? null;
    if (overallAcc !== null && overallAcc < accuracyThreshold) {
      const user = await db.getItem('users', studentId);
      studentsBelowThreshold.push({
        studentId,
        displayName: user?.displayName || 'Unknown Student',
        accuracy: Math.round(overallAcc),
      });
    }
  }

  // Find weakest 5 topics
  const weakestTopics = [...topicAccMap.entries()]
    .map(([topic, accuracies]) => ({
      topic,
      classAverageAccuracy: Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length),
    }))
    .sort((a, b) => a.classAverageAccuracy - b.classAverageAccuracy)
    .slice(0, 5);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      classId,
      assignmentBreakdown,
      overallCompletionRate,
      weakestTopics,
      studentsBelowThreshold,
      accuracyThreshold,
    }),
  };
}

/**
 * GET /api/classes/:classId/analytics/heatmap
 * Returns a topic × student accuracy matrix.
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {string} classId - Class UUID
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleClassHeatmap(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'Invalid class ID format.');
  }

  const db = getDbAdapter();

  let classRecord = await db.getItem('classes', `CLASS#${classId}`);
  if (!classRecord) classRecord = await db.getItem('classes', classId);
  if (!classRecord) {
    return errorResponse(404, 'Class not found.');
  }
  if (classRecord.teacherId !== decoded.sub) {
    return errorResponse(403, 'Forbidden.');
  }

  const memberships = await db.queryByField('memberships', 'classId', classId);
  const activeStudentIds = memberships.filter(m => m.status === 'active').map(m => m.studentId);

  // Fetch user data and progress in parallel
  const [users, progressRecords] = await Promise.all([
    Promise.all(activeStudentIds.map(sid => db.getItem('users', sid).catch(() => null))),
    Promise.all(activeStudentIds.map(sid => db.getItem('rewardprofiles', sid).catch(() => null))),
  ]);

  // Build union of all topics
  const allTopics = new Set();
  for (const prog of progressRecords) {
    if (prog?.topicAccuracy) {
      for (const topic of Object.keys(prog.topicAccuracy)) {
        allTopics.add(topic);
      }
    }
  }
  const topics = [...allTopics].sort();

  // Build students list
  const students = activeStudentIds.map((sid, i) => ({
    studentId: sid,
    displayName: users[i]?.displayName || 'Unknown Student',
  }));

  // Build cells matrix
  const cells = {};
  for (let i = 0; i < activeStudentIds.length; i++) {
    const sid = activeStudentIds[i];
    const prog = progressRecords[i];
    cells[sid] = {};
    for (const topic of topics) {
      cells[sid][topic] = (prog?.topicAccuracy?.[topic] !== undefined)
        ? Math.round(prog.topicAccuracy[topic])
        : null;
    }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ classId, students, topics, cells }),
  };
}

/**
 * GET /api/classes/:classId/students/:studentId/progress
 * Returns teacher-view of a single student's progress within a class.
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {string} classId - Class UUID
 * @param {string} studentId - Student UUID
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleM05StudentProgress(decoded, classId, studentId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'Invalid class ID format.');
  }
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'Invalid student ID format.');
  }

  const db = getDbAdapter();

  let classRecord = await db.getItem('classes', `CLASS#${classId}`);
  if (!classRecord) classRecord = await db.getItem('classes', classId);
  if (!classRecord) {
    return errorResponse(404, 'Class not found.');
  }
  if (classRecord.teacherId !== decoded.sub) {
    return errorResponse(403, 'Forbidden.');
  }

  const membershipId = `${classId}#${studentId}`;
  const membership = await db.getItem('memberships', membershipId);
  if (!membership || membership.status === 'removed') {
    return errorResponse(404, 'Student not found in this class.');
  }

  const user = await db.getItem('users', studentId);
  if (!user) {
    return errorResponse(404, 'Student not found.');
  }

  const allAttempts = await db.queryByField('attempts', 'studentId', studentId);
  const classAttempts = allAttempts.filter(a => a.classId === classId);

  const topicBuckets = new Map();
  for (const attempt of allAttempts) {
    const topic = attempt.topic || 'Unknown';
    const key = `${attempt.subject || 'Unknown'}:::${topic}`;
    if (!topicBuckets.has(key)) {
      topicBuckets.set(key, { subject: attempt.subject || 'Unknown', topic, attempts: 0, totalScore: 0, totalPoints: 0 });
    }
    const bucket = topicBuckets.get(key);
    bucket.attempts += 1;
    bucket.totalScore += Number(attempt.totalScore) || 0;
    bucket.totalPoints += Number(attempt.totalPoints) || 0;
  }

  const topicBreakdown = [...topicBuckets.values()].map(bucket => {
    const averageScore = bucket.totalPoints > 0
      ? Math.round((bucket.totalScore / bucket.totalPoints) * 100)
      : 0;
    return { subject: bucket.subject, topic: bucket.topic, attempts: bucket.attempts, averageScore, weakFlag: averageScore < 70 };
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      studentId,
      displayName: resolveDisplayName(user),
      classId,
      totalAttempts: allAttempts.length,
      classAttempts: classAttempts.length,
      topicBreakdown,
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
    const params = event.pathParameters || {};

    // ── M05 routes ─────────────────────────────────────────────────────────

    // GET /api/classes/:classId/analytics/heatmap
    const heatmapMatch = path.match(/^\/api\/classes\/([^/]+)\/analytics\/heatmap$/);
    if (heatmapMatch && event.httpMethod === 'GET') {
      const classId = params.classId || heatmapMatch[1];
      return await handleClassHeatmap(decoded, classId);
    }

    // GET /api/classes/:classId/students/:studentId/progress
    const studentProgressMatch = path.match(/^\/api\/classes\/([^/]+)\/students\/([^/]+)\/progress$/);
    if (studentProgressMatch && event.httpMethod === 'GET') {
      const classId = params.classId || studentProgressMatch[1];
      const studentId = params.studentId || studentProgressMatch[2];
      return await handleM05StudentProgress(decoded, classId, studentId);
    }

    // GET /api/classes/:classId/analytics
    const classAnalyticsMatch = path.match(/^\/api\/classes\/([^/]+)\/analytics$/);
    if (classAnalyticsMatch && event.httpMethod === 'GET') {
      const classId = params.classId || classAnalyticsMatch[1];
      return await handleM05ClassAnalytics(decoded, classId);
    }

    // ── Legacy routes ───────────────────────────────────────────────────────

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
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (statusCode >= 500) {
      console.error('analyticsHandler error:', err);
    }
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = (statusCode < 500 || isDebug) ? err.message : 'Internal server error.';
    const body = { error: message };
    if (isDebug) {
      body._debug = { stack: err.stack, handler: 'analyticsHandler', statusCode, timestamp: new Date().toISOString() };
    }
    return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
  }
};
