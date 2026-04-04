/**
 * @file backend/handlers/parentHandler.js
 * @description Lambda-compatible handler for parent-facing routes and student
 * class-participation routes.
 *
 * Parent routes (role = parent):
 *   POST   /api/parent/link                              — link to child via invite code
 *   GET    /api/parent/children                          — list linked children
 *   DELETE /api/parent/children/:studentId               — unlink a child
 *   GET    /api/parent/children/:studentId/progress      — child progress summary
 *   GET    /api/parent/children/:studentId/assignments   — child assignment status
 *
 * Student routes (role = student):
 *   POST   /api/student/parent-invite                   — generate parent invite code
 *   POST   /api/student/classes/join                    — join a class via code
 *   GET    /api/student/assignments                     — list my assignments
 *   GET    /api/student/assignments/:assignmentId        — get assignment detail
 */

import { randomBytes } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { verifyParentChildLink } from '../../src/utils/rbac.js';
import { revokeConsent } from '../../src/consent/consentStore.js';
import { signToken } from '../../src/auth/tokenUtils.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVITE_CODE_REGEX = /^[A-Z0-9]{6,8}$/;
const CLASS_INVITE_REGEX = /^[A-Z0-9]{6}$/;
const CLASS_CAP = 300;

function errorResponse(statusCode, errorCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: errorCode, message }),
  };
}

/**
 * Generates a cryptographically secure parent invite code.
 * @returns {string} 8-character uppercase alphanumeric (excluding ambiguous chars)
 */
function generateParentCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes O, 0, I, 1
  const bytes = randomBytes(8);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

// ---------------------------------------------------------------------------
// Parent routes
// ---------------------------------------------------------------------------

/**
 * POST /api/parent/link
 * Validates an invite code and creates a bidirectional ParentChildLink.
 */
async function handleLinkToChild(decoded, body) {
  const { inviteCode } = body || {};
  if (!inviteCode || typeof inviteCode !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'inviteCode is required.');
  }
  const normalizedCode = inviteCode.trim().toUpperCase();
  if (!INVITE_CODE_REGEX.test(normalizedCode)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid invite code format.');
  }

  const db = getDbAdapter();

  // Step 1: Fetch the invite record
  const inviteRecord = await db.getItem('parentinvitecodes', `INVITE#${normalizedCode}`);
  if (!inviteRecord) {
    return errorResponse(404, 'INVITE_CODE_NOT_FOUND', 'Invite code not found.');
  }

  // Step 2: Application-level expiry check (before TTL-based deletion)
  if (inviteRecord.expiresAt && new Date(inviteRecord.expiresAt) < new Date()) {
    return errorResponse(410, 'INVITE_CODE_EXPIRED', 'This invite code has expired.');
  }

  // Step 3: Already-used check
  if (inviteRecord.used === true) {
    return errorResponse(409, 'INVITE_CODE_ALREADY_USED', 'This invite code has already been used.');
  }

  // Step 4: Atomically consume the code via conditional update
  // For the local adapter this is a best-effort check-then-write (no native conditional).
  // For DynamoDB (AWS runtime) the actual conditional UpdateItem is in the DynamoDB adapter path.
  try {
    await db.updateItem('parentinvitecodes', `INVITE#${normalizedCode}`, { used: true });
  } catch (condErr) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      return errorResponse(409, 'INVITE_CODE_ALREADY_USED', 'This invite code has already been used.');
    }
    throw condErr;
  }

  const { targetStudentId, linkMethod } = inviteRecord;
  const now = new Date().toISOString();

  // Step 5: Write ParentChildLink (bidirectional attributes for InvertedIndex GSI)
  const linkRecord = {
    PK: `USER#${decoded.sub}`,
    SK: `CHILD#${targetStudentId}`,
    parentId: decoded.sub,
    childId: targetStudentId,
    linkedAt: now,
    linkMethod,
    status: 'active',
    revokedAt: null,
    childPK: `USER#${targetStudentId}`,
    parentSK: `PARENT#${decoded.sub}`,
  };

  await db.putItem('parentchildlinks', linkRecord);

  // Fetch child profile to return displayName and gradeLevel
  const child = await db.getItem('users', targetStudentId);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      parentId: decoded.sub,
      childId: targetStudentId,
      displayName: child?.displayName || null,
      gradeLevel: child?.grade ?? null,
      linkMethod,
      linkedAt: now,
    }),
  };
}

/**
 * GET /api/parent/children
 * Returns all actively linked children with their user profile data.
 */
async function handleGetChildren(decoded) {
  const db = getDbAdapter();

  const allLinks = await db.queryByField('parentchildlinks', 'parentId', decoded.sub);
  const activeLinks = allLinks.filter(l => l.status === 'active');

  const children = await Promise.all(
    activeLinks.map(async (link) => {
      const child = await db.getItem('users', link.childId);
      return {
        studentId: link.childId,
        displayName: child?.displayName || null,
        gradeLevel: child?.grade ?? null,
        linkMethod: link.linkMethod,
        linkedAt: link.linkedAt,
      };
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ children }),
  };
}

/**
 * DELETE /api/parent/children/:studentId
 * Revokes the parent-child link.
 */
async function handleUnlinkChild(decoded, studentId) {
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'studentId must be a valid UUID.');
  }

  const db = getDbAdapter();

  let link;
  try {
    link = await verifyParentChildLink(db, decoded.sub, studentId);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  const now = new Date().toISOString();
  // Update by the denormalized parentId field since local adapter uses queryByField
  const allLinks = await db.queryByField('parentchildlinks', 'parentId', decoded.sub);
  const target = allLinks.find(l => l.childId === studentId && l.status === 'active');
  if (target) {
    await db.updateItem('parentchildlinks', target.PK, { status: 'revoked', revokedAt: now });
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      parentId: decoded.sub,
      childId: studentId,
      status: 'revoked',
      revokedAt: now,
    }),
  };
}

/**
 * GET /api/parent/children/:studentId/progress
 * Returns activity summary and needsAttention topics for a linked child.
 */
async function handleGetChildProgress(decoded, studentId) {
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'studentId must be a valid UUID.');
  }

  const db = getDbAdapter();

  // RBAC: verify active link before any data access (403, not 404)
  try {
    await verifyParentChildLink(db, decoded.sub, studentId);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  const child = await db.getItem('users', studentId);
  const now = new Date();
  const msIn7Days = 7 * 24 * 60 * 60 * 1000;
  const msIn30Days = 30 * 24 * 60 * 60 * 1000;

  // Fetch all attempts for this student
  const allAttempts = await db.queryByField('attempts', 'studentId', studentId);

  const attemptsLast7 = allAttempts.filter(a => a.createdAt && (now - new Date(a.createdAt)) <= msIn7Days);
  const attemptsLast30 = allAttempts.filter(a => a.createdAt && (now - new Date(a.createdAt)) <= msIn30Days);

  function summarizeAttempts(attempts) {
    if (attempts.length === 0) return { worksheetsAttempted: 0, averageScore: 0, totalTimeSpentSeconds: 0 };
    const totalScore = attempts.reduce((s, a) => s + (a.percentage ?? 0), 0);
    const totalTime = attempts.reduce((s, a) => s + (a.timeTaken ?? 0), 0);
    return {
      worksheetsAttempted: attempts.length,
      averageScore: Math.round(totalScore / attempts.length),
      totalTimeSpentSeconds: totalTime,
    };
  }

  // Compute overall accuracy from all attempts
  const scored = allAttempts.filter(a => a.totalPoints > 0);
  const overallAccuracy = scored.length > 0
    ? Math.round(scored.reduce((s, a) => s + ((a.totalScore ?? 0) / a.totalPoints) * 100, 0) / scored.length)
    : 0;

  // Compute needsAttention topics: accuracy < 60% with 3+ attempts
  const topicMap = new Map();
  for (const attempt of allAttempts) {
    const topic = attempt.topic || 'Unknown';
    if (!topicMap.has(topic)) topicMap.set(topic, { total: 0, earned: 0, possible: 0 });
    const t = topicMap.get(topic);
    t.total += 1;
    t.earned += attempt.totalScore ?? 0;
    t.possible += attempt.totalPoints ?? 0;
  }
  const needsAttention = [];
  for (const [topic, stats] of topicMap.entries()) {
    if (stats.total >= 3 && stats.possible > 0) {
      const accuracy = Math.round((stats.earned / stats.possible) * 100);
      if (accuracy < 60) {
        needsAttention.push({ topic, currentAccuracy: accuracy, attemptCount: stats.total });
      }
    }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      studentId,
      displayName: child?.displayName || null,
      last7Days: summarizeAttempts(attemptsLast7),
      last30Days: summarizeAttempts(attemptsLast30),
      overallAccuracy,
      needsAttention,
    }),
  };
}

/**
 * GET /api/parent/children/:studentId/assignments
 * Returns assignment status list for a linked child with lazy overdue evaluation.
 */
async function handleGetChildAssignments(decoded, studentId) {
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'studentId must be a valid UUID.');
  }

  const db = getDbAdapter();

  // RBAC: 403, not 404
  try {
    await verifyParentChildLink(db, decoded.sub, studentId);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  const statusRecords = await db.queryByField('studentassignmentstatus', 'studentId', studentId);
  const now = new Date();

  // Lazy overdue evaluation and assignment hydration
  const assignments = await Promise.all(
    statusRecords.map(async (s) => {
      const assignment = await db.getItem('assignments', `ASSIGNMENT#${s.assignmentId}`);
      if (!assignment) return null;

      let status = s.status;

      // Lazy overdue: if dueDate has passed and not submitted, mark overdue
      if (status !== 'submitted' && assignment.dueDate && new Date(assignment.dueDate) < now) {
        status = 'overdue';
        // Write back asynchronously — don't block response
        db.updateItem('studentassignmentstatus', s.PK, { status: 'overdue', updatedAt: now.toISOString() }).catch(() => {});
      }

      return {
        assignmentId: s.assignmentId,
        title: assignment.title,
        className: null, // className not denormalized on assignment — omitted
        teacherName: null,
        dueDate: assignment.dueDate,
        status,
        score: s.score ?? null,
        submittedAt: s.submittedAt ?? null,
      };
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      studentId,
      assignments: assignments.filter(Boolean),
    }),
  };
}

// ---------------------------------------------------------------------------
// Student routes
// ---------------------------------------------------------------------------

/**
 * POST /api/student/parent-invite
 * Generates a parent invite code for the authenticated student.
 * Invalidates any prior unused code before writing the new one.
 */
async function handleGenerateParentInvite(decoded) {
  const db = getDbAdapter();
  const studentId = decoded.sub;
  const now = new Date();

  // Fetch and invalidate prior student-generated code if it exists
  const priorTracker = await db.getItem('parentinvitecodes', `STUDENTINVITE#${studentId}`);
  if (priorTracker && priorTracker.currentCode) {
    try {
      await db.updateItem('parentinvitecodes', `INVITE#${priorTracker.currentCode}`, { used: true });
    } catch {
      // Prior code may have already been consumed or expired — not fatal
    }
  }

  const code = generateParentCode();
  const expiresAt = new Date(now.getTime() + 172800 * 1000).toISOString();
  const ttl = Math.floor((now.getTime() + 172800 * 1000) / 1000);

  const inviteRecord = {
    PK: `INVITE#${code}`,
    SK: 'METADATA',
    code,
    initiatedBy: studentId,
    targetStudentId: studentId,
    linkMethod: 'student-invite',
    createdAt: now.toISOString(),
    expiresAt,
    ttl,
    used: false,
  };

  await db.putItem('parentinvitecodes', inviteRecord);

  // Update student tracking record
  await db.putItem('parentinvitecodes', {
    PK: `STUDENTINVITE#${studentId}`,
    SK: 'TRACKER',
    currentCode: code,
    updatedAt: now.toISOString(),
  });

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      inviteCode: code,
      expiresAt,
      linkMethod: 'student-invite',
    }),
  };
}

/**
 * POST /api/student/classes/join
 * Joins a class via invite code, creates membership and assignment status records.
 */
async function handleJoinClass(decoded, body) {
  const { inviteCode } = body || {};
  if (!inviteCode || typeof inviteCode !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'inviteCode is required.');
  }
  const normalizedCode = String(inviteCode).trim().toUpperCase();
  if (!CLASS_INVITE_REGEX.test(normalizedCode)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'inviteCode must be 6 uppercase alphanumeric characters.');
  }

  const db = getDbAdapter();
  const studentId = decoded.sub;

  // Query class by invite code
  const classes = await db.queryByField('classes', 'inviteCode', normalizedCode);
  const classRecord = classes.find(c => c.status !== 'archived');
  if (!classRecord) {
    return errorResponse(404, 'INVALID_JOIN_CODE', 'Class not found for that invite code.');
  }

  const { classId, className, studentCount = 0 } = classRecord;

  // Check capacity
  if (studentCount >= CLASS_CAP) {
    return errorResponse(422, 'CLASS_AT_CAPACITY', 'This class has reached the maximum student limit.');
  }

  const membershipId = `${classId}#${studentId}`;
  const existing = await db.getItem('memberships', membershipId);
  const now = new Date().toISOString();

  if (existing) {
    if (existing.status === 'active') {
      return errorResponse(409, 'ALREADY_ENROLLED', 'You are already enrolled in this class.');
    }
    // Re-enroll removed student
    await db.updateItem('memberships', membershipId, { status: 'active', joinedAt: now });
  } else {
    await db.putItem('memberships', {
      id: membershipId,
      classId,
      studentId,
      joinedAt: now,
      status: 'active',
    });
  }

  // Increment studentCount
  await db.updateItem('classes', classRecord.classId
    ? (classRecord.PK || classRecord.classId)
    : classRecord.classId, {
    studentCount: (studentCount || 0) + 1,
  });

  // Fetch all active assignments for this class
  const activeAssignments = await db.queryByField('assignments', 'classId', classId);
  const openAssignments = activeAssignments.filter(a => a.status === 'active');

  // Write StudentAssignmentStatus for each active assignment
  await Promise.allSettled(
    openAssignments.map(a => db.putItem('studentassignmentstatus', {
      PK: `ASSIGNMENT#${a.assignmentId}`,
      SK: `STUDENT#${studentId}`,
      assignmentId: a.assignmentId,
      studentId,
      classId,
      status: 'not-started',
      attemptId: null,
      score: null,
      totalPoints: null,
      submittedAt: null,
      updatedAt: now,
    }))
  );

  // Fetch teacher display name
  const teacher = await db.getItem('users', classRecord.teacherId);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      classId,
      className: classRecord.className,
      teacherName: teacher?.displayName || null,
      gradeLevel: classRecord.gradeLevel ?? classRecord.grade ?? null,
      joinedAt: now,
      activeAssignmentCount: openAssignments.length,
    }),
  };
}

/**
 * GET /api/student/assignments
 * Returns the student's assignment list with lazy overdue evaluation.
 */
async function handleGetStudentAssignments(decoded) {
  const db = getDbAdapter();
  const studentId = decoded.sub;
  const now = new Date();

  const statusRecords = await db.queryByField('studentassignmentstatus', 'studentId', studentId);

  const assignments = await Promise.all(
    statusRecords.map(async (s) => {
      const assignment = await db.getItem('assignments', `ASSIGNMENT#${s.assignmentId}`);
      if (!assignment) return null;

      let status = s.status;
      if (status !== 'submitted' && assignment.dueDate && new Date(assignment.dueDate) < now) {
        status = 'overdue';
        db.updateItem('studentassignmentstatus', s.PK, { status: 'overdue', updatedAt: now.toISOString() }).catch(() => {});
      }

      return {
        assignmentId: s.assignmentId,
        title: assignment.title,
        className: null,
        mode: assignment.mode,
        dueDate: assignment.dueDate,
        openAt: assignment.openAt,
        closeAt: assignment.closeAt,
        timeLimit: assignment.timeLimit,
        retakePolicy: assignment.retakePolicy,
        status,
        score: s.score ?? null,
        submittedAt: s.submittedAt ?? null,
      };
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ assignments: assignments.filter(Boolean) }),
  };
}

/**
 * GET /api/student/assignments/:assignmentId
 * Returns full assignment config + student status with availability window enforcement.
 */
async function handleGetStudentAssignment(decoded, assignmentId) {
  if (!assignmentId || !UUID_REGEX.test(assignmentId)) {
    // Enumeration prevention: 403, not 400
    return errorResponse(403, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  }

  const db = getDbAdapter();
  const studentId = decoded.sub;

  // Enumeration prevention: 403 if not found
  const statusRecord = await db.getItem('studentassignmentstatus', `ASSIGNMENT#${assignmentId}`);
  if (!statusRecord || statusRecord.studentId !== studentId) {
    return errorResponse(403, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  }

  const assignment = await db.getItem('assignments', `ASSIGNMENT#${assignmentId}`);
  if (!assignment) {
    return errorResponse(403, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  }

  const now = new Date();
  if (assignment.openAt && new Date(assignment.openAt) > now) {
    return errorResponse(403, 'ASSIGNMENT_NOT_AVAILABLE', 'This assignment is not yet open.');
  }
  if (assignment.closeAt && new Date(assignment.closeAt) < now) {
    return errorResponse(403, 'ASSIGNMENT_NOT_AVAILABLE', 'This assignment is closed.');
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ...assignment,
      studentStatus: statusRecord.status,
      score: statusRecord.score ?? null,
      submittedAt: statusRecord.submittedAt ?? null,
    }),
  };
}

// ---------------------------------------------------------------------------
// Privacy Dashboard extensions
// ---------------------------------------------------------------------------

/**
 * GET /api/parent/children/:studentId/export
 * Exports all data held for a linked child as a JSON bundle.
 * Does NOT include consent records or data belonging to other parents.
 */
async function handleExportChildData(decoded, studentId) {
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'studentId must be a valid UUID.');
  }

  const db = getDbAdapter();

  // RBAC: 403, not 404
  try {
    await verifyParentChildLink(db, decoded.sub, studentId);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  // Gather all child data in parallel (non-fatal if a table returns empty)
  const [user, attempts, worksheets, certificates, scores] = await Promise.all([
    db.getItem('users', studentId).catch(() => null),
    db.queryByField('attempts', 'studentId', studentId).catch(() => []),
    db.queryByField('worksheets', 'createdBy', studentId).catch(() => []),
    db.queryByField('certificates', 'studentId', studentId).catch(() => []),
    db.queryByField('scores', 'studentId', studentId).catch(() => []),
  ]);

  // Strip password hash and sensitive fields from user record
  const safeUser = user ? (() => {
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  })() : null;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      exportedAt: new Date().toISOString(),
      studentId,
      user: safeUser,
      attempts,
      worksheets,
      certificates,
      scores,
    }),
  };
}

/**
 * POST /api/parent/children/:studentId/revoke-consent
 * Revokes parental consent and suspends the child account.
 * Body: { reason?: string }
 */
async function handleRevokeConsent(decoded, studentId, body) {
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'studentId must be a valid UUID.');
  }

  const db = getDbAdapter();

  // RBAC: 403, not 404
  try {
    await verifyParentChildLink(db, decoded.sub, studentId);
  } catch (err) {
    return errorResponse(err.statusCode, err.errorCode, err.message);
  }

  const reason = (body && typeof body.reason === 'string') ? body.reason.trim().slice(0, 500) : null;

  // Revoke the active consent record
  await revokeConsent(studentId, {
    reason,
    revokedBy: decoded.sub,
  });

  // Suspend the child account
  await db.updateItem('users', studentId, {
    accountStatus: 'suspended',
    suspendedAt: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Consent revoked. Account deactivated.' }),
  };
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/child-session
 * Issues a scoped JWT for a linked child so a parent can start a solve session
 * on the child's behalf. Verifies active ParentChildLink before issuing the token.
 */
async function handleChildSession(decoded, body) {
  const { childId } = body || {};
  if (!childId || typeof childId !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'childId is required.');
  }
  if (!UUID_REGEX.test(childId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'childId must be a valid UUID.');
  }

  const db = getDbAdapter();
  const parentId = decoded.sub;

  // Verify an active ParentChildLink exists (403, not 404)
  const allLinks = await db.queryByField('parentchildlinks', 'parentId', parentId);
  const link = allLinks.find(l => l.childId === childId && l.status === 'active');
  if (!link) {
    return errorResponse(403, 'FORBIDDEN', 'You are not linked to this child or the link is inactive.');
  }

  // Fetch child user record to get displayName
  const child = await db.getItem('users', childId);
  if (!child) {
    return errorResponse(404, 'CHILD_NOT_FOUND', 'Child account not found.');
  }

  const childAccessToken = signToken(
    {
      sub: childId,
      role: 'student',
      ageGroup: 'under13',
      parentId,
      permissions: ['solve_worksheet', 'view_own_scores'],
    },
    '4h',
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      childAccessToken,
      childUserId: childId,
      childName: child.displayName || null,
      role: 'student',
      ageGroup: 'under13',
      parentId,
      expiresIn: 14400,
      permissions: ['solve_worksheet', 'view_own_scores'],
    }),
  };
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

/**
 * Lambda handler — dispatches all parent and student class-participation routes.
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

    const path = event.path || event.routeKey || '';
    const method = event.httpMethod || 'GET';
    const params = event.pathParameters || {};

    let body = {};
    try {
      body = (method === 'POST' || method === 'PATCH') ? JSON.parse(event.body || '{}') : {};
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body.');
    }

    // ── Parent routes ──────────────────────────────────────────────────────
    if (path === '/api/parent/link' && method === 'POST') {
      requireRole(decoded, ['parent']);
      return await handleLinkToChild(decoded, body);
    }

    if (path === '/api/parent/children' && method === 'GET') {
      requireRole(decoded, ['parent']);
      return await handleGetChildren(decoded);
    }

    const unlinkMatch = path.match(/^\/api\/parent\/children\/([^/]+)$/);
    if (unlinkMatch && method === 'DELETE') {
      requireRole(decoded, ['parent']);
      const studentId = params.studentId || unlinkMatch[1];
      return await handleUnlinkChild(decoded, studentId);
    }

    const childProgressMatch = path.match(/^\/api\/parent\/children\/([^/]+)\/progress$/);
    if (childProgressMatch && method === 'GET') {
      requireRole(decoded, ['parent']);
      const studentId = params.studentId || childProgressMatch[1];
      return await handleGetChildProgress(decoded, studentId);
    }

    const childAssignmentsMatch = path.match(/^\/api\/parent\/children\/([^/]+)\/assignments$/);
    if (childAssignmentsMatch && method === 'GET') {
      requireRole(decoded, ['parent']);
      const studentId = params.studentId || childAssignmentsMatch[1];
      return await handleGetChildAssignments(decoded, studentId);
    }

    const childExportMatch = path.match(/^\/api\/parent\/children\/([^/]+)\/export$/);
    if (childExportMatch && method === 'GET') {
      requireRole(decoded, ['parent']);
      const studentId = params.studentId || childExportMatch[1];
      return await handleExportChildData(decoded, studentId);
    }

    const revokeConsentMatch = path.match(/^\/api\/parent\/children\/([^/]+)\/revoke-consent$/);
    if (revokeConsentMatch && method === 'POST') {
      requireRole(decoded, ['parent']);
      const studentId = params.studentId || revokeConsentMatch[1];
      return await handleRevokeConsent(decoded, studentId, body);
    }

    // ── Auth routes ────────────────────────────────────────────────────────
    if (path === '/api/auth/child-session' && method === 'POST') {
      requireRole(decoded, ['parent']);
      return await handleChildSession(decoded, body);
    }

    // ── Student routes ─────────────────────────────────────────────────────
    if (path === '/api/student/parent-invite' && method === 'POST') {
      requireRole(decoded, ['student']);
      return await handleGenerateParentInvite(decoded);
    }

    if (path === '/api/student/classes/join' && method === 'POST') {
      requireRole(decoded, ['student']);
      return await handleJoinClass(decoded, body);
    }

    if (path === '/api/student/assignments' && method === 'GET') {
      requireRole(decoded, ['student']);
      return await handleGetStudentAssignments(decoded);
    }

    const studentAssignmentMatch = path.match(/^\/api\/student\/assignments\/([^/]+)$/);
    if (studentAssignmentMatch && method === 'GET') {
      requireRole(decoded, ['student']);
      const assignmentId = params.assignmentId || studentAssignmentMatch[1];
      return await handleGetStudentAssignment(decoded, assignmentId);
    }

    return errorResponse(404, 'ROUTE_NOT_FOUND', 'Route not found.');
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      handler: 'parentHandler',
      message: err.message,
    }));
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = statusCode < 500 || isDebug ? err.message : 'Internal server error.';
    const body = { error: err.errorCode || 'INTERNAL_ERROR', message };
    if (isDebug) {
      body._debug = { stack: err.stack, handler: 'parentHandler', timestamp: new Date().toISOString() };
    }
    return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
  }
};
