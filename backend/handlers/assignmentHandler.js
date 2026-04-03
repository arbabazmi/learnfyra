/**
 * @file backend/handlers/assignmentHandler.js
 * @description Lambda-compatible handler for teacher assignment management and
 * roster management routes.
 *
 * Routes:
 *   POST   /api/assignments                                        — create assignment
 *   GET    /api/assignments/:assignmentId                          — get assignment detail
 *   GET    /api/classes/:classId/assignments                       — list class assignments
 *   PATCH  /api/assignments/:assignmentId                          — update assignment
 *   DELETE /api/assignments/:assignmentId/close                    — close assignment
 *   GET    /api/classes/:classId/students                          — list class roster
 *   DELETE /api/classes/:classId/students/:studentId               — remove student
 *   POST   /api/classes/:classId/students/:studentId/parent-invite — generate parent invite
 *
 * All routes require Bearer JWT with role = teacher.
 */

import { randomUUID, randomBytes } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { verifyTeacherOwnsClass } from '../../src/utils/rbac.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_MODES = ['practice', 'test'];
const VALID_RETAKE_POLICIES = ['unlimited', 'limited', 'once'];

function errorResponse(statusCode, errorCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: errorCode, message }),
  };
}

/**
 * Generates a cryptographically secure parent invite code.
 * @returns {string} 8-character uppercase alphanumeric code
 */
function generateParentCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes O, 0, I, 1
  const bytes = randomBytes(8);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

/**
 * POST /api/assignments
 * Creates an assignment and writes StudentAssignmentStatus for every enrolled student.
 */
async function handleCreateAssignment(decoded, body) {
  const { classId, worksheetId, mode, dueDate, openAt, closeAt, timeLimit, retakePolicy, retakeLimit } = body || {};

  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'classId must be a valid UUID.');
  }
  if (!worksheetId || typeof worksheetId !== 'string' || worksheetId.trim().length === 0) {
    return errorResponse(400, 'VALIDATION_ERROR', 'worksheetId is required.');
  }
  if (!mode || !VALID_MODES.includes(mode)) {
    return errorResponse(400, 'VALIDATION_ERROR', `mode must be one of: ${VALID_MODES.join(', ')}.`);
  }
  if (!retakePolicy || !VALID_RETAKE_POLICIES.includes(retakePolicy)) {
    return errorResponse(400, 'VALIDATION_ERROR', `retakePolicy must be one of: ${VALID_RETAKE_POLICIES.join(', ')}.`);
  }
  if (retakePolicy === 'limited') {
    if (!Number.isInteger(retakeLimit) || retakeLimit < 1) {
      return errorResponse(400, 'VALIDATION_ERROR', 'retakeLimit must be a positive integer when retakePolicy is "limited".');
    }
  }
  if (timeLimit !== null && timeLimit !== undefined) {
    if (!Number.isInteger(timeLimit) || timeLimit < 60) {
      return errorResponse(400, 'VALIDATION_ERROR', 'timeLimit must be an integer >= 60 seconds or null.');
    }
  }
  if (closeAt && openAt && new Date(closeAt) <= new Date(openAt)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'closeAt must be after openAt.');
  }

  const db = getDbAdapter();

  // Verify teacher owns the class and class is active
  let classRecord;
  try {
    classRecord = await verifyTeacherOwnsClass(db, classId, decoded.sub);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  if (classRecord.status === 'archived') {
    return errorResponse(409, 'CLASS_ARCHIVED', 'Cannot create assignments for an archived class.');
  }

  // Verify worksheet exists — support both UUID and slug lookup
  let worksheet = await db.getItem('worksheets', worksheetId);
  if (!worksheet) {
    // Try slug-based lookup
    const slugMatches = await db.queryByField('worksheets', 'slug', worksheetId);
    worksheet = slugMatches.length > 0 ? slugMatches[0] : null;
  }
  if (!worksheet) {
    return errorResponse(404, 'WORKSHEET_NOT_FOUND', 'Worksheet not found.');
  }
  // Normalize to the actual worksheetId (UUID) for storage
  const resolvedWorksheetId = worksheet.worksheetId || worksheetId;

  const now = new Date().toISOString();
  const assignmentId = randomUUID();

  const assignment = {
    PK: `ASSIGNMENT#${assignmentId}`,
    SK: 'METADATA',
    assignmentId,
    classId,
    worksheetId: resolvedWorksheetId,
    teacherId: decoded.sub,
    title: worksheet.title || `${worksheet.topic} — Grade ${worksheet.grade}`,
    mode,
    timeLimit: timeLimit ?? null,
    dueDate: dueDate ?? null,
    openAt: openAt ?? null,
    closeAt: closeAt ?? null,
    retakePolicy,
    retakeLimit: retakePolicy === 'limited' ? retakeLimit : null,
    status: 'active',
    createdAt: now,
    closedAt: null,
  };

  await db.putItem('assignments', assignment);

  // Fetch all active memberships for this class
  const memberships = await db.queryByField('memberships', 'classId', classId);
  const activeStudentIds = memberships
    .filter(m => m.status === 'active')
    .map(m => m.studentId);

  // Batch-write StudentAssignmentStatus for every enrolled student
  const statusWrites = activeStudentIds.map(studentId => ({
    PK: `ASSIGNMENT#${assignmentId}`,
    SK: `STUDENT#${studentId}`,
    assignmentId,
    studentId,
    classId,
    status: 'not-started',
    attemptId: null,
    score: null,
    totalPoints: worksheet.totalPoints ?? null,
    submittedAt: null,
    updatedAt: now,
  }));

  // Write in batches — log partial failures but don't block the response
  const BATCH_SIZE = 25;
  for (let i = 0; i < statusWrites.length; i += BATCH_SIZE) {
    const batch = statusWrites.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(item => db.putItem('studentassignmentstatus', item))
    ).then(results => {
      const failed = results
        .map((r, idx) => r.status === 'rejected' ? activeStudentIds[i + idx] : null)
        .filter(Boolean);
      if (failed.length > 0) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          handler: 'assignmentHandler',
          action: 'createAssignment',
          assignmentId,
          failedStudentIds: failed,
          message: 'Partial StudentAssignmentStatus write failure',
        }));
      }
    });
  }

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      assignmentId,
      classId,
      worksheetId,
      mode,
      status: 'active',
      createdAt: now,
      studentCount: activeStudentIds.length,
    }),
  };
}

/**
 * GET /api/assignments/:assignmentId
 * Returns the full assignment record. Ownership verified via teacherId.
 */
async function handleGetAssignment(decoded, assignmentId) {
  if (!assignmentId || !UUID_REGEX.test(assignmentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'assignmentId must be a valid UUID.');
  }

  const db = getDbAdapter();
  const assignment = await db.getItem('assignments', `ASSIGNMENT#${assignmentId}`);
  if (!assignment) {
    return errorResponse(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  }
  if (assignment.teacherId !== decoded.sub) {
    return errorResponse(403, 'NOT_CLASS_OWNER', 'You do not own this assignment.');
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(assignment),
  };
}

/**
 * GET /api/classes/:classId/assignments
 * Lists assignments for a class sorted by dueDate, with submissionCount.
 */
async function handleListClassAssignments(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'classId must be a valid UUID.');
  }

  const db = getDbAdapter();

  try {
    await verifyTeacherOwnsClass(db, classId, decoded.sub);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  // Query all assignments for this class
  const allAssignments = await db.queryByField('assignments', 'classId', classId);

  // For each assignment, count submitted StudentAssignmentStatus records
  const enriched = await Promise.all(
    allAssignments.map(async (a) => {
      const statuses = await db.queryByField('studentassignmentstatus', 'assignmentId', a.assignmentId);
      const totalStudents = statuses.length;
      const submissionCount = statuses.filter(s => s.status === 'submitted').length;
      return {
        assignmentId: a.assignmentId,
        title: a.title,
        mode: a.mode,
        dueDate: a.dueDate,
        status: a.status,
        submissionCount,
        totalStudents,
      };
    })
  );

  // Sort by dueDate ascending (nulls last)
  enriched.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ assignments: enriched }),
  };
}

/**
 * PATCH /api/assignments/:assignmentId
 * Updates editable fields. Rejects with 409 if assignment is already open.
 */
async function handleUpdateAssignment(decoded, assignmentId, body) {
  if (!assignmentId || !UUID_REGEX.test(assignmentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'assignmentId must be a valid UUID.');
  }

  const db = getDbAdapter();
  const assignment = await db.getItem('assignments', `ASSIGNMENT#${assignmentId}`);
  if (!assignment) {
    return errorResponse(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  }
  if (assignment.teacherId !== decoded.sub) {
    return errorResponse(403, 'NOT_CLASS_OWNER', 'You do not own this assignment.');
  }

  // Reject if openAt has already passed
  if (assignment.openAt && new Date(assignment.openAt) <= new Date()) {
    return errorResponse(409, 'ASSIGNMENT_ALREADY_OPEN', 'Cannot update an assignment that has already opened.');
  }

  const { dueDate, closeAt, openAt, timeLimit } = body || {};
  const updates = {};
  const updatedFields = [];

  if (dueDate !== undefined) { updates.dueDate = dueDate; updatedFields.push('dueDate'); }
  if (closeAt !== undefined) { updates.closeAt = closeAt; updatedFields.push('closeAt'); }
  if (openAt !== undefined) { updates.openAt = openAt; updatedFields.push('openAt'); }
  if (timeLimit !== undefined) {
    if (timeLimit !== null && (!Number.isInteger(timeLimit) || timeLimit < 60)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'timeLimit must be an integer >= 60 or null.');
    }
    updates.timeLimit = timeLimit;
    updatedFields.push('timeLimit');
  }

  if (updatedFields.length === 0) {
    return errorResponse(400, 'VALIDATION_ERROR', 'No updatable fields provided.');
  }

  await db.updateItem('assignments', `ASSIGNMENT#${assignmentId}`, updates);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ assignmentId, updatedFields }),
  };
}

/**
 * DELETE /api/assignments/:assignmentId/close
 * Closes the assignment and marks all not-started/in-progress student statuses as overdue.
 */
async function handleCloseAssignment(decoded, assignmentId) {
  if (!assignmentId || !UUID_REGEX.test(assignmentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'assignmentId must be a valid UUID.');
  }

  const db = getDbAdapter();
  const assignment = await db.getItem('assignments', `ASSIGNMENT#${assignmentId}`);
  if (!assignment) {
    return errorResponse(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  }
  if (assignment.teacherId !== decoded.sub) {
    return errorResponse(403, 'NOT_CLASS_OWNER', 'You do not own this assignment.');
  }
  if (assignment.status === 'closed') {
    return errorResponse(409, 'ASSIGNMENT_ALREADY_CLOSED', 'Assignment is already closed.');
  }

  const now = new Date().toISOString();

  await db.updateItem('assignments', `ASSIGNMENT#${assignmentId}`, {
    status: 'closed',
    closedAt: now,
  });

  // Mark all non-submitted student statuses as overdue
  const allStatuses = await db.queryByField('studentassignmentstatus', 'assignmentId', assignmentId);
  const toMarkOverdue = allStatuses.filter(s => s.status === 'not-started' || s.status === 'in-progress');

  await Promise.allSettled(
    toMarkOverdue.map(s =>
      db.updateItem('studentassignmentstatus', s.PK, { status: 'overdue', updatedAt: now })
    )
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      assignmentId,
      status: 'closed',
      closedAt: now,
      studentsMarkedOverdue: toMarkOverdue.length,
    }),
  };
}

/**
 * GET /api/classes/:classId/students
 * Returns the roster with per-student assignment summary.
 */
async function handleGetStudents(decoded, classId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'classId must be a valid UUID.');
  }

  const db = getDbAdapter();

  try {
    await verifyTeacherOwnsClass(db, classId, decoded.sub);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  const memberships = await db.queryByField('memberships', 'classId', classId);

  const students = await Promise.all(
    memberships.map(async (m) => {
      const user = await db.getItem('users', m.studentId);
      const statuses = await db.queryByField('studentassignmentstatus', 'studentId', m.studentId);
      const classStatuses = statuses.filter(s => s.classId === classId);

      const total = classStatuses.length;
      const submitted = classStatuses.filter(s => s.status === 'submitted').length;
      const overdue = classStatuses.filter(s => s.status === 'overdue').length;

      // Compute overall accuracy from submitted statuses with scores
      const scoredStatuses = classStatuses.filter(s => s.status === 'submitted' && s.score != null && s.totalPoints != null && s.totalPoints > 0);
      const overallAccuracy = scoredStatuses.length > 0
        ? Math.round(scoredStatuses.reduce((sum, s) => sum + (s.score / s.totalPoints) * 100, 0) / scoredStatuses.length)
        : null;

      return {
        studentId: m.studentId,
        displayName: user?.displayName || 'Unknown Student',
        joinedAt: m.joinedAt,
        status: m.status,
        assignmentsSummary: { total, submitted, overdue },
        lastActiveAt: null,
        overallAccuracy,
      };
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ students }),
  };
}

/**
 * DELETE /api/classes/:classId/students/:studentId
 * Marks a student's membership as removed and decrements studentCount.
 */
async function handleRemoveStudent(decoded, classId, studentId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'classId must be a valid UUID.');
  }
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'studentId must be a valid UUID.');
  }

  const db = getDbAdapter();

  try {
    await verifyTeacherOwnsClass(db, classId, decoded.sub);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  const membershipId = `${classId}#${studentId}`;
  const membership = await db.getItem('memberships', membershipId);
  if (!membership || membership.status === 'removed') {
    return errorResponse(404, 'STUDENT_NOT_IN_CLASS', 'Student is not enrolled in this class.');
  }

  await db.updateItem('memberships', membershipId, { status: 'removed' });

  // Atomically decrement student count
  let classRecord = await db.getItem('classes', `CLASS#${classId}`);
  if (!classRecord) classRecord = await db.getItem('classes', classId);
  if (classRecord && typeof classRecord.studentCount === 'number' && classRecord.studentCount > 0) {
    const classKey = classRecord.PK || classRecord.classId;
    await db.updateItem('classes', classKey, {
      studentCount: classRecord.studentCount - 1,
    });
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Student removed', studentId, classId }),
  };
}

/**
 * POST /api/classes/:classId/students/:studentId/parent-invite
 * Generates a teacher-initiated parent invite code for a specific student.
 */
async function handleGenerateParentInvite(decoded, classId, studentId) {
  if (!classId || !UUID_REGEX.test(classId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'classId must be a valid UUID.');
  }
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'studentId must be a valid UUID.');
  }

  const db = getDbAdapter();

  try {
    await verifyTeacherOwnsClass(db, classId, decoded.sub);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  // Verify student is actively enrolled
  const membershipId = `${classId}#${studentId}`;
  const membership = await db.getItem('memberships', membershipId);
  if (!membership || membership.status !== 'active') {
    return errorResponse(403, 'STUDENT_NOT_IN_CLASS', 'Student is not enrolled in this class.');
  }

  const now = new Date();
  const code = generateParentCode();
  const expiresAt = new Date(now.getTime() + 172800 * 1000).toISOString();
  const ttl = Math.floor((now.getTime() + 172800 * 1000) / 1000);

  const inviteRecord = {
    PK: `INVITE#${code}`,
    SK: 'METADATA',
    code,
    initiatedBy: decoded.sub,
    targetStudentId: studentId,
    linkMethod: 'teacher-invite',
    createdAt: now.toISOString(),
    expiresAt,
    ttl,
    used: false,
  };

  await db.putItem('parentinvitecodes', inviteRecord);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      inviteCode: code,
      targetStudentId: studentId,
      expiresAt,
      linkMethod: 'teacher-invite',
    }),
  };
}

/**
 * Lambda handler — dispatches all assignment and roster management routes.
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
    let body = {};
    try {
      body = method !== 'GET' && method !== 'DELETE' ? JSON.parse(event.body || '{}') : {};
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body.');
    }

    // POST /api/assignments
    if (path === '/api/assignments' && method === 'POST') {
      return await handleCreateAssignment(decoded, body);
    }

    // GET /api/assignments/:assignmentId
    const assignmentDetailMatch = path.match(/^\/api\/assignments\/([^/]+)$/);
    if (assignmentDetailMatch && method === 'GET') {
      const assignmentId = params.assignmentId || assignmentDetailMatch[1];
      return await handleGetAssignment(decoded, assignmentId);
    }

    // GET /api/classes/:classId/assignments
    const classAssignmentsMatch = path.match(/^\/api\/classes\/([^/]+)\/assignments$/);
    if (classAssignmentsMatch && method === 'GET') {
      const classId = params.classId || classAssignmentsMatch[1];
      return await handleListClassAssignments(decoded, classId);
    }

    // PATCH /api/assignments/:assignmentId
    const assignmentPatchMatch = path.match(/^\/api\/assignments\/([^/]+)$/);
    if (assignmentPatchMatch && method === 'PATCH') {
      const assignmentId = params.assignmentId || assignmentPatchMatch[1];
      return await handleUpdateAssignment(decoded, assignmentId, body);
    }

    // DELETE /api/assignments/:assignmentId/close
    const closeMatch = path.match(/^\/api\/assignments\/([^/]+)\/close$/);
    if (closeMatch && method === 'DELETE') {
      const assignmentId = params.assignmentId || closeMatch[1];
      return await handleCloseAssignment(decoded, assignmentId);
    }

    // GET /api/classes/:classId/students
    const studentsMatch = path.match(/^\/api\/classes\/([^/]+)\/students$/);
    if (studentsMatch && method === 'GET') {
      const classId = params.classId || studentsMatch[1];
      return await handleGetStudents(decoded, classId);
    }

    // DELETE /api/classes/:classId/students/:studentId
    const removeStudentMatch = path.match(/^\/api\/classes\/([^/]+)\/students\/([^/]+)$/);
    if (removeStudentMatch && method === 'DELETE') {
      const classId = params.classId || removeStudentMatch[1];
      const studentId = params.studentId || removeStudentMatch[2];
      return await handleRemoveStudent(decoded, classId, studentId);
    }

    // POST /api/classes/:classId/students/:studentId/parent-invite
    const parentInviteMatch = path.match(/^\/api\/classes\/([^/]+)\/students\/([^/]+)\/parent-invite$/);
    if (parentInviteMatch && method === 'POST') {
      const classId = params.classId || parentInviteMatch[1];
      const studentId = params.studentId || parentInviteMatch[2];
      return await handleGenerateParentInvite(decoded, classId, studentId);
    }

    return errorResponse(404, 'ROUTE_NOT_FOUND', 'Route not found.');
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      handler: 'assignmentHandler',
      message: err.message,
    }));
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = statusCode < 500 || isDebug ? err.message : 'Internal server error.';
    const body = { error: err.errorCode || 'INTERNAL_ERROR', message };
    if (isDebug) {
      body._debug = { stack: err.stack, handler: 'assignmentHandler', timestamp: new Date().toISOString() };
    }
    return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
  }
};
