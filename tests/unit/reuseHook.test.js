/**
 * @file tests/unit/reuseHook.test.js
 * @description Unit tests for src/questionBank/reuseHook.js
 *
 * The question bank adapter is mocked via jest.unstable_mockModule.
 * Tests verify that recordQuestionReuse() calls incrementReuseCount()
 * for valid IDs and silently no-ops for edge cases.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock incrementReuseCount ─────────────────────────────────────────────────

const mockIncrementReuseCount = jest.fn();

jest.unstable_mockModule('../../src/questionBank/index.js', () => ({
  getQuestionBankAdapter: jest.fn(async () => ({
    incrementReuseCount: mockIncrementReuseCount,
  })),
}));

// ─── Dynamic import — must follow all mockModule calls ────────────────────────

const { recordQuestionReuse } = await import('../../src/questionBank/reuseHook.js');

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── recordQuestionReuse — happy path ─────────────────────────────────────────

describe('recordQuestionReuse — happy path', () => {

  it('calls incrementReuseCount once for a single valid ID', async () => {
    await recordQuestionReuse(['abc-123']);
    expect(mockIncrementReuseCount).toHaveBeenCalledTimes(1);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('abc-123');
  });

  it('calls incrementReuseCount for each ID in a multi-ID array', async () => {
    await recordQuestionReuse(['id-1', 'id-2', 'id-3']);
    expect(mockIncrementReuseCount).toHaveBeenCalledTimes(3);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('id-1');
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('id-2');
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('id-3');
  });

  it('trims whitespace from IDs before calling incrementReuseCount', async () => {
    await recordQuestionReuse(['  padded-id  ']);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('padded-id');
  });

  it('resolves without error when incrementReuseCount returns null (unknown ID)', async () => {
    mockIncrementReuseCount.mockReturnValue(null);
    await expect(recordQuestionReuse(['unknown-id'])).resolves.toBeUndefined();
  });

});

// ─── recordQuestionReuse — no-op cases ───────────────────────────────────────

describe('recordQuestionReuse — silent no-ops', () => {

  it('does not call incrementReuseCount when array is empty', async () => {
    await recordQuestionReuse([]);
    expect(mockIncrementReuseCount).not.toHaveBeenCalled();
  });

  it('does not call incrementReuseCount when called with no arguments', async () => {
    await recordQuestionReuse();
    expect(mockIncrementReuseCount).not.toHaveBeenCalled();
  });

  it('does not call incrementReuseCount when argument is null', async () => {
    await recordQuestionReuse(null);
    expect(mockIncrementReuseCount).not.toHaveBeenCalled();
  });

  it('does not call incrementReuseCount when argument is undefined', async () => {
    await recordQuestionReuse(undefined);
    expect(mockIncrementReuseCount).not.toHaveBeenCalled();
  });

  it('does not call incrementReuseCount when argument is a string (not an array)', async () => {
    await recordQuestionReuse('abc-123');
    expect(mockIncrementReuseCount).not.toHaveBeenCalled();
  });

  it('skips non-string entries in a mixed array', async () => {
    await recordQuestionReuse([null, 42, 'valid-id', undefined, true]);
    expect(mockIncrementReuseCount).toHaveBeenCalledTimes(1);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('valid-id');
  });

  it('skips blank-string entries (whitespace only)', async () => {
    await recordQuestionReuse(['   ', '\t', 'real-id']);
    expect(mockIncrementReuseCount).toHaveBeenCalledTimes(1);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('real-id');
  });

  it('skips empty string entries', async () => {
    await recordQuestionReuse(['', 'valid-id', '']);
    expect(mockIncrementReuseCount).toHaveBeenCalledTimes(1);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith('valid-id');
  });

  it('resolves to undefined (returns void) on happy path', async () => {
    const result = await recordQuestionReuse(['id-1']);
    expect(result).toBeUndefined();
  });

  it('resolves to undefined when given an empty array', async () => {
    const result = await recordQuestionReuse([]);
    expect(result).toBeUndefined();
  });

});
