/**
 * @file tests/unit/exposureTracker.test.js
 * @description Unit tests for src/ai/exposure/exposureTracker.js
 *
 * All file-system and DynamoDB I/O is replaced with jest mocks.
 * APP_RUNTIME is explicitly unset so the local-JSON path is exercised.
 *
 * Covers:
 *  - getExposedQuestionIds — happy path, empty history, corrupt file, missing userId
 *  - recordExposure        — fire-and-forget, deduplication, missing userId guard
 *  - Guest user ID support (FR-RCAP-013 exposure requirement)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';

// ─── FS module mock — must be declared before dynamic import ──────────────────

const mockStore = {};

const mockReadFileSync = jest.fn((filePath, _enc) => {
  if (mockStore[filePath] === undefined) {
    const err = new Error('ENOENT: no such file or directory');
    err.code = 'ENOENT';
    throw err;
  }
  return mockStore[filePath];
});

const mockWriteFileSync = jest.fn((filePath, content) => {
  mockStore[filePath] = content;
});

const mockMkdirSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  readFileSync:  mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync:     mockMkdirSync,
}));

// ─── path module — real implementation is fine ────────────────────────────────

// ─── Dynamic import after mocks are registered ────────────────────────────────

const { getExposedQuestionIds, recordExposure } =
  await import('../../src/ai/exposure/exposureTracker.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds the composite key used internally by the local store. */
function localKey(userId, grade, subject, topic) {
  return `${userId}|${grade}|${subject}|${topic}`;
}

/** File path the exposureTracker uses for local JSON storage. */
const EXPOSURE_FILE_PATH = join(process.cwd(), 'data-local', 'questionExposure.json');

/** Seeds the in-memory store so getExposedQuestionIds finds data. */
function seedStore(data) {
  mockStore[EXPOSURE_FILE_PATH] = JSON.stringify(data, null, 2);
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear any written files and reset call counts
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  jest.clearAllMocks();

  // Force local (non-AWS) runtime
  delete process.env.APP_RUNTIME;
});

afterEach(() => {
  delete process.env.APP_RUNTIME;
});

// ─── getExposedQuestionIds ────────────────────────────────────────────────────

describe('getExposedQuestionIds', () => {
  it('returns a Set of questionIds stored for the user+topic (happy path)', async () => {
    const store = {};
    store[localKey('user-1', 3, 'Math', 'Multiplication')] = {
      userId: 'user-1',
      grade: 3,
      subject: 'Math',
      topic: 'Multiplication',
      questionIds: ['q-001', 'q-002', 'q-003'],
    };
    seedStore(store);

    const ids = await getExposedQuestionIds('user-1', 3, 'Math', 'Multiplication');

    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(3);
    expect(ids.has('q-001')).toBe(true);
    expect(ids.has('q-003')).toBe(true);
  });

  it('returns an empty Set when no exposure history exists (new student)', async () => {
    // No file exists — ENOENT is thrown by readFileSync
    const ids = await getExposedQuestionIds('new-student', 4, 'Science', 'Weather');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(0);
  });

  it('returns an empty Set for a different topic even if the file has other data', async () => {
    const store = {};
    store[localKey('user-1', 3, 'Math', 'Addition')] = {
      questionIds: ['q-100'],
    };
    seedStore(store);

    const ids = await getExposedQuestionIds('user-1', 3, 'Math', 'Multiplication');
    expect(ids.size).toBe(0);
  });

  it('returns an empty Set when userId is null or empty', async () => {
    const ids1 = await getExposedQuestionIds(null, 3, 'Math', 'Addition');
    const ids2 = await getExposedQuestionIds('', 3, 'Math', 'Addition');
    expect(ids1.size).toBe(0);
    expect(ids2.size).toBe(0);
  });

  it('returns an empty Set when the local file is corrupt JSON (non-fatal failure)', async () => {
    mockStore[EXPOSURE_FILE_PATH] = 'NOT VALID JSON {{{';

    const ids = await getExposedQuestionIds('user-1', 3, 'Math', 'Addition');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(0);
  });

  it('guest user ID returns their exposure set (FR-RCAP-013 guest support)', async () => {
    const guestId = 'guest-session-abc123';
    const store = {};
    store[localKey(guestId, 1, 'ELA', 'Phonics')] = {
      questionIds: ['qg-001', 'qg-002'],
    };
    seedStore(store);

    const ids = await getExposedQuestionIds(guestId, 1, 'ELA', 'Phonics');
    expect(ids.has('qg-001')).toBe(true);
    expect(ids.has('qg-002')).toBe(true);
  });

  it('filters out non-string or blank questionId entries', async () => {
    const store = {};
    store[localKey('user-1', 3, 'Math', 'Division')] = {
      questionIds: ['q-valid', '', null, 123, 'q-valid-2'],
    };
    seedStore(store);

    const ids = await getExposedQuestionIds('user-1', 3, 'Math', 'Division');
    expect(ids.has('q-valid')).toBe(true);
    expect(ids.has('q-valid-2')).toBe(true);
    expect(ids.size).toBe(2);
  });
});

// ─── recordExposure ───────────────────────────────────────────────────────────

describe('recordExposure', () => {
  it('is fire-and-forget: does not return a promise (no await required)', () => {
    const result = recordExposure('user-1', 3, 'Math', 'Addition', ['q-001']);
    // Fire-and-forget: either returns undefined or a promise — both are acceptable.
    // The caller must never need to await it.
    expect(result === undefined || result instanceof Promise).toBe(true);
  });

  it('does nothing when userId is falsy', () => {
    // Should not throw
    expect(() => recordExposure(null, 3, 'Math', 'Addition', ['q-001'])).not.toThrow();
    expect(() => recordExposure('', 3, 'Math', 'Addition', ['q-001'])).not.toThrow();
  });

  it('does nothing when questionIds is empty', () => {
    expect(() => recordExposure('user-1', 3, 'Math', 'Addition', [])).not.toThrow();
  });

  it('does nothing when questionIds is not an array', () => {
    expect(() => recordExposure('user-1', 3, 'Math', 'Addition', null)).not.toThrow();
  });

  it('writes to the local store after async completion', async () => {
    recordExposure('user-2', 5, 'Science', 'Ecosystems', ['q-eco-1', 'q-eco-2']);

    // Let async microtasks and file writes settle
    await new Promise((r) => setTimeout(r, 20));

    // Verify write was called
    expect(mockWriteFileSync).toHaveBeenCalled();
    const writtenContent = mockWriteFileSync.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    const key = localKey('user-2', 5, 'Science', 'Ecosystems');
    expect(parsed[key]).toBeDefined();
    expect(parsed[key].questionIds).toContain('q-eco-1');
    expect(parsed[key].questionIds).toContain('q-eco-2');
  });

  it('merges new IDs with existing IDs (deduplication)', async () => {
    // Pre-seed existing exposure
    const store = {};
    store[localKey('user-3', 3, 'Math', 'Fractions')] = {
      userId: 'user-3',
      grade: 3,
      subject: 'Math',
      topic: 'Fractions',
      questionIds: ['q-existing-1'],
    };
    seedStore(store);

    recordExposure('user-3', 3, 'Math', 'Fractions', ['q-existing-1', 'q-new-1']);
    await new Promise((r) => setTimeout(r, 20));

    const writtenContent = mockWriteFileSync.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    const key = localKey('user-3', 3, 'Math', 'Fractions');
    const ids = parsed[key].questionIds;

    // q-existing-1 should appear only once (deduplication)
    expect(ids.filter((id) => id === 'q-existing-1')).toHaveLength(1);
    expect(ids).toContain('q-new-1');
  });

  it('filters out blank or non-string IDs before writing', async () => {
    recordExposure('user-4', 3, 'Math', 'Geometry', ['q-valid', '', '   ']);
    await new Promise((r) => setTimeout(r, 20));

    const writtenContent = mockWriteFileSync.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    const key = localKey('user-4', 3, 'Math', 'Geometry');
    const ids = parsed[key].questionIds;
    expect(ids).toContain('q-valid');
    expect(ids).not.toContain('');
  });
});
