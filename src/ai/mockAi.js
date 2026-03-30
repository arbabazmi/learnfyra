/**
 * @file src/ai/mockAi.js
 * @description Mock AI responses for local development.
 * Enabled when MOCK_AI=true in environment.
 *
 * Returns parameterized but deterministic fake data so the full
 * frontend/backend flow works without spending API credits.
 *
 * Usage: add MOCK_AI=true to your .env file.
 */

import { logger } from '../utils/logger.js';

/** Simulated latency to make the UI feel realistic (ms) */
const MOCK_DELAY_MS = 400;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Worksheet mock ───────────────────────────────────────────────────────────

/**
 * Returns a mock worksheet object matching the requested options.
 * Drop-in replacement for generateWorksheet() when MOCK_AI=true.
 *
 * @param {Object} options
 * @param {number} options.grade
 * @param {string} options.subject
 * @param {string} options.topic
 * @param {string} options.difficulty
 * @param {number} options.questionCount
 * @returns {Promise<Object>}
 */
export async function mockGenerateWorksheet({ grade, subject, topic, difficulty, questionCount }) {
  logger.warn('[MOCK_AI] Returning mock worksheet — no API call made');
  await delay(MOCK_DELAY_MS);

  const questions = _buildMockQuestions(subject, topic, questionCount);
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return {
    $schema: 'learnfyra/worksheet/v1',
    title: `Grade ${grade} ${subject}: ${topic}`,
    grade,
    subject,
    topic,
    difficulty,
    standards: _mockStandards(subject, grade),
    estimatedTime: `${Math.max(10, questionCount * 2)} minutes`,
    instructions:
      'Answer each question carefully. Show your work where required. ' +
      'Circle the letter of the correct answer for multiple-choice questions.',
    totalPoints,
    questions,
  };
}

// ─── Question batch mock ──────────────────────────────────────────────────────

/**
 * Returns a mock question batch result matching the requested options.
 * Drop-in replacement for generateQuestionBatch() when MOCK_AI=true.
 *
 * @param {Object} params
 * @param {number} params.grade
 * @param {string} params.subject
 * @param {string} params.topic
 * @param {string} params.difficulty
 * @param {string} params.questionType
 * @param {number} params.count
 * @returns {Promise<Object>}
 */
export async function mockGenerateQuestionBatch({ grade, subject, topic, difficulty, questionType, count }) {
  logger.warn('[MOCK_AI] Returning mock question batch — no API call made');
  await delay(MOCK_DELAY_MS);

  const questions = Array.from({ length: count }, (_, i) =>
    _buildSingleMockQuestion(subject, topic, questionType, i + 1)
  );

  return {
    questions,
    cost: { totalInputTokens: 0, totalOutputTokens: 0, estimatedUSDCents: 0 },
    cacheStats: { hits: 0, misses: count },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUESTION_TYPES = [
  'multiple-choice', 'true-false', 'fill-in-the-blank',
  'word-problem', 'short-answer', 'show-your-work',
];

/**
 * Builds a mixed array of mock questions for the worksheet generator.
 */
function _buildMockQuestions(subject, topic, count) {
  return Array.from({ length: count }, (_, i) => {
    const type = QUESTION_TYPES[i % QUESTION_TYPES.length];
    return {
      number: i + 1,
      ...(_buildSingleMockQuestion(subject, topic, type, i + 1)),
    };
  });
}

/**
 * Builds one mock question for the given type.
 */
function _buildSingleMockQuestion(subject, topic, type, num) {
  const base = {
    type,
    points: type === 'word-problem' || type === 'show-your-work' ? 2 : 1,
  };

  switch (type) {
    case 'multiple-choice':
      return {
        ...base,
        question: `[MOCK] ${subject} question ${num} about ${topic}`,
        options: [
          'A. First option',
          'B. Second option (correct)',
          'C. Third option',
          'D. Fourth option',
        ],
        answer: 'B',
        explanation: `[MOCK] The correct answer is B because it is the second option in the mock dataset.`,
      };

    case 'true-false':
      return {
        ...base,
        question: `[MOCK] ${topic} statement ${num} is correct.`,
        answer: 'True',
        explanation: `[MOCK] This statement is true in the mock dataset.`,
      };

    case 'fill-in-the-blank':
      return {
        ...base,
        question: `[MOCK] The answer to this ${topic} question is _______.`,
        answer: 'mock answer',
        explanation: `[MOCK] The blank should be filled with "mock answer".`,
      };

    case 'word-problem':
      return {
        ...base,
        question: `[MOCK] A word problem about ${topic}: If you have 5 groups of 4 items, how many items do you have in total?`,
        answer: '20',
        explanation: `[MOCK] 5 × 4 = 20. This is a mock word problem for ${subject}.`,
      };

    case 'short-answer':
      return {
        ...base,
        question: `[MOCK] In your own words, describe the main concept of ${topic}.`,
        answer: `[MOCK] A short description of ${topic}.`,
        explanation: `[MOCK] A complete answer should describe the key ideas of ${topic}.`,
      };

    case 'show-your-work':
      return {
        ...base,
        question: `[MOCK] Solve and show your work: ${topic} problem ${num}.`,
        answer: '42',
        explanation: `[MOCK] Step 1: Set up the problem. Step 2: Solve. Step 3: Answer = 42.`,
      };

    default:
      return {
        ...base,
        type: 'short-answer',
        question: `[MOCK] ${subject} question ${num} about ${topic}.`,
        answer: '[MOCK] answer',
        explanation: '[MOCK] explanation',
      };
  }
}

/**
 * Returns mock standards codes based on subject.
 */
function _mockStandards(subject, grade) {
  const map = {
    'Math':          [`CCSS.MATH.CONTENT.${grade}.OA.A.1`],
    'ELA':           [`CCSS.ELA-LITERACY.RI.${grade}.1`],
    'Science':       [`NGSS.${grade}-PS1-1`],
    'Social Studies': [`C3.D2.His.1.${grade}-${grade}`],
    'Health':        [`NHES.1.${grade}`],
  };
  return map[subject] ?? [`STANDARD.${grade}.1`];
}
