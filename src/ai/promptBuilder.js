/**
 * @file src/ai/promptBuilder.js
 * @description Builds system and user prompts for the Claude API worksheet request
 * @agent DEV
 */

import { CURRICULUM } from './topics.js';

/** Canonical JSON schema sent to Claude as part of the prompt */
const WORKSHEET_SCHEMA = `{
  "title": "string — descriptive worksheet title",
  "grade": "integer — 1 to 10",
  "subject": "enum — Math | ELA | Science | Social Studies | Health",
  "topic": "string",
  "difficulty": "enum — Easy | Medium | Hard | Mixed",
  "standards": ["string — CCSS or NGSS code"],
  "estimatedTime": "string — e.g. '20 minutes'",
  "instructions": "string — student-facing instructions",
  "totalPoints": "integer",
  "questions": [
    {
      "number": "integer — starts at 1",
      "type": "enum — multiple-choice | fill-in-the-blank | short-answer | true-false | matching | show-your-work | word-problem",
      "question": "string",
      "options": ["string — for multiple-choice only, exactly 4 options labeled A B C D"],
      "answer": "string — correct answer",
      "explanation": "string — brief explanation for answer key",
      "points": "integer"
    }
  ]
}`;

/** Question type guidance per subject */
const QUESTION_TYPES = {
  Math: 'fill-in-the-blank, multiple-choice, show-your-work, word-problem, true-false',
  ELA: 'multiple-choice, short-answer, fill-in-the-blank, matching',
  Science: 'multiple-choice, true-false, short-answer',
  'Social Studies': 'multiple-choice, matching, short-answer',
  Health: 'multiple-choice, true-false, short-answer',
};

/**
 * Returns the system prompt establishing Claude's role
 * @returns {string}
 */
export function buildSystemPrompt() {
  return (
    'You are an expert USA K-12 curriculum educator specializing in creating ' +
    'high-quality, standards-aligned worksheets. You follow Common Core State ' +
    'Standards (CCSS) for Math and ELA, and Next Generation Science Standards ' +
    '(NGSS) for Science. Always return valid JSON only — no markdown, no preamble, ' +
    'no explanation outside the JSON object.'
  );
}

/**
 * Builds the user prompt for worksheet generation
 * @param {Object} options - Worksheet generation options
 * @param {number} options.grade - Grade level 1–10
 * @param {string} options.subject - Subject name
 * @param {string} options.topic - Specific topic
 * @param {string} options.difficulty - Easy | Medium | Hard | Mixed
 * @param {number} options.questionCount - Number of questions
 * @returns {string} Formatted user prompt
 */
export function buildUserPrompt(options) {
  const { grade, subject, topic, difficulty, questionCount } = options;
  const curriculumData = CURRICULUM[grade]?.[subject];
  const standards = curriculumData?.standards?.join(', ') || 'CCSS';
  const questionTypes = QUESTION_TYPES[subject] || 'multiple-choice, short-answer';

  const mathExtra =
    subject === 'Math' ? '\n- Include at least one word problem' : '';
  const elaExtra =
    subject === 'ELA' ? '\n- Include reading comprehension elements where appropriate' : '';

  return `Generate a ${difficulty} difficulty worksheet for Grade ${grade} ${subject} on the topic of "${topic}".

Requirements:
- Exactly ${questionCount} questions
- Question types appropriate for grade level: ${questionTypes}
- Standards: ${standards}
- Age-appropriate language for Grade ${grade}
- Include a brief student-facing instruction line
- Vary question types for engagement${mathExtra}${elaExtra}
- Each multiple-choice question must have exactly 4 options labeled A, B, C, D
- Every question must include an "answer" and "explanation" field

Return ONLY a valid JSON object matching this exact schema:
${WORKSHEET_SCHEMA}`;
}
