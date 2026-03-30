/**
 * @file tests/unit/studentHandler.test.js
 * @description Unit tests for backend/handlers/studentHandler.js
 * Auth and DB adapters are mocked; no real I/O or token verification occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_STUDENT_ID = '11111111-1111-4111-8111-111111111111';
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

const { handler } = await import('../../backend/handlers/studentHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockGetEvent(path, token = null) {
  return {
    httpMethod: 'GET',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    pathParameters: null,
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

// Decoded payload the verifyToken mock will return for a valid student token
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

describe('studentHandler — OPTIONS preflight', () => {

  it('returns status 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/student/profile — happy path ───────────────────────────────────

describe('studentHandler — GET /api/student/profile happy path', () => {

  const userRecord = {
    userId: VALID_STUDENT_ID,
    email: 'student@test.com',
    role: 'student',
    displayName: 'Test Student',
  };

  const membershipRecords = [
    { id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`, classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID, status: 'active' },
  ];

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    mockGetItem.mockResolvedValue(userRecord);
    mockQueryByField.mockResolvedValue(membershipRecords);
  });

  it('returns status 200 for a valid token', async () => {
    const result = await handler(
      mockGetEvent('/api/student/profile', 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains userId, email, role, and displayName', async () => {
    const result = await handler(
      mockGetEvent('/api/student/profile', 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('userId', VALID_STUDENT_ID);
    expect(body).toHaveProperty('email', 'student@test.com');
    expect(body).toHaveProperty('role', 'student');
    expect(body).toHaveProperty('displayName', 'Test Student');
  });

  it('response body contains classMemberships array', async () => {
    const result = await handler(
      mockGetEvent('/api/student/profile', 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.classMemberships)).toBe(true);
    expect(body.classMemberships).toContain(VALID_CLASS_ID);
  });

  it('CORS headers are present on a 200 profile response', async () => {
    const result = await handler(
      mockGetEvent('/api/student/profile', 'valid-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('filters inactive memberships from profile response', async () => {
    mockQueryByField.mockResolvedValueOnce([
      { id: 'x1', classId: VALID_CLASS_ID, studentId: VALID_STUDENT_ID, status: 'active' },
      { id: 'x2', classId: '44444444-4444-4444-8444-444444444444', studentId: VALID_STUDENT_ID, status: 'removed' },
    ]);

    const result = await handler(
      mockGetEvent('/api/student/profile', 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.classMemberships).toEqual([VALID_CLASS_ID]);
  });

});

// ─── GET /api/student/profile — missing/invalid token ────────────────────────

describe('studentHandler — GET /api/student/profile auth failures', () => {

  it('returns 401 when no Authorization header is provided', async () => {
    const result = await handler(
      mockGetEvent('/api/student/profile'),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('returns 401 when verifyToken throws (invalid token)', async () => {
    mockVerifyToken.mockImplementation(() => { throw new Error('jwt invalid'); });

    const result = await handler(
      mockGetEvent('/api/student/profile', 'bad-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('CORS headers are present on a 401 response', async () => {
    const result = await handler(
      mockGetEvent('/api/student/profile'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/student/join-class — happy path ───────────────────────────────

describe('studentHandler — POST /api/student/join-class happy path', () => {

  const classRecord = {
    classId: VALID_CLASS_ID,
    className: 'Grade 3 Math',
    grade: 3,
    subject: 'Math',
    inviteCode: 'ABC123',
  };

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    mockQueryByField.mockResolvedValue([classRecord]);
    mockGetItem.mockResolvedValue(null); // no existing membership
    mockPutItem.mockResolvedValue({});
  });

  it('returns status 200 for a valid invite code', async () => {
    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ABC123' }, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains classId and className', async () => {
    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ABC123' }, 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('classId', VALID_CLASS_ID);
    expect(body).toHaveProperty('className', 'Grade 3 Math');
  });

  it('calls putItem to create the membership record', async () => {
    await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ABC123' }, 'valid-token'),
      mockContext,
    );
    expect(mockPutItem).toHaveBeenCalledTimes(1);
    expect(mockPutItem).toHaveBeenCalledWith('memberships', expect.objectContaining({
      classId: VALID_CLASS_ID,
      studentId: VALID_STUDENT_ID,
    }));
  });

  it('accepts lowercase inviteCode by normalizing to uppercase', async () => {
    await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'abc123' }, 'valid-token'),
      mockContext,
    );
    expect(mockQueryByField).toHaveBeenCalledWith('classes', 'inviteCode', 'ABC123');
  });

  it('CORS headers are present on a 200 join-class response', async () => {
    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ABC123' }, 'valid-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/student/join-class — error cases ──────────────────────────────

describe('studentHandler — POST /api/student/join-class error cases', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
  });

  it('returns 400 when inviteCode is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/student/join-class', {}, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when no class matches the invite code', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'NOPE99' }, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 for malformed inviteCode format', async () => {
    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ab-12' }, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 500 when duplicate classes share the same invite code', async () => {
    mockQueryByField.mockResolvedValue([
      { classId: VALID_CLASS_ID, className: 'Grade 3 Math', grade: 3, subject: 'Math', inviteCode: 'ABC123' },
      { classId: '44444444-4444-4444-8444-444444444444', className: 'Grade 3 Science', grade: 3, subject: 'Science', inviteCode: 'ABC123' },
    ]);

    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ABC123' }, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(500);
  });

  it('returns 403 when a teacher tries to join a class', async () => {
    mockVerifyToken.mockReturnValue({
      sub: '22222222-2222-4222-8222-222222222222',
      email: 'teacher@test.com',
      role: 'teacher',
    });

    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ABC123' }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('returns 409 when student is already a member of the class', async () => {
    const classRecord = {
      classId: VALID_CLASS_ID,
      className: 'Grade 3 Math',
      grade: 3,
      subject: 'Math',
      inviteCode: 'ABC123',
    };
    const existingMembership = {
      id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`,
      classId: VALID_CLASS_ID,
      studentId: VALID_STUDENT_ID,
    };
    mockQueryByField.mockResolvedValue([classRecord]);
    mockGetItem.mockResolvedValue(existingMembership);

    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'ABC123' }, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
  });

  it('CORS headers are present on error responses', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      mockPostEvent('/api/student/join-class', { inviteCode: 'NOPE99' }, 'valid-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});
