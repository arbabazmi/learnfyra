/**
 * @file backend/handlers/adminHandler.js
 * @description Lambda-compatible admin control-plane handler for policy management.
 */

import { createHash, randomUUID } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminUserGlobalSignOutCommand } from '@aws-sdk/client-cognito-identity-provider';
import { writeAuditLog, extractIp, extractUserAgent } from '../../src/admin/auditLogger.js';
import { writeComplianceLog } from '../../src/admin/complianceLogger.js';
import { executeCoppaDeletion } from '../../src/admin/coppaDeleter.js';
import { getCostDashboard, getTopExpensiveRequests } from '../../src/admin/costDashboard.js';
import { validateConfigValue } from '../../src/admin/configValidator.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Idempotency-Key',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
};

const DEFAULT_POLICY = {
  id: 'global',
  version: 1,
  modelRouting: {
    defaultMode: 'auto',
    allowPremium: true,
    premiumEscalation: {
      missingCountThreshold: 15,
      hardQuestionCountThreshold: 10,
    },
    fallbackOrder: ['low', 'default', 'premium'],
  },
  budgetUsage: {
    dailyUsdSoftLimit: 100,
    dailyUsdHardLimit: 150,
    monthlyUsdSoftLimit: 2500,
    monthlyUsdHardLimit: 3000,
    softLimitBehavior: 'log-only',
    hardLimitBehavior: 'block-premium',
  },
  validationProfile: {
    name: 'standard',
    strictness: 'balanced',
    rejectOnCountMismatch: true,
    rejectOnSchemaViolation: true,
    allowPartialIfRecoverable: false,
  },
  repeatCapPolicy: {
    enabled: true,
    defaultPercent: 10,
    minPercent: 0,
    maxPercent: 100,
  },
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'system',
};

function errorResponse(statusCode, message, code) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message, code }),
  };
}

function parseIntParam(value, fallback, min, max) {
  if (value == null || value === '') return { value: fallback, error: null };
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    return { value: fallback, error: `Value must be an integer between ${min} and ${max}.` };
  }

  const parsed = Number(text);
  if (parsed < min || parsed > max) {
    return { value: fallback, error: `Value must be an integer between ${min} and ${max}.` };
  }
  return { value: parsed, error: null };
}

async function getOrCreatePolicies(db) {
  const existing = await db.getItem('adminPolicies', 'global');
  if (existing) {
    return {
      ...DEFAULT_POLICY,
      ...existing,
      modelRouting: {
        ...DEFAULT_POLICY.modelRouting,
        ...(existing.modelRouting || {}),
      },
      budgetUsage: {
        ...DEFAULT_POLICY.budgetUsage,
        ...(existing.budgetUsage || {}),
      },
      validationProfile: {
        ...DEFAULT_POLICY.validationProfile,
        ...(existing.validationProfile || {}),
      },
      repeatCapPolicy: {
        ...DEFAULT_POLICY.repeatCapPolicy,
        ...(existing.repeatCapPolicy || {}),
      },
    };
  }

  const created = {
    ...DEFAULT_POLICY,
    updatedAt: new Date().toISOString(),
  };
  await db.putItem('adminPolicies', created);
  return created;
}

function getIdempotencyKey(headers) {
  if (!headers) return null;
  return headers['Idempotency-Key'] || headers['idempotency-key'] || null;
}

function hashRequest(body) {
  return createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}

function validateReason(reason, min = 10, max = 300) {
  if (typeof reason !== 'string') return `reason must be ${min} to ${max} characters.`;
  const normalized = reason.trim();
  if (normalized.length < min || normalized.length > max) {
    return `reason must be ${min} to ${max} characters.`;
  }
  return null;
}

function validateModelRoutingPayload(body) {
  const {
    defaultMode,
    allowPremium,
    premiumEscalation,
    fallbackOrder,
    reason,
  } = body || {};

  if (!['auto', 'bank-first'].includes(defaultMode)) {
    return 'defaultMode must be one of: auto, bank-first.';
  }
  if (typeof allowPremium !== 'boolean') {
    return 'allowPremium must be a boolean.';
  }
  if (!premiumEscalation || typeof premiumEscalation !== 'object') {
    return 'premiumEscalation is required.';
  }

  const missingCountThreshold = Number(premiumEscalation.missingCountThreshold);
  const hardQuestionCountThreshold = Number(premiumEscalation.hardQuestionCountThreshold);
  if (!Number.isInteger(missingCountThreshold) || missingCountThreshold < 1 || missingCountThreshold > 30) {
    return 'premiumEscalation.missingCountThreshold must be an integer between 1 and 30.';
  }
  if (!Number.isInteger(hardQuestionCountThreshold) || hardQuestionCountThreshold < 5 || hardQuestionCountThreshold > 30) {
    return 'premiumEscalation.hardQuestionCountThreshold must be an integer between 5 and 30.';
  }

  if (!Array.isArray(fallbackOrder) || fallbackOrder.length < 2) {
    return 'fallbackOrder must be an array with at least 2 entries.';
  }

  const allowedRoutes = new Set(['low', 'default', 'premium']);
  const routeSet = new Set();
  for (const route of fallbackOrder) {
    if (!allowedRoutes.has(route)) {
      return 'fallbackOrder entries must be one of: low, default, premium.';
    }
    if (routeSet.has(route)) {
      return 'fallbackOrder must not contain duplicates.';
    }
    routeSet.add(route);
  }

  const reasonErr = validateReason(reason);
  if (reasonErr) return reasonErr;

  return null;
}

function validateBudgetPayload(body) {
  const {
    dailyUsdSoftLimit,
    dailyUsdHardLimit,
    monthlyUsdSoftLimit,
    monthlyUsdHardLimit,
    softLimitBehavior,
    hardLimitBehavior,
    reason,
  } = body || {};

  const nums = [
    dailyUsdSoftLimit,
    dailyUsdHardLimit,
    monthlyUsdSoftLimit,
    monthlyUsdHardLimit,
  ];

  if (!nums.every((value) => Number.isFinite(value) && value > 0)) {
    return 'All budget limits must be finite numbers greater than 0.';
  }

  if (dailyUsdSoftLimit > dailyUsdHardLimit || monthlyUsdSoftLimit > monthlyUsdHardLimit) {
    return 'Soft limits must be less than or equal to hard limits.';
  }

  if (!['log-only', 'warn-and-log'].includes(softLimitBehavior)) {
    return 'softLimitBehavior must be one of: log-only, warn-and-log.';
  }

  if (!['block-premium', 'block-generation'].includes(hardLimitBehavior)) {
    return 'hardLimitBehavior must be one of: block-premium, block-generation.';
  }

  const reasonErr = validateReason(reason);
  if (reasonErr) return reasonErr;

  // Require a ticket-like marker when choosing the strongest block mode.
  if (hardLimitBehavior === 'block-generation' && !/[A-Z]{2,10}-\d+/i.test(reason)) {
    return 'reason must include a ticket reference when hardLimitBehavior is block-generation.';
  }

  return null;
}

function validateValidationPayload(body, currentPolicy) {
  const {
    name,
    strictness,
    rejectOnCountMismatch,
    rejectOnSchemaViolation,
    allowPartialIfRecoverable,
    reason,
  } = body || {};

  if (!['lenient', 'standard', 'strict', 'custom'].includes(name)) {
    return 'name must be one of: lenient, standard, strict, custom.';
  }

  if (!['lenient', 'balanced', 'strict'].includes(strictness)) {
    return 'strictness must be one of: lenient, balanced, strict.';
  }

  if (typeof rejectOnCountMismatch !== 'boolean' ||
      typeof rejectOnSchemaViolation !== 'boolean' ||
      typeof allowPartialIfRecoverable !== 'boolean') {
    return 'Validation profile toggles must be booleans.';
  }

  if (strictness === 'strict' && rejectOnSchemaViolation === false) {
    return 'rejectOnSchemaViolation cannot be false when strictness is strict.';
  }

  let reasonMin = 10;
  if (currentPolicy.validationProfile?.strictness === 'strict' && strictness === 'lenient') {
    reasonMin = 25;
  }
  const reasonErr = validateReason(reason, reasonMin, 300);
  if (reasonErr) return reasonErr;

  return null;
}

function validateRepeatCapPolicyPayload(body) {
  const { enabled, defaultPercent, reason } = body || {};
  if (typeof enabled !== 'boolean') {
    return 'enabled must be a boolean.';
  }

  if (!Number.isInteger(defaultPercent) || defaultPercent < 0 || defaultPercent > 100) {
    return 'defaultPercent must be an integer between 0 and 100.';
  }

  const reasonErr = validateReason(reason);
  if (reasonErr) return reasonErr;
  return null;
}

function validateRepeatCapOverridePayload(body) {
  const { scope, scopeId, repeatCapPercent, reason, isActive, expiresAt } = body || {};
  if (!['student', 'teacher', 'parent'].includes(scope)) {
    return 'scope must be one of: student, teacher, parent.';
  }
  if (typeof scopeId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(scopeId.trim())) {
    return 'scopeId must be 1-128 characters and use only letters, numbers, underscores, or hyphens.';
  }
  if (!Number.isInteger(repeatCapPercent) || repeatCapPercent < 0 || repeatCapPercent > 100) {
    return 'repeatCapPercent must be an integer between 0 and 100.';
  }
  if (isActive != null && typeof isActive !== 'boolean') {
    return 'isActive must be a boolean when provided.';
  }
  if (expiresAt != null && expiresAt !== '') {
    const parsed = Date.parse(expiresAt);
    if (!Number.isFinite(parsed)) {
      return 'expiresAt must be a valid ISO-8601 datetime when provided.';
    }
  }
  const reasonErr = validateReason(reason);
  if (reasonErr) return reasonErr;
  return null;
}

async function writeAuditEvent(db, decoded, action, target, before, after, reason, event) {
  await db.putItem('adminAuditEvents', {
    id: randomUUID(),
    eventType: 'admin.policy.updated',
    action,
    actorId: decoded.sub,
    actorRole: decoded.role,
    target,
    before,
    after,
    reason,
    requestId: event.requestContext?.requestId || event.requestId || null,
    idempotencyKey: getIdempotencyKey(event.headers || {}),
    createdAt: new Date().toISOString(),
  });
}

// ── Conditional-write helpers for idempotency ─────────────────────────────────

/**
 * Lazy singleton DynamoDB document client for idempotency conditional writes.
 * Mirrors the config from dynamoDbAdapter.
 * @returns {DynamoDBDocumentClient}
 */
let _idempotencyDocClient = null;
function getIdempotencyDocClient() {
  if (!_idempotencyDocClient) {
    const cfg = { region: process.env.AWS_REGION || 'us-east-1' };
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (endpoint) {
      cfg.endpoint = endpoint;
      cfg.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
      };
    }
    _idempotencyDocClient = DynamoDBDocumentClient.from(new DynamoDBClient(cfg), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _idempotencyDocClient;
}

/**
 * Resolves the DynamoDB table name for adminIdempotency, matching the
 * convention in dynamoDbAdapter's TABLE_CONFIG entry.
 * @returns {string}
 */
function resolveIdempotencyTable() {
  return (
    process.env.ADMIN_IDEMPOTENCY_TABLE_NAME ||
    `LearnfyraAdminIdempotency-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`
  );
}

/**
 * Attempts a conditional PutItem that only succeeds when no item with the
 * given id already exists (attribute_not_exists). Returns true on success,
 * false when the item already exists (ConditionalCheckFailedException).
 *
 * For local JSON-file runtime (APP_RUNTIME unset) this falls back to the
 * db adapter's putItem (no conditions needed — local dev is single-process).
 *
 * @param {Object} db - DB adapter instance (used for local fallback)
 * @param {Object} record - Full idempotency record to write (must have `id`)
 * @returns {Promise<boolean>} true = newly written, false = already existed
 */
async function conditionalPutIdempotency(db, record) {
  const runtime = process.env.APP_RUNTIME;

  if (runtime !== 'aws' && runtime !== 'dynamodb') {
    // Local JSON adapter — no conditions needed; single-process, no races
    await db.putItem('adminIdempotency', record);
    return true;
  }

  const tableName = resolveIdempotencyTable();
  try {
    await getIdempotencyDocClient().send(new PutCommand({
      TableName: tableName,
      Item: record,
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' },
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw err;
  }
}

/**
 * Fetches an existing idempotency record by its composite id.
 * Used to retrieve the cached response after a conditional write collision.
 *
 * @param {Object} db - DB adapter (used for local fallback)
 * @param {string} recordId
 * @returns {Promise<Object|null>}
 */
async function getIdempotencyRecord(db, recordId) {
  const runtime = process.env.APP_RUNTIME;

  if (runtime !== 'aws' && runtime !== 'dynamodb') {
    return db.getItem('adminIdempotency', recordId);
  }

  const tableName = resolveIdempotencyTable();
  const result = await getIdempotencyDocClient().send(new GetCommand({
    TableName: tableName,
    Key: { id: recordId },
  }));
  return result.Item ?? null;
}

async function applyIdempotentMutation(db, event, decoded, action, mutationFn) {
  const key = getIdempotencyKey(event.headers || {});
  if (!key || typeof key !== 'string' || !key.trim()) {
    return errorResponse(400, 'Idempotency-Key header is required.', 'ADMIN_INVALID_REQUEST');
  }

  const endpoint = `${event.httpMethod}:${event.path || event.routeKey || ''}`;
  const recordId = `${decoded.sub}#${endpoint}#${key.trim()}`;
  const requestHash = hashRequest(event.body || {});

  // Phase 1: Run the mutation before touching the idempotency table so we
  // have a real response to store.
  const response = await mutationFn();

  if (response.statusCode < 400) {
    // Phase 2: Attempt a conditional write — only succeeds when no record
    // with this id exists yet (attribute_not_exists).
    const newRecord = {
      id: recordId,
      actorId: decoded.sub,
      idempotencyKey: key.trim(),
      action,
      requestHash,
      responseStatusCode: response.statusCode,
      responseBody: response.body,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const written = await conditionalPutIdempotency(db, newRecord);

    if (!written) {
      // Another concurrent request already stored a record for this key.
      // Fetch it and verify the request hash matches before returning it.
      const existing = await getIdempotencyRecord(db, recordId);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return errorResponse(409, 'Idempotency key reuse conflict.', 'ADMIN_CONFLICT');
        }
        return {
          statusCode: existing.responseStatusCode,
          headers: corsHeaders,
          body: existing.responseBody,
        };
      }
      // Record vanished between the collision and the fetch (unlikely) —
      // return the response we computed above rather than failing.
    }
  } else {
    // Mutation failed — check whether a prior successful record exists for
    // this key (idempotent replay of a previously-succeeded request).
    const existing = await getIdempotencyRecord(db, recordId);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return errorResponse(409, 'Idempotency key reuse conflict.', 'ADMIN_CONFLICT');
      }
      return {
        statusCode: existing.responseStatusCode,
        headers: corsHeaders,
        body: existing.responseBody,
      };
    }
  }

  return response;
}

async function handleGetPolicies(decoded) {
  const db = getDbAdapter();
  const policy = await getOrCreatePolicies(db);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      version: policy.version,
      modelRouting: policy.modelRouting,
      budgetUsage: policy.budgetUsage,
      validationProfile: policy.validationProfile,
      repeatCapPolicy: policy.repeatCapPolicy,
      updatedAt: policy.updatedAt,
      updatedBy: policy.updatedBy,
      requestedBy: decoded.sub,
    }),
  };
}

async function handleGetRepeatCapPolicy(decoded, queryStringParameters) {
  const db = getDbAdapter();
  const policy = await getOrCreatePolicies(db);

  const scope = typeof queryStringParameters?.scope === 'string'
    ? queryStringParameters.scope.trim()
    : '';
  const scopeId = typeof queryStringParameters?.scopeId === 'string'
    ? queryStringParameters.scopeId.trim()
    : '';

  const overrides = await db.listAll('repeatCapOverrides');
  const filtered = (Array.isArray(overrides) ? overrides : [])
    .filter((item) => {
      if (!scope) return true;
      if (item.scope !== scope) return false;
      if (scopeId && item.scopeId !== scopeId) return false;
      return true;
    })
    .map((item) => ({
      id: item.id,
      scope: item.scope,
      scopeId: item.scopeId,
      repeatCapPercent: item.repeatCapPercent,
      isActive: item.isActive !== false,
      expiresAt: item.expiresAt || null,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
    }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      repeatCapPolicy: policy.repeatCapPolicy,
      overrides: filtered,
      requestedBy: decoded.sub,
    }),
  };
}

async function handleUpdateModelRouting(event, decoded, body) {
  const db = getDbAdapter();
  const validationError = validateModelRoutingPayload(body);
  if (validationError) {
    return errorResponse(400, validationError, 'ADMIN_INVALID_REQUEST');
  }

  return applyIdempotentMutation(db, event, decoded, 'update-model-routing', async () => {
    const current = await getOrCreatePolicies(db);
    const updated = {
      ...current,
      version: (Number(current.version) || 0) + 1,
      modelRouting: {
        defaultMode: body.defaultMode,
        allowPremium: body.allowPremium,
        premiumEscalation: {
          missingCountThreshold: body.premiumEscalation.missingCountThreshold,
          hardQuestionCountThreshold: body.premiumEscalation.hardQuestionCountThreshold,
        },
        fallbackOrder: body.fallbackOrder,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.sub,
    };

    await db.putItem('adminPolicies', updated);
    await writeAuditEvent(
      db,
      decoded,
      'update-model-routing',
      'adminPolicies.global.modelRouting',
      current.modelRouting,
      updated.modelRouting,
      body.reason.trim(),
      event,
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Model routing policy updated.',
        version: updated.version,
        appliedAt: updated.updatedAt,
      }),
    };
  });
}

async function handleUpdateBudgetUsage(event, decoded, body) {
  const db = getDbAdapter();
  const validationError = validateBudgetPayload(body);
  if (validationError) {
    return errorResponse(400, validationError, 'ADMIN_INVALID_REQUEST');
  }

  return applyIdempotentMutation(db, event, decoded, 'update-budget-usage', async () => {
    const current = await getOrCreatePolicies(db);
    const updated = {
      ...current,
      version: (Number(current.version) || 0) + 1,
      budgetUsage: {
        dailyUsdSoftLimit: body.dailyUsdSoftLimit,
        dailyUsdHardLimit: body.dailyUsdHardLimit,
        monthlyUsdSoftLimit: body.monthlyUsdSoftLimit,
        monthlyUsdHardLimit: body.monthlyUsdHardLimit,
        softLimitBehavior: body.softLimitBehavior,
        hardLimitBehavior: body.hardLimitBehavior,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.sub,
    };

    await db.putItem('adminPolicies', updated);
    await writeAuditEvent(
      db,
      decoded,
      'update-budget-usage',
      'adminPolicies.global.budgetUsage',
      current.budgetUsage,
      updated.budgetUsage,
      body.reason.trim(),
      event,
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Budget and usage policy updated.',
        version: updated.version,
        appliedAt: updated.updatedAt,
      }),
    };
  });
}

async function handleUpdateValidationProfile(event, decoded, body) {
  const db = getDbAdapter();
  return applyIdempotentMutation(db, event, decoded, 'update-validation-profile', async () => {
    const refreshed = await getOrCreatePolicies(db);
    const validationError = validateValidationPayload(body, refreshed);
    if (validationError) {
      return errorResponse(400, validationError, 'ADMIN_INVALID_REQUEST');
    }

    const updated = {
      ...refreshed,
      version: (Number(refreshed.version) || 0) + 1,
      validationProfile: {
        name: body.name,
        strictness: body.strictness,
        rejectOnCountMismatch: body.rejectOnCountMismatch,
        rejectOnSchemaViolation: body.rejectOnSchemaViolation,
        allowPartialIfRecoverable: body.allowPartialIfRecoverable,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.sub,
    };

    await db.putItem('adminPolicies', updated);
    await writeAuditEvent(
      db,
      decoded,
      'update-validation-profile',
      'adminPolicies.global.validationProfile',
      refreshed.validationProfile,
      updated.validationProfile,
      body.reason.trim(),
      event,
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Validation profile updated.',
        version: updated.version,
        appliedAt: updated.updatedAt,
      }),
    };
  });
}

async function handleUpdateRepeatCapPolicy(event, decoded, body) {
  const db = getDbAdapter();
  const validationError = validateRepeatCapPolicyPayload(body);
  if (validationError) {
    return errorResponse(400, validationError, 'ADMIN_INVALID_REQUEST');
  }

  return applyIdempotentMutation(db, event, decoded, 'update-repeat-cap-policy', async () => {
    const current = await getOrCreatePolicies(db);
    const updated = {
      ...current,
      version: (Number(current.version) || 0) + 1,
      repeatCapPolicy: {
        enabled: body.enabled,
        defaultPercent: body.defaultPercent,
        minPercent: 0,
        maxPercent: 100,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.sub,
    };

    await db.putItem('adminPolicies', updated);
    await writeAuditEvent(
      db,
      decoded,
      'update-repeat-cap-policy',
      'adminPolicies.global.repeatCapPolicy',
      current.repeatCapPolicy,
      updated.repeatCapPolicy,
      body.reason.trim(),
      event,
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Repeat-cap policy updated.',
        version: updated.version,
        appliedAt: updated.updatedAt,
      }),
    };
  });
}

async function handleUpsertRepeatCapOverride(event, decoded, body) {
  const db = getDbAdapter();
  const validationError = validateRepeatCapOverridePayload(body);
  if (validationError) {
    return errorResponse(400, validationError, 'ADMIN_INVALID_REQUEST');
  }

  return applyIdempotentMutation(db, event, decoded, 'upsert-repeat-cap-override', async () => {
    const current = await db.getItem('repeatCapOverrides', `${body.scope}:${body.scopeId.trim()}`);
    const now = new Date().toISOString();
    const updated = {
      id: `${body.scope}:${body.scopeId.trim()}`,
      scope: body.scope,
      scopeId: body.scopeId.trim(),
      repeatCapPercent: body.repeatCapPercent,
      isActive: body.isActive !== false,
      expiresAt: body.expiresAt || null,
      createdAt: current?.createdAt || now,
      createdBy: current?.createdBy || decoded.sub,
      updatedAt: now,
      updatedBy: decoded.sub,
      reason: body.reason.trim(),
    };

    await db.putItem('repeatCapOverrides', updated);
    await writeAuditEvent(
      db,
      decoded,
      'upsert-repeat-cap-override',
      `repeatCapOverrides.${updated.id}`,
      current,
      updated,
      body.reason.trim(),
      event,
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Repeat-cap override updated.',
        override: {
          id: updated.id,
          scope: updated.scope,
          scopeId: updated.scopeId,
          repeatCapPercent: updated.repeatCapPercent,
          isActive: updated.isActive,
          expiresAt: updated.expiresAt,
          updatedAt: updated.updatedAt,
          updatedBy: updated.updatedBy,
        },
      }),
    };
  });
}

async function handleListAuditEvents(queryStringParameters) {
  const db = getDbAdapter();
  const qs = queryStringParameters || {};

  const limitParsed = parseIntParam(qs.limit, 50, 1, 200);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 200.', 'ADMIN_INVALID_REQUEST');
  }

  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be an integer greater than or equal to 0.', 'ADMIN_INVALID_REQUEST');
  }

  const actionFilter = typeof qs.action === 'string' && qs.action.trim()
    ? qs.action.trim()
    : null;

  const events = await db.listAll('adminAuditEvents');
  const filtered = actionFilter
    ? events.filter((evt) => evt.action === actionFilter)
    : events;

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const page = sorted
    .slice(offsetParsed.value, offsetParsed.value + limitParsed.value)
    .map((evt) => ({
      id: evt.id,
      eventType: evt.eventType,
      action: evt.action,
      actorId: evt.actorId,
      target: evt.target,
      createdAt: evt.createdAt,
    }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      events: page,
      pagination: {
        limit: limitParsed.value,
        offset: offsetParsed.value,
        returned: page.length,
      },
    }),
  };
}

// ── Path parameter helper ─────────────────────────────────────────────────────

/**
 * Extracts a captured group from a path using a regex pattern.
 * @param {string} path
 * @param {RegExp} pattern
 * @returns {string|null}
 */
function extractPathParam(path, pattern) {
  const match = path.match(pattern);
  return match ? match[1] : null;
}

// ── Lazy Cognito client ───────────────────────────────────────────────────────

let _cognitoClient = null;
function getCognitoClient() {
  if (!_cognitoClient) {
    _cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return _cognitoClient;
}

// ── Config DynamoDB helpers ───────────────────────────────────────────────────

function resolveConfigTable() {
  return (
    process.env.CONFIG_TABLE_NAME ||
    `LearnfyraConfig-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`
  );
}

function resolveSchoolTable() {
  return (
    process.env.SCHOOL_TABLE_NAME ||
    `LearnfyraSchools-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`
  );
}

function getDocClient() {
  const cfg = { region: process.env.AWS_REGION || 'us-east-1' };
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (endpoint) {
    cfg.endpoint = endpoint;
    cfg.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    };
  }
  return DynamoDBDocumentClient.from(new DynamoDBClient(cfg), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

// ── M07: User Management ─────────────────────────────────────────────────────

/**
 * GET /api/admin/users — list/search users
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleListUsers(event, decoded) {
  const db = getDbAdapter();
  const qs = event.queryStringParameters || {};

  const limitParsed = parseIntParam(qs.limit, 50, 1, 200);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 200.', 'ADMIN_INVALID_REQUEST');
  }
  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be a non-negative integer.', 'ADMIN_INVALID_REQUEST');
  }

  const all = await db.listAll('users');
  let items = Array.isArray(all) ? all : [];

  if (qs.role) items = items.filter((u) => u.role === qs.role);
  if (qs.suspended === 'true') items = items.filter((u) => u.suspended === true);
  if (qs.suspended === 'false') items = items.filter((u) => u.suspended !== true);
  if (qs.q) {
    const q = qs.q.toLowerCase();
    items = items.filter(
      (u) =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)),
    );
  }

  const page = items
    .slice(offsetParsed.value, offsetParsed.value + limitParsed.value)
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      suspended: u.suspended || false,
      createdAt: u.createdAt,
    }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      users: page,
      pagination: { limit: limitParsed.value, offset: offsetParsed.value, returned: page.length },
    }),
  };
}

/**
 * GET /api/admin/users/:userId — get user detail
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} userId
 */
async function handleGetUser(event, decoded, userId) {
  const db = getDbAdapter();
  const user = await db.getItem('users', userId);
  if (!user) return errorResponse(404, 'User not found.', 'ADMIN_NOT_FOUND');
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ user }),
  };
}

/**
 * PATCH /api/admin/users/:userId/suspend — suspend user
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} userId
 */
async function handleSuspendUser(event, decoded, userId) {
  const db = getDbAdapter();
  const user = await db.getItem('users', userId);
  if (!user) return errorResponse(404, 'User not found.', 'ADMIN_NOT_FOUND');

  const body = JSON.parse(event.body || '{}');
  const reasonErr = validateReason(body.reason || '');
  if (reasonErr) return errorResponse(400, reasonErr, 'ADMIN_INVALID_REQUEST');

  const now = new Date().toISOString();
  await db.putItem('users', { ...user, suspended: true, suspendedAt: now, suspendedBy: decoded.sub });

  writeAuditLog({
    action: 'admin.user.suspend',
    actorId: decoded.sub,
    targetId: userId,
    reason: body.reason.trim(),
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'User suspended.', userId, suspendedAt: now }),
  };
}

/**
 * PATCH /api/admin/users/:userId/unsuspend — unsuspend user
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} userId
 */
async function handleUnsuspendUser(event, decoded, userId) {
  const db = getDbAdapter();
  const user = await db.getItem('users', userId);
  if (!user) return errorResponse(404, 'User not found.', 'ADMIN_NOT_FOUND');

  const body = JSON.parse(event.body || '{}');
  const reasonErr = validateReason(body.reason || '');
  if (reasonErr) return errorResponse(400, reasonErr, 'ADMIN_INVALID_REQUEST');

  const now = new Date().toISOString();
  const { suspendedAt, suspendedBy, ...rest } = user;
  await db.putItem('users', { ...rest, suspended: false, unsuspendedAt: now, unsuspendedBy: decoded.sub });

  writeAuditLog({
    action: 'admin.user.unsuspend',
    actorId: decoded.sub,
    targetId: userId,
    reason: body.reason.trim(),
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'User unsuspended.', userId, unsuspendedAt: now }),
  };
}

/**
 * POST /api/admin/users/:userId/force-logout — force Cognito logout
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} userId
 */
async function handleForceLogout(event, decoded, userId) {
  const db = getDbAdapter();
  const user = await db.getItem('users', userId);
  if (!user) return errorResponse(404, 'User not found.', 'ADMIN_NOT_FOUND');

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) return errorResponse(500, 'Cognito user pool not configured.', 'ADMIN_INTERNAL_ERROR');

  try {
    await getCognitoClient().send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId, Username: user.email || userId }),
    );
  } catch (err) {
    console.error('Cognito AdminUserGlobalSignOut failed:', err);
    return errorResponse(502, 'Failed to sign out user from Cognito.', 'ADMIN_UPSTREAM_ERROR');
  }

  writeAuditLog({
    action: 'admin.user.force-logout',
    actorId: decoded.sub,
    targetId: userId,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'User signed out from all sessions.', userId }),
  };
}

/**
 * PATCH /api/admin/users/:userId/role — change user role
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} userId
 */
async function handleChangeRole(event, decoded, userId) {
  const VALID_ROLES = ['student', 'teacher', 'parent', 'school_admin', 'super_admin'];
  if (decoded.sub === userId) {
    return errorResponse(400, 'Admins cannot change their own role.', 'ADMIN_INVALID_REQUEST');
  }

  const db = getDbAdapter();
  const user = await db.getItem('users', userId);
  if (!user) return errorResponse(404, 'User not found.', 'ADMIN_NOT_FOUND');

  const body = JSON.parse(event.body || '{}');
  if (!VALID_ROLES.includes(body.role)) {
    return errorResponse(400, `role must be one of: ${VALID_ROLES.join(', ')}.`, 'ADMIN_INVALID_REQUEST');
  }
  const reasonErr = validateReason(body.reason || '');
  if (reasonErr) return errorResponse(400, reasonErr, 'ADMIN_INVALID_REQUEST');

  const now = new Date().toISOString();
  const previousRole = user.role;
  await db.putItem('users', { ...user, role: body.role, roleChangedAt: now, roleChangedBy: decoded.sub });

  writeAuditLog({
    action: 'admin.user.role-change',
    actorId: decoded.sub,
    targetId: userId,
    before: { role: previousRole },
    after: { role: body.role },
    reason: body.reason.trim(),
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'User role updated.', userId, role: body.role, changedAt: now }),
  };
}

/**
 * DELETE /api/admin/users/:userId — COPPA deletion
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} userId
 */
async function handleCoppaDelete(event, decoded, userId) {
  const db = getDbAdapter();
  const user = await db.getItem('users', userId);
  if (!user) return errorResponse(404, 'User not found.', 'ADMIN_NOT_FOUND');

  const body = JSON.parse(event.body || '{}');
  if (!body.confirmationToken) {
    return errorResponse(400, 'confirmationToken is required for COPPA deletion.', 'ADMIN_INVALID_REQUEST');
  }

  const now = new Date().toISOString();

  // Compliance log must succeed before deletion proceeds
  await writeComplianceLog({
    event: 'coppa.deletion.initiated',
    actorId: decoded.sub,
    targetUserId: userId,
    confirmationToken: body.confirmationToken,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    initiatedAt: now,
  });

  await executeCoppaDeletion(userId, { actorId: decoded.sub, confirmationToken: body.confirmationToken });

  writeAuditLog({
    action: 'admin.user.coppa-delete',
    actorId: decoded.sub,
    targetId: userId,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'User data deleted per COPPA request.', userId, deletedAt: now }),
  };
}

// ── M07: Question Bank Moderation ────────────────────────────────────────────

/**
 * GET /api/admin/question-bank — list questions with filters
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleListQuestions(event, decoded) {
  const db = getDbAdapter();
  const qs = event.queryStringParameters || {};

  const limitParsed = parseIntParam(qs.limit, 50, 1, 200);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 200.', 'ADMIN_INVALID_REQUEST');
  }
  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be a non-negative integer.', 'ADMIN_INVALID_REQUEST');
  }

  const all = await db.listAll('questions');
  let items = Array.isArray(all) ? all : [];

  if (qs.flagged === 'true') items = items.filter((q) => q.flagged === true);
  if (qs.flagged === 'false') items = items.filter((q) => q.flagged !== true);
  if (qs.deleted === 'true') items = items.filter((q) => q.deleted === true);
  if (qs.deleted !== 'true') items = items.filter((q) => q.deleted !== true);
  if (qs.subject) items = items.filter((q) => q.subject === qs.subject);
  if (qs.grade) items = items.filter((q) => String(q.grade) === String(qs.grade));

  const page = items.slice(offsetParsed.value, offsetParsed.value + limitParsed.value);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      questions: page,
      pagination: { limit: limitParsed.value, offset: offsetParsed.value, returned: page.length },
    }),
  };
}

/**
 * PATCH /api/admin/question-bank/:questionId/flag — flag a question
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} questionId
 */
async function handleFlagQuestion(event, decoded, questionId) {
  const db = getDbAdapter();
  const question = await db.getItem('questions', questionId);
  if (!question) return errorResponse(404, 'Question not found.', 'ADMIN_NOT_FOUND');

  const body = JSON.parse(event.body || '{}');
  const now = new Date().toISOString();
  await db.putItem('questions', {
    ...question,
    flagged: true,
    flaggedAt: now,
    flaggedBy: decoded.sub,
    flagReason: body.reason || null,
  });

  writeAuditLog({
    action: 'admin.question.flag',
    actorId: decoded.sub,
    targetId: questionId,
    reason: body.reason || null,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Question flagged.', questionId, flaggedAt: now }),
  };
}

/**
 * PATCH /api/admin/question-bank/:questionId/unflag — unflag a question
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} questionId
 */
async function handleUnflagQuestion(event, decoded, questionId) {
  const db = getDbAdapter();
  const question = await db.getItem('questions', questionId);
  if (!question) return errorResponse(404, 'Question not found.', 'ADMIN_NOT_FOUND');

  const now = new Date().toISOString();
  const { flaggedAt, flaggedBy, flagReason, ...rest } = question;
  await db.putItem('questions', { ...rest, flagged: false, unflaggedAt: now, unflaggedBy: decoded.sub });

  writeAuditLog({
    action: 'admin.question.unflag',
    actorId: decoded.sub,
    targetId: questionId,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Question unflagged.', questionId, unflaggedAt: now }),
  };
}

/**
 * DELETE /api/admin/question-bank/:questionId — soft-delete question
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} questionId
 */
async function handleSoftDeleteQuestion(event, decoded, questionId) {
  const db = getDbAdapter();
  const question = await db.getItem('questions', questionId);
  if (!question) return errorResponse(404, 'Question not found.', 'ADMIN_NOT_FOUND');
  if (question.deleted) return errorResponse(409, 'Question is already deleted.', 'ADMIN_CONFLICT');

  const body = JSON.parse(event.body || '{}');
  const now = new Date().toISOString();
  await db.putItem('questions', {
    ...question,
    deleted: true,
    deletedAt: now,
    deletedBy: decoded.sub,
    deleteReason: body.reason || null,
  });

  writeAuditLog({
    action: 'admin.question.soft-delete',
    actorId: decoded.sub,
    targetId: questionId,
    reason: body.reason || null,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Question soft-deleted.', questionId, deletedAt: now }),
  };
}

// ── M07: Cost Dashboard ───────────────────────────────────────────────────────

/**
 * GET /api/admin/cost-dashboard — cost aggregation by window
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleCostDashboard(event, decoded) {
  const qs = event.queryStringParameters || {};
  const window = qs.window || 'day';
  const VALID_WINDOWS = ['hour', 'day', 'week', 'month'];
  if (!VALID_WINDOWS.includes(window)) {
    return errorResponse(400, `window must be one of: ${VALID_WINDOWS.join(', ')}.`, 'ADMIN_INVALID_REQUEST');
  }

  const data = await getCostDashboard({ window, from: qs.from, to: qs.to });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ window, ...data }),
  };
}

/**
 * GET /api/admin/cost-dashboard/top-expensive — top 10 expensive requests
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleTopExpensive(event, decoded) {
  const qs = event.queryStringParameters || {};
  const limitParsed = parseIntParam(qs.limit, 10, 1, 100);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 100.', 'ADMIN_INVALID_REQUEST');
  }

  const data = await getTopExpensiveRequests({ limit: limitParsed.value, from: qs.from, to: qs.to });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ requests: data, limit: limitParsed.value }),
  };
}

// ── M07: Config Management ────────────────────────────────────────────────────

/**
 * GET /api/admin/config — list all config entries
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleGetAllConfig(event, decoded) {
  const docClient = getDocClient();
  const tableName = resolveConfigTable();

  const result = await docClient.send(new ScanCommand({ TableName: tableName }));
  const items = result.Items || [];

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ config: items }),
  };
}

/**
 * GET /api/admin/config/:configType — get specific config
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} configType
 */
async function handleGetConfigByKey(event, decoded, configType) {
  const docClient = getDocClient();
  const tableName = resolveConfigTable();

  const result = await docClient.send(
    new GetCommand({ TableName: tableName, Key: { PK: `CONFIG#${configType}`, SK: 'METADATA' } }),
  );

  if (!result.Item) return errorResponse(404, 'Config not found.', 'ADMIN_NOT_FOUND');

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ config: result.Item }),
  };
}

/**
 * PUT /api/admin/config/:configType — update config with type validation
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} configType
 */
async function handleUpdateConfig(event, decoded, configType) {
  const body = JSON.parse(event.body || '{}');
  const validationError = validateConfigValue(configType, body.value);
  if (validationError) return errorResponse(400, validationError, 'ADMIN_INVALID_REQUEST');

  const docClient = getDocClient();
  const tableName = resolveConfigTable();
  const now = new Date().toISOString();

  const item = {
    PK: `CONFIG#${configType}`,
    SK: 'METADATA',
    configType,
    value: body.value,
    updatedAt: now,
    updatedBy: decoded.sub,
  };

  await docClient.send(new PutCommand({ TableName: tableName, Item: item }));

  writeAuditLog({
    action: 'admin.config.update',
    actorId: decoded.sub,
    targetId: configType,
    after: { value: body.value },
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Config updated.', configType, updatedAt: now }),
  };
}

// ── M07: School Management ────────────────────────────────────────────────────

/**
 * POST /api/admin/schools — create school
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleCreateSchool(event, decoded) {
  const body = JSON.parse(event.body || '{}');
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return errorResponse(400, 'name is required.', 'ADMIN_INVALID_REQUEST');
  }

  const docClient = getDocClient();
  const tableName = resolveSchoolTable();
  const schoolId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `SCHOOL#${schoolId}`,
    SK: 'METADATA',
    schoolId,
    name: body.name.trim(),
    district: body.district || null,
    state: body.state || null,
    contactEmail: body.contactEmail || null,
    createdAt: now,
    createdBy: decoded.sub,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: tableName, Item: item }));

  writeAuditLog({
    action: 'admin.school.create',
    actorId: decoded.sub,
    targetId: schoolId,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'School created.', schoolId, createdAt: now }),
  };
}

/**
 * GET /api/admin/schools — list schools
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleListSchools(event, decoded) {
  const docClient = getDocClient();
  const tableName = resolveSchoolTable();

  const result = await docClient.send(
    new ScanCommand({ TableName: tableName, FilterExpression: 'SK = :sk', ExpressionAttributeValues: { ':sk': 'METADATA' } }),
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ schools: result.Items || [] }),
  };
}

/**
 * GET /api/admin/schools/:schoolId — get school
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} schoolId
 */
async function handleGetSchool(event, decoded, schoolId) {
  const docClient = getDocClient();
  const tableName = resolveSchoolTable();

  const result = await docClient.send(
    new GetCommand({ TableName: tableName, Key: { PK: `SCHOOL#${schoolId}`, SK: 'METADATA' } }),
  );

  if (!result.Item) return errorResponse(404, 'School not found.', 'ADMIN_NOT_FOUND');

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ school: result.Item }),
  };
}

/**
 * PATCH /api/admin/schools/:schoolId — update school
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} schoolId
 */
async function handleUpdateSchool(event, decoded, schoolId) {
  const docClient = getDocClient();
  const tableName = resolveSchoolTable();

  const existing = await docClient.send(
    new GetCommand({ TableName: tableName, Key: { PK: `SCHOOL#${schoolId}`, SK: 'METADATA' } }),
  );
  if (!existing.Item) return errorResponse(404, 'School not found.', 'ADMIN_NOT_FOUND');

  const body = JSON.parse(event.body || '{}');
  const now = new Date().toISOString();
  const ALLOWED_FIELDS = ['name', 'district', 'state', 'contactEmail'];
  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return errorResponse(400, 'No valid fields provided for update.', 'ADMIN_INVALID_REQUEST');
  }

  const updated = { ...existing.Item, ...updates, updatedAt: now, updatedBy: decoded.sub };
  await docClient.send(new PutCommand({ TableName: tableName, Item: updated }));

  writeAuditLog({
    action: 'admin.school.update',
    actorId: decoded.sub,
    targetId: schoolId,
    after: updates,
    ip: extractIp(event),
    userAgent: extractUserAgent(event),
    createdAt: now,
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'School updated.', schoolId, updatedAt: now }),
  };
}

// ── M07: Audit & Compliance ───────────────────────────────────────────────────

/**
 * GET /api/admin/audit-log — query audit log with filters
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleQueryAuditLog(event, decoded) {
  const db = getDbAdapter();
  const qs = event.queryStringParameters || {};

  const limitParsed = parseIntParam(qs.limit, 50, 1, 500);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 500.', 'ADMIN_INVALID_REQUEST');
  }
  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be a non-negative integer.', 'ADMIN_INVALID_REQUEST');
  }

  const all = await db.listAll('auditLog');
  let items = Array.isArray(all) ? all : [];

  if (qs.actorId) items = items.filter((e) => e.actorId === qs.actorId);
  if (qs.action) items = items.filter((e) => e.action === qs.action);
  if (qs.targetId) items = items.filter((e) => e.targetId === qs.targetId);
  if (qs.from) items = items.filter((e) => e.createdAt >= qs.from);
  if (qs.to) items = items.filter((e) => e.createdAt <= qs.to);

  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const page = sorted.slice(offsetParsed.value, offsetParsed.value + limitParsed.value);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      events: page,
      pagination: { limit: limitParsed.value, offset: offsetParsed.value, returned: page.length },
    }),
  };
}

/**
 * GET /api/admin/compliance-log — list compliance log
 * @param {Object} event
 * @param {Object} decoded
 */
async function handleListComplianceLog(event, decoded) {
  const db = getDbAdapter();
  const qs = event.queryStringParameters || {};

  const limitParsed = parseIntParam(qs.limit, 50, 1, 500);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 500.', 'ADMIN_INVALID_REQUEST');
  }
  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be a non-negative integer.', 'ADMIN_INVALID_REQUEST');
  }

  const all = await db.listAll('complianceLog');
  let items = Array.isArray(all) ? all : [];

  if (qs.eventType) items = items.filter((e) => e.event === qs.eventType);
  if (qs.actorId) items = items.filter((e) => e.actorId === qs.actorId);
  if (qs.targetUserId) items = items.filter((e) => e.targetUserId === qs.targetUserId);
  if (qs.from) items = items.filter((e) => e.initiatedAt >= qs.from);
  if (qs.to) items = items.filter((e) => e.initiatedAt <= qs.to);

  const sorted = [...items].sort(
    (a, b) => new Date(b.initiatedAt || b.createdAt).getTime() - new Date(a.initiatedAt || a.createdAt).getTime(),
  );

  const page = sorted.slice(offsetParsed.value, offsetParsed.value + limitParsed.value);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      entries: page,
      pagination: { limit: limitParsed.value, offset: offsetParsed.value, returned: page.length },
    }),
  };
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);
    requireRole(decoded, ['admin']);

    const path = event.path || event.routeKey || '';
    const method = event.httpMethod;

    if (method === 'GET' && path.endsWith('/api/admin/policies')) {
      return await handleGetPolicies(decoded);
    }

    if (method === 'PUT' && path.endsWith('/api/admin/policies/model-routing')) {
      const body = JSON.parse(event.body || '{}');
      return await handleUpdateModelRouting(event, decoded, body);
    }

    if (method === 'PUT' && path.endsWith('/api/admin/policies/budget-usage')) {
      const body = JSON.parse(event.body || '{}');
      return await handleUpdateBudgetUsage(event, decoded, body);
    }

    if (method === 'PUT' && path.endsWith('/api/admin/policies/validation-profile')) {
      const body = JSON.parse(event.body || '{}');
      return await handleUpdateValidationProfile(event, decoded, body);
    }

    if (method === 'GET' && path.endsWith('/api/admin/policies/repeat-cap')) {
      return await handleGetRepeatCapPolicy(decoded, event.queryStringParameters || {});
    }

    if (method === 'PUT' && path.endsWith('/api/admin/policies/repeat-cap')) {
      const body = JSON.parse(event.body || '{}');
      return await handleUpdateRepeatCapPolicy(event, decoded, body);
    }

    if (method === 'PUT' && path.endsWith('/api/admin/policies/repeat-cap/overrides')) {
      const body = JSON.parse(event.body || '{}');
      return await handleUpsertRepeatCapOverride(event, decoded, body);
    }

    if (method === 'GET' && path.endsWith('/api/admin/audit/events')) {
      return await handleListAuditEvents(event.queryStringParameters || {});
    }

    // ── M07: User Management ────────────────────────────────────────────────

    if (method === 'GET' && /\/api\/admin\/users$/.test(path)) {
      return await handleListUsers(event, decoded);
    }

    {
      const userId = extractPathParam(path, /\/api\/admin\/users\/([^/]+)\/suspend$/);
      if (method === 'PATCH' && userId) {
        return await handleSuspendUser(event, decoded, userId);
      }
    }

    {
      const userId = extractPathParam(path, /\/api\/admin\/users\/([^/]+)\/unsuspend$/);
      if (method === 'PATCH' && userId) {
        return await handleUnsuspendUser(event, decoded, userId);
      }
    }

    {
      const userId = extractPathParam(path, /\/api\/admin\/users\/([^/]+)\/force-logout$/);
      if (method === 'POST' && userId) {
        return await handleForceLogout(event, decoded, userId);
      }
    }

    {
      const userId = extractPathParam(path, /\/api\/admin\/users\/([^/]+)\/role$/);
      if (method === 'PATCH' && userId) {
        return await handleChangeRole(event, decoded, userId);
      }
    }

    {
      const userId = extractPathParam(path, /\/api\/admin\/users\/([^/]+)$/);
      if (method === 'GET' && userId) {
        return await handleGetUser(event, decoded, userId);
      }
      if (method === 'DELETE' && userId) {
        return await handleCoppaDelete(event, decoded, userId);
      }
    }

    // ── M07: Question Bank Moderation ───────────────────────────────────────

    if (method === 'GET' && /\/api\/admin\/question-bank$/.test(path)) {
      return await handleListQuestions(event, decoded);
    }

    {
      const questionId = extractPathParam(path, /\/api\/admin\/question-bank\/([^/]+)\/flag$/);
      if (method === 'PATCH' && questionId) {
        return await handleFlagQuestion(event, decoded, questionId);
      }
    }

    {
      const questionId = extractPathParam(path, /\/api\/admin\/question-bank\/([^/]+)\/unflag$/);
      if (method === 'PATCH' && questionId) {
        return await handleUnflagQuestion(event, decoded, questionId);
      }
    }

    {
      const questionId = extractPathParam(path, /\/api\/admin\/question-bank\/([^/]+)$/);
      if (method === 'DELETE' && questionId) {
        return await handleSoftDeleteQuestion(event, decoded, questionId);
      }
    }

    // ── M07: Cost Dashboard ─────────────────────────────────────────────────

    if (method === 'GET' && /\/api\/admin\/cost-dashboard\/top-expensive$/.test(path)) {
      return await handleTopExpensive(event, decoded);
    }

    if (method === 'GET' && /\/api\/admin\/cost-dashboard$/.test(path)) {
      return await handleCostDashboard(event, decoded);
    }

    // ── M07: Config Management ──────────────────────────────────────────────

    if (method === 'GET' && /\/api\/admin\/config$/.test(path)) {
      return await handleGetAllConfig(event, decoded);
    }

    {
      const configType = extractPathParam(path, /\/api\/admin\/config\/([^/]+)$/);
      if (configType) {
        if (method === 'GET') return await handleGetConfigByKey(event, decoded, configType);
        if (method === 'PUT') return await handleUpdateConfig(event, decoded, configType);
      }
    }

    // ── M07: School Management ──────────────────────────────────────────────

    if (method === 'POST' && /\/api\/admin\/schools$/.test(path)) {
      return await handleCreateSchool(event, decoded);
    }

    if (method === 'GET' && /\/api\/admin\/schools$/.test(path)) {
      return await handleListSchools(event, decoded);
    }

    {
      const schoolId = extractPathParam(path, /\/api\/admin\/schools\/([^/]+)$/);
      if (schoolId) {
        if (method === 'GET') return await handleGetSchool(event, decoded, schoolId);
        if (method === 'PATCH') return await handleUpdateSchool(event, decoded, schoolId);
      }
    }

    // ── M07: Audit & Compliance ─────────────────────────────────────────────

    if (method === 'GET' && /\/api\/admin\/audit-log$/.test(path)) {
      return await handleQueryAuditLog(event, decoded);
    }

    if (method === 'GET' && /\/api\/admin\/compliance-log$/.test(path)) {
      return await handleListComplianceLog(event, decoded);
    }

    return errorResponse(404, 'Route not found.', 'ADMIN_NOT_FOUND');
  } catch (err) {
    console.error('adminHandler error:', err);
    if (err.statusCode && err.statusCode < 500) {
      const code = err.statusCode === 403 ? 'ADMIN_FORBIDDEN' : 'ADMIN_INVALID_REQUEST';
      return errorResponse(err.statusCode, err.message, code);
    }
    if (err instanceof SyntaxError) {
      return errorResponse(400, 'Invalid JSON in request body.', 'ADMIN_INVALID_REQUEST');
    }
    const isDebug = process.env.DEBUG_MODE === 'true';
    const adminErrResponse = errorResponse(500, isDebug ? err.message : 'Internal server error.', 'ADMIN_INTERNAL_ERROR');
    if (isDebug) {
      const parsedBody = JSON.parse(adminErrResponse.body);
      parsedBody._debug = { stack: err.stack, handler: 'adminHandler', statusCode: 500, timestamp: new Date().toISOString() };
      adminErrResponse.body = JSON.stringify(parsedBody);
    }
    return adminErrResponse;
  }
};