/**
 * @file src/ai/guardrails/guardrailsBuilder.js
 * @description Builds a context-aware guardrail clause that is appended to the
 *   system prompt before every Claude API call.
 *
 *   Grade-band strictness:
 *     Grade 1-3  → 'strict'  (~280 tokens) — zero tolerance
 *     Grade 4-10 → 'medium'  (~200 tokens) — age-appropriate context allowed
 *
 *   The policy's guardrailLevel acts as a floor: if the policy says 'strict',
 *   ALL grades use strict regardless of the grade-band default.
 *
 *   Templates are loaded from DynamoDB (or local fallback) via guardrailsPolicy.js.
 *   Placeholders [grade], [subject], [age] are resolved at call time.
 * @agent DEV
 */

import { getGuardrailPolicy, getGuardrailTemplate } from './guardrailsPolicy.js';

// ─── Grade-band definitions ───────────────────────────────────────────────────

/**
 * Maps grade to the approximate student age (used in template [age] placeholder).
 * @param {number} grade
 * @returns {string} Human-readable age string e.g. "8-9"
 */
function gradeToAgeRange(grade) {
  const ages = {
    1: '6-7', 2: '7-8', 3: '8-9', 4: '9-10', 5: '10-11',
    6: '11-12', 7: '12-13', 8: '13-14', 9: '14-15', 10: '15-16',
  };
  return ages[grade] || String(grade + 5);
}

/**
 * Returns the default guardrail level for a grade band.
 *   Grade 1-3  → 'strict'
 *   Grade 4-10 → 'medium'
 *
 * @param {number} grade
 * @returns {'medium'|'strict'}
 */
function getDefaultLevelForGrade(grade) {
  return grade <= 3 ? 'strict' : 'medium';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} GuardrailSuffixOptions
 * @property {number}  grade           - Grade level 1-10
 * @property {string}  subject         - Subject name
 * @property {'medium'|'strict'} [guardrailLevel] - Override from policy (optional)
 */

/**
 * Builds a context-aware guardrail clause to append to the system prompt.
 *
 * Resolves [grade], [subject], [age] placeholders in the loaded template.
 * The effective level is the stricter of the grade-band default and the
 * policy-level setting (i.e., 'strict' always wins over 'medium').
 *
 * @param {GuardrailSuffixOptions} options
 * @returns {Promise<string>} Guardrail clause ready to append to system prompt
 */
export async function buildGuardrailSuffix(options) {
  const { grade, subject } = options;

  // Determine effective guardrail level: policy level is the floor, grade-band
  // may escalate to strict but can never relax below policy setting.
  let policy;
  try {
    policy = await getGuardrailPolicy();
  } catch {
    policy = { guardrailLevel: 'medium' };
  }

  const policyLevel = policy.guardrailLevel === 'strict' ? 'strict' : 'medium';
  const gradeDefault = getDefaultLevelForGrade(grade);

  // 'strict' beats 'medium' — use whichever is stricter
  const effectiveLevel = (policyLevel === 'strict' || gradeDefault === 'strict')
    ? 'strict'
    : 'medium';

  let template;
  try {
    template = await getGuardrailTemplate(effectiveLevel);
  } catch {
    // Absolute fallback if the policy module itself fails
    template =
      'You are generating educational content for Grade [grade] students (ages [age]). ' +
      'All content must be safe, factual, and age-appropriate.';
  }

  const age = gradeToAgeRange(grade);
  const clause = template
    .replace(/\[grade\]/g, String(grade))
    .replace(/\[subject\]/g, String(subject))
    .replace(/\[age\]/g, age);

  return clause;
}

/**
 * Returns the effective guardrail level that would be used for a given grade,
 * given the current policy. Used by outputValidator to set strictness thresholds.
 *
 * @param {number} grade
 * @param {'medium'|'strict'} [policyLevel='medium']
 * @returns {'medium'|'strict'}
 */
export function resolveEffectiveLevel(grade, policyLevel = 'medium') {
  const gradeDefault = getDefaultLevelForGrade(grade);
  return (policyLevel === 'strict' || gradeDefault === 'strict') ? 'strict' : 'medium';
}
