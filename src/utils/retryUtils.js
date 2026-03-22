/**
 * @file src/utils/retryUtils.js
 * @description Exponential backoff retry wrapper for API calls
 * @agent DEV
 */

/**
 * Wraps an async function with exponential backoff retry logic
 * @param {Function} fn - Async function to retry
 * @param {Object} opts - Retry options
 * @param {number} opts.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} opts.baseDelayMs - Initial delay in ms before first retry (default: 1000)
 * @param {Function} [opts.onRetry] - Called before each retry with (attempt, error)
 * @returns {Promise<*>} Resolves with the result of fn on success
 * @throws {Error} Throws the last error if all retries are exhausted
 */
export async function withRetry(fn, opts = {}) {
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const onRetry = opts.onRetry ?? null;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt < maxRetries) {
        if (onRetry) onRetry(attempt + 1, err);
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Sleeps for the specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
