/**
 * @file backend/handlers/rewardsHandler.js
 * @description Lambda-compatible handler for rewards routes.
 *
 * Routes:
 *   GET /api/rewards/student/:id  — return a student's reward profile
 *   GET /api/rewards/class/:id    — return aggregate reward stats for a class
 *
 * Student route: requires auth; the requesting user must be the student
 * themselves (decoded.sub === pathId) OR a teacher (decoded.role === 'teacher').
 * Class route: requires auth with teacher role only.
 *
 * Local dev:  APP_RUNTIME unset → localDbAdapter (JSON files in data-local/)
 * Lambda/AWS: APP_RUNTIME=aws   → DynamoDB adapter (not yet implemented)
 */

import { validateToken } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
 * Default reward profile returned when no profile record exists yet.
 * @type {Object}
 */
const DEFAULT_PROFILE = {
  lifetimePoints: 0,
  currentStreak: 0,
  badges: [],
  freezeTokens: 0,
};

/**
 * GET /api/rewards/student/:id
 * Returns the reward profile for the requested student.
 * The caller must be the student themselves OR a teacher.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {string} studentId - Path parameter value
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleStudentRewards(decoded, studentId) {
  if (decoded.sub !== studentId && decoded.role !== 'teacher') {
    return errorResponse(403, 'Forbidden');
  }

  const db = getDbAdapter();

  // Teachers may only view rewards for students enrolled in one of their classes.
  if (decoded.role === 'teacher') {
    // Collect every class this student belongs to
    const studentMemberships = await db.queryByField('memberships', 'studentId', studentId);
    if (!studentMemberships || studentMemberships.length === 0) {
      return errorResponse(403, 'Forbidden');
    }

    // Collect every class owned by this teacher
    const teacherClasses = await db.queryByField('classes', 'teacherId', decoded.sub);
    const teacherClassIds = new Set((teacherClasses || []).map((c) => c.classId));

    // The student must belong to at least one of the teacher's classes
    const isEnrolled = studentMemberships.some((m) => teacherClassIds.has(m.classId));
    if (!isEnrolled) {
      return errorResponse(403, 'Forbidden');
    }
  }

  const profile = await db.getItem('rewardProfiles', studentId);

  if (!profile) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        studentId,
        ...DEFAULT_PROFILE,
        monthlyPoints: 0,
        longestStreak: 0,
        topicStats: {},
      }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      studentId,
      lifetimePoints: profile.lifetimePoints ?? 0,
      monthlyPoints: profile.monthlyPoints ?? 0,
      currentStreak: profile.currentStreak ?? 0,
      longestStreak: profile.longestStreak ?? 0,
      freezeTokens: profile.freezeTokens ?? 0,
      badges: profile.badges ?? [],
      topicStats: profile.topicStats ?? {},
    }),
  };
}

/**
 * GET /api/rewards/class/:id
 * Returns aggregate reward stats for every student enrolled in the class.
 * Requires teacher role.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {string} classId - Path parameter value
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleClassRewards(decoded, classId) {
  if (decoded.role !== 'teacher') {
    return errorResponse(403, 'Forbidden');
  }

  const db = getDbAdapter();

  // Fetch all memberships for this class
  const memberships = await db.queryByField('memberships', 'classId', classId);

  if (!memberships || memberships.length === 0) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        classId,
        totalStudents: 0,
        totalAttempts: 0,
        avgScore: 0,
        participationRate: 0,
        studentSummaries: [],
      }),
    };
  }

  const studentIds = memberships.map((m) => m.studentId);

  // Fetch reward profiles and user records for all students in parallel
  const [profiles, users] = await Promise.all([
    Promise.all(studentIds.map((id) => db.getItem('rewardProfiles', id))),
    Promise.all(studentIds.map((id) => db.getItem('users', id))),
  ]);

  // Fetch attempts for all students to compute aggregate stats
  const allAttemptArrays = await Promise.all(
    studentIds.map((id) => db.queryByField('attempts', 'studentId', id))
  );

  let totalAttempts = 0;
  let totalPercentageSum = 0;
  let studentsWithAttempts = 0;

  const studentSummaries = studentIds.map((id, idx) => {
    const profile = profiles[idx];
    const user = users[idx];
    const attempts = allAttemptArrays[idx] || [];

    totalAttempts += attempts.length;
    if (attempts.length > 0) {
      studentsWithAttempts += 1;
      const studentPctSum = attempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0);
      totalPercentageSum += studentPctSum / attempts.length;
    }

    return {
      studentId: id,
      displayName: user ? (user.displayName || user.name || user.email || id) : id,
      lifetimePoints: profile ? (profile.lifetimePoints ?? 0) : 0,
      currentStreak: profile ? (profile.currentStreak ?? 0) : 0,
      badgeCount: profile ? (profile.badges ? profile.badges.length : 0) : 0,
    };
  });

  const totalStudents = studentIds.length;
  const avgScore = studentsWithAttempts > 0
    ? Math.round(totalPercentageSum / studentsWithAttempts)
    : 0;
  const participationRate = totalStudents > 0
    ? Math.round((studentsWithAttempts / totalStudents) * 100)
    : 0;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      classId,
      totalStudents,
      totalAttempts,
      avgScore,
      participationRate,
      studentSummaries,
    }),
  };
}

/**
 * Lambda handler — GET /api/rewards/student/:id and GET /api/rewards/class/:id
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

    const pathId = event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : null;

    if (!pathId) {
      return errorResponse(400, 'Missing id path parameter.');
    }

    const path = event.path || '';

    if (path.includes('/student/')) {
      return await handleStudentRewards(decoded, pathId);
    }

    if (path.includes('/class/')) {
      return await handleClassRewards(decoded, pathId);
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('rewardsHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
