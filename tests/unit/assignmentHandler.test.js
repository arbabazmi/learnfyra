/**
 * @file tests/unit/assignmentHandler.test.js
 * @description Unit tests for backend/handlers/assignmentHandler.js
 * Auth, DB adapters, and RBAC utilities are mocked; no real I/O occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_TEACHER_ID  = '22222222-2222-4222-8222-222222222222';
const VALID_STUDENT_ID  = '11111111-1111-4111-8111-111111111111';
const VALID_STUDENT_2   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_CLASS_ID    = '33333333-3333-4333-8333-333333333333';
const VALID_ASSIGN_ID   = '44444444-4444-4444-8444-444444444444';
const VALID_WORKSHEET_ID = '55555555-5555-4555-8555-555555555555';

// ─── Mock function references ─────────────────────────────────────────────────

const mockVerifyToken = jest.fn();
const mockPutItem      = jest.fn();
const mockGetItem      = jest.fn();
const mockQueryByField = jest.fn();
const mockUpdateItem   = jest.fn();
const mockVerifyTeacherOwnsClass = jest.fn();

// ─── Module mocks (must precede dynamic import) ───────────────────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({ verifyToken: mockVerifyToken })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    putItem:      mockPutItem,
    getItem:      mockGetItem,
    queryByField: mockQueryByField,
    updateItem:   mockUpdateItem,
  })),
}));

// Mock src/utils/rbac.js — this is what assignmentHandler.js imports
jest.unstable_mockModule('../../src/utils/rbac.js', () => ({
  verifyTeacherOwnsClass: mockVerifyTeacherOwnsClass,
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { handler } = await import('../../backend/handlers/assignmentHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockContext = { callbackWaitsForEmptyEventLoop: true };

const teacherDecoded = {
  sub: VALID_TEACHER_ID,
  email: 'teacher@test.com',
  role: 'teacher',
};

const studentDecoded = {
  sub: VALID_STUDENT_ID,
  email: 'student@test.com',
  role: 'student',
};

function makeEvent(method, path, body = null, token = null, pathParameters = null) {
  return {
    httpMethod: method,
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body !== null ? JSON.stringify(body) : null,
    pathParameters: pathParameters || {},
  };
}

function classRecord(overrides = {}) {
  return {
    PK: `CLASS#${VALID_CLASS_ID}`,
    classId: VALID_CLASS_ID,
    teacherId: VALID_TEACHER_ID,
    className: 'Grade 3 Math',
    status: 'active',
    studentCount: 2,
    ...overrides,
  };
}

function worksheetRecord(overrides = {}) {
  return {
    worksheetId: VALID_WORKSHEET_ID,
    title: 'Multiplication Basics',
    topic: 'Multiplication',
    grade: 3,
    totalPoints: 10,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('assignmentHandler — OPTIONS preflight', () => {
  it('returns 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('includes CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── POST /api/assignments — create assignment happy path ─────────────────────

describe('assignmentHandler — POST /api/assignments happy path', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockVerifyTeacherOwnsClass.mockResolvedValue(classRecord());
    mockGetItem.mockResolvedValue(worksheetRecord());
    mockQueryByField.mockResolvedValue([
      { id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`, classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID, status: 'active' },
      { id: `${VALID_CLASS_ID}#${VALID_STUDENT_2}`,  classId: VALID_CLASS_ID, studentId: VALID_STUDENT_2,  status: 'active' },
    ]);
    mockPutItem.mockResolvedValue({});
  });

  it('returns 201 for a valid create request', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(201);
  });

  it('response body contains assignmentId, classId, worksheetId, and status', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('assignmentId');
    expect(body).toHaveProperty('classId', VALID_CLASS_ID);
    expect(body).toHaveProperty('worksheetId', VALID_WORKSHEET_ID);
    expect(body).toHaveProperty('status', 'active');
  });

  it('batch-writes StudentAssignmentStatus records for every enrolled student', async () => {
    await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    // One call for the assignment record + 2 for the students
    const studentStatusCalls = mockPutItem.mock.calls.filter(
      call => call[0] === 'studentassignmentstatus',
    );
    expect(studentStatusCalls).toHaveLength(2);
    studentStatusCalls.forEach(call => {
      expect(call[1]).toHaveProperty('status', 'not-started');
    });
  });

  it('does NOT trigger AI generation (no call to anthropic/generator)', async () => {
    // Verifying worksheetId lookup is a getItem, not a generate call
    await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    // getItem is called once for the worksheet lookup — no generate call path exists
    expect(mockGetItem).toHaveBeenCalledWith('worksheets', VALID_WORKSHEET_ID);
  });

  it('returns studentCount in response matching active memberships', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('studentCount', 2);
  });

  it('includes CORS headers on 201 response', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── POST /api/assignments — validation errors ────────────────────────────────

describe('assignmentHandler — POST /api/assignments validation errors', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
  });

  it('returns 400 when classId is missing', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when worksheetId is missing', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when mode is invalid', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'homework',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when retakePolicy is missing', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when retakePolicy is limited but retakeLimit is missing', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'limited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when classId is not a valid UUID', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: 'not-a-uuid',
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('includes CORS headers on 400 responses', async () => {
    const result = await handler(
      makeEvent('POST', '/api/assignments', {}, 'teacher-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── POST /api/assignments — 403 for non-class-owner ─────────────────────────

describe('assignmentHandler — POST /api/assignments RBAC', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
  });

  it('returns 403 when teacher does not own the class', async () => {
    const ownershipErr = new Error('You do not own this class.');
    ownershipErr.statusCode = 403;
    ownershipErr.errorCode = 'NOT_CLASS_OWNER';
    mockVerifyTeacherOwnsClass.mockRejectedValue(ownershipErr);

    const result = await handler(
      makeEvent('POST', '/api/assignments', {
        classId: VALID_CLASS_ID,
        worksheetId: VALID_WORKSHEET_ID,
        mode: 'practice',
        retakePolicy: 'unlimited',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('NOT_CLASS_OWNER');
  });
});

// ─── GET /api/assignments/:assignmentId — happy path ─────────────────────────

describe('assignmentHandler — GET /api/assignments/:assignmentId happy path', () => {
  const assignmentRecord = {
    PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
    assignmentId: VALID_ASSIGN_ID,
    classId: VALID_CLASS_ID,
    teacherId: VALID_TEACHER_ID,
    mode: 'practice',
    status: 'active',
  };

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(assignmentRecord);
  });

  it('returns 200 for a valid assignmentId the teacher owns', async () => {
    const result = await handler(
      makeEvent('GET', `/api/assignments/${VALID_ASSIGN_ID}`, null, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('returns 403 when teacher does not own the assignment', async () => {
    mockGetItem.mockResolvedValue({
      ...assignmentRecord,
      teacherId: '99999999-9999-4999-8999-999999999999',
    });

    const result = await handler(
      makeEvent('GET', `/api/assignments/${VALID_ASSIGN_ID}`, null, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('NOT_CLASS_OWNER');
  });

  it('returns 404 when assignment does not exist', async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await handler(
      makeEvent('GET', `/api/assignments/${VALID_ASSIGN_ID}`, null, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(404);
  });
});

// ─── GET /api/classes/:classId/assignments — sorted by dueDate ───────────────

describe('assignmentHandler — GET /api/classes/:classId/assignments sorted order', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockVerifyTeacherOwnsClass.mockResolvedValue(classRecord());
    // Return two assignments with dueDates out of order
    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'assignments') {
        return [
          { assignmentId: 'bb000000-0000-4000-8000-000000000000', title: 'B', mode: 'test',   dueDate: '2026-06-15T00:00:00Z', status: 'active' },
          { assignmentId: 'aa000000-0000-4000-8000-000000000000', title: 'A', mode: 'practice', dueDate: '2026-05-01T00:00:00Z', status: 'active' },
        ];
      }
      if (table === 'studentassignmentstatus') return [];
      return [];
    });
  });

  it('returns 200 for a class owned by the teacher', async () => {
    const result = await handler(
      makeEvent('GET', `/api/classes/${VALID_CLASS_ID}/assignments`, null, 'teacher-token',
        { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('returns assignments sorted by dueDate ascending', async () => {
    const result = await handler(
      makeEvent('GET', `/api/classes/${VALID_CLASS_ID}/assignments`, null, 'teacher-token',
        { classId: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.assignments)).toBe(true);
    expect(body.assignments).toHaveLength(2);
    // Earlier dueDate must come first
    expect(new Date(body.assignments[0].dueDate).getTime()).toBeLessThan(
      new Date(body.assignments[1].dueDate).getTime(),
    );
  });

  it('returns 403 for a teacher who does not own the class', async () => {
    const ownershipErr = new Error('You do not own this class.');
    ownershipErr.statusCode = 403;
    ownershipErr.errorCode = 'NOT_CLASS_OWNER';
    mockVerifyTeacherOwnsClass.mockRejectedValue(ownershipErr);

    const result = await handler(
      makeEvent('GET', `/api/classes/${VALID_CLASS_ID}/assignments`, null, 'teacher-token',
        { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── PATCH /api/assignments/:assignmentId — 409 if openAt has passed ─────────

describe('assignmentHandler — PATCH /api/assignments/:assignmentId', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
  });

  it('returns 409 ASSIGNMENT_ALREADY_OPEN when openAt is in the past', async () => {
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
      assignmentId: VALID_ASSIGN_ID,
      teacherId: VALID_TEACHER_ID,
      openAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      status: 'active',
    });

    const result = await handler(
      makeEvent('PATCH', `/api/assignments/${VALID_ASSIGN_ID}`,
        { dueDate: '2026-12-01T00:00:00Z' }, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('ASSIGNMENT_ALREADY_OPEN');
  });

  it('returns 200 when openAt is in the future', async () => {
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
      assignmentId: VALID_ASSIGN_ID,
      teacherId: VALID_TEACHER_ID,
      openAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      status: 'active',
    });
    mockUpdateItem.mockResolvedValue({});

    const result = await handler(
      makeEvent('PATCH', `/api/assignments/${VALID_ASSIGN_ID}`,
        { dueDate: '2026-12-01T00:00:00Z' }, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('returns 403 when teacher does not own the assignment', async () => {
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
      assignmentId: VALID_ASSIGN_ID,
      teacherId: '99999999-9999-4999-8999-999999999999',
      openAt: null,
      status: 'active',
    });

    const result = await handler(
      makeEvent('PATCH', `/api/assignments/${VALID_ASSIGN_ID}`,
        { dueDate: '2026-12-01T00:00:00Z' }, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── DELETE /api/assignments/:assignmentId/close ──────────────────────────────

describe('assignmentHandler — DELETE /api/assignments/:assignmentId/close', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
  });

  it('returns 200 and marks unsubmitted students as overdue', async () => {
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
      assignmentId: VALID_ASSIGN_ID,
      teacherId: VALID_TEACHER_ID,
      status: 'active',
    });
    mockUpdateItem.mockResolvedValue({});
    mockQueryByField.mockResolvedValue([
      { PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`, studentId: VALID_STUDENT_ID, assignmentId: VALID_ASSIGN_ID, status: 'not-started' },
      { PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`, studentId: VALID_STUDENT_2,  assignmentId: VALID_ASSIGN_ID, status: 'in-progress' },
    ]);

    const result = await handler(
      makeEvent('DELETE', `/api/assignments/${VALID_ASSIGN_ID}/close`, null, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('status', 'closed');
    expect(body).toHaveProperty('studentsMarkedOverdue', 2);
  });

  it('does not mark submitted students as overdue', async () => {
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
      assignmentId: VALID_ASSIGN_ID,
      teacherId: VALID_TEACHER_ID,
      status: 'active',
    });
    mockUpdateItem.mockResolvedValue({});
    mockQueryByField.mockResolvedValue([
      { PK: 'A1', studentId: VALID_STUDENT_ID, assignmentId: VALID_ASSIGN_ID, status: 'submitted' },
      { PK: 'A2', studentId: VALID_STUDENT_2,  assignmentId: VALID_ASSIGN_ID, status: 'not-started' },
    ]);

    const result = await handler(
      makeEvent('DELETE', `/api/assignments/${VALID_ASSIGN_ID}/close`, null, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.studentsMarkedOverdue).toBe(1);
  });

  it('returns 409 ASSIGNMENT_ALREADY_CLOSED when assignment is already closed', async () => {
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
      assignmentId: VALID_ASSIGN_ID,
      teacherId: VALID_TEACHER_ID,
      status: 'closed',
    });

    const result = await handler(
      makeEvent('DELETE', `/api/assignments/${VALID_ASSIGN_ID}/close`, null, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('ASSIGNMENT_ALREADY_CLOSED');
  });

  it('returns 403 when teacher does not own the assignment', async () => {
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`,
      assignmentId: VALID_ASSIGN_ID,
      teacherId: '99999999-9999-4999-8999-999999999999',
      status: 'active',
    });

    const result = await handler(
      makeEvent('DELETE', `/api/assignments/${VALID_ASSIGN_ID}/close`, null, 'teacher-token',
        { assignmentId: VALID_ASSIGN_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});
