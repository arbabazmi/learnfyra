/**
 * @file src/ai/routing/modelRouter.js
 * @description Selects the optimal Claude model per question type, difficulty, and
 * pipeline step. Haiku = fast/cheap for simple tasks; Sonnet = accurate for complex ones.
 */

export const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
export const MODEL_SONNET = 'claude-sonnet-4-6';

/** Question types well-suited for Haiku */
const HAIKU_TYPES = new Set(['multiple-choice', 'true-false', 'fill-in-the-blank']);

/** Pipeline steps that must always use Sonnet */
const SONNET_STEPS = new Set(['validate', 'escalated-generate']);

/**
 * Selects the Claude model for a question generation task.
 *
 * Priority order:
 * 1. validate / escalated-generate step → Sonnet
 * 2. explain step → Haiku
 * 3. Grade 9-10 → Sonnet
 * 4. Hard difficulty → Sonnet
 * 5. Complex types (word-problem, show-your-work, short-answer) → Sonnet
 * 6. Simple types + Easy/Medium → Haiku
 * 7. Default fallback → Sonnet
 *
 * @param {Object} params
 * @param {number} params.grade
 * @param {string} params.subject
 * @param {string} params.questionType  - Learnfyra question type
 * @param {string} params.difficulty    - 'Easy' | 'Medium' | 'Hard' | 'Mixed'
 * @param {string} [params.step='generate'] - 'generate' | 'answer' | 'validate' | 'explain' | 'escalated-generate'
 * @returns {{ model: string, reason: string }}
 */
export function selectModel({ grade, subject, questionType, difficulty, step = 'generate' }) {
  // Rule 1: critical steps always use Sonnet
  if (SONNET_STEPS.has(step)) {
    return { model: MODEL_SONNET, reason: `step=${step} always uses Sonnet` };
  }

  // Rule 2: explanation always uses Haiku (cost saving)
  if (step === 'explain') {
    return { model: MODEL_HAIKU, reason: 'explanation step always uses Haiku' };
  }

  // Rule 3: high school grades need deeper reasoning
  const gradeNum = Number(grade);
  if (gradeNum >= 9) {
    return { model: MODEL_SONNET, reason: `grade ${gradeNum} requires Sonnet` };
  }

  // Rule 4: hard difficulty requires stronger model
  if (difficulty === 'Hard') {
    return { model: MODEL_SONNET, reason: 'Hard difficulty uses Sonnet' };
  }

  // Rule 5: complex question types need more reasoning
  if (!HAIKU_TYPES.has(questionType)) {
    return { model: MODEL_SONNET, reason: `questionType=${questionType} requires Sonnet` };
  }

  // Rule 6: simple types with easy/medium difficulty → Haiku
  if (difficulty === 'Easy' || difficulty === 'Medium') {
    return { model: MODEL_HAIKU, reason: `${questionType}/${difficulty} uses Haiku` };
  }

  // Rule 7: default fallback
  return { model: MODEL_SONNET, reason: 'default fallback to Sonnet' };
}
