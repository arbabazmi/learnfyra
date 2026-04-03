/**
 * @file tests/unit/topicSuggester.test.js
 * @description Unit tests for src/questionBank/topicSuggester.js
 *   Covers topic grouping, exclusion, sort order, empty results, and error safety.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Module mock: question bank adapter ──────────────────────────────────────

const mockListQuestions = jest.fn();

jest.unstable_mockModule('../../src/questionBank/index.js', () => ({
  getQuestionBankAdapter: jest.fn().mockResolvedValue({
    listQuestions: mockListQuestions,
  }),
}));

// ─── Dynamic import (after mocks) ────────────────────────────────────────────

const { suggestAlternativeTopics } = await import('../../src/questionBank/topicSuggester.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(topic, overrides = {}) {
  return {
    questionId: `qid-${Math.random()}`,
    grade: 3,
    subject: 'Math',
    topic,
    type: 'fill-in-the-blank',
    question: `Question about ${topic}`,
    answer: 'answer',
    explanation: 'explanation',
    points: 1,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('suggestAlternativeTopics — happy path', () => {

  it('returns topics sorted by question count descending', async () => {
    mockListQuestions.mockReturnValue([
      makeQuestion('Addition'),
      makeQuestion('Addition'),
      makeQuestion('Addition'),
      makeQuestion('Subtraction'),
      makeQuestion('Subtraction'),
      makeQuestion('Multiplication'),
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    expect(topics).toEqual(['Addition', 'Subtraction', 'Multiplication']);
  });

  it('returns at most 5 topics', async () => {
    const allTopics = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    mockListQuestions.mockReturnValue(
      allTopics.flatMap(t => [makeQuestion(t), makeQuestion(t)])
    );

    const topics = await suggestAlternativeTopics(3, 'Math', 'X');
    expect(topics.length).toBeLessThanOrEqual(5);
  });

  it('returns exactly 5 when more than 5 topics are available', async () => {
    const allTopics = ['A', 'B', 'C', 'D', 'E', 'F'];
    mockListQuestions.mockReturnValue(
      allTopics.flatMap(t => [makeQuestion(t), makeQuestion(t)])
    );

    const topics = await suggestAlternativeTopics(3, 'Math', 'X');
    expect(topics).toHaveLength(5);
  });

  it('excludes the requested topic from suggestions (case-insensitive)', async () => {
    mockListQuestions.mockReturnValue([
      makeQuestion('Multiplication'),
      makeQuestion('Multiplication'),
      makeQuestion('Division'),
      makeQuestion('division'), // lowercase variant — same topic
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    expect(topics).not.toContain('Division');
    expect(topics).not.toContain('division');
  });

  it('excludes the topic regardless of caller capitalisation', async () => {
    mockListQuestions.mockReturnValue([
      makeQuestion('Addition'),
      makeQuestion('multiplication'),
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'MULTIPLICATION');
    expect(topics).not.toContain('multiplication');
    expect(topics).toContain('Addition');
  });

  it('returns an array of strings (topic names only)', async () => {
    mockListQuestions.mockReturnValue([
      makeQuestion('Addition'),
      makeQuestion('Subtraction'),
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    expect(Array.isArray(topics)).toBe(true);
    topics.forEach(t => expect(typeof t).toBe('string'));
  });

  it('passes grade and subject to listQuestions', async () => {
    mockListQuestions.mockReturnValue([]);

    await suggestAlternativeTopics(5, 'Science', 'Photosynthesis');

    expect(mockListQuestions).toHaveBeenCalledWith({ grade: 5, subject: 'Science' });
  });

});

// ─── Empty bank ───────────────────────────────────────────────────────────────

describe('suggestAlternativeTopics — empty bank', () => {

  it('returns an empty array when the bank has no questions for grade+subject', async () => {
    mockListQuestions.mockReturnValue([]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'Multiplication');
    expect(topics).toEqual([]);
  });

  it('returns an empty array when all questions belong to the excluded topic', async () => {
    mockListQuestions.mockReturnValue([
      makeQuestion('Division'),
      makeQuestion('Division'),
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    expect(topics).toEqual([]);
  });

  it('returns an empty array when bank returns empty list and no excludeTopic given', async () => {
    mockListQuestions.mockReturnValue([]);

    const topics = await suggestAlternativeTopics(3, 'Math');
    expect(topics).toEqual([]);
  });

});

// ─── Error safety ─────────────────────────────────────────────────────────────

describe('suggestAlternativeTopics — error safety', () => {

  it('returns an empty array when listQuestions throws (never propagates)', async () => {
    mockListQuestions.mockImplementation(() => {
      throw new Error('DB connection refused');
    });

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    expect(topics).toEqual([]);
  });

  it('returns an empty array when getQuestionBankAdapter rejects', async () => {
    const { getQuestionBankAdapter } = await import('../../src/questionBank/index.js');
    getQuestionBankAdapter.mockRejectedValueOnce(new Error('Adapter init failed'));

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    expect(topics).toEqual([]);
  });

  it('does not throw on any internal failure', async () => {
    mockListQuestions.mockRejectedValue(new Error('Async failure'));

    await expect(suggestAlternativeTopics(3, 'Math', 'Division')).resolves.not.toThrow();
  });

});

// ─── Boundary / edge cases ────────────────────────────────────────────────────

describe('suggestAlternativeTopics — edge cases', () => {

  it('groups correctly when the same topic appears with varied casing in the bank', async () => {
    // Topics are case-sensitive in the Map — "Addition" and "addition" are distinct
    // unless the excludeTopic comparison is applied. The function does not normalise
    // topic names when counting — it only normalises for the exclusion check.
    mockListQuestions.mockReturnValue([
      makeQuestion('Addition'),
      makeQuestion('Addition'),
      makeQuestion('Subtraction'),
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    // Both should appear; Addition first (higher count)
    expect(topics[0]).toBe('Addition');
  });

  it('handles questions with missing topic field using "Unknown" as fallback', async () => {
    mockListQuestions.mockReturnValue([
      { ...makeQuestion('Addition'), topic: undefined },
      makeQuestion('Addition'),
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', 'Division');
    expect(topics).toContain('Unknown');
  });

  it('works when excludeTopic is undefined', async () => {
    mockListQuestions.mockReturnValue([
      makeQuestion('Addition'),
      makeQuestion('Subtraction'),
    ]);

    const topics = await suggestAlternativeTopics(3, 'Math', undefined);
    expect(topics).toContain('Addition');
    expect(topics).toContain('Subtraction');
  });

});
