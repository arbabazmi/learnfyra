/**
 * @file tests/unit/dbIndex.test.js
 * @description Unit tests for src/db/index.js
 * Verifies that getDbAdapter() returns the correct adapter based on APP_RUNTIME.
 * @agent QA
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';

// ─── Mock the localDbAdapter module BEFORE any dynamic import ─────────────────

const mockLocalAdapter = {
  putItem: jest.fn(),
  getItem: jest.fn(),
  deleteItem: jest.fn(),
  queryByField: jest.fn(),
  listAll: jest.fn(),
  updateItem: jest.fn(),
};

jest.unstable_mockModule('../../src/db/localDbAdapter.js', () => ({
  localDbAdapter: mockLocalAdapter,
}));

// ─── Dynamic import (must come after all mockModule calls) ────────────────────

const { getDbAdapter } = await import('../../src/db/index.js');

// ─── Test helpers ─────────────────────────────────────────────────────────────

const originalRuntime = process.env.APP_RUNTIME;

afterEach(() => {
  if (originalRuntime === undefined) {
    delete process.env.APP_RUNTIME;
  } else {
    process.env.APP_RUNTIME = originalRuntime;
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getDbAdapter — default / local mode', () => {

  it('returns the local adapter when APP_RUNTIME is not set', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    expect(adapter).toBe(mockLocalAdapter);
  });

  it('returns the local adapter when APP_RUNTIME=local', () => {
    process.env.APP_RUNTIME = 'local';
    const adapter = getDbAdapter();
    expect(adapter).toBe(mockLocalAdapter);
  });

  it('returned adapter has putItem method', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    expect(typeof adapter.putItem).toBe('function');
  });

  it('returned adapter has getItem method', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    expect(typeof adapter.getItem).toBe('function');
  });

  it('returned adapter has deleteItem method', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    expect(typeof adapter.deleteItem).toBe('function');
  });

  it('returned adapter has queryByField method', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    expect(typeof adapter.queryByField).toBe('function');
  });

  it('returned adapter has listAll method', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    expect(typeof adapter.listAll).toBe('function');
  });

  it('returned adapter has updateItem method', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    expect(typeof adapter.updateItem).toBe('function');
  });

});

describe('getDbAdapter — aws mode', () => {

  it('throws when APP_RUNTIME=aws', () => {
    process.env.APP_RUNTIME = 'aws';
    expect(() => getDbAdapter()).toThrow();
  });

  it('error message mentions "DynamoDB" when APP_RUNTIME=aws', () => {
    process.env.APP_RUNTIME = 'aws';
    expect(() => getDbAdapter()).toThrow(/dynamodb/i);
  });

  it('error message mentions "local" as the fallback when APP_RUNTIME=aws', () => {
    process.env.APP_RUNTIME = 'aws';
    expect(() => getDbAdapter()).toThrow(/local/i);
  });

});
