/**
 * @file tests/unit/rewardsHandler.test.js
 * @description Unit tests for backend/handlers/rewardsHandler.js
 * Auth middleware and DB adapter are mocked; no real I/O or token verification occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── UUID fixtures ────────────────────────────────────────────────────────────

const VALID_STUDENT_ID   = '11111111-1111-4111-8111-111111111111';
const VALID_WORKSHEET_ID = '55555555-5555-4555-8555-555555555555';

// ─── Mock adapter method stubs ────────────────────────────────────────────────

const mockValidateToken = jest.fn();
const mockRequireRole   = jest.fn();

const mockGetItem      = jest.fn();
const mockPutItem      = jest.fn();
const mockQueryByField = jest.fn();

// ─── Mock authMiddleware BEFORE any dynamic import ────────────────────────────

jest.unstable_mockModule('../../backend/middleware/authMiddleware.js', () => ({
  validateToken: mockValidateToken,
  requireRole:   mockRequireRole,
}));

// ─── Mock ../../src/auth/index.js BEFORE any dynamic import ──────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: jest.fn(),
  })),
}));

// ─── Mock ../../src/db/index.js BEFORE any dynamic import ────────────────────

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem:      mockGetItem,
    putItem:      mockPutItem,
    queryByField: mockQueryByField,
  })),
}));

// ─── Dynamic imports (must come AFTER all mockModule calls) ──────────────────

const { handler } = await import('../../backend/handlers/rewardsHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal GET event for the rewards handler.
 */
function mockGetEvent({ path, pathId, token = null }) {
  return {
    httpMethod: 'GET',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    pathParameters: pathId ? { id: pathId } : null,
    body: null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

/** Decoded token for a student accessing their own data. */
const studentDecoded = {
  sub:   VALID_STUDENT_ID,
  email: 'student@test.com',
  role:  'student',
};

/** Decoded token for a teacher. */
const teacherDecoded = {
  sub:   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'teacher@test.com',
  role:  'teacher',
};

/** A minimal but complete reward profile record. */
const sampleProfile = {
  id:             VALID_STUDENT_ID,
  lifetimePoints: 120,
  monthlyPoints:  40,
  currentStreak:  3,
  longestStreak:  5,
  freezeTokens:   1,
  badges:         [{ id: 'first-steps', name: 'First Steps', emoji: '🎯', description: 'Complete your first worksheet', earnedAt: '2026-01-01T00:00:00Z' }],
  topicStats:     { Multiplication: { count: 2, totalScore: 170, avgScore: 85, perfectCount: 0 } },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('rewardsHandler — OPTIONS preflight', () => {

  it('returns status 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/rewards/student/:id — own student data ─────────────────────────

describe('rewardsHandler — GET /api/rewards/student/:id happy path (own data)', () => {

  beforeEach(() => {
    mockValidateToken.mockResolvedValue(studentDecoded);
    mockGetItem.mockResolvedValue(sampleProfile);
  });

  it('returns status 200 for a valid request by the student themselves', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID, token: 'valid-token' }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains lifetimePoints', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID, token: 'valid-token' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('lifetimePoints', 120);
  });

  it('response body contains badges array', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID, token: 'valid-token' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.badges)).toBe(true);
    expect(body.badges).toHaveLength(1);
  });

  it('response body contains currentStreak', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID, token: 'valid-token' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('currentStreak', 3);
  });

  it('CORS headers are present on a 200 response', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID, token: 'valid-token' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

describe('rewardsHandler — GET /api/rewards/student/:id no profile in db', () => {

  beforeEach(() => {
    mockValidateToken.mockResolvedValue(studentDecoded);
    mockGetItem.mockResolvedValue(null);
  });

  it('returns status 200 even when no profile record exists', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID, token: 'valid-token' }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains default empty profile values', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID, token: 'valid-token' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.lifetimePoints).toBe(0);
    expect(body.currentStreak).toBe(0);
    expect(Array.isArray(body.badges)).toBe(true);
    expect(body.badges).toHaveLength(0);
  });

});

describe('rewardsHandler — GET /api/rewards/student/:id unauthorized', () => {

  it('returns 401 when validateToken throws with statusCode 401', async () => {
    const authErr = new Error('Missing or invalid Authorization header.');
    authErr.statusCode = 401;
    mockValidateToken.mockRejectedValue(authErr);

    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('CORS headers are present on a 401 response', async () => {
    const authErr = new Error('Missing or invalid Authorization header.');
    authErr.statusCode = 401;
    mockValidateToken.mockRejectedValue(authErr);

    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${VALID_STUDENT_ID}`, pathId: VALID_STUDENT_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

describe('rewardsHandler — GET /api/rewards/student/:id forbidden (different student)', () => {

  it('returns 403 when authenticated student requests a different student profile', async () => {
    const differentStudentId = '22222222-2222-4222-8222-222222222222';
    // decoded.sub = VALID_STUDENT_ID, but path param = differentStudentId → 403
    mockValidateToken.mockResolvedValue(studentDecoded);

    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${differentStudentId}`, pathId: differentStudentId, token: 'valid-token' }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('CORS headers are present on a 403 response', async () => {
    const differentStudentId = '22222222-2222-4222-8222-222222222222';
    mockValidateToken.mockResolvedValue(studentDecoded);

    const result = await handler(
      mockGetEvent({ path: `/api/rewards/student/${differentStudentId}`, pathId: differentStudentId, token: 'valid-token' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/rewards/class/:id — teacher view ───────────────────────────────

describe('rewardsHandler — GET /api/rewards/class/:id happy path (teacher)', () => {

  const CLASS_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeEach(() => {
    mockValidateToken.mockResolvedValue(teacherDecoded);

    const memberships = [
      { classId: CLASS_ID, studentId: VALID_STUDENT_ID },
    ];
    mockQueryByField.mockImplementation((table, field, value) => {
      if (table === 'memberships') return Promise.resolve(memberships);
      if (table === 'attempts')    return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mockGetItem.mockImplementation((table, id) => {
      if (table === 'rewardProfiles') return Promise.resolve(sampleProfile);
      if (table === 'users')          return Promise.resolve({ displayName: 'Alice' });
      return Promise.resolve(null);
    });
  });

  it('returns status 200 for a teacher requesting class rewards', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/class/${CLASS_ID}`, pathId: CLASS_ID, token: 'teacher-token' }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains classId', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/class/${CLASS_ID}`, pathId: CLASS_ID, token: 'teacher-token' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('classId', CLASS_ID);
  });

  it('response body contains totalStudents', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/class/${CLASS_ID}`, pathId: CLASS_ID, token: 'teacher-token' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('totalStudents', 1);
  });

  it('response body contains studentSummaries array', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/class/${CLASS_ID}`, pathId: CLASS_ID, token: 'teacher-token' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.studentSummaries)).toBe(true);
  });

  it('CORS headers are present on a teacher 200 response', async () => {
    const result = await handler(
      mockGetEvent({ path: `/api/rewards/class/${CLASS_ID}`, pathId: CLASS_ID, token: 'teacher-token' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

describe('rewardsHandler — GET /api/rewards/class/:id forbidden (student role)', () => {

  const CLASS_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('returns 403 when a student attempts to access a class rewards route', async () => {
    // Student decoded has role='student', not 'teacher' → 403
    mockValidateToken.mockResolvedValue(studentDecoded);

    const result = await handler(
      mockGetEvent({ path: `/api/rewards/class/${CLASS_ID}`, pathId: CLASS_ID, token: 'student-token' }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('CORS headers are present on a 403 class route response', async () => {
    mockValidateToken.mockResolvedValue(studentDecoded);

    const result = await handler(
      mockGetEvent({ path: `/api/rewards/class/${CLASS_ID}`, pathId: CLASS_ID, token: 'student-token' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});
