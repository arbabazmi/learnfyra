/**
 * @file src/exporters/htmlExporter.js
 * @description Exports worksheet and answer key as self-contained HTML files.
 *   String-return variants (getWorksheetHTML / getAnswerKeyHTML) are provided
 *   for unit testing without touching the filesystem.
 * @agent DEV
 */

import { writeFileSync } from 'fs';
import { buildWorksheetHTML, buildAnswerKeyHTML } from '../templates/worksheet.html.js';
import { buildOutputPath } from '../utils/fileUtils.js';

// ─── String-return helpers (no file I/O) ─────────────────────────────────────

/**
 * Returns the worksheet HTML string without writing any file.
 * Useful for testing and for embedding HTML in other contexts.
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} [options={}] - Optional metadata
 * @returns {string}
 */
export function getWorksheetHTML(worksheet, options = {}) {
  return buildWorksheetHTML(worksheet, options);
}

/**
 * Returns the answer key HTML string without writing any file.
 * @param {Object} worksheet - Parsed worksheet JSON
 * @returns {string}
 */
export function getAnswerKeyHTML(worksheet) {
  return buildAnswerKeyHTML(worksheet);
}

// ─── File writers ─────────────────────────────────────────────────────────────

/**
 * Exports the worksheet as a self-contained HTML file.
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options (outputDir, grade, subject, topic, difficulty)
 * @returns {Promise<string>} Absolute path to the generated HTML file
 * @throws {Error} If the output directory cannot be created or the file cannot be written
 */
export async function exportHTML(worksheet, options) {
  try {
    const html       = buildWorksheetHTML(worksheet, options);
    const outputPath = buildOutputPath(options.outputDir, options, 'html');
    writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
  } catch (err) {
    throw new Error(`HTML worksheet export failed: ${err.message}`);
  }
}

/**
 * Exports the answer key as a separate self-contained HTML file.
 * The filename includes the suffix "ANSWER_KEY" to distinguish it from the
 * student worksheet.
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options (outputDir, grade, subject, topic, difficulty)
 * @returns {Promise<string>} Absolute path to the generated answer key HTML file
 * @throws {Error} If the output directory cannot be created or the file cannot be written
 */
export async function exportAnswerKeyHTML(worksheet, options) {
  try {
    const html       = buildAnswerKeyHTML(worksheet);
    const outputPath = buildOutputPath(options.outputDir, options, 'html', 'ANSWER_KEY');
    writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
  } catch (err) {
    throw new Error(`HTML answer key export failed: ${err.message}`);
  }
}
