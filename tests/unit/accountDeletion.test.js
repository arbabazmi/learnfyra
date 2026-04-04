/**
 * @file tests/unit/accountDeletion.test.js
 * @description Unit tests for COPPA/CCPA account deletion helpers.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockQueryByField = jest.fn();
const mockDeleteItem = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    queryByField: mockQueryByField,
    deleteItem: mockDeleteItem,
  })),
}));

const { cascadeDeleteUser } = await import('../../src/account/accountDeletion.js');

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
});
