/**
 * @file tests/unit/questionBankDynamoAdapter.test.js
 * @description Unit tests for src/questionBank/dynamoAdapter.js
 * Uses aws-sdk-client-mock to avoid real DynamoDB calls.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  PutCommand, GetCommand, UpdateCommand,
  QueryCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  addQuestion,
  addIfNotExists,
  getQuestion,
  listQuestions,
  questionExists,
  incrementReuseCount,
} from '../../src/questionBank/dynamoAdapter.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  process.env.DYNAMO_ENV = 'test';
  delete process.env.QB_TABLE_NAME;
});

const SAMPLE_Q = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  type: 'multiple-choice',
  difficulty: 'Medium',
  question: 'What is 6 × 7?',
  options: ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
  answer: 'B',
  explanation: '6 × 7 = 42',
  points: 1,
};

// ─── addQuestion ─────────────────────────────────────────────────────────────

describe('addQuestion', () => {
  it('stores the question and returns it with questionId and createdAt', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await addQuestion(SAMPLE_Q);
    expect(result.questionId).toBeTruthy();
    expect(result.createdAt).toBeTruthy();
    expect(result.subject).toBe('Math');
  });

  it('calls PutCommand with the correct table name', async () => {
    ddbMock.on(PutCommand).resolves({});
    await addQuestion(SAMPLE_Q);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input.TableName).toBe('LearnfyraQuestionBank-test');
  });

  it('adds lookupKey, typeDifficulty, and dedupeHash fields', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await addQuestion(SAMPLE_Q);
    expect(result.lookupKey).toBe('3|math|multiplication');
    expect(result.typeDifficulty).toBe('multiple-choice|medium');
    expect(result.dedupeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('uses provided questionId if already set', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await addQuestion({ ...SAMPLE_Q, questionId: 'preset-id' });
    expect(result.questionId).toBe('preset-id');
  });

  it('uses QB_TABLE_NAME env var override', async () => {
    process.env.QB_TABLE_NAME = 'CustomQBTable';
    ddbMock.on(PutCommand).resolves({});
    await addQuestion(SAMPLE_Q);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input.TableName).toBe('CustomQBTable');
    delete process.env.QB_TABLE_NAME;
  });
});

// ─── getQuestion ─────────────────────────────────────────────────────────────

describe('getQuestion', () => {
  it('returns the item when found', async () => {
    const item = { ...SAMPLE_Q, questionId: 'q1' };
    ddbMock.on(GetCommand).resolves({ Item: item });
    const result = await getQuestion('q1');
    expect(result).toEqual(item);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ questionId: 'q1' });
  });

  it('returns null when not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await getQuestion('no-such');
    expect(result).toBeNull();
  });
});

// ─── questionExists ───────────────────────────────────────────────────────────

describe('questionExists', () => {
  it('returns true when dedupeHash GSI Count > 0', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 1 });
    const result = await questionExists(SAMPLE_Q);
    expect(result).toBe(true);
  });

  it('returns false when dedupeHash GSI Count === 0', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 0 });
    const result = await questionExists(SAMPLE_Q);
    expect(result).toBe(false);
  });

  it('queries the dedupeHash-index GSI', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 0 });
    await questionExists(SAMPLE_Q);
    const call = ddbMock.commandCalls(QueryCommand)[0];
    expect(call.args[0].input.IndexName).toBe('dedupeHash-index');
  });
});

// ─── addIfNotExists ───────────────────────────────────────────────────────────

describe('addIfNotExists', () => {
  it('inserts and returns stored=question, duplicate=false when new', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 0 }); // questionExists → false
    ddbMock.on(PutCommand).resolves({});
    const { stored, duplicate } = await addIfNotExists(SAMPLE_Q, SAMPLE_Q);
    expect(duplicate).toBe(false);
    expect(stored).toBeTruthy();
    expect(stored.questionId).toBeTruthy();
  });

  it('returns stored=null, duplicate=true when already exists', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 1 }); // questionExists → true
    const { stored, duplicate } = await addIfNotExists(SAMPLE_Q, SAMPLE_Q);
    expect(duplicate).toBe(true);
    expect(stored).toBeNull();
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});

// ─── listQuestions ────────────────────────────────────────────────────────────

describe('listQuestions', () => {
  it('uses GSI-1 query when grade+subject+topic are all provided', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [SAMPLE_Q] });
    const result = await listQuestions({ grade: 3, subject: 'Math', topic: 'Multiplication' });
    expect(result).toHaveLength(1);
    const call = ddbMock.commandCalls(QueryCommand)[0];
    expect(call.args[0].input.IndexName).toBe('GSI-1');
    expect(call.args[0].input.ExpressionAttributeValues[':lk']).toBe('3|math|multiplication');
  });

  it('refines GSI-1 query with type+difficulty when provided', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [SAMPLE_Q] });
    await listQuestions({ grade: 3, subject: 'Math', topic: 'Multiplication', type: 'multiple-choice', difficulty: 'Medium' });
    const call = ddbMock.commandCalls(QueryCommand)[0];
    expect(call.args[0].input.ExpressionAttributeValues[':td']).toBe('multiple-choice|medium');
  });

  it('falls back to Scan when only subject is provided', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [SAMPLE_Q] });
    const result = await listQuestions({ subject: 'Math' });
    expect(result).toHaveLength(1);
    expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(1);
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
  });

  it('Scan filter preserves original casing for subject (not lowercased)', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [SAMPLE_Q] });
    await listQuestions({ subject: 'Math' });
    const call = ddbMock.commandCalls(ScanCommand)[0];
    // subject is stored with original casing; filter must match exactly
    expect(call.args[0].input.ExpressionAttributeValues[':subject']).toBe('Math');
  });

  it('Scan filter uses grade+subject together for grade+subject-only queries', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [SAMPLE_Q] });
    await listQuestions({ grade: 5, subject: 'Math' });
    const call = ddbMock.commandCalls(ScanCommand)[0];
    expect(call.args[0].input.ExpressionAttributeValues[':grade']).toBe(5);
    expect(call.args[0].input.ExpressionAttributeValues[':subject']).toBe('Math');
  });

  it('returns empty array when no filters provided', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    const result = await listQuestions({});
    expect(result).toEqual([]);
  });

  it('paginates across multiple pages in Scan mode', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [{ questionId: 'a' }], LastEvaluatedKey: { questionId: 'a' } })
      .resolvesOnce({ Items: [{ questionId: 'b' }] });
    const result = await listQuestions({ subject: 'Math' });
    expect(result).toHaveLength(2);
  });
});

// ─── incrementReuseCount ──────────────────────────────────────────────────────

describe('incrementReuseCount', () => {
  it('calls UpdateCommand with ADD expression and returns updated item', async () => {
    const updated = { ...SAMPLE_Q, questionId: 'q1', reuseCount: 3 };
    ddbMock.on(UpdateCommand).resolves({ Attributes: updated });
    const result = await incrementReuseCount('q1');
    expect(result).toEqual(updated);
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call.args[0].input.Key).toEqual({ questionId: 'q1' });
    expect(call.args[0].input.UpdateExpression).toContain('ADD');
  });

  it('returns null when item does not exist', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: undefined });
    const result = await incrementReuseCount('no-such');
    expect(result).toBeNull();
  });
});
