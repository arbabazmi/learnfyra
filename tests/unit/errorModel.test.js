/**
 * @file tests/unit/errorModel.test.js
 * @description Unit tests for src/questionBank/errorModel.js
 * Tests every entry in QB_ERRORS and the qbError() builder function.
 * @agent QA
 */

import { describe, it, expect, jest } from '@jest/globals';
import { QB_ERRORS, qbError } from '../../src/questionBank/errorModel.js';

// ─── QB_ERRORS catalogue ──────────────────────────────────────────────────────

describe('QB_ERRORS catalogue', () => {

  it('exports QB_ERRORS as an object', () => {
    expect(typeof QB_ERRORS).toBe('object');
    expect(QB_ERRORS).not.toBeNull();
  });

  const requiredKeys = [
    'INVALID_GRADE',
    'INVALID_SUBJECT',
    'INVALID_TYPE',
    'INVALID_DIFFICULTY',
    'INVALID_TOPIC',
    'MISSING_FIELD',
    'OPTIONS_INVALID',
    'DUPLICATE',
    'NOT_FOUND',
    'INTERNAL',
  ];

  it.each(requiredKeys)('QB_ERRORS contains key %s', (key) => {
    expect(QB_ERRORS).toHaveProperty(key);
  });

  it.each(requiredKeys)('QB_ERRORS[%s] has a numeric status field', (key) => {
    expect(typeof QB_ERRORS[key].status).toBe('number');
  });

  it.each(requiredKeys)('QB_ERRORS[%s] has a non-empty code string', (key) => {
    expect(typeof QB_ERRORS[key].code).toBe('string');
    expect(QB_ERRORS[key].code.length).toBeGreaterThan(0);
  });

  it.each(requiredKeys)('QB_ERRORS[%s] has a non-empty message string', (key) => {
    expect(typeof QB_ERRORS[key].message).toBe('string');
    expect(QB_ERRORS[key].message.length).toBeGreaterThan(0);
  });

  it('INVALID_GRADE has status 400', () => {
    expect(QB_ERRORS.INVALID_GRADE.status).toBe(400);
  });

  it('NOT_FOUND has status 404', () => {
    expect(QB_ERRORS.NOT_FOUND.status).toBe(404);
  });

  it('DUPLICATE has status 409', () => {
    expect(QB_ERRORS.DUPLICATE.status).toBe(409);
  });

  it('INTERNAL has status 500', () => {
    expect(QB_ERRORS.INTERNAL.status).toBe(500);
  });

  it.each(requiredKeys)('QB_ERRORS[%s].code starts with QB_', (key) => {
    expect(QB_ERRORS[key].code).toMatch(/^QB_/);
  });

  it('INVALID_DIFFICULTY has status 400 and code QB_INVALID_DIFFICULTY', () => {
    expect(QB_ERRORS.INVALID_DIFFICULTY.status).toBe(400);
    expect(QB_ERRORS.INVALID_DIFFICULTY.code).toBe('QB_INVALID_DIFFICULTY');
  });

  it('INVALID_TOPIC has status 400 and code QB_INVALID_TOPIC', () => {
    expect(QB_ERRORS.INVALID_TOPIC.status).toBe(400);
    expect(QB_ERRORS.INVALID_TOPIC.code).toBe('QB_INVALID_TOPIC');
  });

});

// ─── qbError() builder ────────────────────────────────────────────────────────

describe('qbError() builder', () => {

  it('returns an object with statusCode, code, and error fields', () => {
    const result = qbError('NOT_FOUND');
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('error');
  });

  it('statusCode matches the catalogue entry for NOT_FOUND', () => {
    const result = qbError('NOT_FOUND');
    expect(result.statusCode).toBe(404);
  });

  it('code matches the catalogue entry for NOT_FOUND', () => {
    const result = qbError('NOT_FOUND');
    expect(result.code).toBe('QB_NOT_FOUND');
  });

  it('error uses the default message when no detail is provided', () => {
    const result = qbError('NOT_FOUND');
    expect(result.error).toBe(QB_ERRORS.NOT_FOUND.message);
  });

  it('appends detail to the default message when detail is provided', () => {
    const result = qbError('NOT_FOUND', 'ID: abc-123');
    expect(result.error).toContain(QB_ERRORS.NOT_FOUND.message);
    expect(result.error).toContain('ID: abc-123');
  });

  it('detail is trimmed into the message without double spaces', () => {
    const result = qbError('NOT_FOUND', 'extra info');
    // The combined string should not start or end with a space
    expect(result.error).toBe(result.error.trim());
  });

  it('statusCode is 400 for INVALID_GRADE', () => {
    expect(qbError('INVALID_GRADE').statusCode).toBe(400);
  });

  it('statusCode is 400 for INVALID_SUBJECT', () => {
    expect(qbError('INVALID_SUBJECT').statusCode).toBe(400);
  });

  it('statusCode is 400 for INVALID_TYPE', () => {
    expect(qbError('INVALID_TYPE').statusCode).toBe(400);
  });

  it('statusCode is 400 for MISSING_FIELD', () => {
    expect(qbError('MISSING_FIELD').statusCode).toBe(400);
  });

  it('statusCode is 400 for OPTIONS_INVALID', () => {
    expect(qbError('OPTIONS_INVALID').statusCode).toBe(400);
  });

  it('statusCode is 409 for DUPLICATE', () => {
    expect(qbError('DUPLICATE').statusCode).toBe(409);
  });

  it('statusCode is 500 for INTERNAL', () => {
    expect(qbError('INTERNAL').statusCode).toBe(500);
  });

  it('unknown key falls back to INTERNAL (status 500)', () => {
    const result = qbError('DOES_NOT_EXIST');
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('QB_INTERNAL');
  });

  it('unknown key triggers console.warn when NODE_ENV is not production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      qbError('TOTALLY_UNKNOWN_KEY');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('TOTALLY_UNKNOWN_KEY');
      expect(warnSpy.mock.calls[0][0]).toContain('falling back to INTERNAL');
    } finally {
      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('statusCode is 400 for INVALID_DIFFICULTY', () => {
    expect(qbError('INVALID_DIFFICULTY').statusCode).toBe(400);
    expect(qbError('INVALID_DIFFICULTY').code).toBe('QB_INVALID_DIFFICULTY');
  });

  it('statusCode is 400 for INVALID_TOPIC', () => {
    expect(qbError('INVALID_TOPIC').statusCode).toBe(400);
    expect(qbError('INVALID_TOPIC').code).toBe('QB_INVALID_TOPIC');
  });

  it('unknown key with detail still returns 500 and includes the detail', () => {
    const result = qbError('UNKNOWN_KEY', 'something went wrong');
    expect(result.statusCode).toBe(500);
    expect(result.error).toContain('something went wrong');
  });

  it('empty string detail is treated the same as no detail', () => {
    const withEmpty = qbError('NOT_FOUND', '');
    const withNone  = qbError('NOT_FOUND');
    // Both should produce the same error text (no trailing space from empty detail)
    expect(withEmpty.error.trim()).toBe(withNone.error.trim());
  });

});
