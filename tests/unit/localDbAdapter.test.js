/**
 * @file tests/unit/localDbAdapter.test.js
 * @description Unit tests for src/db/localDbAdapter.js
 * Uses real file I/O against a uniquely-named test table so tests are isolated.
 * The test table file is deleted after each test to prevent state bleed.
 * @agent QA
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Dynamic import of the real adapter (no mocks needed) ─────────────────────

const { localDbAdapter } = await import('../../src/db/localDbAdapter.js');

// ─── Table name helpers ────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data-local');

// Use a table name that is unique per test run to avoid collisions
const TEST_TABLE = `test_${Date.now()}`;

function tableFile() {
  return join(DATA_DIR, `${TEST_TABLE}.json`);
}

function cleanTable() {
  const f = tableFile();
  if (existsSync(f)) {
    unlinkSync(f);
  }
}

beforeEach(() => {
  cleanTable();
  // Ensure data-local dir exists (adapter creates it itself, but belt-and-suspenders)
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
});

afterEach(() => {
  cleanTable();
});

// ─── putItem ─────────────────────────────────────────────────────────────────

describe('localDbAdapter.putItem', () => {

  it('inserts a new item and returns it', async () => {
    const item = { id: 'item-1', name: 'Alpha' };
    const result = await localDbAdapter.putItem(TEST_TABLE, item);
    expect(result).toEqual(item);
  });

  it('persisted item is retrievable via getItem', async () => {
    const item = { id: 'item-2', value: 42 };
    await localDbAdapter.putItem(TEST_TABLE, item);
    const fetched = await localDbAdapter.getItem(TEST_TABLE, 'item-2');
    expect(fetched).toEqual(item);
  });

  it('upserts an existing item when the primary key already exists', async () => {
    const original = { id: 'item-3', status: 'draft' };
    const updated  = { id: 'item-3', status: 'published' };
    await localDbAdapter.putItem(TEST_TABLE, original);
    await localDbAdapter.putItem(TEST_TABLE, updated);
    const fetched = await localDbAdapter.getItem(TEST_TABLE, 'item-3');
    expect(fetched.status).toBe('published');
  });

  it('keeps two separate items after two inserts', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'a', n: 1 });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'b', n: 2 });
    const all = await localDbAdapter.listAll(TEST_TABLE);
    expect(all).toHaveLength(2);
  });

  it('supports userId as primary key', async () => {
    const user = { userId: 'user-abc', email: 'a@b.com' };
    await localDbAdapter.putItem(TEST_TABLE, user);
    const fetched = await localDbAdapter.getItem(TEST_TABLE, 'user-abc');
    expect(fetched).toEqual(user);
  });

});

// ─── getItem ─────────────────────────────────────────────────────────────────

describe('localDbAdapter.getItem', () => {

  it('returns null for a non-existent id in an empty table', async () => {
    const result = await localDbAdapter.getItem(TEST_TABLE, 'ghost-id');
    expect(result).toBeNull();
  });

  it('returns null for a non-existent id when other items exist', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'real-item' });
    const result = await localDbAdapter.getItem(TEST_TABLE, 'ghost-id');
    expect(result).toBeNull();
  });

  it('returns the correct item when multiple items exist', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'x', label: 'X' });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'y', label: 'Y' });
    const result = await localDbAdapter.getItem(TEST_TABLE, 'y');
    expect(result.label).toBe('Y');
  });

});

// ─── deleteItem ──────────────────────────────────────────────────────────────

describe('localDbAdapter.deleteItem', () => {

  it('returns true when an existing item is deleted', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'del-1' });
    const result = await localDbAdapter.deleteItem(TEST_TABLE, 'del-1');
    expect(result).toBe(true);
  });

  it('item is no longer retrievable after deletion', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'del-2' });
    await localDbAdapter.deleteItem(TEST_TABLE, 'del-2');
    const fetched = await localDbAdapter.getItem(TEST_TABLE, 'del-2');
    expect(fetched).toBeNull();
  });

  it('returns false when id does not exist', async () => {
    const result = await localDbAdapter.deleteItem(TEST_TABLE, 'nonexistent');
    expect(result).toBe(false);
  });

  it('does not affect other items when one is deleted', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'keep-1' });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'drop-1' });
    await localDbAdapter.deleteItem(TEST_TABLE, 'drop-1');
    const all = await localDbAdapter.listAll(TEST_TABLE);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('keep-1');
  });

});

// ─── queryByField ─────────────────────────────────────────────────────────────

describe('localDbAdapter.queryByField', () => {

  it('returns matching items when field value matches', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'q1', role: 'student' });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'q2', role: 'teacher' });
    const result = await localDbAdapter.queryByField(TEST_TABLE, 'role', 'student');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q1');
  });

  it('returns empty array when no items match the field value', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'q3', role: 'student' });
    const result = await localDbAdapter.queryByField(TEST_TABLE, 'role', 'admin');
    expect(result).toEqual([]);
  });

  it('returns empty array when table is empty', async () => {
    const result = await localDbAdapter.queryByField(TEST_TABLE, 'role', 'student');
    expect(result).toEqual([]);
  });

  it('returns multiple items when several match', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'q4', role: 'student' });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'q5', role: 'student' });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'q6', role: 'teacher' });
    const result = await localDbAdapter.queryByField(TEST_TABLE, 'role', 'student');
    expect(result).toHaveLength(2);
  });

  it('uses strict equality — does not match partial or type-coerced values', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'q7', score: 10 });
    // Query with string '10' should NOT match numeric 10
    const result = await localDbAdapter.queryByField(TEST_TABLE, 'score', '10');
    expect(result).toEqual([]);
  });

});

// ─── listAll ─────────────────────────────────────────────────────────────────

describe('localDbAdapter.listAll', () => {

  it('returns empty array for a non-existent table', async () => {
    const result = await localDbAdapter.listAll(`nonexistent_table_${Date.now()}`);
    expect(result).toEqual([]);
  });

  it('returns all inserted items', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'l1' });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'l2' });
    await localDbAdapter.putItem(TEST_TABLE, { id: 'l3' });
    const result = await localDbAdapter.listAll(TEST_TABLE);
    expect(result).toHaveLength(3);
  });

});

// ─── updateItem ──────────────────────────────────────────────────────────────

describe('localDbAdapter.updateItem', () => {

  it('merges updates into an existing item', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'u1', status: 'draft', title: 'My Doc' });
    const result = await localDbAdapter.updateItem(TEST_TABLE, 'u1', { status: 'published' });
    expect(result.status).toBe('published');
    expect(result.title).toBe('My Doc');
  });

  it('returns the updated item', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'u2', count: 0 });
    const result = await localDbAdapter.updateItem(TEST_TABLE, 'u2', { count: 5 });
    expect(result).not.toBeNull();
    expect(result.count).toBe(5);
  });

  it('returns null when id does not exist', async () => {
    const result = await localDbAdapter.updateItem(TEST_TABLE, 'no-such-id', { count: 1 });
    expect(result).toBeNull();
  });

  it('persists the update so subsequent getItem reflects the change', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'u3', active: false });
    await localDbAdapter.updateItem(TEST_TABLE, 'u3', { active: true });
    const fetched = await localDbAdapter.getItem(TEST_TABLE, 'u3');
    expect(fetched.active).toBe(true);
  });

  it('does not overwrite fields that are not included in updates', async () => {
    await localDbAdapter.putItem(TEST_TABLE, { id: 'u4', a: 1, b: 2 });
    await localDbAdapter.updateItem(TEST_TABLE, 'u4', { b: 99 });
    const fetched = await localDbAdapter.getItem(TEST_TABLE, 'u4');
    expect(fetched.a).toBe(1);
    expect(fetched.b).toBe(99);
  });

});
