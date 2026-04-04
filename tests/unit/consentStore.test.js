/**
 * @file tests/unit/consentStore.test.js
 * @description Unit tests for COPPA consent storage helpers.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import crypto from 'crypto';

const mockPutItem = jest.fn();
const mockQueryByField = jest.fn();
const mockUpdateItem = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    putItem: mockPutItem,
    queryByField: mockQueryByField,
    updateItem: mockUpdateItem,
  })),
}));

const {
  createConsentRequest,
  getConsentByToken,
  grantConsent,
  revokeConsent,
} = await import('../../src/consent/consentStore.js');

describe('consentStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createConsentRequest stores a pending consent record with token and retention fields', async () => {
    const uuidSpy = jest.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('consent-id-123')
      .mockReturnValueOnce('consent-token-456');

    const record = await createConsentRequest({
      childUserId: 'child-user-1',
      childEmail: 'child@example.com',
      parentEmail: 'parent@example.com',
    });

    expect(record).toMatchObject({
      consentId: 'consent-id-123',
      consentToken: 'consent-token-456',
      childUserId: 'child-user-1',
      childEmail: 'child@example.com',
      parentEmail: 'parent@example.com',
      status: 'pending',
      method: 'email_plus',
      grantedAt: null,
      revokedAt: null,
    });
    expect(record.expiresAt).toEqual(expect.any(Number));
    expect(record.retainUntil).toBeGreaterThan(record.expiresAt);
    expect(mockPutItem).toHaveBeenCalledWith('consentrecords', expect.objectContaining({
      consentId: 'consent-id-123',
      consentToken: 'consent-token-456',
    }));

    uuidSpy.mockRestore();
  });

  it('getConsentByToken returns the matching consent record', async () => {
    mockQueryByField.mockResolvedValueOnce([
      { consentId: 'consent-1', consentToken: 'token-abc', status: 'pending' },
    ]);

    const record = await getConsentByToken('token-abc');

    expect(mockQueryByField).toHaveBeenCalledWith('consentrecords', 'consentToken', 'token-abc');
    expect(record).toEqual({ consentId: 'consent-1', consentToken: 'token-abc', status: 'pending' });
  });

  it('grantConsent marks a record as granted and clears the pending TTL', async () => {
    mockUpdateItem.mockResolvedValueOnce({ consentId: 'consent-1', status: 'granted' });

    await grantConsent('consent-1', {
      parentName: 'Alex Parent',
      parentRelationship: 'guardian',
      ipAddress: '127.0.0.1',
      userAgent: 'Jest',
    });

    expect(mockUpdateItem).toHaveBeenCalledWith(
      'consentrecords',
      'consent-1',
      expect.objectContaining({
        status: 'granted',
        parentName: 'Alex Parent',
        parentRelationship: 'guardian',
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        expiresAt: null,
      }),
    );
  });

  it('revokeConsent revokes the most recent active consent record for a child', async () => {
    mockQueryByField.mockResolvedValueOnce([
      {
        consentId: 'old-revoked',
        childUserId: 'child-user-1',
        status: 'revoked',
        requestedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        consentId: 'active-consent',
        childUserId: 'child-user-1',
        status: 'granted',
        requestedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);
    mockUpdateItem.mockResolvedValueOnce({ consentId: 'active-consent', status: 'revoked' });

    await revokeConsent('child-user-1', {
      reason: 'Parent requested deletion',
      revokedBy: 'parent',
    });

    expect(mockQueryByField).toHaveBeenCalledWith('consentrecords', 'childUserId', 'child-user-1');
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'consentrecords',
      'active-consent',
      expect.objectContaining({
        status: 'revoked',
        revokeReason: 'Parent requested deletion',
        revokedBy: 'parent',
      }),
    );
  });
});
