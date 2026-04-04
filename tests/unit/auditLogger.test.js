/**
 * @file tests/unit/auditLogger.test.js
 * @description Unit tests for src/admin/auditLogger.js.
 *   DynamoDB is mocked with aws-sdk-client-mock — no real AWS calls occur.
 * @agent QA
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// ─── AWS SDK mock ─────────────────────────────────────────────────────────────

const dynamoMock = mockClient(DynamoDBDocumentClient);

// ─── Dynamic import (must come after mock setup) ──────────────────────────────

const { writeAuditLog, extractIp, extractUserAgent } =
  await import('../../src/admin/auditLogger.js');

// ─── Shared fixture params ────────────────────────────────────────────────────

const BASE_PARAMS = {
  actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  actorRole: 'super_admin',
  action: 'USER_SUSPENDED',
  targetEntityType: 'Users',
  targetEntityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  beforeState: { status: 'active' },
  afterState: { status: 'suspended' },
  ipAddress: '203.0.113.42',
  userAgent: 'Mozilla/5.0',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  dynamoMock.reset();
});

// ─── writeAuditLog ────────────────────────────────────────────────────────────

describe('writeAuditLog', () => {
  it('calls PutCommand with PK=AUDIT#<uuid> and SK=METADATA', async () => {
    dynamoMock.on(PutCommand).resolves({});

    await writeAuditLog(BASE_PARAMS);

    const calls = dynamoMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);

    const input = calls[0].args[0].input;
    expect(input.Item.PK).toMatch(/^AUDIT#[0-9a-f-]{36}$/);
    expect(input.Item.SK).toBe('METADATA');
  });

  it('returns a UUID string (auditId) on success', async () => {
    dynamoMock.on(PutCommand).resolves({});

    const auditId = await writeAuditLog(BASE_PARAMS);

    expect(typeof auditId).toBe('string');
    // UUID v4 pattern
    expect(auditId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns null on DynamoDB failure without throwing', async () => {
    dynamoMock.on(PutCommand).rejects(new Error('DynamoDB unavailable'));

    const auditId = await writeAuditLog(BASE_PARAMS);

    expect(auditId).toBeNull();
  });

  it('includes all required fields in the DynamoDB item', async () => {
    dynamoMock.on(PutCommand).resolves({});

    await writeAuditLog(BASE_PARAMS);

    const item = dynamoMock.commandCalls(PutCommand)[0].args[0].input.Item;

    expect(item).toMatchObject({
      SK: 'METADATA',
      actorId: BASE_PARAMS.actorId,
      actorRole: BASE_PARAMS.actorRole,
      action: BASE_PARAMS.action,
      targetEntityType: BASE_PARAMS.targetEntityType,
      targetEntityId: BASE_PARAMS.targetEntityId,
      ipAddress: BASE_PARAMS.ipAddress,
      userAgent: BASE_PARAMS.userAgent,
    });

    // auditId must be present and match the PK
    expect(typeof item.auditId).toBe('string');
    expect(item.PK).toBe(`AUDIT#${item.auditId}`);

    // timestamp must be an ISO-8601 string
    expect(typeof item.timestamp).toBe('string');
    expect(() => new Date(item.timestamp).toISOString()).not.toThrow();
  });

  it('serialises beforeState and afterState as JSON strings', async () => {
    dynamoMock.on(PutCommand).resolves({});

    await writeAuditLog(BASE_PARAMS);

    const item = dynamoMock.commandCalls(PutCommand)[0].args[0].input.Item;

    expect(item.beforeState).toBe(JSON.stringify(BASE_PARAMS.beforeState));
    expect(item.afterState).toBe(JSON.stringify(BASE_PARAMS.afterState));
  });

  it('stores null for beforeState and afterState when not provided', async () => {
    dynamoMock.on(PutCommand).resolves({});

    await writeAuditLog({
      ...BASE_PARAMS,
      beforeState: undefined,
      afterState: undefined,
    });

    const item = dynamoMock.commandCalls(PutCommand)[0].args[0].input.Item;

    expect(item.beforeState).toBeNull();
    expect(item.afterState).toBeNull();
  });

  it('uses AUDIT_LOG_TABLE_NAME env var when set', async () => {
    dynamoMock.on(PutCommand).resolves({});
    process.env.AUDIT_LOG_TABLE_NAME = 'CustomAuditTable';

    await writeAuditLog(BASE_PARAMS);

    const input = dynamoMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input.TableName).toBe('CustomAuditTable');

    delete process.env.AUDIT_LOG_TABLE_NAME;
  });
});

// ─── extractIp ────────────────────────────────────────────────────────────────

describe('extractIp', () => {
  it('extracts IP from requestContext.identity.sourceIp', () => {
    const event = {
      requestContext: { identity: { sourceIp: '10.0.0.1' } },
    };
    expect(extractIp(event)).toBe('10.0.0.1');
  });

  it('extracts first IP from X-Forwarded-For header when requestContext is absent', () => {
    const event = {
      headers: { 'X-Forwarded-For': '203.0.113.5, 70.41.3.18, 150.172.238.178' },
    };
    expect(extractIp(event)).toBe('203.0.113.5');
  });

  it('prefers requestContext.identity.sourceIp over X-Forwarded-For', () => {
    const event = {
      requestContext: { identity: { sourceIp: '1.2.3.4' } },
      headers: { 'X-Forwarded-For': '9.9.9.9' },
    };
    expect(extractIp(event)).toBe('1.2.3.4');
  });

  it('returns "unknown" when neither source is present', () => {
    expect(extractIp({})).toBe('unknown');
    expect(extractIp(null)).toBe('unknown');
    expect(extractIp(undefined)).toBe('unknown');
  });
});

// ─── extractUserAgent ─────────────────────────────────────────────────────────

describe('extractUserAgent', () => {
  it('extracts User-Agent from headers (standard casing)', () => {
    const event = { headers: { 'User-Agent': 'TestBrowser/1.0' } };
    expect(extractUserAgent(event)).toBe('TestBrowser/1.0');
  });

  it('extracts user-agent from headers (lowercase casing)', () => {
    const event = { headers: { 'user-agent': 'curl/7.88' } };
    expect(extractUserAgent(event)).toBe('curl/7.88');
  });

  it('returns "unknown" when User-Agent header is missing', () => {
    expect(extractUserAgent({ headers: {} })).toBe('unknown');
    expect(extractUserAgent({})).toBe('unknown');
  });
});
