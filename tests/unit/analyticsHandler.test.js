/**
 * @file tests/unit/analyticsHandler.test.js
 * @description Unit tests for backend/handlers/analyticsHandler.js
 * Auth and DB adapters are mocked; no real I/O or token verification occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_STUDENT_ID   = '11111111-1111-4111-8111-111111111111';
const VALID_TEACHER_ID   = '22222222-2222-4222-8222-222222222222';
const VALID_CLASS_ID     = '33333333-3333-4333-8333-333333333333';
const VALID_WORKSHEET_ID = '55555555-5555-4555-8555-555555555555';

// ─── Mock auth adapter methods ────────────────────────────────────────────────

const mockVerifyToken = jest.fn();

// ─── Mock DB adapter methods ──────────────────────────────────────────────────

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
    getItem:      mockGetItem,
    queryByField: mockQueryByField,
  })),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { handler } = await import('../../backend/handlers/analyticsHandler.js');

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

const classRecord = {
  classId: VALID_CLASS_ID,
  className: 'Grade 3 Math',
  teacherId: VALID_TEACHER_ID,
};

const activeMembership = {
  id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`,
  classId: VALID_CLASS_ID,
  studentId: VALID_STUDENT_ID,
  status: 'active',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('analyticsHandler — OPTIONS preflight', () => {

  it('returns status 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/analytics/class/:id — happy path (teacher) ─────────────────────

describe('analyticsHandler — GET /api/analytics/class/:id happy path', () => {

  const attempts = [
    {
      attemptId:   'aaa',
      studentId:   VALID_STUDENT_ID,
      worksheetId: VALID_WORKSHEET_ID,
      topic:       'Multiplication',
      totalScore:  8,
      totalPoints: 10,
    },
    {
      attemptId:   'bbb',
      studentId:   VALID_STUDENT_ID,
      worksheetId: VALID_WORKSHEET_ID,
      topic:       'Multiplication',
      totalScore:  6,
      totalPoints: 10,
    },
  ];

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(classRecord);
    mockQueryByField.mockImplementation(async (table, field, value) => {
      if (table === 'memberships') return [activeMembership];
      if (table === 'attempts') return attempts;
      return [];
    });
  });

  it('returns status 200 for a valid class ID', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains topicBreakdown array', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.topicBreakdown)).toBe(true);
    expect(body.topicBreakdown).toHaveLength(1);
  });

  it('topicBreakdown entry contains topic, attempts, averageScore, and weakFlag', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    const entry = body.topicBreakdown[0];
    expect(entry).toHaveProperty('topic', 'Multiplication');
    expect(entry).toHaveProperty('attempts', 2);
    expect(entry).toHaveProperty('averageScore');
    expect(typeof entry.weakFlag).toBe('boolean');
  });

  it('calculates averageScore correctly across multiple attempts', async () => {
    // totalScore=8+6=14, totalPoints=10+10=20 → 70%
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.topicBreakdown[0].averageScore).toBe(70);
  });

  it('CORS headers are present on a 200 analytics response', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── weakFlag logic ───────────────────────────────────────────────────────────

describe('analyticsHandler — weakFlag threshold', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(classRecord);
    mockQueryByField.mockImplementation(async (table, field, value) => {
      if (table === 'memberships') return [activeMembership];
      return [];
    });
  });

  it('weakFlag is true when averageScore is below 70', async () => {
    // score=6, points=10 → 60%
    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'memberships') return [activeMembership];
      if (table === 'attempts') return [{
        studentId: VALID_STUDENT_ID,
        topic: 'Division',
        totalScore: 6,
        totalPoints: 10,
      }];
      return [];
    });

    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.topicBreakdown[0].weakFlag).toBe(true);
  });

  it('weakFlag is false when averageScore is exactly 70', async () => {
    // score=7, points=10 → 70%
    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'memberships') return [activeMembership];
      if (table === 'attempts') return [{
        studentId: VALID_STUDENT_ID,
        topic: 'Fractions',
        totalScore: 7,
        totalPoints: 10,
      }];
      return [];
    });

    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.topicBreakdown[0].weakFlag).toBe(false);
  });

  it('weakFlag is false when averageScore is above 70', async () => {
    // score=9, points=10 → 90%
    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'memberships') return [activeMembership];
      if (table === 'attempts') return [{
        studentId: VALID_STUDENT_ID,
        topic: 'Addition',
        totalScore: 9,
        totalPoints: 10,
      }];
      return [];
    });

    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.topicBreakdown[0].weakFlag).toBe(false);
  });

});

// ─── No attempts in class ─────────────────────────────────────────────────────

describe('analyticsHandler — class with no attempts', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(classRecord);
    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'memberships') return [activeMembership];
      if (table === 'attempts') return [];
      return [];
    });
  });

  it('returns status 200 with empty topicBreakdown when no attempts exist', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.topicBreakdown).toEqual([]);
  });

  it('totalAttempts is 0 when no attempts exist', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.totalAttempts).toBe(0);
  });

});

// ─── No students in class ─────────────────────────────────────────────────────

describe('analyticsHandler — class with no students', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockGetItem.mockResolvedValue(classRecord);
    mockQueryByField.mockResolvedValue([]); // no memberships
  });

  it('returns empty topicBreakdown when there are no enrolled students', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'teacher-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.topicBreakdown).toEqual([]);
    expect(body.totalStudents).toBe(0);
  });

});

// ─── Student role blocked ─────────────────────────────────────────────────────

describe('analyticsHandler — student role blocked', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
  });

  it('returns 403 when a student requests class analytics', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'student-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('CORS headers are present on a 403 response', async () => {
    const result = await handler(
      mockGetEvent('/api/analytics/class/33333333', 'student-token', { id: VALID_CLASS_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});
