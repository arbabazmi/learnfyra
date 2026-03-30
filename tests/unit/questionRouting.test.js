/**
 * @file tests/unit/questionRouting.test.js
 * @description Unit tests for the Haiku/Sonnet routing logic in
 *   src/ai/routing/modelRouter.js.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { selectModel, MODEL_HAIKU, MODEL_SONNET } from '../../src/ai/routing/modelRouter.js';

describe('selectModel() — Haiku/Sonnet routing', () => {

  const base = {
    grade: 3,
    subject: 'Math',
    questionType: 'multiple-choice',
    difficulty: 'Easy',
  };

  // ── Rule 1: Critical steps always Sonnet ─────────────────────────────────
  describe('Rule 1 — critical steps always Sonnet', () => {
    it('validate step returns Sonnet regardless of other params', () => {
      const { model } = selectModel({ ...base, step: 'validate' });
      expect(model).toBe(MODEL_SONNET);
    });

    it('escalated-generate step returns Sonnet', () => {
      const { model } = selectModel({ ...base, step: 'escalated-generate' });
      expect(model).toBe(MODEL_SONNET);
    });

    it('validate overrides easy grade-1 multiple-choice', () => {
      const { model } = selectModel({
        grade: 1, subject: 'Math', questionType: 'multiple-choice',
        difficulty: 'Easy', step: 'validate',
      });
      expect(model).toBe(MODEL_SONNET);
    });
  });

  // ── Rule 2: Explain step always Haiku ────────────────────────────────────
  describe('Rule 2 — explain step always Haiku', () => {
    it('returns Haiku for grade 1 easy', () => {
      const { model } = selectModel({ ...base, grade: 1, step: 'explain' });
      expect(model).toBe(MODEL_HAIKU);
    });

    it('returns Haiku even for grade 10 hard short-answer', () => {
      const { model } = selectModel({
        grade: 10, subject: 'Math', questionType: 'short-answer',
        difficulty: 'Hard', step: 'explain',
      });
      expect(model).toBe(MODEL_HAIKU);
    });
  });

  // ── Rule 3: Grade >= 9 → Sonnet ──────────────────────────────────────────
  describe('Rule 3 — high school grades require Sonnet', () => {
    it('grade 9 returns Sonnet', () => {
      const { model } = selectModel({ ...base, grade: 9 });
      expect(model).toBe(MODEL_SONNET);
    });

    it('grade 10 returns Sonnet', () => {
      const { model } = selectModel({ ...base, grade: 10 });
      expect(model).toBe(MODEL_SONNET);
    });

    it('grade 8 does NOT trigger rule 3 (falls through to rule 6)', () => {
      const { model } = selectModel({ ...base, grade: 8 });
      expect(model).toBe(MODEL_HAIKU);
    });
  });

  // ── Rule 4: Hard difficulty → Sonnet ─────────────────────────────────────
  describe('Rule 4 — hard difficulty', () => {
    it('multiple-choice Hard returns Sonnet', () => {
      const { model } = selectModel({ ...base, difficulty: 'Hard' });
      expect(model).toBe(MODEL_SONNET);
    });

    it('true-false Hard on grade 5 returns Sonnet', () => {
      const { model } = selectModel({
        grade: 5, subject: 'ELA', questionType: 'true-false', difficulty: 'Hard',
      });
      expect(model).toBe(MODEL_SONNET);
    });
  });

  // ── Rule 5: Complex types → Sonnet ───────────────────────────────────────
  describe('Rule 5 — complex question types', () => {
    ['word-problem', 'show-your-work', 'short-answer'].forEach((type) => {
      it(`${type} with Easy difficulty returns Sonnet`, () => {
        const { model } = selectModel({ grade: 3, subject: 'Math', questionType: type, difficulty: 'Easy' });
        expect(model).toBe(MODEL_SONNET);
      });
    });
  });

  // ── Rule 6: Simple types + Easy/Medium → Haiku ───────────────────────────
  describe('Rule 6 — simple types with Easy/Medium', () => {
    const simple = ['multiple-choice', 'true-false', 'fill-in-the-blank'];
    const easyMedium = ['Easy', 'Medium'];

    simple.forEach((type) => {
      easyMedium.forEach((difficulty) => {
        it(`${type} / ${difficulty} on grade 5 returns Haiku`, () => {
          const { model } = selectModel({ grade: 5, subject: 'Math', questionType: type, difficulty });
          expect(model).toBe(MODEL_HAIKU);
        });
      });
    });
  });

  // ── Rule 7: Default fallback → Sonnet ────────────────────────────────────
  describe('Rule 7 — default fallback', () => {
    it('multiple-choice / Mixed falls back to Sonnet', () => {
      const { model } = selectModel({
        grade: 5, subject: 'Math', questionType: 'multiple-choice', difficulty: 'Mixed',
      });
      expect(model).toBe(MODEL_SONNET);
    });
  });

  // ── Return shape ──────────────────────────────────────────────────────────
  describe('return value shape', () => {
    it('always returns { model, reason }', () => {
      const result = selectModel({ ...base });
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('reason');
      expect(typeof result.model).toBe('string');
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('reason mentions the step for step-based decisions', () => {
      const { reason } = selectModel({ ...base, step: 'validate' });
      expect(reason).toContain('validate');
    });

    it('MODEL_HAIKU and MODEL_SONNET are valid strings', () => {
      expect(typeof MODEL_HAIKU).toBe('string');
      expect(typeof MODEL_SONNET).toBe('string');
      expect(MODEL_HAIKU).not.toBe(MODEL_SONNET);
    });
  });

  // ── Default step ──────────────────────────────────────────────────────────
  describe('default step parameter', () => {
    it('omitting step produces same result as step=generate', () => {
      const withDefault  = selectModel({ ...base });
      const withExplicit = selectModel({ ...base, step: 'generate' });
      expect(withDefault.model).toBe(withExplicit.model);
    });
  });

});
