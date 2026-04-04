/**
 * @file src/admin/coppaDeleter.js
 * @description Ordered COPPA deletion pipeline.
 * ComplianceLog MUST be written by caller before invoking this.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { updateComplianceLog } from './complianceLogger.js';

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

let _cognitoClient = null;
function getCognitoClient() {
  if (!_cognitoClient) {
    _cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return _cognitoClient;
}

// Table name helpers
const getTableName = (envVar, suffix) =>
  process.env[envVar] || `Learnfyra${suffix}-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;

/**
 * Deletes all items matching a query from a table.
 * @returns {number} Count of deleted items
 */
async function deleteAllMatching(tableName, keyCondition, expressionValues, pkAttr, skAttr) {
  const client = getDocClient();
  let count = 0;
  let lastKey;

  do {
    const result = await client.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ExclusiveStartKey: lastKey,
      ProjectionExpression: `${pkAttr}${skAttr ? `, ${skAttr}` : ''}`,
    }));

    for (const item of (result.Items || [])) {
      const key = { [pkAttr]: item[pkAttr] };
      if (skAttr && item[skAttr]) key[skAttr] = item[skAttr];
      await client.send(new DeleteCommand({ TableName: tableName, Key: key }));
      count++;
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return count;
}

/**
 * Executes COPPA deletion in strict order.
 *
 * @param {string} targetUserId - User to delete
 * @param {string} requestId - ComplianceLog requestId (already written by caller)
 * @param {string} [cognitoUsername] - Cognito username for account deletion
 * @returns {Promise<{status: string, deletedEntities: Array, errorState: Object|null}>}
 */
export async function executeCoppaDeletion(targetUserId, requestId, cognitoUsername) {
  const deletedEntities = [];
  const client = getDocClient();

  const steps = [
    {
      name: 'WorksheetAttempt',
      execute: async () => {
        const tableName = getTableName('ATTEMPTS_TABLE_NAME', 'Attempts');
        // Scan and filter by userId (no GSI available for userId on attempts)
        let count = 0;
        let lastKey;
        do {
          const result = await client.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': targetUserId },
            ExclusiveStartKey: lastKey,
            ProjectionExpression: 'attemptId',
          }));
          for (const item of (result.Items || [])) {
            await client.send(new DeleteCommand({
              TableName: tableName,
              Key: { attemptId: item.attemptId },
            }));
            count++;
          }
          lastKey = result.LastEvaluatedKey;
        } while (lastKey);
        return count;
      },
    },
    {
      name: 'UserProgress',
      execute: async () => {
        const tableName = getTableName('AGGREGATES_TABLE_NAME', 'Aggregates');
        let count = 0;
        let lastKey;
        do {
          const result = await client.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: 'contains(id, :uid)',
            ExpressionAttributeValues: { ':uid': targetUserId },
            ExclusiveStartKey: lastKey,
            ProjectionExpression: 'id',
          }));
          for (const item of (result.Items || [])) {
            await client.send(new DeleteCommand({
              TableName: tableName,
              Key: { id: item.id },
            }));
            count++;
          }
          lastKey = result.LastEvaluatedKey;
        } while (lastKey);
        return count;
      },
    },
    {
      name: 'ParentChildLink',
      execute: async () => {
        const tableName = getTableName('PARENT_LINKS_TABLE_NAME', 'ParentLinks');
        let count = 0;
        let lastKey;
        do {
          const result = await client.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: 'parentId = :uid OR childId = :uid',
            ExpressionAttributeValues: { ':uid': targetUserId },
            ExclusiveStartKey: lastKey,
            ProjectionExpression: 'id',
          }));
          for (const item of (result.Items || [])) {
            await client.send(new DeleteCommand({
              TableName: tableName,
              Key: { id: item.id },
            }));
            count++;
          }
          lastKey = result.LastEvaluatedKey;
        } while (lastKey);
        return count;
      },
    },
    {
      name: 'StudentAssignmentStatus',
      execute: async () => {
        // StudentAssignmentStatus not yet a separate table — skip gracefully
        return 0;
      },
    },
    {
      name: 'SchoolUserLink',
      execute: async () => {
        const tableName = getTableName('SCHOOL_USER_LINK_TABLE_NAME', 'SchoolUserLink');
        let count = 0;
        let lastKey;
        do {
          const result = await client.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': targetUserId },
            ExclusiveStartKey: lastKey,
            ProjectionExpression: 'PK, SK',
          }));
          for (const item of (result.Items || [])) {
            await client.send(new UpdateCommand({
              TableName: tableName,
              Key: { PK: item.PK, SK: item.SK },
              UpdateExpression: 'SET #s = :removed',
              ExpressionAttributeNames: { '#s': 'status' },
              ExpressionAttributeValues: { ':removed': 'removed' },
            }));
            count++;
          }
          lastKey = result.LastEvaluatedKey;
        } while (lastKey);
        return count;
      },
    },
    {
      name: 'UserRecord',
      execute: async () => {
        const tableName = getTableName('USERS_TABLE_NAME', 'Users');
        await client.send(new DeleteCommand({
          TableName: tableName,
          Key: { userId: targetUserId },
        }));
        return 1;
      },
    },
    {
      name: 'CognitoAccount',
      execute: async () => {
        if (!cognitoUsername || !process.env.COGNITO_USER_POOL_ID) {
          return 0; // Skip if no Cognito config (local dev)
        }
        await getCognitoClient().send(new AdminDeleteUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: cognitoUsername,
        }));
        return 1;
      },
    },
  ];

  for (const step of steps) {
    try {
      const count = await step.execute();
      deletedEntities.push({ entityType: step.name, count });
    } catch (err) {
      const errorState = {
        failedStep: step.name,
        errorMessage: err.message,
        countAtFailure: deletedEntities.reduce((sum, e) => sum + e.count, 0),
      };
      await updateComplianceLog(requestId, {
        status: 'partial-failure',
        deletedEntities,
        errorState,
      });
      return { status: 'partial-failure', deletedEntities, errorState };
    }
  }

  await updateComplianceLog(requestId, {
    status: 'completed',
    deletedEntities,
  });

  return { status: 'completed', deletedEntities, errorState: null };
}
