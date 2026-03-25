/**
 * @file src/auth/tokenUtils.js
 * @description JWT utility functions for signing and verifying tokens.
 * Uses HS256 algorithm. Secret is read from JWT_SECRET environment variable
 * with a safe local-dev fallback.
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'learnfyra-local-dev-secret';
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
