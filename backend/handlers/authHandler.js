/**
 * @file backend/handlers/authHandler.js
 * @description Lambda-compatible handler for authentication routes.
 *
 * Routes (differentiated by event.path suffix):
 *   POST  /api/auth/register           — create a new user account
 *   POST  /api/auth/login              — verify credentials and issue a JWT
 *   POST  /api/auth/logout             — client-side token invalidation (always 200)
 *   POST  /api/auth/oauth/:provider    — begin OAuth flow, returns authorizationUrl
 *   GET   /api/auth/callback/:provider — handle OAuth callback, issues JWT
 *   PATCH /api/auth/verify-age         — submit dateOfBirth for OAuth users missing age
 *
 * Local dev:  AUTH_MODE unset → mockAuthAdapter (bcrypt + local JSON)
 *             OAuth:           oauthStubAdapter (stub, no real provider credentials needed)
 * Lambda/AWS: AUTH_MODE=cognito → Cognito adapter (not yet implemented)
 */

import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getAuthAdapter, getOAuthAdapter } from '../../src/auth/index.js';
import { getDbAdapter } from '../../src/db/index.js';
import { requestPasswordReset, resetPassword as executeReset } from '../../src/auth/passwordReset.js';
import { signToken } from '../../src/auth/tokenUtils.js';
import { calculateAge, getAgeGroup, validateDateOfBirth } from '../../src/utils/ageUtils.js';
import {
  createConsentRequest,
  getConsentByToken,
  grantConsent,
  revokeConsent,
} from '../../src/consent/consentStore.js';
import { sendConsentEmail } from '../../src/notifications/consentEmailService.js';

// Lazy DynamoDB client for GuestSessions writes (cold-start optimization)
let _guestDocClient;
function getGuestDocClient() {
  if (!_guestDocClient) {
    _guestDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }
  return _guestDocClient;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const VALID_ROLES = ['student', 'teacher', 'parent'];
const VALID_GUEST_ROLES = ['student', 'teacher', 'parent'];

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
 * Body: { email, password, role, displayName, dateOfBirth }
 *
 * COPPA age-gate logic:
 *   age < 13  → accountStatus='pending_consent', consentStatus='pending', no JWT returned
 *   age 13-17 → accountStatus='active', ageGroup='teen', consentStatus='not_required', JWT issued
 *   age 18+   → accountStatus='active', ageGroup='adult', consentStatus='not_required', JWT issued
 *
 * Returns (age >= 13): { userId, email, role, displayName, token } (200)
 * Returns (age < 13):  { userId, accountStatus, requiresConsent, message } (200)
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleRegister(body) {
  const { email: rawEmail, password, role, displayName, dateOfBirth } = body || {};
  const email = rawEmail ? rawEmail.toLowerCase().trim() : rawEmail;

  if (!email || !password || !role || !displayName) {
    return errorResponse(400, 'email, password, role, and displayName are required.');
  }

  if (!VALID_ROLES.includes(role)) {
    return errorResponse(400, `role must be one of: ${VALID_ROLES.join(', ')}.`);
  }

  // Validate dateOfBirth when provided
  let age = null;
  let ageGroup = null;
  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '') {
    const dobResult = validateDateOfBirth(dateOfBirth);
    if (!dobResult.valid) {
      return errorResponse(400, `dateOfBirth: ${dobResult.error}`);
    }
    age = dobResult.age;
    ageGroup = dobResult.ageGroup;
  }

  try {
    const authAdapter = getAuthAdapter();

    // For children (age < 13): store first name only per COPPA
    const safeDisplayName = (age !== null && age < 13)
      ? displayName.split(' ')[0]
      : displayName;

    // Determine account status fields from age
    const accountStatus = (age !== null && age < 13) ? 'pending_consent' : 'active';
    const consentStatus = (age !== null && age < 13) ? 'pending' : 'not_required';
    const resolvedAgeGroup = ageGroup || null;

    const user = await authAdapter.createUser({
      email,
      password,
      role,
      displayName: safeDisplayName,
      dateOfBirth: dateOfBirth || null,
      ageGroup: resolvedAgeGroup,
      accountStatus,
      consentStatus,
      parentEmail: null,
    });

    // Children under 13: do NOT issue a JWT — require parental consent first
    if (age !== null && age < 13) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          userId: user.userId,
          accountStatus: 'pending_consent',
          requiresConsent: true,
          message: 'Parental consent required.',
        }),
      };
    }

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
 * PATCH /api/auth/verify-age
 * For OAuth users who registered without a dateOfBirth.
 * Requires a valid Authorization header with a limited-scope JWT containing sub (userId).
 * Body: { dateOfBirth }
 *
 * Returns (age >= 13): { userId, ageGroup, accountStatus, token } (200)
 * Returns (age < 13):  { userId, accountStatus, requiresConsent, message } (200)
 *
 * @param {Object} body - Parsed request body
 * @param {Object} event - Full Lambda event (used to extract Authorization header)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleVerifyAge(body, event) {
  const { dateOfBirth } = body || {};

  if (!dateOfBirth) {
    return errorResponse(400, 'dateOfBirth is required.');
  }

  const dobResult = validateDateOfBirth(dateOfBirth);
  if (!dobResult.valid) {
    return errorResponse(400, `dateOfBirth: ${dobResult.error}`);
  }

  // Extract userId from the Authorization header JWT
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return errorResponse(401, 'Authorization header with Bearer token is required.');
  }

  let decoded;
  try {
    const authAdapter = getAuthAdapter();
    decoded = authAdapter.verifyToken(token);
  } catch {
    return errorResponse(401, 'Invalid or expired token.');
  }

  const userId = decoded.sub;
  if (!userId) {
    return errorResponse(401, 'Token is missing subject claim.');
  }

  const { age, ageGroup } = dobResult;
  const accountStatus = age < 13 ? 'pending_consent' : 'active';
  const consentStatus = age < 13 ? 'pending' : 'not_required';

  const db = getDbAdapter();
  await db.updateItem('users', userId, {
    dateOfBirth,
    ageGroup,
    accountStatus,
    consentStatus,
  });

  if (age < 13) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        userId,
        accountStatus: 'pending_consent',
        requiresConsent: true,
        message: 'Parental consent required.',
      }),
    };
  }

  // Fetch updated user to build a fresh token
  const updatedUser = await db.getItem('users', userId);
  const authAdapter = getAuthAdapter();
  const newToken = authAdapter.generateToken(updatedUser || { userId, sub: userId });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      userId,
      ageGroup,
      accountStatus: 'active',
      token: newToken,
    }),
  };
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

  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.length > 4096) {
    return errorResponse(400, 'Invalid refresh token format.');
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

    // Best-effort: upsert user record in DynamoDB so LearnfyraUsers is populated.
    // OAuth (Cognito) adapter is stateless — it never writes user records.
    // We do it here so dashboards, analytics, and progress tracking can look up users.
    try {
      const db = getDbAdapter();
      const now = new Date().toISOString();
      const existing = await db.queryByField('users', 'email', result.email);

      if (existing.length > 0) {
        // Returning user — update lastActiveAt
        await db.updateItem('users', existing[0].userId, { lastActiveAt: now });
      } else {
        // New OAuth user — create full record
        await db.putItem('users', {
          userId: result.userId,
          email: result.email,
          role: result.role,
          displayName: result.displayName,
          authType: `oauth:${provider}`,
          createdAt: now,
          lastActiveAt: now,
        });
      }
    } catch (dbErr) {
      // Non-fatal: login still succeeds even if the user record write fails
      console.error('authHandler OAuth user upsert failed (non-fatal):', dbErr.message || dbErr);
    }

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
 * POST /api/auth/guest
 * Issues a 30-day guest JWT for unauthenticated users.
 * Creates a GuestSessions DynamoDB record to track worksheet usage.
 * Body: { role: "student" | "teacher" | "parent" }
 * Returns: { guestToken, guestId, expiresAt } + Set-Cookie header
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleGuest(body) {
  const { role } = body || {};

  if (!role || !VALID_GUEST_ROLES.includes(role)) {
    return errorResponse(400, `role is required and must be one of: ${VALID_GUEST_ROLES.join(', ')}.`);
  }

  const guestId = `guest_${randomUUID()}`;
  const guestRole = `guest-${role}`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttlSeconds = 2592000; // 30 days
  const expiresAtUnix = nowSeconds + ttlSeconds;
  const expiresAt = new Date(expiresAtUnix * 1000).toISOString();

  const guestJwt = signToken(
    {
      sub: guestId,
      role: guestRole,
      token_use: 'guest',
      iss: 'learnfyra-guest-issuer',
    },
    '30d',
  );

  // Write GuestSessions record — worksheetIds intentionally omitted (DynamoDB
  // does not support empty Sets; created on first ADD in generateHandler).
  const tableName = process.env.GUEST_SESSIONS_TABLE;
  if (tableName) {
    await getGuestDocClient().send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: `GUEST#${guestId}`,
        guestId,
        role: guestRole,
        createdAt: new Date().toISOString(),
        ttl: expiresAtUnix,
      },
    }));
  }

  const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
  const cookieParts = [
    `guestToken=${guestJwt}`,
    'SameSite=Strict',
    'Secure',
    `Max-Age=${ttlSeconds}`,
    'Path=/',
  ];
  // Only add Domain directive for non-localhost (avoids cookie issues in local dev)
  if (cookieDomain !== 'localhost') {
    cookieParts.push(`Domain=${cookieDomain}`);
  }

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Set-Cookie': cookieParts.join('; '),
    },
    body: JSON.stringify({ guestToken: guestJwt, guestId, expiresAt }),
  };
}

/**
 * POST /api/auth/request-consent
 * Initiates a parental consent request for a child account.
 * Body: { childUserId, parentEmail }
 *
 * Returns: { consentRequestId, message, expiresAt } (200)
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleRequestConsent(body) {
  const { childUserId, parentEmail: rawParentEmail } = body || {};

  if (!childUserId || typeof childUserId !== 'string') {
    return errorResponse(400, 'childUserId is required.');
  }

  if (!rawParentEmail || typeof rawParentEmail !== 'string') {
    return errorResponse(400, 'parentEmail is required.');
  }

  const parentEmail = rawParentEmail.toLowerCase().trim();
  if (!parentEmail) {
    return errorResponse(400, 'parentEmail must be a valid email address.');
  }

  const db = getDbAdapter();
  const user = await db.getItem('users', childUserId);

  if (!user) {
    return errorResponse(404, 'Child user not found.');
  }

  if (user.accountStatus !== 'pending_consent') {
    return errorResponse(400, 'This account does not require parental consent.');
  }

  // Create consent record
  const record = await createConsentRequest({
    childUserId,
    childEmail: user.email,
    parentEmail,
  });

  // Store parentEmail on the user record so it is accessible later
  await db.updateItem('users', childUserId, { parentEmail });

  // Build consent URL — safe for dev (console) and prod (SES, future)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const consentUrl = `${frontendUrl}/auth/parental-consent?token=${record.consentToken}`;

  // Fire consent email (console in dev)
  await sendConsentEmail({
    parentEmail,
    childDisplayName: user.displayName || 'your child',
    consentUrl,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      consentRequestId: record.consentId,
      message: 'Consent email sent',
      expiresAt: new Date(record.expiresAt * 1000).toISOString(),
    }),
  };
}

/**
 * POST /api/auth/verify-consent
 * Called when a parent clicks the consent link and approves.
 * Body: { consentToken, parentName, parentRelationship }
 *
 * Returns: { childUserId, accountStatus, message } (200)
 *
 * @param {Object} body  - Parsed request body
 * @param {Object} event - Full Lambda event (used to extract IP + user-agent)
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleVerifyConsent(body, event) {
  const { consentToken, parentName, parentRelationship } = body || {};

  if (!consentToken || typeof consentToken !== 'string') {
    return errorResponse(400, 'consentToken is required.');
  }

  const record = await getConsentByToken(consentToken);

  if (!record) {
    return errorResponse(404, 'Consent token not found or already used.');
  }

  if (record.status !== 'pending') {
    return errorResponse(400, `Consent record is already ${record.status}.`);
  }

  // Check expiry (expiresAt is a Unix timestamp)
  const nowUnix = Math.floor(Date.now() / 1000);
  if (record.expiresAt !== null && record.expiresAt < nowUnix) {
    return errorResponse(410, 'Consent token has expired. Please request a new consent email.');
  }

  // Extract IP and user-agent from event headers
  const headers = event.headers || {};
  const ipAddress = headers['x-forwarded-for'] || headers['x-real-ip'] || null;
  const userAgent = headers['user-agent'] || headers['User-Agent'] || null;

  // Grant consent — removes pending TTL, sets status=granted
  await grantConsent(record.consentId, {
    parentName: parentName || null,
    parentRelationship: parentRelationship || null,
    ipAddress,
    userAgent,
  });

  // Activate child account
  const db = getDbAdapter();
  await db.updateItem('users', record.childUserId, {
    accountStatus: 'active',
    consentStatus: 'granted',
  });

  // Create parent-child link if a parentEmail-matched parent account exists
  try {
    const parentMatches = await db.queryByField('users', 'email', record.parentEmail);
    if (parentMatches.length > 0) {
      const parent = parentMatches[0];
      const now = new Date().toISOString();
      await db.putItem('parentchildlinks', {
        PK: `USER#${parent.userId}`,
        SK: `CHILD#${record.childUserId}`,
        parentId: parent.userId,
        childId: record.childUserId,
        linkedAt: now,
        linkMethod: 'consent-flow',
        status: 'active',
        revokedAt: null,
        childPK: `USER#${record.childUserId}`,
        parentSK: `PARENT#${parent.userId}`,
      });
    }
  } catch (linkErr) {
    // Non-fatal: account is activated even if the parent link write fails
    console.error('handleVerifyConsent parent-child link write failed (non-fatal):', linkErr.message || linkErr);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      childUserId: record.childUserId,
      accountStatus: 'active',
      message: 'Consent verified. Child account is now active.',
    }),
  };
}

/**
 * POST /api/auth/deny-consent
 * Called when a parent declines the consent request.
 * Body: { consentToken }
 *
 * Returns: { message } (200)
 *
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleDenyConsent(body) {
  const { consentToken } = body || {};

  if (!consentToken || typeof consentToken !== 'string') {
    return errorResponse(400, 'consentToken is required.');
  }

  const record = await getConsentByToken(consentToken);

  if (!record) {
    return errorResponse(404, 'Consent token not found.');
  }

  // Update consent status to denied
  const db = getDbAdapter();
  await db.updateItem('consentrecords', record.consentId, {
    status: 'denied',
    revokedAt: new Date().toISOString(),
  });

  // Delete the child user account — COPPA requires data deletion on denial
  try {
    await db.deleteItem('users', record.childUserId);
  } catch (delErr) {
    // If the DB adapter does not support deleteItem, mark as deleted
    try {
      await db.updateItem('users', record.childUserId, {
        accountStatus: 'deleted',
        deletedAt: new Date().toISOString(),
      });
    } catch (updateErr) {
      console.error('handleDenyConsent child account deletion failed (non-fatal):', updateErr.message || updateErr);
    }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Consent denied. Child data has been deleted.' }),
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

    if (path.endsWith('/verify-age') && method === 'PATCH') {
      return await handleVerifyAge(body, event);
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

    if (path.endsWith('/guest')) {
      return await handleGuest(body);
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

    if (path.endsWith('/request-consent') && method === 'POST') {
      return await handleRequestConsent(body);
    }

    if (path.endsWith('/verify-consent') && method === 'POST') {
      return await handleVerifyConsent(body, event);
    }

    if (path.endsWith('/deny-consent') && method === 'POST') {
      return await handleDenyConsent(body);
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('authHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = (statusCode < 500 || isDebug) ? err.message : 'Internal server error.';
    const body = { error: message };
    if (isDebug) {
      body._debug = { stack: err.stack, handler: 'authHandler', statusCode, timestamp: new Date().toISOString() };
    }
    return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
  }
};
