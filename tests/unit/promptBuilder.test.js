/**
 * @file tests/unit/promptBuilder.test.js
 * @description Unit tests for AI prompt builder
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildStrictUserPrompt,
} from '../../src/ai/promptBuilder.js';

const baseOptions = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  questionCount: 10,
};

describe('promptBuilder', () => {

  // ─── buildSystemPrompt() ────────────────────────────────────────────────────

  describe('buildSystemPrompt()', () => {

    it('returns a non-empty string', () => {
      const result = buildSystemPrompt();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('mentions CCSS and NGSS standards', () => {
      const result = buildSystemPrompt();
      expect(result).toContain('CCSS');
      expect(result).toContain('NGSS');
    });

    it('instructs Claude to return JSON only', () => {
      expect(buildSystemPrompt().toLowerCase()).toContain('json');
    });

    it('instructs Claude to start with { and end with }', () => {
      const result = buildSystemPrompt();
      expect(result).toContain('{');
      expect(result).toContain('}');
    });

  });

  // ─── buildUserPrompt() ──────────────────────────────────────────────────────

  describe('buildUserPrompt()', () => {

    it('includes the grade, subject, topic, and difficulty', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('Grade 3');
      expect(prompt).toContain('Math');
      expect(prompt).toContain('Multiplication Facts (1–10)');
      expect(prompt).toContain('Medium');
    });

    it('specifies the exact question count', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('EXACTLY 10');
    });

    it('includes the JSON schema example with "questions" and "answer" fields', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('"questions"');
      expect(prompt).toContain('"answer"');
    });

    it('includes the concrete grade integer in the schema example', () => {
      // Schema example should show "grade": 3 (an actual integer, not a type annotation)
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('"grade": 3');
    });

    it('includes word-problem hint sentence for Math', () => {
      const prompt = buildUserPrompt(baseOptions);
      // The Math-specific hint instructs Claude to include at least one word-problem
      expect(prompt).toContain('Include at least one word-problem question');
    });

    it('does NOT include the Math word-problem hint sentence for Science', () => {
      const prompt = buildUserPrompt({ ...baseOptions, subject: 'Science' });
      // The schema example may show "word-problem" as a type value, but the
      // Math-specific hint sentence must be absent for non-Math subjects
      expect(prompt).not.toContain('Include at least one word-problem question');
    });

    it('includes reading comprehension hint for ELA', () => {
      const prompt = buildUserPrompt({ ...baseOptions, subject: 'ELA' });
      expect(prompt).toContain('reading comprehension');
    });

    it('does NOT include reading comprehension hint for Math', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).not.toContain('reading comprehension');
    });

    it('includes multiple-choice options rule', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('EXACTLY 4');
    });

    it('generates different prompts for different grades', () => {
      const grade1  = buildUserPrompt({ ...baseOptions, grade: 1 });
      const grade10 = buildUserPrompt({ ...baseOptions, grade: 10 });
      expect(grade1).not.toBe(grade10);
    });

    it('generates different prompts for different subjects', () => {
      const math    = buildUserPrompt({ ...baseOptions, subject: 'Math' });
      const science = buildUserPrompt({ ...baseOptions, subject: 'Science' });
      expect(math).not.toBe(science);
    });

    it('does NOT include the CRITICAL warning prefix', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).not.toContain('CRITICAL');
    });

    it('includes grade-band language hint for elementary grades', () => {
      const prompt = buildUserPrompt({ ...baseOptions, grade: 2 });
      expect(prompt).toContain('elementary');
    });

    it('includes grade-band language hint for middle school grades', () => {
      const prompt = buildUserPrompt({ ...baseOptions, grade: 7 });
      expect(prompt).toContain('middle school');
    });

    it('includes grade-band language hint for high school grades', () => {
      const prompt = buildUserPrompt({ ...baseOptions, grade: 9 });
      expect(prompt).toContain('high school');
    });

  });

  // ─── buildStrictUserPrompt() ────────────────────────────────────────────────

  describe('buildStrictUserPrompt()', () => {

    it('returns a non-empty string', () => {
      const result = buildStrictUserPrompt(baseOptions);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('prepends the CRITICAL JSON warning', () => {
      const prompt = buildStrictUserPrompt(baseOptions);
      expect(prompt).toContain('CRITICAL');
    });

    it('includes the same grade, subject, and topic as the normal prompt', () => {
      const strict = buildStrictUserPrompt(baseOptions);
      expect(strict).toContain('Grade 3');
      expect(strict).toContain('Math');
      expect(strict).toContain('Multiplication Facts (1–10)');
    });

    it('includes the exact question count', () => {
      const strict = buildStrictUserPrompt(baseOptions);
      expect(strict).toContain('EXACTLY 10');
    });

    it('is longer than the normal prompt (has extra warning text)', () => {
      const normal = buildUserPrompt(baseOptions);
      const strict = buildStrictUserPrompt(baseOptions);
      expect(strict.length).toBeGreaterThan(normal.length);
    });

    it('includes JSON object boundary instruction', () => {
      const strict = buildStrictUserPrompt(baseOptions);
      expect(strict).toContain('no text before {');
    });

  });

});
