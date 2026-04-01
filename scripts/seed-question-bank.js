/**
 * @file scripts/seed-question-bank.js
 * @description Seeds the question bank with sample questions for local development.
 *
 * Works with both adapters:
 *   QB_ADAPTER=local     → writes to worksheets-local/question-bank/ (default)
 *   QB_ADAPTER=dynamodb  → writes to DynamoDB local (requires DYNAMODB_ENDPOINT)
 *
 * Usage:
 *   node scripts/seed-question-bank.js
 *   node scripts/seed-question-bank.js --clear   (clears existing questions first — local only)
 *
 * Prerequisites for QB_ADAPTER=dynamodb:
 *   docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local
 *   node scripts/bootstrap-local-db.js
 */

import 'dotenv/config';
import { getQuestionBankAdapter } from '../src/questionBank/index.js';

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_QUESTIONS = [
  // ── Grade 1 — Math — Addition ──────────────────────────────────────────────
  {
    grade: 1, subject: 'Math', topic: 'Addition', difficulty: 'Easy',
    type: 'multiple-choice',
    question: 'What is 2 + 3?',
    options: ['A. 4', 'B. 5', 'C. 6', 'D. 7'],
    answer: 'B', explanation: '2 + 3 = 5', points: 1,
  },
  {
    grade: 1, subject: 'Math', topic: 'Addition', difficulty: 'Easy',
    type: 'true-false',
    question: '4 + 1 = 5',
    answer: 'True', explanation: '4 + 1 equals 5.', points: 1,
  },
  {
    grade: 1, subject: 'Math', topic: 'Addition', difficulty: 'Easy',
    type: 'fill-in-the-blank',
    question: '3 + ___ = 7',
    answer: '4', explanation: '3 + 4 = 7', points: 1,
  },

  // ── Grade 2 — Math — Subtraction ───────────────────────────────────────────
  {
    grade: 2, subject: 'Math', topic: 'Subtraction', difficulty: 'Easy',
    type: 'multiple-choice',
    question: 'What is 9 - 4?',
    options: ['A. 3', 'B. 4', 'C. 5', 'D. 6'],
    answer: 'C', explanation: '9 - 4 = 5', points: 1,
  },
  {
    grade: 2, subject: 'Math', topic: 'Subtraction', difficulty: 'Easy',
    type: 'fill-in-the-blank',
    question: '10 - ___ = 6',
    answer: '4', explanation: '10 - 4 = 6', points: 1,
  },

  // ── Grade 3 — Math — Multiplication ───────────────────────────────────────
  {
    grade: 3, subject: 'Math', topic: 'Multiplication', difficulty: 'Medium',
    type: 'multiple-choice',
    question: 'What is 6 × 7?',
    options: ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
    answer: 'B', explanation: '6 × 7 = 42', points: 1,
  },
  {
    grade: 3, subject: 'Math', topic: 'Multiplication', difficulty: 'Medium',
    type: 'true-false',
    question: '4 × 5 = 20',
    answer: 'True', explanation: '4 × 5 = 20', points: 1,
  },
  {
    grade: 3, subject: 'Math', topic: 'Multiplication', difficulty: 'Medium',
    type: 'fill-in-the-blank',
    question: '8 × ___ = 24',
    answer: '3', explanation: '8 × 3 = 24', points: 1,
  },
  {
    grade: 3, subject: 'Math', topic: 'Multiplication', difficulty: 'Hard',
    type: 'show-your-work',
    question: 'A farmer has 9 rows of apple trees with 7 trees in each row. How many trees are there in total? Show your work.',
    answer: '63', explanation: '9 × 7 = 63 trees', points: 2,
  },

  // ── Grade 4 — Math — Division ─────────────────────────────────────────────
  {
    grade: 4, subject: 'Math', topic: 'Division', difficulty: 'Medium',
    type: 'multiple-choice',
    question: 'What is 48 ÷ 6?',
    options: ['A. 6', 'B. 7', 'C. 8', 'D. 9'],
    answer: 'C', explanation: '48 ÷ 6 = 8', points: 1,
  },
  {
    grade: 4, subject: 'Math', topic: 'Division', difficulty: 'Medium',
    type: 'word-problem',
    question: 'There are 36 students going on a field trip. Each bus holds 9 students. How many buses are needed?',
    answer: '4', explanation: '36 ÷ 9 = 4 buses', points: 2,
  },

  // ── Grade 5 — Math — Fractions ────────────────────────────────────────────
  {
    grade: 5, subject: 'Math', topic: 'Fractions', difficulty: 'Medium',
    type: 'multiple-choice',
    question: 'Which fraction is equivalent to 1/2?',
    options: ['A. 2/6', 'B. 3/6', 'C. 2/3', 'D. 4/6'],
    answer: 'B', explanation: '3/6 simplifies to 1/2 because 3 ÷ 3 = 1 and 6 ÷ 3 = 2.', points: 1,
  },
  {
    grade: 5, subject: 'Math', topic: 'Fractions', difficulty: 'Hard',
    type: 'short-answer',
    question: 'What is 3/4 + 1/4? Write your answer as a fraction or whole number.',
    answer: '1', explanation: '3/4 + 1/4 = 4/4 = 1', points: 1,
  },

  // ── Grade 3 — ELA — Reading Comprehension ─────────────────────────────────
  {
    grade: 3, subject: 'ELA', topic: 'Reading Comprehension', difficulty: 'Medium',
    type: 'multiple-choice',
    question: 'In a story, the main character faces a problem and finds a solution. What is the part of a story where the main problem is introduced called?',
    options: ['A. Resolution', 'B. Climax', 'C. Rising Action', 'D. Exposition'],
    answer: 'D', explanation: 'The exposition is where the characters, setting, and initial conflict are introduced.', points: 1,
  },
  {
    grade: 3, subject: 'ELA', topic: 'Reading Comprehension', difficulty: 'Medium',
    type: 'true-false',
    question: 'The climax of a story is the turning point with the most tension.',
    answer: 'True', explanation: 'The climax is the highest point of tension or excitement in a story.', points: 1,
  },

  // ── Grade 4 — ELA — Grammar ───────────────────────────────────────────────
  {
    grade: 4, subject: 'ELA', topic: 'Grammar', difficulty: 'Easy',
    type: 'multiple-choice',
    question: 'Which sentence uses a comma correctly?',
    options: [
      'A. I like dogs cats and birds.',
      'B. I like dogs, cats, and birds.',
      'C. I like, dogs cats and birds.',
      'D. I like dogs cats, and birds.',
    ],
    answer: 'B', explanation: 'Commas separate items in a list. The Oxford comma before "and" is correct.', points: 1,
  },
  {
    grade: 4, subject: 'ELA', topic: 'Grammar', difficulty: 'Easy',
    type: 'fill-in-the-blank',
    question: 'A ___ is a word that describes a noun.',
    answer: 'adjective', explanation: 'An adjective modifies or describes a noun.', points: 1,
  },

  // ── Grade 5 — ELA — Vocabulary ────────────────────────────────────────────
  {
    grade: 5, subject: 'ELA', topic: 'Vocabulary', difficulty: 'Medium',
    type: 'matching',
    question: 'Match each word to its definition.',
    pairs: [
      { left: 'benevolent', right: 'kind and generous' },
      { left: 'melancholy', right: 'a feeling of sadness' },
      { left: 'persevere',  right: 'to keep trying despite difficulty' },
    ],
    answer: 'benevolent→kind and generous;melancholy→a feeling of sadness;persevere→to keep trying despite difficulty',
    explanation: 'These are commonly tested vocabulary words in Grade 5 ELA.',
    points: 3,
  },

  // ── Grade 4 — Science — Life Science ──────────────────────────────────────
  {
    grade: 4, subject: 'Science', topic: 'Life Science', difficulty: 'Medium',
    type: 'multiple-choice',
    question: 'What process do plants use to make their own food using sunlight?',
    options: ['A. Respiration', 'B. Photosynthesis', 'C. Germination', 'D. Pollination'],
    answer: 'B', explanation: 'Photosynthesis is the process by which plants use sunlight, water, and CO₂ to produce glucose.', points: 1,
  },
  {
    grade: 4, subject: 'Science', topic: 'Life Science', difficulty: 'Easy',
    type: 'true-false',
    question: 'The Sun is a star.',
    answer: 'True', explanation: 'The Sun is a medium-sized star at the center of our solar system.', points: 1,
  },

  // ── Grade 5 — Science — Earth Science ────────────────────────────────────
  {
    grade: 5, subject: 'Science', topic: 'Earth Science', difficulty: 'Medium',
    type: 'short-answer',
    question: 'Name the three layers of the Earth from outermost to innermost.',
    answer: 'crust, mantle, core', explanation: 'Earth\'s layers from outside to inside are: crust, mantle, and core.', points: 2,
  },
  {
    grade: 5, subject: 'Science', topic: 'Earth Science', difficulty: 'Hard',
    type: 'word-problem',
    question: 'A scientist measures that a glacier moves 2 meters per day. How far will it move in 2 weeks?',
    answer: '28', explanation: '2 meters/day × 14 days = 28 meters', points: 2,
  },

  // ── Grade 3 — Social Studies — Communities ────────────────────────────────
  {
    grade: 3, subject: 'Social Studies', topic: 'Communities', difficulty: 'Easy',
    type: 'multiple-choice',
    question: 'What is the main purpose of a map legend (key)?',
    options: [
      'A. To show the distance between cities',
      'B. To explain the symbols used on the map',
      'C. To show where north is',
      'D. To list all the cities on the map',
    ],
    answer: 'B', explanation: 'A map legend explains what each symbol on the map represents.', points: 1,
  },

  // ── Grade 10 — Math — Algebra ─────────────────────────────────────────────
  {
    grade: 10, subject: 'Math', topic: 'Algebra', difficulty: 'Hard',
    type: 'short-answer',
    question: 'Solve for x: 2x + 5 = 17',
    answer: '6', explanation: '2x = 17 - 5 = 12, so x = 6', points: 2,
  },
  {
    grade: 10, subject: 'Math', topic: 'Algebra', difficulty: 'Hard',
    type: 'show-your-work',
    question: 'Factor the expression: x² - 9. Show each step.',
    answer: '(x+3)(x-3)', explanation: 'x² - 9 is a difference of squares: (x+3)(x-3)', points: 3,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const adapter = process.env.QB_ADAPTER || 'local';
  console.log(`\nSeeding question bank (QB_ADAPTER=${adapter})...`);
  console.log(`Questions to seed: ${SEED_QUESTIONS.length}\n`);

  const qb = await getQuestionBankAdapter();

  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const q of SEED_QUESTIONS) {
    try {
      const { stored, duplicate } = await qb.addIfNotExists(q, q);
      if (duplicate) {
        console.log(`  skip  [G${q.grade} ${q.subject}] ${q.question.slice(0, 50)}...`);
        skipped++;
      } else {
        console.log(`  added [G${q.grade} ${q.subject}] ${q.question.slice(0, 50)}... → ${stored.questionId}`);
        added++;
      }
    } catch (err) {
      console.error(`  ERROR [G${q.grade} ${q.subject}] ${q.question.slice(0, 50)}...: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✓ Done — added: ${added}, skipped (duplicate): ${skipped}, errors: ${errors}`);

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message);
  if (err.message?.includes('ECONNREFUSED') || err.message?.includes('endpoint')) {
    console.error('  Hint: Is DynamoDB local running? docker run -d -p 8000:8000 amazon/dynamodb-local');
  }
  process.exit(1);
});
