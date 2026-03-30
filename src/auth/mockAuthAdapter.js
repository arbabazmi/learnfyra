/**
 * @file src/auth/mockAuthAdapter.js
 * @description Local authentication adapter backed by the localDbAdapter
 * (JSON files in data-local/). Handles user creation, lookup, password
 * verification, and JWT issuance.
 *
 * User schema stored in data-local/users.json:
 * {
 *   userId:       string (UUID v4),
 *   email:        string,
 *   passwordHash: string (bcrypt),
 *   role:         'student' | 'teacher' | 'parent',
 *   displayName:  string,
 *   authType:     'local:email' | 'oauth:google',
 *   createdAt:    ISO-8601 string,
 *   lastActiveAt: ISO-8601 string
 * }
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getDbAdapter } from '../../src/db/index.js';
import { signToken, verifyToken as verifyJwt, signRefreshToken, verifyRefreshToken } from './tokenUtils.js';

const USERS_TABLE = 'users';
const BCRYPT_ROUNDS = 10;

/**
 * Returns the raw user record (including passwordHash) for internal use.
 * @param {string} email - Email address to look up
 * @returns {Promise<Object|null>}
 */
async function findRawUserByEmail(email) {
  const db = getDbAdapter();
  const matches = await db.queryByField(USERS_TABLE, 'email', email.toLowerCase().trim());
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Strips the passwordHash from a user record before returning it to callers.
 * @param {Object} user - Raw user record
 * @returns {Object} Public user object (no passwordHash)
 */
function toPublicUser(user) {
  const { passwordHash, ...pub } = user;
  return pub;
}

/**
 * Local mock authentication adapter.
 * All methods are async to match the interface of the future Cognito adapter.
 */
export const mockAuthAdapter = {
  /**
   * Creates a new user account. Throws if the email address is already registered.
   *
   * @param {Object} params
   * @param {string} params.email - User's email address
   * @param {string} params.password - Plain-text password (will be hashed)
   * @param {'student'|'teacher'|'parent'} params.role - User role
   * @param {string} params.displayName - Display name
   * @returns {Promise<Object>} Created user object (without passwordHash)
   * @throws {Error} If the email is already registered
   */
  async createUser({ email, password, role, displayName }) {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await findRawUserByEmail(normalizedEmail);

    if (existing) {
      throw new Error(`Email already registered: ${normalizedEmail}`);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date().toISOString();

    const user = {
      userId: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      role,
      displayName,
      authType: 'local:email',
      createdAt: now,
      lastActiveAt: now,
    };

    const db = getDbAdapter();
    await db.putItem(USERS_TABLE, user);

    return toPublicUser(user);
  },

  /**
   * Finds a user by email address. Returns null if not found.
   * The returned object does NOT contain passwordHash.
   *
   * @param {string} email - Email address to look up
   * @returns {Promise<Object|null>} Public user object or null
   */
  async findUserByEmail(email) {
    const user = await findRawUserByEmail(email);
    return user ? toPublicUser(user) : null;
  },

  /**
   * Compares a plain-text password against a bcrypt hash.
   *
   * @param {string} plainPassword - Password the user supplied
   * @param {string} hashedPassword - Stored bcrypt hash
   * @returns {Promise<boolean>} True if the password matches
   */
  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  },

  /**
   * Issues a signed JWT for the given user.
   *
   * @param {Object} user - Public user object (must have userId, email, role)
   * @returns {string} Signed JWT string
   */
  generateToken(user) {
    return signToken({ sub: user.userId, email: user.email, role: user.role });
  },

  /**
   * Verifies a JWT and returns the decoded payload.
   * Throws if the token is invalid or expired.
   *
   * @param {string} token - JWT string
   * @returns {Object} Decoded payload
   * @throws {Error} If the token is invalid or expired
   */
  verifyToken(token) {
    return verifyJwt(token);
  },

  /**
   * Issues a signed refresh token for the given user.
   * The refresh token contains sub, email, role, and type='refresh'.
   * Use POST /api/auth/refresh with this token to obtain a new access token.
   *
   * @param {Object} user - Public user object (must have userId, email, role)
   * @returns {string} Signed refresh JWT string
   */
  generateRefreshToken(user) {
    return signRefreshToken({ sub: user.userId, email: user.email, role: user.role });
  },

  /**
   * Verifies a refresh token and issues a new short-lived (1h) access token.
   * Throws if the refresh token is invalid, expired, or not of type 'refresh'.
   *
   * @param {string} refreshToken - Refresh JWT string
   * @returns {string} New signed access token (1h expiry)
   * @throws {Error} If the refresh token is invalid or expired
   */
  refreshAccessToken(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    return signToken({ sub: decoded.sub, email: decoded.email, role: decoded.role }, '1h');
  },
};
