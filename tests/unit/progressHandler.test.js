/**
 * @file tests/unit/progressHandler.test.js
 * @description Unit tests for backend/handlers/progressHandler.js
 * Auth and DB adapters are mocked; no real I/O or token verification occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_STUDENT_ID   = '11111111-1111-4111-8111-111111111111';
const VALID_WORKSHEET_ID = '55555555-5555-4555-8555-555555555555';
const VALID_ATTEMPT_ID   = '44444444-4444-4444-8444-444444444444';

// ─── Mock auth adapter methods ────────────────────────────────────────────────

const mockVerifyToken = jest.fn();

// ─── Mock DB adapter methods ──────────────────────────────────────────────────

const mockPutItem      = jest.fn();
const mockGetItem      = jest.fn();
const mockQueryByField = jest.fn();
const mockUpdateItem   = jest.fn();

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
    updateItem:   mockUpdateItem,
  })),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { handler } = await import('../../backend/handlers/progressHandler.js');

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

const studentDecoded = {
  sub: VALID_STUDENT_ID,
  email: 'student@test.com',
  role: 'student',
};

// A complete valid attempt body matching progressHandler required fields
const validAttemptBody = {
  worksheetId: VALID_WORKSHEET_ID,
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  difficulty: 'Medium',
  totalScore: 8,
  totalPoints: 10,
  percentage: 80,
  answers: [{ number: 1, answer: 'B' }],
  timeTaken: 300,
  timed: false,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('progressHandler — OPTIONS preflight', () => {

  it('returns status 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/progress/save — happy path ────────────────────────────────────

describe('progressHandler — POST /api/progress/save happy path', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    mockPutItem.mockResolvedValue({});
    mockGetItem.mockResolvedValue(null); // no existing aggregate or reward profile
    mockUpdateItem.mockResolvedValue({});
    // progressHandler now queries previous attempts before saving; return empty array
    mockQueryByField.mockResolvedValue([]);
  });

  it('returns status 201 for a valid attempt', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', validAttemptBody, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(201);
  });

  it('response body contains an attemptId', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', validAttemptBody, 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('attemptId');
    expect(typeof body.attemptId).toBe('string');
  });

  it('calls putItem to persist the attempt record', async () => {
    await handler(
      mockPostEvent('/api/progress/save', validAttemptBody, 'valid-token'),
      mockContext,
    );
    expect(mockPutItem).toHaveBeenCalledWith('attempts', expect.objectContaining({
      studentId:   VALID_STUDENT_ID,
      worksheetId: VALID_WORKSHEET_ID,
      subject:     'Math',
      topic:       'Multiplication',
    }));
  });

  it('creates a new aggregate when none exists yet', async () => {
    mockGetItem.mockResolvedValue(null);

    await handler(
      mockPostEvent('/api/progress/save', validAttemptBody, 'valid-token'),
      mockContext,
    );

    // putItem must have been called for the aggregate (rewardsEngine may add extra calls)
    expect(mockPutItem).toHaveBeenCalledWith('aggregates', expect.objectContaining({
      studentId: VALID_STUDENT_ID,
      subject:   'Math',
    }));
  });

  it('updates the existing aggregate when one exists', async () => {
    const existingAggregate = {
      id: `${VALID_STUDENT_ID}#Math`,
      studentId: VALID_STUDENT_ID,
      subject: 'Math',
      attemptCount: 2,
      totalScore: 14,
      totalPoints: 20,
      averagePercentage: 70,
    };
    // rewardsEngine calls getItem('rewardProfiles', ...) → null
    // progressHandler calls getItem('aggregates', ...) → existing record
    mockGetItem.mockImplementation((table) =>
      table === 'aggregates' ? Promise.resolve(existingAggregate) : Promise.resolve(null)
    );

    await handler(
      mockPostEvent('/api/progress/save', validAttemptBody, 'valid-token'),
      mockContext,
    );
    expect(mockUpdateItem).toHaveBeenCalledTimes(1);
  });

  it('CORS headers are present on a 201 response', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', validAttemptBody, 'valid-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/progress/save — validation errors ─────────────────────────────

describe('progressHandler — POST /api/progress/save validation errors', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
  });

  it('returns 400 when worksheetId is missing', async () => {
    const { worksheetId: _omit, ...bodyWithout } = validAttemptBody;
    const result = await handler(
      mockPostEvent('/api/progress/save', bodyWithout, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when answers is not an array', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', { ...validAttemptBody, answers: 'nope' }, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('error body mentions "answers" when answers is invalid', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', { ...validAttemptBody, answers: null }, 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/answers/i);
  });

  it('returns 400 when totalScore is missing', async () => {
    const { totalScore: _omit, ...bodyWithout } = validAttemptBody;
    const result = await handler(
      mockPostEvent('/api/progress/save', bodyWithout, 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers are present on 400 responses', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', {}, 'valid-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/progress/save — missing auth ──────────────────────────────────

describe('progressHandler — POST /api/progress/save missing auth', () => {

  it('returns 401 when no Authorization header is provided', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', validAttemptBody),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('CORS headers are present on a 401 save response', async () => {
    const result = await handler(
      mockPostEvent('/api/progress/save', validAttemptBody),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/progress/history — happy path ──────────────────────────────────

describe('progressHandler — GET /api/progress/history happy path', () => {

  const attempt1 = {
    attemptId:   VALID_ATTEMPT_ID,
    worksheetId: VALID_WORKSHEET_ID,
    studentId:   VALID_STUDENT_ID,
    grade:       3,
    subject:     'Math',
    topic:       'Multiplication',
    difficulty:  'Medium',
    totalScore:  8,
    totalPoints: 10,
    percentage:  80,
    timeTaken:   300,
    timed:       false,
    createdAt:   '2026-03-25T10:00:00.000Z',
  };

  const attempt2 = {
    attemptId:   '66666666-6666-4666-8666-666666666666',
    worksheetId: '77777777-7777-4777-8777-777777777777',
    studentId:   VALID_STUDENT_ID,
    grade:       3,
    subject:     'Math',
    topic:       'Division',
    difficulty:  'Easy',
    totalScore:  10,
    totalPoints: 10,
    percentage:  100,
    timeTaken:   200,
    timed:       true,
    createdAt:   '2026-03-24T09:00:00.000Z',
  };

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    // Return older attempt first to verify sorting
    mockQueryByField.mockResolvedValue([attempt2, attempt1]);
  });

  it('returns status 200', async () => {
    const result = await handler(
      mockGetEvent('/api/progress/history', 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains attempts array', async () => {
    const result = await handler(
      mockGetEvent('/api/progress/history', 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.attempts)).toBe(true);
    expect(body.attempts).toHaveLength(2);
  });

  it('attempts are sorted by createdAt descending (newest first)', async () => {
    const result = await handler(
      mockGetEvent('/api/progress/history', 'valid-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.attempts[0].attemptId).toBe(VALID_ATTEMPT_ID); // 2026-03-25 is newer
    expect(body.attempts[1].topic).toBe('Division');
  });

  it('CORS headers are present on a 200 history response', async () => {
    const result = await handler(
      mockGetEvent('/api/progress/history', 'valid-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/progress/history — no attempts ────────────────────────────────

describe('progressHandler — GET /api/progress/history no attempts', () => {

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    mockQueryByField.mockResolvedValue([]);
  });

  it('returns status 200 with empty attempts array when student has no history', async () => {
    const result = await handler(
      mockGetEvent('/api/progress/history', 'valid-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.attempts).toEqual([]);
  });

});

// ─── GET /api/progress/history — missing auth ────────────────────────────────

describe('progressHandler — GET /api/progress/history missing auth', () => {

  it('returns 401 when no Authorization header is provided', async () => {
    const result = await handler(
      mockGetEvent('/api/progress/history'),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('CORS headers are present on a 401 history response', async () => {
    const result = await handler(
      mockGetEvent('/api/progress/history'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});
