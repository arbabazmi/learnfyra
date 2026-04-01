/**
 * @file src/modules/solve/worksheetStorage.ts
 * @description Bridges worksheet generation and the solve module.
 * Stores generated worksheets in localStorage so the solve module can load them.
 */

import type { Worksheet, Question, MCQQuestion, FillBlankQuestion, ShortAnswerQuestion, MatchingQuestion, Difficulty, Subject } from './types';

const STORAGE_KEY = 'learnfyra-worksheets';

/* ── Public API ──────────────────────────────────────────────────── */

/** Save a generated worksheet. */
export function saveWorksheet(worksheet: Worksheet): void {
  const store = getAllWorksheets();
  store[worksheet.worksheetId] = worksheet;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* quota exceeded — silently fail */ }
}

/** Load a worksheet by ID. Returns null if not found. */
export function loadWorksheet(worksheetId: string): Worksheet | null {
  const store = getAllWorksheets();
  return store[worksheetId] ?? null;
}

/** Get all stored worksheets (for list pages). */
export function getAllWorksheets(): Record<string, Worksheet> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Delete a worksheet by ID. */
export function deleteWorksheet(worksheetId: string): void {
  const store = getAllWorksheets();
  delete store[worksheetId];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

/* ── Mock Worksheet Generator ────────────────────────────────────── */
// Generates realistic mock questions based on form config.
// Replace with real API call (POST /api/generate) when backend is ready.

export interface GenerateConfig {
  grade: number;
  subject: Subject;
  topic: string;
  difficulty: Difficulty | 'mixed';
  questionCount: number;
  timerMode: 'timed' | 'untimed';
  questionTypes: string[];
}

const DIFFICULTY_POOL: Difficulty[] = ['easy', 'medium', 'hard'];

function pickDifficulty(config: Difficulty | 'mixed', index: number): Difficulty {
  if (config === 'mixed') return DIFFICULTY_POOL[index % 3];
  return config;
}

function uid(): string {
  return 'ws-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function qid(i: number): string {
  return `q-${i + 1}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Question bank by subject/topic ──────────────────────────────── */

interface QuestionTemplate {
  question: string;
  type: string;
  options?: { letter: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  hint1: string;
  hint2: string;
  blankSentence?: string;
  pairs?: { id: string; left: string; right: string }[];
}

const MATH_QUESTIONS: Record<string, QuestionTemplate[]> = {
  Algebra: [
    { question: 'Solve for x: 2x + 5 = 13', type: 'multiple-choice', options: [{ letter: 'A', text: 'x = 3' }, { letter: 'B', text: 'x = 4' }, { letter: 'C', text: 'x = 6' }, { letter: 'D', text: 'x = 8' }], correctAnswer: 'B', explanation: 'Subtract 5 from both sides: 2x = 8. Divide by 2: x = 4.', hint1: 'Isolate the variable x by performing inverse operations.', hint2: '2x + 5 = 13. First subtract 5 from both sides.' },
    { question: 'What is the value of 3x when x = 5?', type: 'fill-in-the-blank', blankSentence: '3x when x = 5 equals [BLANK]', correctAnswer: '15', explanation: '3 x 5 = 15. Substitute x with 5 and multiply.', hint1: 'Replace x with 5 in the expression.', hint2: '3 times 5 = ?' },
    { question: 'Simplify: 4a + 3a - 2a', type: 'fill-in-the-blank', blankSentence: '4a + 3a - 2a = [BLANK]', correctAnswer: '5a', explanation: 'Combine like terms: 4 + 3 - 2 = 5, so the answer is 5a.', hint1: 'Add and subtract the coefficients of a.', hint2: '4 + 3 = 7, then 7 - 2 = ?' },
    { question: 'What is the slope of the line y = 3x - 7?', type: 'multiple-choice', options: [{ letter: 'A', text: '-7' }, { letter: 'B', text: '3' }, { letter: 'C', text: '7' }, { letter: 'D', text: '-3' }], correctAnswer: 'B', explanation: 'In y = mx + b form, m is the slope. Here m = 3.', hint1: 'The equation is in slope-intercept form (y = mx + b).', hint2: 'The coefficient of x is the slope.' },
    { question: 'If 5y - 10 = 25, what is y?', type: 'multiple-choice', options: [{ letter: 'A', text: '3' }, { letter: 'B', text: '5' }, { letter: 'C', text: '7' }, { letter: 'D', text: '15' }], correctAnswer: 'C', explanation: 'Add 10: 5y = 35. Divide by 5: y = 7.', hint1: 'First, add 10 to both sides.', hint2: '5y = 35. Now divide both sides by 5.' },
    { question: 'Explain in your own words what a variable represents in algebra.', type: 'short-answer', correctAnswer: 'unknown', explanation: 'A variable is a symbol (usually a letter) that represents an unknown value that can change.', hint1: 'Think about what x or y stands for in equations.', hint2: 'It is a placeholder for a number we do not know yet.' },
    { question: 'Match each expression with its simplified form.', type: 'matching', pairs: [{ id: 'm1', left: '2x + 3x', right: '5x' }, { id: 'm2', left: '4y - y', right: '3y' }, { id: 'm3', left: '6a / 2', right: '3a' }, { id: 'm4', left: '3(2b)', right: '6b' }], correctAnswer: JSON.stringify({ m1: 'm1', m2: 'm2', m3: 'm3', m4: 'm4' }), explanation: 'Combine like terms or simplify each expression.', hint1: 'Add or subtract the coefficients for like terms.', hint2: '2x + 3x: the coefficients are 2 and 3, add them.' },
    { question: 'What is the value of x in: x/4 = 3?', type: 'fill-in-the-blank', blankSentence: 'x/4 = 3, so x = [BLANK]', correctAnswer: '12', explanation: 'Multiply both sides by 4: x = 12.', hint1: 'To isolate x, multiply both sides by the denominator.', hint2: '3 x 4 = ?' },
  ],
  Fractions: [
    { question: 'What is 1/4 + 1/2?', type: 'multiple-choice', options: [{ letter: 'A', text: '2/6' }, { letter: 'B', text: '3/4' }, { letter: 'C', text: '1/3' }, { letter: 'D', text: '2/4' }], correctAnswer: 'B', explanation: 'Convert 1/2 to 2/4. Then 1/4 + 2/4 = 3/4.', hint1: 'Find a common denominator.', hint2: 'LCD of 4 and 2 is 4. Convert 1/2 to fourths.' },
    { question: 'Which fraction is equivalent to 3/5?', type: 'multiple-choice', options: [{ letter: 'A', text: '5/10' }, { letter: 'B', text: '6/10' }, { letter: 'C', text: '9/10' }, { letter: 'D', text: '3/10' }], correctAnswer: 'B', explanation: 'Multiply both top and bottom by 2: 6/10.', hint1: 'Multiply numerator and denominator by the same number.', hint2: '3x2 = 6, 5x2 = 10.' },
    { question: 'Simplify 8/12 to lowest terms.', type: 'fill-in-the-blank', blankSentence: '8/12 = [BLANK]', correctAnswer: '2/3', explanation: 'GCF of 8 and 12 is 4. 8/4 = 2, 12/4 = 3.', hint1: 'Find the greatest common factor of 8 and 12.', hint2: 'The GCF is 4. Divide both numerator and denominator by 4.' },
    { question: 'What is 3/8 multiplied by 4?', type: 'multiple-choice', options: [{ letter: 'A', text: '12/8' }, { letter: 'B', text: '3/2' }, { letter: 'C', text: '7/8' }, { letter: 'D', text: '3/32' }], correctAnswer: 'B', explanation: '3/8 x 4 = 12/8 = 3/2.', hint1: 'Multiply the numerator by 4.', hint2: '3 x 4 = 12, so 12/8. Simplify.' },
    { question: 'A pizza has 8 slices. Sarah eats 3 and Tom eats 2. What fraction is left?', type: 'short-answer', correctAnswer: '3/8', explanation: '5 slices eaten, 3 left. 3/8 remains.', hint1: 'How many slices were eaten total?', hint2: '3 + 2 = 5 eaten, 8 - 5 = 3 left.' },
    { question: 'Match each fraction with its decimal equivalent.', type: 'matching', pairs: [{ id: 'f1', left: '1/2', right: '0.5' }, { id: 'f2', left: '1/4', right: '0.25' }, { id: 'f3', left: '3/4', right: '0.75' }, { id: 'f4', left: '1/5', right: '0.2' }], correctAnswer: JSON.stringify({ f1: 'f1', f2: 'f2', f3: 'f3', f4: 'f4' }), explanation: 'Divide numerator by denominator to get the decimal.', hint1: 'Divide the top by the bottom.', hint2: '1 / 2 = 0.5, 1 / 4 = 0.25.' },
    { question: 'Convert the mixed number 2 1/3 to an improper fraction.', type: 'fill-in-the-blank', blankSentence: '2 1/3 = [BLANK]', correctAnswer: '7/3', explanation: '2 x 3 + 1 = 7. Keep denominator: 7/3.', hint1: 'Multiply whole number by denominator, add numerator.', hint2: '2 x 3 = 6, then 6 + 1 = 7.' },
    { question: 'Which is greater: 5/8 or 3/5?', type: 'multiple-choice', options: [{ letter: 'A', text: '5/8' }, { letter: 'B', text: '3/5' }, { letter: 'C', text: 'They are equal' }, { letter: 'D', text: 'Cannot determine' }], correctAnswer: 'A', explanation: 'Convert to LCD 40: 25/40 vs 24/40. 5/8 is greater.', hint1: 'Find a common denominator.', hint2: 'LCD of 8 and 5 is 40.' },
  ],
  Geometry: [
    { question: 'What is the area of a rectangle with length 8 cm and width 5 cm?', type: 'multiple-choice', options: [{ letter: 'A', text: '13 cm\u00B2' }, { letter: 'B', text: '26 cm\u00B2' }, { letter: 'C', text: '40 cm\u00B2' }, { letter: 'D', text: '80 cm\u00B2' }], correctAnswer: 'C', explanation: 'Area = length x width = 8 x 5 = 40 cm\u00B2.', hint1: 'Use the formula: Area = l x w.', hint2: 'Multiply 8 by 5.' },
    { question: 'How many degrees are in a triangle?', type: 'fill-in-the-blank', blankSentence: 'The sum of angles in a triangle = [BLANK] degrees', correctAnswer: '180', explanation: 'All triangles have interior angles that sum to 180 degrees.', hint1: 'This is a fundamental property of all triangles.', hint2: 'Think: 60 + 60 + 60 for an equilateral triangle.' },
    { question: 'What is the perimeter of a square with side length 6 cm?', type: 'multiple-choice', options: [{ letter: 'A', text: '12 cm' }, { letter: 'B', text: '24 cm' }, { letter: 'C', text: '36 cm' }, { letter: 'D', text: '6 cm' }], correctAnswer: 'B', explanation: 'Perimeter = 4 x side = 4 x 6 = 24 cm.', hint1: 'A square has 4 equal sides.', hint2: 'P = 4s = 4 x 6.' },
    { question: 'Name a shape that has exactly 3 sides.', type: 'short-answer', correctAnswer: 'triangle', explanation: 'A triangle is a polygon with exactly 3 sides.', hint1: 'The prefix "tri" means three.', hint2: 'It is the simplest polygon.' },
    { question: 'Match each shape with the number of sides it has.', type: 'matching', pairs: [{ id: 'g1', left: 'Triangle', right: '3 sides' }, { id: 'g2', left: 'Quadrilateral', right: '4 sides' }, { id: 'g3', left: 'Pentagon', right: '5 sides' }, { id: 'g4', left: 'Hexagon', right: '6 sides' }], correctAnswer: JSON.stringify({ g1: 'g1', g2: 'g2', g3: 'g3', g4: 'g4' }), explanation: 'Count the sides: tri=3, quad=4, penta=5, hexa=6.', hint1: 'The prefixes tell you the number.', hint2: 'tri=3, quad=4, penta=5, hexa=6.' },
  ],
};

const SCIENCE_QUESTIONS: Record<string, QuestionTemplate[]> = {
  'Space & Solar System': [
    { question: 'Which planet is closest to the Sun?', type: 'multiple-choice', options: [{ letter: 'A', text: 'Venus' }, { letter: 'B', text: 'Mercury' }, { letter: 'C', text: 'Earth' }, { letter: 'D', text: 'Mars' }], correctAnswer: 'B', explanation: 'Mercury is the closest planet to the Sun.', hint1: 'Think about the planet order from the Sun.', hint2: 'Mercury, Venus, Earth, Mars...' },
    { question: 'How many planets are in our solar system?', type: 'multiple-choice', options: [{ letter: 'A', text: '7' }, { letter: 'B', text: '8' }, { letter: 'C', text: '9' }, { letter: 'D', text: '10' }], correctAnswer: 'B', explanation: 'There are 8 planets in our solar system.', hint1: 'Pluto is no longer counted as a planet.', hint2: 'Mercury through Neptune = 8.' },
    { question: 'The Sun is a ___ that gives us light and heat.', type: 'fill-in-the-blank', blankSentence: 'The Sun is a [BLANK] that gives us light and heat.', correctAnswer: 'star', explanation: 'The Sun is a star, the closest one to Earth.', hint1: 'Is the Sun a planet? A moon? Something else?', hint2: 'It shines like the lights in the night sky.' },
    { question: 'Which planet is the largest?', type: 'multiple-choice', options: [{ letter: 'A', text: 'Saturn' }, { letter: 'B', text: 'Neptune' }, { letter: 'C', text: 'Jupiter' }, { letter: 'D', text: 'Uranus' }], correctAnswer: 'C', explanation: 'Jupiter is the largest planet in our solar system.', hint1: 'Famous for its Great Red Spot.', hint2: 'Starts with J, a gas giant.' },
    { question: 'Which planet has beautiful rings?', type: 'multiple-choice', options: [{ letter: 'A', text: 'Mars' }, { letter: 'B', text: 'Jupiter' }, { letter: 'C', text: 'Saturn' }, { letter: 'D', text: 'Venus' }], correctAnswer: 'C', explanation: 'Saturn is known for its beautiful rings of ice and rock.', hint1: 'Like a planet wearing a hula hoop!', hint2: 'Starts with S, 6th from the Sun.' },
    { question: 'What keeps the planets moving around the Sun?', type: 'multiple-choice', options: [{ letter: 'A', text: 'Wind' }, { letter: 'B', text: 'Gravity' }, { letter: 'C', text: 'Magnets' }, { letter: 'D', text: 'Electricity' }], correctAnswer: 'B', explanation: 'Gravity keeps planets in orbit around the Sun.', hint1: 'Same force that keeps you on the ground.', hint2: 'When you jump, this force pulls you back down.' },
  ],
};

// Fallback generic questions for any subject/topic combo not in the bank
const GENERIC_MCQ: QuestionTemplate[] = [
  { question: 'Which of the following best describes the main concept of this topic?', type: 'multiple-choice', options: [{ letter: 'A', text: 'It is a fundamental principle' }, { letter: 'B', text: 'It is rarely used in practice' }, { letter: 'C', text: 'It only applies to advanced students' }, { letter: 'D', text: 'It has no real-world applications' }], correctAnswer: 'A', explanation: 'This topic covers fundamental principles used across the subject.', hint1: 'Think about the core ideas.', hint2: 'Fundamental means it is a basic building block.' },
];

function getQuestionBank(subject: string, topic: string): QuestionTemplate[] {
  if (subject === 'Math') {
    return MATH_QUESTIONS[topic] ?? MATH_QUESTIONS['Algebra'] ?? GENERIC_MCQ;
  }
  if (subject === 'Science') {
    return SCIENCE_QUESTIONS[topic] ?? SCIENCE_QUESTIONS['Space & Solar System'] ?? GENERIC_MCQ;
  }
  return GENERIC_MCQ;
}

function buildQuestion(template: QuestionTemplate, index: number, diff: Difficulty): Question {
  const base = {
    id: qid(index),
    number: index + 1,
    correctAnswer: template.correctAnswer,
    explanation: template.explanation,
    hint1: template.hint1,
    hint2: template.hint2,
    difficulty: diff,
    points: 1,
  };

  switch (template.type) {
    case 'multiple-choice':
      return { ...base, type: 'multiple-choice', question: template.question, options: template.options! } as MCQQuestion;
    case 'fill-in-the-blank':
      return { ...base, type: 'fill-in-the-blank', question: template.question, blankSentence: template.blankSentence! } as FillBlankQuestion;
    case 'short-answer':
      return { ...base, type: 'short-answer', question: template.question } as ShortAnswerQuestion;
    case 'matching':
      return { ...base, type: 'matching', question: template.question, pairs: template.pairs!, correctAnswer: template.correctAnswer } as MatchingQuestion;
    default:
      return { ...base, type: 'multiple-choice', question: template.question, options: template.options ?? GENERIC_MCQ[0].options! } as MCQQuestion;
  }
}

/** Generate a mock worksheet from the given config. */
export function generateMockWorksheet(config: GenerateConfig): Worksheet {
  const worksheetId = uid();
  const bank = getQuestionBank(config.subject, config.topic);

  // Build questions — cycle through bank, filter by selected types
  const allowedTypes = new Set(config.questionTypes);
  const filteredBank = bank.filter(t => allowedTypes.has(t.type));
  const pool = filteredBank.length > 0 ? filteredBank : bank;

  const questions: Question[] = [];
  for (let i = 0; i < config.questionCount; i++) {
    const template = pool[i % pool.length];
    const diff = pickDifficulty(config.difficulty as Difficulty | 'mixed', i);
    questions.push(buildQuestion(template, i, diff));
  }

  const estimatedTimeSeconds = config.timerMode === 'timed'
    ? config.questionCount * 90
    : 0; // untimed = no countdown

  return {
    worksheetId,
    title: `${config.topic} Practice`,
    grade: config.grade,
    subject: config.subject,
    topic: config.topic,
    difficulty: config.difficulty === 'mixed' ? 'medium' : config.difficulty as Difficulty,
    estimatedTimeSeconds,
    totalPoints: config.questionCount,
    questions,
  };
}
