/**
 * @file backend/handlers/questionBankHandler.js
 * @description Lambda-compatible handler for the Question Bank API.
 *
 * Routes (differentiated by event.httpMethod + event.path):
 *   GET  /api/qb/questions             — list questions with optional filters
 *   POST /api/qb/questions             — add a new question (dedupe enforced)
 *   GET  /api/qb/questions/:id         — get a single question by ID
 *   POST /api/qb/questions/:id/reuse   — increment reuseCount for a question
 *
 * Dedupe rule:
 *   A POST is rejected with 409 when an existing question has the same
 *   (grade, subject, topic, type, question-text) — case-insensitive, trimmed.
 *
 * Error model:
 *   All error responses carry a machine-readable `code` field via qbError().
 *   Response body shape: { code: "QB_*", error: "human-readable message" }
 *
 * Cold-start optimisation: the adapter is lazy-loaded on first real invocation.
 */

import { getQuestionBankAdapter } from '../../src/questionBank/index.js';
import { qbError } from '../../src/questionBank/errorModel.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const VALID_TYPES = [
  'multiple-choice',
  'fill-in-the-blank',
  'short-answer',
  'true-false',
  'matching',
  'show-your-work',
  'word-problem',
];

function matchesAllowedValue(validValues, value) {
  return validValues.some((validValue) => (
    typeof value === 'string' && validValue.toLowerCase() === value.trim().toLowerCase()
  ));
}

/**
 * Builds a standard JSON error response from a qbError payload.
 *
 * @param {number} statusCode
 * @param {string} code       - QB_ERRORS key
 * @param {string} message    - Human-readable error message
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function errorResponse(statusCode, code, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ code, error: message }),
  };
}

/**
 * Builds an error response directly from a qbError() result.
 *
 * @param {string} key    - QB_ERRORS key
 * @param {string} [detail]
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function qbErrorResponse(key, detail) {
  const e = qbError(key, detail);
  return errorResponse(e.statusCode, e.code, e.error);
}

/**
 * GET /api/qb/questions
 * Query params: grade, subject, topic, difficulty, type — all optional, AND-ed.
 *
 * @param {Object} queryStringParameters - Parsed query string (may be null)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleList(queryStringParameters) {
  const qs = queryStringParameters || {};

  // Build filters — only include a key when it was explicitly supplied
  const filters = {};
  if (qs.grade      !== undefined) filters.grade      = qs.grade;
  if (qs.subject    !== undefined) filters.subject    = qs.subject;
  if (qs.topic      !== undefined) filters.topic      = qs.topic;
  if (qs.difficulty !== undefined) filters.difficulty = qs.difficulty;
  if (qs.type       !== undefined) filters.type       = qs.type;

  // Validate grade filter when provided
  if (filters.grade !== undefined) {
    const g = Number(filters.grade);
    if (!Number.isInteger(g) || g < 1 || g > 10) {
      return qbErrorResponse('INVALID_GRADE');
    }
    filters.grade = g;
  }

  if (filters.subject !== undefined && !matchesAllowedValue(VALID_SUBJECTS, filters.subject)) {
    return qbErrorResponse('INVALID_SUBJECT', `Received: "${filters.subject}".`);
  }

  if (filters.topic !== undefined && (typeof filters.topic !== 'string' || !filters.topic.trim())) {
    return qbErrorResponse('INVALID_TOPIC');
  }

  if (filters.difficulty !== undefined && !matchesAllowedValue(VALID_DIFFICULTIES, filters.difficulty)) {
    return qbErrorResponse('INVALID_DIFFICULTY');
  }

  if (filters.type !== undefined && !matchesAllowedValue(VALID_TYPES, filters.type)) {
    return qbErrorResponse('INVALID_TYPE', `Received: "${filters.type}".`);
  }

  const qb = await getQuestionBankAdapter();
  const questions = await qb.listQuestions(filters);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, count: questions.length, questions }),
  };
}

/**
 * POST /api/qb/questions
 * Required body fields: grade, subject, topic, difficulty, type, question, answer, explanation
 * Optional body fields: options (array — multiple-choice only), standards (array), modelUsed
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleAdd(body) {
  // ── Required field validation ──────────────────────────────────────────────
  const grade = Number(body.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 10) {
    return qbErrorResponse('INVALID_GRADE');
  }

  if (!VALID_SUBJECTS.includes(body.subject)) {
    return qbErrorResponse('INVALID_SUBJECT', `Received: "${body.subject}".`);
  }

  if (typeof body.topic !== 'string' || !body.topic.trim()) {
    return qbErrorResponse('INVALID_TOPIC');
  }

  if (!VALID_DIFFICULTIES.includes(body.difficulty)) {
    return qbErrorResponse('INVALID_DIFFICULTY');
  }

  if (!VALID_TYPES.includes(body.type)) {
    return qbErrorResponse('INVALID_TYPE', `Received: "${body.type}".`);
  }

  if (typeof body.question !== 'string' || !body.question.trim()) {
    return qbErrorResponse('MISSING_FIELD', 'question must be a non-empty string.');
  }

  if (typeof body.answer !== 'string' || !body.answer.trim()) {
    return qbErrorResponse('MISSING_FIELD', 'answer must be a non-empty string.');
  }

  if (typeof body.explanation !== 'string' || !body.explanation.trim()) {
    return qbErrorResponse('MISSING_FIELD', 'explanation must be a non-empty string.');
  }

  // ── options field must not be sent for non-multiple-choice types ──────────
  if (body.options !== undefined && body.type !== 'multiple-choice') {
    return qbErrorResponse('OPTIONS_INVALID');
  }

  // ── options field validation (required for multiple-choice) ───────────────
  if (body.type === 'multiple-choice') {
    if (!Array.isArray(body.options) || body.options.length !== 4) {
      return qbErrorResponse('OPTIONS_INVALID', 'options must be an array of exactly 4 strings for multiple-choice questions.');
    }
    if (body.options.some((o) => typeof o !== 'string' || !o.trim())) {
      return qbErrorResponse('OPTIONS_INVALID', 'Each option must be a non-empty string.');
    }
  }

  // ── standards: optional array of strings ──────────────────────────────────
  if (body.standards !== undefined) {
    if (!Array.isArray(body.standards)) {
      return qbErrorResponse('MISSING_FIELD', 'standards must be an array of strings.');
    }
    if (body.standards.some((s) => typeof s !== 'string')) {
      return qbErrorResponse('MISSING_FIELD', 'Each standard must be a string.');
    }
  }

  // ── Build candidate dedupe key ─────────────────────────────────────────────
  const candidate = {
    grade,
    subject:  body.subject,
    topic:    body.topic.trim(),
    type:     body.type,
    question: body.question.trim(),
  };

  // ── Build full question object ─────────────────────────────────────────────
  const newQuestion = {
    grade,
    subject:     body.subject,
    topic:       body.topic.trim(),
    difficulty:  body.difficulty,
    type:        body.type,
    question:    body.question.trim(),
    answer:      body.answer.trim(),
    explanation: body.explanation.trim(),
    standards:   Array.isArray(body.standards) ? body.standards : [],
    modelUsed:   typeof body.modelUsed === 'string' ? body.modelUsed.trim() : '',
  };

  // options is only included when present (multiple-choice already validated above)
  if (body.type === 'multiple-choice' && Array.isArray(body.options)) {
    newQuestion.options = body.options.map((o) => o.trim());
  }

  // ── Atomic dedupe + insert ─────────────────────────────────────────────────
  const qb = await getQuestionBankAdapter();
  const { stored, duplicate } = await qb.addIfNotExists(candidate, newQuestion);

  if (duplicate) {
    return qbErrorResponse('DUPLICATE');
  }

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, question: stored }),
  };
}

/**
 * GET /api/qb/questions/:id
 *
 * @param {string} questionId
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGetById(questionId) {
  if (!questionId || typeof questionId !== 'string' || !questionId.trim()) {
    return qbErrorResponse('MISSING_FIELD', 'questionId is required.');
  }

  const qb = await getQuestionBankAdapter();
  const question = await qb.getQuestion(questionId.trim());

  if (!question) {
    return qbErrorResponse('NOT_FOUND');
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, question }),
  };
}

/**
 * POST /api/qb/questions/:id/reuse
 * Increments the reuseCount of the question identified by :id.
 * Returns the updated question on success, 404 if the ID is not found.
 *
 * @param {string} questionId
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleReuse(questionId) {
  if (!questionId || typeof questionId !== 'string' || !questionId.trim()) {
    return qbErrorResponse('MISSING_FIELD', 'questionId is required.');
  }

  const qb = await getQuestionBankAdapter();
  const updated = await qb.incrementReuseCount(questionId.trim());

  if (!updated) {
    return qbErrorResponse('NOT_FOUND');
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, question: updated }),
  };
}

/**
 * Lambda handler — routes to list, add, get-by-id, or reuse based on method + path.
 *
 * @param {Object} event   - API Gateway event or Express-shaped mock event
 * @param {Object} context - Lambda context (must expose callbackWaitsForEmptyEventLoop)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const method = event.httpMethod || 'GET';
    const path   = event.path || event.resource || '';

    // POST /api/qb/questions/:id/reuse
    const reuseMatch = path.match(/\/questions\/([^/]+)\/reuse$/);
    if (reuseMatch && method === 'POST') {
      const id = (event.pathParameters && event.pathParameters.id) || reuseMatch[1];
      return await handleReuse(id);
    }

    // GET /api/qb/questions/:id  — path ends with a UUID-like segment after /questions/
    const byIdMatch = path.match(/\/questions\/([^/]+)$/);
    if (byIdMatch && method === 'GET') {
      // Prefer explicit pathParameters when the API Gateway / server wires it
      const id = (event.pathParameters && event.pathParameters.id) || byIdMatch[1];
      return await handleGetById(id);
    }

    // POST /api/qb/questions
    if (method === 'POST' && path.endsWith('/questions')) {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return qbErrorResponse('MISSING_FIELD', 'Invalid JSON in request body.');
      }
      return await handleAdd(body);
    }

    // GET /api/qb/questions
    if (method === 'GET' && path.endsWith('/questions')) {
      return await handleList(event.queryStringParameters || {});
    }

    return qbErrorResponse('NOT_FOUND', 'Route not found.');
  } catch (err) {
    console.error('questionBankHandler error:', err);
    const statusCode = Number.isInteger(err.statusCode) && err.statusCode < 500
      ? err.statusCode
      : 500;
    const e = qbError('INTERNAL', statusCode < 500 ? err.message : undefined);
    return errorResponse(e.statusCode, e.code, statusCode < 500 ? err.message : e.error);
  }
};
