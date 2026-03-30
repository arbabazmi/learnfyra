/**
 * @file src/auth/index.js
 * @description Authentication adapter factory. Returns the correct adapter based
 * on the AUTH_MODE environment variable.
 *
 * Local dev:       AUTH_MODE unset (or 'mock') → mockAuthAdapter + oauthStubAdapter
 * AWS Lambda:      AUTH_MODE=cognito            → cognitoAdapter (Google OAuth via Cognito)
 */

import { mockAuthAdapter } from './mockAuthAdapter.js';
import { cognitoAdapter } from './cognitoAdapter.js';
import { oauthStubAdapter } from './oauthStubAdapter.js';

/**
 * Returns the active authentication adapter for the current runtime environment.
 * Used for email/password operations (register, login, logout, token refresh).
 *
 * @returns {typeof mockAuthAdapter | typeof cognitoAdapter}
 */
export function getAuthAdapter() {
  if (process.env.AUTH_MODE === 'cognito') {
    return cognitoAdapter;
  }
  return mockAuthAdapter;
}

/**
 * Returns the active OAuth adapter for the current runtime environment.
 * Used for OAuth initiation and callback handling.
 *
 * @returns {typeof oauthStubAdapter | typeof cognitoAdapter}
 */
export function getOAuthAdapter() {
  if (process.env.AUTH_MODE === 'cognito') {
    return cognitoAdapter;
  }
  return oauthStubAdapter;
}
