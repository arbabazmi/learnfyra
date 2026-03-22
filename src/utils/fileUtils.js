/**
 * @file src/utils/fileUtils.js
 * @description File system utilities: directory creation, filename sanitization
 * @agent DEV
 */

import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Ensures a directory exists, creating it recursively if needed
 * @param {string} dirPath - Directory path to ensure
 * @returns {string} The resolved directory path
 */
export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Builds a sanitized output filename following the project naming convention:
 * grade{n}_{subject}_{topic}_{difficulty}_{timestamp}.{ext}
 * @param {Object} options - Worksheet options
 * @param {number} options.grade - Grade level
 * @param {string} options.subject - Subject name
 * @param {string} options.topic - Topic name
 * @param {string} options.difficulty - Difficulty level
 * @param {string} ext - File extension (without dot)
 * @param {string} [suffix] - Optional suffix (e.g. 'ANSWER_KEY')
 * @returns {string} Sanitized filename
 */
export function buildFilename(options, ext, suffix = '') {
  const { grade, subject, topic, difficulty } = options;
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const parts = [
    `grade${grade}`,
    sanitizeSegment(subject),
    sanitizeSegment(topic),
    sanitizeSegment(difficulty),
    timestamp,
  ];

  if (suffix) parts.push(suffix);

  return `${parts.join('_')}.${ext}`;
}

/**
 * Builds the full output file path
 * @param {string} outputDir - Output directory
 * @param {Object} options - Worksheet options
 * @param {string} ext - File extension
 * @param {string} [suffix] - Optional suffix
 * @returns {string} Full file path
 */
export function buildOutputPath(outputDir, options, ext, suffix = '') {
  ensureDir(outputDir);
  return join(outputDir, buildFilename(options, ext, suffix));
}

/**
 * Sanitizes a filename segment: lowercase, spaces to underscores, removes special chars
 * @param {string} segment - Raw string segment
 * @returns {string} Sanitized segment
 */
export function sanitizeSegment(segment) {
  return segment
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
