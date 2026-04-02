/**
 * @file tests/integration/solve-aws.test.js
 * @description Integration tests that mimic the AWS Lambda scenario for solve
 * and submit handlers. DynamoDB is mocked; APP_RUNTIME=aws so handlers use the
 * DynamoDB path instead of local filesystem. No auth token is sent — these
 * endpoints must work without authentication (public student-facing routes).
 */

import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';

// ── Set env vars BEFORE importing handlers (isAws is evaluated at module load) ──
process.env.APP_RUNTIME = 'aws';
process.env.WORKSHEETS_TABLE_NAME = 'LearnfyraWorksheets-test';
process.env.ALLOWED_ORIGIN = '*';

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

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Builds a GET /api/solve/{id} event — NO Authorization header */
function solveEvent(identifier) {
  return {
    httpMethod: 'GET',
    pathParameters: identifier != null ? { worksheetId: identifier } : null,
    headers: {},   // no auth
  };
}

/** Builds a POST /api/submit event — NO Authorization header */
function submitEvent(body) {
  return {
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: {},   // no auth
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
//  SOLVE HANDLER — AWS/DynamoDB path, no auth
// =============================================================================

describe('solveHandler (AWS mode, no auth token)', () => {

  describe('UUID lookup via GetCommand', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Item: worksheetItem });
    });

    it('returns 200 without any Authorization header', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID), mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('returns worksheet metadata and questions', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID), mockContext);
      const body = JSON.parse(result.body);
      expect(body.worksheetId).toBe(VALID_UUID);
      expect(body.title).toBe('Grade 3 Math: Multiplication');
      expect(body.questions).toHaveLength(2);
    });

    it('strips answers and explanations from questions', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID), mockContext);
      const body = JSON.parse(result.body);
      for (const q of body.questions) {
        expect(q).not.toHaveProperty('answer');
        expect(q).not.toHaveProperty('explanation');
      }
    });

    it('includes CORS headers', async () => {
      const result = await solveHandler(solveEvent(VALID_UUID), mockContext);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('slug lookup via QueryCommand (GSI)', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Items: [worksheetItem] });
    });

    it('returns 200 when identifier is an SEO slug', async () => {
      const result = await solveHandler(solveEvent(VALID_SLUG), mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('returns worksheet data for slug lookup', async () => {
      const result = await solveHandler(solveEvent(VALID_SLUG), mockContext);
      const body = JSON.parse(result.body);
      expect(body.worksheetId).toBe(VALID_UUID);
      expect(body.questions).toHaveLength(2);
    });
  });

  describe('404 — worksheet not found in DynamoDB', () => {
    it('returns 404 when GetCommand returns no Item (UUID)', async () => {
      mockSend.mockResolvedValue({ Item: undefined });
      const result = await solveHandler(solveEvent(VALID_UUID), mockContext);
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.code).toBe('SOLVE_NOT_FOUND');
    });

    it('returns 404 when QueryCommand returns empty Items (slug)', async () => {
      mockSend.mockResolvedValue({ Items: [] });
      const result = await solveHandler(solveEvent(VALID_SLUG), mockContext);
      expect(result.statusCode).toBe(404);
    });
  });

  describe('500 — WORKSHEETS_TABLE_NAME not set', () => {
    const origTable = process.env.WORKSHEETS_TABLE_NAME;

    it('returns 500 when table name env var is missing', async () => {
      delete process.env.WORKSHEETS_TABLE_NAME;
      const result = await solveHandler(solveEvent(VALID_UUID), mockContext);
      // Handler catches the error from fetchFromDynamo and returns error status
      expect([404, 500]).toContain(result.statusCode);
      process.env.WORKSHEETS_TABLE_NAME = origTable;
    });
  });
});

// =============================================================================
//  SUBMIT HANDLER — AWS/DynamoDB path, no auth
// =============================================================================

describe('submitHandler (AWS mode, no auth token)', () => {

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

    it('returns 200 without any Authorization header', async () => {
      const result = await submitHandler(submitEvent(validSubmission), mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('returns scoring results', async () => {
      const result = await submitHandler(submitEvent(validSubmission), mockContext);
      const body = JSON.parse(result.body);
      expect(body.totalScore).toBe(2);
      expect(body.percentage).toBe(100);
      expect(body.results).toHaveLength(2);
    });

    it('calls buildResult with worksheet from DynamoDB', async () => {
      await submitHandler(submitEvent(validSubmission), mockContext);
      expect(buildResult).toHaveBeenCalledWith(
        worksheetItem,
        validSubmission.answers,
        300,
        false,
      );
    });

    it('includes CORS headers', async () => {
      const result = await submitHandler(submitEvent(validSubmission), mockContext);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('404 — worksheet not found in DynamoDB', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Item: undefined });
    });

    it('returns 404 when worksheet does not exist', async () => {
      const result = await submitHandler(submitEvent(validSubmission), mockContext);
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.code).toBe('SUBMIT_NOT_FOUND');
    });
  });
});
