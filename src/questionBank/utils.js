/**
 * @file src/questionBank/utils.js
 * @description Shared utilities for the question bank layer.
 *
 * computeDedupeHash — canonical SHA-256 fingerprint used to detect duplicate
 * questions across all adapters (local in-memory and DynamoDB). Both adapters
 * must use this function so dedupe logic is consistent regardless of storage.
 */

import { createHash } from 'crypto';

/**
 * Computes a SHA-256 hex fingerprint for a question object.
 *
 * The hash input is the pipe-separated concatenation of:
 *   grade | subject (lowercased+trimmed) | topic (lowercased+trimmed) |
 *   type  (lowercased+trimmed) | question text (lowercased+trimmed)
 *
 * This means two questions that differ only in whitespace or letter case are
 * treated as duplicates — intentional to avoid near-duplicate bank entries.
 *
 * @param {{ grade: number|string, subject: string, topic: string, type: string, question: string }} question
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
export function computeDedupeHash(question) {
  const parts = [
    String(question.grade ?? ''),
    String(question.subject  ?? '').trim().toLowerCase(),
    String(question.topic    ?? '').trim().toLowerCase(),
    String(question.type     ?? '').trim().toLowerCase(),
    String(question.question ?? '').trim().toLowerCase(),
  ];

  return createHash('sha256').update(parts.join('|')).digest('hex');
}
