/**
 * @file src/cli/validator.js
 * @description Input validation functions for CLI prompts and batch config
 * @agent DEV
 */

const VALID_SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const VALID_FORMATS = ['PDF', 'Word (.docx)', 'HTML', 'All Three'];
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;
const MIN_GRADE = 1;
const MAX_GRADE = 10;

/**
 * Validates that a grade is between 1 and 10
 * @param {number} grade - Grade level to validate
 * @throws {Error} If grade is out of range
 * @returns {true}
 */
export function validateGrade(grade) {
  const num = Number(grade);
  if (!Number.isInteger(num) || num < MIN_GRADE || num > MAX_GRADE) {
    throw new Error(`Grade must be between ${MIN_GRADE} and ${MAX_GRADE}`);
  }
  return true;
}

/**
 * Validates that question count is within allowed range (5–10)
 * @param {number} count - Number of questions
 * @throws {Error} If count is out of range
 * @returns {true}
 */
export function validateQuestionCount(count) {
  const num = Number(count);
  if (!Number.isInteger(num) || num < MIN_QUESTIONS || num > MAX_QUESTIONS) {
    throw new Error(`Question count must be between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}`);
  }
  return true;
}

/**
 * Validates that a subject is one of the allowed subjects
 * @param {string} subject - Subject name
 * @throws {Error} If subject is not valid
 * @returns {true}
 */
export function validateSubject(subject) {
  if (!VALID_SUBJECTS.includes(subject)) {
    throw new Error(`Subject must be one of: ${VALID_SUBJECTS.join(', ')}`);
  }
  return true;
}

/**
 * Validates that a difficulty level is one of the allowed values
 * @param {string} difficulty - Difficulty level
 * @throws {Error} If difficulty is not valid
 * @returns {true}
 */
export function validateDifficulty(difficulty) {
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    throw new Error(`Difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`);
  }
  return true;
}

/**
 * Validates an entire worksheet options object (used for batch mode)
 * @param {Object} options - Worksheet options
 * @throws {Error} If any field is invalid
 * @returns {true}
 */
export function validateWorksheetOptions(options) {
  validateGrade(options.grade);
  validateSubject(options.subject);
  validateDifficulty(options.difficulty);
  validateQuestionCount(options.questionCount ?? options.count);

  if (!options.topic || typeof options.topic !== 'string' || !options.topic.trim()) {
    throw new Error('Topic must be a non-empty string');
  }

  return true;
}
