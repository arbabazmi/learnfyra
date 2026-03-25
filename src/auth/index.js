/**
 * @file src/auth/index.js
 * @description Authentication adapter factory. Returns the correct adapter based
 * on the AUTH_MODE environment variable.
 *
 * Local dev:  AUTH_MODE=mock (or unset) → mockAuthAdapter
 * AWS/prod:   AUTH_MODE=cognito          → Cognito adapter (not yet implemented)
 */

import { mockAuthAdapter } from './mockAuthAdapter.js';

/**
 * Returns the active authentication adapter for the current runtime environment.
 *
 * @returns {typeof mockAuthAdapter} The authentication adapter instance
 * @throws {Error} When AUTH_MODE=cognito (Cognito adapter not yet implemented)
 */
export function getAuthAdapter() {
  if (process.env.AUTH_MODE === 'cognito') {
    throw new Error(
      'Cognito adapter not yet implemented — set AUTH_MODE=mock for local dev'
    );
  }

  return mockAuthAdapter;
}
