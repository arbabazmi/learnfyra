/**
 * @file backend/middleware/validator.js
 * @description Validates incoming API Gateway event bodies for worksheet generation
 */

const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const VALID_FORMATS = ['PDF', 'Word (.docx)', 'HTML'];

/**
 * Validates and normalises the parsed request body for POST /api/generate.
 * Throws a descriptive Error with a user-facing message on any violation.
 * @param {Object} body - Parsed JSON body from the Lambda event
 * @returns {Object} Normalised and validated body
 */
export function validateGenerateBody(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object.');
  }

  // grade: required, integer 1–10
  const grade = Number(body.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 10) {
    throw new Error('grade must be an integer between 1 and 10.');
  }

  // subject: required, one of valid list
  if (!VALID_SUBJECTS.includes(body.subject)) {
    throw new Error(`subject must be one of: ${VALID_SUBJECTS.join(', ')}.`);
  }

  // topic: required, non-empty string
  if (typeof body.topic !== 'string' || !body.topic.trim()) {
    throw new Error('topic must be a non-empty string.');
  }

  // difficulty: required, one of valid list
  if (!VALID_DIFFICULTIES.includes(body.difficulty)) {
    throw new Error(`difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}.`);
  }

  // questionCount: required, integer 5–30
  const questionCount = Number(body.questionCount);
  if (!Number.isInteger(questionCount) || questionCount < 5 || questionCount > 30) {
    throw new Error('questionCount must be an integer between 5 and 30.');
  }

  // format: required, one of valid list
  if (!VALID_FORMATS.includes(body.format)) {
    throw new Error(`format must be one of: ${VALID_FORMATS.join(', ')}.`);
  }

  // includeAnswerKey: optional boolean, defaults to true
  const includeAnswerKey = body.includeAnswerKey !== false;

  return {
    grade,
    subject: body.subject,
    topic: body.topic.trim(),
    difficulty: body.difficulty,
    questionCount,
    format: body.format,
    includeAnswerKey,
  };
}
