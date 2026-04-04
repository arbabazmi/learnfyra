/**
 * @file tests/integration/solve-aws.test.js
 * @description Integration tests that mimic the AWS Lambda scenario for solve
 * and submit handlers. DynamoDB is mocked; APP_RUNTIME=aws so handlers use the
 * DynamoDB path instead of local filesystem.
 *
 * Guest token flow: calls POST /api/auth/guest to obtain a short-lived JWT,
 * then sends it as Authorization: Bearer on solve/submit — exactly as the
 * frontend does for unauthenticated students.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Set env vars BEFORE importing handlers (isAws is evaluated at module load) ──
process.env.APP_RUNTIME = 'aws';
process.env.WORKSHEETS_TABLE_NAME = 'LearnfyraWorksheets-test';
process.env.ALLOWED_ORIGIN = '*';
process.env.JWT_SECRET = 'test-secret-for-integration-tests';

// ── Mock DynamoDB SDK ───────────────────────────────────────────────────────────

const mockSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
}));

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: mockSend }),
  },
  GetCommand: jest.fn().mockImplementation((params) => ({ _type: 'Get', ...params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ _type: 'Query', ...params })),
}));

// Mock fs so local path doesn't interfere
jest.unstable_mockModule('fs', () => ({
  promises: { readFile: jest.fn() },
}));

// Mock resultBuilder for submit handler
jest.unstable_mockModule('../../src/solve/resultBuilder.js', () => ({
  buildResult: jest.fn(),
}));

// ── Dynamic imports (after mocks) ───────────────────────────────────────────────

const { handler: solveHandler } = await import('../../backend/handlers/solveHandler.js');
const { handler: submitHandler } = await import('../../backend/handlers/submitHandler.js');
const { signToken } = await import('../../src/auth/tokenUtils.js');
const { buildResult } = await import('../../src/solve/resultBuilder.js');

// ── Fixtures ────────────────────────────────────────────────────────────────────

const VALID_UUID = 'c53f718d-5798-4212-a566-d0ff386c6726';
const VALID_SLUG = 'grade-3-math-multiplication-easy-c53f71';

const worksheetItem = {
  worksheetId: VALID_UUID,
  slug: VALID_SLUG,
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  difficulty: 'Easy',
  title: 'Grade 3 Math: Multiplication',
  estimatedTime: '20 minutes',
  timerSeconds: 1200,
  totalPoints: 2,
  questions: [
    {
      number: 1,
      type: 'multiple-choice',
      question: 'What is 6 × 7?',
      options: ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
      answer: 'B',
      explanation: '6 × 7 = 42',
      points: 1,
    },
    {
      number: 2,
      type: 'fill-in-the-blank',
      question: 'What is 8 × 5?',
      answer: '40',
      explanation: '8 × 5 = 40',
      points: 1,
    },
  ],
};

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ── Guest token helper ──────────────────────────────────────────────────────────
// Mirrors exactly what handleGuest() in authHandler.js does: signs a JWT with
// role='guest', sub='guest-<uuid>', 2h expiry. Using signToken directly avoids
// importing the full authHandler (which has deep fs transitive dependencies).

let guestToken;
let guestSeq = 0;

function issueGuestToken() {
  const guestId = `guest-test-${Date.now()}-${++guestSeq}`;
  return {
    token: signToken({ sub: guestId, email: '', role: 'guest' }, '2h'),
    guestId,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Builds a GET /api/solve/{id} event with guest Bearer token */
function solveEvent(identifier, token) {
  return {
    httpMethod: 'GET',
    pathParameters: identifier != null ? { worksheetId: identifier } : null,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

/** Builds a POST /api/submit event with guest Bearer token */
function submitEvent(body, token) {
  return {
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
//  GUEST TOKEN — signToken with role=guest (mirrors handleGuest in authHandler)
// =============================================================================

describe('guest token issuance', () => {

  it('produces a valid JWT with role=guest', () => {
    const { token, guestId } = issueGuestToken();
    expect(token).toBeDefined();
    expect(guestId).toMatch(/^guest-/);
    // Decode without verification to inspect claims
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    expect(payload.role).toBe('guest');
    expect(payload.sub).toBe(guestId);
  });

  it('issues unique guestIds on each call', () => {
    const g1 = issueGuestToken();
    const g2 = issueGuestToken();
    expect(g1.guestId).not.toBe(g2.guestId);
  });
});

// =============================================================================
//  SOLVE HANDLER — AWS/DynamoDB path with guest token
// =============================================================================

describe('solveHandler (AWS mode, guest token)', () => {

  beforeAll(() => {
    guestToken = issueGuestToken().token;
  });

  describe('UUID lookup via GetCommand', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Item: worksheetItem });
    });

    it('returns 200 with a guest Bearer token', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID, guestToken), mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('returns worksheet metadata and questions', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID, guestToken), mockContext);
      const body = JSON.parse(result.body);
      expect(body.worksheetId).toBe(VALID_UUID);
      expect(body.title).toBe('Grade 3 Math: Multiplication');
      expect(body.questions).toHaveLength(2);
    });

    it('strips answers and explanations from questions', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID, guestToken), mockContext);
      const body = JSON.parse(result.body);
      for (const q of body.questions) {
        expect(q).not.toHaveProperty('answer');
        expect(q).not.toHaveProperty('explanation');
      }
    });

    it('includes CORS headers', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID, guestToken), mockContext);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('slug lookup via QueryCommand (GSI)', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Items: [worksheetItem] });
    });

    it('returns 200 when identifier is an SEO slug', async () => {
      const result = await solveHandler(solveEvent(VALID_SLUG, guestToken), mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('returns worksheet data for slug lookup', async () => {
      const result = await solveHandler(solveEvent(VALID_SLUG, guestToken), mockContext);
      const body = JSON.parse(result.body);
      expect(body.worksheetId).toBe(VALID_UUID);
      expect(body.questions).toHaveLength(2);
    });
  });

  describe('404 — worksheet not found in DynamoDB', () => {
    it('returns 404 when GetCommand returns no Item (UUID)', async () => {
      mockSend.mockResolvedValue({ Item: undefined });
      const result = await solveHandler(solveEvent(VALID_UUID, guestToken), mockContext);
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.code).toBe('SOLVE_NOT_FOUND');
    });

    it('returns 404 when QueryCommand returns empty Items (slug)', async () => {
      mockSend.mockResolvedValue({ Items: [] });
      const result = await solveHandler(solveEvent(VALID_SLUG, guestToken), mockContext);
      expect(result.statusCode).toBe(404);
    });
  });
});

// =============================================================================
//  SUBMIT HANDLER — AWS/DynamoDB path with guest token
// =============================================================================

describe('submitHandler (AWS mode, guest token)', () => {

  beforeAll(() => {
    guestToken = issueGuestToken().token;
  });

  const validSubmission = {
    worksheetId: VALID_UUID,
    answers: [
      { number: 1, answer: 'B' },
      { number: 2, answer: '40' },
    ],
    timeTaken: 300,
    timed: false,
  };

  const mockResultResponse = {
    worksheetId: VALID_UUID,
    totalScore: 2,
    totalPoints: 2,
    percentage: 100,
    timeTaken: 300,
    timed: false,
    results: [
      { number: 1, correct: true, studentAnswer: 'B', correctAnswer: 'B', pointsEarned: 1, pointsPossible: 1 },
      { number: 2, correct: true, studentAnswer: '40', correctAnswer: '40', pointsEarned: 1, pointsPossible: 1 },
    ],
  };

  describe('happy path — score answers via DynamoDB lookup', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Item: worksheetItem });
      buildResult.mockReturnValue(mockResultResponse);
    });

    it('returns 200 with a guest Bearer token', async () => {
      const result = await submitHandler(submitEvent(validSubmission, guestToken), mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('returns scoring results', async () => {
      const result = await submitHandler(submitEvent(validSubmission, guestToken), mockContext);
      const body = JSON.parse(result.body);
      expect(body.totalScore).toBe(2);
      expect(body.percentage).toBe(100);
      expect(body.results).toHaveLength(2);
    });

    it('calls buildResult with worksheet from DynamoDB', async () => {
      await submitHandler(submitEvent(validSubmission, guestToken), mockContext);
      expect(buildResult).toHaveBeenCalledWith(
        worksheetItem,
        validSubmission.answers,
        300,
        false,
      );
    });

    it('includes CORS headers', async () => {
      const result = await submitHandler(submitEvent(validSubmission, guestToken), mockContext);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('404 — worksheet not found in DynamoDB', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Item: undefined });
    });

    it('returns 404 when worksheet does not exist', async () => {
      const result = await submitHandler(submitEvent(validSubmission, guestToken), mockContext);
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.code).toBe('SUBMIT_NOT_FOUND');
    });
  });
});
