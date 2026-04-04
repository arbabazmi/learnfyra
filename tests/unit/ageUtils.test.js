/**
 * @file tests/unit/ageUtils.test.js
 * @description Unit tests for COPPA age helpers.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateAge,
  getAgeGroup,
  validateDateOfBirth,
} from '../../src/utils/ageUtils.js';

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function yearsAgoOnToday(years) {
  const now = new Date();
  return toIsoDate(new Date(Date.UTC(
    now.getUTCFullYear() - years,
    now.getUTCMonth(),
    now.getUTCDate(),
  )));
}

function tomorrowUtc() {
  const now = new Date();
  return toIsoDate(new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  )));
}

describe('calculateAge()', () => {
  it("calculates the correct age when today is the person's birthday", () => {
    expect(calculateAge(yearsAgoOnToday(13))).toBe(13);
  });

  it('throws for an invalid calendar date', () => {
    expect(() => calculateAge('2026-02-30')).toThrow('Invalid date of birth');
  });
});

describe('getAgeGroup()', () => {
  it('classifies age 12 as child', () => {
    expect(getAgeGroup(12)).toBe('child');
  });

  it('classifies age 13 as teen', () => {
    expect(getAgeGroup(13)).toBe('teen');
  });

  it('classifies age 18 as adult', () => {
    expect(getAgeGroup(18)).toBe('adult');
  });
});

describe('validateDateOfBirth()', () => {
  it('accepts today\'s birthday and returns the correct age group', () => {
    expect(validateDateOfBirth(yearsAgoOnToday(13))).toEqual({
      valid: true,
      age: 13,
      ageGroup: 'teen',
    });
  });

  it('rejects a future date of birth', () => {
    const result = validateDateOfBirth(tomorrowUtc());

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/future/i);
  });

  it('accepts the minimum supported age boundary of 5', () => {
    expect(validateDateOfBirth(yearsAgoOnToday(5))).toEqual({
      valid: true,
      age: 5,
      ageGroup: 'child',
    });
  });

  it('accepts the maximum supported age boundary of 120', () => {
    expect(validateDateOfBirth(yearsAgoOnToday(120))).toEqual({
      valid: true,
      age: 120,
      ageGroup: 'adult',
    });
  });
});
