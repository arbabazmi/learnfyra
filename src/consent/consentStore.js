/**
 * @file src/consent/consentStore.js
 * @description COPPA consent record storage — immutable audit trail retained 3 years.
 *
 * Uses the DB adapter pattern (localDbAdapter in dev, dynamoDbAdapter in AWS)
 * via getDbAdapter(). All consent records are written to the 'consentrecords'
 * logical table (resolves to LearnfyraConsentRecords-{env} in DynamoDB).
 *
 * Consent record lifecycle:
 *   pending  → parent receives email with consentToken
 *   granted  → parent confirmed via email-plus flow
 *   revoked  → parent or admin revoked consent
 *   expired  → never updated; callers check expiresAt vs now
 *
 * Retention: expiresAt TTL (48 h) applies to pending records only.
 * All records retain a retainUntil Unix timestamp (3 years) for audit purposes.
 */

import crypto from 'crypto';
import { getDbAdapter } from '../db/index.js';

const TABLE_KEY = 'consentrecords';

/**
 * Creates a new consent request record for a child user.
 * Status is set to 'pending' and a one-time consentToken is generated for
 * the parent email link. The record expires after 48 hours if not actioned.
 *
 * @param {Object} params
 * @param {string} params.childUserId - UUID of the child's user account
 * @param {string} params.childEmail  - Child's registered email address
 * @param {string} params.parentEmail - Parent email address to send consent request to
 * @returns {Promise<Object>} The full consent record as stored
 */
export async function createConsentRequest({ childUserId, childEmail, parentEmail }) {
  const db = getDbAdapter();
  const consentId = crypto.randomUUID();
  const consentToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const nowUnix = Math.floor(Date.now() / 1000);

  const record = {
    consentId,
    consentToken,
    childUserId,
    childEmail,
    parentEmail,
    status: 'pending',
    requestedAt: now,
    grantedAt: null,
    revokedAt: null,
    method: 'email_plus',
    ipAddress: null,
    userAgent: null,
    parentName: null,
    parentRelationship: null,
    privacyPolicyVersion: '1.0',
    expiresAt: nowUnix + (48 * 60 * 60),           // 48 hours — DynamoDB TTL for pending
    retainUntil: nowUnix + (3 * 365 * 24 * 60 * 60), // 3 years — audit retention
  };

  await db.putItem(TABLE_KEY, record);
  return record;
}

/**
 * Retrieves a consent record by its one-time consentToken.
 * Uses queryByField (full scan / GSI) — consentToken is UUID-unique per record.
 *
 * @param {string} consentToken - The UUID token sent in the parent email link
 * @returns {Promise<Object|null>} The matching consent record, or null if not found
 */
export async function getConsentByToken(consentToken) {
  const db = getDbAdapter();
  const matches = await db.queryByField(TABLE_KEY, 'consentToken', consentToken);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Marks a consent record as granted by the parent.
 * Removes the 48-hour pending TTL (sets expiresAt to null) so the record is
 * retained under the 3-year retainUntil audit window.
 *
 * @param {string} consentId        - PK of the consent record to update
 * @param {Object} params
 * @param {string} params.parentName         - Parent's full name as provided
 * @param {string} params.parentRelationship - e.g. 'mother', 'father', 'guardian'
 * @param {string|null} params.ipAddress     - IP address of the granting request
 * @param {string|null} params.userAgent     - User-agent string of the granting request
 * @returns {Promise<Object|null>} The updated consent record, or null if not found
 */
export async function grantConsent(consentId, { parentName, parentRelationship, ipAddress, userAgent }) {
  const db = getDbAdapter();
  const now = new Date().toISOString();

  const updates = {
    status: 'granted',
    grantedAt: now,
    parentName: parentName || null,
    parentRelationship: parentRelationship || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    expiresAt: null, // remove pending TTL — retained under retainUntil only
  };

  return db.updateItem(TABLE_KEY, consentId, updates);
}

/**
 * Revokes an active consent record for a child user.
 * Finds the most recent non-revoked consent record for the child and marks it revoked.
 *
 * @param {string} childUserId - UUID of the child whose consent is being revoked
 * @param {Object} params
 * @param {string|null} params.reason    - Human-readable revocation reason
 * @param {string|null} params.revokedBy - userId or 'parent' / 'admin' identifier
 * @returns {Promise<Object|null>} The updated consent record, or null if no active record found
 */
export async function revokeConsent(childUserId, { reason, revokedBy }) {
  const db = getDbAdapter();
  const records = await db.queryByField(TABLE_KEY, 'childUserId', childUserId);

  // Find the most recent non-revoked record
  const active = records
    .filter((r) => r.status !== 'revoked')
    .sort((a, b) => (b.requestedAt > a.requestedAt ? 1 : -1))[0];

  if (!active) {
    return null;
  }

  const now = new Date().toISOString();
  return db.updateItem(TABLE_KEY, active.consentId, {
    status: 'revoked',
    revokedAt: now,
    revokeReason: reason || null,
    revokedBy: revokedBy || null,
  });
}

/**
 * Returns all consent records for a given child user, newest first.
 *
 * @param {string} childUserId - UUID of the child user
 * @returns {Promise<Object[]>} Array of consent records (may be empty)
 */
export async function getConsentsByChild(childUserId) {
  const db = getDbAdapter();
  const records = await db.queryByField(TABLE_KEY, 'childUserId', childUserId);
  return records.sort((a, b) => (b.requestedAt > a.requestedAt ? 1 : -1));
}

/**
 * Returns all consent records associated with a parent email address, newest first.
 *
 * @param {string} parentEmail - Parent's email address
 * @returns {Promise<Object[]>} Array of consent records (may be empty)
 */
export async function getConsentsByParent(parentEmail) {
  const db = getDbAdapter();
  const records = await db.queryByField(TABLE_KEY, 'parentEmail', parentEmail);
  return records.sort((a, b) => (b.requestedAt > a.requestedAt ? 1 : -1));
}
