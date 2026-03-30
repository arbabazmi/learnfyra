/**
 * @file tests/unit/questionCache.test.js
 * @description Unit tests for the in-memory question cache.
 * @agent QA
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { QuestionCache } from '../../src/ai/cache/questionCache.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const KEY = '3:math:multiple-choice:easy';
const makeQ = (n) => ({ question: `Q${n}`, answer: `A${n}`, type: 'multiple-choice' });

// ─── buildKey ─────────────────────────────────────────────────────────────────

describe('QuestionCache.buildKey()', () => {

  it('joins all parts with colons', () => {
    expect(QuestionCache.buildKey(3, 'Math', 'multiple-choice', 'Easy'))
      .toBe('3:math:multiple-choice:easy');
  });

  it('lowercases all parts', () => {
    expect(QuestionCache.buildKey(10, 'ELA', 'Short-Answer', 'Hard'))
      .toBe('10:ela:short-answer:hard');
  });

  it('handles numeric grade', () => {
    expect(QuestionCache.buildKey(1, 'Science', 'true-false', 'Medium'))
      .toBe('1:science:true-false:medium');
  });

});

// ─── set / get ────────────────────────────────────────────────────────────────

describe('set() and get()', () => {

  let cache;
  beforeEach(() => { cache = new QuestionCache(); });

  it('returns null when key does not exist', () => {
    expect(cache.get(KEY, 1)).toBeNull();
  });

  it('returns one question after setting one', () => {
    cache.set(KEY, [makeQ(1)]);
    const result = cache.get(KEY, 1);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('Q1');
  });

  it('returns exactly count questions', () => {
    cache.set(KEY, [makeQ(1), makeQ(2), makeQ(3)]);
    const result = cache.get(KEY, 2);
    expect(result).toHaveLength(2);
  });

  it('returns null when pool has fewer than count', () => {
    cache.set(KEY, [makeQ(1)]);
    expect(cache.get(KEY, 2)).toBeNull();
  });

  it('removes retrieved questions from the pool (no reuse)', () => {
    cache.set(KEY, [makeQ(1), makeQ(2)]);
    cache.get(KEY, 1); // retrieve Q1
    const second = cache.get(KEY, 1); // should get Q2
    expect(second[0].question).toBe('Q2');
    expect(cache.get(KEY, 1)).toBeNull(); // pool exhausted
  });

  it('appends questions to an existing valid entry', () => {
    cache.set(KEY, [makeQ(1)]);
    cache.set(KEY, [makeQ(2), makeQ(3)]);
    expect(cache.count(KEY)).toBe(3);
  });

});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('TTL expiry', () => {

  it('returns null after TTL expires', async () => {
    const cache = new QuestionCache(50); // 50ms TTL
    cache.set(KEY, [makeQ(1)]);

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get(KEY, 1)).toBeNull();
  });

  it('replaces expired entry with fresh questions on next set()', async () => {
    const cache = new QuestionCache(50);
    cache.set(KEY, [makeQ(1)]);

    await new Promise((r) => setTimeout(r, 60));
    cache.set(KEY, [makeQ(2)]);

    const result = cache.get(KEY, 1);
    expect(result[0].question).toBe('Q2');
  });

  it('count() returns 0 for expired entry', async () => {
    const cache = new QuestionCache(50);
    cache.set(KEY, [makeQ(1)]);

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.count(KEY)).toBe(0);
  });

});

// ─── count ───────────────────────────────────────────────────────────────────

describe('count()', () => {

  let cache;
  beforeEach(() => { cache = new QuestionCache(); });

  it('returns 0 for unknown key', () => {
    expect(cache.count('nonexistent')).toBe(0);
  });

  it('returns number of questions in pool', () => {
    cache.set(KEY, [makeQ(1), makeQ(2), makeQ(3)]);
    expect(cache.count(KEY)).toBe(3);
  });

  it('decreases after get() retrieves questions', () => {
    cache.set(KEY, [makeQ(1), makeQ(2), makeQ(3)]);
    cache.get(KEY, 2);
    expect(cache.count(KEY)).toBe(1);
  });

});

// ─── delete / flush / size ────────────────────────────────────────────────────

describe('delete()', () => {

  it('removes the entry so subsequent get() returns null', () => {
    const cache = new QuestionCache();
    cache.set(KEY, [makeQ(1)]);
    cache.delete(KEY);
    expect(cache.get(KEY, 1)).toBeNull();
  });

  it('is a no-op for a key that does not exist', () => {
    const cache = new QuestionCache();
    expect(() => cache.delete('ghost-key')).not.toThrow();
  });

});

describe('flush()', () => {

  it('clears all entries', () => {
    const cache = new QuestionCache();
    cache.set('key1', [makeQ(1)]);
    cache.set('key2', [makeQ(2)]);
    cache.flush();
    expect(cache.size).toBe(0);
  });

});

describe('size', () => {

  it('returns 0 for empty cache', () => {
    expect(new QuestionCache().size).toBe(0);
  });

  it('increments with each new key', () => {
    const cache = new QuestionCache();
    cache.set('k1', [makeQ(1)]);
    cache.set('k2', [makeQ(2)]);
    expect(cache.size).toBe(2);
  });

});

// ─── Singleton export ─────────────────────────────────────────────────────────

describe('singleton export', () => {

  it('exports a shared QuestionCache instance', async () => {
    const { questionCache } = await import('../../src/ai/cache/questionCache.js');
    expect(questionCache).toBeInstanceOf(QuestionCache);
  });

});
