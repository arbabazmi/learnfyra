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
    // M05: Updated to use composite PK/SK (PK=CLASS#{classId}, SK=METADATA),
    // TeacherIndex (GSI-1), and InviteCodeIndex (GSI-2) per Section 2.1.
    TableName: `LearnfyraClasses-${ENV}`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'teacherId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'inviteCode', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TeacherIndex',
        KeySchema: [
          { AttributeName: 'teacherId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'InviteCodeIndex',
        KeySchema: [{ AttributeName: 'inviteCode', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' }
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
  },

  // ─── M05: Teacher & Parent Roles ─────────────────────────────────────────

  {
    // Assignments: PK=ASSIGNMENT#{assignmentId}, SK=METADATA
    // GSI-1 ClassIndex: query assignments by class, sorted newest-first.
    // GSI-2 ClassDueDateIndex: query assignments by class, sorted by due date.
    TableName: `LearnfyraAssignments-${ENV}`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'classId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'dueDate', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ClassIndex',
        KeySchema: [
          { AttributeName: 'classId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'ClassDueDateIndex',
        KeySchema: [
          { AttributeName: 'classId', KeyType: 'HASH' },
          { AttributeName: 'dueDate', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },

  {
    // StudentAssignmentStatus: PK=ASSIGNMENT#{assignmentId}, SK=STUDENT#{studentId}
    // GSI-1 StudentIndex: query all assignments for a student.
    // GSI-2 ClassAssignmentIndex: query all student statuses per class for analytics.
    TableName: `LearnfyraStudentAssignmentStatus-${ENV}`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'studentId', AttributeType: 'S' },
      { AttributeName: 'classId', AttributeType: 'S' },
      { AttributeName: 'assignmentId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'StudentIndex',
        KeySchema: [
          { AttributeName: 'studentId', KeyType: 'HASH' },
          { AttributeName: 'assignmentId', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'ClassAssignmentIndex',
        KeySchema: [
          { AttributeName: 'classId', KeyType: 'HASH' },
          { AttributeName: 'assignmentId', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },

  {
    // ParentChildLinks: PK=USER#{parentId}, SK=CHILD#{childId}
    // GSI-1 ChildToParentIndex (InvertedIndex): find all parents linked to a child.
    // childPK and parentSK are denormalized attributes stored on the record for GSI use.
    TableName: `LearnfyraParentChildLinks-${ENV}`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'childPK', AttributeType: 'S' },
      { AttributeName: 'parentSK', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ChildToParentIndex',
        KeySchema: [
          { AttributeName: 'childPK', KeyType: 'HASH' },
          { AttributeName: 'parentSK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },

  {
    // ParentInviteCodes: PK=INVITE#{code}, SK=METADATA
    // No GSIs — all access is by exact PK lookup.
    // TTL attribute 'ttl' (Unix epoch) enables automatic expiry cleanup via DynamoDB TTL.
    TableName: `LearnfyraParentInviteCodes-${ENV}`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' }
    ],
    TimeToLiveSpecification: {
      AttributeName: 'ttl',
      Enabled: true
    },
    BillingMode: 'PAY_PER_REQUEST'
  },

  {
    // ReviewQueueItems: PK=REVIEW#{reviewId}, SK=METADATA
    // GSI-1 ClassPendingIndex: query all review items for a class sorted by createdAt.
    // Handler filters on status = "pending" after the GSI query.
    TableName: `LearnfyraReviewQueueItems-${ENV}`,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'classId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ClassPendingIndex',
        KeySchema: [
          { AttributeName: 'classId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },

  // ─── COPPA Consent Records ────────────────────────────────────────────────
  {
    // ConsentRecords: PK=consentId (UUID)
    // GSI-1 ChildIndex:  query all consent records for a child user (childUserId → requestedAt).
    // GSI-2 ParentIndex: query all consent records by parent email (parentEmail → requestedAt).
    // GSI-3 TokenIndex:  look up a record by the one-time consentToken sent in the parent email.
    // TTL attribute 'expiresAt' (Unix epoch) enables automatic expiry of pending records (48 h).
    // retainUntil (Unix epoch) marks the 3-year audit retention boundary — not used as a TTL.
    TableName: `LearnfyraConsentRecords-${ENV}`,
    KeySchema: [{ AttributeName: 'consentId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'consentId',   AttributeType: 'S' },
      { AttributeName: 'childUserId', AttributeType: 'S' },
      { AttributeName: 'parentEmail', AttributeType: 'S' },
      { AttributeName: 'consentToken', AttributeType: 'S' },
      { AttributeName: 'requestedAt', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ChildIndex',
        KeySchema: [
          { AttributeName: 'childUserId', KeyType: 'HASH' },
          { AttributeName: 'requestedAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'ParentIndex',
        KeySchema: [
          { AttributeName: 'parentEmail', KeyType: 'HASH' },
          { AttributeName: 'requestedAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      },
      {
        IndexName: 'TokenIndex',
        KeySchema: [{ AttributeName: 'consentToken', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    TimeToLiveSpecification: {
      AttributeName: 'expiresAt',
      Enabled: true
    },
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
