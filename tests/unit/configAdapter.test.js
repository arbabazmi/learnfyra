/**
 * @file tests/unit/configAdapter.test.js
 * @description Unit tests for src/config/configAdapter.js
 *   Covers getConfig() cache hits/misses, DynamoDB fallback to env var,
 *   null return when both sources are missing, TTL expiry, and clearConfigCache().
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// ─── AWS SDK mock ─────────────────────────────────────────────────────────────

const dynamoMock = mockClient(DynamoDBDocumentClient);

// ─── Dynamic import (after mock setup) ────────────────────────────────────────

const { getConfig, clearConfigCache } = await import('../../src/config/configAdapter.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resets all mocks and clears the module-level cache between tests. */
beforeEach(() => {
  dynamoMock.reset();
  clearConfigCache();
  // Remove any env var fallbacks left over from previous tests
  delete process.env.TEST_ENV_VAR;
  delete process.env.LEARNFYRA_CONFIG_TABLE;
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Cache miss → DynamoDB hit ────────────────────────────────────────────────

describe('getConfig — cache miss, DynamoDB hit', () => {

  it('returns the value from DynamoDB on a cold cache', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'my-key', value: 'my-value' },
    });

    const result = await getConfig('my-key');
    expect(result).toBe('my-value');
  });

  it('sends a GetCommand to the correct table', async () => {
    process.env.LEARNFYRA_CONFIG_TABLE = 'LearnfyraConfig-test';
    dynamoMock.on(GetCommand).resolves({ Item: { configKey: 'k', value: 'v' } });

    await getConfig('k');

    const calls = dynamoMock.commandCalls(GetCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.TableName).toBe('LearnfyraConfig-test');
    expect(calls[0].args[0].input.Key).toEqual({ configKey: 'k' });
  });

  it('returns null when DynamoDB Item is missing (key not in table)', async () => {
    dynamoMock.on(GetCommand).resolves({ Item: undefined });

    const result = await getConfig('missing-key');
    expect(result).toBeNull();
  });

  it('returns null when DynamoDB Item exists but has no value field', async () => {
    dynamoMock.on(GetCommand).resolves({ Item: { configKey: 'k' } });

    const result = await getConfig('k');
    expect(result).toBeNull();
  });

});

// ─── Cache hit ────────────────────────────────────────────────────────────────

describe('getConfig — cache hit', () => {

  it('returns cached value on second call without querying DynamoDB again', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'cached-key', value: 'cached-value' },
    });

    await getConfig('cached-key');          // first call — populates cache
    const result = await getConfig('cached-key'); // second call — should hit cache

    expect(result).toBe('cached-value');
    // DynamoDB must only have been called once
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
  });

  it('does not query DynamoDB when a null value is cached', async () => {
    dynamoMock.on(GetCommand).resolves({ Item: undefined });

    await getConfig('null-key');
    await getConfig('null-key'); // second call — should still be cached

    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
  });

});

// ─── Cache TTL expiry ─────────────────────────────────────────────────────────

describe('getConfig — cache TTL expiry', () => {

  it('re-queries DynamoDB after 5-minute cache TTL expires', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'ttl-key', value: 'first-value' },
    });

    // Freeze time
    const realDateNow = Date.now;
    let fakeNow = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    await getConfig('ttl-key'); // populates cache

    // Advance time past the 5-minute TTL (5 * 60 * 1000 ms)
    fakeNow += 5 * 60 * 1000 + 1;

    dynamoMock.reset();
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'ttl-key', value: 'refreshed-value' },
    });

    const result = await getConfig('ttl-key');
    expect(result).toBe('refreshed-value');
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);

    Date.now = realDateNow;
  });

  it('still returns cached value when TTL has NOT expired', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'ttl-key2', value: 'original-value' },
    });

    const realDateNow = Date.now;
    let fakeNow = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    await getConfig('ttl-key2'); // populates cache

    // Advance time to just under the TTL
    fakeNow += 5 * 60 * 1000 - 1;

    const result = await getConfig('ttl-key2');
    expect(result).toBe('original-value');
    // Still only one DynamoDB call
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);

    Date.now = realDateNow;
  });

});

// ─── DynamoDB failure → env var fallback ─────────────────────────────────────

describe('getConfig — DynamoDB failure fallback', () => {

  it('falls back to the env var when DynamoDB throws', async () => {
    dynamoMock.on(GetCommand).rejects(new Error('Connection refused'));
    process.env.TEST_ENV_VAR = 'env-fallback-value';

    const result = await getConfig('some-key', 'TEST_ENV_VAR');
    expect(result).toBe('env-fallback-value');
  });

  it('returns null when DynamoDB throws and no env var is set', async () => {
    dynamoMock.on(GetCommand).rejects(new Error('Timeout'));

    const result = await getConfig('some-key', 'TEST_ENV_VAR');
    expect(result).toBeNull();
  });

  it('returns null when DynamoDB throws and no fallback param is supplied', async () => {
    dynamoMock.on(GetCommand).rejects(new Error('Unavailable'));

    const result = await getConfig('some-key');
    expect(result).toBeNull();
  });

  it('does not throw even when DynamoDB fails', async () => {
    dynamoMock.on(GetCommand).rejects(new Error('Hard failure'));

    await expect(getConfig('some-key')).resolves.not.toThrow();
  });

});

// ─── clearConfigCache ─────────────────────────────────────────────────────────

describe('clearConfigCache', () => {

  it('clears the cache so the next call re-queries DynamoDB', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'clear-key', value: 'initial-value' },
    });

    await getConfig('clear-key'); // populates cache

    clearConfigCache(); // wipe it

    dynamoMock.reset();
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'clear-key', value: 'updated-value' },
    });

    const result = await getConfig('clear-key');
    expect(result).toBe('updated-value');
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
  });

  it('clears all keys, not just one', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { configKey: 'k', value: 'v' },
    });

    await getConfig('key-a');
    await getConfig('key-b');

    clearConfigCache();

    dynamoMock.reset();
    dynamoMock.on(GetCommand).resolves({ Item: { configKey: 'k', value: 'v2' } });

    await getConfig('key-a');
    await getConfig('key-b');

    // Both keys re-queried after cache clear
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(2);
  });

});
