/**
 * @file src/cli/batchRunner.js
 * @description Batch worksheet generation from a JSON config file
 * @agent DEV
 */

import { readFileSync } from 'fs';
import { generateWorksheet } from '../ai/generator.js';
import { exportWorksheet } from '../exporters/index.js';
import { validateWorksheetOptions } from './validator.js';
import { logger } from '../utils/logger.js';

/**
 * Runs batch worksheet generation from a JSON config file
 * @param {string} configPath - Path to the batch config JSON file
 * @returns {Promise<void>}
 */
export async function runBatch(configPath) {
  let config;

  try {
    const raw = readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to read batch config: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(config) || config.length === 0) {
    logger.error('Batch config must be a non-empty JSON array.');
    process.exit(1);
  }

  logger.info(`Starting batch generation: ${config.length} worksheet(s)\n`);

  for (let i = 0; i < config.length; i++) {
    const item = config[i];
    logger.info(`[${i + 1}/${config.length}] Grade ${item.grade} ${item.subject} — ${item.topic}`);

    try {
      const options = {
        grade: item.grade,
        subject: item.subject,
        topic: item.topic,
        difficulty: item.difficulty || 'Medium',
        questionCount: item.count || item.questionCount || 10,
        includeAnswerKey: item.includeAnswerKey !== false,
        format: item.format || process.env.DEFAULT_FORMAT || 'PDF',
        studentName: item.studentName || null,
        outputDir: item.outputDir || process.env.DEFAULT_OUTPUT_DIR || './worksheets',
      };

      validateWorksheetOptions(options);
      const worksheetData = await generateWorksheet(options);
      const outputPaths = await exportWorksheet(worksheetData, options);

      outputPaths.forEach((p) => logger.success(`  → ${p}`));
    } catch (err) {
      logger.error(`  Failed: ${err.message}`);
    }
  }

  logger.success('\nBatch generation complete.');
}
