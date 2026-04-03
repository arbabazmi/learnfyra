/**
 * @file tests/unit/dashboardHandler.test.js
 * @description Unit tests for backend/handlers/dashboardHandler.js
 * Auth middleware and DB adapter are mocked to avoid real I/O or network calls.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDENT_ID = '33333333-3333-4333-8333-333333333333';
const STUDENT_EMAIL = 'student@test.com';

// ─── Mock DB adapter methods ──────────────────────────────────────────────────

const mockQueryByField = jest.fn();
const mockListAll      = jest.fn();
const mockGetItem      = jest.fn();

// ─── Mock authMiddleware BEFORE any dynamic import ────────────────────────────

jest.unstable_mockModule('../../backend/middleware/authMiddleware.js', () => ({
  validateToken: jest.fn(),
}));

// ─── Mock src/db/index.js BEFORE any dynamic import ──────────────────────────

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    queryByField: mockQueryByField,
    listAll:      mockListAll,
    getItem:      mockGetItem,
  })),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { handler }        = await import('../../backend/handlers/dashboardHandler.js');
const { validateToken }  = await import('../../backend/middleware/authMiddleware.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockGetEvent(path) {
  return {
    httpMethod: 'GET',
    path,
    headers: { Authorization: 'Bearer mock-jwt' },
    body: null,
    pathParameters: null,
    queryStringParameters: null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ATTEMPTS = [
  {
    attemptId:  'a1',
    worksheetId: 'w1',
    studentId:  STUDENT_ID,
    subject:    'Math',
    grade:      7,
    percentage: 90,
    timeTaken:  1200,
    topic:      'Algebra',
    createdAt:  '2026-03-30T10:00:00Z',
    totalPoints: 10,
  },
  {
    attemptId:  'a2',
    worksheetId: 'w2',
    studentId:  STUDENT_ID,
    subject:    'Science',
    grade:      7,
    percentage: 80,
    timeTaken:  900,
    topic:      'Biology',
    createdAt:  '2026-03-29T10:00:00Z',
    totalPoints: 10,
  },
  {
    attemptId:  'a3',
    worksheetId: 'w3',
    studentId:  STUDENT_ID,
    subject:    'Math',
    grade:      7,
    percentage: null,
    timeTaken:  600,
    topic:      'Geometry',
    createdAt:  '2026-03-28T10:00:00Z',
    totalPoints: 10,
  },
];

const MOCK_WORKSHEETS = [
  {
    worksheetId: 'w1',
    slug: 'algebra-grade7',
    title: 'Algebra',
    subject: 'Math',
    grade: 7,
    topic: 'Algebra',
    difficulty: 'Medium',
    totalPoints: 10,
    createdBy: STUDENT_ID,
    createdAt: '2026-03-30T10:00:00Z',
  },
  {
    worksheetId: 'w2',
    slug: 'biology-grade7',
    title: 'Biology',
    subject: 'Science',
    grade: 7,
    topic: 'Biology',
    difficulty: 'Easy',
    totalPoints: 10,
    createdBy: STUDENT_ID,
    createdAt: '2026-03-29T10:00:00Z',
  },
  {
    worksheetId: 'w3',
    slug: 'geometry-grade7',
    title: 'Geometry',
    subject: 'Math',
    grade: 7,
    topic: 'Geometry',
    difficulty: 'Hard',
    totalPoints: 10,
    createdBy: STUDENT_ID,
    createdAt: '2026-03-28T10:00:00Z',
  },
];

const MOCK_AGGREGATES = [
  { id: `${STUDENT_ID}#Math`,    averagePercentage: 85 },
  { id: `${STUDENT_ID}#Science`, averagePercentage: 80 },
];

/**
 * Helper: makes mockQueryByField return different data based on the table name.
 * 'worksheets' → MOCK_WORKSHEETS, 'attempts' → MOCK_ATTEMPTS (default)
 */
function setupQueryByFieldMock(worksheets = MOCK_WORKSHEETS, attempts = MOCK_ATTEMPTS) {
  mockQueryByField.mockImplementation((table) => {
    if (table === 'worksheets') return Promise.resolve(worksheets);
    if (table === 'attempts') return Promise.resolve(attempts);
    return Promise.resolve([]);
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: token validates successfully
  validateToken.mockResolvedValue({ sub: STUDENT_ID, email: STUDENT_EMAIL, role: 'student' });
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('dashboardHandler — OPTIONS preflight', () => {

  it('returns 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('does not call validateToken for OPTIONS request', async () => {
    await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(validateToken).not.toHaveBeenCalled();
  });

});

// ─── Lambda context guard ─────────────────────────────────────────────────────

describe('dashboardHandler — Lambda context guard', () => {

  it('sets context.callbackWaitsForEmptyEventLoop to false on every invocation', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler({ httpMethod: 'OPTIONS' }, ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

});

// ─── Unknown route ────────────────────────────────────────────────────────────

describe('dashboardHandler — unknown route', () => {

  it('returns 404 for an unrecognised dashboard path', async () => {
    mockListAll.mockResolvedValue([]);
    const result = await handler(mockGetEvent('/api/dashboard/nonexistent'), mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('returns CORS headers on 404 response', async () => {
    mockListAll.mockResolvedValue([]);
    const result = await handler(mockGetEvent('/api/dashboard/nonexistent'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/dashboard/stats — happy path ────────────────────────────────────

describe('dashboardHandler — GET /api/dashboard/stats happy path', () => {

  beforeEach(() => {
    setupQueryByFieldMock();
  });

  it('returns 200 with valid token and attempts', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on 200 stats response', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns correct worksheetsDone count (attempts with percentage)', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    // MOCK_ATTEMPTS has 2 completed (percentage non-null) and 1 in-progress
    expect(body.worksheetsDone).toBe(2);
  });

  it('returns correct inProgress count (attempts with null percentage)', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.inProgress).toBe(1);
  });

  it('calculates bestScore as the highest completed percentage', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    // Completed percentages are 90 and 80 — best is 90
    expect(body.bestScore).toBe(90);
  });

  it('calculates studyTime in hours and minutes when total >= 1 hour', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    // 1200 + 900 + 600 = 2700 seconds = 45 minutes → "45m"
    // All three attempts: 2700s = 0h 45m → "45m"
    expect(body.studyTime).toBe('45m');
  });

  it('formats studyTime as hours+minutes when total >= 3600 seconds', async () => {
    // 2 attempts of 1800s each = 3600s = 1h 0m
    mockQueryByField.mockResolvedValue([
      { ...MOCK_ATTEMPTS[0], timeTaken: 1800 },
      { ...MOCK_ATTEMPTS[1], timeTaken: 1800 },
    ]);
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.studyTime).toBe('1h 0m');
  });

  it('queries the attempts table by studentId', async () => {
    await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(mockQueryByField).toHaveBeenCalledWith('attempts', 'studentId', STUDENT_ID);
  });

});

// ─── GET /api/dashboard/stats — zero attempts ─────────────────────────────────

describe('dashboardHandler — GET /api/dashboard/stats no attempts', () => {

  beforeEach(() => {
    setupQueryByFieldMock([], []);
  });

  it('returns 200 when no attempts exist', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns all-zero stats when no attempts exist', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      worksheetsDone: 0,
      inProgress:     0,
      bestScore:      0,
    });
  });

  it('returns all-zero stats when queryByField returns null', async () => {
    setupQueryByFieldMock([], null);
    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      worksheetsDone: 0,
      inProgress:     0,
      bestScore:      0,
    });
  });

});

// ─── GET /api/dashboard/stats — auth failure ──────────────────────────────────

describe('dashboardHandler — GET /api/dashboard/stats auth failure', () => {

  it('returns 401 when validateToken throws with statusCode 401', async () => {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    validateToken.mockRejectedValue(err);

    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(result.statusCode).toBe(401);
  });

  it('returns CORS headers on 401 response', async () => {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    validateToken.mockRejectedValue(err);

    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('error body contains an error field on 401', async () => {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    validateToken.mockRejectedValue(err);

    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error');
  });

});

// ─── GET /api/dashboard/recent-worksheets — happy path ───────────────────────

describe('dashboardHandler — GET /api/dashboard/recent-worksheets happy path', () => {

  beforeEach(() => {
    setupQueryByFieldMock();
  });

  it('returns 200 with valid attempts', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on 200 recent-worksheets response', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns at most 4 worksheets even when more worksheets exist', async () => {
    const manyWorksheets = Array.from({ length: 6 }, (_, i) => ({
      worksheetId: `w${i}`,
      slug: `topic-${i}`,
      title: `Topic ${i}`,
      subject: 'Math',
      grade: 5,
      topic: `Topic ${i}`,
      totalPoints: 10,
      createdBy: STUDENT_ID,
      createdAt: `2026-03-${20 + i}T10:00:00Z`,
    }));
    const manyAttempts = Array.from({ length: 6 }, (_, i) => ({
      attemptId:  `a${i}`,
      worksheetId: `w${i}`,
      studentId:  STUDENT_ID,
      subject:    'Math',
      grade:      5,
      percentage: 70,
      timeTaken:  600,
      topic:      `Topic ${i}`,
      createdAt:  `2026-03-${20 + i}T10:00:00Z`,
      totalPoints: 10,
    }));
    setupQueryByFieldMock(manyWorksheets, manyAttempts);

    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.length).toBe(4);
  });

  it('returns results sorted by most recent first', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    // MOCK_WORKSHEETS sorted: w1/algebra (Mar 30), w2/biology (Mar 29), w3/geometry (Mar 28)
    expect(body[0].id).toBe('algebra-grade7');
    expect(body[1].id).toBe('biology-grade7');
    expect(body[2].id).toBe('geometry-grade7');
  });

  it('maps slug to id field', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    expect(body[0]).toHaveProperty('id', 'algebra-grade7');
  });

  it('maps title from worksheet record', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    expect(body[0]).toHaveProperty('title', 'Algebra');
  });

  it('maps percentage to score with rounding', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    expect(body[0]).toHaveProperty('score', 90);
    expect(body[1]).toHaveProperty('score', 80);
  });

  it('sets status to "completed" when percentage is non-null', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    const completed = body.find(w => w.id === 'algebra-grade7');
    expect(completed.status).toBe('completed');
  });

  it('sets status to "in-progress" when percentage is null', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    const inProgress = body.find(w => w.id === 'geometry-grade7');
    expect(inProgress.status).toBe('in-progress');
  });

  it('sets score to null for in-progress attempts', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    const inProgress = body.find(w => w.id === 'geometry-grade7');
    expect(inProgress.score).toBeNull();
  });

  it('includes subject and grade fields on each result', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    expect(body[0]).toHaveProperty('subject', 'Math');
    expect(body[0]).toHaveProperty('grade', 7);
  });

});

// ─── GET /api/dashboard/recent-worksheets — empty ────────────────────────────

describe('dashboardHandler — GET /api/dashboard/recent-worksheets no attempts', () => {

  it('returns 200 when no worksheets exist', async () => {
    setupQueryByFieldMock([], []);
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns an empty array when no attempts exist', async () => {
    mockQueryByField.mockResolvedValue([]);
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toEqual([]);
  });

  it('returns an empty array when queryByField returns null', async () => {
    mockQueryByField.mockResolvedValue(null);
    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toEqual([]);
  });

});

// ─── GET /api/dashboard/recent-worksheets — auth failure ─────────────────────

describe('dashboardHandler — GET /api/dashboard/recent-worksheets auth failure', () => {

  it('returns 401 when token is invalid', async () => {
    const err = new Error('Token expired');
    err.statusCode = 401;
    validateToken.mockRejectedValue(err);

    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    expect(result.statusCode).toBe(401);
  });

  it('returns CORS headers on 401 recent-worksheets response', async () => {
    const err = new Error('Token expired');
    err.statusCode = 401;
    validateToken.mockRejectedValue(err);

    const result = await handler(mockGetEvent('/api/dashboard/recent-worksheets'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/dashboard/subject-progress — aggregates fast path ───────────────

describe('dashboardHandler — GET /api/dashboard/subject-progress aggregates path', () => {

  beforeEach(() => {
    mockListAll.mockResolvedValue(MOCK_AGGREGATES);
  });

  it('returns 200 when aggregates exist', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on 200 subject-progress response', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns one entry per aggregate record matching the student', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.length).toBe(2);
  });

  it('extracts subject from the id field after the "#" separator', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const subjects = body.map(p => p.subject).sort();
    expect(subjects).toEqual(['Math', 'Science']);
  });

  it('uses averagePercentage as the score, rounded', async () => {
    // averagePercentage: 85 for Math, 80 for Science
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const mathEntry = body.find(p => p.subject === 'Math');
    expect(mathEntry.score).toBe(85);
  });

  it('assigns the correct color for Math subject', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const mathEntry = body.find(p => p.subject === 'Math');
    expect(mathEntry.color).toBe('#3D9AE8');
  });

  it('assigns the correct color for Science subject', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const scienceEntry = body.find(p => p.subject === 'Science');
    expect(scienceEntry.color).toBe('#F5C534');
  });

  it('does not call queryByField when aggregates are available', async () => {
    await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(mockQueryByField).not.toHaveBeenCalled();
  });

  it('filters out aggregates belonging to other students', async () => {
    const otherStudentId = '99999999-9999-4999-8999-999999999999';
    mockListAll.mockResolvedValue([
      ...MOCK_AGGREGATES,
      { id: `${otherStudentId}#ELA`, averagePercentage: 70 },
    ]);

    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.length).toBe(2);
    expect(body.every(p => p.subject !== 'ELA' || p.score !== 70)).toBe(true);
  });

});

// ─── GET /api/dashboard/subject-progress — fallback to attempts ───────────────

describe('dashboardHandler — GET /api/dashboard/subject-progress fallback path', () => {

  beforeEach(() => {
    // No aggregates for this student
    mockListAll.mockResolvedValue([]);
    mockQueryByField.mockResolvedValue(MOCK_ATTEMPTS);
  });

  it('returns 200 when falling back to attempts', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('computes averages per subject from completed attempts', async () => {
    // Math: a1=90, a3=null (excluded) → avg 90
    // Science: a2=80 → avg 80
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const mathEntry = body.find(p => p.subject === 'Math');
    expect(mathEntry.score).toBe(90);
  });

  it('returns correct average percentage for Science in fallback', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const scienceEntry = body.find(p => p.subject === 'Science');
    expect(scienceEntry.score).toBe(80);
  });

  it('excludes in-progress attempts (null percentage) from fallback computation', async () => {
    // a3 has null percentage and subject Math — should not inflate or break Math avg
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const mathEntry = body.find(p => p.subject === 'Math');
    // Only a1 (90%) counts; a3 is excluded → avg is 90, not (90+0)/2=45
    expect(mathEntry.score).toBe(90);
  });

  it('assigns correct colors in fallback path', async () => {
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    const mathEntry = body.find(p => p.subject === 'Math');
    expect(mathEntry.color).toBe('#3D9AE8');
  });

  it('returns empty array in fallback when all attempts are in-progress', async () => {
    mockQueryByField.mockResolvedValue([
      { ...MOCK_ATTEMPTS[2] }, // only null-percentage attempt
    ]);
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toEqual([]);
  });

});

// ─── GET /api/dashboard/subject-progress — empty data ────────────────────────

describe('dashboardHandler — GET /api/dashboard/subject-progress no data', () => {

  it('returns 200 when no aggregates and no attempts exist', async () => {
    mockListAll.mockResolvedValue([]);
    mockQueryByField.mockResolvedValue([]);
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns an empty array when no aggregates and no completed attempts', async () => {
    mockListAll.mockResolvedValue([]);
    mockQueryByField.mockResolvedValue([]);
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toEqual([]);
  });

  it('returns CORS headers on 200 empty subject-progress response', async () => {
    mockListAll.mockResolvedValue([]);
    mockQueryByField.mockResolvedValue([]);
    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/dashboard/subject-progress — auth failure ──────────────────────

describe('dashboardHandler — GET /api/dashboard/subject-progress auth failure', () => {

  it('returns 401 when token is invalid', async () => {
    const err = new Error('Invalid token');
    err.statusCode = 401;
    validateToken.mockRejectedValue(err);

    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.statusCode).toBe(401);
  });

  it('returns CORS headers on 401 subject-progress response', async () => {
    const err = new Error('Invalid token');
    err.statusCode = 401;
    validateToken.mockRejectedValue(err);

    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── 500 internal error path ──────────────────────────────────────────────────

describe('dashboardHandler — internal server errors', () => {

  it('returns 500 when queryByField throws unexpectedly on stats route', async () => {
    mockQueryByField.mockRejectedValue(new Error('DynamoDB connection lost'));

    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('returns CORS headers on 500 response', async () => {
    mockQueryByField.mockRejectedValue(new Error('DynamoDB connection lost'));

    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('error body contains an error field on 500', async () => {
    mockQueryByField.mockRejectedValue(new Error('DynamoDB connection lost'));

    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error');
  });

  it('does not leak internal error messages on 500 response', async () => {
    mockQueryByField.mockRejectedValue(new Error('Secret internal detail'));

    const result = await handler(mockGetEvent('/api/dashboard/stats'), mockContext);
    const body = JSON.parse(result.body);
    // 5xx errors should return a generic message, not the raw error
    expect(body.error).not.toMatch(/Secret internal detail/);
  });

  it('returns 500 when listAll throws on subject-progress route', async () => {
    mockListAll.mockRejectedValue(new Error('DB timeout'));

    const result = await handler(mockGetEvent('/api/dashboard/subject-progress'), mockContext);
    expect(result.statusCode).toBe(500);
  });

});
