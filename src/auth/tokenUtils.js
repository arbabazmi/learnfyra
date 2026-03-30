/**
 * @file src/auth/tokenUtils.js
 * @description JWT utility functions for signing and verifying tokens.
 * Uses HS256 algorithm. Secret is read from JWT_SECRET environment variable
 * with a safe local-dev fallback.
 */

import jwt from 'jsonwebtoken';

const isAwsRuntime = process.env.APP_RUNTIME === 'aws';
const isProdLike = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  // Local dev often runs with NODE_ENV unset. Require explicit JWT_SECRET only
  // in production-like or AWS runtimes.
  if (isAwsRuntime || isProdLike) {
    throw new Error('JWT_SECRET environment variable is required in staging/production and AWS runtimes');
  }
  return 'learnfyra-local-dev-secret';
})();
const JWT_ALGORITHM = 'HS256';

/**
 * Signs a JWT with the given payload.
 *
 * @param {Object} payload - Claims to embed in the token (e.g. sub, email, role)
 * @param {string} [expiresIn='7d'] - Token expiry duration (jsonwebtoken notation)
 * @returns {string} Signed JWT string
 */
export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn,
  });
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws a JsonWebTokenError or TokenExpiredError (from jsonwebtoken) if
 * the token is invalid or has expired.
 *
 * @param {string} token - JWT string to verify
 * @returns {Object} Decoded payload
 * @throws {Error} If the token is invalid or expired
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

/**
 * Signs a refresh token for the given user payload.
 * Refresh tokens have a 'type: refresh' claim and a 30-day expiry.
 * They are used to obtain new access tokens via POST /api/auth/refresh.
 *
 * @param {Object} payload - Must include sub (userId), email, role
 * @returns {string} Signed refresh JWT string
 */
export function signRefreshToken(payload) {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: '30d' },
  );
}

/**
 * Verifies a refresh token and returns the decoded payload.
 * Throws if the token is invalid, expired, or is not a refresh token.
 *
 * @param {string} token - Refresh JWT string
 * @returns {Object} Decoded payload (includes sub, email, role, type)
 * @throws {Error} If the token is invalid, expired, or not a refresh token
 */
export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  if (decoded.type !== 'refresh') {
    const err = new Error('Token is not a refresh token.');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}

/**
 * Signs a short-lived (10 min) OAuth state token containing PKCE verifier and nonce.
 * Used to bind the authorization request to the callback in a stateless Lambda.
 *
 * @param {{ nonce: string, code_verifier: string }} payload
 * @returns {string} Signed JWT to use as the OAuth `state` parameter
 */
export function signOAuthState(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: '10m' });
}

/**
 * Verifies an OAuth state token and returns its payload.
 * Throws TokenExpiredError or JsonWebTokenError if invalid.
 *
 * @param {string} token
 * @returns {{ nonce: string, code_verifier: string }} Decoded state payload
 */
export function verifyOAuthState(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}
