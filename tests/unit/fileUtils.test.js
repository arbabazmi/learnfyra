/**
 * @file tests/unit/fileUtils.test.js
 * @description Unit tests for file utility functions
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { sanitizeSegment, buildFilename } from '../../src/utils/fileUtils.js';

const baseOptions = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
};

describe('fileUtils', () => {

  describe('sanitizeSegment()', () => {
    it('converts to lowercase', () => {
      expect(sanitizeSegment('Math')).toBe('math');
    });

    it('replaces spaces with underscores', () => {
      expect(sanitizeSegment('Social Studies')).toBe('social_studies');
    });

    it('removes special characters', () => {
      expect(sanitizeSegment('Multiplication Facts (1–10)')).toBe('multiplication_facts_110');
    });

    it('handles already clean strings', () => {
      expect(sanitizeSegment('easy')).toBe('easy');
    });
  });

  describe('buildFilename()', () => {
    it('starts with the correct grade prefix', () => {
      const name = buildFilename(baseOptions, 'pdf');
      expect(name).toMatch(/^grade3_/);
    });

    it('includes the subject segment', () => {
      const name = buildFilename(baseOptions, 'pdf');
      expect(name).toContain('_math_');
    });

    it('includes the difficulty segment', () => {
      const name = buildFilename(baseOptions, 'pdf');
      expect(name).toContain('_medium_');
    });

    it('ends with the correct extension', () => {
      const pdfName = buildFilename(baseOptions, 'pdf');
      const docxName = buildFilename(baseOptions, 'docx');
      const htmlName = buildFilename(baseOptions, 'html');
      expect(pdfName).toMatch(/\.pdf$/);
      expect(docxName).toMatch(/\.docx$/);
      expect(htmlName).toMatch(/\.html$/);
    });

    it('appends ANSWER_KEY suffix when provided', () => {
      const name = buildFilename(baseOptions, 'pdf', 'ANSWER_KEY');
      expect(name).toContain('ANSWER_KEY');
    });

    it('includes a timestamp (8 digits YYYYMMDD)', () => {
      const name = buildFilename(baseOptions, 'pdf');
      expect(name).toMatch(/_\d{8}\./);
    });
  });

});
