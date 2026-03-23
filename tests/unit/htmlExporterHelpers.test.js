/**
 * @file tests/unit/htmlExporterHelpers.test.js
 * @description Unit tests for the pure string-return HTML helpers
 *   getWorksheetHTML() and getAnswerKeyHTML() from htmlExporter.js.
 *   No mocks needed — these are pure functions with no file I/O.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { getWorksheetHTML, getAnswerKeyHTML } from '../../src/exporters/htmlExporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

describe('getWorksheetHTML()', () => {

  it('returns a string', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    expect(typeof result).toBe('string');
  });

  it('result contains <!DOCTYPE html>', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('result contains the worksheet title', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    expect(result).toContain(sampleWorksheet.title);
  });

  it('result contains question text from sampleWorksheet', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    // Question 1 text: "4 × 6 = ___"
    expect(result).toContain(sampleWorksheet.questions[0].question);
  });

  it('result contains the subject', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    expect(result).toContain(sampleWorksheet.subject);
  });

  it('result contains a <html> tag', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    expect(result.toLowerCase()).toContain('<html');
  });

  it('result contains multiple question items (worksheet has 10 questions)', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    // Each question should render some content — check a few question texts appear
    expect(result).toContain(sampleWorksheet.questions[4].question);
    expect(result).toContain(sampleWorksheet.questions[9].question);
  });

  it('returns a non-empty string with default options omitted', () => {
    const result = getWorksheetHTML(sampleWorksheet);
    expect(result.length).toBeGreaterThan(100);
  });

  it('result contains estimated time when present in worksheet', () => {
    const result = getWorksheetHTML(sampleWorksheet, {});
    expect(result).toContain(sampleWorksheet.estimatedTime);
  });

});

describe('getAnswerKeyHTML()', () => {

  it('returns a string', () => {
    const result = getAnswerKeyHTML(sampleWorksheet);
    expect(typeof result).toBe('string');
  });

  it('result contains <!DOCTYPE html>', () => {
    const result = getAnswerKeyHTML(sampleWorksheet);
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('result contains the first answer from sampleWorksheet', () => {
    const result = getAnswerKeyHTML(sampleWorksheet);
    // First question answer: "24"
    expect(result).toContain(sampleWorksheet.questions[0].answer);
  });

  it('result contains answers for multiple questions', () => {
    const result = getAnswerKeyHTML(sampleWorksheet);
    expect(result).toContain(sampleWorksheet.questions[1].answer); // "B. 56"
    expect(result).toContain(sampleWorksheet.questions[2].answer); // "True"
  });

  it('result contains a <html> tag', () => {
    const result = getAnswerKeyHTML(sampleWorksheet);
    expect(result.toLowerCase()).toContain('<html');
  });

  it('result contains the worksheet title', () => {
    const result = getAnswerKeyHTML(sampleWorksheet);
    expect(result).toContain(sampleWorksheet.title);
  });

  it('returns a non-empty string', () => {
    const result = getAnswerKeyHTML(sampleWorksheet);
    expect(result.length).toBeGreaterThan(100);
  });

});
