/**
 * @file tests/unit/retryUtils.test.js
 * @description Unit tests for exponential backoff retry wrapper.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { withRetry } from '../../src/utils/retryUtils.js';

describe('withRetry()', () => {

  // ── Success paths (no timers needed) ────────────────────────────────────

  it('resolves immediately when fn succeeds on the first try', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 0 })).resolves.toBe('ok');
  });

  it('calls fn exactly once on success', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    await withRetry(fn, { maxRetries: 3, baseDelayMs: 0 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('with maxRetries=0 resolves immediately on success', async () => {
    const fn = jest.fn().mockResolvedValue('immediate');
    await expect(withRetry(fn, { maxRetries: 0, baseDelayMs: 0 })).resolves.toBe('immediate');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call onRetry when fn succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const onRetry = jest.fn();
    await withRetry(fn, { maxRetries: 3, baseDelayMs: 0, onRetry });
    expect(onRetry).not.toHaveBeenCalled();
  });

  // ── Retry paths (baseDelayMs=0 eliminates actual sleep time) ────────────

  it('retries on error and resolves on second attempt', async () => {
    let calls = 0;
    const fn = jest.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
      return 'recovered';
    });
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 0 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exhausts all retries and throws the last error', async () => {
    const fn = jest.fn(async () => { throw new Error('persistent'); });
    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 0 })).rejects.toThrow('persistent');
    // 1 initial attempt + 2 retries = 3 calls total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses maxRetries=3 as default (4 total attempts)', async () => {
    const fn = jest.fn(async () => { throw new Error('always fails'); });
    await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('with maxRetries=0 makes exactly one attempt and throws on failure', async () => {
    const fn = jest.fn(async () => { throw new Error('single failure'); });
    await expect(withRetry(fn, { maxRetries: 0, baseDelayMs: 0 })).rejects.toThrow('single failure');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback with correct (attempt, error) arguments', async () => {
    let calls = 0;
    const fn = jest.fn(async () => {
      calls++;
      if (calls <= 2) throw new Error(`fail${calls}`);
      return 'done';
    });
    const onRetry = jest.fn();
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 0, onRetry });
    expect(result).toBe('done');
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][0]).toBe(1);
    expect(onRetry.mock.calls[0][1]).toBeInstanceOf(Error);
    expect(onRetry.mock.calls[0][1].message).toBe('fail1');
    expect(onRetry.mock.calls[1][0]).toBe(2);
    expect(onRetry.mock.calls[1][1].message).toBe('fail2');
  });

  it('does not call onRetry after the last failed attempt', async () => {
    const fn = jest.fn(async () => { throw new Error('fail'); });
    const onRetry = jest.fn();
    await expect(
      withRetry(fn, { maxRetries: 1, baseDelayMs: 0, onRetry })
    ).rejects.toThrow('fail');
    // maxRetries=1 means 1 retry → onRetry called exactly once before that retry
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // ── Delay behavior (fake timers, success path only to avoid rejection issues) ──

  it('applies exponential backoff: first delay is baseDelayMs * 2^0', async () => {
    jest.useFakeTimers();
    try {
      let calls = 0;
      const fn = jest.fn(async () => {
        calls++;
        if (calls < 3) throw new Error('retry me');
        return 'done';
      });
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 500 });
      await jest.runAllTimersAsync();
      await promise;

      const delays = setTimeoutSpy.mock.calls.map(call => call[1]);
      expect(delays).toContain(500);   // 500 * 2^0 = 500ms
      expect(delays).toContain(1000);  // 500 * 2^1 = 1000ms

      setTimeoutSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  // ── Value forwarding ─────────────────────────────────────────────────────

  it('forwards the resolved value from fn correctly', async () => {
    const fn = jest.fn().mockResolvedValue({ data: [1, 2, 3] });
    const result = await withRetry(fn, { maxRetries: 0, baseDelayMs: 0 });
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('re-throws the exact last error object', async () => {
    const specificError = new Error('specific error message');
    specificError.code = 'SPECIFIC_CODE';
    let calls = 0;
    const fn = jest.fn(async () => {
      calls++;
      throw specificError;
    });
    await expect(
      withRetry(fn, { maxRetries: 1, baseDelayMs: 0 })
    ).rejects.toMatchObject({ message: 'specific error message', code: 'SPECIFIC_CODE' });
  });

});
