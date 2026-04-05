/**
 * @file src/ai/guardrails/guardrailsPolicy.js
 * @description Loads and caches the active guardrail policy and prompt templates
 *   from the DynamoDB LearnfyraConfig table.
 *
 *   Cache strategy: module-level cache with a 5-minute TTL so each Lambda
 *   cold start reads fresh config but warm invocations never wait on DynamoDB.
 *   Falls back to hardcoded defaults if DynamoDB is unavailable or the env
 *   variable CONFIG_TABLE_NAME is not set (local dev without DynamoDB).
 * @agent DEV
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../utils/logger.js';

// ─── DynamoDB client (lazy, reused across invocations) ─────────────────────

let _docClient = null;

/**
 * Returns a lazily-created DynamoDB Document Client.
 * @returns {DynamoDBDocumentClient}
 */
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

/**
 * Returns the DynamoDB config table name from environment variables.
 * @returns {string}
 */
function getConfigTableName() {
  return (
    process.env.CONFIG_TABLE_NAME ||
    `LearnfyraConfig-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`
  );
}

// ─── Hardcoded fallback defaults ──────────────────────────────────────────────

/** @type {GuardrailPolicy} */
const DEFAULT_POLICY = {
  guardrailLevel: 'medium',
  retryLimit: 3,
  enableAwsComprehend: false,
  comprehToxicityThreshold: 0.75,
  validationFilters: ['profanity', 'sensitiveTopics'],
};

const DEFAULT_TEMPLATES = {
  medium:
    'You are generating educational worksheets for Grade [grade] students (ages [age]). ' +
    'All content must be safe, factual, age-appropriate, and aligned with US educational ' +
    'standards. Avoid violence, politics, religion, mature themes, stereotypes, or ' +
    'culturally insensitive material.',
  strict:
    'You are generating educational worksheets for young students in Grade [grade] ' +
    '(ages [age]). Content MUST be completely safe and appropriate for children. Use ' +
    'only simple, positive, and encouraging language. Do NOT include any references to ' +
    'violence, conflict, politics, religion, death, illness, mature themes, stereotypes, ' +
    'or any potentially frightening or upsetting content. All examples must use ' +
    'age-appropriate scenarios (family, school, nature, animals, everyday activities).',
};

// ─── Module-level cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {{ policy: GuardrailPolicy, expiresAt: number } | null} */
let _policyCache = null;

/** @type {Map<string, { template: string, expiresAt: number }>} */
const _templateCache = new Map();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} GuardrailPolicy
 * @property {'medium'|'strict'} guardrailLevel - Active guardrail level
 * @property {number}  retryLimit                - Maximum generation retries (0-5)
 * @property {boolean} enableAwsComprehend       - Whether AWS Comprehend is enabled
 * @property {number}  comprehToxicityThreshold  - Comprehend toxicity threshold (0.0-1.0)
 * @property {string[]} validationFilters        - Active validator names
 */

/**
 * Loads the active guardrail policy from DynamoDB, with a 5-minute cache.
 * Falls back to DEFAULT_POLICY if DynamoDB is unavailable or CONFIG_TABLE_NAME
 * is not set.
 *
 * @returns {Promise<GuardrailPolicy>}
 */
export async function getGuardrailPolicy() {
  const now = Date.now();

  if (_policyCache && _policyCache.expiresAt > now) {
    return _policyCache.policy;
  }

  const tableName = getConfigTableName();

  // Skip DynamoDB read in local dev when no table is configured
  if (!process.env.CONFIG_TABLE_NAME && !process.env.DYNAMODB_ENDPOINT) {
    _policyCache = { policy: { ...DEFAULT_POLICY }, expiresAt: now + CACHE_TTL_MS };
    return _policyCache.policy;
  }

  try {
    const result = await getDocClient().send(
      new GetCommand({
        TableName: tableName,
        Key: { configKey: 'guardrail:policy' },
      })
    );

    if (!result.Item?.value) {
      logger.warn('guardrailsPolicy: guardrail:policy not found in DynamoDB — using default');
      _policyCache = { policy: { ...DEFAULT_POLICY }, expiresAt: now + CACHE_TTL_MS };
      return _policyCache.policy;
    }

    const policy = JSON.parse(result.Item.value);

    // Validate and clamp fields so a bad DB entry cannot break generation
    const safePolicy = {
      guardrailLevel:
        policy.guardrailLevel === 'strict' ? 'strict' : 'medium',
      retryLimit:
        Math.max(0, Math.min(5, Number(policy.retryLimit ?? DEFAULT_POLICY.retryLimit))),
      enableAwsComprehend: Boolean(policy.enableAwsComprehend),
      comprehToxicityThreshold:
        Math.max(0, Math.min(1, Number(policy.comprehToxicityThreshold ?? 0.75))),
      validationFilters:
        Array.isArray(policy.validationFilters)
          ? policy.validationFilters
          : DEFAULT_POLICY.validationFilters,
    };

    _policyCache = { policy: safePolicy, expiresAt: now + CACHE_TTL_MS };
    return safePolicy;
  } catch (err) {
    logger.warn(`guardrailsPolicy: DynamoDB read failed — using default. Error: ${err.message}`);
    _policyCache = { policy: { ...DEFAULT_POLICY }, expiresAt: now + CACHE_TTL_MS };
    return _policyCache.policy;
  }
}

/**
 * Loads the guardrail prompt template for the given level from DynamoDB,
 * with a 5-minute cache. Falls back to hardcoded DEFAULT_TEMPLATES on failure.
 *
 * @param {'medium'|'strict'} level - Guardrail level
 * @returns {Promise<string>} Template string with [grade] and [age] placeholders
 */
export async function getGuardrailTemplate(level) {
  const normalizedLevel = level === 'strict' ? 'strict' : 'medium';
  const cacheKey = `guardrail:${normalizedLevel}:template`;
  const now = Date.now();

  const cached = _templateCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.template;
  }

  const tableName = getConfigTableName();

  // Skip DynamoDB in local dev
  if (!process.env.CONFIG_TABLE_NAME && !process.env.DYNAMODB_ENDPOINT) {
    const template = DEFAULT_TEMPLATES[normalizedLevel];
    _templateCache.set(cacheKey, { template, expiresAt: now + CACHE_TTL_MS });
    return template;
  }

  try {
    const result = await getDocClient().send(
      new GetCommand({
        TableName: tableName,
        Key: { configKey: cacheKey },
      })
    );

    if (!result.Item?.value) {
      logger.warn(`guardrailsPolicy: ${cacheKey} not found in DynamoDB — using default`);
      const template = DEFAULT_TEMPLATES[normalizedLevel];
      _templateCache.set(cacheKey, { template, expiresAt: now + CACHE_TTL_MS });
      return template;
    }

    const template = result.Item.value;
    _templateCache.set(cacheKey, { template, expiresAt: now + CACHE_TTL_MS });
    return template;
  } catch (err) {
    logger.warn(
      `guardrailsPolicy: DynamoDB template read failed — using default. Error: ${err.message}`
    );
    const template = DEFAULT_TEMPLATES[normalizedLevel];
    _templateCache.set(cacheKey, { template, expiresAt: now + CACHE_TTL_MS });
    return template;
  }
}

/**
 * Forces the policy and template caches to expire immediately.
 * Useful in tests and when an admin updates the policy via the admin API.
 * @returns {void}
 */
export function invalidatePolicyCache() {
  _policyCache = null;
  _templateCache.clear();
}
