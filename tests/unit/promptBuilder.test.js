/**
 * @file tests/unit/promptBuilder.test.js
 * @description Unit tests for AI prompt builder
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { buildSystemPrompt, buildUserPrompt } from '../../src/ai/promptBuilder.js';

const baseOptions = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  questionCount: 10,
};

describe('promptBuilder', () => {

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
      const result = buildSystemPrompt();
      expect(result.toLowerCase()).toContain('json');
    });
  });

  describe('buildUserPrompt()', () => {
    it('includes the grade, subject, topic, and difficulty', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('Grade 3');
      expect(prompt).toContain('Math');
      expect(prompt).toContain('Multiplication Facts (1–10)');
      expect(prompt).toContain('Medium');
    });

    it('includes the correct question count', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('10 questions');
    });

    it('includes the JSON schema', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('"questions"');
      expect(prompt).toContain('"answer"');
    });

    it('includes "word problem" hint for Math subject', () => {
      const prompt = buildUserPrompt(baseOptions);
      expect(prompt).toContain('word problem');
    });

    it('does NOT include math hint for non-Math subjects', () => {
      const prompt = buildUserPrompt({ ...baseOptions, subject: 'Science' });
      expect(prompt).not.toContain('word problem');
    });

    it('includes reading comprehension hint for ELA', () => {
      const prompt = buildUserPrompt({ ...baseOptions, subject: 'ELA' });
      expect(prompt).toContain('reading comprehension');
    });

    it('generates different prompts for different grades', () => {
      const grade1 = buildUserPrompt({ ...baseOptions, grade: 1 });
      const grade10 = buildUserPrompt({ ...baseOptions, grade: 10 });
      expect(grade1).not.toBe(grade10);
    });
  });

});
