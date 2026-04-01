/**
 * @file tests/unit/dynamoDbAdapter.test.js
 * @description Unit tests for src/db/dynamoDbAdapter.js
 * Uses aws-sdk-client-mock to avoid real DynamoDB calls.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  PutCommand, GetCommand, DeleteCommand, UpdateCommand,
  QueryCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamoDbAdapter } from '../../src/db/dynamoDbAdapter.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  process.env.DYNAMO_ENV = 'test';
  delete process.env.CERTIFICATES_TABLE_NAME;
  delete process.env.USERS_TABLE_NAME;
});

// ─── putItem ─────────────────────────────────────────────────────────────────

describe('putItem', () => {
  it('calls PutCommand with the resolved table name and item', async () => {
    ddbMock.on(PutCommand).resolves({});
    const item = { certificateId: 'cert-1', score: 95 };
    const result = await dynamoDbAdapter.putItem('certificates', item);
    expect(result).toEqual(item);
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Item).toEqual(item);
  });

  it('uses env var override when table name env var is set', async () => {
    process.env.CERTIFICATES_TABLE_NAME = 'CustomCertTable';
    ddbMock.on(PutCommand).resolves({});
    await dynamoDbAdapter.putItem('certificates', { certificateId: 'x' });
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls[0].args[0].input.TableName).toBe('CustomCertTable');
    delete process.env.CERTIFICATES_TABLE_NAME;
  });

  it('resolves table name from DYNAMO_ENV suffix', async () => {
    process.env.DYNAMO_ENV = 'staging';
    ddbMock.on(PutCommand).resolves({});
    await dynamoDbAdapter.putItem('certificates', { certificateId: 'x' });
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls[0].args[0].input.TableName).toBe('LearnfyraCertificates-staging');
    process.env.DYNAMO_ENV = 'test';
  });
});

// ─── getItem — single key ────────────────────────────────────────────────────

describe('getItem — single key table', () => {
  it('returns the item when found', async () => {
    const item = { id: 'cert-1', score: 95 };
    ddbMock.on(GetCommand).resolves({ Item: item });
    const result = await dynamoDbAdapter.getItem('certificates', 'cert-1');
    expect(result).toEqual(item);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ id: 'cert-1' });
  });

  it('returns null when item is not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await dynamoDbAdapter.getItem('certificates', 'no-such');
    expect(result).toBeNull();
  });
});

// ─── getItem — attempts table (formerly composite key) ───────────────────────

describe('getItem — attempts table', () => {
  it('returns the item when found by attemptId', async () => {
    const item = { attemptId: 'a1', score: 80 };
    ddbMock.on(GetCommand).resolves({ Item: item });
    const result = await dynamoDbAdapter.getItem('worksheetattempts', 'a1');
    expect(result).toEqual(item);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ attemptId: 'a1' });
  });

  it('returns null when no item found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await dynamoDbAdapter.getItem('worksheetattempts', 'no-such');
    expect(result).toBeNull();
  });
});

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe('deleteItem — single key table', () => {
  it('returns true and calls DeleteCommand when item exists', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: 'c1' } });
    ddbMock.on(DeleteCommand).resolves({});
    const result = await dynamoDbAdapter.deleteItem('certificates', 'c1');
    expect(result).toBe(true);
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1);
  });

  it('returns false when item does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await dynamoDbAdapter.deleteItem('certificates', 'no-such');
    expect(result).toBe(false);
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(0);
  });
});

// ─── listAll ─────────────────────────────────────────────────────────────────

describe('listAll', () => {
  it('returns all items from a single-page scan', async () => {
    const items = [{ certificateId: 'a' }, { certificateId: 'b' }];
    ddbMock.on(ScanCommand).resolves({ Items: items });
    const result = await dynamoDbAdapter.listAll('certificates');
    expect(result).toEqual(items);
  });

  it('paginates across multiple pages', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [{ certificateId: 'a' }], LastEvaluatedKey: { certificateId: 'a' } })
      .resolvesOnce({ Items: [{ certificateId: 'b' }] });
    const result = await dynamoDbAdapter.listAll('certificates');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when table is empty', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    const result = await dynamoDbAdapter.listAll('certificates');
    expect(result).toEqual([]);
  });
});

// ─── queryByField ─────────────────────────────────────────────────────────────

describe('queryByField', () => {
  it('uses FilterExpression with the field and value', async () => {
    const items = [{ userId: 'u1', certificateId: 'c1' }];
    ddbMock.on(ScanCommand).resolves({ Items: items });
    const result = await dynamoDbAdapter.queryByField('certificates', 'userId', 'u1');
    expect(result).toEqual(items);
    const call = ddbMock.commandCalls(ScanCommand)[0];
    expect(call.args[0].input.ExpressionAttributeValues[':val']).toBe('u1');
  });

  it('paginates when LastEvaluatedKey is returned', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [{ certificateId: 'a' }], LastEvaluatedKey: { certificateId: 'a' } })
      .resolvesOnce({ Items: [{ certificateId: 'b' }] });
    const result = await dynamoDbAdapter.queryByField('certificates', 'userId', 'u1');
    expect(result).toHaveLength(2);
  });
});

// ─── updateItem ───────────────────────────────────────────────────────────────

describe('updateItem — single key table', () => {
  it('calls UpdateCommand and returns updated attributes', async () => {
    const updated = { id: 'c1', score: 99 };
    ddbMock.on(UpdateCommand).resolves({ Attributes: updated });
    const result = await dynamoDbAdapter.updateItem('certificates', 'c1', { score: 99 });
    expect(result).toEqual(updated);
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call.args[0].input.Key).toEqual({ id: 'c1' });
    expect(call.args[0].input.UpdateExpression).toContain('SET');
  });

  it('returns null when Attributes is not returned', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: undefined });
    const result = await dynamoDbAdapter.updateItem('certificates', 'c1', { score: 0 });
    expect(result).toBeNull();
  });
});

// ─── queryByPk ────────────────────────────────────────────────────────────────

describe('queryByPk', () => {
  it('queries by PK and returns all items', async () => {
    const items = [{ attemptId: 'a1', score: 80 }];
    ddbMock.on(QueryCommand).resolves({ Items: items });
    const result = await dynamoDbAdapter.queryByPk('worksheetattempts', 'a1');
    expect(result).toEqual(items);
    const call = ddbMock.commandCalls(QueryCommand)[0];
    expect(call.args[0].input.ExpressionAttributeValues[':pkval']).toBe('a1');
  });

  it('passes IndexName option to QueryCommand', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await dynamoDbAdapter.queryByPk('worksheetattempts', 'a1', { indexName: 'studentId-index' });
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input.IndexName).toBe('studentId-index');
  });

  it('paginates across multiple pages', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ attemptId: 'a1' }], LastEvaluatedKey: { attemptId: 'a1' } })
      .resolvesOnce({ Items: [{ attemptId: 'a2' }] });
    const result = await dynamoDbAdapter.queryByPk('worksheetattempts', 'a1');
    expect(result).toHaveLength(2);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('resolveTable error', () => {
  it('throws for unknown logical table names', async () => {
    await expect(dynamoDbAdapter.listAll('nonexistent_table'))
      .rejects.toThrow(/Unknown logical table/);
  });
});
