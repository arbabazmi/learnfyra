/**
 * @file src/questionBank/errorModel.js
 * @description Canonical error codes and builder for the Question Bank API.
 *
 * All question bank error responses carry a machine-readable `code` field in
 * addition to the human-readable `error` string. This allows the frontend and
 * future M03 pipeline code to branch on error type without string-matching.
 *
 * Usage:
 *   import { qbError } from '../../src/questionBank/errorModel.js';
 *   return { statusCode: e.statusCode, headers, body: JSON.stringify(qbError('NOT_FOUND')) };
 */

/**
 * Catalogue of all question bank error shapes.
 * Each entry maps a short symbolic key to an HTTP status code, a stable machine-
 * readable code string, and a default human-readable message.
 *
 * @type {Object.<string, {status: number, code: string, message: string}>}
 */
export const QB_ERRORS = {
  INVALID_GRADE:      { status: 400, code: 'QB_INVALID_GRADE',      message: 'grade must be an integer between 1 and 10.' },
  INVALID_SUBJECT:    { status: 400, code: 'QB_INVALID_SUBJECT',    message: 'subject must be one of: Math, ELA, Science, Social Studies, Health.' },
  INVALID_TYPE:       { status: 400, code: 'QB_INVALID_TYPE',       message: 'type must be one of the supported question types.' },
  INVALID_DIFFICULTY: { status: 400, code: 'QB_INVALID_DIFFICULTY', message: 'difficulty must be one of: Easy, Medium, Hard, Mixed.' },
  INVALID_TOPIC:      { status: 400, code: 'QB_INVALID_TOPIC',      message: 'topic must be a non-empty string.' },
  MISSING_FIELD:      { status: 400, code: 'QB_MISSING_FIELD',      message: 'Required field is missing.' },
  OPTIONS_INVALID:    { status: 400, code: 'QB_OPTIONS_INVALID',    message: 'options field is only valid for multiple-choice questions.' },
  DUPLICATE:          { status: 409, code: 'QB_DUPLICATE',          message: 'A question with identical content already exists.' },
  NOT_FOUND:          { status: 404, code: 'QB_NOT_FOUND',          message: 'Question not found.' },
  INTERNAL:           { status: 500, code: 'QB_INTERNAL',           message: 'Internal server error.' },
};

/**
 * Builds a structured error payload for a question bank error.
 *
 * The returned object is used as the JSON body of an error response.  It
 * always includes:
 *   - `code`  — stable string clients can switch on (e.g. "QB_NOT_FOUND")
 *   - `error` — human-readable message, optionally extended with `detail`
 *
 * @param {keyof QB_ERRORS} key    - One of the QB_ERRORS keys
 * @param {string}          [detail] - Optional extra context appended to the base message
 * @returns {{ statusCode: number, code: string, error: string }}
 */
export function qbError(key, detail) {
  const err = QB_ERRORS[key];
  if (!err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[qbError] Unknown error key: "${key}" — falling back to INTERNAL`);
    }
    const fallbackMessage = QB_ERRORS.INTERNAL.message;
    return {
      statusCode: 500,
      code: 'QB_INTERNAL',
      error: detail ? `${fallbackMessage} ${detail}`.trim() : fallbackMessage,
    };
  }
  return {
    statusCode: err.status,
    code: err.code,
    error: detail ? `${err.message} ${detail}`.trim() : err.message,
  };
}
