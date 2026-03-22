/**
 * @file tests/unit/generator.test.js
 * @description Unit tests for AI worksheet generator (Claude API + retryUtils mocked)
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

// Mock retryUtils to eliminate backoff delays in tests
jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: async (fn, opts = {}) => {
    const maxRetries = opts.maxRetries ?? 3;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries && opts.onRetry) opts.onRetry(attempt + 1, err);
      }
    }
    throw lastError;
  },
}));

// Mock the Anthropic client before importing generator
jest.unstable_mockModule('../../src/ai/client.js', () => ({
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
}));

const { generateWorksheet } = await import('../../src/ai/generator.js');
const { anthropic } = await import('../../src/ai/client.js');

const validOptions = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  questionCount: 10,
};

describe('generator', () => {

  describe('generateWorksheet()', () => {

    beforeEach(() => {
      jest.clearAllMocks();
      process.env.MAX_RETRIES = '3';
    });

    it('returns valid worksheet JSON for grade 3 math', async () => {
      anthropic.messages.create.mockResolvedValueOnce({
        content: [{ text: JSON.stringify(sampleWorksheet) }],
      });

      const result = await generateWorksheet(validOptions);

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('questions');
      expect(Array.isArray(result.questions)).toBe(true);
      expect(result.grade).toBe(3);
    });

    it('throws on invalid grade (0)', async () => {
      await expect(generateWorksheet({ ...validOptions, grade: 0 }))
        .rejects.toThrow('Grade must be between 1 and 10');
    });

    it('throws on invalid grade (11)', async () => {
      await expect(generateWorksheet({ ...validOptions, grade: 11 }))
        .rejects.toThrow('Grade must be between 1 and 10');
    });

    it('throws when Claude returns non-JSON', async () => {
      process.env.MAX_RETRIES = '0';
      anthropic.messages.create.mockResolvedValue({
        content: [{ text: 'Sorry, I cannot help with that.' }],
      });

      await expect(generateWorksheet(validOptions)).rejects.toThrow();
    });

    it('retries on failure and succeeds on second attempt', async () => {
      anthropic.messages.create
        .mockRejectedValueOnce(new Error('API timeout'))
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify(sampleWorksheet) }],
        });

      const result = await generateWorksheet(validOptions);

      expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('title');
    });

    it('throws after all retries are exhausted', async () => {
      process.env.MAX_RETRIES = '2';
      anthropic.messages.create.mockRejectedValue(new Error('API timeout'));

      await expect(generateWorksheet(validOptions)).rejects.toThrow('API timeout');
      expect(anthropic.messages.create).toHaveBeenCalledTimes(3); // 1 + 2 retries
    });

    it('throws when required fields are missing from response', async () => {
      process.env.MAX_RETRIES = '0';
      const incomplete = { title: 'Test', grade: 3 }; // missing questions, etc.
      anthropic.messages.create.mockResolvedValueOnce({
        content: [{ text: JSON.stringify(incomplete) }],
      });

      await expect(generateWorksheet(validOptions)).rejects.toThrow();
    });

    it('throws on invalid subject', async () => {
      await expect(generateWorksheet({ ...validOptions, subject: 'Art' }))
        .rejects.toThrow();
    });

  });

});
