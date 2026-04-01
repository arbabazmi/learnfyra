/**
 * @file backend/handlers/authHandler.js
 * @description Lambda-compatible handler for authentication routes.
 *
 * Routes (differentiated by event.path suffix):
 *   POST /api/auth/register           — create a new user account
 *   POST /api/auth/login              — verify credentials and issue a JWT
 *   POST /api/auth/logout             — client-side token invalidation (always 200)
 *   POST /api/auth/oauth/:provider    — begin OAuth flow, returns authorizationUrl
 *   GET  /api/auth/callback/:provider — handle OAuth callback, issues JWT
 *
 * Local dev:  AUTH_MODE unset → mockAuthAdapter (bcrypt + local JSON)
 *             OAuth:           oauthStubAdapter (stub, no real provider credentials needed)
 * Lambda/AWS: AUTH_MODE=cognito → Cognito adapter (not yet implemented)
 */

import { randomUUID } from 'crypto';
import { getAuthAdapter, getOAuthAdapter } from '../../src/auth/index.js';
import { getDbAdapter } from '../../src/db/index.js';
import { requestPasswordReset, resetPassword as executeReset } from '../../src/auth/passwordReset.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const VALID_ROLES = ['student', 'teacher', 'parent'];

/**
 * Builds a standard error response.
 * @param {number} statusCode
 * @param {string} message
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * POST /api/auth/register
 * Body: { email, password, role, displayName }
 * Returns: { userId, email, role, displayName, token } (200)
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleRegister(body) {
  const { email: rawEmail, password, role, displayName } = body || {};
  const email = rawEmail ? rawEmail.toLowerCase().trim() : rawEmail;

  if (!email || !password || !role || !displayName) {
    return errorResponse(400, 'email, password, role, and displayName are required.');
  }

  if (!VALID_ROLES.includes(role)) {
    return errorResponse(400, `role must be one of: ${VALID_ROLES.join(', ')}.`);
  }

  try {
    const authAdapter = getAuthAdapter();
    const user = await authAdapter.createUser({ email, password, role, displayName });
    const token = authAdapter.generateToken(user);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        userId: user.userId,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        token,
      }),
    };
  } catch (err) {
    // Email already registered — createUser throws with this message pattern
    if (err.message && err.message.startsWith('Email already registered')) {
      return errorResponse(409, 'An account with that email already exists.');
    }
    throw err;
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { userId, email, role, displayName, token } (200)
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleLogin(body) {
  const { email, password } = body || {};

  if (!email || !password) {
    return errorResponse(400, 'email and password are required.');
  }

  const authAdapter = getAuthAdapter();

  // findUserByEmail returns a public user (no passwordHash); we need the raw
  // record to verify the password. The mock adapter exposes verifyPassword
  // separately so we look the raw user up via queryByField on the db adapter.
  const db = getDbAdapter();
  const matches = await db.queryByField('users', 'email', email.toLowerCase().trim());
  const rawUser = matches.length > 0 ? matches[0] : null;

  if (!rawUser) {
    return errorResponse(401, 'Invalid email or password.');
  }

  const valid = await authAdapter.verifyPassword(password, rawUser.passwordHash);
  if (!valid) {
    return errorResponse(401, 'Invalid email or password.');
  }

  // Build public user (strip passwordHash) then issue token
  const { passwordHash: _ignored, ...publicUser } = rawUser;
  const token = authAdapter.generateToken(publicUser);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      userId: publicUser.userId,
      email: publicUser.email,
      role: publicUser.role,
      displayName: publicUser.displayName,
      token,
    }),
  };
}

/**
 * POST /api/auth/logout
 * Token invalidation is client-side for MVP — always returns 200.
 *
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function handleLogout() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Logged out.' }),
  };
}

/**
 * POST /api/auth/refresh
 * Body: { refreshToken: string }
 * Returns: { token: string } — a new short-lived (1h) access token (200)
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleRefresh(body) {
  const { refreshToken } = body || {};

  if (!refreshToken) {
    return errorResponse(400, 'refreshToken is required.');
  }

  try {
    const authAdapter = getAuthAdapter();
    const token = authAdapter.refreshAccessToken(refreshToken);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ token }),
    };
  } catch {
    return errorResponse(401, 'Invalid or expired refresh token.');
  }
}

/**
 * POST /api/auth/oauth/:provider
 * Initiates an OAuth flow. Returns the provider's authorization URL so the
 * client can redirect the user.
 * Body: optional (provider is taken from the URL path)
 * Returns: { authorizationUrl, state } (200)
 *
 * @param {string} provider - OAuth provider identifier ('google' | 'github')
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleOAuthInitiate(provider) {
  if (!provider) {
    return errorResponse(400, 'OAuth provider is required.');
  }

  const oauthAdapter = getOAuthAdapter();
  const result = await oauthAdapter.initiateOAuth(provider);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result),
  };
}

/**
 * GET /api/auth/callback/:provider
 * Handles the OAuth provider callback. Accepts the authorization code,
 * looks up or creates the user, and issues a JWT.
 * Query params: { code, state }
 * Returns: { userId, email, role, displayName, token } (200)
 *
 * @param {string} provider - OAuth provider identifier ('google' | 'github')
 * @param {Object} queryStringParameters - Query params from the callback URL
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 *
 * @note OAuth state parameter CSRF validation is the responsibility of the
 * production adapter. The stub adapter skips it — see oauthStubAdapter.js.
 */
async function handleOAuthCallback(provider, queryStringParameters) {
  const frontendUrl = process.env.OAUTH_CALLBACK_BASE_URL || process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

  if (!provider) {
    return redirectToFrontend(frontendUrl, null, 'OAuth provider is required.');
  }

  const { code, state, error_description } = queryStringParameters || {};

  if (error_description) {
    return redirectToFrontend(frontendUrl, null, error_description);
  }

  if (!code) {
    return redirectToFrontend(frontendUrl, null, 'OAuth authorization code is required.');
  }

  try {
    const oauthAdapter = getOAuthAdapter();
    const result = await oauthAdapter.handleCallback(provider, code, state);

    return redirectToFrontend(frontendUrl, result, null);
  } catch (err) {
    return redirectToFrontend(frontendUrl, null, err.message || 'Authentication failed.');
  }
}

/**
 * Builds a 302 redirect response to the frontend auth callback page.
 * On success: redirects to /auth/callback?token=...&user=...
 * On error:   redirects to /?authError=...
 */
function redirectToFrontend(frontendUrl, result, errorMsg) {
  if (result && result.token) {
    const user = JSON.stringify({
      userId: result.userId,
      email: result.email,
      role: result.role,
      displayName: result.displayName,
    });
    const params = new URLSearchParams({ token: result.token, user });
    return {
      statusCode: 302,
      headers: { ...corsHeaders, Location: `${frontendUrl}/auth/callback?${params.toString()}` },
      body: '',
    };
  }

  const msg = encodeURIComponent(errorMsg || 'Authentication failed');
  return {
    statusCode: 302,
    headers: { ...corsHeaders, Location: `${frontendUrl}/?authError=${msg}` },
    body: '',
  };
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always returns 200 — never reveals if the email exists.
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleForgotPassword(body) {
  const { email } = body || {};

  if (!email) {
    return errorResponse(400, 'email is required.');
  }

  try {
    await requestPasswordReset(email);
  } catch {
    // Swallow errors — never reveal whether the email exists
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'If an account with that email exists, a password reset link has been sent.',
    }),
  };
}

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 * Returns 200 on success, 400 on invalid/expired/used token.
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleResetPassword(body) {
  const { token: rawToken, newPassword } = body || {};

  if (!rawToken || !newPassword) {
    return errorResponse(400, 'token and newPassword are required.');
  }

  // Validate token is a UUID v4 format (prevents NoSQL injection / oversized input)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(rawToken)) {
    return errorResponse(400, 'Invalid token format.');
  }

  const token = rawToken.toLowerCase().trim();

  if (newPassword.length < 8) {
    return errorResponse(400, 'Password must be at least 8 characters.');
  }

  try {
    await executeReset(token, newPassword);
  } catch (err) {
    const code = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 400;
    return errorResponse(code, err.message || 'Password reset failed.');
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Password has been reset successfully.' }),
  };
}

/**
 * Lambda handler — POST /api/auth/:action
 *
 * @param {Object} event - API Gateway event or Express-shaped mock event
 * @param {Object} [context] - Lambda context (optional in local dev)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return errorResponse(400, 'Invalid JSON in request body.');
    }

    const path = event.path || event.routeKey || '';
    const method = event.httpMethod || 'POST';

    if (path.endsWith('/register')) {
      return await handleRegister(body);
    }

    if (path.endsWith('/login')) {
      return await handleLogin(body);
    }

    if (path.endsWith('/logout')) {
      return handleLogout();
    }

    if (path.endsWith('/refresh')) {
      return await handleRefresh(body);
    }

    if (path.endsWith('/forgot-password')) {
      return await handleForgotPassword(body);
    }

    if (path.endsWith('/reset-password')) {
      return await handleResetPassword(body);
    }

    // POST /api/auth/oauth/:provider — initiate OAuth flow
    const oauthInitMatch = path.match(/\/oauth\/([^/]+)$/);
    if (oauthInitMatch && method === 'POST') {
      return await handleOAuthInitiate(oauthInitMatch[1]);
    }

    // GET /api/auth/callback/:provider — handle OAuth callback
    const callbackMatch = path.match(/\/callback\/([^/]+)$/);
    if (callbackMatch && method === 'GET') {
      return await handleOAuthCallback(
        callbackMatch[1],
        event.queryStringParameters || {},
      );
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('authHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
