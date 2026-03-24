/**
 * @file tests/integration/htmlExporter.test.js
 * @description Integration tests for HTML exporter — generates real files
 * @agent QA
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { exportHTML, exportAnswerKeyHTML } from '../../src/exporters/htmlExporter.js';

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
  studentName: 'Ava Johnson',
  worksheetDate: '2026-03-24',
  teacherName: 'Ms. Carter',
  period: '2nd',
  className: 'Algebra Readiness',
  outputDir: testOutputDir,
};

afterAll(() => {
  // Clean up all generated files
  generatedFiles.forEach((f) => { try { unlinkSync(f); } catch {} });
});

describe('htmlExporter', () => {

  it('creates a worksheet HTML file', async () => {
    const filePath = await exportHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
  });

  it('generated HTML file is non-empty', async () => {
    const filePath = await exportHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const content = readFileSync(filePath, 'utf-8');

    expect(content.length).toBeGreaterThan(0);
  });

  it('generated HTML has valid DOCTYPE and html structure', async () => {
    const filePath = await exportHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const content = readFileSync(filePath, 'utf-8');

    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<html');
    expect(content).toContain('</html>');
  });

  it('generated HTML contains print @media CSS', async () => {
    const filePath = await exportHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const content = readFileSync(filePath, 'utf-8');

    expect(content).toContain('@media print');
  });

  it('generated HTML contains all question numbers', async () => {
    const filePath = await exportHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const content = readFileSync(filePath, 'utf-8');

    sampleWorksheet.questions.forEach((q) => {
      expect(content).toContain(`${q.number}.`);
    });
  });

  it('generated HTML pre-fills optional student and class details', async () => {
    const filePath = await exportHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const content = readFileSync(filePath, 'utf-8');

    expect(content).toContain('Ava Johnson');
    expect(content).toContain('03/24/2026');
    expect(content).toContain('Ms. Carter');
    expect(content).toContain('2nd');
    expect(content).toContain('Algebra Readiness');
  });

  it('creates a separate answer key HTML file', async () => {
    const filePath = await exportAnswerKeyHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
    expect(filePath).toContain('ANSWER_KEY');
  });

  it('answer key HTML contains correct answers', async () => {
    const filePath = await exportAnswerKeyHTML(sampleWorksheet, options);
    generatedFiles.push(filePath);
    const content = readFileSync(filePath, 'utf-8');

    // Check that the first answer appears in the key
    expect(content).toContain(sampleWorksheet.questions[0].answer);
  });

  it('answer key file is a DIFFERENT file from the worksheet', async () => {
    const worksheetPath = await exportHTML(sampleWorksheet, options);
    const keyPath = await exportAnswerKeyHTML(sampleWorksheet, options);
    generatedFiles.push(worksheetPath, keyPath);

    expect(worksheetPath).not.toBe(keyPath);
  });

});
