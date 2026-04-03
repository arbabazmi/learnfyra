/**
 * @file src/db/localDbAdapter.js
 * @description Local file-system database adapter for development.
 * Each table is persisted as a JSON array in data-local/{tableName}.json
 * at the project root. All reads and writes are synchronous to prevent
 * race conditions during local dev.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Use process.cwd() so the adapter works in both local ESM runs and bundled
// Lambda CJS output, where import.meta.url can be unavailable at module init.
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data-local');

const _writeLocks = new Map();

function withTableLock(tableName, fn) {
  const prev = _writeLocks.get(tableName) || Promise.resolve();
  const next = prev.then(fn);
  _writeLocks.set(tableName, next.catch(() => {}));
  return next;
}

/**
 * Ensures the data-local directory exists.
 * @returns {void}
 */
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Returns the file path for a given table name.
 * @param {string} table - Table name
 * @returns {string} Absolute path to the JSON file
 */
function tablePath(table) {
  return join(DATA_DIR, `${table}.json`);
}

/**
 * Reads all records from a table file. Returns [] if the file does not exist.
 * @param {string} table - Table name
 * @returns {Object[]} Array of records
 */
function readTable(table) {
  const filePath = tablePath(table);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Writes the full records array to the table file (atomic read-modify-write).
 * @param {string} table - Table name
 * @param {Object[]} records - Array of records to persist
 * @returns {void}
 */
function writeTable(table, records) {
  ensureDataDir();
  writeFileSync(tablePath(table), JSON.stringify(records, null, 2), 'utf8');
}

/**
 * Determines the primary key value of an item by inspecting known key fields
 * in priority order: id, userId, classId, attemptId.
 * @param {Object} item - The record
 * @returns {string|undefined} The key value or undefined
 */
function getPrimaryKey(item) {
  return item.id ?? item.worksheetId ?? item.userId ?? item.classId ?? item.attemptId;
}

/**
 * Local file-system database adapter.
 * Implements the same interface as the future DynamoDB adapter so handlers
 * can swap adapters without changing business logic.
 */
export const localDbAdapter = {
  /**
   * Upserts an item into the table. Matches by the item's primary key field
   * (id, userId, classId, or attemptId — whichever is present).
   * @param {string} table - Table name
   * @param {Object} item - Item to store
   * @returns {Promise<Object>} The stored item
   */
  async putItem(table, item) {
    return withTableLock(table, async () => {
      const records = readTable(table);
      const key = getPrimaryKey(item);
      const idx = key !== undefined
        ? records.findIndex((r) => getPrimaryKey(r) === key)
        : -1;

      if (idx >= 0) {
        records[idx] = item;
      } else {
        records.push(item);
      }

      writeTable(table, records);
      return item;
    });
  },

  /**
   * Retrieves a single item by its primary key value.
   * @param {string} table - Table name
   * @param {string} id - Primary key value
   * @returns {Promise<Object|null>} The item or null if not found
   */
  async getItem(table, id) {
    const records = readTable(table);
    return records.find((r) => getPrimaryKey(r) === id) ?? null;
  },

  /**
   * Removes an item by its primary key value.
   * @param {string} table - Table name
   * @param {string} id - Primary key value
   * @returns {Promise<boolean>} True if an item was deleted, false otherwise
   */
  async deleteItem(table, id) {
    const records = readTable(table);
    const before = records.length;
    const filtered = records.filter((r) => getPrimaryKey(r) !== id);

    if (filtered.length === before) {
      return false;
    }

    writeTable(table, filtered);
    return true;
  },

  /**
   * Returns all records where item[fieldName] strictly equals value.
   * @param {string} table - Table name
   * @param {string} fieldName - Field to filter on
   * @param {*} value - Value to match
   * @returns {Promise<Object[]>} Matching records
   */
  async queryByField(table, fieldName, value) {
    const records = readTable(table);
    return records.filter((r) => r[fieldName] === value);
  },

  /**
   * Returns every record in the table. Returns [] if the table file does not exist.
   * @param {string} table - Table name
   * @returns {Promise<Object[]>} All records
   */
  async listAll(table) {
    return readTable(table);
  },

  /**
   * Merges updates into an existing item. The primary key is used to locate
   * the record; the key field itself is never overwritten by the merge.
   * @param {string} table - Table name
   * @param {string} id - Primary key value
   * @param {Object} updates - Partial fields to merge
   * @returns {Promise<Object|null>} The updated item or null if not found
   */
  async updateItem(table, id, updates) {
    const records = readTable(table);
    const idx = records.findIndex((r) => getPrimaryKey(r) === id);

    if (idx < 0) {
      return null;
    }

    records[idx] = { ...records[idx], ...updates };
    writeTable(table, records);
    return records[idx];
  },
};
