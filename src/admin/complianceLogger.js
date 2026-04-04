/**
 * @file src/admin/complianceLogger.js
 * @description ComplianceLog writer for COPPA deletion tracking.
 * Unlike auditLogger, this DOES throw on failure — deletion must abort
 * if the compliance record cannot be written.
 */

import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

let _docClient = null;
function getDocClient() {
  if (!_docClient) {
    const config = { region: process.env.AWS_REGION || 'us-east-1' };
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (endpoint) {
      config.endpoint = endpoint;
      config.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
    }
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

function getTableName() {
  return process.env.COMPLIANCE_LOG_TABLE_NAME || `LearnfyraComplianceLog-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;
}

/**
 * Creates a ComplianceLog record BEFORE deletion begins.
 * THROWS on failure — caller must abort deletion if this fails.
 *
 * @param {Object} params
 * @param {string} params.requestedBy - super_admin userId
 * @param {string} params.targetUserId - Subject of deletion
 * @param {string} params.legalBasis - Legal justification text
 * @returns {Promise<string>} requestId
 * @throws {Error} If DynamoDB write fails
 */
export async function writeComplianceLog({ requestedBy, targetUserId, legalBasis }) {
  const requestId = randomUUID();

  await getDocClient().send(new PutCommand({
    TableName: getTableName(),
    Item: {
      PK: `COMPLIANCE#${requestId}`,
      SK: 'METADATA',
      requestId,
      requestType: 'coppa-deletion',
      requestedBy,
      targetUserId,
      startedAt: new Date().toISOString(),
      legalBasis,
      status: 'in-progress',
      completedAt: null,
      deletedEntities: null,
      errorState: null,
    },
  }));

  return requestId;
}

/**
 * Updates a ComplianceLog record on completion or failure.
 *
 * @param {string} requestId
 * @param {Object} update
 * @param {'completed'|'partial-failure'} update.status
 * @param {Array<{entityType: string, count: number}>} [update.deletedEntities]
 * @param {{failedStep: string, errorMessage: string, countAtFailure: number}} [update.errorState]
 */
export async function updateComplianceLog(requestId, { status, deletedEntities, errorState }) {
  const expressionParts = ['#st = :status', 'completedAt = :now'];
  const names = { '#st': 'status' };
  const values = { ':status': status, ':now': new Date().toISOString() };

  if (deletedEntities) {
    expressionParts.push('deletedEntities = :de');
    values[':de'] = deletedEntities;
  }
  if (errorState) {
    expressionParts.push('errorState = :es');
    values[':es'] = errorState;
  }

  try {
    await getDocClient().send(new UpdateCommand({
      TableName: getTableName(),
      Key: { PK: `COMPLIANCE#${requestId}`, SK: 'METADATA' },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  } catch (err) {
    console.error('updateComplianceLog failed:', err.message);
    // Non-fatal for the update (the initial write already succeeded)
  }
}
