/**
 * @file tests/unit/dbIndex.test.js
 * @description Unit tests for src/db/index.js
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';

const mockLocalAdapter = {
  putItem: jest.fn(), getItem: jest.fn(), deleteItem: jest.fn(),
  queryByField: jest.fn(), listAll: jest.fn(), updateItem: jest.fn(),
};
const mockDynamoAdapter = {
  putItem: jest.fn(), getItem: jest.fn(), deleteItem: jest.fn(),
  queryByField: jest.fn(), listAll: jest.fn(), updateItem: jest.fn(),
  queryByPk: jest.fn(),
};

jest.unstable_mockModule('../../src/db/localDbAdapter.js', () => ({ localDbAdapter: mockLocalAdapter }));
jest.unstable_mockModule('../../src/db/dynamoDbAdapter.js', () => ({ dynamoDbAdapter: mockDynamoAdapter }));

const { getDbAdapter } = await import('../../src/db/index.js');

const originalRuntime = process.env.APP_RUNTIME;
afterEach(() => {
  if (originalRuntime === undefined) { delete process.env.APP_RUNTIME; }
  else { process.env.APP_RUNTIME = originalRuntime; }
});

describe('getDbAdapter — local mode', () => {
  it('returns local adapter when APP_RUNTIME is not set', () => {
    delete process.env.APP_RUNTIME;
    expect(getDbAdapter()).toBe(mockLocalAdapter);
  });
  it('returns local adapter when APP_RUNTIME=local', () => {
    process.env.APP_RUNTIME = 'local';
    expect(getDbAdapter()).toBe(mockLocalAdapter);
  });
  it('returned local adapter has all required methods', () => {
    delete process.env.APP_RUNTIME;
    const adapter = getDbAdapter();
    for (const m of ['putItem','getItem','deleteItem','queryByField','listAll','updateItem']) {
      expect(typeof adapter[m]).toBe('function');
    }
  });
});

describe('getDbAdapter — dynamodb / aws mode', () => {
  it('returns DynamoDB adapter when APP_RUNTIME=dynamodb', () => {
    process.env.APP_RUNTIME = 'dynamodb';
    expect(getDbAdapter()).toBe(mockDynamoAdapter);
  });
  it('returns DynamoDB adapter when APP_RUNTIME=aws', () => {
    process.env.APP_RUNTIME = 'aws';
    expect(getDbAdapter()).toBe(mockDynamoAdapter);
  });
  it('DynamoDB adapter has all required interface methods', () => {
    process.env.APP_RUNTIME = 'dynamodb';
    const adapter = getDbAdapter();
    for (const m of ['putItem','getItem','deleteItem','queryByField','listAll','updateItem']) {
      expect(typeof adapter[m]).toBe('function');
    }
  });
  it('DynamoDB adapter exposes queryByPk helper', () => {
    process.env.APP_RUNTIME = 'dynamodb';
    expect(typeof getDbAdapter().queryByPk).toBe('function');
  });
});
