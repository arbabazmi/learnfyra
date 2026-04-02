/**
 * @file src/auth/cognitoAdapter.js
 * @description Cognito-backed authentication adapter for Google OAuth.
 *
 * Google OAuth flow:
 *   initiateOAuth('google') → Cognito Hosted UI authorization URL
 *   handleCallback('google', code, state) → exchanges code at Cognito token endpoint
 *     → fetches user attributes from Cognito userInfo endpoint
 *     → issues our own HS256 JWT (sub = Cognito user sub, email, role='student')
 *
 * Email/password operations (createUser, verifyPassword):
 *   Not supported in Cognito mode — returns 503 to guide callers to use Google sign-in.
 *
 * Token operations (verifyToken, generateToken, generateRefreshToken, refreshAccessToken):
 *   Delegates to tokenUtils.js — we issue and verify our own JWTs.
 *
 * Environment variables required at runtime:
 *   COGNITO_DOMAIN          — full Cognito domain, e.g. https://learnfyra-dev.auth.us-east-1.amazoncognito.com
 *   COGNITO_APP_CLIENT_ID   — Cognito User Pool App Client ID
 *   OAUTH_CALLBACK_BASE_URL — base URL for callback redirect, e.g. https://dev.learnfyra.com
 */

import { randomBytes, createHash, randomUUID } from 'crypto';
import {
  signToken,
  verifyToken as verifyJwt,
  signRefreshToken,
  verifyRefreshToken,
  signOAuthState,
  verifyOAuthState,
} from './tokenUtils.js';

// Only Google is supported in this pass; GitHub/other providers deferred.
const SUPPORTED_PROVIDERS = new Set(['google']);

/**
 * Asserts that all required Cognito environment variables are present.
 * Throws a 503 error with a descriptive message if any are missing.
 *
 * @throws {Error} With .statusCode = 503 if required env vars are absent
 */
function assertCognitoEnvVars() {
  const missing = ['COGNITO_DOMAIN', 'COGNITO_APP_CLIENT_ID', 'OAUTH_CALLBACK_BASE_URL'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    const err = new Error(
      `Cognito adapter is not configured — missing env vars: ${missing.join(', ')}. ` +
      'Ensure the Lambda environment has the required Cognito configuration.'
    );
    err.statusCode = 503;
    throw err;
  }
}

/**
 * Generates a PKCE code_verifier and code_challenge pair (S256 method).
 * code_verifier: 32 cryptographically random bytes, base64url encoded (43 chars).
 * code_challenge: BASE64URL(SHA256(code_verifier)).
 *
 * @returns {{ verifier: string, challenge: string }}
 */
function generatePkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Exchanges an authorization code for Cognito tokens via the token endpoint.
 * Requires the PKCE code_verifier that was used to generate the code_challenge
 * in the original authorization request.
 *
 * @param {string} code         — Authorization code from the callback
 * @param {string} provider     — OAuth provider (e.g. 'google')
 * @param {string} codeVerifier — PKCE code verifier matching the original request
 * @returns {Promise<{ access_token: string, id_token: string, refresh_token?: string }>}
 * @throws {Error} With .statusCode = 401 if the exchange fails
 */
async function exchangeCodeForTokens(code, provider, codeVerifier) {
  const redirectUri = `${process.env.OAUTH_CALLBACK_BASE_URL}/api/auth/callback/${provider}`;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: process.env.COGNITO_APP_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  let response;
  try {
    response = await fetch(`${process.env.COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (err) {
    const fetchErr = new Error(`Network error contacting Cognito: ${err.message}`);
    fetchErr.statusCode = 502;
    throw fetchErr;
  }

  if (!response.ok) {
    // Log internally for debugging but do not expose Cognito error details to callers.
    const text = await response.text().catch(() => '');
    console.error(`[cognitoAdapter] Token exchange failed (${response.status}): ${text}`);
    const err = new Error('OAuth authentication failed.');
    err.statusCode = 401;
    throw err;
  }

  let tokenData;
  try {
    tokenData = await response.json();
  } catch {
    const parseErr = new Error('Invalid JSON response from provider.');
    parseErr.statusCode = 502;
    throw parseErr;
  }
  return tokenData;
}

/**
 * Fetches the authenticated user's profile attributes from the Cognito userInfo endpoint.
 *
 * @param {string} accessToken — Cognito access token from the token exchange
 * @returns {Promise<{ sub: string, email: string, name?: string, email_verified?: boolean }>}
 * @throws {Error} With .statusCode = 401 if the request fails
 */
async function fetchCognitoUserInfo(accessToken) {
  let response;
  try {
    response = await fetch(`${process.env.COGNITO_DOMAIN}/oauth2/userInfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    const fetchErr = new Error(`Network error contacting Cognito: ${err.message}`);
    fetchErr.statusCode = 502;
    throw fetchErr;
  }

  if (!response.ok) {
    const err = new Error(
      `Failed to fetch user info from Cognito (status ${response.status})`
    );
    err.statusCode = 401;
    throw err;
  }

  let userInfo;
  try {
    userInfo = await response.json();
  } catch {
    const parseErr = new Error('Invalid JSON response from provider.');
    parseErr.statusCode = 502;
    throw parseErr;
  }
  return userInfo;
}

/**
 * Cognito-backed authentication adapter.
 * Implements the same interface as mockAuthAdapter so handlers can swap adapters
 * via getAuthAdapter() without changes to business logic.
 */
export const cognitoAdapter = {

  // ── OAuth methods ──────────────────────────────────────────────────────────

  /**
   * Initiates a Google OAuth flow via Cognito Hosted UI.
   * Returns the authorization URL to which the client should redirect the user.
   *
   * @param {string} provider — Must be 'google'
   * @returns {Promise<{ authorizationUrl: string, state: string }>}
   * @throws {Error} statusCode=400 for unsupported provider, statusCode=503 for missing config
   */
  async initiateOAuth(provider) {
    if (!SUPPORTED_PROVIDERS.has(provider)) {
      const err = new Error(
        `OAuth provider "${provider}" is not supported. Supported: ${[...SUPPORTED_PROVIDERS].join(', ')}.`
      );
      err.statusCode = 400;
      throw err;
    }
    assertCognitoEnvVars();

    const redirectUri = `${process.env.OAUTH_CALLBACK_BASE_URL}/api/auth/callback/${provider}`;

    // PKCE: generate verifier + challenge so the callback can prove it initiated this flow.
    const { verifier, challenge } = generatePkce();

    // State: a short-lived signed JWT containing the PKCE verifier and a nonce.
    // The client reflects this value back in the callback query string.
    // verifyOAuthState() in handleCallback verifies the signature and expiry,
    // binding the callback to this specific authorization request (CSRF protection).
    const nonce = randomUUID();
    const state = signOAuthState({ nonce, code_verifier: verifier });

    // Build the Cognito Hosted UI authorization URL.
    // `identity_provider=Google` forces Google sign-in directly (bypasses Cognito's own login screen).
    // `code_challenge` + `code_challenge_method=S256` enable PKCE on the server side.
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.COGNITO_APP_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      identity_provider: 'Google',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const authorizationUrl = `${process.env.COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
    return { authorizationUrl, state };
  },

  /**
   * Handles the Google OAuth callback.
   * Verifies the signed state token (CSRF protection), extracts the PKCE
   * code_verifier, exchanges the authorization code for Cognito tokens,
   * retrieves user attributes, and issues our own HS256 JWT.
   * Stateless — does not write to any local DB.
   * Uses Cognito's `sub` as the stable userId in the JWT payload.
   *
   * @param {string} provider — Must be 'google'
   * @param {string} code     — Authorization code from the callback query string
   * @param {string} state    — Signed state JWT returned by initiateOAuth
   * @returns {Promise<{ userId: string, email: string, role: string, displayName: string, token: string }>}
   * @throws {Error} statusCode=400 for invalid state/provider/email; statusCode=401 if code exchange fails
   */
  async handleCallback(provider, code, state) {
    if (!SUPPORTED_PROVIDERS.has(provider)) {
      const err = new Error(
        `OAuth provider "${provider}" is not supported.`
      );
      err.statusCode = 400;
      throw err;
    }
    assertCognitoEnvVars();

    if (!code) {
      const err = new Error('OAuth authorization code is required.');
      err.statusCode = 400;
      throw err;
    }

    // CSRF protection: verify the signed state token and extract the PKCE verifier.
    // Any tampered, expired, or missing state rejects the callback before touching Cognito.
    if (!state) {
      const err = new Error('OAuth state parameter is required.');
      err.statusCode = 400;
      throw err;
    }
    let statePayload;
    try {
      statePayload = verifyOAuthState(state);
    } catch {
      const err = new Error('Invalid or expired OAuth state parameter.');
      err.statusCode = 400;
      throw err;
    }
    const { code_verifier: codeVerifier } = statePayload;

    // Exchange authorization code for Cognito tokens, proving PKCE ownership.
    const cognitoTokens = await exchangeCodeForTokens(code, provider, codeVerifier);

    // Fetch user profile from Cognito
    const userInfo = await fetchCognitoUserInfo(cognitoTokens.access_token);

    // Reject unverified email addresses (defence-in-depth — Cognito may also enforce this).
    if (userInfo.email_verified === false) {
      const err = new Error('Google account email is not verified.');
      err.statusCode = 400;
      throw err;
    }

    const email = typeof userInfo.email === 'string'
      ? userInfo.email.toLowerCase().trim()
      : null;

    if (!email) {
      const err = new Error(
        'Google account must have a verified email address to sign in.'
      );
      err.statusCode = 400;
      throw err;
    }

    // Use Cognito sub as the stable userId — no local DB write needed (stateless)
    const userId = userInfo.sub;
    const displayName = userInfo.name || email.split('@')[0];

    // Issue our own 1-hour access token
    const token = signToken({ sub: userId, email, role: 'student' }, '1h');

    return { userId, email, role: 'student', displayName, token };
  },

  // ── Token methods — uses tokenUtils (our own JWTs) ─────────────────────────

  /**
   * Verifies one of our HS256 JWTs. Works for both access and refresh tokens.
   *
   * @param {string} token
   * @returns {Object} Decoded payload
   * @throws {Error} If the token is invalid or expired
   */
  verifyToken(token) {
    return verifyJwt(token);
  },

  /**
   * Issues a signed 1-hour access token for the given user.
   *
   * @param {{ userId: string, email: string, role: string }} user
   * @returns {string} Signed JWT
   */
  generateToken(user) {
    return signToken({ sub: user.userId, email: user.email, role: user.role }, '1h');
  },

  /**
   * Issues a signed 30-day refresh token for the given user.
   *
   * @param {{ userId: string, email: string, role: string }} user
   * @returns {string} Signed refresh JWT
   */
  generateRefreshToken(user) {
    return signRefreshToken({ sub: user.userId, email: user.email, role: user.role });
  },

  /**
   * Verifies a refresh token and issues a new 1-hour access token.
   *
   * @param {string} refreshToken
   * @returns {string} New signed access token
   * @throws {Error} If the refresh token is invalid, expired, or not a refresh token
   */
  refreshAccessToken(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    return signToken({ sub: decoded.sub, email: decoded.email, role: decoded.role }, '1h');
  },

  // ── Email/password methods — not supported in Cognito mode ────────────────

  /**
   * Not supported in Cognito mode.
   * Local email/password registration is only available in development (AUTH_MODE=mock).
   *
   * @throws {Error} Always — statusCode=503
   */
  async createUser() {
    const err = new Error(
      'Email/password registration is not available in this environment. ' +
      'Please sign in with Google.'
    );
    err.statusCode = 503;
    throw err;
  },

  /**
   * Not supported in Cognito mode.
   *
   * @throws {Error} Always — statusCode=503
   */
  async findUserByEmail() {
    const err = new Error(
      'Email/password lookup is not available in this environment. ' +
      'Please sign in with Google.'
    );
    err.statusCode = 503;
    throw err;
  },

  /**
   * Not supported in Cognito mode.
   *
   * @throws {Error} Always — statusCode=503
   */
  async verifyPassword() {
    const err = new Error(
      'Password authentication is not available in this environment. ' +
      'Please sign in with Google.'
    );
    err.statusCode = 503;
    throw err;
  },
};
