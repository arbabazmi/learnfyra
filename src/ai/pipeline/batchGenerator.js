/**
 * @file src/ai/pipeline/batchGenerator.js
 * @description Parallel batch question generation with:
 *   - Cache-first strategy (serves from questionCache when available)
 *   - Bounded concurrency (max 3 parallel pipeline calls)
 *   - Per-request cost tracking (input + output tokens × model price)
 *   - Deduplication via cache after generation
 */

import { runQuestionPipeline } from './questionPipeline.js';
import { questionCache } from '../cache/questionCache.js';
import { mockGenerateQuestionBatch } from '../mockAi.js';

const MAX_CONCURRENCY = 3;

/** Approximate cost per 1M tokens (USD) — used for cost estimation only */
const COST_PER_1M = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
};

/**
 * @typedef {Object} BatchResult
 * @property {Object[]} questions   - Array of generated question objects (without _meta)
 * @property {Object}   cost        - { totalInputTokens, totalOutputTokens, estimatedUSDCents }
 * @property {Object}   cacheStats  - { hits, misses }
 */

/**
 * Generates `count` questions in parallel, using cache when possible.
 *
 * @param {Object} params
 * @param {number|string} params.grade
 * @param {string} params.subject
 * @param {string} params.topic
 * @param {string} params.difficulty  - 'Easy' | 'Medium' | 'Hard' | 'Mixed'
 * @param {string} params.questionType
 * @param {number} params.count       - number of questions to generate
 * @returns {Promise<BatchResult>}
 */
export async function generateQuestionBatch({ grade, subject, topic, difficulty, questionType, count }) {
  if (process.env.MOCK_AI === 'true') {
    return mockGenerateQuestionBatch({ grade, subject, topic, difficulty, questionType, count });
  }

  const cacheKey = questionCache.constructor.buildKey
    ? questionCache.constructor.buildKey(grade, subject, questionType, difficulty)
    : _buildKey(grade, subject, questionType, difficulty);

  // ── Cache hit ──────────────────────────────────────────────────────────────
  const cached = questionCache.get(cacheKey, count);
  if (cached) {
    return {
      questions: cached,
      cost: { totalInputTokens: 0, totalOutputTokens: 0, estimatedUSDCents: 0 },
      cacheStats: { hits: count, misses: 0 },
    };
  }

  const cachedCount = questionCache.count(cacheKey);
  const needCount   = count - cachedCount;

  // ── Generate missing questions with bounded concurrency ───────────────────
  const generated = await _runBounded(
    Array.from({ length: needCount }, (_, i) => () =>
      runQuestionPipeline({ grade, subject, topic, difficulty: _resolveDifficulty(difficulty, i), questionType })
    ),
    MAX_CONCURRENCY
  );

  // ── Cost accumulation ─────────────────────────────────────────────────────
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;
  let estimatedUSDCents = 0;

  for (const q of generated) {
    if (q._meta?.usage) {
      totalInputTokens  += q._meta.usage.inputTokens;
      totalOutputTokens += q._meta.usage.outputTokens;

      const genModel = q._meta.generateModel;
      const expModel = q._meta.explainModel;
      if (COST_PER_1M[genModel]) {
        estimatedUSDCents +=
          (q._meta.usage.inputTokens  / 1_000_000) * COST_PER_1M[genModel].input  * 100 +
          (q._meta.usage.outputTokens / 1_000_000) * COST_PER_1M[genModel].output * 100;
      }
      if (expModel && COST_PER_1M[expModel] && expModel !== genModel) {
        // Explanation tokens already included in usage above — just reference cost
        // (explanation uses separate model billing — tracked separately if needed)
      }
    }
  }

  // ── Strip internal _meta before caching/returning ────────────────────────
  const cleanQuestions = generated.map(({ _meta, ...q }) => q);

  // Cache generated questions for future requests
  questionCache.set(cacheKey, cleanQuestions);

  // Drain any cached questions from earlier partial hits
  const fromCache = cachedCount > 0 ? (questionCache.get(cacheKey, cachedCount) ?? []) : [];
  const allQuestions = [...fromCache, ...cleanQuestions].slice(0, count);

  return {
    questions: allQuestions,
    cost: {
      totalInputTokens,
      totalOutputTokens,
      estimatedUSDCents: Math.round(estimatedUSDCents * 100) / 100,
    },
    cacheStats: { hits: cachedCount, misses: needCount },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Runs an array of async task factories with bounded concurrency.
 * @param {Array<() => Promise<any>>} tasks
 * @param {number} limit
 * @returns {Promise<any[]>}
 */
async function _runBounded(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Resolves difficulty for Mixed mode — cycles Easy/Medium/Hard.
 * @param {string} difficulty
 * @param {number} index
 * @returns {string}
 */
function _resolveDifficulty(difficulty, index) {
  if (difficulty !== 'Mixed') return difficulty;
  const cycle = ['Easy', 'Medium', 'Hard'];
  return cycle[index % cycle.length];
}

/**
 * Fallback key builder (mirrors QuestionCache.buildKey).
 * @param {number|string} grade
 * @param {string} subject
 * @param {string} questionType
 * @param {string} difficulty
 * @returns {string}
 */
function _buildKey(grade, subject, questionType, difficulty) {
  return `${grade}:${subject}:${questionType}:${difficulty}`.toLowerCase();
}
