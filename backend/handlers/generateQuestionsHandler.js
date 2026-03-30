/**
 * @file backend/handlers/generateQuestionsHandler.js
 * @description Lambda handler for POST /api/generate-questions.
 * Generates questions via the LLM pipeline with caching and cost tracking.
 */

// Lazy import for cold start optimization
let _generateQuestionBatch;
const getBatchGenerator = async () => {
  if (!_generateQuestionBatch) {
    const { generateQuestionBatch } = await import('../../src/ai/pipeline/batchGenerator.js');
    _generateQuestionBatch = generateQuestionBatch;
  }
  return _generateQuestionBatch;
};

const corsHeaders = {
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const VALID_SUBJECTS    = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const VALID_TYPES = [
  'multiple-choice', 'true-false', 'fill-in-the-blank',
  'short-answer', 'word-problem', 'show-your-work',
];

export const handler = async (event, context) => {
  if (context) context.callbackWaitsForEmptyEventLoop = false;

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const body = _parseBody(event.body);
    const validationError = _validate(body);
    if (validationError) {
      return _error(400, validationError);
    }

    const { grade, subject, topic, difficulty, questionType, count = 5 } = body;

    const generateBatch = await getBatchGenerator();
    const result = await generateBatch({
      grade:        Number(grade),
      subject,
      topic,
      difficulty,
      questionType,
      count:        Number(count),
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        questions:  result.questions,
        count:      result.questions.length,
        cost:       result.cost,
        cacheStats: result.cacheStats,
      }),
    };
  } catch (err) {
    console.error('[generateQuestionsHandler] error:', err);
    return _error(500, err.message || 'Internal server error');
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _parseBody(rawBody) {
  if (!rawBody) return {};
  if (typeof rawBody === 'object') return rawBody;
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

function _validate({ grade, subject, topic, difficulty, questionType, count }) {
  const gradeNum = Number(grade);
  if (!grade || isNaN(gradeNum) || gradeNum < 1 || gradeNum > 10 || !Number.isInteger(gradeNum)) {
    return 'grade must be an integer between 1 and 10';
  }
  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return `subject must be one of: ${VALID_SUBJECTS.join(', ')}`;
  }
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return 'topic must be a non-empty string';
  }
  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
    return `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`;
  }
  if (!questionType || !VALID_TYPES.includes(questionType)) {
    return `questionType must be one of: ${VALID_TYPES.join(', ')}`;
  }
  const countNum = Number(count ?? 5);
  if (isNaN(countNum) || countNum < 1 || countNum > 30 || !Number.isInteger(countNum)) {
    return 'count must be an integer between 1 and 30';
  }
  return null;
}

function _error(statusCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}
