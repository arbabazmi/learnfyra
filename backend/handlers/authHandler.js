/**
 * @file backend/handlers/authHandler.js
 * @description Lambda-compatible handler for authentication routes.
 *
 * Routes (differentiated by event.path suffix):
 *   POST /api/auth/register  — create a new user account
 *   POST /api/auth/login     — verify credentials and issue a JWT
 *   POST /api/auth/logout    — client-side token invalidation (always 200)
 *
 * Local dev:  AUTH_MODE unset → mockAuthAdapter (bcrypt + local JSON)
 * Lambda/AWS: AUTH_MODE=cognito → Cognito adapter (not yet implemented)
 */

import { randomUUID } from 'crypto';
import { getAuthAdapter } from '../../src/auth/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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
  const { email, password, role, displayName } = body || {};

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
  const { getDbAdapter } = await import('../../src/db/index.js');
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
 * Lambda handler — POST /api/auth/:action
 *
 * @param {Object} event - API Gateway event or Express-shaped mock event
 * @param {Object} [context] - Lambda context (optional in local dev)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  if (context?.callbackWaitsForEmptyEventLoop !== undefined) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

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

    if (path.endsWith('/register')) {
      return await handleRegister(body);
    }

    if (path.endsWith('/login')) {
      return await handleLogin(body);
    }

    if (path.endsWith('/logout')) {
      return handleLogout();
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('authHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};
