/**
 * @file src/exporters/index.js
 * @description Orchestrates worksheet + answer key export across all formats
 * @agent DEV
 */

import { exportHTML } from './htmlExporter.js';
import { exportPDF } from './pdfExporter.js';
import { exportDOCX } from './docxExporter.js';
import { exportAnswerKey } from './answerKey.js';

/**
 * Exports the worksheet (and optionally answer key) in the requested format(s)
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options (format, outputDir, includeAnswerKey, etc.)
 * @returns {Promise<string[]>} Array of all generated file paths
 */
export async function exportWorksheet(worksheet, options) {
  const format = options.format;
  const paths = [];

  if (format === 'HTML' || format === 'All Three') {
    paths.push(await exportHTML(worksheet, options));
  }
  if (format === 'PDF' || format === 'All Three') {
    paths.push(await exportPDF(worksheet, options));
  }
  if (format === 'Word (.docx)' || format === 'All Three') {
    paths.push(await exportDOCX(worksheet, options));
  }

  if (options.includeAnswerKey) {
    const keyPaths = await exportAnswerKey(worksheet, options);
    paths.push(...keyPaths);
  }

  return paths;
}
