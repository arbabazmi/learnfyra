/**
 * @file src/cli/prompts.js
 * @description Inquirer interactive prompt definitions for worksheet generation
 * @agent DEV
 */

import inquirer from 'inquirer';
import { CURRICULUM } from '../ai/topics.js';
import { validateGrade, validateQuestionCount } from './validator.js';
import { generateWorksheet } from '../ai/generator.js';
import { exportWorksheet } from '../exporters/index.js';
import { logger } from '../utils/logger.js';

/**
 * Runs the full interactive CLI prompt sequence and triggers generation
 * @returns {Promise<void>}
 */
export async function runInteractiveCLI() {
  logger.banner();

  try {
    const { grade } = await inquirer.prompt([
      {
        type: 'list',
        name: 'grade',
        message: 'Select Grade:',
        choices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
    ]);

    const subjectChoices = Object.keys(CURRICULUM[grade]);
    const { subject } = await inquirer.prompt([
      {
        type: 'list',
        name: 'subject',
        message: 'Select Subject:',
        choices: subjectChoices,
      },
    ]);

    const topicChoices = CURRICULUM[grade][subject].topics;
    const { topic } = await inquirer.prompt([
      {
        type: 'list',
        name: 'topic',
        message: 'Select Topic:',
        choices: topicChoices,
      },
    ]);

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'difficulty',
        message: 'Difficulty Level:',
        choices: ['Easy', 'Medium', 'Hard', 'Mixed'],
      },
      {
        type: 'list',
        name: 'questionCount',
        message: 'Number of Questions:',
        choices: [5, 10, 15, 20, 25, 30],
      },
      {
        type: 'confirm',
        name: 'includeAnswerKey',
        message: 'Include Answer Key?',
        default: true,
      },
      {
        type: 'list',
        name: 'format',
        message: 'Output Format:',
        choices: ['PDF', 'Word (.docx)', 'HTML', 'All Three'],
      },
      {
        type: 'input',
        name: 'studentName',
        message: 'Student Name (optional, press Enter to skip):',
        default: '',
      },
      {
        type: 'input',
        name: 'outputDir',
        message: 'Output Directory:',
        default: process.env.DEFAULT_OUTPUT_DIR || './worksheets',
      },
    ]);

    const options = {
      grade,
      subject,
      topic,
      difficulty: answers.difficulty,
      questionCount: answers.questionCount,
      includeAnswerKey: answers.includeAnswerKey,
      format: answers.format,
      studentName: answers.studentName || null,
      outputDir: answers.outputDir,
    };

    logger.info(`\nGenerating Grade ${grade} ${subject} worksheet on "${topic}"...`);

    const worksheetData = await generateWorksheet(options);
    const outputPaths = await exportWorksheet(worksheetData, options);

    logger.success('\nWorksheet generated successfully!');
    outputPaths.forEach((p) => logger.info(`  → ${p}`));
  } catch (err) {
    logger.error(`Generation failed: ${err.message}`);
    process.exit(1);
  }
}
