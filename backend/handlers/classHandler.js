/**
 * @file backend/handlers/classHandler.js
 * @description Lambda-compatible handler for teacher class-management routes.
 *
 * Routes (M05 — new):
 *   POST   /api/classes                          — create a new class
 *   GET    /api/classes                          — list teacher's classes
 *   GET    /api/classes/:classId                 — get class detail
 *   PATCH  /api/classes/:classId                 — update class fields
 *   DELETE /api/classes/:classId/archive         — archive a class
 *   POST   /api/classes/:classId/invite          — regenerate invite code
 *
 * Routes (legacy — preserved for backwards compatibility):
 *   POST /api/class/create       — create a new class (teacher only)
 *   GET  /api/class/:id/students — list students in a class (teacher only)
 *
 * All routes require a valid Bearer JWT with the 'teacher' role.
 *
 * Local dev:  APP_RUNTIME unset → localDbAdapter (JSON files in data-local/)
 * Lambda/AWS: APP_RUNTIME=aws   → DynamoDB adapter
 */

import { randomUUID, randomBytes } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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
 * Generates a 6-character alphanumeric invite code (uppercase) using
 * cryptographically secure random bytes.
 * @param {number} [length=6]
 * @returns {string} e.g. "A3K9FZ"
 */
function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
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

// ── M05 Class Management Endpoints ────────────────────────────────────────────

/**
 * POST /api/classes
 * Creates a new class with M05 schema (PK/SK composite key, gradeLevel, subjects).
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleCreateClass(decoded, body) {
  const { className, gradeLevel, subjects } = body || {};

  if (!className || typeof className !== 'string' || !className.trim()) {
    return errorResponse(400, 'className is required.');
  }
  const normalizedClassName = className.trim();
  if (normalizedClassName.length > 100) {
    return errorResponse(400, 'className must be 1 to 100 characters.');
  }

  if (gradeLevel !== null && gradeLevel !== undefined) {
    if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 10) {
      return errorResponse(400, 'gradeLevel must be an integer between 1 and 10 or null.');
    }
  }

  if (subjects !== null && subjects !== undefined) {
    if (!Array.isArray(subjects)) {
      return errorResponse(400, 'subjects must be an array.');
    }
    for (const s of subjects) {
      if (!VALID_SUBJECTS.includes(s)) {
        return errorResponse(400, `subjects contains invalid value "${s}". Must be one of: ${VALID_SUBJECTS.join(', ')}.`);
      }
    }
  }

  const db = getDbAdapter();
  const now = new Date().toISOString();
  const classId = randomUUID();
  const inviteCode = await generateUniqueInviteCode(db);

  const classRecord = {
    PK: `CLASS#${classId}`,
    SK: 'METADATA',
    classId,
    teacherId: decoded.sub,
    className: normalizedClassName,
    gradeLevel: gradeLevel ?? null,
    subjects: subjects ?? [],
    inviteCode,
    inviteCodeExpiresAt: null,
    status: 'active',
    accuracyThreshold: 60,
    studentCount: 0,
    createdAt: now,
    archivedAt: null,
  };

  await db.putItem('classes', classRecord);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      classId,
      className: normalizedClassName,
      inviteCode,
      gradeLevel: gradeLevel ?? null,
      subjects: subjects ?? [],
      status: 'active',
      studentCount: 0,
      createdAt: now,
    }),
  };
}

/**
 * GET /api/classes
 * Lists all classes owned by the authenticated teacher, with pending review counts.
 *
 * @param {Object} decoded - Verified JWT payload
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleListClasses(decoded) {
  const db = getDbAdapter();

  // Query all classes for this teacher
  const allClasses = await db.queryByField('classes', 'teacherId', decoded.sub);

  // For each class, count pending review items
  const classes = await Promise.all(
    allClasses.map(async (c) => {
      let pendingReviewCount = 0;
      try {
        const reviews = await db.queryByField('reviewqueueitems', 'classId', c.classId);
        pendingReviewCount = reviews.filter(r => r.status === 'pending').length;
      } catch {
        // reviewqueueitems table may not exist yet — non-fatal
      }
      return {
        classId: c.classId,
        className: c.className,
        gradeLevel: c.gradeLevel ?? null,
        subjects: c.subjects ?? [],
        inviteCode: c.inviteCode,
        status: c.status || 'active',
        studentCount: c.studentCount ?? 0,
        createdAt: c.createdAt,
        pendingReviewCount,
      };
    })
  );

  // Sort newest first
  classes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ classes }),
  };
}

/**
 * GET /api/classes/:classId
 * Returns full class detail. Ownership verified.
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {string} classId - Class UUID
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetClass(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'classId must be a valid UUID.');
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

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      classId: classRecord.classId,
      className: classRecord.className,
      gradeLevel: classRecord.gradeLevel ?? null,
      subjects: classRecord.subjects ?? [],
      inviteCode: classRecord.inviteCode,
      status: classRecord.status || 'active',
      studentCount: classRecord.studentCount ?? 0,
      accuracyThreshold: classRecord.accuracyThreshold ?? 60,
      createdAt: classRecord.createdAt,
      archivedAt: classRecord.archivedAt ?? null,
    }),
  };
}

/**
 * PATCH /api/classes/:classId
 * Updates mutable class fields (className, accuracyThreshold).
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {string} classId - Class UUID
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleUpdateClass(decoded, classId, body) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'classId must be a valid UUID.');
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

  const updates = {};
  const updatedFields = [];

  if (body.className !== undefined) {
    const name = typeof body.className === 'string' ? body.className.trim() : '';
    if (!name || name.length > 100) {
      return errorResponse(400, 'className must be 1 to 100 characters.');
    }
    updates.className = name;
    updatedFields.push('className');
  }

  if (body.accuracyThreshold !== undefined) {
    const threshold = Number(body.accuracyThreshold);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
      return errorResponse(400, 'accuracyThreshold must be an integer between 0 and 100.');
    }
    updates.accuracyThreshold = threshold;
    updatedFields.push('accuracyThreshold');
  }

  if (updatedFields.length === 0) {
    return errorResponse(400, 'No updatable fields provided.');
  }

  const updateKey = classRecord.PK || classRecord.classId;
  await db.updateItem('classes', updateKey, updates);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ classId, updatedFields }),
  };
}

/**
 * DELETE /api/classes/:classId/archive
 * Archives a class (soft delete — sets status = "archived").
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {string} classId - Class UUID
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleArchiveClass(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'classId must be a valid UUID.');
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
  if (classRecord.status === 'archived') {
    return {
      statusCode: 409,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'CLASS_ALREADY_ARCHIVED', message: 'Class is already archived.' }),
    };
  }

  const archivedAt = new Date().toISOString();
  const archiveKey = classRecord.PK || classRecord.classId;
  await db.updateItem('classes', archiveKey, { status: 'archived', archivedAt });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ classId, status: 'archived', archivedAt }),
  };
}

/**
 * POST /api/classes/:classId/invite
 * Regenerates the invite code for a class.
 *
 * @param {Object} decoded - Verified JWT payload
 * @param {string} classId - Class UUID
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleRegenerateInvite(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'classId must be a valid UUID.');
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

  const newCode = await generateUniqueInviteCode(db);
  const updatedAt = new Date().toISOString();
  const inviteUpdateKey = classRecord.PK || classRecord.classId;
  await db.updateItem('classes', inviteUpdateKey, { inviteCode: newCode });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ classId, inviteCode: newCode, updatedAt }),
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
    const params = event.pathParameters || {};

    // ── M05 routes ─────────────────────────────────────────────────────────

    // POST /api/classes
    if (path === '/api/classes' && method === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return errorResponse(400, 'Invalid JSON in request body.'); }
      return await handleCreateClass(decoded, body);
    }

    // GET /api/classes
    if (path === '/api/classes' && method === 'GET') {
      return await handleListClasses(decoded);
    }

    // DELETE /api/classes/:classId/archive
    const archiveMatch = path.match(/^\/api\/classes\/([^/]+)\/archive$/);
    if (archiveMatch && method === 'DELETE') {
      const classId = params.classId || archiveMatch[1];
      return await handleArchiveClass(decoded, classId);
    }

    // POST /api/classes/:classId/invite
    const inviteMatch = path.match(/^\/api\/classes\/([^/]+)\/invite$/);
    if (inviteMatch && method === 'POST') {
      const classId = params.classId || inviteMatch[1];
      return await handleRegenerateInvite(decoded, classId);
    }

    // PATCH /api/classes/:classId
    const patchClassMatch = path.match(/^\/api\/classes\/([^/]+)$/);
    if (patchClassMatch && method === 'PATCH') {
      const classId = params.classId || patchClassMatch[1];
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return errorResponse(400, 'Invalid JSON in request body.'); }
      return await handleUpdateClass(decoded, classId, body);
    }

    // GET /api/classes/:classId
    const getClassMatch = path.match(/^\/api\/classes\/([^/]+)$/);
    if (getClassMatch && method === 'GET') {
      const classId = params.classId || getClassMatch[1];
      return await handleGetClass(decoded, classId);
    }

    // ── Legacy routes (preserved for backwards compatibility) ───────────────

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
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = (statusCode < 500 || isDebug) ? err.message : 'Internal server error.';
    const body = { error: message };
    if (isDebug) {
      body._debug = { stack: err.stack, handler: 'classHandler', statusCode, timestamp: new Date().toISOString() };
    }
    return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
  }
};
