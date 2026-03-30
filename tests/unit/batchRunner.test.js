/**
 * @file tests/unit/batchRunner.test.js
 * @description Unit tests for the batch worksheet generation runner.
 * @agent QA
 */

import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filedirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__filedirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

// ─── Temp file registry ───────────────────────────────────────────────────────

const tempFiles = [];

function writeTempJSON(name, content) {
  const filePath = join(tmpdir(), `learnfyra-test-${name}-${Date.now()}.json`);
  writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content), 'utf-8');
  tempFiles.push(filePath);
  return filePath;
}

afterAll(() => {
  tempFiles.forEach(f => { try { if (existsSync(f)) unlinkSync(f); } catch (_) {} });
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/ai/generator.js', () => ({
  generateWorksheet: jest.fn().mockResolvedValue(sampleWorksheet),
}));

jest.unstable_mockModule('../../src/exporters/index.js', () => ({
  exportWorksheet: jest.fn().mockResolvedValue(['/tmp/out.html']),
}));

jest.unstable_mockModule('../../src/cli/validator.js', () => ({
  validateWorksheetOptions: jest.fn(),
  validateGrade:            jest.fn(),
  validateSubject:          jest.fn(),
  validateQuestionCount:    jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    info:    jest.fn(),
    success: jest.fn(),
    error:   jest.fn(),
    warn:    jest.fn(),
    debug:   jest.fn(),
    banner:  jest.fn(),
  },
}));

// Dynamic imports after all mockModule calls
const { runBatch }          = await import('../../src/cli/batchRunner.js');
const { generateWorksheet } = await import('../../src/ai/generator.js');
const { exportWorksheet }   = await import('../../src/exporters/index.js');
const { logger }            = await import('../../src/utils/logger.js');

// ─── Sample batch items ───────────────────────────────────────────────────────

const validItem = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  count: 10,
  format: 'HTML',
  outputDir: tmpdir(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runBatch()', () => {

  let exitMock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.exit to throw so we can catch it in tests
    exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterAll(() => {
    if (exitMock) exitMock.mockRestore();
  });

  // ── Valid config ──────────────────────────────────────────────────────────

  it('valid config with 1 item → calls generateWorksheet once', async () => {
    const configPath = writeTempJSON('single', [validItem]);
    await runBatch(configPath);
    expect(generateWorksheet).toHaveBeenCalledTimes(1);
  });

  it('valid config with 1 item → calls exportWorksheet once', async () => {
    const configPath = writeTempJSON('single2', [validItem]);
    await runBatch(configPath);
    expect(exportWorksheet).toHaveBeenCalledTimes(1);
  });

  it('valid config with 2 items → calls generateWorksheet twice', async () => {
    const configPath = writeTempJSON('double', [validItem, validItem]);
    await runBatch(configPath);
    expect(generateWorksheet).toHaveBeenCalledTimes(2);
  });

  it('valid config with 2 items → calls exportWorksheet twice', async () => {
    const configPath = writeTempJSON('double2', [validItem, validItem]);
    await runBatch(configPath);
    expect(exportWorksheet).toHaveBeenCalledTimes(2);
  });

  it('valid config → logs success after completion', async () => {
    const configPath = writeTempJSON('success-log', [validItem]);
    await runBatch(configPath);
    expect(logger.success).toHaveBeenCalled();
  });

  it('uses default format PDF when item has no format field', async () => {
    const itemNoFormat = { ...validItem };
    delete itemNoFormat.format;
    const configPath = writeTempJSON('no-format', [itemNoFormat]);
    await runBatch(configPath);
    const callArg = exportWorksheet.mock.calls[0][1];
    expect(['PDF', 'HTML']).toContain(callArg.format); // process.env.DEFAULT_FORMAT or 'PDF'
  });

  it('uses count field when questionCount is absent', async () => {
    const configPath = writeTempJSON('count-field', [{ ...validItem, count: 15 }]);
    await runBatch(configPath);
    const callArg = exportWorksheet.mock.calls[0][1];
    expect(callArg.questionCount).toBe(15);
  });

  // ── Error paths — process.exit(1) expected ───────────────────────────────

  it('non-existent file path → calls process.exit(1)', async () => {
    await expect(runBatch('/does/not/exist/config.json')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('non-existent file path → logs error before exiting', async () => {
    await expect(runBatch('/no/such/file.json')).rejects.toThrow('process.exit called');
    expect(logger.error).toHaveBeenCalled();
  });

  it('invalid JSON content → calls process.exit(1)', async () => {
    const configPath = writeTempJSON('bad-json', 'this is { not valid json');
    await expect(runBatch(configPath)).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('empty array in config → calls process.exit(1)', async () => {
    const configPath = writeTempJSON('empty-array', []);
    await expect(runBatch(configPath)).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('non-array JSON (object) → calls process.exit(1)', async () => {
    const configPath = writeTempJSON('not-array', { grade: 3, subject: 'Math' });
    await expect(runBatch(configPath)).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('non-array JSON (string) → calls process.exit(1)', async () => {
    const configPath = writeTempJSON('string-value', '"just a string"');
    await expect(runBatch(configPath)).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  // ── Item-level errors (continue, don't exit) ──────────────────────────────

  it('generateWorksheet rejects for one item → logs error but does not call process.exit', async () => {
    generateWorksheet.mockRejectedValueOnce(new Error('API down'));
    const configPath = writeTempJSON('gen-fail', [validItem]);
    await runBatch(configPath); // should not throw
    expect(logger.error).toHaveBeenCalled();
    expect(exitMock).not.toHaveBeenCalled();
  });

  it('generateWorksheet rejects for first item → still processes remaining items', async () => {
    generateWorksheet
      .mockRejectedValueOnce(new Error('first item fails'))
      .mockResolvedValueOnce(sampleWorksheet);

    const configPath = writeTempJSON('partial-fail', [validItem, validItem]);
    await runBatch(configPath);

    // second item should still call exportWorksheet
    expect(exportWorksheet).toHaveBeenCalledTimes(1);
  });

  it('exportWorksheet rejects → logs error but does not call process.exit', async () => {
    exportWorksheet.mockRejectedValueOnce(new Error('disk full'));
    const configPath = writeTempJSON('export-fail', [validItem]);
    await runBatch(configPath);
    expect(logger.error).toHaveBeenCalled();
    expect(exitMock).not.toHaveBeenCalled();
  });

});
