/**
 * @file src/questionBank/localQuestionBankAdapter.js
 * @description Local (in-memory + optional JSON file) adapter for the question bank.
 *
 * In local/dev mode the bank is held in memory for the lifetime of the process.
 * All public methods match the interface expected by questionBankHandler.js and
 * any future remote adapter so swapping storage is a one-file change.
 *
 * Interface:
 *   addQuestion(question)                → stored question with questionId + createdAt
 *   addIfNotExists(candidate, question)  → { stored, duplicate } — atomic dedupe + insert
 *   getQuestion(questionId)              → question | null
 *   listQuestions(filters)               → filtered array (AND-ed filters)
 *   questionExists(question)             → boolean  (dedupe check)
 *   incrementReuseCount(questionId)      → updated question | null
 */

import { randomUUID } from 'crypto';

/** In-memory store: Map<questionId, question> */
const _store = new Map();

/**
 * Normalises a string for case-insensitive comparison.
 * @param {unknown} val
 * @returns {string}
 */
function norm(val) {
  return typeof val === 'string' ? val.trim().toLowerCase() : '';
}

/**
 * Adds a question to the bank.
 * Caller must run questionExists() first and reject duplicates at the handler
 * layer; this function does NOT enforce dedupe itself (single-responsibility).
 *
 * @param {Object} question - Partial question object (no questionId / createdAt needed)
 * @returns {Object} The stored question with generated questionId and createdAt
 */
export function addQuestion(question) {
  const stored = {
    ...question,
    questionId: randomUUID(),
    reuseCount: typeof question.reuseCount === 'number' ? question.reuseCount : 0,
    createdAt: new Date().toISOString(),
  };
  _store.set(stored.questionId, stored);
  return { ...stored };
}

/**
 * Returns a single question by its ID, or null if not found.
 *
 * @param {string} questionId
 * @returns {Object|null}
 */
export function getQuestion(questionId) {
  const q = _store.get(questionId);
  return q ? { ...q } : null;
}

/**
 * Returns all questions matching the provided filters (AND-ed together).
 * Unrecognised filter keys are silently ignored.
 *
 * Supported filters: grade, subject, topic, difficulty, type
 * - grade is coerced to integer before comparison
 * - all string comparisons are case-insensitive trimmed
 *
 * @param {Object} [filters={}]
 * @returns {Object[]}
 */
export function listQuestions(filters = {}) {
  const results = [];

  for (const q of _store.values()) {
    if (filters.grade !== undefined && filters.grade !== null) {
      const filterGrade = Number(filters.grade);
      if (Number.isNaN(filterGrade) || q.grade !== filterGrade) continue;
    }
    if (filters.subject !== undefined && norm(q.subject) !== norm(filters.subject)) continue;
    if (filters.topic !== undefined && norm(q.topic) !== norm(filters.topic)) continue;
    if (filters.difficulty !== undefined && norm(q.difficulty) !== norm(filters.difficulty)) continue;
    if (filters.type !== undefined && norm(q.type) !== norm(filters.type)) continue;

    results.push({ ...q });
  }

  return results;
}

/**
 * Atomically checks for a duplicate and, if none exists, inserts the question.
 * Performing both operations together eliminates the TOCTOU race that would arise
 * from calling questionExists() and addQuestion() as two separate steps.
 *
 * @param {Object} candidate   - Dedupe key: must contain grade, subject, topic, type, question
 * @param {Object} newQuestion - Full question object to persist when no duplicate is found
 * @returns {{ stored: Object|null, duplicate: boolean }}
 *   stored    — the persisted question (with questionId + createdAt) on success, or null
 *   duplicate — true when an identical question already exists, false on success
 */
export function addIfNotExists(candidate, newQuestion) {
  if (questionExists(candidate)) {
    return { stored: null, duplicate: true };
  }
  const stored = addQuestion(newQuestion);
  return { stored, duplicate: false };
}

/**
 * Returns true when the store already contains a question whose
 * (grade, subject, topic, type, question-text) tuple matches the candidate.
 * Comparison is case-insensitive and trims surrounding whitespace.
 *
 * @param {Object} candidate - Must contain grade, subject, topic, type, question
 * @returns {boolean}
 */
export function questionExists(candidate) {
  const cGrade    = Number(candidate.grade);
  const cSubject  = norm(candidate.subject);
  const cTopic    = norm(candidate.topic);
  const cType     = norm(candidate.type);
  const cQuestion = norm(candidate.question);

  for (const q of _store.values()) {
    if (
      q.grade === cGrade &&
      norm(q.subject)  === cSubject &&
      norm(q.topic)    === cTopic &&
      norm(q.type)     === cType &&
      norm(q.question) === cQuestion
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Increments the reuseCount of a question by 1.
 * Called by the worksheet assembly layer each time a banked question is used.
 *
 * @param {string} questionId
 * @returns {Object|null} Updated question, or null if not found
 */
export function incrementReuseCount(questionId) {
  const q = _store.get(questionId);
  if (!q) return null;
  q.reuseCount = (q.reuseCount || 0) + 1;
  return { ...q };
}

/**
 * Clears all stored questions.
 * Exposed for use in unit tests only — do not call in production code.
 */
export function _clearStore() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('_clearStore must not be called in production.');
  }
  _store.clear();
}
