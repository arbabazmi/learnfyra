/**
 * @file src/auth/index.js
 * @description Authentication adapter factory. Returns the correct adapter based
 * on the AUTH_MODE environment variable.
 *
 * Local dev (stub):   AUTH_MODE unset (or 'mock') → mockAuthAdapter + oauthStubAdapter
 * Local dev (real):   AUTH_MODE=google             → mockAuthAdapter + googleOAuthAdapter
 * AWS Lambda:         AUTH_MODE=cognito            → cognitoAdapter (Google OAuth via Cognito)
 */

import { mockAuthAdapter } from './mockAuthAdapter.js';
import { cognitoAdapter } from './cognitoAdapter.js';
import { oauthStubAdapter } from './oauthStubAdapter.js';
import { googleOAuthAdapter } from './googleOAuthAdapter.js';

/**
 * Returns the active authentication adapter for the current runtime environment.
 * Used for email/password operations (register, login, logout, token refresh).
 *
 * AUTH_MODE=cognito → cognitoAdapter
 * AUTH_MODE unset   → mockAuthAdapter (local dev, no credentials needed)
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
 * AUTH_MODE=cognito → cognitoAdapter        (Google OAuth via Cognito Hosted UI)
 * AUTH_MODE=google  → googleOAuthAdapter    (direct Google OAuth 2.0 + PKCE, requires GOOGLE_CLIENT_ID etc.)
 * AUTH_MODE unset   → oauthStubAdapter      (local stub, no credentials needed)
 *
 * @returns {typeof oauthStubAdapter | typeof googleOAuthAdapter | typeof cognitoAdapter}
 */
export function getOAuthAdapter() {
  if (process.env.AUTH_MODE === 'cognito') {
    return cognitoAdapter;
  }
  if (process.env.AUTH_MODE === 'google') {
    return googleOAuthAdapter;
  }
  return oauthStubAdapter;
}
