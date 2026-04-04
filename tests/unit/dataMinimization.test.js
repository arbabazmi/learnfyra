/**
 * @file tests/unit/dataMinimization.test.js
 * @description Unit tests for child PII stripping in the backend validator.
 */

import { describe, it, expect } from '@jest/globals';
import { stripChildPII } from '../../backend/middleware/validator.js';

describe('stripChildPII()', () => {
  it('removes child-specific PII fields for child accounts', () => {
    const body = {
      studentName: 'Ava Johnson',
      teacherName: 'Ms. Carter',
      className: 'Homeroom A',
      period: '2nd',
      topic: 'Fractions',
    };

    const result = stripChildPII(body, 'child');

    expect(result).toBe(body);
    expect(result).toEqual({ topic: 'Fractions' });
  });

  it('preserves the same fields for adult accounts', () => {
    const body = {
      studentName: 'Alex Adult',
      teacherName: 'Mr. Lane',
      className: 'Math 6',
      period: '4th',
      topic: 'Decimals',
    };

    const result = stripChildPII({ ...body }, 'adult');

    expect(result).toEqual(body);
  });
});
