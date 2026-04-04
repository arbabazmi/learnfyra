/**
 * @file tests/unit/accountDeletion.test.js
 * @description Unit tests for COPPA/CCPA account deletion helpers.
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

const mockQueryByField = jest.fn();
const mockDeleteItem   = jest.fn();
const mockGetItem      = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    queryByField: mockQueryByField,
    deleteItem:   mockDeleteItem,
    getItem:      mockGetItem,
  })),
}));

const { cascadeDeleteUser, logDeletionEvent } = await import('../../src/account/accountDeletion.js');

describe('cascadeDeleteUser()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryByField.mockImplementation(async (table, field) => {
      const fixtures = {
        'worksheetattempts:studentId': [{ attemptId: 'attempt-1' }, { attemptId: 'attempt-2' }],
        'worksheets:createdBy': [{ worksheetId: 'worksheet-1' }],
        'aggregates:userId': [{ id: 'aggregate-1' }],
        'certificates:userId': [{ id: 'certificate-1' }],
        'parentchildlinks:parentId': [{ PK: 'USER#parent-1' }],
        'parentchildlinks:childId': [{ PK: 'USER#other-parent-1' }],
        'memberships:studentId': [{ id: 'membership-1' }],
        'questionexposurehistory:userId': [{ id: 'history-1' }],
      };

      return fixtures[`${table}:${field}`] || [];
    });

    mockDeleteItem.mockResolvedValue(true);
  });

  it('deletes user-linked records across all supported tables and preserves consent records', async () => {
    const result = await cascadeDeleteUser('user-123');

    expect(result).toEqual({
      userId: 'user-123',
      deletedCounts: {
        worksheetAttempts: 2,
        worksheets: 1,
        aggregates: 1,
        certificates: 1,
        parentLinksAsParent: 1,
        parentLinksAsChild: 1,
        memberships: 1,
        questionHistory: 1,
        userRecord: 1,
      },
    });

    const queriedTables = mockQueryByField.mock.calls.map(([table]) => table);
    const deletedTables = mockDeleteItem.mock.calls.map(([table]) => table);

    expect(queriedTables).toEqual(expect.arrayContaining([
      'worksheetattempts',
      'worksheets',
      'aggregates',
      'certificates',
      'parentchildlinks',
      'memberships',
      'questionexposurehistory',
    ]));
    expect(deletedTables).toContain('users');
    expect(queriedTables).not.toContain('consentrecords');
    expect(deletedTables).not.toContain('consentrecords');
  });

  it('consentrecords are never queried or deleted (COPPA 312.10 audit retention)', async () => {
    await cascadeDeleteUser('user-audit-check');

    const allQueried = mockQueryByField.mock.calls.map(([table]) => table);
    const allDeleted = mockDeleteItem.mock.calls.map(([table]) => table);

    expect(allQueried).not.toContain('consentrecords');
    expect(allDeleted).not.toContain('consentrecords');
  });

  it('handles ResourceNotFoundException gracefully when a table is missing', async () => {
    const notFoundError = Object.assign(new Error('Table not found'), { name: 'ResourceNotFoundException' });

    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'worksheetattempts') throw notFoundError;
      if (table === 'memberships') throw notFoundError;
      return [];
    });

    await expect(cascadeDeleteUser('user-missing-tables')).resolves.toBeDefined();

    const result = await cascadeDeleteUser('user-missing-tables');
    expect(result.deletedCounts.worksheetAttempts).toBe(0);
    expect(result.deletedCounts.memberships).toBe(0);
  });

  it('throws when userId is missing', async () => {
    await expect(cascadeDeleteUser('')).rejects.toThrow('userId is required');
    await expect(cascadeDeleteUser(null)).rejects.toThrow('userId is required');
    await expect(cascadeDeleteUser(undefined)).rejects.toThrow('userId is required');
  });
});

// ─── logDeletionEvent ─────────────────────────────────────────────────────────

describe('logDeletionEvent()', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs a structured JSON audit event to stdout', () => {
    logDeletionEvent('user-123', { deletedCounts: { userRecord: 1 } });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.event).toBe('USER_DATA_DELETED');
    expect(logged.userId).toBe('user-123');
  });

  it('always sets consentRecordsRetained=true in the audit log', () => {
    logDeletionEvent('user-456', {});

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.consentRecordsRetained).toBe(true);
  });

  it('includes COPPA and CCPA compliance tags', () => {
    logDeletionEvent('user-789', {});

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.compliance).toContain('COPPA');
    expect(logged.compliance).toContain('CCPA');
  });

  it('is called by cascadeDeleteUser caller pattern — callable with deletedCounts from cascade result', async () => {
    mockQueryByField.mockResolvedValue([]);
    const result = await cascadeDeleteUser('user-log-test');
    // Simulate the typical caller pattern: log after cascade
    logDeletionEvent(result.userId, { deletedCounts: result.deletedCounts });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.userId).toBe('user-log-test');
  });
});
