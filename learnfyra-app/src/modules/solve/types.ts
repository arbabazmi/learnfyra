/**
 * @file src/modules/solve/types.ts
 * @description All TypeScript types for the Worksheet Solve module.
 */

/* ── Question Types ──────────────────────────────────────────────── */

export type QuestionType =
  | 'multiple-choice'
  | 'fill-in-the-blank'
  | 'short-answer'
  | 'matching';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MCQOption {
  letter: string;
  text: string;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface BaseQuestion {
  id: string;
  number: number;
  type: QuestionType;
  question: string;
  correctAnswer: string;
  explanation: string;
  hint1: string;
  hint2: string;
  difficulty: Difficulty;
  points: number;
}

export interface MCQQuestion extends BaseQuestion {
  type: 'multiple-choice';
  options: MCQOption[];
}

export interface FillBlankQuestion extends BaseQuestion {
  type: 'fill-in-the-blank';
  blankSentence: string; // sentence with [BLANK] placeholder
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short-answer';
  maxLength?: number;
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching';
  pairs: MatchingPair[];
  correctAnswer: string; // JSON stringified mapping { leftId: rightId }
}

export type Question =
  | MCQQuestion
  | FillBlankQuestion
  | ShortAnswerQuestion
  | MatchingQuestion;

/* ── Worksheet ───────────────────────────────────────────────────── */

export type Subject = 'Math' | 'ELA' | 'Science' | 'Social Studies' | 'Health';

export interface Worksheet {
  worksheetId: string;
  title: string;
  grade: number;
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  estimatedTimeSeconds: number;
  totalPoints: number;
  questions: Question[];
}

/* ── Solve Session ───────────────────────────────────────────────── */

export type SolveMode = 'exam' | 'practice';
export type SessionStatus = 'not-started' | 'in-progress' | 'submitted' | 'completed';

export interface SolveSession {
  worksheetId: string;
  mode: SolveMode;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  flaggedQuestions: Set<string>;
  hintsUsed: Record<string, number>;
  startTime: number;
  questionTimings: Record<string, number>;
  questionStartTime: number;
  status: SessionStatus;
}

/* ── Results ─────────────────────────────────────────────────────── */

export interface QuestionResult {
  questionId: string;
  number: number;
  correct: boolean;
  studentAnswer: string;
  correctAnswer: string;
  explanation: string;
  pointsEarned: number;
  pointsPossible: number;
  hintsUsed: number;
  timeSpent: number;
  topic?: string;
}

export interface SolveResults {
  worksheetId: string;
  mode: SolveMode;
  totalScore: number;
  totalPoints: number;
  percentage: number;
  grade: string;
  timeTaken: number;
  results: QuestionResult[];
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  hintsUsedTotal: number;
  averageTimePerQuestion: number;
}

/* ── Grade Theme ─────────────────────────────────────────────────── */

export type GradeTier = 'early' | 'middle' | 'advanced';

export interface GradeTheme {
  tier: GradeTier;
  fontSizeBoost: number;
  borderRadius: string;
  celebrationLevel: 'max' | 'medium' | 'subtle';
  useEmoji: boolean;
  correctMessage: string;
  incorrectMessage: string;
  completionMessage: string;
  backgroundStyle: 'playful' | 'geometric' | 'minimal';
}

/* ── Component Props ─────────────────────────────────────────────── */

export interface QuestionRendererProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showResult?: boolean;
  isCorrect?: boolean;
}
