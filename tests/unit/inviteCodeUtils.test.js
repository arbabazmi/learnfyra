/**
 * @file tests/unit/inviteCodeUtils.test.js
 * @description Unit tests for backend/utils/inviteCodeUtils.js
 * The DB adapter is fully mocked. No real I/O occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  generateInviteCode,
  checkCodeCollision,
  generateUniqueInviteCode,
} from '../../backend/utils/inviteCodeUtils.js';

// ─── DB mock factory ──────────────────────────────────────────────────────────

function makeDb(overrides = {}) {
  return {
    queryByPk: jest.fn(),
    getItem: jest.fn(),
    queryByField: jest.fn(),
    putItem: jest.fn(),
    updateItem: jest.fn(),
    ...overrides,
  };
}

// ─── generateInviteCode ───────────────────────────────────────────────────────

describe('generateInviteCode — length', () => {
  it('returns a string of exactly 6 characters', () => {
    const code = generateInviteCode();
    expect(typeof code).toBe('string');
    expect(code).toHaveLength(6);
  });

  it('returns 6 characters across multiple calls', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateInviteCode()).toHaveLength(6);
    }
  });
});

describe('generateInviteCode — charset', () => {
  it('uses only characters from the allowed set (A-Z excluding I/O, digits 2-9)', () => {
    const ALLOWED = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).toMatch(ALLOWED);
    }
  });

  it('never produces the digit 0', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).not.toMatch(/0/);
    }
  });

  it('never produces the digit 1', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).not.toMatch(/1/);
    }
  });

  it('never produces the letter O', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).not.toMatch(/O/);
    }
  });

  it('never produces the letter I', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).not.toMatch(/I/);
    }
  });
});

describe('generateInviteCode — uppercase', () => {
  it('returns only uppercase characters', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateInviteCode();
      expect(code).toBe(code.toUpperCase());
    }
  });
});

// ─── checkCodeCollision ───────────────────────────────────────────────────────

describe('checkCodeCollision — classes table', () => {
  it('returns false when the InviteCodeIndex query returns an empty array', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });
    const collision = await checkCodeCollision(db, 'ABC234', 'classes');
    expect(collision).toBe(false);
  });

  it('returns true when the InviteCodeIndex query returns one or more records', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([{ inviteCode: 'ABC234' }]) });
    const collision = await checkCodeCollision(db, 'ABC234', 'classes');
    expect(collision).toBe(true);
  });

  it('queries classes table by the raw code value for the InviteCodeIndex', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });
    await checkCodeCollision(db, 'XYZ789', 'classes');
    expect(db.queryByPk).toHaveBeenCalledWith('classes', 'XYZ789', expect.objectContaining({ indexName: 'InviteCodeIndex' }));
  });
});

describe('checkCodeCollision — parentinvitecodes table', () => {
  it('returns false when the PK lookup returns an empty array', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });
    const collision = await checkCodeCollision(db, 'ABCD34', 'parentinvitecodes');
    expect(collision).toBe(false);
  });

  it('returns true when the PK lookup returns one or more records', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([{ PK: 'INVITE#ABCD34' }]) });
    const collision = await checkCodeCollision(db, 'ABCD34', 'parentinvitecodes');
    expect(collision).toBe(true);
  });

  it('queries parentinvitecodes using INVITE# prefixed key', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });
    await checkCodeCollision(db, 'ABCD34', 'parentinvitecodes');
    expect(db.queryByPk).toHaveBeenCalledWith('parentinvitecodes', 'INVITE#ABCD34');
  });
});

describe('checkCodeCollision — unsupported table', () => {
  it('throws an error for an unsupported tableName', async () => {
    const db = makeDb();
    await expect(checkCodeCollision(db, 'ABC234', 'unknowntable')).rejects.toThrow(
      /unsupported tableName/,
    );
  });
});

// ─── generateUniqueInviteCode ─────────────────────────────────────────────────

describe('generateUniqueInviteCode — no collision', () => {
  it('returns a 6-character code on the first attempt when there is no collision', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });
    const code = await generateUniqueInviteCode(db, 'classes');
    expect(code).toHaveLength(6);
    expect(db.queryByPk).toHaveBeenCalledTimes(1);
  });

  it('returns a code from the allowed charset', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });
    const code = await generateUniqueInviteCode(db, 'classes');
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe('generateUniqueInviteCode — retries on collision', () => {
  it('retries and returns a code on the second attempt when the first collides', async () => {
    const db = makeDb({
      queryByPk: jest.fn()
        .mockResolvedValueOnce([{ inviteCode: 'COLLISION' }]) // first attempt: collision
        .mockResolvedValue([]),                               // second attempt: free
    });

    const code = await generateUniqueInviteCode(db, 'classes');

    expect(typeof code).toBe('string');
    expect(code).toHaveLength(6);
    expect(db.queryByPk).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxRetries before giving up', async () => {
    // All 3 attempts collide
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([{ inviteCode: 'TAKEN' }]) });

    await expect(generateUniqueInviteCode(db, 'classes', 3)).rejects.toThrow(
      /failed to generate a unique code after 3 attempts/,
    );
    expect(db.queryByPk).toHaveBeenCalledTimes(3);
  });
});

describe('generateUniqueInviteCode — throws after max retries', () => {
  it('throws an error when all default 5 attempts collide', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([{ inviteCode: 'TAKEN' }]) });

    await expect(generateUniqueInviteCode(db, 'classes')).rejects.toThrow(
      /failed to generate a unique code after 5 attempts/,
    );
    expect(db.queryByPk).toHaveBeenCalledTimes(5);
  });

  it('throws immediately (1 attempt) when maxRetries is 1 and that attempt collides', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([{ inviteCode: 'TAKEN' }]) });

    await expect(generateUniqueInviteCode(db, 'classes', 1)).rejects.toThrow(
      /failed to generate a unique code after 1 attempts/,
    );
    expect(db.queryByPk).toHaveBeenCalledTimes(1);
  });
});
