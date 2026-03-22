/**
 * @file src/exporters/answerKey.js
 * @description Orchestrates answer key export across all formats
 * @agent DEV
 */

import { exportAnswerKeyHTML } from './htmlExporter.js';
import { exportAnswerKeyPDF } from './pdfExporter.js';
import { exportAnswerKeyDOCX } from './docxExporter.js';

/**
 * Exports the answer key in the format(s) specified by options
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options (format, outputDir, etc.)
 * @returns {Promise<string[]>} Array of generated answer key file paths
 */
export async function exportAnswerKey(worksheet, options) {
  const format = options.format;
  const paths = [];

  if (format === 'HTML' || format === 'All Three') {
    paths.push(await exportAnswerKeyHTML(worksheet, options));
  }
  if (format === 'PDF' || format === 'All Three') {
    paths.push(await exportAnswerKeyPDF(worksheet, options));
  }
  if (format === 'Word (.docx)' || format === 'All Three') {
    paths.push(await exportAnswerKeyDOCX(worksheet, options));
  }

  return paths;
}
