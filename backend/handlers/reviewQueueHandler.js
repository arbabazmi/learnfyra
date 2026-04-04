/**
 * @file backend/handlers/reviewQueueHandler.js
 * @description Lambda-compatible handler for teacher review-queue routes.
 *
 * Routes:
 *   GET  /api/classes/:classId/review-queue          — list pending review items
 *   POST /api/review-queue/:reviewId/resolve          — approve or override a flagged answer
 *
 * Both routes require Bearer JWT with role = teacher.
 */

import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { verifyTeacherOwnsClass } from '../../src/utils/rbac.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(statusCode, errorCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: errorCode, message }),
  };
}

/**
 * GET /api/classes/:classId/review-queue
 * Returns all pending review items for the class, with student names resolved.
 */
async function handleGetReviewQueue(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'classId must be a valid UUID.');
  }

  const db = getDbAdapter();

  try {
    await verifyTeacherOwnsClass(db, classId, decoded.sub);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  // Query all review items for this class
  const allItems = await db.queryByField('reviewqueueitems', 'classId', classId);
  const pendingItems = allItems.filter(item => item.status === 'pending');

  // Resolve student display names
  const enriched = await Promise.all(
    pendingItems.map(async (item) => {
      const user = await db.getItem('users', item.studentId);
      return {
        reviewId: item.reviewId,
        studentName: user?.displayName || 'Unknown Student',
        questionNumber: item.questionNumber,
        questionText: item.questionText,
        studentAnswer: item.studentAnswer,
        expectedAnswer: item.expectedAnswer,
        systemConfidenceScore: item.systemConfidenceScore,
        currentScore: item.currentScore,
        pointsPossible: item.pointsPossible,
        attemptId: item.attemptId,
        createdAt: item.createdAt,
      };
    })
  );

  // Sort by createdAt ascending
  enriched.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      pendingCount: enriched.length,
      items: enriched,
    }),
  };
}

/**
 * POST /api/review-queue/:reviewId/resolve
 * Approves or overrides a flagged answer, then cascades the score update.
 */
async function handleResolveReview(decoded, reviewId, body) {
  if (!reviewId || !UUID_REGEX.test(reviewId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'reviewId must be a valid UUID.');
  }

  const { action, overrideScore } = body || {};

  if (!action || !['approve', 'override'].includes(action)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'action must be "approve" or "override".');
  }
  if (action === 'override') {
    if (overrideScore === undefined || overrideScore === null || !Number.isInteger(overrideScore) || overrideScore < 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'overrideScore must be a non-negative integer when action is "override".');
    }
  }

  const db = getDbAdapter();

  // Step 1: Fetch the review item
  const reviewItem = await db.getItem('reviewqueueitems', `REVIEW#${reviewId}`);
  if (!reviewItem) {
    return errorResponse(404, 'REVIEW_ITEM_NOT_FOUND', 'Review item not found.');
  }
  if (reviewItem.status === 'resolved') {
    return errorResponse(409, 'REVIEW_ALREADY_RESOLVED', 'This review item has already been resolved.');
  }

  // Step 2: Verify teacher owns the class
  const { classId, attemptId, studentId, currentScore, pointsPossible, assignmentId, questionNumber } = reviewItem;
  try {
    await verifyTeacherOwnsClass(db, classId, decoded.sub);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  if (action === 'override' && overrideScore > pointsPossible) {
    return errorResponse(400, 'VALIDATION_ERROR', `overrideScore cannot exceed pointsPossible (${pointsPossible}).`);
  }

  const now = new Date().toISOString();
  const newScore = action === 'override' ? overrideScore : currentScore;

  // Step 3: Mark review item resolved
  await db.updateItem('reviewqueueitems', `REVIEW#${reviewId}`, {
    status: 'resolved',
    resolvedBy: decoded.sub,
    resolvedAction: action,
    overrideScore: action === 'override' ? overrideScore : null,
    resolvedAt: now,
  });

  let updatedAttemptScore = null;
  let updatedStudentAssignmentStatus = null;

  // Steps 4-8: Cascade score update — log failures but don't block response
  try {
    // Step 4-5: Update WorksheetAttempt total score
    if (attemptId) {
      const attempt = await db.getItem('worksheetattempts', attemptId);
      if (attempt) {
        const scoreDelta = newScore - currentScore;
        const updatedTotalScore = (attempt.totalScore ?? 0) + scoreDelta;
        await db.updateItem('worksheetattempts', attemptId, {
          totalScore: updatedTotalScore,
          percentage: attempt.totalPoints > 0
            ? Math.round((updatedTotalScore / attempt.totalPoints) * 100)
            : 0,
        });
        updatedAttemptScore = updatedTotalScore;

        // Steps 6-7: Update UserProgress topic accuracy
        const progress = await db.getItem('rewardprofiles', studentId);
        if (progress && progress.topicAccuracy && reviewItem.questionText) {
          // Best-effort update — topic key resolution is approximate here
          // Full accuracy recalculation would require all attempts for the topic
          console.info(JSON.stringify({
            timestamp: now,
            level: 'info',
            handler: 'reviewQueueHandler',
            action: 'resolveReview',
            reviewId,
            studentId,
            message: 'UserProgress accuracy update deferred to analytics pipeline',
          }));
        }

        // Step 8: Update StudentAssignmentStatus score
        if (assignmentId) {
          const statusRecord = await db.getItem('studentassignmentstatus', `ASSIGNMENT#${assignmentId}`);
          if (statusRecord) {
            await db.updateItem('studentassignmentstatus', `ASSIGNMENT#${assignmentId}`, {
              score: updatedTotalScore,
              updatedAt: now,
            });
            updatedStudentAssignmentStatus = {
              status: statusRecord.status,
              score: updatedTotalScore,
            };
          }
        }
      }
    }
  } catch (cascadeErr) {
    console.error(JSON.stringify({
      timestamp: now,
      level: 'error',
      handler: 'reviewQueueHandler',
      action: 'resolveReview',
      reviewId,
      attemptId,
      studentId,
      classId,
      message: 'Score cascade partial failure — manual reconciliation may be required',
      error: cascadeErr.message,
    }));
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      reviewId,
      action,
      overrideScore: action === 'override' ? overrideScore : undefined,
      updatedAttemptScore,
      updatedStudentAssignmentStatus,
    }),
  };
}

/**
 * Lambda handler — GET /api/classes/:classId/review-queue and
 * POST /api/review-queue/:reviewId/resolve.
 *
 * @param {Object} event - API Gateway event or Express-shaped mock event
 * @param {Object} [context] - Lambda context
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
    const method = event.httpMethod || 'GET';
    const params = event.pathParameters || {};

    // GET /api/classes/:classId/review-queue
    const reviewQueueMatch = path.match(/^\/api\/classes\/([^/]+)\/review-queue$/);
    if (reviewQueueMatch && method === 'GET') {
      const classId = params.classId || reviewQueueMatch[1];
      return await handleGetReviewQueue(decoded, classId);
    }

    // POST /api/review-queue/:reviewId/resolve
    const resolveMatch = path.match(/^\/api\/review-queue\/([^/]+)\/resolve$/);
    if (resolveMatch && method === 'POST') {
      const reviewId = params.reviewId || resolveMatch[1];
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body.');
      }
      return await handleResolveReview(decoded, reviewId, body);
    }

    return errorResponse(404, 'ROUTE_NOT_FOUND', 'Route not found.');
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      handler: 'reviewQueueHandler',
      message: err.message,
    }));
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = statusCode < 500 || isDebug ? err.message : 'Internal server error.';
    const body = { error: err.errorCode || 'INTERNAL_ERROR', message };
    if (isDebug) {
      body._debug = { stack: err.stack, handler: 'reviewQueueHandler', timestamp: new Date().toISOString() };
    }
    return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
  }
};
