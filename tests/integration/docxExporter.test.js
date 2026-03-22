/**
 * @file tests/integration/docxExporter.test.js
 * @description Integration tests for DOCX exporter — generates real files
 * @agent QA
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { existsSync, statSync, unlinkSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { exportDOCX, exportAnswerKeyDOCX } from '../../src/exporters/docxExporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

const testOutputDir = join(__dirname, '../__tmp__');
const generatedFiles = [];

const options = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  outputDir: testOutputDir,
};

afterAll(() => {
  generatedFiles.forEach((f) => { try { unlinkSync(f); } catch {} });
});

describe('docxExporter', () => {

  it('creates a worksheet .docx file', async () => {
    const filePath = await exportDOCX(sampleWorksheet, options);
    generatedFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
  });

  it('worksheet .docx file has non-zero size', async () => {
    const filePath = await exportDOCX(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const stats = statSync(filePath);

    expect(stats.size).toBeGreaterThan(0);
  });

  it('worksheet .docx file has valid DOCX magic bytes (PK zip header)', async () => {
    const filePath = await exportDOCX(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const buffer = readFileSync(filePath);

    // DOCX files are ZIP archives — start with PK (0x50 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4B);
  });

  it('creates a separate answer key .docx file', async () => {
    const filePath = await exportAnswerKeyDOCX(sampleWorksheet, options);
    generatedFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
    expect(filePath).toContain('ANSWER_KEY');
  });

  it('answer key .docx is a different file from the worksheet', async () => {
    const worksheetPath = await exportDOCX(sampleWorksheet, options);
    const keyPath = await exportAnswerKeyDOCX(sampleWorksheet, options);
    generatedFiles.push(worksheetPath, keyPath);

    expect(worksheetPath).not.toBe(keyPath);
  });

});
