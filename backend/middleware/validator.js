/**
 * @file backend/middleware/validator.js
 * @description Validates incoming API Gateway event bodies for worksheet generation
 * and authentication (including COPPA dateOfBirth validation).
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
 * Returns a normalized identifier string, or empty when omitted.
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function normalizeOptionalId(value, fieldName) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(trimmed)) {
    throw new Error(`${fieldName} must be 1-128 characters and use only letters, numbers, underscores, or hyphens.`);
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

  // grade: required, integer 1â€“10
  const grade = Number(body.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 10) {
    throw new Error('grade must be an integer between 1 and 10.');
  }

  // subject: required, one of valid list
  if (!VALID_SUBJECTS.includes(body.subject)) {
    throw new Error(`subject must be one of: ${VALID_SUBJECTS.join(', ')}.`);
  }

  // topic: required, non-empty string, max 200 characters, safe characters only
  if (typeof body.topic !== 'string' || !body.topic.trim()) {
    throw new Error('topic must be a non-empty string.');
  }
  if (body.topic.trim().length > 200) {
    throw new Error('topic must be 200 characters or fewer.');
  }
  // Block characters that enable prompt injection: double-quotes, newlines, null bytes
  if (/["\x00\n\r]/.test(body.topic)) {
    throw new Error('topic contains invalid characters.');
  }

  // difficulty: required, one of valid list
  if (!VALID_DIFFICULTIES.includes(body.difficulty)) {
    throw new Error(`difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}.`);
  }

  // questionCount: required, integer 5â€“10
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
  const studentId = normalizeOptionalId(body.studentId, 'studentId');
  const parentId = normalizeOptionalId(body.parentId, 'parentId');

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
    studentId,
    parentId,
  };
}

/**
 * Strips personally identifiable fields from a generate request body when the
 * requesting user is a child (ageGroup === 'child').
 * Modifies the body object in place and also returns it for chaining.
 *
 * Fields removed: studentName, teacherName, className, period
 *
 * @param {Object} body           - The parsed generate request body
 * @param {string} userAgeGroup   - The ageGroup value from the authenticated user record
 * @returns {Object} The (mutated) body object
 */
export function stripChildPII(body, userAgeGroup) {
  if (userAgeGroup === 'child') {
    delete body.studentName;
    delete body.teacherName;
    delete body.className;
    delete body.period;
  }
  return body;
}

/**
 * Validates a dateOfBirth string for COPPA registration.
 * Rules: required string, YYYY-MM-DD format, valid calendar date, age 5-120, not future.
 *
 * Throws a descriptive Error with a user-facing message on any violation.
 * @param {unknown} value - Raw input value from the request body
 * @returns {string} The validated YYYY-MM-DD string
 * @throws {Error} If the value is missing, malformed, or out of the allowed age range
 */
export function validateRegistrationDateOfBirth(value) {
  if (value == null || value === '') {
    throw new Error('dateOfBirth is required.');
  }

  if (typeof value !== 'string') {
    throw new Error('dateOfBirth must be a string in YYYY-MM-DD format.');
  }

  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('dateOfBirth must be in YYYY-MM-DD format.');
  }

  const [year, month, day] = trimmed.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('dateOfBirth is not a valid calendar date.');
  }

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (parsed > todayUTC) {
    throw new Error('dateOfBirth cannot be in the future.');
  }

  // Calculate age (birthday-aware)
  let age = todayUTC.getUTCFullYear() - year;
  const birthdayThisYear = new Date(Date.UTC(todayUTC.getUTCFullYear(), month - 1, day));
  if (todayUTC < birthdayThisYear) age--;

  if (age < 5) {
    throw new Error('dateOfBirth results in an age below the minimum allowed (5).');
  }

  if (age > 120) {
    throw new Error('dateOfBirth results in an age above the maximum allowed (120).');
  }

  return trimmed;
}
