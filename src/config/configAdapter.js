/**
 * @file src/config/configAdapter.js
 * @description Reads configuration from LearnfyraConfig DynamoDB table.
 *
 * Used to fetch admin SNS topic ARN, feature flags, and other operational config.
 * Lazy-loads on first call; caches for 5 minutes to avoid repeated DB hits.
 * Falls back to env vars when table lookup fails (graceful degradation).
 *
 * @agent DEV
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// DynamoDB client — lazy singleton
// ---------------------------------------------------------------------------

let _docClient = null;

function getDocClient() {
  if (!_docClient) {
    const clientConfig = { region: process.env.AWS_REGION || 'us-east-1' };

    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.credentials = {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
      };
    }

    const base = new DynamoDBClient(clientConfig);
    _docClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

// ---------------------------------------------------------------------------
// Table name
// ---------------------------------------------------------------------------

const getConfigTable = () =>
  process.env.LEARNFYRA_CONFIG_TABLE ||
  `LearnfyraConfig-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;

// ---------------------------------------------------------------------------
// In-memory cache with TTL
// ---------------------------------------------------------------------------

const _cache = new Map(); // key → { value, expiresAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches a config value by key from the LearnfyraConfig DynamoDB table.
 *
 * On cache hit (not expired) → returns cached value.
 * On cache miss/expiry → queries DynamoDB, caches result, returns.
 * On DynamoDB error → logs warning, returns fallback env var.
 *
 * @param {string} configKey      - The config key (e.g. 'admin-fallback-sns-topic-arn')
 * @param {string} [envVarFallback] - Environment variable name to fall back to
 * @returns {Promise<string|null>}
 */
export async function getConfig(configKey, envVarFallback) {
  // Check cache first
  const cached = _cache.get(configKey);
  if (cached && Date.now() < cached.expiresAt) {
    logger.debug(`configAdapter cache hit for ${configKey}`);
    return cached.value;
  }

  try {
    const result = await getDocClient().send(new GetCommand({
      TableName: getConfigTable(),
      Key: { configKey },
    }));

    const value = result.Item?.value ?? null;

    // Cache even null to avoid repeated queries for missing keys
    _cache.set(configKey, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    if (value) {
      logger.debug(`configAdapter fetched ${configKey} from DynamoDB`);
    }
    return value;
  } catch (err) {
    logger.warn(`configAdapter DynamoDB lookup failed for ${configKey}: ${err.message}`);

    // Fall back to environment variable
    if (envVarFallback) {
      const envValue = process.env[envVarFallback];
      if (envValue) {
        logger.info(`configAdapter falling back to env var ${envVarFallback}`);
        return envValue;
      }
    }
    return null;
  }
}

/**
 * Clears the in-memory config cache (useful for tests).
 */
export function clearConfigCache() {
  _cache.clear();
}
