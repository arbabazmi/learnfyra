/**
 * @file backend/middleware/authMiddleware.js
 * @description Authentication middleware for Lambda handlers.
 * Extracts and verifies a Bearer JWT from the Authorization header.
 * Returns the decoded payload { sub, email, role } on success.
 * Throws a structured error with .statusCode set on failure so handlers
 * can respond with the correct HTTP status without extra branching.
 */

import { getAuthAdapter } from '../../src/auth/index.js';
import { getDbAdapter } from '../../src/db/index.js';

/**
 * Reads the Authorization header (case-insensitive), strips the "Bearer " prefix,
 * and verifies the token via the active auth adapter.
 *
 * @param {Object} event - API Gateway event or Express-shaped mock event
 * @returns {Promise<{sub: string, email: string, role: string}>} Decoded JWT payload
 * @throws {Error} With .statusCode = 401 when the header is missing or the token is invalid
 */
export async function validateToken(event) {
  const headers = event.headers || {};

  // Header names from API Gateway v1 are lowercased; accept both casings
  const authHeader =
    headers['Authorization'] ||
    headers['authorization'] ||
    null;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    throw err;
  }

  try {
    const authAdapter = getAuthAdapter();
    const decoded = authAdapter.verifyToken(token);
    return decoded;
  } catch {
    const err = new Error('Invalid or expired token.');
    err.statusCode = 401;
    throw err;
  }
}

/**
 * Asserts that the decoded token carries one of the allowed roles.
 * Throws a 403 Forbidden error if the role is not in the allowed list.
 *
 * @param {{ sub: string, email: string, role: string }} decoded - Decoded JWT payload
 * @param {string[]} allowedRoles - Roles that may access the resource
 * @returns {void}
 * @throws {Error} With .statusCode = 403 when the role is not permitted
 */
export function requireRole(decoded, allowedRoles) {
  if (!allowedRoles.includes(decoded.role)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

export { requireRole as assertRole };

/**
 * Asserts that an active parent-child link exists between the requesting parent
 * and the target child. Non-parent roles pass through without a DB check.
 *
 * Designed for handler use: call this when a parent tries to access a specific
 * student's data (e.g. progress, worksheets assigned to child).
 *
 * @param {{ sub: string, email: string, role: string }} decoded - Decoded JWT payload
 * @param {string} childId - The target student's userId from the request
 * @returns {Promise<void>}
 * @throws {Error} With .statusCode = 400 when childId is missing (parent only)
 * @throws {Error} With .statusCode = 403 when no active link exists (parent only)
 */
export async function assertParentLink(decoded, childId) {
  if (decoded.role !== 'parent') {
    return; // non-parents pass through — link check is parent-only
  }

  if (!childId) {
    const err = new Error('childId is required to access student data as a parent.');
    err.statusCode = 400;
    throw err;
  }

  const db = getDbAdapter();
  const links = await db.queryByField('parentLinks', 'parentId', decoded.sub);
  const activeLink = links.find((l) => l.childId === childId && l.status === 'active');

  if (!activeLink) {
    const err = new Error('Access denied: no active parent-child link for this student.');
    err.statusCode = 403;
    throw err;
  }
}
