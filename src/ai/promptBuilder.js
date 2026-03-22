/**
 * @file src/ai/promptBuilder.js
 * @description Builds system and user prompts for the Claude API worksheet request.
 *
 *   Key design decisions:
 *   - Schema is shown as a CONCRETE EXAMPLE object (not type annotations) so Claude
 *     mirrors the exact structure rather than returning type description strings.
 *   - A grade-band context line adjusts language complexity expectations.
 *   - buildStrictUserPrompt() is used on retry attempts ≥ 1 — it prepends a CRITICAL
 *     warning that the previous response was unparseable.
 * @agent DEV
 */

import {
  getStandardsForGradeSubject,
  getQuestionTypesForGradeSubject,
  getDescriptionForGradeSubject,
} from './topics.js';

// ─── Grade-band language guidance ────────────────────────────────────────────

/** Maps grade ranges to age-appropriate language guidance sent to Claude */
const GRADE_BAND = {
  elementary: { grades: [1, 2, 3, 4, 5], label: 'early elementary (Grades 1–5)' },
  middle:     { grades: [6, 7, 8],        label: 'middle school (Grades 6–8)' },
  high:       { grades: [9, 10],          label: 'high school (Grades 9–10)' },
};

/**
 * Returns the grade-band label for a given grade
 * @param {number} grade
 * @returns {string}
 */
function getGradeBandLabel(grade) {
  for (const band of Object.values(GRADE_BAND)) {
    if (band.grades.includes(grade)) return band.label;
  }
  return `Grade ${grade}`;
}

// ─── Schema example ───────────────────────────────────────────────────────────

/**
 * Concrete JSON example (not type annotations) shown to Claude in the prompt.
 * Using a real example object — not a type schema — dramatically improves Claude's
 * adherence to the expected structure and field types.
 *
 * Rules enforced by this example:
 *   - grade is an integer (not string)
 *   - questions is a JSON array
 *   - multiple-choice includes "options" (array of exactly 4 strings: A. B. C. D.)
 *   - all other types omit "options"
 *   - every question has "answer" and "explanation"
 *   - "number" starts at 1 and increments by 1
 */
const SCHEMA_EXAMPLE = `{
  "title": "Grade 3 Math: Multiplication Facts",
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication Facts (1-10)",
  "difficulty": "Medium",
  "standards": ["CCSS.MATH.CONTENT.3.OA.C.7"],
  "estimatedTime": "20 minutes",
  "instructions": "Solve each problem. Show your work where asked.",
  "totalPoints": 10,
  "questions": [
    {
      "number": 1,
      "type": "fill-in-the-blank",
      "question": "4 × 6 = ___",
      "answer": "24",
      "explanation": "4 groups of 6 equals 24.",
      "points": 1
    },
    {
      "number": 2,
      "type": "multiple-choice",
      "question": "What is 7 × 8?",
      "options": ["A. 54", "B. 56", "C. 48", "D. 63"],
      "answer": "B. 56",
      "explanation": "7 times 8 equals 56.",
      "points": 1
    },
    {
      "number": 3,
      "type": "word-problem",
      "question": "A baker makes 6 trays with 8 cookies each. How many cookies total?",
      "answer": "48",
      "explanation": "6 × 8 = 48 cookies.",
      "points": 2
    }
  ]
}`;

// ─── Public exports ───────────────────────────────────────────────────────────

/**
 * Returns the system prompt establishing Claude's role as a curriculum expert.
 * @returns {string}
 */
export function buildSystemPrompt() {
  return (
    'You are an expert USA K-12 curriculum educator who creates high-quality, ' +
    'standards-aligned worksheets. You follow Common Core State Standards (CCSS) ' +
    'for Math and ELA, Next Generation Science Standards (NGSS) for Science, and ' +
    'C3 Framework standards for Social Studies. ' +
    'You ALWAYS return valid JSON only — no markdown fences, no preamble, ' +
    'no explanation text before or after the JSON object. ' +
    'Start your response with { and end it with }.'
  );
}

/**
 * Builds the standard user prompt for worksheet generation (attempt 0).
 * @param {Object} options - Worksheet options
 * @param {number} options.grade
 * @param {string} options.subject
 * @param {string} options.topic
 * @param {string} options.difficulty
 * @param {number} options.questionCount
 * @returns {string}
 */
export function buildUserPrompt(options) {
  return _buildPromptBody(options, false);
}

/**
 * Builds a stricter user prompt for retry attempts (attempt ≥ 1).
 * Prepends a CRITICAL notice that the previous response was unparseable.
 * @param {Object} options - Worksheet options
 * @returns {string}
 */
export function buildStrictUserPrompt(options) {
  return _buildPromptBody(options, true);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Core prompt body builder.
 * @param {Object} options
 * @param {boolean} strict - If true, prepend the JSON-failure warning
 * @returns {string}
 */
function _buildPromptBody(options, strict) {
  const { grade, subject, topic, difficulty, questionCount } = options;

  const standards      = getStandardsForGradeSubject(grade, subject).join(', ') || 'CCSS';
  const questionTypes  = getQuestionTypesForGradeSubject(grade, subject).join(', ');
  const description    = getDescriptionForGradeSubject(grade, subject);
  const gradeBandLabel = getGradeBandLabel(grade);

  // Subject-specific extra instructions
  const mathHint = subject === 'Math'
    ? '\n- Include at least one word-problem question' : '';
  const elaHint = subject === 'ELA'
    ? '\n- Include reading comprehension elements where appropriate' : '';
  const contextHint = description
    ? `\n- Curriculum context: ${description}` : '';

  const strictPrefix = strict
    ? '⚠ CRITICAL: Your previous response could not be parsed as JSON.\n' +
      'You MUST return ONLY a raw JSON object — no text before {, no text after }.\n\n'
    : '';

  return (
    `${strictPrefix}` +
    `Generate a ${difficulty} difficulty worksheet for Grade ${grade} ${subject} ` +
    `on the topic of "${topic}".\n\n` +
    `Requirements:\n` +
    `- Produce EXACTLY ${questionCount} question objects in the "questions" array\n` +
    `- Use only these question types: ${questionTypes}\n` +
    `- Align to standards: ${standards}\n` +
    `- Write at ${gradeBandLabel} reading level${mathHint}${elaHint}${contextHint}\n` +
    `- Each multiple-choice question MUST have an "options" array of EXACTLY 4 strings ` +
    `labeled "A. …", "B. …", "C. …", "D. …"\n` +
    `- Non-multiple-choice questions MUST NOT include an "options" field\n` +
    `- Every question MUST include "answer" (string) and "explanation" (string)\n` +
    `- "number" starts at 1 and increments by 1 for each question\n` +
    `- "totalPoints" MUST equal the sum of all question "points" values\n` +
    `- "grade" field MUST be the integer ${grade} (not a string)\n\n` +
    `Return ONLY a JSON object that matches this exact structure:\n` +
    `${SCHEMA_EXAMPLE}`
  );
}
