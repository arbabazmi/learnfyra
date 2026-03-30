/**
 * @file src/ai/modelRouter.js
 * @description Model routing control plane. Reads configuration from the local
 * db adapter (table: 'modelConfig', id: 'active') and resolves which AI
 * provider + model to use for a given request.
 *
 * Local dev: config in data-local/modelConfig.json
 * AWS: config from AWS SSM Parameter Store (future Phase 7)
 */

import { randomUUID } from 'crypto';
import { getDbAdapter } from '../db/index.js';

/** Default config installed on first use */
const DEFAULT_CONFIG = {
  id: 'active',
  version: 'v1',
  activeProvider: 'anthropic',
  providers: {
    anthropic: {
      enabled: true,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      maxTokens: 8000,
      weight: 100,
    },
    openai: {
      enabled: false,
      model: 'gpt-4o',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      maxTokens: 8000,
      weight: 0,
    },
  },
  subjectOverrides: {},       // e.g. { "Math": "openai", "ELA": "anthropic" }
  fallback: {
    enabled: true,
    provider: 'openai',
    retryCount: 2,
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

/**
 * Returns the active model config, installing defaults on first use.
 * @returns {Promise<Object>} The active model configuration record
 */
export async function getActiveConfig() {
  const db = getDbAdapter();
  let config = await db.getItem('modelConfig', 'active');
  if (!config) {
    await db.putItem('modelConfig', DEFAULT_CONFIG);
    config = DEFAULT_CONFIG;
  }
  return config;
}

/**
 * Resolves the provider/model/apiKey to use for a request.
 * @param {string} [subject] - Optional subject for override lookup
 * @returns {Promise<{ provider: string, model: string, apiKey: string }>}
 * @throws {Error} If the resolved provider is not enabled and no fallback is available
 */
export async function resolveProvider(subject) {
  const config = await getActiveConfig();

  // Determine provider: subject override > active provider
  let providerName = config.activeProvider;
  if (subject && config.subjectOverrides && config.subjectOverrides[subject]) {
    providerName = config.subjectOverrides[subject];
  }

  const providerCfg = config.providers[providerName];
  if (!providerCfg || !providerCfg.enabled) {
    // Try fallback
    if (config.fallback?.enabled && config.fallback.provider) {
      const fallbackName = config.fallback.provider;
      const fallbackCfg = config.providers[fallbackName];
      if (fallbackCfg && fallbackCfg.enabled) {
        return {
          provider: fallbackName,
          model: fallbackCfg.model,
          apiKey: process.env[fallbackCfg.apiKeyEnvVar] || '',
        };
      }
    }
    throw new Error(`Provider "${providerName}" is not enabled and fallback is unavailable.`);
  }

  return {
    provider: providerName,
    model: providerCfg.model,
    apiKey: process.env[providerCfg.apiKeyEnvVar] || '',
  };
}

/**
 * Update model config and write audit log entry.
 * @param {Object} updates - Partial config updates to merge
 * @param {string} updatedBy - User who made the change (from JWT sub)
 * @param {string} [note] - Optional change note
 * @returns {Promise<Object>} The saved config after merging updates
 */
export async function updateConfig(updates, updatedBy, note = '') {
  const db = getDbAdapter();
  const current = await getActiveConfig();

  const previous = { ...current };
  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await db.putItem('modelConfig', next);

  // Audit log
  await db.putItem('modelAuditLog', {
    id: randomUUID(),
    action: 'CONFIG_UPDATE',
    changedBy: updatedBy,
    changedAt: new Date().toISOString(),
    previousConfig: previous,
    newConfig: next,
    note,
  });

  return next;
}

/**
 * Returns the last N audit log entries, newest first.
 * @param {number} [limit=50]
 * @returns {Promise<Object[]>} Sorted audit log entries
 */
export async function getAuditLog(limit = 50) {
  const db = getDbAdapter();
  const entries = await db.listAll('modelAuditLog');
  return entries
    .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
    .slice(0, limit);
}

/**
 * Rollback to the previous config version (the entry just before the latest).
 * @param {string} restoredBy - User performing the rollback (from JWT sub)
 * @returns {Promise<Object>} The restored config
 * @throws {Error} If there is no audit history or no previous config snapshot
 */
export async function rollbackConfig(restoredBy) {
  const log = await getAuditLog(2);
  if (log.length < 1) throw new Error('No previous config to roll back to.');
  const previous = log[0].previousConfig;
  if (!previous) throw new Error('Previous config snapshot not available.');
  return updateConfig(previous, restoredBy, 'Rollback to previous version');
}

/**
 * Strip API key env var names from a config object before sending to clients.
 * @param {Object} config - The raw config object
 * @returns {Object} A shallow copy with apiKeyEnvVar replaced by '[hidden]' on every provider
 */
export function sanitizeConfig(config) {
  if (!config) return config;
  const sanitized = { ...config };
  if (sanitized.providers) {
    sanitized.providers = Object.fromEntries(
      Object.entries(sanitized.providers).map(([k, v]) => [
        k,
        { ...v, apiKeyEnvVar: '[hidden]' },
      ])
    );
  }
  return sanitized;
}
