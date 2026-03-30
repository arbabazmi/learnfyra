/**
 * @file src/ai/prompts/explanationPrompts.js
 * @description Prompts for the explanation step (always runs on Haiku — cost saving).
 * Returns { system, user } objects ready for the Anthropic messages API.
 */

/**
 * Builds a prompt to generate a student-facing explanation for a question/answer pair.
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
export function buildExplanationPrompt({ grade, subject, questionType, question, answer, options }) {
  const gradeNum = Number(grade);
  let audienceHint;
  if (gradeNum <= 2) {
    audienceHint = 'Use very simple words. Keep it to 1–2 short sentences. Be encouraging.';
  } else if (gradeNum <= 5) {
    audienceHint = 'Use simple, clear language. Keep it to 2–3 sentences.';
  } else if (gradeNum <= 8) {
    audienceHint = 'Use clear language. 2–4 sentences. Explain the reasoning.';
  } else {
    audienceHint = 'Use grade-level language. 3–5 sentences. Explain the concept and reasoning.';
  }

  const system = `You are a friendly ${subject} teacher explaining answers to Grade ${grade} students.
${audienceHint}
Respond ONLY with valid JSON — no markdown fences, no explanatory text.`;

  const optionsBlock = options && options.length
    ? `\nOptions:\n${options.map(o => `  ${o}`).join('\n')}`
    : '';

  const user = `Write a brief, student-friendly explanation for this Grade ${grade} ${subject} question.

Question type: ${questionType}
Question: ${question}${optionsBlock}
Correct answer: ${answer}

Return this exact JSON:
{
  "explanation": "Your explanation here"
}

Rules:
- Explain WHY the answer is correct in a way a Grade ${grade} student can understand
- Do not just restate the answer — explain the concept
- Keep it brief and encouraging`;

  return { system, user };
}
