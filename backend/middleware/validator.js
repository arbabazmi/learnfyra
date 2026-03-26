/**
 * @file backend/middleware/validator.js
 * @description Validates incoming API Gateway event bodies for worksheet generation
 */

const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const VALID_FORMATS = ['PDF', 'Word (.docx)', 'HTML'];
const VALID_GENERATION_MODES = ['auto', 'bank-first'];
const VALID_PROVENANCE_LEVELS = ['none', 'summary', 'full'];

/**
 * Returns a trimmed string when input is a string, otherwise empty.
 * @param {unknown} value
 * @param {number} maxLen
 * @returns {string}
 */
function normalizeOptionalString(value, maxLen = 80) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/**
 * Returns YYYY-MM-DD when input is a valid date string in that format.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeOptionalDate(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('worksheetDate must be in YYYY-MM-DD format.');
  }

  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('worksheetDate must be a valid date.');
  }

  return trimmed;
}

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

  // topic: required, non-empty string, max 200 characters
  if (typeof body.topic !== 'string' || !body.topic.trim()) {
    throw new Error('topic must be a non-empty string.');
  }
  if (body.topic.trim().length > 200) {
    throw new Error('topic must be 200 characters or fewer.');
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

  const generationMode = body.generationMode == null ? 'auto' : String(body.generationMode).trim();
  if (!VALID_GENERATION_MODES.includes(generationMode)) {
    throw new Error(`generationMode must be one of: ${VALID_GENERATION_MODES.join(', ')}.`);
  }

  const provenanceLevel = body.provenanceLevel == null ? 'summary' : String(body.provenanceLevel).trim();
  if (!VALID_PROVENANCE_LEVELS.includes(provenanceLevel)) {
    throw new Error(`provenanceLevel must be one of: ${VALID_PROVENANCE_LEVELS.join(', ')}.`);
  }

  const studentName = normalizeOptionalString(body.studentName, 80);
  const teacherName = normalizeOptionalString(body.teacherName, 80);
  const period = normalizeOptionalString(body.period, 40);
  const className = normalizeOptionalString(body.className, 80);
  const worksheetDate = normalizeOptionalDate(body.worksheetDate);

  return {
    grade,
    subject: body.subject,
    topic: body.topic.trim(),
    difficulty: body.difficulty,
    questionCount,
    format: body.format,
    includeAnswerKey,
    generationMode,
    provenanceLevel,
    studentName,
    worksheetDate,
    teacherName,
    period,
    className,
  };
}
