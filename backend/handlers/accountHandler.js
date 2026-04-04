/**
 * @file backend/handlers/accountHandler.js
 * @description Lambda-compatible handler for account lifecycle routes.
 *
 * Routes (differentiated by event.httpMethod + event.path):
 *   DELETE /api/account                            — request self-deletion (7-day grace period)
 *   POST   /api/account/cancel-deletion            — cancel a pending deletion
 *   DELETE /api/account/child/:childUserId         — parent-initiated immediate child deletion
 *
 * Deletion policy:
 *   - Self-deletion: marked pending_deletion, executes after 7 days
 *   - Parent-initiated child deletion: immediate (no grace period)
 *   - consentrecords table is NEVER deleted (COPPA 312.10 — 3-year retention)
 */

import { randomUUID } from 'crypto';
import { validateToken } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { verifyParentChildLink } from '../../src/utils/rbac.js';
import { cascadeDeleteUser, logDeletionEvent } from '../../src/account/accountDeletion.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'DELETE,POST,OPTIONS',
};

/** Grace period before a self-deletion request is executed. */
const DELETION_GRACE_DAYS = 7;

/**
 * Builds a standard error response.
 * @param {number} statusCode
 * @param {string} errorCode
 * @param {string} message
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function errorResponse(statusCode, errorCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: errorCode, message }),
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * DELETE /api/account
 * Schedules the authenticated user's account for deletion 7 days from now.
 *
 * Body: { confirmEmail: string }
 * Returns: { deletionId, scheduledAt, message, cancelUrl }
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleRequestDeletion(decoded, body) {
  const { confirmEmail } = body || {};

  if (!confirmEmail || typeof confirmEmail !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'confirmEmail is required.');
  }

  const db = getDbAdapter();
  const user = await db.getItem('users', decoded.sub);

  if (!user) {
    return errorResponse(404, 'USER_NOT_FOUND', 'User account not found.');
  }

  if (confirmEmail.toLowerCase().trim() !== (user.email || '').toLowerCase().trim()) {
    return errorResponse(400, 'EMAIL_MISMATCH', 'The confirmed email does not match the account email.');
  }

  if (user.accountStatus === 'pending_deletion') {
    return errorResponse(409, 'DELETION_ALREADY_SCHEDULED', 'Account is already scheduled for deletion.');
  }

  const now = new Date();
  const scheduledAt = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const deletionId = randomUUID();
  const deletionRequestedAt = now.toISOString();
  const deletionScheduledAt = Math.floor(scheduledAt.getTime() / 1000); // Unix timestamp

  await db.updateItem('users', decoded.sub, {
    accountStatus: 'pending_deletion',
    deletionScheduledAt,
    deletionRequestedAt,
    deletionId,
  });

  console.log(JSON.stringify({
    timestamp: deletionRequestedAt,
    level: 'info',
    event: 'DELETION_REQUESTED',
    userId: decoded.sub,
    deletionId,
    scheduledAt: scheduledAt.toISOString(),
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      deletionId,
      scheduledAt: scheduledAt.toISOString(),
      message: `Account scheduled for deletion. You have ${DELETION_GRACE_DAYS} days to cancel.`,
      cancelUrl: '/settings?cancel-deletion=true',
    }),
  };
}

/**
 * POST /api/account/cancel-deletion
 * Cancels a pending deletion, restoring the account to active status.
 *
 * Returns: { accountStatus: 'active', message }
 *
 * @param {Object} decoded - Verified JWT payload { sub, email, role }
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleCancelDeletion(decoded) {
  const db = getDbAdapter();
  const user = await db.getItem('users', decoded.sub);

  if (!user) {
    return errorResponse(404, 'USER_NOT_FOUND', 'User account not found.');
  }

  if (user.accountStatus !== 'pending_deletion') {
    return errorResponse(409, 'NOT_PENDING_DELETION', 'Account is not currently scheduled for deletion.');
  }

  await db.updateItem('users', decoded.sub, {
    accountStatus: 'active',
    deletionScheduledAt: null,
    deletionRequestedAt: null,
    deletionId: null,
  });

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'DELETION_CANCELLED',
    userId: decoded.sub,
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      accountStatus: 'active',
      message: 'Account deletion cancelled.',
    }),
  };
}

/**
 * DELETE /api/account/child/:childUserId
 * Parent-initiated immediate deletion of a linked child account.
 *
 * Body: { confirmChildEmail: string }
 * Returns: { message }
 *
 * @param {Object} decoded - Verified JWT payload of the parent { sub, email, role }
 * @param {string} childUserId - The child's userId from the path parameter
 * @param {Object} body - Parsed request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleDeleteChild(decoded, childUserId, body) {
  if (!childUserId || typeof childUserId !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'childUserId path parameter is required.');
  }

  const { confirmChildEmail } = body || {};

  if (!confirmChildEmail || typeof confirmChildEmail !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'confirmChildEmail is required.');
  }

  if (decoded.role !== 'parent') {
    return errorResponse(403, 'FORBIDDEN', 'Only parent accounts may delete child accounts.');
  }

  const db = getDbAdapter();

  // Verify active parent-child link exists
  try {
    await verifyParentChildLink(db, decoded.sub, childUserId);
  } catch (err) {
    return errorResponse(
      err.statusCode || 403,
      err.errorCode || 'CHILD_NOT_LINKED',
      err.message || 'No active parent-child link for this child.',
    );
  }

  // Verify confirmed email matches the child's actual email
  const child = await db.getItem('users', childUserId);
  if (!child) {
    return errorResponse(404, 'CHILD_NOT_FOUND', 'Child account not found.');
  }

  if (confirmChildEmail.toLowerCase().trim() !== (child.email || '').toLowerCase().trim()) {
    return errorResponse(400, 'EMAIL_MISMATCH', 'The confirmed child email does not match the account email.');
  }

  // Immediate cascade delete — no grace period for parent-initiated removal
  const result = await cascadeDeleteUser(childUserId);
  logDeletionEvent(childUserId, result);

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'CHILD_DELETED_BY_PARENT',
    parentUserId: decoded.sub,
    childUserId,
    compliance: ['COPPA', 'CCPA'],
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Child account and all data deleted.',
    }),
  };
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

/**
 * Lambda-compatible handler for account lifecycle routes.
 *
 * @param {Object} event - API Gateway event or Express-shaped mock event
 * @param {Object} [context] - Lambda context
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  if (context) context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);

    const path = event.path || event.routeKey || '';
    const method = event.httpMethod || 'DELETE';
    const params = event.pathParameters || {};

    let body = {};
    try {
      if (event.body) {
        body = JSON.parse(event.body);
      }
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body.');
    }

    // DELETE /api/account — self-deletion request
    if (path === '/api/account' && method === 'DELETE') {
      return await handleRequestDeletion(decoded, body);
    }

    // POST /api/account/cancel-deletion — cancel pending deletion
    if (path === '/api/account/cancel-deletion' && method === 'POST') {
      return await handleCancelDeletion(decoded);
    }

    // DELETE /api/account/child/:childUserId — parent deletes child immediately
    const childDeleteMatch = path.match(/^\/api\/account\/child\/([^/]+)$/);
    if (childDeleteMatch && method === 'DELETE') {
      const childUserId = params.childUserId || childDeleteMatch[1];
      return await handleDeleteChild(decoded, childUserId, body);
    }

    return errorResponse(404, 'ROUTE_NOT_FOUND', 'Route not found.');
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      handler: 'accountHandler',
      message: err.message,
    }));
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = statusCode < 500 || isDebug ? err.message : 'Internal server error.';
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.errorCode || 'INTERNAL_ERROR', message }),
    };
  }
};
