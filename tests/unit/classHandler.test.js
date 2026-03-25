/**
 * @file tests/unit/classHandler.test.js
 * @description Unit tests for backend/handlers/classHandler.js
 * Auth and DB adapters are mocked; no real I/O or token verification occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_TEACHER_ID = '22222222-2222-4222-8222-222222222222';
const VALID_CLASS_ID   = '33333333-3333-4333-8333-333333333333';

// ─── Mock auth adapter methods ────────────────────────────────────────────────

const mockVerifyToken = jest.fn();

// ─── Mock DB adapter methods ──────────────────────────────────────────────────

const mockPutItem      = jest.fn();
const mockGetItem      = jest.fn();
const mockQueryByField = jest.fn();

// ─── Mock ../../src/auth/index.js BEFORE any dynamic import ──────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: mockVerifyToken,
  })),
}));

// ─── Mock ../../src/db/index.js BEFORE any dynamic import ────────────────────

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    putItem:      mockPutItem,
    getItem:      mockGetItem,
    queryByField: mockQueryByField,
  })),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { handler } = await import('../../backend/handlers/classHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockGetEvent(path, token = null, pathParameters = null) {
  return {
    httpMethod: 'GET',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    pathParameters,
    body: null,
  };
}

function mockPostEvent(path, body, token = null) {
  return {
    httpMethod: 'POST',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
    pathParameters: null,
  };
}

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

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('classHandler — OPTIONS preflight', () => {

  it('returns status 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/class/create — happy path (teacher) ───────────────────────────

describe('classHandler — POST /api/class/create happy path', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockPutItem.mockResolvedValue({});
  });

  it('returns status 201 for a valid create request', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', {
        className: 'Grade 3 Math',
        grade: 3,
        subject: 'Math',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(201);
  });

  it('response body contains classId', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', {
        className: 'Grade 3 Math',
        grade: 3,
        subject: 'Math',
      }, 'teacher-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('classId');
    expect(typeof body.classId).toBe('string');
  });

  it('response body contains a 6-character alphanumeric inviteCode', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', {
        className: 'Grade 3 Math',
        grade: 3,
        subject: 'Math',
      }, 'teacher-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('inviteCode');
    expect(body.inviteCode).toMatch(/^[A-Z0-9]{6}$/i);
  });

  it('calls putItem to persist the class record', async () => {
    await handler(
      mockPostEvent('/api/class/create', {
        className: 'Grade 3 Math',
        grade: 3,
        subject: 'Math',
      }, 'teacher-token'),
      mockContext,
    );
    expect(mockPutItem).toHaveBeenCalledTimes(1);
    expect(mockPutItem).toHaveBeenCalledWith('classes', expect.objectContaining({
      teacherId: VALID_TEACHER_ID,
      className: 'Grade 3 Math',
    }));
  });

  it('CORS headers are present on a 201 create response', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', {
        className: 'Grade 3 Math',
        grade: 3,
        subject: 'Math',
      }, 'teacher-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/class/create — student role blocked ───────────────────────────

describe('classHandler — POST /api/class/create student role blocked', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
  });

  it('returns 403 when a student tries to create a class', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', {
        className: 'Grade 3 Math',
        grade: 3,
        subject: 'Math',
      }, 'student-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('CORS headers are present on a 403 response', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', {
        className: 'Grade 3 Math',
        grade: 3,
        subject: 'Math',
      }, 'student-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/class/create — validation errors ──────────────────────────────

describe('classHandler — POST /api/class/create validation errors', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
  });

  it('returns 400 when className is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', { grade: 3, subject: 'Math' }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when grade is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', { className: 'Grade 3 Math', subject: 'Math' }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when subject is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', { className: 'Grade 3 Math', grade: 3 }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers are present on 400 validation responses', async () => {
    const result = await handler(
      mockPostEvent('/api/class/create', {}, 'teacher-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/class/:id/students — happy path (teacher) ──────────────────────

describe('classHandler — GET /api/class/:id/students happy path', () => {

  const classRecord = {
    classId: VALID_CLASS_ID,
    className: 'Grade 3 Math',
    teacherId: VALID_TEACHER_ID,
    grade: 3,
    subject: 'Math',
    inviteCode: 'ABC123',
  };

  const membership = {
    id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`,
    classId: VALID_CLASS_ID,
    studentId: VALID_STUDENT_ID,
    status: 'active',
  };

  const studentRecord = {
    userId: VALID_STUDENT_ID,
    email: 'student@test.com',
    displayName: 'Test Student',
    role: 'student',
  };

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockImplementation(async (table, id) => {
      if (table === 'classes' && id === VALID_CLASS_ID) return classRecord;
      if (table === 'users' && id === VALID_STUDENT_ID) return studentRecord;
      return null;
    });
    mockQueryByField.mockResolvedValue([membership]);
  });

  it('returns status 200 for a valid class ID', async () => {
    const result = await handler(
      mockGetEvent('/api/class/33333333/students', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains classId and students array', async () => {
    const result = await handler(
      mockGetEvent('/api/class/33333333/students', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('classId', VALID_CLASS_ID);
    expect(Array.isArray(body.students)).toBe(true);
    expect(body.students).toHaveLength(1);
    expect(body.students[0]).toHaveProperty('userId', VALID_STUDENT_ID);
  });

  it('CORS headers are present on a 200 students response', async () => {
    const result = await handler(
      mockGetEvent('/api/class/33333333/students', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/class/:id/students — student role blocked ──────────────────────

describe('classHandler — GET /api/class/:id/students student role blocked', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
  });

  it('returns 403 when a student tries to list students', async () => {
    const result = await handler(
      mockGetEvent('/api/class/33333333/students', 'student-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

});

// ─── GET /api/class/:id/students — class not found ───────────────────────────

describe('classHandler — GET /api/class/:id/students class not found', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(null);
  });

  it('returns 404 when the class does not exist', async () => {
    const result = await handler(
      mockGetEvent('/api/class/nonexistent/students', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(404);
  });

  it('CORS headers are present on a 404 response', async () => {
    const result = await handler(
      mockGetEvent('/api/class/nonexistent/students', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});
