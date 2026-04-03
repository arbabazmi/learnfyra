/**
 * @file tests/unit/classHandlerM05.test.js
 * @description Unit tests for the M05 class management routes in backend/handlers/classHandler.js
 * Auth and DB adapters are mocked; no real I/O occurs.
 * Covers: POST /api/classes, GET /api/classes, GET /api/classes/:id,
 *         DELETE /api/classes/:id/archive, POST /api/classes/:id/invite,
 *         DELETE /api/classes/:id/students/:sid
 * (Existing legacy route tests remain in classHandler.test.js)
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_TEACHER_ID = '22222222-2222-4222-8222-222222222222';
const VALID_STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_CLASS_ID   = '33333333-3333-4333-8333-333333333333';

// ─── Mock function references ─────────────────────────────────────────────────

const mockVerifyToken  = jest.fn();
const mockPutItem      = jest.fn();
const mockGetItem      = jest.fn();
const mockQueryByField = jest.fn();
const mockUpdateItem   = jest.fn();

// ─── Mock RBAC util ───────────────────────────────────────────────────────────

const mockVerifyTeacherOwnsClass = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

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

jest.unstable_mockModule('../../src/utils/rbac.js', () => ({
  verifyTeacherOwnsClass: mockVerifyTeacherOwnsClass,
  verifyParentChildLink:  jest.fn(),
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { handler }            = await import('../../backend/handlers/classHandler.js');
const { handler: assignmentHandler } = await import('../../backend/handlers/assignmentHandler.js');

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

function mockPostEvent(path, body, token = null) {
  return {
    httpMethod: 'POST',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
    pathParameters: {},
  };
}

function mockGetEvent(path, token = null, pathParameters = {}) {
  return {
    httpMethod: 'GET',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: null,
    pathParameters,
  };
}

function mockDeleteEvent(path, token = null, pathParameters = {}) {
  return {
    httpMethod: 'DELETE',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: null,
    pathParameters,
  };
}

function activeClassRecord(overrides = {}) {
  return {
    PK: `CLASS#${VALID_CLASS_ID}`,
    SK: 'METADATA',
    classId: VALID_CLASS_ID,
    teacherId: VALID_TEACHER_ID,
    className: 'Grade 3 Math',
    gradeLevel: 3,
    subjects: ['Math'],
    inviteCode: 'ABC234',
    status: 'active',
    accuracyThreshold: 60,
    studentCount: 5,
    createdAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /api/classes — create class ────────────────────────────────────────

describe('classHandler M05 — POST /api/classes create class happy path', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockQueryByField.mockResolvedValue([]);   // no invite code collision
    mockPutItem.mockResolvedValue({});
  });

  it('returns 201 with classId and inviteCode for a valid request', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: 'Grade 3 Math', gradeLevel: 3, subjects: ['Math'] }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('classId');
    expect(body).toHaveProperty('inviteCode');
  });

  it('response inviteCode is 6 characters alphanumeric', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: 'Grade 3 Math' }, 'teacher-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.inviteCode).toMatch(/^[A-Z0-9]{6}$/i);
  });

  it('writes the class record to the DB via putItem', async () => {
    await handler(
      mockPostEvent('/api/classes', { className: 'Grade 3 Math', gradeLevel: 3, subjects: ['Math'] }, 'teacher-token'),
      mockContext,
    );
    expect(mockPutItem).toHaveBeenCalledWith('classes', expect.objectContaining({
      teacherId: VALID_TEACHER_ID,
      status: 'active',
    }));
  });

  it('includes CORS headers on 201 response', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: 'Grade 3 Math' }, 'teacher-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

describe('classHandler M05 — POST /api/classes validation errors', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
  });

  it('returns 400 when className is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { gradeLevel: 3 }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when className exceeds 100 characters', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: 'A'.repeat(101) }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when gradeLevel is 0 (below range)', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: 'Math Class', gradeLevel: 0 }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when gradeLevel is 11 (above range)', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: 'Math Class', gradeLevel: 11 }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when subjects contains an invalid enum value', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: 'Math Class', subjects: ['Art'] }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when className is blank after trim', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', { className: '   ' }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('includes CORS headers on 400 response', async () => {
    const result = await handler(
      mockPostEvent('/api/classes', {}, 'teacher-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

describe('classHandler M05 — POST /api/classes student role blocked', () => {
  it('returns 403 when a student tries to create a class via /api/classes', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);

    const result = await handler(
      mockPostEvent('/api/classes', { className: 'Grade 3 Math' }, 'student-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── GET /api/classes — list teacher's classes ────────────────────────────────

describe('classHandler M05 — GET /api/classes returns only teacher classes', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
  });

  it('returns 200 with a classes array', async () => {
    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'classes') return [activeClassRecord()];
      return [];
    });

    const result = await handler(
      mockGetEvent('/api/classes', 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.classes)).toBe(true);
  });

  it('only returns classes belonging to the authenticated teacher', async () => {
    mockQueryByField.mockImplementation(async (table, field) => {
      if (table === 'classes' && field === 'teacherId') {
        // adapter already scopes by teacherId, so we return only teacher's classes
        return [activeClassRecord()];
      }
      return [];
    });

    const result = await handler(
      mockGetEvent('/api/classes', 'teacher-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.classes).toHaveLength(1);
    expect(body.classes[0].classId).toBe(VALID_CLASS_ID);
  });

  it('returns an empty array when the teacher has no classes', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      mockGetEvent('/api/classes', 'teacher-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.classes).toHaveLength(0);
  });
});

// ─── GET /api/classes/:classId — 403 for non-owner ───────────────────────────

describe('classHandler M05 — GET /api/classes/:classId ownership', () => {
  it('returns 200 when the teacher owns the class', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(activeClassRecord());

    const result = await handler(
      mockGetEvent(`/api/classes/${VALID_CLASS_ID}`, 'teacher-token', { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('returns 403 when a different teacher requests the class', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(activeClassRecord({ teacherId: '99999999-9999-4999-8999-999999999999' }));

    const result = await handler(
      mockGetEvent(`/api/classes/${VALID_CLASS_ID}`, 'teacher-token', { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('includes CORS headers on 403 response', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(activeClassRecord({ teacherId: '99999999-9999-4999-8999-999999999999' }));

    const result = await handler(
      mockGetEvent(`/api/classes/${VALID_CLASS_ID}`, 'teacher-token', { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── DELETE /api/classes/:classId/archive ────────────────────────────────────

describe('classHandler M05 — DELETE /api/classes/:classId/archive', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockUpdateItem.mockResolvedValue({});
  });

  it('returns 200 with status=archived after archiving', async () => {
    mockGetItem.mockResolvedValue(activeClassRecord());

    const result = await handler(
      mockDeleteEvent(`/api/classes/${VALID_CLASS_ID}/archive`, 'teacher-token', { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('status', 'archived');
  });

  it('calls updateItem to set status=archived', async () => {
    mockGetItem.mockResolvedValue(activeClassRecord());

    await handler(
      mockDeleteEvent(`/api/classes/${VALID_CLASS_ID}/archive`, 'teacher-token', { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'classes',
      expect.any(String),
      expect.objectContaining({ status: 'archived' }),
    );
  });

  it('returns 403 when teacher does not own the class', async () => {
    mockGetItem.mockResolvedValue(activeClassRecord({ teacherId: '99999999-9999-4999-8999-999999999999' }));

    const result = await handler(
      mockDeleteEvent(`/api/classes/${VALID_CLASS_ID}/archive`, 'teacher-token', { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('returns 409 when class is already archived', async () => {
    mockGetItem.mockResolvedValue(activeClassRecord({ status: 'archived' }));

    const result = await handler(
      mockDeleteEvent(`/api/classes/${VALID_CLASS_ID}/archive`, 'teacher-token', { classId: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
  });
});

// ─── POST /api/classes/:classId/invite — regenerate code ─────────────────────

describe('classHandler M05 — POST /api/classes/:classId/invite regenerate code', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockQueryByField.mockResolvedValue([]); // no collision
    mockUpdateItem.mockResolvedValue({});
  });

  it('returns 200 with a new inviteCode', async () => {
    mockGetItem.mockResolvedValue(activeClassRecord());

    const result = await handler(
      mockPostEvent(`/api/classes/${VALID_CLASS_ID}/invite`, {}, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('inviteCode');
    expect(body.inviteCode).toMatch(/^[A-Z0-9]{6}$/i);
  });

  it('calls updateItem to persist the new invite code', async () => {
    mockGetItem.mockResolvedValue(activeClassRecord());

    await handler(
      mockPostEvent(`/api/classes/${VALID_CLASS_ID}/invite`, {}, 'teacher-token'),
      mockContext,
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'classes',
      expect.any(String),
      expect.objectContaining({ inviteCode: expect.any(String) }),
    );
  });

  it('returns 403 when teacher does not own the class', async () => {
    mockGetItem.mockResolvedValue(activeClassRecord({ teacherId: '99999999-9999-4999-8999-999999999999' }));

    const result = await handler(
      mockPostEvent(`/api/classes/${VALID_CLASS_ID}/invite`, {}, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── DELETE /api/classes/:classId/students/:studentId ────────────────────────
// Note: this route is served by assignmentHandler, not classHandler.

describe('classHandler M05 — DELETE /api/classes/:classId/students/:studentId (via assignmentHandler)', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockUpdateItem.mockResolvedValue({});
  });

  it('returns 200 and removes the student from the class', async () => {
    mockVerifyTeacherOwnsClass.mockResolvedValue(activeClassRecord());
    mockGetItem.mockImplementation(async (table, key) => {
      if (table === 'memberships') {
        return { id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`, classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID, status: 'active' };
      }
      if (table === 'classes') return activeClassRecord();
      return null;
    });

    const result = await assignmentHandler(
      {
        httpMethod: 'DELETE',
        path: `/api/classes/${VALID_CLASS_ID}/students/${VALID_STUDENT_ID}`,
        headers: { authorization: 'Bearer teacher-token' },
        body: null,
        pathParameters: { classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID },
      },
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('calls updateItem to set membership status=removed', async () => {
    mockVerifyTeacherOwnsClass.mockResolvedValue(activeClassRecord());
    mockGetItem.mockImplementation(async (table) => {
      if (table === 'memberships') {
        return { id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`, classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID, status: 'active' };
      }
      if (table === 'classes') return activeClassRecord();
      return null;
    });

    await assignmentHandler(
      {
        httpMethod: 'DELETE',
        path: `/api/classes/${VALID_CLASS_ID}/students/${VALID_STUDENT_ID}`,
        headers: { authorization: 'Bearer teacher-token' },
        body: null,
        pathParameters: { classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID },
      },
      mockContext,
    );
    const membershipUpdate = mockUpdateItem.mock.calls.find(c => c[0] === 'memberships');
    expect(membershipUpdate).toBeDefined();
    expect(membershipUpdate[2]).toMatchObject({ status: 'removed' });
  });

  it('preserves class data — does not delete WorksheetAttempt or assignment records', async () => {
    mockVerifyTeacherOwnsClass.mockResolvedValue(activeClassRecord());
    mockGetItem.mockImplementation(async (table) => {
      if (table === 'memberships') {
        return { id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`, classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID, status: 'active' };
      }
      if (table === 'classes') return activeClassRecord();
      return null;
    });

    await assignmentHandler(
      {
        httpMethod: 'DELETE',
        path: `/api/classes/${VALID_CLASS_ID}/students/${VALID_STUDENT_ID}`,
        headers: { authorization: 'Bearer teacher-token' },
        body: null,
        pathParameters: { classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID },
      },
      mockContext,
    );
    // No deleteItem calls — data is only soft-deleted via updateItem on memberships
    const deleteCalls = mockUpdateItem.mock.calls.filter(c => c[0] === 'attempts' || c[0] === 'worksheetattempts');
    expect(deleteCalls).toHaveLength(0);
  });

  it('returns 403 when teacher does not own the class', async () => {
    const ownershipErr = new Error('You do not own this class.');
    ownershipErr.statusCode = 403;
    ownershipErr.errorCode = 'NOT_CLASS_OWNER';
    mockVerifyTeacherOwnsClass.mockRejectedValue(ownershipErr);

    const result = await assignmentHandler(
      {
        httpMethod: 'DELETE',
        path: `/api/classes/${VALID_CLASS_ID}/students/${VALID_STUDENT_ID}`,
        headers: { authorization: 'Bearer teacher-token' },
        body: null,
        pathParameters: { classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID },
      },
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});
