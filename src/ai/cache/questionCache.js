/**
 * @file src/ai/cache/questionCache.js
 * @description In-memory question cache with TTL support.
 *
 * Cache key: grade:subject:questionType:difficulty (all lowercase)
 * Questions are stored in pools per key. Retrieval splices from the pool
 * to prevent reuse within the same session.
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export class QuestionCache {
  /**
   * @param {number} [ttlMs=3600000]
   */
  constructor(ttlMs = DEFAULT_TTL_MS) {
    /** @type {Map<string, { questions: Object[], expiresAt: number }>} */
    this._store = new Map();
    this._ttlMs = ttlMs;
  }

  /**
   * Builds the cache key from question parameters.
   * @param {number|string} grade
   * @param {string} subject
   * @param {string} questionType
   * @param {string} difficulty
   * @returns {string}
   */
  static buildKey(grade, subject, questionType, difficulty) {
    return `${grade}:${subject}:${questionType}:${difficulty}`.toLowerCase();
  }

  /**
   * Returns up to `count` cached questions, or null if fewer than `count` exist.
   * Retrieved questions are removed from the pool to avoid reuse.
   * @param {string} key
   * @param {number} [count=1]
   * @returns {Object[]|null}
   */
  get(key, count = 1) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    if (entry.questions.length < count) return null;
    return entry.questions.splice(0, count);
  }

  /**
   * Adds questions to the cache pool. Appends to an existing valid entry.
   * @param {string} key
   * @param {Object[]} questions
   */
  set(key, questions) {
    const existing = this._store.get(key);
    if (existing && Date.now() <= existing.expiresAt) {
      existing.questions.push(...questions);
    } else {
      this._store.set(key, {
        questions: [...questions],
        expiresAt: Date.now() + this._ttlMs,
      });
    }
  }

  /**
   * Returns how many questions are available for a key (0 if missing/expired).
   * @param {string} key
   * @returns {number}
   */
  count(key) {
    const entry = this._store.get(key);
    if (!entry || Date.now() > entry.expiresAt) return 0;
    return entry.questions.length;
  }

  /**
   * Removes a specific cache entry.
   * @param {string} key
   */
  delete(key) {
    this._store.delete(key);
  }

  /** Clears all cached entries. */
  flush() {
    this._store.clear();
  }

  /** @returns {number} Number of active cache keys */
  get size() {
    return this._store.size;
  }
}

/** Singleton instance shared across the application. */
export const questionCache = new QuestionCache();
