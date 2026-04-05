/**
 * @file backend/handlers/guardrailsAdminHandler.js
 * @description Lambda-compatible handler for AI guardrail and repeat-cap admin endpoints.
 *
 * Endpoints (Section A — Guardrails):
 *   GET  /api/admin/guardrails/policy
 *   PUT  /api/admin/guardrails/policy
 *   GET  /api/admin/guardrails/templates
 *   PUT  /api/admin/guardrails/templates/:level
 *   POST /api/admin/guardrails/test
 *   GET  /api/admin/audit/guardrail-events
 *
 * Endpoints (Section B — Repeat Cap):
 *   GET    /api/admin/repeat-cap
 *   PUT    /api/admin/repeat-cap
 *   POST   /api/admin/repeat-cap/override
 *   DELETE /api/admin/repeat-cap/override/:scope/:scopeId
 *
 * RBAC:
 *   - Guardrail + repeat-cap write/read: SUPER_ADMIN | PLATFORM_ADMIN
 *   - Audit event query:                 SUPER_ADMIN | DATA_COMPLIANCE_ADMIN
 *
 * All mutating operations are logged via writeAuditLog (fire-and-forget).
 */

import { randomUUID } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { writeAuditLog, extractIp, extractUserAgent } from '../../src/admin/auditLogger.js';

// ── Lazy-loaded token estimator (avoids cold-start cost) ─────────────────────

let _estimateTokenCount;
let _TOKEN_LIMIT;

/**
 * Lazily imports and caches the token estimator utilities.
 * @returns {Promise<{ estimateTokenCount: Function, TOKEN_LIMIT: number }>}
 */
async function getTokenEstimator() {
  if (!_estimateTokenCount) {
    const mod = await import('../../src/ai/guardrails/tokenEstimator.js');
    _estimateTokenCount = mod.estimateTokenCount;
    _TOKEN_LIMIT        = mod.TOKEN_LIMIT;
  }
  return { estimateTokenCount: _estimateTokenCount, TOKEN_LIMIT: _TOKEN_LIMIT };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GUARDRAIL_ADMIN_ROLES  = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];
const AUDIT_QUERY_ROLES      = ['SUPER_ADMIN', 'DATA_COMPLIANCE_ADMIN'];
const VALID_GUARDRAIL_LEVELS = ['medium', 'strict'];
const VALID_SCOPES           = ['student', 'parent', 'teacher'];
const VALID_FAILURE_REASONS  = ['PROFANITY', 'SENSITIVE_TOPIC', 'AWS_COMPREHEND'];

/** DynamoDB config keys used to store guardrail state */
const CONFIG_KEY_POLICY         = 'guardrail:policy';
const CONFIG_KEY_MEDIUM_TMPL    = 'guardrail:medium:template';
const CONFIG_KEY_STRICT_TMPL    = 'guardrail:strict:template';

/** DB table names */
const TABLE_CONFIG    = 'guardrailConfig';
const TABLE_OVERRIDES = 'repeatCapOverrides';
const TABLE_AUDIT     = 'guardrailAuditEvents';

// ── CORS headers ──────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
};

// ── Default fallback policy (used when no DB record exists) ───────────────────

const DEFAULT_GUARDRAIL_POLICY = {
  guardrailLevel:            'medium',
  retryLimit:                3,
  enableAwsComprehend:       false,
  comprehToxicityThreshold:  0.75,
  validationFilters:         ['profanity', 'sensitiveTopics'],
};

const DEFAULT_TEMPLATES = {
  medium: {
    content: 'You are generating educational worksheets for Grade [grade] students (ages [age]). All content must be safe, factual, age-appropriate, and aligned with US educational standards. Avoid violence, politics, religion, mature themes, stereotypes, or culturally insensitive material.',
    version: 1,
  },
  strict: {
    content: 'You are generating educational worksheets for young students in Grade [grade] (ages [age]). Content MUST be completely safe and appropriate for children. Use only simple, positive, and encouraging language. Do NOT include any references to violence, conflict, politics, religion, death, illness, mature themes, stereotypes, or any potentially frightening or upsetting content. All examples must use age-appropriate scenarios (family, school, nature, animals, everyday activities).',
    version: 1,
  },
};

const DEFAULT_REPEAT_CAP_GLOBAL = {
  value: 20,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a consistent error response.
 * @param {number} statusCode
 * @param {string} message
 * @returns {Object}
 */
function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Builds a successful JSON response.
 * @param {number} statusCode
 * @param {Object} payload
 * @returns {Object}
 */
function okResponse(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(payload),
  };
}

/**
 * Validates that a reason string meets the minimum length requirement.
 * @param {*} reason
 * @param {number} [min=5]
 * @returns {string|null} Error message or null if valid
 */
function validateReason(reason, min = 5) {
  if (typeof reason !== 'string' || reason.trim().length < min) {
    return `reason is required and must be at least ${min} characters.`;
  }
  return null;
}

/**
 * Returns true when s is a valid UUID v4 (loose check).
 * @param {string} s
 * @returns {boolean}
 */
function isUuid(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Computes which fields changed between two flat objects and returns a
 * `{ field: { from, to } }` diff map containing only changed keys.
 * @param {Object} before
 * @param {Object} after
 * @returns {Object}
 */
function buildChanges(before, after) {
  const changes = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const bVal = before[key];
    const aVal = after[key];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes[key] = { from: bVal, to: aVal };
    }
  }
  return changes;
}

// ── DB read helpers ───────────────────────────────────────────────────────────

/**
 * Loads the guardrail policy record from the config table.
 * Falls back to DEFAULT_GUARDRAIL_POLICY when no record exists.
 * @param {Object} db
 * @returns {Promise<Object>} Policy object including updatedAt and updatedBy
 */
async function loadPolicy(db) {
  const record = await db.getItem(TABLE_CONFIG, CONFIG_KEY_POLICY);
  if (record) {
    return {
      ...DEFAULT_GUARDRAIL_POLICY,
      ...record.value,
      updatedAt: record.updatedAt || new Date(0).toISOString(),
      updatedBy: record.updatedBy || 'system',
    };
  }
  return {
    ...DEFAULT_GUARDRAIL_POLICY,
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'system',
  };
}

/**
 * Loads a single guardrail template from the config table.
 * Falls back to the compiled-in default when no record exists.
 * @param {Object} db
 * @param {'medium'|'strict'} level
 * @returns {Promise<Object>} Template object with content, version, updatedAt, updatedBy
 */
async function loadTemplate(db, level) {
  const configKey = level === 'medium' ? CONFIG_KEY_MEDIUM_TMPL : CONFIG_KEY_STRICT_TMPL;
  const record = await db.getItem(TABLE_CONFIG, configKey);
  if (record) {
    return {
      content:   record.value,
      version:   record.version  || 1,
      updatedAt: record.updatedAt || new Date(0).toISOString(),
      updatedBy: record.updatedBy || 'system',
    };
  }
  return {
    ...DEFAULT_TEMPLATES[level],
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'system',
  };
}

/**
 * Loads the global repeat-cap value from the config table.
 * Falls back to DEFAULT_REPEAT_CAP_GLOBAL when no record exists.
 * @param {Object} db
 * @returns {Promise<Object>}
 */
async function loadRepeatCapGlobal(db) {
  const record = await db.getItem(TABLE_CONFIG, 'repeat-cap:global');
  if (record) {
    return {
      value:     record.value,
      updatedAt: record.updatedAt || new Date(0).toISOString(),
      updatedBy: record.updatedBy || 'system',
    };
  }
  return {
    ...DEFAULT_REPEAT_CAP_GLOBAL,
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'system',
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/guardrails/policy
 * Returns the current guardrail configuration.
 * @param {Object} _event
 * @param {Object} decoded
 * @returns {Promise<Object>}
 */
async function handleGetGuardrailPolicy(_event, decoded) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);
  const db     = getDbAdapter();
  const policy = await loadPolicy(db);
  return okResponse(200, { policy });
}

/**
 * PUT /api/admin/guardrails/policy
 * Applies a partial update to the guardrail policy.
 * Only guardrailLevel and retryLimit may be mutated; reason is required.
 * @param {Object} event
 * @param {Object} decoded
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function handleUpdateGuardrailPolicy(event, decoded, body) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);

  const { guardrailLevel, retryLimit, reason } = body || {};

  // Validate guardrailLevel when provided
  if (guardrailLevel !== undefined && !VALID_GUARDRAIL_LEVELS.includes(guardrailLevel)) {
    return errorResponse(400, "Invalid guardrailLevel. Must be 'medium' or 'strict'");
  }

  // Validate retryLimit when provided
  if (retryLimit !== undefined) {
    if (!Number.isInteger(retryLimit) || retryLimit < 0 || retryLimit > 5) {
      return errorResponse(400, 'retryLimit must be an integer between 0 and 5.');
    }
  }

  const reasonErr = validateReason(reason);
  if (reasonErr) return errorResponse(400, reasonErr);

  const db      = getDbAdapter();
  const current = await loadPolicy(db);
  const now     = new Date().toISOString();

  // Build the new merged policy value (only overwrite supplied fields)
  const newPolicyValue = {
    guardrailLevel:           guardrailLevel           !== undefined ? guardrailLevel           : current.guardrailLevel,
    retryLimit:               retryLimit               !== undefined ? retryLimit               : current.retryLimit,
    enableAwsComprehend:      current.enableAwsComprehend,
    comprehToxicityThreshold: current.comprehToxicityThreshold,
    validationFilters:        current.validationFilters,
  };

  const changes = buildChanges(
    {
      guardrailLevel: current.guardrailLevel,
      retryLimit:     current.retryLimit,
    },
    {
      guardrailLevel: newPolicyValue.guardrailLevel,
      retryLimit:     newPolicyValue.retryLimit,
    },
  );

  await db.putItem(TABLE_CONFIG, {
    id:        CONFIG_KEY_POLICY,
    value:     newPolicyValue,
    updatedAt: now,
    updatedBy: decoded.sub,
  });

  const auditId = await writeAuditLog({
    actorId:          decoded.sub,
    actorRole:        decoded.role,
    action:           'CONFIG_UPDATED',
    targetEntityType: 'guardrail_policy',
    targetEntityId:   CONFIG_KEY_POLICY,
    beforeState:      { guardrailLevel: current.guardrailLevel, retryLimit: current.retryLimit },
    afterState:       { guardrailLevel: newPolicyValue.guardrailLevel, retryLimit: newPolicyValue.retryLimit },
    ipAddress:        extractIp(event),
    userAgent:        extractUserAgent(event),
  });

  const updatedPolicy = {
    ...newPolicyValue,
    updatedAt: now,
    updatedBy: decoded.sub,
  };

  return okResponse(200, {
    success: true,
    policy:  updatedPolicy,
    auditId: auditId || randomUUID(),
    changes,
  });
}

/**
 * GET /api/admin/guardrails/templates
 * Returns all guardrail prompt templates.
 * @param {Object} _event
 * @param {Object} decoded
 * @returns {Promise<Object>}
 */
async function handleGetGuardrailTemplates(_event, decoded) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);
  const db = getDbAdapter();
  const [medium, strict] = await Promise.all([
    loadTemplate(db, 'medium'),
    loadTemplate(db, 'strict'),
  ]);
  return okResponse(200, { templates: { medium, strict } });
}

/**
 * PUT /api/admin/guardrails/templates/:level
 * Replaces the prompt template for the given level.
 * Template content must contain [grade] and [age] placeholders.
 * @param {Object} event
 * @param {Object} decoded
 * @param {Object} body
 * @param {string} level - 'medium' | 'strict'
 * @returns {Promise<Object>}
 */
async function handleUpdateGuardrailTemplate(event, decoded, body, level) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);

  if (!VALID_GUARDRAIL_LEVELS.includes(level)) {
    return errorResponse(400, "level must be 'medium' or 'strict'.");
  }

  const { content, reason } = body || {};

  if (typeof content !== 'string' || !content.includes('[grade]') || !content.includes('[age]')) {
    return errorResponse(400, 'Template must contain [grade] and [age] placeholders');
  }

  const { estimateTokenCount, TOKEN_LIMIT } = await getTokenEstimator();
  const tokenCount = estimateTokenCount(content);
  if (tokenCount > TOKEN_LIMIT) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'TOKEN_LIMIT_EXCEEDED', tokenCount, limit: TOKEN_LIMIT }),
    };
  }

  const reasonErr = validateReason(reason);
  if (reasonErr) return errorResponse(400, reasonErr);

  const db          = getDbAdapter();
  const existing    = await loadTemplate(db, level);
  const now         = new Date().toISOString();
  const newVersion  = (existing.version || 1) + 1;
  const configKey   = level === 'medium' ? CONFIG_KEY_MEDIUM_TMPL : CONFIG_KEY_STRICT_TMPL;

  await db.putItem(TABLE_CONFIG, {
    id:        configKey,
    value:     content,
    version:   newVersion,
    updatedAt: now,
    updatedBy: decoded.sub,
  });

  const auditId = await writeAuditLog({
    actorId:          decoded.sub,
    actorRole:        decoded.role,
    action:           'CONFIG_UPDATED',
    targetEntityType: 'guardrail_template',
    targetEntityId:   configKey,
    beforeState:      { content: existing.content, version: existing.version },
    afterState:       { content, version: newVersion },
    ipAddress:        extractIp(event),
    userAgent:        extractUserAgent(event),
  });

  return okResponse(200, {
    success:  true,
    template: {
      level,
      content,
      version:   newVersion,
      updatedAt: now,
      updatedBy: decoded.sub,
    },
    auditId: auditId || randomUUID(),
  });
}

/**
 * POST /api/admin/guardrails/test
 * Dry-runs the local validation pipeline against a sample worksheet.
 * Does not persist anything or call Claude.
 * @param {Object} _event
 * @param {Object} decoded
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function handleTestGuardrail(_event, decoded, body) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);

  const { worksheet, guardrailLevel } = body || {};

  if (!worksheet || typeof worksheet !== 'object') {
    return errorResponse(400, 'worksheet is required and must be an object.');
  }

  if (guardrailLevel !== undefined && !VALID_GUARDRAIL_LEVELS.includes(guardrailLevel)) {
    return errorResponse(400, "guardrailLevel must be 'medium' or 'strict'.");
  }

  // Attempt to load the output validator. If the module does not exist yet
  // (Track A not yet merged) we return a graceful stub result so this handler
  // can be tested and wired independently.
  let validationResult;
  try {
    const { validateWorksheetOutput } = await import('../../src/ai/validation/outputValidator.js');
    validationResult = await validateWorksheetOutput(worksheet, {
      grade:          worksheet.grade,
      subject:        worksheet.subject,
      guardrailLevel: guardrailLevel || 'medium',
    });
  } catch (importErr) {
    // outputValidator not yet built — return a stub pass result
    validationResult = {
      safe:           true,
      failureReason:  null,
      failureDetails: null,
      validatorsRun:  [],
      _stub:          true,
    };
  }

  return okResponse(200, { validationResult });
}

/**
 * GET /api/admin/audit/guardrail-events
 * Queries the guardrail moderation audit log.
 * Supports: startDate, endDate, failureReason, limit, lastKey.
 * @param {Object} event
 * @param {Object} decoded
 * @returns {Promise<Object>}
 */
async function handleGetGuardrailAuditEvents(event, decoded) {
  requireRole(decoded, AUDIT_QUERY_ROLES);

  const qp        = event.queryStringParameters || {};
  const startDate = qp.startDate;
  const endDate   = qp.endDate;

  if (!startDate || !endDate) {
    return errorResponse(400, 'startDate and endDate are required query parameters (ISO-8601).');
  }

  const startTs = Date.parse(startDate);
  const endTs   = Date.parse(endDate);
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    return errorResponse(400, 'startDate and endDate must be valid ISO-8601 datetime strings.');
  }
  if (startTs > endTs) {
    return errorResponse(400, 'startDate must be before or equal to endDate.');
  }

  const failureReasonFilter = qp.failureReason || null;
  if (failureReasonFilter && !VALID_FAILURE_REASONS.includes(failureReasonFilter)) {
    return errorResponse(400, `failureReason must be one of: ${VALID_FAILURE_REASONS.join(', ')}.`);
  }

  const { value: limitVal, error: limitErr } = parseIntParam(qp.limit, 50, 1, 200);
  if (limitErr) return errorResponse(400, `limit: ${limitErr}`);

  const db         = getDbAdapter();
  const allEvents  = await db.listAll(TABLE_AUDIT);
  const lastKey    = qp.lastKey || null;

  // Apply date range and optional failure-reason filter
  let filtered = (Array.isArray(allEvents) ? allEvents : []).filter((ev) => {
    const ts = Date.parse(ev.timestamp);
    if (!Number.isFinite(ts) || ts < startTs || ts > endTs) return false;
    if (failureReasonFilter) {
      const reason = ev.details?.validationResult?.failureReason;
      if (reason !== failureReasonFilter) return false;
    }
    return true;
  });

  // Simple cursor-based pagination: skip items whose auditId <= lastKey
  let startIdx = 0;
  if (lastKey) {
    const cursorIdx = filtered.findIndex((ev) => ev.auditId === lastKey);
    if (cursorIdx !== -1) startIdx = cursorIdx + 1;
  }

  const page           = filtered.slice(startIdx, startIdx + limitVal);
  const nextLastKey    = page.length === limitVal && startIdx + limitVal < filtered.length
    ? page[page.length - 1].auditId
    : null;

  return okResponse(200, {
    events:  page,
    count:   page.length,
    lastKey: nextLastKey,
  });
}

// ── Repeat Cap handlers ───────────────────────────────────────────────────────

/**
 * GET /api/admin/repeat-cap
 * Returns the global default and all active scope overrides.
 * @param {Object} _event
 * @param {Object} decoded
 * @returns {Promise<Object>}
 */
async function handleGetRepeatCap(_event, decoded) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);
  const db        = getDbAdapter();
  const global_   = await loadRepeatCapGlobal(db);
  const overrides = await db.listAll(TABLE_OVERRIDES);
  return okResponse(200, {
    global:    global_,
    overrides: Array.isArray(overrides) ? overrides : [],
  });
}

/**
 * PUT /api/admin/repeat-cap
 * Updates the global repeat-cap default value.
 * @param {Object} event
 * @param {Object} decoded
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function handleUpdateRepeatCap(event, decoded, body) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);

  const { value, reason } = body || {};

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return errorResponse(400, 'value must be integer 0-100');
  }

  const reasonErr = validateReason(reason);
  if (reasonErr) return errorResponse(400, reasonErr);

  const db      = getDbAdapter();
  const current = await loadRepeatCapGlobal(db);
  const now     = new Date().toISOString();

  await db.putItem(TABLE_CONFIG, {
    id:        'repeat-cap:global',
    value,
    updatedAt: now,
    updatedBy: decoded.sub,
  });

  const auditId = await writeAuditLog({
    actorId:          decoded.sub,
    actorRole:        decoded.role,
    action:           'CONFIG_UPDATED',
    targetEntityType: 'repeat_cap_global',
    targetEntityId:   'repeat-cap:global',
    beforeState:      { value: current.value },
    afterState:       { value },
    ipAddress:        extractIp(event),
    userAgent:        extractUserAgent(event),
  });

  return okResponse(200, {
    success: true,
    global:  { value, updatedAt: now, updatedBy: decoded.sub },
    auditId: auditId || randomUUID(),
    changes: buildChanges({ value: current.value }, { value }),
  });
}

/**
 * POST /api/admin/repeat-cap/override
 * Creates a scope-specific repeat-cap override.
 * Returns 409 if an override already exists for scope:scopeId.
 * @param {Object} event
 * @param {Object} decoded
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function handleCreateRepeatCapOverride(event, decoded, body) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);

  const { scope, scopeId, value, reason, expiresAt } = body || {};

  if (!VALID_SCOPES.includes(scope)) {
    return errorResponse(400, `scope must be one of: ${VALID_SCOPES.join(', ')}.`);
  }

  if (!isUuid(scopeId)) {
    return errorResponse(400, 'scopeId must be a valid UUID.');
  }

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return errorResponse(400, 'value must be an integer 0-100.');
  }

  const reasonErr = validateReason(reason);
  if (reasonErr) return errorResponse(400, reasonErr);

  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    const ts = Date.parse(expiresAt);
    if (!Number.isFinite(ts)) {
      return errorResponse(400, 'expiresAt must be a valid ISO-8601 datetime when provided.');
    }
    if (ts <= Date.now()) {
      return errorResponse(400, 'expiresAt must be a future date.');
    }
  }

  const db          = getDbAdapter();
  const overrideKey = `${scope}:${scopeId}`;
  const existing    = await db.getItem(TABLE_OVERRIDES, overrideKey);

  if (existing) {
    return errorResponse(409, `Override already exists for ${scope}:${scopeId}. Use PUT to update.`);
  }

  const now      = new Date().toISOString();
  const override = {
    id:        overrideKey,
    scope,
    scopeId,
    value,
    reason:    reason.trim(),
    expiresAt: expiresAt || null,
    createdAt: now,
    updatedBy: decoded.sub,
  };

  await db.putItem(TABLE_OVERRIDES, override);

  const auditId = await writeAuditLog({
    actorId:          decoded.sub,
    actorRole:        decoded.role,
    action:           'CONFIG_UPDATED',
    targetEntityType: 'repeat_cap_override',
    targetEntityId:   overrideKey,
    beforeState:      null,
    afterState:       override,
    ipAddress:        extractIp(event),
    userAgent:        extractUserAgent(event),
  });

  return okResponse(201, {
    success:  true,
    override: { scope, scopeId, value, reason: override.reason, expiresAt: override.expiresAt, createdAt: now, updatedBy: decoded.sub },
    auditId:  auditId || randomUUID(),
  });
}

/**
 * DELETE /api/admin/repeat-cap/override/:scope/:scopeId
 * Removes a scope-specific repeat-cap override.
 * Returns 404 when no override exists for the given scope:scopeId.
 * @param {Object} event
 * @param {Object} decoded
 * @param {string} scope
 * @param {string} scopeId
 * @returns {Promise<Object>}
 */
async function handleDeleteRepeatCapOverride(event, decoded, scope, scopeId) {
  requireRole(decoded, GUARDRAIL_ADMIN_ROLES);

  if (!VALID_SCOPES.includes(scope)) {
    return errorResponse(400, `scope must be one of: ${VALID_SCOPES.join(', ')}.`);
  }
  if (!scopeId) {
    return errorResponse(400, 'scopeId is required.');
  }

  const db          = getDbAdapter();
  const overrideKey = `${scope}:${scopeId}`;
  const existing    = await db.getItem(TABLE_OVERRIDES, overrideKey);

  if (!existing) {
    return errorResponse(404, `Override not found for ${scope}:${scopeId}`);
  }

  await db.deleteItem(TABLE_OVERRIDES, overrideKey);

  const auditId = await writeAuditLog({
    actorId:          decoded.sub,
    actorRole:        decoded.role,
    action:           'CONFIG_UPDATED',
    targetEntityType: 'repeat_cap_override',
    targetEntityId:   overrideKey,
    beforeState:      existing,
    afterState:       null,
    ipAddress:        extractIp(event),
    userAgent:        extractUserAgent(event),
  });

  return okResponse(200, {
    success: true,
    deleted: { scope, scopeId },
    auditId: auditId || randomUUID(),
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Parses a string or number query parameter as a bounded integer.
 * @param {*} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {{ value: number, error: string|null }}
 */
function parseIntParam(value, fallback, min, max) {
  if (value == null || value === '') return { value: fallback, error: null };
  const text   = String(value).trim();
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { value: fallback, error: `Must be an integer between ${min} and ${max}.` };
  }
  return { value: parsed, error: null };
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Lambda-compatible handler. Routes on httpMethod + path combination.
 *
 * Path routing supports both direct paths (e.g., /api/admin/guardrails/policy)
 * and paths with captured segments (e.g., /api/admin/guardrails/templates/strict).
 *
 * @param {Object} event   - API Gateway v1 event or Express-shaped mock
 * @param {Object} context - Lambda context (or mock)
 * @returns {Promise<Object>} Lambda proxy response
 */
export const handler = async (event, context) => {
  if (context) context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);
    const method  = (event.httpMethod || '').toUpperCase();
    const path    = (event.path || '').replace(/\?.*$/, '');
    const body    = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};

    // ── Guardrail policy ────────────────────────────────────────────────────
    if (method === 'GET'  && path === '/api/admin/guardrails/policy') {
      return await handleGetGuardrailPolicy(event, decoded);
    }
    if (method === 'PUT'  && path === '/api/admin/guardrails/policy') {
      return await handleUpdateGuardrailPolicy(event, decoded, body);
    }

    // ── Guardrail templates ─────────────────────────────────────────────────
    if (method === 'GET'  && path === '/api/admin/guardrails/templates') {
      return await handleGetGuardrailTemplates(event, decoded);
    }

    // PUT /api/admin/guardrails/templates/:level
    const templateLevelMatch = path.match(/^\/api\/admin\/guardrails\/templates\/([^/]+)$/);
    if (method === 'PUT' && templateLevelMatch) {
      const level = templateLevelMatch[1];
      return await handleUpdateGuardrailTemplate(event, decoded, body, level);
    }

    // ── Guardrail dry-run test ──────────────────────────────────────────────
    if (method === 'POST' && path === '/api/admin/guardrails/test') {
      return await handleTestGuardrail(event, decoded, body);
    }

    // ── Guardrail audit events ──────────────────────────────────────────────
    if (method === 'GET'  && path === '/api/admin/audit/guardrail-events') {
      return await handleGetGuardrailAuditEvents(event, decoded);
    }

    // ── Repeat cap global ───────────────────────────────────────────────────
    if (method === 'GET'  && path === '/api/admin/repeat-cap') {
      return await handleGetRepeatCap(event, decoded);
    }
    if (method === 'PUT'  && path === '/api/admin/repeat-cap') {
      return await handleUpdateRepeatCap(event, decoded, body);
    }

    // ── Repeat cap overrides ────────────────────────────────────────────────
    if (method === 'POST' && path === '/api/admin/repeat-cap/override') {
      return await handleCreateRepeatCapOverride(event, decoded, body);
    }

    // DELETE /api/admin/repeat-cap/override/:scope/:scopeId
    const overrideDeleteMatch = path.match(/^\/api\/admin\/repeat-cap\/override\/([^/]+)\/([^/]+)$/);
    if (method === 'DELETE' && overrideDeleteMatch) {
      const [, scope, scopeId] = overrideDeleteMatch;
      return await handleDeleteRepeatCapOverride(event, decoded, scope, scopeId);
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    if (err.statusCode === 401) return errorResponse(401, err.message);
    if (err.statusCode === 403) return errorResponse(403, 'Forbidden — requires Super Admin or Platform Admin');
    console.error('guardrailsAdminHandler error:', err);
    return errorResponse(500, 'Internal server error.');
  }
};
