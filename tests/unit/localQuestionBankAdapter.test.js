/**
 * @file tests/unit/localQuestionBankAdapter.test.js
 * @description Direct unit tests for src/questionBank/localQuestionBankAdapter.js.
 * Imports and exercises the REAL implementation — no mocks.
 * _clearStore() is called in beforeEach to reset in-memory state between tests.
 * @agent QA
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  addQuestion,
  addIfNotExists,
  getQuestion,
  listQuestions,
  questionExists,
  incrementReuseCount,
  _clearStore,
} from '../../src/questionBank/localQuestionBankAdapter.js';

// ─── Shared test fixtures ──────────────────────────────────────────────────────

const BASE_QUESTION = {
  grade:       3,
  subject:     'Math',
  topic:       'Multiplication',
  difficulty:  'Medium',
  type:        'multiple-choice',
  question:    'What is 6 × 7?',
  options:     ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
  answer:      'B',
  explanation: '6 × 7 = 42',
};

const BASE_QUESTION_2 = {
  grade:       5,
  subject:     'Science',
  topic:       'Photosynthesis',
  difficulty:  'Easy',
  type:        'short-answer',
  question:    'What gas do plants absorb during photosynthesis?',
  answer:      'Carbon dioxide',
  explanation: 'Plants absorb CO₂ and release O₂.',
};

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _clearStore();
});

// ─── addIfNotExists ────────────────────────────────────────────────────────────

describe('localQuestionBankAdapter.addIfNotExists', () => {

  it('new question returns stored question with generated questionId and duplicate=false', () => {
    const result = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    expect(result.duplicate).toBe(false);
    expect(result.stored).not.toBeNull();
    expect(typeof result.stored.questionId).toBe('string');
    expect(result.stored.questionId.length).toBeGreaterThan(0);
  });

  it('new question stored object has createdAt timestamp', () => {
    const result = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    expect(typeof result.stored.createdAt).toBe('string');
    expect(new Date(result.stored.createdAt).getTime()).not.toBeNaN();
  });

  it('new question stored object reflects input fields', () => {
    const result = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    expect(result.stored.grade).toBe(3);
    expect(result.stored.subject).toBe('Math');
    expect(result.stored.topic).toBe('Multiplication');
    expect(result.stored.question).toBe('What is 6 × 7?');
  });

  it('duplicate (same grade/subject/topic/type/question) returns stored=null and duplicate=true', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const second = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    expect(second.duplicate).toBe(true);
    expect(second.stored).toBeNull();
  });

  it('duplicate does not increase the store size', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const all = listQuestions();
    expect(all).toHaveLength(1);
  });

  it('case-insensitive dedupe: same question text in different case is a duplicate', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const upperCandidate = {
      ...BASE_QUESTION,
      subject:  BASE_QUESTION.subject.toUpperCase(),
      topic:    BASE_QUESTION.topic.toUpperCase(),
      type:     BASE_QUESTION.type.toUpperCase(),
      question: BASE_QUESTION.question.toUpperCase(),
    };
    const result = addIfNotExists(upperCandidate, BASE_QUESTION);
    expect(result.duplicate).toBe(true);
    expect(result.stored).toBeNull();
  });

  it('whitespace-trimmed dedupe: question with leading/trailing spaces is a duplicate', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const paddedCandidate = {
      ...BASE_QUESTION,
      subject:  `  ${BASE_QUESTION.subject}  `,
      topic:    `  ${BASE_QUESTION.topic}  `,
      type:     `  ${BASE_QUESTION.type}  `,
      question: `  ${BASE_QUESTION.question}  `,
    };
    const result = addIfNotExists(paddedCandidate, BASE_QUESTION);
    expect(result.duplicate).toBe(true);
  });

  it('different question text on same grade/subject/topic/type is NOT a duplicate', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const differentQ = { ...BASE_QUESTION, question: 'What is 3 × 4?' };
    const result = addIfNotExists(differentQ, differentQ);
    expect(result.duplicate).toBe(false);
    expect(result.stored).not.toBeNull();
  });

  it('different grade on same question text is NOT a duplicate', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const differentGrade = { ...BASE_QUESTION, grade: 4 };
    const result = addIfNotExists(differentGrade, differentGrade);
    expect(result.duplicate).toBe(false);
  });

  it('reuseCount initialises to 0 for a new question', () => {
    const result = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    expect(result.stored.reuseCount).toBe(0);
  });

});

// ─── getQuestion ───────────────────────────────────────────────────────────────

describe('localQuestionBankAdapter.getQuestion', () => {

  it('returns the stored question object by questionId', () => {
    const { stored } = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const fetched = getQuestion(stored.questionId);
    expect(fetched).not.toBeNull();
    expect(fetched.questionId).toBe(stored.questionId);
    expect(fetched.grade).toBe(3);
  });

  it('returns a copy — mutating the returned object does not affect the store', () => {
    const { stored } = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const fetched = getQuestion(stored.questionId);
    fetched.grade = 99;
    const refetched = getQuestion(stored.questionId);
    expect(refetched.grade).toBe(3);
  });

  it('returns null for an unknown questionId', () => {
    const result = getQuestion('nonexistent-id-xyz');
    expect(result).toBeNull();
  });

  it('returns null for an empty string id', () => {
    const result = getQuestion('');
    expect(result).toBeNull();
  });

  it('returns null when the store is empty', () => {
    const result = getQuestion('any-id');
    expect(result).toBeNull();
  });

});

// ─── listQuestions ─────────────────────────────────────────────────────────────

describe('localQuestionBankAdapter.listQuestions', () => {

  beforeEach(() => {
    // Seed two distinct questions into the store
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    addIfNotExists(BASE_QUESTION_2, BASE_QUESTION_2);
  });

  it('no filters returns all stored questions', () => {
    const results = listQuestions();
    expect(results).toHaveLength(2);
  });

  it('grade filter returns only questions matching that grade', () => {
    const results = listQuestions({ grade: 3 });
    expect(results).toHaveLength(1);
    expect(results[0].grade).toBe(3);
  });

  it('grade filter as string number is coerced to integer for matching', () => {
    const results = listQuestions({ grade: '5' });
    expect(results).toHaveLength(1);
    expect(results[0].grade).toBe(5);
  });

  it('grade filter 0 matches nothing (invalid grade, coerces but no match)', () => {
    const results = listQuestions({ grade: 0 });
    expect(results).toHaveLength(0);
  });

  it('subject filter returns only questions matching that subject', () => {
    const results = listQuestions({ subject: 'Math' });
    expect(results).toHaveLength(1);
    expect(results[0].subject).toBe('Math');
  });

  it('subject filter is case-insensitive', () => {
    const results = listQuestions({ subject: 'MATH' });
    expect(results).toHaveLength(1);
  });

  it('topic filter returns only questions matching that topic', () => {
    const results = listQuestions({ topic: 'Multiplication' });
    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('Multiplication');
  });

  it('topic filter is case-insensitive', () => {
    const results = listQuestions({ topic: 'MULTIPLICATION' });
    expect(results).toHaveLength(1);
  });

  it('difficulty filter returns only matching questions', () => {
    const results = listQuestions({ difficulty: 'Medium' });
    expect(results).toHaveLength(1);
    expect(results[0].difficulty).toBe('Medium');
  });

  it('difficulty filter is case-insensitive', () => {
    const results = listQuestions({ difficulty: 'medium' });
    expect(results).toHaveLength(1);
  });

  it('type filter returns only matching questions', () => {
    const results = listQuestions({ type: 'short-answer' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('short-answer');
  });

  it('type filter is case-insensitive', () => {
    const results = listQuestions({ type: 'SHORT-ANSWER' });
    expect(results).toHaveLength(1);
  });

  it('multiple filters AND-ed return the intersection', () => {
    const results = listQuestions({ grade: 3, subject: 'Math', difficulty: 'Medium' });
    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('Multiplication');
  });

  it('multiple filters with no intersection return empty array', () => {
    const results = listQuestions({ grade: 3, subject: 'Science' });
    expect(results).toHaveLength(0);
  });

  it('filter that matches no questions returns empty array', () => {
    const results = listQuestions({ grade: 9 });
    expect(results).toHaveLength(0);
  });

  it('empty store returns empty array', () => {
    _clearStore();
    const results = listQuestions();
    expect(results).toHaveLength(0);
  });

  it('returns copies — mutating items does not corrupt the store', () => {
    const [first] = listQuestions({ grade: 3 });
    first.grade = 99;
    const check = listQuestions({ grade: 3 });
    expect(check).toHaveLength(1);
  });

  it('null grade filter value is treated as absent (all grades returned)', () => {
    const results = listQuestions({ grade: null });
    expect(results).toHaveLength(2);
  });

});

// ─── incrementReuseCount ───────────────────────────────────────────────────────

describe('localQuestionBankAdapter.incrementReuseCount', () => {

  it('increments reuseCount from 0 to 1 on first call', () => {
    const { stored } = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const updated = incrementReuseCount(stored.questionId);
    expect(updated.reuseCount).toBe(1);
  });

  it('increments reuseCount from 1 to 2 on second call', () => {
    const { stored } = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    incrementReuseCount(stored.questionId);
    const updated = incrementReuseCount(stored.questionId);
    expect(updated.reuseCount).toBe(2);
  });

  it('persists the incremented value — getQuestion reflects the update', () => {
    const { stored } = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    incrementReuseCount(stored.questionId);
    const fetched = getQuestion(stored.questionId);
    expect(fetched.reuseCount).toBe(1);
  });

  it('returns null for an unknown questionId', () => {
    const result = incrementReuseCount('nonexistent-id-xyz');
    expect(result).toBeNull();
  });

  it('returns null when the store is empty', () => {
    const result = incrementReuseCount('any-id');
    expect(result).toBeNull();
  });

  it('returns the updated question object (not null) on success', () => {
    const { stored } = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const updated = incrementReuseCount(stored.questionId);
    expect(updated).not.toBeNull();
    expect(updated.questionId).toBe(stored.questionId);
  });

});

// ─── questionExists ────────────────────────────────────────────────────────────

describe('localQuestionBankAdapter.questionExists', () => {

  it('returns true for an existing question matching the dedupe key', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    expect(questionExists(BASE_QUESTION)).toBe(true);
  });

  it('returns false when the store is empty', () => {
    expect(questionExists(BASE_QUESTION)).toBe(false);
  });

  it('returns false when a different question is stored', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const different = { ...BASE_QUESTION, question: 'What is 2 + 2?' };
    expect(questionExists(different)).toBe(false);
  });

  it('case-insensitive: uppercase subject/topic/type/question still matches', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const upperCandidate = {
      ...BASE_QUESTION,
      subject:  BASE_QUESTION.subject.toUpperCase(),
      topic:    BASE_QUESTION.topic.toUpperCase(),
      type:     BASE_QUESTION.type.toUpperCase(),
      question: BASE_QUESTION.question.toUpperCase(),
    };
    expect(questionExists(upperCandidate)).toBe(true);
  });

  it('whitespace-trimmed: padded question text still matches', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const paddedCandidate = {
      ...BASE_QUESTION,
      question: `   ${BASE_QUESTION.question}   `,
      subject:  `  ${BASE_QUESTION.subject}  `,
      topic:    `  ${BASE_QUESTION.topic}  `,
      type:     `  ${BASE_QUESTION.type}  `,
    };
    expect(questionExists(paddedCandidate)).toBe(true);
  });

  it('different grade causes non-match (returns false)', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const diffGrade = { ...BASE_QUESTION, grade: 7 };
    expect(questionExists(diffGrade)).toBe(false);
  });

  it('different subject causes non-match (returns false)', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const diffSubject = { ...BASE_QUESTION, subject: 'Science' };
    expect(questionExists(diffSubject)).toBe(false);
  });

});

// ─── _clearStore ───────────────────────────────────────────────────────────────

describe('localQuestionBankAdapter._clearStore', () => {

  it('clears all stored questions so listQuestions returns empty array', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    addIfNotExists(BASE_QUESTION_2, BASE_QUESTION_2);
    _clearStore();
    expect(listQuestions()).toHaveLength(0);
  });

  it('after clear, getQuestion returns null for a previously stored id', () => {
    const { stored } = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    const id = stored.questionId;
    _clearStore();
    expect(getQuestion(id)).toBeNull();
  });

  it('after clear, new questions can be added again without conflict', () => {
    addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    _clearStore();
    const result = addIfNotExists(BASE_QUESTION, BASE_QUESTION);
    expect(result.duplicate).toBe(false);
    expect(result.stored).not.toBeNull();
  });

  it('throws in production environment (NODE_ENV=production)', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => _clearStore()).toThrow('_clearStore must not be called in production.');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

});
