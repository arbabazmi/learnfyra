/**
 * @file tests/unit/batchGenerator.test.js
 * @description Unit tests for the batch question generator.
 * The questionPipeline and questionCache are mocked.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRunPipeline = jest.fn();
jest.unstable_mockModule('../../src/ai/pipeline/questionPipeline.js', () => ({
  runQuestionPipeline: mockRunPipeline,
}));

const mockCacheGet   = jest.fn();
const mockCacheSet   = jest.fn();
const mockCacheCount = jest.fn();

jest.unstable_mockModule('../../src/ai/cache/questionCache.js', () => ({
  questionCache: {
    get:   mockCacheGet,
    set:   mockCacheSet,
    count: mockCacheCount,
    constructor: { buildKey: null }, // no static method on mock instance
  },
  QuestionCache: class MockQuestionCache {
    static buildKey(grade, subject, questionType, difficulty) {
      return `${grade}:${subject}:${questionType}:${difficulty}`.toLowerCase();
    }
  },
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { generateQuestionBatch } = await import('../../src/ai/pipeline/batchGenerator.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeQuestion = (n) => ({
  type: 'multiple-choice',
  question: `Question ${n}`,
  answer: 'B',
  explanation: 'Because B',
  points: 1,
  _meta: {
    generateModel: 'claude-haiku-4-5-20251001',
    explainModel:  'claude-haiku-4-5-20251001',
    wasEscalated: false,
    validationAttempts: 1,
    usage: { inputTokens: 300, outputTokens: 150 },
  },
});

const baseParams = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  difficulty: 'Easy',
  questionType: 'multiple-choice',
  count: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCacheGet.mockReturnValue(null);
  mockCacheCount.mockReturnValue(0);
  mockCacheSet.mockImplementation(() => {});
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateQuestionBatch()', () => {

  // ── Cache miss ───────────────────────────────────────────────────────────
  describe('cache miss (all questions generated)', () => {

    it('generates count questions via pipeline when cache is empty', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      const result = await generateQuestionBatch(baseParams);

      expect(mockRunPipeline).toHaveBeenCalledTimes(3);
      expect(result.questions).toHaveLength(3);
    });

    it('strips _meta from returned questions', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      const { questions } = await generateQuestionBatch(baseParams);

      questions.forEach((q) => expect(q._meta).toBeUndefined());
    });

    it('populates cacheStats.misses with count when fully generated', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      const { cacheStats } = await generateQuestionBatch(baseParams);
      expect(cacheStats.misses).toBe(3);
      expect(cacheStats.hits).toBe(0);
    });

    it('calls questionCache.set() with generated questions', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      await generateQuestionBatch(baseParams);
      expect(mockCacheSet).toHaveBeenCalledTimes(1);
    });

    it('tracks cost with non-zero input tokens', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      const { cost } = await generateQuestionBatch(baseParams);
      expect(cost.totalInputTokens).toBeGreaterThan(0);
      expect(cost.totalOutputTokens).toBeGreaterThan(0);
    });

  });

  // ── Full cache hit ────────────────────────────────────────────────────────
  describe('cache hit (all questions served from cache)', () => {

    it('returns cached questions without calling pipeline', async () => {
      const cached = [makeQuestion(1), makeQuestion(2), makeQuestion(3)].map(({ _meta, ...q }) => q);
      mockCacheGet.mockReturnValue(cached);

      const result = await generateQuestionBatch(baseParams);

      expect(mockRunPipeline).not.toHaveBeenCalled();
      expect(result.questions).toHaveLength(3);
    });

    it('reports zero cost on cache hit', async () => {
      const cached = [makeQuestion(1), makeQuestion(2), makeQuestion(3)].map(({ _meta, ...q }) => q);
      mockCacheGet.mockReturnValue(cached);

      const { cost } = await generateQuestionBatch(baseParams);
      expect(cost.totalInputTokens).toBe(0);
      expect(cost.estimatedUSDCents).toBe(0);
    });

    it('reports all hits in cacheStats', async () => {
      const cached = [makeQuestion(1), makeQuestion(2), makeQuestion(3)].map(({ _meta, ...q }) => q);
      mockCacheGet.mockReturnValue(cached);

      const { cacheStats } = await generateQuestionBatch(baseParams);
      expect(cacheStats.hits).toBe(3);
      expect(cacheStats.misses).toBe(0);
    });

  });

  // ── Mixed difficulty ──────────────────────────────────────────────────────
  describe('Mixed difficulty', () => {

    it('cycles Easy/Medium/Hard when difficulty is Mixed', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      await generateQuestionBatch({ ...baseParams, difficulty: 'Mixed', count: 3 });

      const difficulties = mockRunPipeline.mock.calls.map((c) => c[0].difficulty);
      expect(difficulties).toEqual(['Easy', 'Medium', 'Hard']);
    });

    it('wraps around the cycle for count > 3', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      await generateQuestionBatch({ ...baseParams, difficulty: 'Mixed', count: 4 });

      const difficulties = mockRunPipeline.mock.calls.map((c) => c[0].difficulty);
      expect(difficulties[3]).toBe('Easy');
    });

  });

  // ── Concurrency ───────────────────────────────────────────────────────────
  describe('bounded concurrency', () => {

    it('generates multiple questions concurrently', async () => {
      mockRunPipeline.mockImplementation(
        () => new Promise((r) => setTimeout(() => r(makeQuestion(1)), 5))
      );

      const start = Date.now();
      await generateQuestionBatch({ ...baseParams, count: 3 });
      const elapsed = Date.now() - start;

      // With 3 concurrent workers (max concurrency = 3), should be ~5ms not ~15ms
      expect(elapsed).toBeLessThan(50);
    });

  });

  // ── Return shape ──────────────────────────────────────────────────────────
  describe('return value shape', () => {

    it('always returns questions, cost, and cacheStats', async () => {
      mockRunPipeline.mockResolvedValue(makeQuestion(1));

      const result = await generateQuestionBatch(baseParams);

      expect(result).toHaveProperty('questions');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('cacheStats');
      expect(result.cost).toHaveProperty('totalInputTokens');
      expect(result.cost).toHaveProperty('totalOutputTokens');
      expect(result.cost).toHaveProperty('estimatedUSDCents');
      expect(result.cacheStats).toHaveProperty('hits');
      expect(result.cacheStats).toHaveProperty('misses');
    });

  });

});
