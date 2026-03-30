/**
 * @file src/ai/prompts/questionPrompts.js
 * @description Structured prompts for question generation per question type.
 * Returns { system, user } objects ready for the Anthropic messages API.
 */

/**
 * System prompt shared across all question generation calls.
 * @param {number|string} grade
 * @param {string} subject
 * @returns {string}
 */
function buildGenerationSystemPrompt(grade, subject) {
  const gradeNum = Number(grade);
  let languageHint;
  if (gradeNum <= 2) {
    languageHint = 'Use very simple vocabulary. Sentences should be short and concrete.';
  } else if (gradeNum <= 5) {
    languageHint = 'Use grade-appropriate vocabulary. Keep questions clear and direct.';
  } else if (gradeNum <= 8) {
    languageHint = 'Use middle-school vocabulary. Questions may involve multi-step reasoning.';
  } else {
    languageHint = 'Use high-school vocabulary. Questions may require analysis and synthesis.';
  }

  return `You are an expert ${subject} teacher creating curriculum-aligned questions for Grade ${grade} students.
${languageHint}
All questions must align with US curriculum standards (CCSS for Math/ELA, NGSS for Science).
Respond ONLY with valid JSON — no markdown fences, no explanatory text.`;
}

/**
 * Builds a user prompt for a single question of the given type.
 *
 * @param {Object} params
 * @param {number|string} params.grade
 * @param {string} params.subject
 * @param {string} params.topic
 * @param {string} params.difficulty   - 'Easy' | 'Medium' | 'Hard'
 * @param {string} params.questionType
 * @param {number} [params.attempt=0]  - retry attempt index (0 = first try)
 * @returns {{ system: string, user: string }}
 */
export function buildQuestionPrompt({ grade, subject, topic, difficulty, questionType, attempt = 0 }) {
  const system = buildGenerationSystemPrompt(grade, subject);
  const strictPrefix = attempt > 0 ? 'CRITICAL: You MUST return valid JSON only. Previous attempt failed validation.\n\n' : '';
  const user = strictPrefix + _buildTypePrompt({ grade, subject, topic, difficulty, questionType });
  return { system, user };
}

// ─── Per-type prompt builders ─────────────────────────────────────────────────

function _buildTypePrompt({ grade, subject, topic, difficulty, questionType }) {
  switch (questionType) {
    case 'multiple-choice':
      return _multipleChoice({ grade, subject, topic, difficulty });
    case 'true-false':
      return _trueFalse({ grade, subject, topic, difficulty });
    case 'fill-in-the-blank':
      return _fillInTheBlank({ grade, subject, topic, difficulty });
    case 'short-answer':
      return _shortAnswer({ grade, subject, topic, difficulty });
    case 'word-problem':
      return _wordProblem({ grade, subject, topic, difficulty });
    case 'show-your-work':
      return _showYourWork({ grade, subject, topic, difficulty });
    default:
      return _shortAnswer({ grade, subject, topic, difficulty });
  }
}

function _multipleChoice({ grade, subject, topic, difficulty }) {
  return `Create one ${difficulty} multiple-choice question for Grade ${grade} ${subject} on the topic: "${topic}".

Return this exact JSON structure:
{
  "type": "multiple-choice",
  "question": "The question text here",
  "options": ["A. option one", "B. option two", "C. option three", "D. option four"],
  "answer": "B",
  "explanation": "Brief explanation of why B is correct",
  "points": 1
}

Rules:
- Exactly 4 options labeled A through D
- answer is the letter only (A, B, C, or D)
- All distractors must be plausible
- Difficulty: ${difficulty}`;
}

function _trueFalse({ grade, subject, topic, difficulty }) {
  return `Create one ${difficulty} true/false question for Grade ${grade} ${subject} on the topic: "${topic}".

Return this exact JSON structure:
{
  "type": "true-false",
  "question": "A clear statement that is either true or false",
  "answer": "True",
  "explanation": "Brief explanation of why this is true/false",
  "points": 1
}

Rules:
- answer must be exactly "True" or "False"
- The statement must be unambiguously true or false
- Difficulty: ${difficulty}`;
}

function _fillInTheBlank({ grade, subject, topic, difficulty }) {
  return `Create one ${difficulty} fill-in-the-blank question for Grade ${grade} ${subject} on the topic: "${topic}".

Return this exact JSON structure:
{
  "type": "fill-in-the-blank",
  "question": "The sentence with _______ where the blank goes",
  "answer": "the exact word or phrase that fills the blank",
  "explanation": "Brief explanation",
  "points": 1
}

Rules:
- Use _______ (7 underscores) to mark the blank
- answer is the exact word/phrase (lowercase)
- Only one blank per question
- Difficulty: ${difficulty}`;
}

function _shortAnswer({ grade, subject, topic, difficulty }) {
  return `Create one ${difficulty} short-answer question for Grade ${grade} ${subject} on the topic: "${topic}".

Return this exact JSON structure:
{
  "type": "short-answer",
  "question": "The question text",
  "answer": "The expected answer (1-3 sentences or key terms)",
  "explanation": "What a complete correct answer should include",
  "points": 2
}

Rules:
- answer should be the model answer (concise)
- explanation lists key concepts the student must mention
- Difficulty: ${difficulty}`;
}

function _wordProblem({ grade, subject, topic, difficulty }) {
  return `Create one ${difficulty} word problem for Grade ${grade} ${subject} on the topic: "${topic}".

Return this exact JSON structure:
{
  "type": "word-problem",
  "question": "The full word problem narrative and question",
  "answer": "The final numeric or text answer",
  "explanation": "Step-by-step solution showing all work",
  "points": 3
}

Rules:
- Word problem should be realistic and age-appropriate for Grade ${grade}
- answer is the final answer only
- explanation walks through each step
- Difficulty: ${difficulty}`;
}

function _showYourWork({ grade, subject, topic, difficulty }) {
  return `Create one ${difficulty} "show your work" problem for Grade ${grade} ${subject} on the topic: "${topic}".

Return this exact JSON structure:
{
  "type": "show-your-work",
  "question": "The problem statement requiring shown work",
  "answer": "The final answer",
  "explanation": "Complete worked solution with all steps shown",
  "points": 3
}

Rules:
- Problem must require multiple steps
- answer is the final answer
- explanation shows every step of the solution
- Difficulty: ${difficulty}`;
}
