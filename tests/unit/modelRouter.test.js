/**
 * @file tests/unit/modelRouter.test.js
 * @description Unit tests for src/ai/modelRouter.js
 * The db adapter is mocked to avoid real file I/O.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock db adapter methods ──────────────────────────────────────────────────

const mockGetItem    = jest.fn();
const mockPutItem    = jest.fn();
const mockListAll    = jest.fn();
const mockUpdateItem = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem:    mockGetItem,
    putItem:    mockPutItem,
    listAll:    mockListAll,
    updateItem: mockUpdateItem,
  })),
}));

// ─── Dynamic imports (must come after all mockModule calls) ───────────────────

const {
  getActiveConfig,
  resolveProvider,
  updateConfig,
  getAuditLog,
  rollbackConfig,
  sanitizeConfig,
} = await import('../../src/ai/modelRouter.js');

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_CONFIG = {
  id: 'active',
  version: 'v1',
  activeProvider: 'anthropic',
  providers: {
    anthropic: {
      enabled: true,
      model: 'claude-sonnet-4-20250514',
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
  subjectOverrides: {},
  fallback: {
    enabled: true,
    provider: 'openai',
    retryCount: 2,
  },
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'system',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPutItem.mockResolvedValue({});
  mockUpdateItem.mockResolvedValue({});
});

// ─── getActiveConfig ──────────────────────────────────────────────────────────

describe('getActiveConfig', () => {

  it('returns the stored config when it exists in db', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    const config = await getActiveConfig();
    expect(config.id).toBe('active');
    expect(config.activeProvider).toBe('anthropic');
  });

  it('calls db.getItem with table "modelConfig" and key "active"', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    await getActiveConfig();
    expect(mockGetItem).toHaveBeenCalledWith('modelConfig', 'active');
  });

  it('installs default config when db returns null', async () => {
    mockGetItem.mockResolvedValue(null);
    const config = await getActiveConfig();
    expect(config).toBeDefined();
    expect(config.id).toBe('active');
  });

  it('calls putItem to persist default config when none exists', async () => {
    mockGetItem.mockResolvedValue(null);
    await getActiveConfig();
    expect(mockPutItem).toHaveBeenCalledWith('modelConfig', expect.objectContaining({ id: 'active' }));
  });

});

// ─── resolveProvider ─────────────────────────────────────────────────────────

describe('resolveProvider — default (no subject)', () => {

  it('returns the active provider name', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    const result = await resolveProvider();
    expect(result.provider).toBe('anthropic');
  });

  it('returns the correct model for the active provider', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    const result = await resolveProvider();
    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('returns apiKey string (empty when env var is not set)', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    const result = await resolveProvider();
    expect(typeof result.apiKey).toBe('string');
  });

});

describe('resolveProvider — subject overrides', () => {

  it('uses the subject override provider when a matching override exists', async () => {
    const configWithOverride = {
      ...BASE_CONFIG,
      providers: {
        ...BASE_CONFIG.providers,
        openai: { ...BASE_CONFIG.providers.openai, enabled: true },
      },
      subjectOverrides: { Math: 'openai' },
    };
    mockGetItem.mockResolvedValue(configWithOverride);
    const result = await resolveProvider('Math');
    expect(result.provider).toBe('openai');
  });

  it('falls back to active provider when no subject override matches', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    const result = await resolveProvider('Science');
    expect(result.provider).toBe('anthropic');
  });

});

describe('resolveProvider — disabled provider + fallback', () => {

  it('throws when provider is disabled and fallback is also disabled', async () => {
    const disabledConfig = {
      ...BASE_CONFIG,
      providers: {
        ...BASE_CONFIG.providers,
        anthropic: { ...BASE_CONFIG.providers.anthropic, enabled: false },
      },
      fallback: { enabled: false, provider: 'openai', retryCount: 2 },
    };
    mockGetItem.mockResolvedValue(disabledConfig);
    await expect(resolveProvider()).rejects.toThrow(/not enabled/i);
  });

  it('throws when provider is disabled and fallback provider is also disabled', async () => {
    const noFallbackConfig = {
      ...BASE_CONFIG,
      providers: {
        anthropic: { ...BASE_CONFIG.providers.anthropic, enabled: false },
        openai:    { ...BASE_CONFIG.providers.openai, enabled: false },
      },
      fallback: { enabled: true, provider: 'openai', retryCount: 2 },
    };
    mockGetItem.mockResolvedValue(noFallbackConfig);
    await expect(resolveProvider()).rejects.toThrow();
  });

  it('error message includes the provider name when it is not enabled', async () => {
    const disabledConfig = {
      ...BASE_CONFIG,
      providers: {
        ...BASE_CONFIG.providers,
        anthropic: { ...BASE_CONFIG.providers.anthropic, enabled: false },
      },
      fallback: { enabled: false },
    };
    mockGetItem.mockResolvedValue(disabledConfig);
    await expect(resolveProvider()).rejects.toThrow(/anthropic/i);
  });

});

// ─── updateConfig ─────────────────────────────────────────────────────────────

describe('updateConfig', () => {

  it('merges updates into the current config', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    mockPutItem.mockResolvedValue({});
    const result = await updateConfig({ activeProvider: 'openai' }, 'admin-user');
    expect(result.activeProvider).toBe('openai');
  });

  it('sets updatedBy to the provided user', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    mockPutItem.mockResolvedValue({});
    const result = await updateConfig({}, 'teacher-42');
    expect(result.updatedBy).toBe('teacher-42');
  });

  it('writes two putItem calls — one for config, one for audit log', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    mockPutItem.mockResolvedValue({});
    await updateConfig({}, 'admin-user');
    expect(mockPutItem).toHaveBeenCalledTimes(2);
  });

  it('writes audit log entry to modelAuditLog table', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    mockPutItem.mockResolvedValue({});
    await updateConfig({}, 'admin-user', 'test note');
    const auditCall = mockPutItem.mock.calls.find(([table]) => table === 'modelAuditLog');
    expect(auditCall).toBeDefined();
    expect(auditCall[1].action).toBe('CONFIG_UPDATE');
    expect(auditCall[1].note).toBe('test note');
  });

  it('preserves unmodified config fields after update', async () => {
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    mockPutItem.mockResolvedValue({});
    const result = await updateConfig({ activeProvider: 'openai' }, 'admin');
    expect(result.version).toBe('v1');
    expect(result.providers).toBeDefined();
  });

});

// ─── getAuditLog ─────────────────────────────────────────────────────────────

describe('getAuditLog', () => {

  it('returns entries sorted newest-first', async () => {
    const entries = [
      { id: '1', changedAt: '2026-01-01T00:00:00Z', action: 'CONFIG_UPDATE' },
      { id: '2', changedAt: '2026-03-01T00:00:00Z', action: 'CONFIG_UPDATE' },
      { id: '3', changedAt: '2026-02-01T00:00:00Z', action: 'CONFIG_UPDATE' },
    ];
    mockListAll.mockResolvedValue(entries);
    const result = await getAuditLog();
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('3');
    expect(result[2].id).toBe('1');
  });

  it('returns at most the limit number of entries', async () => {
    const entries = Array.from({ length: 60 }, (_, i) => ({
      id: String(i),
      changedAt: new Date(i * 1000).toISOString(),
    }));
    mockListAll.mockResolvedValue(entries);
    const result = await getAuditLog(5);
    expect(result).toHaveLength(5);
  });

  it('returns empty array when there are no log entries', async () => {
    mockListAll.mockResolvedValue([]);
    const result = await getAuditLog();
    expect(result).toEqual([]);
  });

});

// ─── rollbackConfig ───────────────────────────────────────────────────────────

describe('rollbackConfig', () => {

  it('throws when audit log has no entries', async () => {
    mockListAll.mockResolvedValue([]);
    // getActiveConfig is called inside updateConfig which is called inside rollbackConfig
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    await expect(rollbackConfig('admin')).rejects.toThrow(/no previous config/i);
  });

  it('throws when the most recent audit entry has no previousConfig', async () => {
    mockListAll.mockResolvedValue([{ id: '1', changedAt: '2026-01-01T00:00:00Z' }]);
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    await expect(rollbackConfig('admin')).rejects.toThrow(/not available/i);
  });

  it('calls updateConfig with the previousConfig from the most recent log entry', async () => {
    const previousConfig = { ...BASE_CONFIG, activeProvider: 'openai' };
    mockListAll.mockResolvedValue([
      {
        id: '1',
        changedAt: '2026-03-01T00:00:00Z',
        previousConfig,
        newConfig: BASE_CONFIG,
      },
    ]);
    mockGetItem.mockResolvedValue(BASE_CONFIG);
    mockPutItem.mockResolvedValue({});
    const result = await rollbackConfig('admin-rollback');
    // The returned config should reflect the previousConfig's activeProvider
    expect(result.activeProvider).toBe('openai');
  });

});

// ─── sanitizeConfig ───────────────────────────────────────────────────────────

describe('sanitizeConfig', () => {

  it('replaces apiKeyEnvVar with "[hidden]" for every provider', () => {
    const result = sanitizeConfig(BASE_CONFIG);
    expect(result.providers.anthropic.apiKeyEnvVar).toBe('[hidden]');
    expect(result.providers.openai.apiKeyEnvVar).toBe('[hidden]');
  });

  it('does not mutate the original config object', () => {
    sanitizeConfig(BASE_CONFIG);
    expect(BASE_CONFIG.providers.anthropic.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
  });

  it('returns config unchanged when providers field is absent', () => {
    const noProviders = { id: 'active', activeProvider: 'anthropic' };
    const result = sanitizeConfig(noProviders);
    expect(result).toEqual(noProviders);
  });

  it('returns the input unchanged when called with null', () => {
    const result = sanitizeConfig(null);
    expect(result).toBeNull();
  });

  it('returns the input unchanged when called with undefined', () => {
    const result = sanitizeConfig(undefined);
    expect(result).toBeUndefined();
  });

  it('preserves other provider fields while hiding apiKeyEnvVar', () => {
    const result = sanitizeConfig(BASE_CONFIG);
    expect(result.providers.anthropic.model).toBe('claude-sonnet-4-20250514');
    expect(result.providers.anthropic.enabled).toBe(true);
    expect(result.providers.anthropic.maxTokens).toBe(8000);
  });

});
