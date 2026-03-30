/**
 * @file index.js
 * @description CLI entry point for Learnfyra worksheet generator
 * @agent DEV
 */

import 'dotenv/config';
import { runInteractiveCLI } from './src/cli/prompts.js';
import { runBatch } from './src/cli/batchRunner.js';
import { logger } from './src/utils/logger.js';

const args = process.argv.slice(2);
const batchFlagIndex = args.indexOf('--batch');

if (!process.env.ANTHROPIC_API_KEY) {
  logger.error('Missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

if (batchFlagIndex !== -1) {
  const configPath = args[batchFlagIndex + 1];
  if (!configPath) {
    logger.error('Batch mode requires a config file path: node index.js --batch batch_config.json');
    process.exit(1);
  }
  runBatch(configPath);
} else {
  runInteractiveCLI();
}
