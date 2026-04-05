/**
 * @file src/ai/guardrails/tokenEstimator.js
 * @description Lightweight token-count estimator for guardrail prompt templates.
 *
 * Uses the standard 1 token ≈ 4 characters heuristic (conservative estimate).
 * This avoids a dependency on the full Anthropic tokenizer while still providing
 * a reliable upper-bound check for template size enforcement.
 */

/** Maximum allowed token count for a guardrail prompt template. */
export const TOKEN_LIMIT = 120;

/**
 * Estimates the token count of a text string using the 1 token ≈ 4 chars heuristic.
 *
 * @param {string} text - The text to estimate token count for.
 * @returns {number} Estimated token count (always a positive integer).
 */
export function estimateTokenCount(text) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
