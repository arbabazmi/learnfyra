/**
 * @file tests/unit/alertService.test.js
 * @description Unit tests for src/notifications/alertService.js
 *   Covers sendFallbackAlert() (fire-and-forget) and _publishAlert() (awaitable).
 *   All AWS SDK calls and configAdapter are mocked.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// ─── AWS SDK mock ─────────────────────────────────────────────────────────────

const snsMock = mockClient(SNSClient);

// ─── Module mock: configAdapter ───────────────────────────────────────────────

const mockGetConfig = jest.fn();

jest.unstable_mockModule('../../src/config/configAdapter.js', () => ({
  getConfig: mockGetConfig,
  clearConfigCache: jest.fn(),
}));

// ─── Dynamic imports (after mocks) ───────────────────────────────────────────

const { sendFallbackAlert, _publishAlert } = await import('../../src/notifications/alertService.js');

// ─── Shared test context ──────────────────────────────────────────────────────

const baseContext = {
  worksheetId: 'test-uuid-1234',
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  difficulty: 'Medium',
  fallbackMode: 'none',
  aiError: 'Claude returned empty response.',
  requestId: 'req-abc-123',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  snsMock.reset();
  jest.clearAllMocks();

  // Default: alerts enabled + ARN configured
  mockGetConfig
    .mockResolvedValueOnce('true')                              // admin-fallback-alerts-enabled
    .mockResolvedValueOnce('arn:aws:sns:us-east-1:123:test'); // admin-fallback-sns-topic-arn
});

// ─── Disabled alert path ──────────────────────────────────────────────────────

describe('_publishAlert — alerts disabled', () => {

  it('skips SNS publish when alerts are disabled via config', async () => {
    mockGetConfig.mockReset();
    mockGetConfig.mockResolvedValueOnce('false'); // alerts-enabled = false

    await _publishAlert(baseContext);

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  it('skips SNS publish when alerts-enabled returns null', async () => {
    mockGetConfig.mockReset();
    mockGetConfig.mockResolvedValueOnce(null); // alerts-enabled = null

    await _publishAlert(baseContext);

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  it('skips SNS publish when alerts-enabled returns undefined', async () => {
    mockGetConfig.mockReset();
    mockGetConfig.mockResolvedValueOnce(undefined);

    await _publishAlert(baseContext);

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

});

// ─── Missing SNS topic ARN ────────────────────────────────────────────────────

describe('_publishAlert — no SNS topic ARN configured', () => {

  it('skips publish when no SNS topic ARN is returned from config', async () => {
    mockGetConfig.mockReset();
    mockGetConfig
      .mockResolvedValueOnce('true') // alerts enabled
      .mockResolvedValueOnce(null);  // no topic ARN

    await _publishAlert(baseContext);

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  it('skips publish when topic ARN is an empty string', async () => {
    mockGetConfig.mockReset();
    mockGetConfig
      .mockResolvedValueOnce('true')
      .mockResolvedValueOnce('');

    await _publishAlert(baseContext);

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

});

// ─── Happy path: SNS publish ──────────────────────────────────────────────────

describe('_publishAlert — successful publish', () => {

  beforeEach(() => {
    snsMock.on(PublishCommand).resolves({ MessageId: 'sns-msg-001' });
  });

  it('publishes a message to SNS with the correct TopicArn', async () => {
    await _publishAlert(baseContext);

    const calls = snsMock.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.TopicArn).toBe('arn:aws:sns:us-east-1:123:test');
  });

  it('publishes with the correct Subject containing subject and topic', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.Subject).toContain('Math');
    expect(call.args[0].input.Subject).toContain('Multiplication');
  });

  it('message body contains the grade', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.Message).toContain('3');
  });

  it('message body contains the subject', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.Message).toContain('Math');
  });

  it('message body contains the topic', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.Message).toContain('Multiplication');
  });

  it('message body contains the difficulty', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.Message).toContain('Medium');
  });

  it('message body contains a timestamp', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    // ISO-8601 pattern
    expect(call.args[0].input.Message).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('publishes MessageAttributes with fallbackMode', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.MessageAttributes.fallbackMode).toMatchObject({
      DataType: 'String',
      StringValue: 'none',
    });
  });

  it('publishes MessageAttributes with grade as a Number type', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.MessageAttributes.grade).toMatchObject({
      DataType: 'Number',
      StringValue: '3',
    });
  });

  it('publishes MessageAttributes with subject', async () => {
    await _publishAlert(baseContext);

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.MessageAttributes.subject).toMatchObject({
      DataType: 'String',
      StringValue: 'Math',
    });
  });

  it('includes partial fallback label in message for fallbackMode=partial', async () => {
    snsMock.on(PublishCommand).resolves({});
    await _publishAlert({ ...baseContext, fallbackMode: 'partial' });

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.Message).toContain('PARTIAL');
  });

  it('includes total fallback label in message for fallbackMode=none', async () => {
    await _publishAlert(baseContext); // fallbackMode: 'none'

    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.Message).toContain('TOTAL');
  });

});

// ─── Error swallowing ─────────────────────────────────────────────────────────

describe('_publishAlert — never throws', () => {

  it('does not throw when SNS publish fails', async () => {
    snsMock.on(PublishCommand).rejects(new Error('SNS unavailable'));

    await expect(_publishAlert(baseContext)).resolves.not.toThrow();
  });

  it('does not throw when getConfig throws on enabled check', async () => {
    mockGetConfig.mockReset();
    mockGetConfig.mockRejectedValue(new Error('DynamoDB is down'));

    await expect(_publishAlert(baseContext)).resolves.not.toThrow();
  });

  it('does not throw when getConfig throws on topic ARN fetch', async () => {
    mockGetConfig.mockReset();
    mockGetConfig
      .mockResolvedValueOnce('true')
      .mockRejectedValueOnce(new Error('DynamoDB timeout'));

    await expect(_publishAlert(baseContext)).resolves.not.toThrow();
  });

});

// ─── sendFallbackAlert (fire-and-forget wrapper) ──────────────────────────────

describe('sendFallbackAlert — fire-and-forget', () => {

  it('returns void synchronously (does not return a promise to await)', () => {
    snsMock.on(PublishCommand).resolves({});

    const result = sendFallbackAlert(baseContext);
    // Fire-and-forget should return undefined, not a Promise
    expect(result).toBeUndefined();
  });

  it('does not throw synchronously even if the underlying publish would fail', () => {
    snsMock.on(PublishCommand).rejects(new Error('SNS down'));

    expect(() => sendFallbackAlert(baseContext)).not.toThrow();
  });

});
