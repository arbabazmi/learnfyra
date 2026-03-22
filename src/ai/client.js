/**
 * @file src/ai/client.js
 * @description Anthropic SDK client — lazy singleton with deferred env validation.
 *   The client is NOT instantiated at import time, so importing this module never
 *   throws even when ANTHROPIC_API_KEY is absent (e.g., --help, unit tests without
 *   a real key). The error surfaces only when the first real API call is made.
 * @agent DEV
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Claude model ID — override with CLAUDE_MODEL env var */
export const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

/**
 * Max output tokens for a worksheet response.
 * 30 questions × ~250 tokens each + ~800 metadata = ~8,300.
 * Capped at 8192 (model maximum for claude-sonnet-4 series).
 */
export const MAX_TOKENS = 8192;

// ─── Lazy singleton ───────────────────────────────────────────────────────────

/** @type {import('@anthropic-ai/sdk').Anthropic | null} */
let _client = null;

/**
 * Returns (or creates) the shared Anthropic client instance.
 * Validates ANTHROPIC_API_KEY on first call; throws a human-readable error if missing.
 * @returns {import('@anthropic-ai/sdk').Anthropic}
 * @throws {Error} If ANTHROPIC_API_KEY is not set
 */
export function getAnthropicClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. ' +
        'Copy .env.example to .env and add your Anthropic API key.'
      );
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Named export preserved for backward compatibility with test mocks that do:
 *   jest.unstable_mockModule('../../src/ai/client.js', () => ({ anthropic: {...} }))
 *
 * In production, property accesses on this Proxy are forwarded to the lazy singleton.
 * In tests, the entire module is replaced by the mock factory, so this Proxy is never used.
 */
export const anthropic = new Proxy(
  /** @type {any} */ ({}),
  {
    get(_target, prop) {
      return getAnthropicClient()[prop];
    },
  }
);
