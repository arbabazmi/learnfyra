/**
 * @file src/exporters/htmlExporter.js
 * @description Exports worksheet and answer key as self-contained HTML files
 * @agent DEV
 */

import { writeFileSync } from 'fs';
import { buildWorksheetHTML, buildAnswerKeyHTML } from '../templates/worksheet.html.js';
import { buildOutputPath } from '../utils/fileUtils.js';

/**
 * Exports the worksheet as an HTML file
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options (outputDir, studentName, etc.)
 * @returns {Promise<string>} Path to the generated HTML file
 */
export async function exportHTML(worksheet, options) {
  const html = buildWorksheetHTML(worksheet, options);
  const outputPath = buildOutputPath(options.outputDir, options, 'html');
  writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

/**
 * Exports the answer key as an HTML file
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options
 * @returns {Promise<string>} Path to the generated answer key HTML file
 */
export async function exportAnswerKeyHTML(worksheet, options) {
  const html = buildAnswerKeyHTML(worksheet);
  const outputPath = buildOutputPath(options.outputDir, options, 'html', 'ANSWER_KEY');
  writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}
