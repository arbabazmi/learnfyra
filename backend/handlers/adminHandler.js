/**
 * @file backend/handlers/adminHandler.js
 * @description Lambda-compatible admin control-plane handler for policy management.
 */

import { createHash, randomUUID } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';

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
  if (existing) return existing;

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

async function applyIdempotentMutation(db, event, decoded, action, mutationFn) {
  const key = getIdempotencyKey(event.headers || {});
  if (!key || typeof key !== 'string' || !key.trim()) {
    return errorResponse(400, 'Idempotency-Key header is required.', 'ADMIN_INVALID_REQUEST');
  }

  const endpoint = `${event.httpMethod}:${event.path || event.routeKey || ''}`;
  const recordId = `${decoded.sub}#${endpoint}#${key.trim()}`;
  const requestHash = hashRequest(event.body || {});

  const existing = await db.getItem('adminIdempotency', recordId);
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

  const response = await mutationFn();

  if (response.statusCode < 400) {
    await db.putItem('adminIdempotency', {
      id: recordId,
      actorId: decoded.sub,
      idempotencyKey: key.trim(),
      action,
      requestHash,
      responseStatusCode: response.statusCode,
      responseBody: response.body,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
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
      updatedAt: policy.updatedAt,
      updatedBy: policy.updatedBy,
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

    if (method === 'GET' && path.endsWith('/api/admin/audit/events')) {
      return await handleListAuditEvents(event.queryStringParameters || {});
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
    return errorResponse(500, 'Internal server error.', 'ADMIN_INTERNAL_ERROR');
  }
};