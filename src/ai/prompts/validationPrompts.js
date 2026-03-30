/**
 * @file src/ai/prompts/validationPrompts.js
 * @description Prompts for answer validation step (always runs on Sonnet).
 * Returns { system, user } objects ready for the Anthropic messages API.
 */

/**
 * Builds a validation prompt that asks Claude to verify a generated answer.
 *
 * @param {Object} params
 * @param {number|string} params.grade
 * @param {string} params.subject
 * @param {string} params.questionType
 * @param {string} params.question
 * @param {string} params.answer
 * @param {string[]} [params.options]  - only for multiple-choice
 * @returns {{ system: string, user: string }}
 */
export function buildValidationPrompt({ grade, subject, questionType, question, answer, options }) {
  const system = `You are a ${subject} curriculum expert and answer validator for Grade ${grade}.
Your role is to verify that a provided answer to a question is correct, complete, and grade-appropriate.
Respond ONLY with valid JSON — no markdown fences, no explanatory text.`;

  const optionsBlock = options && options.length
    ? `\nOptions:\n${options.map(o => `  ${o}`).join('\n')}`
    : '';

  const user = `Validate the answer to this Grade ${grade} ${subject} question.

Question type: ${questionType}
Question: ${question}${optionsBlock}
Provided answer: ${answer}

Verify:
1. Is the answer factually correct for Grade ${grade} ${subject}?
2. Is it the best/complete answer for this question type?
3. If incorrect, what is the correct answer?

Return this exact JSON:
{
  "is_correct": true,
  "confidence": 0.95,
  "corrected_answer": "${answer}",
  "validation_notes": "Brief note on why it is correct or what was fixed"
}

Rules:
- is_correct: true if the answer is correct, false if wrong
- confidence: float 0.0–1.0 (your certainty in this judgment)
- corrected_answer: the correct answer (same as provided if is_correct is true)
- For multiple-choice: corrected_answer must be a single letter (A, B, C, or D)
- For true-false: corrected_answer must be exactly "True" or "False"
- For fill-in-the-blank: corrected_answer should be lowercase trimmed`;

  return { system, user };
}
