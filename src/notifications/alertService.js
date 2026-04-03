/**
 * @file src/notifications/alertService.js
 * @description Fire-and-forget SNS notification service for admin alerts.
 *
 * Publishes structured messages to an SNS topic when AI generation fails.
 * Admin(s) subscribe to the SNS topic via email, SMS, Slack webhook, etc.
 *
 * Non-blocking: errors are logged but NEVER propagated to the caller.
 * Called from generateHandler when fallback path is triggered.
 *
 * @agent DEV
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../utils/logger.js';
import { getConfig } from '../config/configAdapter.js';

// ---------------------------------------------------------------------------
// SNS client — lazy singleton (cold-start friendly)
// ---------------------------------------------------------------------------

let _snsClient = null;

function getSNSClient() {
  if (!_snsClient) {
    _snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return _snsClient;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a fallback alert to the admin SNS topic (async, fire-and-forget).
 *
 * This function kicks off the publish in the background and returns immediately.
 * It NEVER throws — all errors are logged and swallowed.
 *
 * @param {Object} context
 * @param {string} context.worksheetId  - UUID of the failed worksheet request
 * @param {number} context.grade
 * @param {string} context.subject
 * @param {string} context.topic
 * @param {string} context.difficulty
 * @param {'partial'|'none'} context.fallbackMode
 * @param {string} [context.aiError]    - Claude error message (sanitized)
 * @param {string} [context.requestId]  - Lambda/Express request ID
 * @returns {void} — fire-and-forget, does not return a promise to await
 */
export function sendFallbackAlert(context) {
  // Fire in background — don't await
  _publishAlert(context).catch(() => {
    // Swallow — _publishAlert already logs internally
  });
}

/**
 * Internal: performs the actual SNS publish.
 * Separated for testability — tests can await this directly.
 *
 * @param {Object} context - Same shape as sendFallbackAlert
 * @returns {Promise<void>}
 */
export async function _publishAlert(context) {
  try {
    // Step 1: Check if fallback alerts are enabled
    const enabled = await getConfig(
      'admin-fallback-alerts-enabled',
      'ADMIN_FALLBACK_ALERTS_ENABLED',
    );
    if (enabled !== 'true' && enabled !== true) {
      logger.debug('alertService: fallback alerts disabled via config');
      return;
    }

    // Step 2: Get SNS topic ARN from config table (or env var fallback)
    const topicArn = await getConfig(
      'admin-fallback-sns-topic-arn',
      'ADMIN_FALLBACK_SNS_TOPIC_ARN',
    );
    if (!topicArn) {
      logger.warn('alertService: no SNS topic ARN configured; skipping alert');
      return;
    }

    // Step 3: Build structured message
    const {
      worksheetId,
      grade,
      subject,
      topic,
      difficulty,
      fallbackMode,
      aiError,
      requestId,
    } = context;

    const timestamp = new Date().toISOString();
    const env = process.env.NODE_ENV || 'unknown';
    const modeLabel = fallbackMode === 'partial'
      ? 'PARTIAL (bank questions only)'
      : 'TOTAL (no questions available)';

    const message = [
      'Learnfyra — AI Generation Fallback Alert',
      '==========================================',
      '',
      `Timestamp  : ${timestamp}`,
      `Environment: ${env}`,
      `Request ID : ${requestId || 'N/A'}`,
      `Fallback   : ${modeLabel}`,
      '',
      'Worksheet Request:',
      `  Grade      : ${grade}`,
      `  Subject    : ${subject}`,
      `  Topic      : ${topic}`,
      `  Difficulty : ${difficulty}`,
      '',
      `AI Error: ${aiError ? aiError.slice(0, 300).replace(/\n/g, ' ') : 'N/A'}`,
      '',
      'This alert was generated automatically by the Learnfyra generate handler.',
    ].join('\n');

    // Step 4: Publish to SNS topic
    await getSNSClient().send(new PublishCommand({
      TopicArn: topicArn,
      Subject: `Learnfyra Alert: AI Generation Failed — ${subject}/${topic}`,
      Message: message,
      MessageAttributes: {
        fallbackMode: { DataType: 'String', StringValue: fallbackMode },
        grade:        { DataType: 'Number', StringValue: String(grade) },
        subject:      { DataType: 'String', StringValue: subject },
        environment:  { DataType: 'String', StringValue: env },
      },
    }));

    logger.info('alertService: fallback alert published to SNS', {
      worksheetId,
      topicArn,
      fallbackMode,
    });
  } catch (err) {
    // Log but NEVER throw — this must not block the handler
    logger.error('alertService: failed to publish fallback alert', {
      worksheetId: context.worksheetId,
      error: { name: err.name, message: err.message },
    });
  }
}
