/**
 * @file scripts/bootstrap-local-db.js
 * @description Creates all DynamoDB tables in dynamodb-local (Docker).
 *
 * Prerequisites:
 *   docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local
 *
 * Usage:
 *   node scripts/bootstrap-local-db.js
 *   node scripts/bootstrap-local-db.js --delete   (drops and recreates all tables)
 */

import { DynamoDBClient, CreateTableCommand, DeleteTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const ENV = 'local';

const client = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' }
});

const TABLE_DEFINITIONS = [
  {
    TableName: `LearnfyraUsers-${ENV}`,
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'email-index',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' }
    }],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraWorksheetAttempt-${ENV}`,
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'sortKey', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'sortKey', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraCertificates-${ENV}`,
    KeySchema: [{ AttributeName: 'certificateId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'certificateId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'userId-index',
      KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' }
    }],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraClasses-${ENV}`,
    KeySchema: [{ AttributeName: 'classId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'classId', AttributeType: 'S' },
      { AttributeName: 'teacherId', AttributeType: 'S' },
      { AttributeName: 'joinCode', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'teacherId-index',
        KeySchema: [{ AttributeName: 'teacherId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'joinCode-index',                  // ADR-014
        KeySchema: [{ AttributeName: 'joinCode', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'KEYS_ONLY' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraClassMemberships-${ENV}`,
    KeySchema: [
      { AttributeName: 'classId', KeyType: 'HASH' },
      { AttributeName: 'studentId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'classId', AttributeType: 'S' },
      { AttributeName: 'studentId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'studentId-index',
      KeySchema: [{ AttributeName: 'studentId', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' }
    }],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraQuestionBank-${ENV}`,
    KeySchema: [{ AttributeName: 'questionId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'questionId', AttributeType: 'S' },
      { AttributeName: 'lookupKey', AttributeType: 'S' },
      { AttributeName: 'typeDifficulty', AttributeType: 'S' },
      { AttributeName: 'dedupeHash', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI-1',
        KeySchema: [
          { AttributeName: 'lookupKey', KeyType: 'HASH' },
          { AttributeName: 'typeDifficulty', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'dedupeHash-index',                // ADR-011
        KeySchema: [{ AttributeName: 'dedupeHash', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'KEYS_ONLY' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraGenerationLog-${ENV}`,
    KeySchema: [{ AttributeName: 'worksheetId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'worksheetId', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraConfig-${ENV}`,
    KeySchema: [{ AttributeName: 'configKey', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'configKey', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: `LearnfyraPasswordResets-${ENV}`,
    KeySchema: [{ AttributeName: 'tokenId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'tokenId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'email-index',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' }
    }],
    BillingMode: 'PAY_PER_REQUEST'
  }
];

async function dropAll(existing) {
  for (const name of existing) {
    await client.send(new DeleteTableCommand({ TableName: name }));
    console.log(`  dropped: ${name}`);
  }
}

async function createAll() {
  for (const def of TABLE_DEFINITIONS) {
    try {
      await client.send(new CreateTableCommand(def));
      console.log(`  created: ${def.TableName}`);
    } catch (e) {
      if (e.name === 'ResourceInUseException') {
        console.log(`  exists:  ${def.TableName} (skipped)`);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  const deleteFirst = process.argv.includes('--delete');

  console.log(`Connecting to DynamoDB local at ${ENDPOINT} ...`);
  try {
    const { TableNames } = await client.send(new ListTablesCommand({}));
    console.log(`Found ${TableNames.length} existing tables.`);

    if (deleteFirst && TableNames.length > 0) {
      console.log('Dropping all existing tables...');
      await dropAll(TableNames);
    }

    console.log('Creating tables...');
    await createAll();
    console.log('\n✓ Bootstrap complete. Tables ready for local development.');
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.message?.includes('ECONNREFUSED')) {
      console.error('\n✗ Could not connect to DynamoDB local.');
      console.error('  Run: docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local');
    } else {
      console.error('\n✗ Bootstrap failed:', e.message);
    }
    process.exit(1);
  }
}

main();
