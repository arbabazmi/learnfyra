/**
 * @file tests/unit/schoolAdminHandler.test.js
 * @description Unit tests for backend/handlers/schoolAdminHandler.js.
 *   authMiddleware is mocked with jest.unstable_mockModule.
 *   All DynamoDB calls are intercepted with aws-sdk-client-mock.
 *   writeAuditLog is mocked so audit side-effects do not reach real DynamoDB.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

// ─── AWS SDK mock ─────────────────────────────────────────────────────────────

const dynamoMock = mockClient(DynamoDBDocumentClient);

// ─── Module mocks (all must precede the first dynamic import()) ───────────────

const mockValidateToken = jest.fn();
const mockRequireRole   = jest.fn(); // no-op by default (role check passes)
const mockWriteAuditLog = jest.fn().mockResolvedValue('audit-id-mock');

jest.unstable_mockModule('../../backend/middleware/authMiddleware.js', () => ({
  validateToken: mockValidateToken,
  requireRole:   mockRequireRole,
}));

jest.unstable_mockModule('../../src/admin/auditLogger.js', () => ({
  writeAuditLog:    mockWriteAuditLog,
  extractIp:        jest.fn().mockReturnValue('127.0.0.1'),
  extractUserAgent: jest.fn().mockReturnValue('jest-test-agent'),
}));

// schoolAdminHandler also imports getDbAdapter for the outer try block path
// (only used by validateToken/requireRole wrappers in authMiddleware — the
// handler itself uses DynamoDBDocumentClient directly).
jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({})),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { handler } = await import('../../backend/handlers/schoolAdminHandler.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHOOL_ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SCHOOL_ID       = 'school-test-001';
const TEACHER_ID      = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STUDENT_ID      = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

// ─── Default decoded JWT payloads ─────────────────────────────────────────────

const schoolAdminDecoded = {
  sub:   SCHOOL_ADMIN_ID,
  email: 'schooladmin@test.com',
  role:  'school_admin',
};

const teacherDecoded = {
  sub:   TEACHER_ID,
  email: 'teacher@test.com',
  role:  'teacher',
};

// ─── Helper: build a minimal API Gateway-shaped event ────────────────────────

function makeEvent(method, path, body = null, pathParameters = null) {
  return {
    httpMethod:       method,
    path,
    headers:          { Authorization: 'Bearer mock-jwt', 'User-Agent': 'jest' },
    body:             body != null ? JSON.stringify(body) : null,
    pathParameters,
    queryStringParameters: null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Helpers: wire the standard DynamoDB responses used across most tests ─────

/**
 * Stubs the SchoolUserLink GSI query (getCallerSchoolId) to return a record
 * that links the caller to SCHOOL_ID.
 */
function stubCallerSchoolLink() {
  dynamoMock.on(QueryCommand).resolves({
    Items: [{ PK: `SCHOOL#${SCHOOL_ID}`, SK: `USER#${SCHOOL_ADMIN_ID}`, schoolId: SCHOOL_ID, role: 'school_admin', status: 'active' }],
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  dynamoMock.reset();
  jest.clearAllMocks();

  // Default: token validates as school_admin
  mockValidateToken.mockResolvedValue(schoolAdminDecoded);
  // Default: requireRole passes (no-op)
  mockRequireRole.mockImplementation(() => {});
  // Default: audit log always succeeds
  mockWriteAuditLog.mockResolvedValue('audit-id-mock');
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── Role enforcement ─────────────────────────────────────────────────────────

describe('role enforcement', () => {
  it('returns 403 when requireRole throws for a non-admin role', async () => {
    mockValidateToken.mockResolvedValue(teacherDecoded);
    mockRequireRole.mockImplementation(() => {
      const err = new Error('Forbidden: insufficient role.');
      err.statusCode = 403;
      throw err;
    });

    // Any school route will hit the role check before the SchoolUserLink query
    const result = await handler(
      makeEvent('GET', '/school/teachers'),
      mockContext
    );

    expect(result.statusCode).toBe(403);
  });

  it('returns 403 when the caller has no active school affiliation', async () => {
    // requireRole passes; SchoolUserLink query returns no matching link
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const result = await handler(
      makeEvent('GET', '/school/teachers'),
      mockContext
    );

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SCHOOL_FORBIDDEN');
  });
});

// ─── GET /school/teachers ─────────────────────────────────────────────────────

describe('GET /school/teachers', () => {
  it('returns teacher list scoped to the caller\'s school', async () => {
    // 1st QueryCommand → getCallerSchoolId (GSI on SchoolUserLink)
    // 2nd QueryCommand → handleGetTeachers (list teachers for SCHOOL#schoolId)
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [{ PK: `SCHOOL#${SCHOOL_ID}`, SK: `USER#${SCHOOL_ADMIN_ID}`, schoolId: SCHOOL_ID, role: 'school_admin', status: 'active' }],
      })
      .resolvesOnce({
        Items: [
          { PK: `SCHOOL#${SCHOOL_ID}`, SK: `USER#${TEACHER_ID}`, userId: TEACHER_ID, role: 'teacher', status: 'active', linkedAt: '2026-01-01T00:00:00Z' },
        ],
      });

    // GetCommand → hydrate teacher profile from Users table
    dynamoMock.on(GetCommand).resolves({
      Item: { PK: `USER#${TEACHER_ID}`, SK: 'PROFILE', displayName: 'Alice', email: 'alice@test.com' },
    });

    const result = await handler(
      makeEvent('GET', '/school/teachers'),
      mockContext
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.teachers)).toBe(true);
    expect(body.teachers).toHaveLength(1);
    expect(body.teachers[0].userId).toBe(TEACHER_ID);
    expect(body.teachers[0].displayName).toBe('Alice');
  });

  it('returns empty teachers array when school has no active teachers', async () => {
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [{ schoolId: SCHOOL_ID, role: 'school_admin', status: 'active' }],
      })
      .resolvesOnce({ Items: [] });

    const result = await handler(
      makeEvent('GET', '/school/teachers'),
      mockContext
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).teachers).toEqual([]);
  });

  it('includes CORS headers on success', async () => {
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ schoolId: SCHOOL_ID }] })
      .resolvesOnce({ Items: [] });

    const result = await handler(makeEvent('GET', '/school/teachers'), mockContext);

    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── POST /school/teachers/invite ────────────────────────────────────────────

describe('POST /school/teachers/invite', () => {
  it('returns 201 with an invite code', async () => {
    stubCallerSchoolLink();
    dynamoMock.on(PutCommand).resolves({});

    const result = await handler(
      makeEvent('POST', '/school/teachers/invite'),
      mockContext
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(typeof body.inviteCode).toBe('string');
    expect(body.inviteCode).toHaveLength(8);
    expect(typeof body.expiresAt).toBe('string');
  });

  it('stores the invite in DynamoDB via PutCommand', async () => {
    stubCallerSchoolLink();
    dynamoMock.on(PutCommand).resolves({});

    await handler(makeEvent('POST', '/school/teachers/invite'), mockContext);

    const putCalls = dynamoMock.commandCalls(PutCommand);
    expect(putCalls.length).toBeGreaterThanOrEqual(1);

    const invitePut = putCalls.find((c) =>
      String(c.args[0].input.Item?.SK || '').startsWith('INVITE#')
    );
    expect(invitePut).toBeDefined();
    expect(invitePut.args[0].input.Item.role).toBe('teacher');
    expect(invitePut.args[0].input.Item.status).toBe('pending');
  });

  it('writes an audit log entry for TEACHER_INVITED', async () => {
    stubCallerSchoolLink();
    dynamoMock.on(PutCommand).resolves({});

    await handler(makeEvent('POST', '/school/teachers/invite'), mockContext);

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TEACHER_INVITED', actorId: SCHOOL_ADMIN_ID })
    );
  });
});

// ─── DELETE /school/teachers/:userId ─────────────────────────────────────────

describe('DELETE /school/teachers/:userId', () => {
  it('removes a teacher and returns 200', async () => {
    stubCallerSchoolLink();

    // GetCommand → verify teacher link exists
    dynamoMock.on(GetCommand).resolves({
      Item: { PK: `SCHOOL#${SCHOOL_ID}`, SK: `USER#${TEACHER_ID}`, role: 'teacher', status: 'active' },
    });

    dynamoMock.on(UpdateCommand).resolves({});
    // Classes GSI query — no classes to update
    dynamoMock.on(QueryCommand)
      .resolvesOnce({ Items: [{ schoolId: SCHOOL_ID }] }) // getCallerSchoolId
      .resolvesOnce({ Items: [] });                        // class cleanup query

    const result = await handler(
      makeEvent('DELETE', `/school/teachers/${TEACHER_ID}`, null, { userId: TEACHER_ID }),
      mockContext
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Teacher removed from school.');
  });

  it('returns 409 when teacher is already removed', async () => {
    stubCallerSchoolLink();

    dynamoMock.on(GetCommand).resolves({
      Item: { PK: `SCHOOL#${SCHOOL_ID}`, SK: `USER#${TEACHER_ID}`, role: 'teacher', status: 'removed' },
    });

    const result = await handler(
      makeEvent('DELETE', `/school/teachers/${TEACHER_ID}`, null, { userId: TEACHER_ID }),
      mockContext
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).code).toBe('SCHOOL_CONFLICT');
  });

  it('returns 403 when teacher does not belong to school', async () => {
    stubCallerSchoolLink();

    // GetCommand returns no item → teacher not found in this school
    dynamoMock.on(GetCommand).resolves({ Item: undefined });

    const result = await handler(
      makeEvent('DELETE', `/school/teachers/${TEACHER_ID}`, null, { userId: TEACHER_ID }),
      mockContext
    );

    expect(result.statusCode).toBe(403);
  });

  it('writes TEACHER_REMOVED audit log on success', async () => {
    stubCallerSchoolLink();

    dynamoMock.on(GetCommand).resolves({
      Item: { PK: `SCHOOL#${SCHOOL_ID}`, SK: `USER#${TEACHER_ID}`, role: 'teacher', status: 'active' },
    });
    dynamoMock.on(UpdateCommand).resolves({});
    dynamoMock.on(QueryCommand)
      .resolvesOnce({ Items: [{ schoolId: SCHOOL_ID }] })
      .resolvesOnce({ Items: [] });

    await handler(
      makeEvent('DELETE', `/school/teachers/${TEACHER_ID}`, null, { userId: TEACHER_ID }),
      mockContext
    );

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TEACHER_REMOVED' })
    );
  });
});

// ─── GET /school/students ─────────────────────────────────────────────────────

describe('GET /school/students', () => {
  it('returns deduplicated student list', async () => {
    // QueryCommand sequence:
    //   1. getCallerSchoolId
    //   2. handleGetStudents — school classes (SchoolIndex)
    //   3. handleGetStudents — memberships for classId-1
    //   4. handleGetStudents — memberships for classId-2 (same student, tests dedup)
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ schoolId: SCHOOL_ID }] })
      .resolvesOnce({
        Items: [
          { PK: 'CLASS#class-1', classId: 'class-1' },
          { PK: 'CLASS#class-2', classId: 'class-2' },
        ],
      })
      .resolvesOnce({
        Items: [{ SK: `USER#${STUDENT_ID}`, studentId: STUDENT_ID, status: 'active' }],
      })
      .resolvesOnce({
        // Same student in a second class — must be deduplicated
        Items: [{ SK: `USER#${STUDENT_ID}`, studentId: STUDENT_ID, status: 'active' }],
      });

    // GetCommand → hydrate each unique student profile
    dynamoMock.on(GetCommand).resolves({
      Item: { PK: `USER#${STUDENT_ID}`, SK: 'PROFILE', displayName: 'Bob', email: 'bob@test.com', grade: 5 },
    });

    const result = await handler(
      makeEvent('GET', '/school/students'),
      mockContext
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.students)).toBe(true);
    // Despite the student appearing in two classes, they appear only once
    expect(body.students).toHaveLength(1);
    expect(body.students[0].userId).toBe(STUDENT_ID);
    expect(body.students[0].displayName).toBe('Bob');
  });

  it('returns empty students array when school has no classes', async () => {
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ schoolId: SCHOOL_ID }] })
      .resolvesOnce({ Items: [] }); // no classes

    const result = await handler(
      makeEvent('GET', '/school/students'),
      mockContext
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).students).toEqual([]);
  });
});

// ─── GET /school/config ───────────────────────────────────────────────────────

describe('GET /school/config', () => {
  it('returns school gradeRange and activeSubjects', async () => {
    stubCallerSchoolLink();

    dynamoMock.on(GetCommand).resolves({
      Item: {
        PK: `SCHOOL#${SCHOOL_ID}`,
        SK: 'METADATA',
        gradeRange: { minGrade: 1, maxGrade: 8 },
        activeSubjects: ['Math', 'ELA'],
      },
    });

    const result = await handler(
      makeEvent('GET', '/school/config'),
      mockContext
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.schoolId).toBe(SCHOOL_ID);
    expect(body.gradeRange).toEqual({ minGrade: 1, maxGrade: 8 });
    expect(body.activeSubjects).toEqual(['Math', 'ELA']);
  });

  it('returns 404 when school record is not found', async () => {
    stubCallerSchoolLink();

    dynamoMock.on(GetCommand).resolves({ Item: undefined });

    const result = await handler(
      makeEvent('GET', '/school/config'),
      mockContext
    );

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).code).toBe('SCHOOL_NOT_FOUND');
  });

  it('includes CORS headers on error responses', async () => {
    stubCallerSchoolLink();
    dynamoMock.on(GetCommand).resolves({ Item: undefined });

    const result = await handler(makeEvent('GET', '/school/config'), mockContext);

    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── PATCH /school/config ─────────────────────────────────────────────────────

describe('PATCH /school/config', () => {
  it('returns 200 and updates gradeRange when minGrade <= maxGrade', async () => {
    stubCallerSchoolLink();

    dynamoMock.on(GetCommand).resolves({
      Item: { PK: `SCHOOL#${SCHOOL_ID}`, SK: 'METADATA', gradeRange: { minGrade: 1, maxGrade: 10 }, activeSubjects: [] },
    });
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(
      makeEvent('PATCH', '/school/config', { gradeRange: { minGrade: 2, maxGrade: 8 } }),
      mockContext
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.gradeRange).toEqual({ minGrade: 2, maxGrade: 8 });
  });

  it('returns 400 when minGrade > maxGrade', async () => {
    stubCallerSchoolLink();

    const result = await handler(
      makeEvent('PATCH', '/school/config', { gradeRange: { minGrade: 9, maxGrade: 3 } }),
      mockContext
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe('SCHOOL_INVALID_REQUEST');
  });

  it('returns 400 when minGrade is out of 1–10 range', async () => {
    stubCallerSchoolLink();

    const result = await handler(
      makeEvent('PATCH', '/school/config', { gradeRange: { minGrade: 0, maxGrade: 5 } }),
      mockContext
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when maxGrade is out of 1–10 range', async () => {
    stubCallerSchoolLink();

    const result = await handler(
      makeEvent('PATCH', '/school/config', { gradeRange: { minGrade: 1, maxGrade: 11 } }),
      mockContext
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when no fields are provided', async () => {
    stubCallerSchoolLink();

    const result = await handler(
      makeEvent('PATCH', '/school/config', {}),
      mockContext
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe('SCHOOL_INVALID_REQUEST');
  });

  it('returns 400 for an invalid subject in activeSubjects', async () => {
    stubCallerSchoolLink();

    const result = await handler(
      makeEvent('PATCH', '/school/config', { activeSubjects: ['Math', 'Underwater Basket Weaving'] }),
      mockContext
    );

    expect(result.statusCode).toBe(400);
  });

  it('writes SCHOOL_CONFIG_UPDATED audit log on success', async () => {
    stubCallerSchoolLink();

    dynamoMock.on(GetCommand).resolves({
      Item: { PK: `SCHOOL#${SCHOOL_ID}`, SK: 'METADATA', activeSubjects: ['Math'] },
    });
    dynamoMock.on(UpdateCommand).resolves({});

    await handler(
      makeEvent('PATCH', '/school/config', { activeSubjects: ['Math', 'ELA'] }),
      mockContext
    );

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_CONFIG_UPDATED', actorId: SCHOOL_ADMIN_ID })
    );
  });
});

// ─── Unknown route ────────────────────────────────────────────────────────────

describe('unknown route', () => {
  it('returns 404 for an unrecognised path', async () => {
    stubCallerSchoolLink();

    const result = await handler(
      makeEvent('GET', '/school/does-not-exist'),
      mockContext
    );

    expect(result.statusCode).toBe(404);
  });
});
