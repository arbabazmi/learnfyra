/**
 * @file src/modules/solve/apiMapper.ts
 * @description Maps the backend /api/solve response into the frontend Worksheet type.
 *
 * The backend returns a flat question shape (question text, string[] options, etc.)
 * while the frontend expects richer typed objects (MCQOption with letter/text,
 * blankSentence for fill-in-the-blank, per-question id, etc.).
 */

import type {
  Worksheet,
  Question,
  MCQQuestion,
  FillBlankQuestion,
  ShortAnswerQuestion,
  MatchingQuestion,
  MCQOption,
  MatchingPair,
  Difficulty,
} from './types';

/** Shape of a question as returned by GET /api/solve/{id} */
interface ApiQuestion {
  number: number;
  type: string;
  question: string;
  options?: string[];
  points: number;
  prompt?: string;
  pairs?: Array<{ left: string; right: string }>;
  leftItems?: string[];
  rightItems?: string[];
  answer?: string;       // included when mode=practice
  explanation?: string;  // included when mode=practice
}

/** Shape of the full API response from GET /api/solve/{id} */
interface ApiSolveResponse {
  worksheetId: string;
  title?: string;
  grade: number;
  subject: string;
  topic: string;
  difficulty?: string;
  estimatedTime?: string;
  timerSeconds?: number;
  totalPoints: number;
  questions: ApiQuestion[];
}

/**
 * Parses "A. some text" into { letter: "A", text: "some text" }.
 * Falls back to full string as text with index-based letter.
 */
function parseOption(raw: string, index: number): MCQOption {
  const match = raw.match(/^([A-Z])\.\s*(.+)$/);
  if (match) return { letter: match[1], text: match[2] };
  const letter = String.fromCharCode(65 + index);
  return { letter, text: raw };
}

/**
 * Derives a blankSentence from the question text for fill-in-the-blank questions.
 * If the text contains "___" or a trailing "=?", replace with [BLANK].
 * Otherwise appends [BLANK] at the end.
 */
function deriveBlankSentence(questionText: string): string {
  if (questionText.includes('___')) {
    return questionText.replace(/_{2,}/g, '[BLANK]');
  }
  if (questionText.includes('=?')) {
    return questionText.replace('=?', '= [BLANK]');
  }
  if (questionText.includes('= ?')) {
    return questionText.replace('= ?', '= [BLANK]');
  }
  // Check for trailing "?" after a number/expression pattern
  if (/\?\s*$/.test(questionText)) {
    return questionText.replace(/\?\s*$/, '[BLANK]');
  }
  return `${questionText} [BLANK]`;
}

function mapQuestion(api: ApiQuestion): Question {
  const base = {
    id: `q-${api.number}`,
    number: api.number,
    question: api.question,
    correctAnswer: api.answer || '',       // included when mode=practice
    explanation: api.explanation || '',     // included when mode=practice
    hint1: '',
    hint2: '',
    difficulty: 'medium' as Difficulty,
    points: api.points,
  };

  switch (api.type) {
    case 'multiple-choice': {
      const options: MCQOption[] = (api.options || []).map(parseOption);
      return { ...base, type: 'multiple-choice', options } as MCQQuestion;
    }
    case 'true-false': {
      const options: MCQOption[] = [
        { letter: 'T', text: 'True' },
        { letter: 'F', text: 'False' },
      ];
      return { ...base, type: 'multiple-choice', options } as MCQQuestion;
    }
    case 'fill-in-the-blank': {
      const blankSentence = deriveBlankSentence(api.question);
      return { ...base, type: 'fill-in-the-blank', blankSentence } as FillBlankQuestion;
    }
    case 'short-answer':
    case 'word-problem':
    case 'show-your-work':
      return { ...base, type: 'short-answer' } as ShortAnswerQuestion;
    case 'matching': {
      const pairs: MatchingPair[] = (api.pairs || []).map((p, i) => ({
        id: `pair-${i}`,
        left: p.left,
        right: p.right,
      }));
      return { ...base, type: 'matching', pairs } as MatchingQuestion;
    }
    default:
      return { ...base, type: 'short-answer' } as ShortAnswerQuestion;
  }
}

/** Maps a raw /api/solve response to the frontend Worksheet type. */
export function mapApiToWorksheet(data: ApiSolveResponse): Worksheet {
  return {
    worksheetId: data.worksheetId,
    title: data.title || `Grade ${data.grade} ${data.subject}: ${data.topic}`,
    grade: data.grade,
    subject: data.subject as Worksheet['subject'],
    topic: data.topic,
    difficulty: (data.difficulty?.toLowerCase() || 'medium') as Difficulty,
    estimatedTimeSeconds: data.timerSeconds || 0,
    totalPoints: data.totalPoints,
    questions: data.questions.map(mapQuestion),
  };
}

/**
 * Maps a question preserving the answer and explanation fields.
 * Used for full solve-data (e.g. after generation) where answers are available.
 */
function mapQuestionWithAnswers(api: ApiQuestion): Question {
  const mapped = mapQuestion(api);
  mapped.correctAnswer = api.answer ?? '';
  mapped.explanation = api.explanation ?? '';
  return mapped;
}

/** Maps full solve-data.json (with answers) to the frontend Worksheet type. */
export function mapSolveDataToWorksheet(data: ApiSolveResponse): Worksheet {
  return {
    worksheetId: data.worksheetId,
    title: data.title || `Grade ${data.grade} ${data.subject}: ${data.topic}`,
    grade: data.grade,
    subject: data.subject as Worksheet['subject'],
    topic: data.topic,
    difficulty: (data.difficulty?.toLowerCase() || 'medium') as Difficulty,
    estimatedTimeSeconds: data.timerSeconds || 0,
    totalPoints: data.totalPoints,
    questions: data.questions.map(mapQuestionWithAnswers),
  };
}
