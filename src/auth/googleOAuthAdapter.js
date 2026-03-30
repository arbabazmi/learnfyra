/**
 * @file src/auth/googleOAuthAdapter.js
 * @description Real Google OAuth 2.0 adapter for local development and direct
 * (non-Cognito) deployments.
 *
 * Flow:
 *   initiateOAuth('google')
 *     → generates PKCE code_verifier + challenge + nonce state token
 *     → returns Google authorization URL with all required params
 *
 *   handleCallback('google', code, stateToken)
 *     → verifies the signed state token (prevents CSRF)
 *     → exchanges code + code_verifier for Google tokens (PKCE)
 *     → fetches user profile from Google userinfo endpoint
 *     → upserts user in DB, issues our own JWT
 *
 * Environment variables required:
 *   GOOGLE_CLIENT_ID       — OAuth 2.0 client ID from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET   — OAuth 2.0 client secret
 *   GOOGLE_REDIRECT_URI    — must match exactly what's registered in Google Cloud Console
 *                            e.g. http://localhost:3000/api/auth/callback/google
 */

import { randomBytes, createHash, randomUUID } from 'crypto';
import { getDbAdapter } from '../db/index.js';
import {
  signToken,
  signOAuthState,
  verifyOAuthState,
} from './tokenUtils.js';

const GOOGLE_AUTH_URL   = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// ---------------------------------------------------------------------------
// Env var guard
// ---------------------------------------------------------------------------

function assertGoogleEnvVars() {
  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
    .filter((k) => !process.env[k]);
  if (missing.length > 0) {
    const err = new Error(
      `Google OAuth adapter is not configured — missing env vars: ${missing.join(', ')}. ` +
      'Add them to your .env file.'
    );
    err.statusCode = 503;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Generates a PKCE code_verifier (43-char base64url string) and its
 * S256 code_challenge.
 * @returns {{ codeVerifier: string, codeChallenge: string }}
 */
function generatePKCE() {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

// ---------------------------------------------------------------------------
// Token exchange + userinfo
// ---------------------------------------------------------------------------

/**
 * Exchanges an authorization code for Google access + id tokens using PKCE.
 * @param {string} code
 * @param {string} codeVerifier
 * @returns {Promise<{ access_token: string, id_token: string }>}
 */
async function exchangeCodeForTokens(code, codeVerifier) {
  const body = new URLSearchParams({
    code,
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
    grant_type:    'authorization_code',
    code_verifier: codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Google token exchange failed: ${response.status} ${text}`);
    err.statusCode = 502;
    throw err;
  }

  return response.json();
}

/**
 * Fetches the authenticated user's profile from Google using an access token.
 * @param {string} accessToken
 * @returns {Promise<{ sub: string, email: string, name: string, picture: string }>}
 */
async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Google userinfo fetch failed: ${response.status} ${text}`);
    err.statusCode = 502;
    throw err;
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const googleOAuthAdapter = {
  /**
   * Builds the Google OAuth 2.0 authorization URL with PKCE and a signed state
   * token. Returns the URL and the state token (caller stores it for CSRF check).
   *
   * @param {string} provider - must be 'google'
   * @returns {Promise<{ authorizationUrl: string, state: string }>}
   */
  async initiateOAuth(provider) {
    if (provider !== 'google') {
      const err = new Error(`Provider "${provider}" is not supported by googleOAuthAdapter.`);
      err.statusCode = 400;
      throw err;
    }
    assertGoogleEnvVars();

    const { codeVerifier, codeChallenge } = generatePKCE();
    const nonce = randomUUID();

    // Sign state token — embeds nonce + codeVerifier, expires in 10 min
    const state = signOAuthState({ nonce, code_verifier: codeVerifier });

    const params = new URLSearchParams({
      client_id:             process.env.GOOGLE_CLIENT_ID,
      redirect_uri:          process.env.GOOGLE_REDIRECT_URI,
      response_type:         'code',
      scope:                 'openid email profile',
      access_type:           'online',
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
    });

    const authorizationUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    return { authorizationUrl, state };
  },

  /**
   * Handles the Google OAuth callback. Verifies the state token, exchanges the
   * code for tokens, fetches user info, upserts the user in the DB, and issues
   * a Learnfyra JWT.
   *
   * @param {string} provider - must be 'google'
   * @param {string} code - Authorization code from Google
   * @param {string} state - Signed state token returned by initiateOAuth
   * @returns {Promise<{ userId, email, role, displayName, token }>}
   */
  async handleCallback(provider, code, state) {
    if (provider !== 'google') {
      const err = new Error(`Provider "${provider}" is not supported by googleOAuthAdapter.`);
      err.statusCode = 400;
      throw err;
    }
    assertGoogleEnvVars();

    if (!code) {
      const err = new Error('OAuth authorization code is required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify signed state — prevents CSRF and recovers the code_verifier
    let statePayload;
    try {
      statePayload = verifyOAuthState(state);
    } catch {
      const err = new Error('OAuth state is invalid or expired. Please try signing in again.');
      err.statusCode = 400;
      throw err;
    }

    const { code_verifier: codeVerifier } = statePayload;

    // Exchange code for Google tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    // Fetch Google user profile
    const googleUser = await fetchGoogleUserInfo(tokens.access_token);

    if (!googleUser.email) {
      const err = new Error('Google did not return an email address. Ensure the "email" scope is requested.');
      err.statusCode = 502;
      throw err;
    }

    // Upsert user in local DB
    const db = getDbAdapter();
    const existing = await db.queryByField('users', 'email', googleUser.email);

    let user;
    if (existing.length > 0) {
      // Update lastActiveAt on returning user
      const updated = await db.updateItem(
        'users',
        existing[0].userId,
        { lastActiveAt: new Date().toISOString() }
      );
      const { passwordHash: _ph, ...publicUser } = updated || existing[0];
      user = publicUser;
    } else {
      // First-time Google sign-in — create user record
      const now = new Date().toISOString();
      const newUser = {
        userId:       randomUUID(),
        email:        googleUser.email,
        passwordHash: null,
        role:         'student',
        displayName:  googleUser.name || googleUser.email.split('@')[0],
        authType:     'oauth:google',
        googleSub:    googleUser.sub,
        picture:      googleUser.picture || null,
        createdAt:    now,
        lastActiveAt: now,
      };
      await db.putItem('users', newUser);
      const { passwordHash: _ph, ...publicUser } = newUser;
      user = publicUser;
    }

    const token = signToken({ sub: user.userId, email: user.email, role: user.role });

    return {
      userId:      user.userId,
      email:       user.email,
      role:        user.role,
      displayName: user.displayName,
      token,
    };
  },
};
