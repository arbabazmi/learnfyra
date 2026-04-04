/**
 * @file backend/handlers/schoolAdminHandler.js
 * @description Lambda-compatible handler for school admin control-plane routes (/school/*).
 *
 * Routes:
 *   GET    /school/teachers           — list active teachers in the caller's school
 *   POST   /school/teachers/invite    — generate a teacher invite code
 *   DELETE /school/teachers/:userId   — remove a teacher from the school
 *   GET    /school/students           — list all students across school's classes
 *   GET    /school/analytics          — subject/grade/teacher accuracy aggregates
 *   POST   /school/bulk-assign        — create assignments across multiple classes
 *   GET    /school/config             — read school gradeRange and activeSubjects
 *   PATCH  /school/config             — update school gradeRange and/or activeSubjects
 *
 * Authorization: school_admin or super_admin role required.
 * Scope: all data access is restricted to the caller's own school via SchoolUserLink lookup.
 *
 * Local dev:  APP_RUNTIME unset → DynamoDB endpoint from DYNAMODB_ENDPOINT env var
 * Lambda/AWS: APP_RUNTIME=aws   → DynamoDB via IAM role
 */

import { randomBytes, randomUUID } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { writeAuditLog, extractIp, extractUserAgent } from '../../src/admin/auditLogger.js';

// ── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,OPTIONS',
};

// ── DynamoDB client (lazy singleton) ────────────────────────────────────────

let _docClient = null;

/**
 * Returns a lazy singleton DynamoDBDocumentClient configured from env vars.
 * @returns {DynamoDBDocumentClient}
 */
function getDocClient() {
  if (!_docClient) {
    const cfg = { region: process.env.AWS_REGION || 'us-east-1' };
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (endpoint) {
      cfg.endpoint = endpoint;
      cfg.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
      };
    }
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient(cfg), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

// ── Table name helpers ───────────────────────────────────────────────────────

const DYNAMO_ENV = () => process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local';

function schoolTable() {
  return process.env.SCHOOL_TABLE_NAME || `LearnfyraSchool-${DYNAMO_ENV()}`;
}

function schoolUserLinkTable() {
  return process.env.SCHOOL_USER_LINK_TABLE_NAME || `LearnfyraSchoolUserLink-${DYNAMO_ENV()}`;
}

function classesTable() {
  return process.env.CLASSES_TABLE_NAME || `LearnfyraClasses-${DYNAMO_ENV()}`;
}

function membershipsTable() {
  return process.env.MEMBERSHIPS_TABLE_NAME || `LearnfyraMemberships-${DYNAMO_ENV()}`;
}

function usersTable() {
  return process.env.USERS_TABLE_NAME || `LearnfyraUsers-${DYNAMO_ENV()}`;
}

function userProgressTable() {
  return process.env.USER_PROGRESS_TABLE_NAME || `LearnfyraUserProgress-${DYNAMO_ENV()}`;
}

function assignmentsTable() {
  return process.env.ASSIGNMENTS_TABLE_NAME || `LearnfyraAssignments-${DYNAMO_ENV()}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a standard error response.
 * @param {number} statusCode
 * @param {string} message
 * @param {string} [code]
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function errorResponse(statusCode, message, code) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message, ...(code ? { code } : {}) }),
  };
}

/**
 * Generates an 8-character alphanumeric invite code using cryptographically
 * secure random bytes.
 * @returns {string} e.g. "A3K9FZ2Q"
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

// ── School affiliation lookup ────────────────────────────────────────────────

/**
 * Resolves the schoolId for the calling user by querying SchoolUserLink via
 * a GSI keyed on USER#userId. Looks for an active record where the role is
 * school_admin (or super_admin callers — they may not have a link).
 *
 * Returns null when no active school_admin link is found (super_admin callers
 * who are not linked to a school also return null, and the route handler must
 * decide how to scope the request).
 *
 * @param {string} userId
 * @param {string} callerRole - decoded.role from JWT
 * @returns {Promise<string|null>} schoolId or null
 */
async function getCallerSchoolId(userId, callerRole) {
  const docClient = getDocClient();

  // Query SchoolUserLink by USER#userId using the GSI (UserIndex or similar).
  // The GSI is expected to have PK=USER#userId. We filter for active status and
  // school_admin role to find the school this admin belongs to.
  //
  // If the GSI name differs in your CDK stack, set SCHOOL_USER_LINK_GSI_NAME.
  const gsiName = process.env.SCHOOL_USER_LINK_GSI_NAME || 'UserIndex';

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: schoolUserLinkTable(),
      IndexName: gsiName,
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: '#status = :active AND #role = :role',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#role': 'role',
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':active': 'active',
        ':role': 'school_admin',
      },
    }));

    const items = result.Items || [];
    if (items.length === 0) return null;

    // Extract schoolId from the first matching link.
    // The link record is expected to carry a `schoolId` attribute or embed it
    // in the table PK (SCHOOL#<schoolId>) which we parse as a fallback.
    const link = items[0];
    if (link.schoolId) return link.schoolId;

    // Fallback: derive from table PK stored on the item (SCHOOL#<schoolId>)
    if (typeof link.PK === 'string' && link.PK.startsWith('SCHOOL#')) {
      return link.PK.slice('SCHOOL#'.length);
    }

    return null;
  } catch (err) {
    console.error('getCallerSchoolId query failed:', err.message);
    return null;
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /school/teachers
 * Query SchoolUserLink table for all active teachers in the caller's school.
 *
 * @param {string} schoolId
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetTeachers(schoolId) {
  const docClient = getDocClient();

  const result = await docClient.send(new QueryCommand({
    TableName: schoolUserLinkTable(),
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: '#role = :teacher AND #status = :active',
    ExpressionAttributeNames: {
      '#role': 'role',
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':pk': `SCHOOL#${schoolId}`,
      ':teacher': 'teacher',
      ':active': 'active',
    },
  }));

  const links = result.Items || [];

  // Hydrate with display names from Users table
  const teachers = await Promise.all(
    links.map(async (link) => {
      const userId = link.userId || (
        typeof link.SK === 'string' && link.SK.startsWith('USER#')
          ? link.SK.slice('USER#'.length)
          : null
      );
      if (!userId) return null;

      try {
        const userResult = await docClient.send(new GetCommand({
          TableName: usersTable(),
          Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        }));
        const user = userResult.Item;
        return {
          userId,
          displayName: user?.displayName || user?.email || userId,
          email: user?.email || null,
          linkedAt: link.linkedAt || link.createdAt || null,
        };
      } catch {
        return { userId, displayName: userId, email: null, linkedAt: null };
      }
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ teachers: teachers.filter(Boolean) }),
  };
}

/**
 * POST /school/teachers/invite
 * Generate and store a teacher invite code for the school.
 * Body: (none required)
 *
 * @param {string} schoolId
 * @param {Object} decoded - Verified JWT payload
 * @param {Object} event - API Gateway event (for audit)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleInviteTeacher(schoolId, decoded, event) {
  const docClient = getDocClient();
  const inviteCode = generateInviteCode();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Store the invite in SchoolUserLink using a INVITE# SK pattern so it can
  // be retrieved when the teacher redeems it.
  await docClient.send(new PutCommand({
    TableName: schoolUserLinkTable(),
    Item: {
      PK: `SCHOOL#${schoolId}`,
      SK: `INVITE#${inviteCode}`,
      schoolId,
      inviteCode,
      role: 'teacher',
      status: 'pending',
      createdBy: decoded.sub,
      createdAt: now,
      expiresAt,
    },
  }));

  await writeAuditLog({
    actorId: decoded.sub,
    actorRole: decoded.role,
    action: 'TEACHER_INVITED',
    targetEntityType: 'School',
    targetEntityId: schoolId,
    beforeState: null,
    afterState: { inviteCode, expiresAt },
    ipAddress: extractIp(event),
    userAgent: extractUserAgent(event),
  });

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ inviteCode, expiresAt }),
  };
}

/**
 * DELETE /school/teachers/:userId
 * Set SchoolUserLink status=removed and clear schoolId on the teacher's classes.
 *
 * @param {string} schoolId
 * @param {string} targetUserId - Teacher userId from path parameter
 * @param {Object} decoded - Verified JWT payload
 * @param {Object} event - API Gateway event (for audit)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleRemoveTeacher(schoolId, targetUserId, decoded, event) {
  if (!targetUserId) {
    return errorResponse(400, 'userId path parameter is required.', 'SCHOOL_INVALID_REQUEST');
  }

  const docClient = getDocClient();

  // Verify the teacher link exists and belongs to this school
  let existingLink;
  try {
    const linkResult = await docClient.send(new GetCommand({
      TableName: schoolUserLinkTable(),
      Key: { PK: `SCHOOL#${schoolId}`, SK: `USER#${targetUserId}` },
    }));
    existingLink = linkResult.Item;
  } catch (err) {
    console.error('handleRemoveTeacher: link lookup failed:', err.message);
    return errorResponse(500, 'Internal server error.', 'SCHOOL_INTERNAL_ERROR');
  }

  if (!existingLink || existingLink.role !== 'teacher') {
    // Return 403 for non-affiliated teacher (anti-enumeration)
    return errorResponse(403, 'Forbidden.', 'SCHOOL_FORBIDDEN');
  }

  if (existingLink.status === 'removed') {
    return errorResponse(409, 'Teacher is already removed from this school.', 'SCHOOL_CONFLICT');
  }

  const now = new Date().toISOString();

  // Mark the teacher link as removed
  await docClient.send(new UpdateCommand({
    TableName: schoolUserLinkTable(),
    Key: { PK: `SCHOOL#${schoolId}`, SK: `USER#${targetUserId}` },
    UpdateExpression: 'SET #status = :removed, removedAt = :now, removedBy = :actor',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':removed': 'removed',
      ':now': now,
      ':actor': decoded.sub,
    },
  }));

  // Clear schoolId on all classes owned by this teacher in this school
  try {
    const classResult = await docClient.send(new QueryCommand({
      TableName: classesTable(),
      IndexName: process.env.CLASSES_TEACHER_GSI_NAME || 'TeacherIndex',
      KeyConditionExpression: 'teacherId = :teacherId',
      FilterExpression: 'schoolId = :schoolId',
      ExpressionAttributeValues: {
        ':teacherId': targetUserId,
        ':schoolId': schoolId,
      },
    }));

    const teacherClasses = classResult.Items || [];
    await Promise.all(
      teacherClasses.map((cls) => {
        const pk = cls.PK || `CLASS#${cls.classId}`;
        const sk = cls.SK || 'METADATA';
        return docClient.send(new UpdateCommand({
          TableName: classesTable(),
          Key: { PK: pk, SK: sk },
          UpdateExpression: 'REMOVE schoolId',
        }));
      })
    );
  } catch (err) {
    // Non-fatal: class cleanup failure should not block the removal response
    console.error('handleRemoveTeacher: class schoolId clear failed (non-fatal):', err.message);
  }

  await writeAuditLog({
    actorId: decoded.sub,
    actorRole: decoded.role,
    action: 'TEACHER_REMOVED',
    targetEntityType: 'SchoolUserLink',
    targetEntityId: `${schoolId}#${targetUserId}`,
    beforeState: { status: existingLink.status },
    afterState: { status: 'removed' },
    ipAddress: extractIp(event),
    userAgent: extractUserAgent(event),
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Teacher removed from school.' }),
  };
}

/**
 * GET /school/students
 * List all students enrolled in any class belonging to the caller's school.
 * Students are deduplicated by userId.
 *
 * @param {string} schoolId
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetStudents(schoolId) {
  const docClient = getDocClient();

  // 1. Fetch all classes for this school
  let schoolClasses = [];
  try {
    const classResult = await docClient.send(new QueryCommand({
      TableName: classesTable(),
      IndexName: process.env.CLASSES_SCHOOL_GSI_NAME || 'SchoolIndex',
      KeyConditionExpression: 'schoolId = :schoolId',
      ExpressionAttributeValues: { ':schoolId': schoolId },
    }));
    schoolClasses = classResult.Items || [];
  } catch (err) {
    console.error('handleGetStudents: class query failed:', err.message);
    return errorResponse(500, 'Internal server error.', 'SCHOOL_INTERNAL_ERROR');
  }

  if (schoolClasses.length === 0) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ students: [] }),
    };
  }

  // 2. Fetch memberships across all classes; deduplicate by userId
  const seenUserIds = new Set();
  const studentIds = [];

  await Promise.all(
    schoolClasses.map(async (cls) => {
      const classId = cls.classId || (
        typeof cls.PK === 'string' && cls.PK.startsWith('CLASS#')
          ? cls.PK.slice('CLASS#'.length)
          : null
      );
      if (!classId) return;

      try {
        const memberResult = await docClient.send(new QueryCommand({
          TableName: membershipsTable(),
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':pk': `CLASS#${classId}`,
            ':active': 'active',
          },
        }));
        for (const m of memberResult.Items || []) {
          const userId = m.studentId || (
            typeof m.SK === 'string' && m.SK.startsWith('USER#')
              ? m.SK.slice('USER#'.length)
              : null
          );
          if (userId && !seenUserIds.has(userId)) {
            seenUserIds.add(userId);
            studentIds.push(userId);
          }
        }
      } catch (err) {
        console.error(`handleGetStudents: membership query failed for class ${classId}:`, err.message);
      }
    })
  );

  // 3. Hydrate with user profiles
  const students = await Promise.all(
    studentIds.map(async (userId) => {
      try {
        const userResult = await docClient.send(new GetCommand({
          TableName: usersTable(),
          Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        }));
        const user = userResult.Item;
        return {
          userId,
          displayName: user?.displayName || user?.email || userId,
          email: user?.email || null,
          grade: user?.grade || null,
        };
      } catch {
        return { userId, displayName: userId, email: null, grade: null };
      }
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ students }),
  };
}

/**
 * GET /school/analytics
 * Returns subject-level accuracy, grade-level accuracy, and teacher completion
 * rates for students in the school's classes. Returns zeros for empty combos.
 *
 * @param {string} schoolId
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetAnalytics(schoolId) {
  const docClient = getDocClient();

  // 1. Fetch all classes for this school
  let schoolClasses = [];
  try {
    const classResult = await docClient.send(new QueryCommand({
      TableName: classesTable(),
      IndexName: process.env.CLASSES_SCHOOL_GSI_NAME || 'SchoolIndex',
      KeyConditionExpression: 'schoolId = :schoolId',
      ExpressionAttributeValues: { ':schoolId': schoolId },
    }));
    schoolClasses = classResult.Items || [];
  } catch (err) {
    console.error('handleGetAnalytics: class query failed:', err.message);
    return errorResponse(500, 'Internal server error.', 'SCHOOL_INTERNAL_ERROR');
  }

  // Aggregate structures
  const subjectStats = {};   // { [subject]: { correct: 0, total: 0 } }
  const gradeStats = {};     // { [grade]: { correct: 0, total: 0 } }
  const teacherStats = {};   // { [teacherId]: { assigned: 0, completed: 0 } }

  // 2. For each class, pull memberships and UserProgress
  await Promise.all(
    schoolClasses.map(async (cls) => {
      const classId = cls.classId || (
        typeof cls.PK === 'string' && cls.PK.startsWith('CLASS#')
          ? cls.PK.slice('CLASS#'.length)
          : null
      );
      const subject = cls.subject || 'Unknown';
      const grade = cls.grade != null ? String(cls.grade) : 'Unknown';
      const teacherId = cls.teacherId || null;

      // Initialise teacher bucket
      if (teacherId) {
        if (!teacherStats[teacherId]) {
          teacherStats[teacherId] = { assigned: 0, completed: 0 };
        }
      }

      if (!classId) return;

      // Fetch active memberships
      let memberIds = [];
      try {
        const memberResult = await docClient.send(new QueryCommand({
          TableName: membershipsTable(),
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':pk': `CLASS#${classId}`,
            ':active': 'active',
          },
        }));
        memberIds = (memberResult.Items || []).map((m) =>
          m.studentId || (
            typeof m.SK === 'string' && m.SK.startsWith('USER#')
              ? m.SK.slice('USER#'.length)
              : null
          )
        ).filter(Boolean);
      } catch (err) {
        console.error(`handleGetAnalytics: membership query failed for class ${classId}:`, err.message);
        return;
      }

      // Fetch UserProgress records per student for this class
      await Promise.all(
        memberIds.map(async (userId) => {
          try {
            const progressResult = await docClient.send(new QueryCommand({
              TableName: userProgressTable(),
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
              ExpressionAttributeValues: {
                ':pk': `USER#${userId}`,
                ':prefix': `CLASS#${classId}#`,
              },
            }));

            for (const record of progressResult.Items || []) {
              const correct = Number(record.correctAnswers) || 0;
              const total = Number(record.totalAnswers) || 0;
              const completed = record.status === 'completed';

              // Subject accuracy
              if (!subjectStats[subject]) subjectStats[subject] = { correct: 0, total: 0 };
              subjectStats[subject].correct += correct;
              subjectStats[subject].total += total;

              // Grade accuracy
              if (!gradeStats[grade]) gradeStats[grade] = { correct: 0, total: 0 };
              gradeStats[grade].correct += correct;
              gradeStats[grade].total += total;

              // Teacher completion
              if (teacherId) {
                teacherStats[teacherId].assigned += 1;
                if (completed) teacherStats[teacherId].completed += 1;
              }
            }
          } catch (err) {
            console.error(`handleGetAnalytics: progress query failed for user ${userId}:`, err.message);
          }
        })
      );
    })
  );

  // 3. Shape output — compute accuracy percentages, default zero for missing keys
  const subjectAccuracy = Object.entries(subjectStats).map(([subject, s]) => ({
    subject,
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    correctAnswers: s.correct,
    totalAnswers: s.total,
  }));

  const gradeAccuracy = Object.entries(gradeStats).map(([grade, s]) => ({
    grade,
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    correctAnswers: s.correct,
    totalAnswers: s.total,
  }));

  const teacherCompletion = Object.entries(teacherStats).map(([teacherId, s]) => ({
    teacherId,
    assigned: s.assigned,
    completed: s.completed,
    completionRate: s.assigned > 0 ? Math.round((s.completed / s.assigned) * 100) : 0,
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      schoolId,
      subjectAccuracy,
      gradeAccuracy,
      teacherCompletion,
    }),
  };
}

/**
 * POST /school/bulk-assign
 * Create assignment records across multiple classes in the caller's school.
 * Rejects ALL if any classId does not belong to the caller's school.
 * Body: { classIds: string[], worksheetId: string, dueDate?: string }
 *
 * @param {string} schoolId
 * @param {Object} body - Parsed request body
 * @param {Object} decoded - Verified JWT payload
 * @param {Object} event - API Gateway event (for audit)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleBulkAssign(schoolId, body, decoded, event) {
  const { classIds, worksheetId, dueDate } = body || {};

  if (!Array.isArray(classIds) || classIds.length === 0) {
    return errorResponse(400, 'classIds must be a non-empty array.', 'SCHOOL_INVALID_REQUEST');
  }

  if (typeof worksheetId !== 'string' || !worksheetId.trim()) {
    return errorResponse(400, 'worksheetId is required.', 'SCHOOL_INVALID_REQUEST');
  }

  if (dueDate != null && dueDate !== '') {
    if (!Number.isFinite(Date.parse(dueDate))) {
      return errorResponse(400, 'dueDate must be a valid ISO-8601 datetime when provided.', 'SCHOOL_INVALID_REQUEST');
    }
  }

  const docClient = getDocClient();

  // Validate all classIds belong to the caller's school — reject ALL if any fail
  const classValidations = await Promise.all(
    classIds.map(async (classId) => {
      try {
        const result = await docClient.send(new GetCommand({
          TableName: classesTable(),
          Key: { PK: `CLASS#${classId}`, SK: 'METADATA' },
        }));
        const cls = result.Item;
        // Must exist and belong to this school
        return cls && cls.schoolId === schoolId;
      } catch {
        return false;
      }
    })
  );

  const allValid = classValidations.every(Boolean);
  if (!allValid) {
    // Return 403 anti-enumeration: one or more classIds are not in the school
    return errorResponse(403, 'Forbidden: one or more classIds do not belong to your school.', 'SCHOOL_FORBIDDEN');
  }

  // Create assignment records
  const now = new Date().toISOString();
  const assignmentIds = [];

  await Promise.all(
    classIds.map(async (classId) => {
      const assignmentId = randomUUID();
      assignmentIds.push(assignmentId);

      await docClient.send(new PutCommand({
        TableName: assignmentsTable(),
        Item: {
          PK: `CLASS#${classId}`,
          SK: `ASSIGNMENT#${assignmentId}`,
          assignmentId,
          classId,
          worksheetId: worksheetId.trim(),
          schoolId,
          assignedBy: decoded.sub,
          createdAt: now,
          ...(dueDate ? { dueDate } : {}),
          status: 'active',
        },
      }));
    })
  );

  await writeAuditLog({
    actorId: decoded.sub,
    actorRole: decoded.role,
    action: 'BULK_ASSIGNMENT_CREATED',
    targetEntityType: 'School',
    targetEntityId: schoolId,
    beforeState: null,
    afterState: { classIds, worksheetId: worksheetId.trim(), assignmentCount: classIds.length },
    ipAddress: extractIp(event),
    userAgent: extractUserAgent(event),
  });

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Assignments created.',
      assignmentCount: classIds.length,
      assignmentIds,
    }),
  };
}

/**
 * GET /school/config
 * Read gradeRange and activeSubjects for the caller's school.
 *
 * @param {string} schoolId
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetConfig(schoolId) {
  const docClient = getDocClient();

  let school;
  try {
    const result = await docClient.send(new GetCommand({
      TableName: schoolTable(),
      Key: { PK: `SCHOOL#${schoolId}`, SK: 'METADATA' },
    }));
    school = result.Item;
  } catch (err) {
    console.error('handleGetConfig: school lookup failed:', err.message);
    return errorResponse(500, 'Internal server error.', 'SCHOOL_INTERNAL_ERROR');
  }

  if (!school) {
    return errorResponse(404, 'School record not found.', 'SCHOOL_NOT_FOUND');
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      schoolId,
      gradeRange: school.gradeRange || { minGrade: 1, maxGrade: 10 },
      activeSubjects: school.activeSubjects || [],
    }),
  };
}

/**
 * PATCH /school/config
 * Update gradeRange and/or activeSubjects for the caller's school.
 * Body: { gradeRange?: { minGrade, maxGrade }, activeSubjects?: string[] }
 *
 * @param {string} schoolId
 * @param {Object} body - Parsed request body
 * @param {Object} decoded - Verified JWT payload
 * @param {Object} event - API Gateway event (for audit)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handlePatchConfig(schoolId, body, decoded, event) {
  const { gradeRange, activeSubjects } = body || {};

  const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];

  // Validate gradeRange if provided
  if (gradeRange != null) {
    const { minGrade, maxGrade } = gradeRange;
    if (
      !Number.isInteger(minGrade) || minGrade < 1 || minGrade > 10 ||
      !Number.isInteger(maxGrade) || maxGrade < 1 || maxGrade > 10
    ) {
      return errorResponse(400, 'gradeRange.minGrade and maxGrade must be integers between 1 and 10.', 'SCHOOL_INVALID_REQUEST');
    }
    if (minGrade > maxGrade) {
      return errorResponse(400, 'gradeRange.minGrade must be less than or equal to maxGrade.', 'SCHOOL_INVALID_REQUEST');
    }
  }

  // Validate activeSubjects if provided
  if (activeSubjects != null) {
    if (!Array.isArray(activeSubjects)) {
      return errorResponse(400, 'activeSubjects must be an array.', 'SCHOOL_INVALID_REQUEST');
    }
    const invalid = activeSubjects.filter((s) => !VALID_SUBJECTS.includes(s));
    if (invalid.length > 0) {
      return errorResponse(
        400,
        `Invalid subjects: ${invalid.join(', ')}. Must be one of: ${VALID_SUBJECTS.join(', ')}.`,
        'SCHOOL_INVALID_REQUEST'
      );
    }
  }

  if (gradeRange == null && activeSubjects == null) {
    return errorResponse(400, 'At least one of gradeRange or activeSubjects must be provided.', 'SCHOOL_INVALID_REQUEST');
  }

  const docClient = getDocClient();

  // Read current config for audit before-state
  let currentSchool;
  try {
    const result = await docClient.send(new GetCommand({
      TableName: schoolTable(),
      Key: { PK: `SCHOOL#${schoolId}`, SK: 'METADATA' },
    }));
    currentSchool = result.Item;
  } catch (err) {
    console.error('handlePatchConfig: school lookup failed:', err.message);
    return errorResponse(500, 'Internal server error.', 'SCHOOL_INTERNAL_ERROR');
  }

  if (!currentSchool) {
    return errorResponse(404, 'School record not found.', 'SCHOOL_NOT_FOUND');
  }

  // Build UpdateExpression dynamically
  const expressionParts = ['updatedAt = :updatedAt', 'updatedBy = :updatedBy'];
  const expressionValues = {
    ':updatedAt': new Date().toISOString(),
    ':updatedBy': decoded.sub,
  };
  const expressionNames = {};

  if (gradeRange != null) {
    expressionParts.push('gradeRange = :gradeRange');
    expressionValues[':gradeRange'] = gradeRange;
  }

  if (activeSubjects != null) {
    expressionParts.push('activeSubjects = :activeSubjects');
    expressionValues[':activeSubjects'] = activeSubjects;
  }

  await docClient.send(new UpdateCommand({
    TableName: schoolTable(),
    Key: { PK: `SCHOOL#${schoolId}`, SK: 'METADATA' },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeValues: expressionValues,
    ...(Object.keys(expressionNames).length > 0 ? { ExpressionAttributeNames: expressionNames } : {}),
  }));

  const afterState = {
    ...(gradeRange != null ? { gradeRange } : {}),
    ...(activeSubjects != null ? { activeSubjects } : {}),
  };

  const beforeState = {
    gradeRange: currentSchool.gradeRange || null,
    activeSubjects: currentSchool.activeSubjects || [],
  };

  await writeAuditLog({
    actorId: decoded.sub,
    actorRole: decoded.role,
    action: 'SCHOOL_CONFIG_UPDATED',
    targetEntityType: 'School',
    targetEntityId: schoolId,
    beforeState,
    afterState,
    ipAddress: extractIp(event),
    userAgent: extractUserAgent(event),
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'School configuration updated.',
      schoolId,
      ...afterState,
    }),
  };
}

// ── Lambda handler entry point ────────────────────────────────────────────────

/**
 * Lambda-compatible handler for /school/* routes.
 *
 * @param {Object} event - API Gateway v1 event or Express-shaped mock event
 * @param {Object} context - Lambda context
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);
    requireRole(decoded, ['school_admin', 'super_admin']);

    const schoolId = await getCallerSchoolId(decoded.sub, decoded.role);
    if (!schoolId) {
      return errorResponse(403, 'Forbidden: no active school affiliation found.', 'SCHOOL_FORBIDDEN');
    }

    const path = event.path || event.routeKey || '';
    const method = event.httpMethod || 'GET';

    // GET /school/teachers
    if (method === 'GET' && /\/school\/teachers\/?$/.test(path)) {
      return await handleGetTeachers(schoolId);
    }

    // POST /school/teachers/invite
    if (method === 'POST' && /\/school\/teachers\/invite\/?$/.test(path)) {
      return await handleInviteTeacher(schoolId, decoded, event);
    }

    // DELETE /school/teachers/:userId
    if (method === 'DELETE' && /\/school\/teachers\/[^/]+\/?$/.test(path)) {
      const targetUserId =
        (event.pathParameters && event.pathParameters.userId) ||
        path.split('/school/teachers/')[1]?.replace(/\/$/, '') ||
        null;
      return await handleRemoveTeacher(schoolId, targetUserId, decoded, event);
    }

    // GET /school/students
    if (method === 'GET' && /\/school\/students\/?$/.test(path)) {
      return await handleGetStudents(schoolId);
    }

    // GET /school/analytics
    if (method === 'GET' && /\/school\/analytics\/?$/.test(path)) {
      return await handleGetAnalytics(schoolId);
    }

    // POST /school/bulk-assign
    if (method === 'POST' && /\/school\/bulk-assign\/?$/.test(path)) {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON in request body.', 'SCHOOL_INVALID_REQUEST');
      }
      return await handleBulkAssign(schoolId, body, decoded, event);
    }

    // GET /school/config
    if (method === 'GET' && /\/school\/config\/?$/.test(path)) {
      return await handleGetConfig(schoolId);
    }

    // PATCH /school/config
    if (method === 'PATCH' && /\/school\/config\/?$/.test(path)) {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON in request body.', 'SCHOOL_INVALID_REQUEST');
      }
      return await handlePatchConfig(schoolId, body, decoded, event);
    }

    return errorResponse(404, 'Route not found.', 'SCHOOL_NOT_FOUND');
  } catch (err) {
    console.error('schoolAdminHandler error:', err);

    if (err.statusCode && err.statusCode < 500) {
      const code = err.statusCode === 403 ? 'SCHOOL_FORBIDDEN' : 'SCHOOL_INVALID_REQUEST';
      return errorResponse(err.statusCode, err.message, code);
    }

    if (err instanceof SyntaxError) {
      return errorResponse(400, 'Invalid JSON in request body.', 'SCHOOL_INVALID_REQUEST');
    }

    const isDebug = process.env.DEBUG_MODE === 'true';
    const body = { error: isDebug ? err.message : 'Internal server error.', code: 'SCHOOL_INTERNAL_ERROR' };
    if (isDebug) {
      body._debug = {
        stack: err.stack,
        handler: 'schoolAdminHandler',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      };
    }
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify(body) };
  }
};
