/**
 * @file src/rewards/antiGaming.js
 * @description Detect gaming and low-effort submissions.
 * Checks for repeated single-letter patterns, alternating patterns, and
 * impossibly fast completions. Returns a pointsMultiplier of 0 when gaming
 * is detected so the rewards engine can zero out points without needing to
 * know which specific rule fired.
 */

/**
 * Analyses a submission for gaming patterns.
 *
 * Only multiple-choice answers (single uppercase letters A-Z) are evaluated
 * for pattern checks. Non-MC answer types are ignored so text inputs from
 * short-answer or fill-in-the-blank questions don't pollute the signal.
 *
 * @param {Array<{answer: string|*}>} answers - Student's submitted answers
 * @param {number} timeTaken    - Seconds the student actually spent
 * @param {number} estimatedTime - Expected seconds to complete (0 = unknown)
 * @returns {{ isGaming: boolean, warnings: string[], pointsMultiplier: number }}
 */
export function detectGaming(answers, timeTaken, estimatedTime) {
  const warnings = [];

  // Isolate only single-letter (multiple-choice style) answers
  const mcAnswers = answers
    .map((a) =>
      typeof a.answer === 'string' ? a.answer.trim().toUpperCase() : null
    )
    .filter((a) => a !== null && /^[A-Z]$/.test(a));

  if (mcAnswers.length >= 4) {
    // Check 1: All identical letter (e.g. all A, all B)
    if (mcAnswers.every((a) => a === mcAnswers[0])) {
      warnings.push('RANDOM_PATTERN');
    }

    // Check 2: Alternating period-2 or period-4 pattern — only if not already
    //          flagged to avoid double-counting the same signal.
    if (!warnings.includes('RANDOM_PATTERN') && isAlternatingPattern(mcAnswers)) {
      warnings.push('ALTERNATING_PATTERN');
    }
  }

  // Check 3: Submission completed in under 10% of estimated time.
  // Guard with estimatedTime > 0 so worksheets with unknown timing are skipped.
  if (estimatedTime > 0 && timeTaken < estimatedTime * 0.1) {
    warnings.push('TOO_FAST');
  }

  return {
    isGaming: warnings.length > 0,
    warnings,
    pointsMultiplier: warnings.length > 0 ? 0 : 1,
  };
}

/**
 * Returns true when the answer array repeats a period-2 or period-4 cycle.
 *
 * Period-2 example  : [A, B, A, B, A, B]
 * Period-4 example  : [A, B, C, D, A, B, C, D]  (requires >= 8 items)
 *
 * @param {string[]} letters - Normalised single-letter answers
 * @returns {boolean}
 */
function isAlternatingPattern(letters) {
  if (letters.length < 4) return false;

  const period2 = letters.every((l, i) => l === letters[i % 2]);
  if (period2) return true;

  // Period-4 only meaningful when there are at least two full cycles
  if (letters.length >= 8) {
    const period4 = letters.every((l, i) => l === letters[i % 4]);
    if (period4) return true;
  }

  return false;
}
