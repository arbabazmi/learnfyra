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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];

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
 * Parses an integer from query string with bounds.
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
 * Validates and normalizes POST /api/progress/save payload.
 * @param {Object} body
 * @returns {{ error: string|null, normalized?: Object }}
 */
function validateSavePayload(body) {
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

  if (!worksheetId || !grade || !subject || !topic || !difficulty) {
    return { error: 'worksheetId, grade, subject, topic, and difficulty are required.' };
  }

  if (totalScore === undefined || totalScore === null ||
      totalPoints === undefined || totalPoints === null ||
      percentage === undefined || percentage === null) {
    return { error: 'totalScore, totalPoints, and percentage are required.' };
  }

  if (typeof worksheetId !== 'string' || !UUID_REGEX.test(worksheetId)) {
    return { error: 'worksheetId must be a valid UUID v4.' };
  }

  if (!Number.isInteger(grade) || grade < 1 || grade > 10) {
    return { error: 'grade must be an integer between 1 and 10.' };
  }

  if (!VALID_SUBJECTS.includes(subject)) {
    return { error: `subject must be one of: ${VALID_SUBJECTS.join(', ')}.` };
  }

  if (typeof topic !== 'string' || !topic.trim() || topic.trim().length > 200) {
    return { error: 'topic must be a non-empty string of 200 characters or fewer.' };
  }

  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return { error: `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}.` };
  }

  if (classId != null && classId !== '' && (typeof classId !== 'string' || !UUID_REGEX.test(classId))) {
    return { error: 'classId must be a valid UUID v4 when provided.' };
  }

  if (!Number.isFinite(totalScore) || totalScore < 0) {
    return { error: 'totalScore must be a finite number greater than or equal to 0.' };
  }

  if (!Number.isFinite(totalPoints) || totalPoints <= 0) {
    return { error: 'totalPoints must be a finite number greater than 0.' };
  }

  if (totalScore > totalPoints) {
    return { error: 'totalScore cannot be greater than totalPoints.' };
  }

  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return { error: 'percentage must be a finite number between 0 and 100.' };
  }

  if (!Array.isArray(answers)) {
    return { error: 'answers must be an array.' };
  }

  for (const entry of answers) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'Each answers entry must be an object.' };
    }
    if (!Number.isInteger(Number(entry.number)) || Number(entry.number) < 1) {
      return { error: 'Each answers entry must include a positive integer number.' };
    }
    if (entry.answer == null || typeof entry.answer !== 'string') {
      return { error: 'Each answers entry must include a string answer.' };
    }
  }

  const expectedPercentage = Math.round((totalScore / totalPoints) * 100);
  if (Math.abs(expectedPercentage - percentage) > 1) {
    return { error: 'percentage does not match totalScore / totalPoints.' };
  }

  const normalizedTimeTaken =
    Number.isFinite(timeTaken) && Number.isInteger(timeTaken) && timeTaken >= 0
      ? timeTaken
      : 0;

  return {
    error: null,
    normalized: {
      worksheetId,
      grade,
      subject,
      topic: topic.trim(),
      difficulty,
      classId: classId || null,
      totalScore,
      totalPoints,
      percentage: expectedPercentage,
      answers,
      timeTaken: normalizedTimeTaken,
      timed: Boolean(timed),
    },
  };
}

/**
 * Returns the trend label for a topic using recent vs prior performance.
 * @param {Object[]} attemptsSortedAsc
 * @returns {string}
 */
function calculateTrend(attemptsSortedAsc) {
  if (!attemptsSortedAsc || attemptsSortedAsc.length < 2) {
    return 'stable';
  }

  const recent = attemptsSortedAsc.slice(-3);
  const prior = attemptsSortedAsc.slice(0, -3);

  const recentAvg = recent.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0) / recent.length;
  const priorAvg = prior.length > 0
    ? prior.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0) / prior.length
    : (Number(recent[0].percentage) || 0);

  if (recentAvg > priorAvg + 5) return 'improving';
  if (recentAvg < priorAvg - 5) return 'declining';
  return 'stable';
}

/**
 * Safely resolves a user display name from a user record.
 * @param {Object|null} user
 * @returns {string}
 */
function resolveDisplayName(user) {
  if (!user) return 'Student';
  return user.displayName || user.name || user.fullName || user.email || 'Student';
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
  const validated = validateSavePayload(body);
  if (validated.error) {
    return errorResponse(400, validated.error);
  }

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
  } = validated.normalized;

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
    const newAttemptCount = (Number(existing.attemptCount) || 0) + 1;
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

  // ── Certificate issuance (non-fatal) ───────────────────────────────────────
  const certificateThreshold = Number(process.env.CERTIFICATE_THRESHOLD || 80);
  if (isFirstAttempt && percentage >= certificateThreshold) {
    const certificate = {
      id: randomUUID(),
      studentId: decoded.sub,
      attemptId,
      worksheetId,
      subject,
      topic,
      grade,
      score: totalScore,
      totalPoints,
      percentage,
      issuedAt: now,
      createdAt: now,
    };

    try {
      await db.putItem('certificates', certificate);
    } catch (certErr) {
      console.error('Certificate issuance failed (non-fatal):', certErr);
    }
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
async function handleHistory(decoded, queryStringParameters) {
  const db = getDbAdapter();
  const qs = queryStringParameters || {};

  const limitParsed = parseIntParam(qs.limit, 50, 1, 100);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 100.');
  }

  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be an integer greater than or equal to 0.');
  }

  const subjectFilter = qs.subject;
  if (subjectFilter != null && subjectFilter !== '' && !VALID_SUBJECTS.includes(subjectFilter)) {
    return errorResponse(400, `subject must be one of: ${VALID_SUBJECTS.join(', ')}.`);
  }

  const allAttempts = await db.queryByField('attempts', 'studentId', decoded.sub);

  const filtered = subjectFilter
    ? allAttempts.filter((attempt) => attempt.subject === subjectFilter)
    : allAttempts;

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const paged = sorted.slice(offsetParsed.value, offsetParsed.value + limitParsed.value);

  const attempts = paged.map((a) => ({
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
 * GET /api/progress/insights
 * Returns grouped subject/topic insights for the authenticated user.
 *
 * @param {Object} decoded
 * @param {Object} queryStringParameters
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleInsights(decoded, queryStringParameters) {
  const db = getDbAdapter();
  const qs = queryStringParameters || {};

  const limitParsed = parseIntParam(qs.limit, 20, 1, 50);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 50.');
  }

  const subjectFilter = qs.subject;
  const subjectProvided = subjectFilter != null && subjectFilter !== '';
  if (subjectProvided && !VALID_SUBJECTS.includes(subjectFilter)) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        studentId: decoded.sub,
        generatedAt: new Date().toISOString(),
        insights: [],
        weakTopicCount: 0,
        totalTopicCount: 0,
      }),
    };
  }

  const attempts = await db.queryByField('attempts', 'studentId', decoded.sub);
  const filteredAttempts = subjectProvided
    ? attempts.filter((attempt) => attempt.subject === subjectFilter)
    : attempts;

  const buckets = new Map();
  for (const attempt of filteredAttempts) {
    const subject = attempt.subject || 'Unknown';
    const topic = attempt.topic || 'Unknown';
    const key = `${subject}:::${topic}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        subject,
        topic,
        attempts: [],
        totalScore: 0,
        totalPoints: 0,
      });
    }

    const bucket = buckets.get(key);
    bucket.attempts.push(attempt);
    bucket.totalScore += Number(attempt.totalScore) || 0;
    bucket.totalPoints += Number(attempt.totalPoints) || 0;
  }

  const computed = [...buckets.values()].map((bucket) => {
    const attemptsSortedAsc = [...bucket.attempts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const averageScore = bucket.totalPoints > 0
      ? Math.round((bucket.totalScore / bucket.totalPoints) * 100)
      : 0;

    const recentScores = attemptsSortedAsc
      .slice(-3)
      .map((attempt) => Number(attempt.percentage) || 0);

    return {
      subject: bucket.subject,
      topic: bucket.topic,
      attemptCount: bucket.attempts.length,
      averageScore,
      weakFlag: averageScore < 70,
      trend: calculateTrend(attemptsSortedAsc),
      recentScores,
      lastAttemptAt: attemptsSortedAsc.length > 0
        ? attemptsSortedAsc[attemptsSortedAsc.length - 1].createdAt
        : null,
    };
  });

  const sorted = computed.sort((a, b) => {
    if (a.weakFlag !== b.weakFlag) {
      return a.weakFlag ? -1 : 1;
    }
    return a.averageScore - b.averageScore;
  });

  const limited = sorted.slice(0, limitParsed.value);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      studentId: decoded.sub,
      generatedAt: new Date().toISOString(),
      insights: limited,
      weakTopicCount: sorted.filter((item) => item.weakFlag).length,
      totalTopicCount: sorted.length,
    }),
  };
}

/**
 * GET /api/progress/parent/:childId
 * Returns a parent-scoped view of child attempts and aggregates.
 *
 * @param {Object} decoded
 * @param {string} childId
 * @param {Object} queryStringParameters
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleParentProgress(decoded, childId, queryStringParameters) {
  if (decoded.role !== 'parent') {
    return errorResponse(403, 'Forbidden.');
  }

  if (!childId || !UUID_REGEX.test(childId)) {
    return errorResponse(400, 'childId must be a valid UUID v4.');
  }

  const qs = queryStringParameters || {};
  const limitParsed = parseIntParam(qs.limit, 50, 1, 200);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 200.');
  }

  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be an integer greater than or equal to 0.');
  }

  const subjectFilter = qs.subject;
  if (subjectFilter != null && subjectFilter !== '' && !VALID_SUBJECTS.includes(subjectFilter)) {
    return errorResponse(400, `subject must be one of: ${VALID_SUBJECTS.join(', ')}.`);
  }

  const db = getDbAdapter();
  const link = await db.getItem('parentLinks', `${decoded.sub}#${childId}`);
  if (!link || link.status !== 'active') {
    return errorResponse(403, 'Forbidden.');
  }

  const childUser = await db.getItem('users', childId);
  if (!childUser) {
    return errorResponse(404, 'Student not found.');
  }

  const attempts = await db.queryByField('attempts', 'studentId', childId);
  const filteredAttempts = subjectFilter
    ? attempts.filter((attempt) => attempt.subject === subjectFilter)
    : attempts;

  const sortedAttempts = filteredAttempts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const pagedAttempts = sortedAttempts
    .slice(offsetParsed.value, offsetParsed.value + limitParsed.value)
    .map((attempt) => ({
      attemptId: attempt.attemptId,
      worksheetId: attempt.worksheetId,
      grade: attempt.grade,
      subject: attempt.subject,
      topic: attempt.topic,
      difficulty: attempt.difficulty,
      totalScore: attempt.totalScore,
      totalPoints: attempt.totalPoints,
      percentage: attempt.percentage,
      timeTaken: attempt.timeTaken,
      timed: attempt.timed,
      createdAt: attempt.createdAt,
    }));

  const allAggregates = await db.listAll('aggregates');
  const aggregates = allAggregates
    .filter((record) => record.studentId === childId)
    .filter((record) => !subjectFilter || record.subject === subjectFilter)
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
      childId,
      displayName: resolveDisplayName(childUser),
      history: pagedAttempts,
      aggregates,
      totalAttempts: filteredAttempts.length,
      pagination: {
        limit: limitParsed.value,
        offset: offsetParsed.value,
        returned: pagedAttempts.length,
      },
    }),
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
  context.callbackWaitsForEmptyEventLoop = false;

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
      return await handleHistory(decoded, event.queryStringParameters || {});
    }

    if (path.endsWith('/insights') && method === 'GET') {
      return await handleInsights(decoded, event.queryStringParameters || {});
    }

    const parentMatch = path.match(/\/api\/progress\/parent\/([^/]+)$/);
    if (parentMatch && method === 'GET') {
      const childId =
        (event.pathParameters && event.pathParameters.childId) || parentMatch[1];
      return await handleParentProgress(decoded, childId, event.queryStringParameters || {});
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('progressHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
