/**
 * @file tests/integration/pdfExporter.test.js
 * @description Integration tests for PDF exporter — generates real files via Puppeteer
 * @agent QA
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { existsSync, statSync, unlinkSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { exportPDF, exportAnswerKeyPDF } from '../../src/exporters/pdfExporter.js';

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

describe('pdfExporter', () => {

  it('creates a worksheet PDF file', async () => {
    const filePath = await exportPDF(sampleWorksheet, options);
    generatedFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
  }, 30000); // Puppeteer can be slow

  it('worksheet PDF has non-zero size', async () => {
    const filePath = await exportPDF(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const stats = statSync(filePath);

    expect(stats.size).toBeGreaterThan(0);
  }, 30000);

  it('worksheet PDF has valid PDF magic bytes (%PDF-)', async () => {
    const filePath = await exportPDF(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const buffer = readFileSync(filePath);
    const header = buffer.slice(0, 5).toString('ascii');

    expect(header).toBe('%PDF-');
  }, 30000);

  it('creates a separate answer key PDF file', async () => {
    const filePath = await exportAnswerKeyPDF(sampleWorksheet, options);
    generatedFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
    expect(filePath).toContain('ANSWER_KEY');
  }, 30000);

  it('answer key PDF is a different file from the worksheet', async () => {
    const worksheetPath = await exportPDF(sampleWorksheet, options);
    const keyPath = await exportAnswerKeyPDF(sampleWorksheet, options);
    generatedFiles.push(worksheetPath, keyPath);

    expect(worksheetPath).not.toBe(keyPath);
  }, 60000);

});
