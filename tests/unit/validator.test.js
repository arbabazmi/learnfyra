/**
 * @file tests/unit/validator.test.js
 * @description Unit tests for CLI input validation
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateGrade,
  validateQuestionCount,
  validateSubject,
  validateDifficulty,
  validateWorksheetOptions,
} from '../../src/cli/validator.js';

describe('validator', () => {

  describe('validateGrade()', () => {
    it('accepts valid grades 1 through 10', () => {
      for (let g = 1; g <= 10; g++) {
        expect(validateGrade(g)).toBe(true);
      }
    });

    it('throws on grade 0', () => {
      expect(() => validateGrade(0)).toThrow('Grade must be between 1 and 10');
    });

    it('throws on grade 11', () => {
      expect(() => validateGrade(11)).toThrow('Grade must be between 1 and 10');
    });

    it('throws on negative grade', () => {
      expect(() => validateGrade(-1)).toThrow('Grade must be between 1 and 10');
    });

    it('throws on non-integer grade', () => {
      expect(() => validateGrade(2.5)).toThrow('Grade must be between 1 and 10');
    });
  });

  describe('validateQuestionCount()', () => {
    it('accepts boundary value of 5', () => {
      expect(validateQuestionCount(5)).toBe(true);
    });

    it('accepts boundary value of 10', () => {
      expect(validateQuestionCount(10)).toBe(true);
    });

    it('accepts value in range (7)', () => {
      expect(validateQuestionCount(7)).toBe(true);
    });

    it('throws on count below minimum (4)', () => {
      expect(() => validateQuestionCount(4)).toThrow('Question count must be between 5 and 30');
    });

    it('throws on count above maximum (31)', () => {
      expect(() => validateQuestionCount(31)).toThrow('Question count must be between 5 and 30');
    });

    it('throws on zero', () => {
      expect(() => validateQuestionCount(0)).toThrow();
    });
  });

  describe('validateSubject()', () => {
    it('accepts all valid subjects', () => {
      const valid = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
      valid.forEach((s) => expect(validateSubject(s)).toBe(true));
    });

    it('throws on unknown subject', () => {
      expect(() => validateSubject('Art')).toThrow();
    });

    it('is case-sensitive', () => {
      expect(() => validateSubject('math')).toThrow();
    });
  });

  describe('validateDifficulty()', () => {
    it('accepts all valid difficulties', () => {
      ['Easy', 'Medium', 'Hard', 'Mixed'].forEach((d) =>
        expect(validateDifficulty(d)).toBe(true)
      );
    });

    it('throws on invalid difficulty', () => {
      expect(() => validateDifficulty('Expert')).toThrow();
    });
  });

  describe('validateWorksheetOptions()', () => {
    const validOptions = {
      grade: 5,
      subject: 'Math',
      topic: 'Fractions',
      difficulty: 'Medium',
      questionCount: 10,
    };

    it('accepts a fully valid options object', () => {
      expect(validateWorksheetOptions(validOptions)).toBe(true);
    });

    it('throws when grade is invalid', () => {
      expect(() => validateWorksheetOptions({ ...validOptions, grade: 0 })).toThrow();
    });

    it('throws when topic is empty', () => {
      expect(() => validateWorksheetOptions({ ...validOptions, topic: '' })).toThrow('Topic must be a non-empty string');
    });

    it('supports "count" alias for questionCount (batch mode)', () => {
      const opts = { ...validOptions, questionCount: undefined, count: 10 };
      expect(validateWorksheetOptions(opts)).toBe(true);
    });
  });

});
