/**
 * @file tests/unit/aiDisclosure.test.js
 * @description Ensures generator output includes AI disclosure metadata.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: async (fn) => fn(),
}));

jest.unstable_mockModule('../../src/ai/client.js', () => ({
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 8192,
}));

const { generateWorksheet } = await import('../../src/ai/generator.js');
const { anthropic } = await import('../../src/ai/client.js');

function mockResponse(obj) {
  return { content: [{ text: JSON.stringify(obj) }], stop_reason: 'end_turn' };
}

describe('generateWorksheet() aiDisclosure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.QB_ADAPTER;
  });

  it('adds an aiDisclosure object to the generated worksheet payload', async () => {
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(sampleWorksheet));

    const result = await generateWorksheet({
      grade: 3,
      subject: 'Math',
      topic: 'Multiplication Facts (1–10)',
      difficulty: 'Medium',
      questionCount: 10,
    });

    expect(result).toHaveProperty('aiDisclosure');
    expect(result.aiDisclosure).toEqual(expect.objectContaining({
      generated: true,
      provider: 'Anthropic',
    }));
    expect(result.aiDisclosure.label).toMatch(/AI assistance/i);
  });
});
