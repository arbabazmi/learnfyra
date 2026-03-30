/**
 * @file src/auth/oauthStubAdapter.js
 * @description Local OAuth stub adapter for development.
 *
 * Satisfies the OAuth contract defined in M01-auth-identity-spec:
 *   POST /api/auth/oauth/:provider  → initiateOAuth(provider)
 *   GET  /api/auth/callback/:provider → handleCallback(provider, code, state)
 *
 * In local/mock mode this adapter:
 *   - Accepts any provider name in the supported list.
 *   - Returns a mock authorization URL for initiateOAuth so the frontend
 *     can display a redirect affordance without a real OAuth app.
 *   - Returns a mock user + JWT for handleCallback so the full round-trip
 *     can be exercised end-to-end locally without real credentials.
 *
 * AWS/production: replace this with a real OAuth flow wired to Cognito
 * Hosted UI or a direct PKCE flow. Set AUTH_MODE=cognito in the environment.
 */

import { randomUUID } from 'crypto';
import { getDbAdapter } from '../db/index.js';
import { signToken } from './tokenUtils.js';

const SUPPORTED_PROVIDERS = ['google', 'github'];

/**
 * Asserts that the provider name is supported.
 * @param {string} provider - OAuth provider identifier
 * @throws {Error} With .statusCode 400 if the provider is not supported
 */
function assertSupportedProvider(provider) {
  // Sanitize provider before using it in error messages or any string construction
  // to prevent injection of arbitrary user input into logs or generated values.
  const sanitized = typeof provider === 'string'
    ? provider.replace(/[^a-zA-Z0-9_-]/g, '')
    : '';

  if (!SUPPORTED_PROVIDERS.includes(sanitized)) {
    const err = new Error(
      `OAuth provider "${sanitized}" is not supported. ` +
      `Supported: ${SUPPORTED_PROVIDERS.join(', ')}.`
    );
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Stub OAuth adapter for local development.
 * All methods are async to match the future production adapter interface.
 */
export const oauthStubAdapter = {
  /**
   * Returns the OAuth provider's authorization URL so the client can redirect
   * the user to the provider's login page.
   *
   * Local dev: returns a fake URL — no real OAuth app credentials needed.
   *
   * @param {string} provider - 'google' | 'github'
   * @returns {Promise<{ authorizationUrl: string, state: string }>}
   * @throws {Error} With .statusCode 400 if the provider is unsupported
   */
  async initiateOAuth(provider) {
    // Sanitize before asserting so the sanitized value is used throughout
    const safeProvider = typeof provider === 'string'
      ? provider.replace(/[^a-zA-Z0-9_-]/g, '')
      : '';
    assertSupportedProvider(safeProvider);

    // In local mode, generate a state value and return a placeholder URL.
    // The state is echoed back at callback so CSRF protection can be validated
    // when a real provider is wired up.
    const state = randomUUID();
    const authorizationUrl =
      `https://stub-oauth.learnfyra.local/auth/${safeProvider}` +
      `?state=${state}&redirect_uri=http://localhost:3000/api/auth/callback/${safeProvider}`;

    return { authorizationUrl, state };
  },

  /**
   * Handles the OAuth callback. Looks up or creates the user record, then
   * issues a JWT.
   *
   * Local dev: accepts any non-empty code and returns a mock user.
   * The mock email is derived from the provider and code so test scenarios
   * can produce distinct users.
   *
   * @param {string} provider - 'google' | 'github'
   * @param {string} code - Authorization code returned by the provider
   * @param {string} [state] - State value for CSRF validation (ignored in stub)
   * @returns {Promise<{ userId: string, email: string, role: string, displayName: string, token: string }>}
   * @throws {Error} With .statusCode 400 if the provider is unsupported or code is missing
   */
  async handleCallback(provider, code, state) {
    // Sanitize before asserting so the sanitized value is used throughout
    const safeProvider = typeof provider === 'string'
      ? provider.replace(/[^a-zA-Z0-9_-]/g, '')
      : '';
    assertSupportedProvider(safeProvider);

    if (!code) {
      const err = new Error('OAuth authorization code is required.');
      err.statusCode = 400;
      throw err;
    }

    // Warning: CSRF state validation is intentionally skipped in the stub.
    // Production adapters MUST validate that `state` matches the value stored
    // in the user's session before exchanging the code.
    console.warn('[STUB] OAuth state validation skipped — production adapter must validate state');

    // In the stub, synthesize a deterministic email from the code so the same
    // code always maps to the same user (idempotent upsert).
    const mockEmail = `oauth-${safeProvider}-${code}@stub.learnfyra.local`;
    const db = getDbAdapter();
    const matches = await db.queryByField('users', 'email', mockEmail);

    let user;
    if (matches.length > 0) {
      // Returning OAuth user — strip passwordHash before issuing token
      const { passwordHash: _ignored, ...publicUser } = matches[0];
      user = publicUser;
    } else {
      // First-time OAuth user — create a record with the oauth authType
      const now = new Date().toISOString();
      const newUser = {
        userId: randomUUID(),
        email: mockEmail,
        passwordHash: null,
        role: 'student',
        displayName: `${safeProvider.charAt(0).toUpperCase() + safeProvider.slice(1)} User`,
        authType: `oauth:${safeProvider}`,
        createdAt: now,
        lastActiveAt: now,
      };
      await db.putItem('users', newUser);
      const { passwordHash: _ignored, ...publicUser } = newUser;
      user = publicUser;
    }

    const token = signToken({ sub: user.userId, email: user.email, role: user.role });

    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      token,
    };
  },
};
