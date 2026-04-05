/**
 * @file src/admin/auditLogger.js
 * @description Append-only audit log writer for admin actions.
 * Fire-and-forget — never throws. Catches all DynamoDB errors internally.
 */

import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

let _docClient = null;
function getDocClient() {
  if (!_docClient) {
    const config = { region: process.env.AWS_REGION || 'us-east-1' };
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (endpoint) {
      config.endpoint = endpoint;
      config.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
    }
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

function getTableName() {
  return process.env.AUDIT_LOG_TABLE_NAME || `LearnfyraAuditLog-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;
}

// Valid action enum values
const VALID_ACTIONS = new Set([
  'USER_SUSPENDED', 'USER_UNSUSPENDED', 'FORCE_LOGOUT', 'ROLE_CHANGE',
  'COPPA_DELETION', 'QUESTION_FLAGGED', 'QUESTION_UNFLAGGED',
  'QUESTION_SOFT_DELETED', 'CONFIG_UPDATED', 'SCHOOL_CREATED',
  'SCHOOL_UPDATED', 'SCHOOL_ADMIN_ASSIGNED', 'TEACHER_INVITED',
  'TEACHER_REMOVED', 'BULK_ASSIGNMENT_CREATED', 'SCHOOL_CONFIG_UPDATED',
  // Repeat-cap policy management (added for RCAP feature — 2026-04-04)
  'admin.repeat_cap_updated',
  'admin.repeat_cap_override_created',
  'admin.repeat_cap_override_deleted',
  // Guardrail audit event types (added for AI Prompt Guardrails — 2026-04-04)
  'GENERATION_MODERATION',          // generation.moderation — logged per attempt by generator.js
  'GUARDRAIL_POLICY_UPDATED',       // admin.guardrail_policy_updated — admin changed policy
  'GUARDRAIL_TEMPLATE_UPDATED',     // admin.guardrail_template_updated — admin changed template
]);

/**
 * Writes an audit log record. Fire-and-forget — never throws.
 *
 * @param {Object} params
 * @param {string} params.actorId - Admin userId
 * @param {string} params.actorRole - super_admin | school_admin
 * @param {string} params.action - Action enum value
 * @param {string} params.targetEntityType - Entity type (Users, QuestionBank, Config, School, etc.)
 * @param {string} params.targetEntityId - Entity PK value
 * @param {Object|null} [params.beforeState] - State before action (null for creates)
 * @param {Object|null} [params.afterState] - State after action (null for deletes)
 * @param {string} params.ipAddress - Request originator IP
 * @param {string} params.userAgent - User-Agent header
 * @returns {Promise<string|null>} auditId on success, null on failure
 */
export async function writeAuditLog({
  actorId,
  actorRole,
  action,
  targetEntityType,
  targetEntityId,
  beforeState = null,
  afterState = null,
  ipAddress = 'unknown',
  userAgent = 'unknown',
}) {
  try {
    const auditId = randomUUID();
    const timestamp = new Date().toISOString();

    await getDocClient().send(new PutCommand({
      TableName: getTableName(),
      Item: {
        PK: `AUDIT#${auditId}`,
        SK: 'METADATA',
        auditId,
        actorId,
        actorRole,
        action,
        targetEntityType,
        targetEntityId,
        beforeState: beforeState ? JSON.stringify(beforeState) : null,
        afterState: afterState ? JSON.stringify(afterState) : null,
        ipAddress,
        userAgent,
        timestamp,
      },
    }));

    return auditId;
  } catch (err) {
    console.error('writeAuditLog failed (non-fatal):', err.message);
    return null;
  }
}

/**
 * Extracts IP address from an API Gateway event.
 * @param {Object} event - API Gateway event
 * @returns {string}
 */
export function extractIp(event) {
  return event?.requestContext?.identity?.sourceIp
    || event?.headers?.['X-Forwarded-For']?.split(',')[0]?.trim()
    || 'unknown';
}

/**
 * Extracts User-Agent from an API Gateway event.
 * @param {Object} event - API Gateway event
 * @returns {string}
 */
export function extractUserAgent(event) {
  const headers = event?.headers || {};
  return headers['User-Agent'] || headers['user-agent'] || 'unknown';
}

export { VALID_ACTIONS };
