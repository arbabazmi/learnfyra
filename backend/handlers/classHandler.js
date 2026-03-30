/**
 * @file backend/handlers/classHandler.js
 * @description Lambda-compatible handler for teacher class-management routes.
 *
 * Routes:
 *   POST /api/class/create       — create a new class (teacher only)
 *   GET  /api/class/:id/students — list students in a class (teacher only)
 *
 * Both routes require a valid Bearer JWT with the 'teacher' role.
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];

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
 * Generates a 6-character alphanumeric invite code (uppercase).
 * @returns {string} e.g. "A3K9FZ"
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generates an invite code not currently in use.
 * @param {Object} db
 * @param {number} maxAttempts
 * @returns {Promise<string>}
 */
async function generateUniqueInviteCode(db, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const inviteCode = generateInviteCode();
    const existing = await db.queryByField('classes', 'inviteCode', inviteCode);
    if (!Array.isArray(existing) || existing.length === 0) {
      return inviteCode;
    }
  }

  throw new Error('Failed to generate unique invite code.');
}

/**
 * POST /api/class/create
 * Body: { className, grade, subject }
 * Creates a new class record and returns it with the generated invite code.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleCreate(decoded, body) {
  const { className, grade, subject } = body || {};

  if (className == null || grade == null || subject == null) {
    return errorResponse(400, 'className, grade, and subject are required.');
  }

  const normalizedClassName = typeof className === 'string' ? className.trim() : '';
  if (!normalizedClassName || normalizedClassName.length > 120) {
    return errorResponse(400, 'className must be 1 to 120 characters.');
  }

  if (!Number.isInteger(grade) || grade < 1 || grade > 10) {
    return errorResponse(400, 'grade must be an integer between 1 and 10.');
  }

  if (typeof subject !== 'string' || !VALID_SUBJECTS.includes(subject)) {
    return errorResponse(400, `subject must be one of: ${VALID_SUBJECTS.join(', ')}.`);
  }

  const db = getDbAdapter();
  const now = new Date().toISOString();
  const classId = randomUUID();
  const inviteCode = await generateUniqueInviteCode(db);

  const classRecord = {
    classId,
    teacherId: decoded.sub,
    className: normalizedClassName,
    grade,
    subject,
    inviteCode,
    createdAt: now,
  };

  await db.putItem('classes', classRecord);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      classId,
      className: normalizedClassName,
      grade,
      subject,
      inviteCode,
    }),
  };
}

/**
 * GET /api/class/:id/students
 * Returns the class details and a list of enrolled students.
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {string} classId - Class UUID from the path parameter
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetStudents(decoded, classId) {
  if (!classId) {
    return errorResponse(400, 'Class ID is required.');
  }

  if (!UUID_REGEX.test(classId)) {
    return errorResponse(400, 'Class ID must be a valid UUID v4.');
  }

  const db = getDbAdapter();

  const classRecord = await db.getItem('classes', classId);
  if (!classRecord) {
    return errorResponse(404, 'Class not found.');
  }

  if (classRecord.teacherId !== decoded.sub) {
    return errorResponse(403, 'Forbidden.');
  }

  // Fetch all active memberships for this class
  const memberships = await db.queryByField('memberships', 'classId', classId);
  const activeMemberships = memberships.filter((m) => m.status === 'active');

  // Hydrate each membership into a student profile (no passwordHash)
  const students = await Promise.all(
    activeMemberships.map(async (m) => {
      const user = await db.getItem('users', m.studentId);
      if (!user) return null;
      return {
        userId: user.userId,
        displayName: user.displayName,
        email: user.email,
      };
    })
  );

  const validStudents = students.filter(Boolean);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      classId,
      className: classRecord.className,
      students: validStudents,
    }),
  };
}

/**
 * Lambda handler — POST /api/class/create and GET /api/class/:id/students
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
    const method = event.httpMethod || 'GET';

    if (path.endsWith('/create') && method === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON in request body.');
      }

      return await handleCreate(decoded, body);
    }

    // Match /api/class/:id/students
    if (path.endsWith('/students') && method === 'GET') {
      const classId =
        (event.pathParameters && event.pathParameters.id) || null;

      return await handleGetStudents(decoded, classId);
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('classHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
