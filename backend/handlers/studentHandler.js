/**
 * @file backend/handlers/studentHandler.js
 * @description Lambda-compatible handler for student-facing routes.
 *
 * Routes:
 *   GET  /api/student/profile    — return the authenticated student's profile
 *   POST /api/student/join-class — join a class via invite code
 *
 * Both routes require a valid Bearer JWT.  join-class additionally requires
 * the 'student' role.
 *
 * Local dev:  APP_RUNTIME unset → localDbAdapter (JSON files in data-local/)
 * Lambda/AWS: APP_RUNTIME=aws   → DynamoDB adapter (not yet implemented)
 */

import { randomUUID } from 'crypto';
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
 * GET /api/student/profile
 * Returns the authenticated user's profile plus their class memberships.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetProfile(decoded) {
  const db = getDbAdapter();

  const user = await db.getItem('users', decoded.sub);
  if (!user) {
    return errorResponse(404, 'User not found.');
  }

  const memberships = await db.queryByField('memberships', 'studentId', decoded.sub);
  const classMemberships = memberships.map((m) => m.classId);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      userId: user.userId,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      classMemberships,
    }),
  };
}

/**
 * POST /api/student/join-class
 * Body: { inviteCode }
 * Looks up the class by invite code, creates a membership record if not
 * already a member, and returns the class details.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleJoinClass(decoded, body) {
  const { inviteCode } = body || {};

  if (!inviteCode) {
    return errorResponse(400, 'inviteCode is required.');
  }

  const db = getDbAdapter();

  const classes = await db.queryByField('classes', 'inviteCode', inviteCode.toUpperCase().trim());
  if (classes.length === 0) {
    return errorResponse(404, 'Class not found for that invite code.');
  }

  const classRecord = classes[0];
  const membershipId = `${classRecord.classId}#${decoded.sub}`;
  const existing = await db.getItem('memberships', membershipId);

  if (existing) {
    return errorResponse(409, 'You are already a member of this class.');
  }

  const membership = {
    id: membershipId,
    classId: classRecord.classId,
    studentId: decoded.sub,
    joinedAt: new Date().toISOString(),
    status: 'active',
  };

  await db.putItem('memberships', membership);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      classId: classRecord.classId,
      className: classRecord.className,
      grade: classRecord.grade,
      subject: classRecord.subject,
    }),
  };
}

/**
 * Lambda handler — GET /api/student/profile and POST /api/student/join-class
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

    if (path.endsWith('/profile') && method === 'GET') {
      return await handleGetProfile(decoded);
    }

    if (path.endsWith('/join-class') && method === 'POST') {
      requireRole(decoded, ['student']);

      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON in request body.');
      }

      return await handleJoinClass(decoded, body);
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('studentHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
