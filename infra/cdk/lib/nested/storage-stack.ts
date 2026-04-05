/**
 * @file infra/cdk/lib/nested/storage-stack.ts
 * @description NestedStack: S3 buckets (worksheet + frontend) + all 24 DynamoDB tables
 *              + DynamoDB seed data (AwsCustomResource for config table).
 *              Estimated CloudFormation resources: ~60
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { BaseNestedStackProps, StorageOutputs } from '../types';

export interface StorageStackProps extends BaseNestedStackProps {}

export class StorageStack extends cdk.NestedStack {
  public readonly outputs: StorageOutputs;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { appEnv } = props;
    const isDev = appEnv === 'dev';
    const isProd = appEnv === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ── S3: Worksheet bucket (private) ────────────────────────────────────────
    const worksheetBucket = new s3.Bucket(this, 'WorksheetBucket', {
      bucketName: `learnfyra-${appEnv}-s3-worksheets`,
      removalPolicy,
      autoDeleteObjects: !isProd,
      versioned: isProd,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'expire-worksheets',
          prefix: 'worksheets/',
          expiration: cdk.Duration.days(7),
          enabled: true,
        },
      ],
    });

    // ── S3: Frontend bucket (private, accessed via CloudFront OAI) ───────────
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `learnfyra-${appEnv}-s3-frontend`,
      removalPolicy,
      autoDeleteObjects: !isProd,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // ── CloudFront OAI — created here so grantRead modifies THIS stack's
    //    bucket policy and never forces a Storage → Cdn cross-stack ref.
    //    CdnStack receives the OAI as a prop and uses it directly without
    //    calling grantRead again.
    const frontendOai = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
      comment: `OAI for learnfyra-${appEnv}-s3-frontend`,
    });
    frontendBucket.grantRead(frontendOai);

    // ── DynamoDB helper ───────────────────────────────────────────────────────
    const createTable = (
      tableId: string,
      tableName: string,
      partitionKeyName: string,
      options: {
        sortKeyName?: string;
        ttlAttribute?: string;
        gsis?: Array<{
          indexName: string;
          partitionKeyName: string;
          sortKeyName?: string;
          projectionType?: dynamodb.ProjectionType;
        }>;
      } = {}
    ) => {
      const table = new dynamodb.Table(this, tableId, {
        tableName,
        partitionKey: { name: partitionKeyName, type: dynamodb.AttributeType.STRING },
        ...(options.sortKeyName && {
          sortKey: { name: options.sortKeyName, type: dynamodb.AttributeType.STRING },
        }),
        ...(options.ttlAttribute && { timeToLiveAttribute: options.ttlAttribute }),
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecovery: !isDev,
        removalPolicy,
      });

      options.gsis?.forEach((gsi) => {
        table.addGlobalSecondaryIndex({
          indexName: gsi.indexName,
          partitionKey: { name: gsi.partitionKeyName, type: dynamodb.AttributeType.STRING },
          ...(gsi.sortKeyName && {
            sortKey: { name: gsi.sortKeyName, type: dynamodb.AttributeType.STRING },
          }),
          projectionType: gsi.projectionType ?? dynamodb.ProjectionType.ALL,
        });
      });

      return table;
    };

    // ── DynamoDB tables ───────────────────────────────────────────────────────

    const usersTable = createTable('UsersTable', `LearnfyraUsers-${appEnv}`, 'userId', {
      gsis: [{ indexName: 'email-index', partitionKeyName: 'email' }],
    });

    const attemptsTable = createTable('AttemptsTable', `LearnfyraAttempts-${appEnv}`, 'attemptId', {
      gsis: [
        { indexName: 'studentId-index', partitionKeyName: 'studentId' },
      ],
    });

    const aggregatesTable = createTable(
      'AggregatesTable',
      `LearnfyraAggregates-${appEnv}`,
      'id'
    );

    const certificatesTable = createTable(
      'CertificatesTable',
      `LearnfyraCertificates-${appEnv}`,
      'id',
      { gsis: [{ indexName: 'studentId-index', partitionKeyName: 'studentId' }] }
    );

    const rewardProfilesTable = createTable(
      'RewardProfilesTable',
      `LearnfyraRewardProfiles-${appEnv}`,
      'id'
    );

    const classesTable = createTable('ClassesTable', `LearnfyraClasses-${appEnv}`, 'classId', {
      gsis: [
        {
          indexName: 'inviteCode-index',
          partitionKeyName: 'inviteCode',
          projectionType: dynamodb.ProjectionType.KEYS_ONLY,
        },
      ],
    });

    const membershipsTable = createTable(
      'MembershipsTable',
      `LearnfyraMemberships-${appEnv}`,
      'id',
      {
        gsis: [
          { indexName: 'studentId-index', partitionKeyName: 'studentId' },
          { indexName: 'classId-index', partitionKeyName: 'classId' },
        ],
      }
    );

    const questionBankTable = createTable(
      'QuestionBankTable',
      `LearnfyraQuestionBank-${appEnv}`,
      'questionId',
      {
        gsis: [
          {
            indexName: 'GSI-1',
            partitionKeyName: 'lookupKey',
            sortKeyName: 'typeDifficulty',
            projectionType: dynamodb.ProjectionType.ALL,
          },
          {
            indexName: 'dedupeHash-index',
            partitionKeyName: 'dedupeHash',
            projectionType: dynamodb.ProjectionType.KEYS_ONLY,
          },
        ],
      }
    );

    const generationLogTable = createTable(
      'GenerationLogTable',
      `LearnfyraGenerationLog-${appEnv}`,
      'worksheetId'
    );

    const modelConfigTable = createTable(
      'ModelConfigTable',
      `LearnfyraModelConfig-${appEnv}`,
      'id'
    );

    const modelAuditLogTable = createTable(
      'ModelAuditLogTable',
      `LearnfyraModelAuditLog-${appEnv}`,
      'id'
    );

    const questionExposureHistoryTable = createTable(
      'QuestionExposureHistoryTable',
      `LearnfyraQuestionExposureHistory-${appEnv}`,
      'id'
    );

    const configTable = createTable('ConfigTable', `LearnfyraConfig-${appEnv}`, 'configKey');

    const passwordResetsTable = createTable(
      'PasswordResetsTable',
      `LearnfyraPasswordResets-${appEnv}`,
      'tokenId',
      { ttlAttribute: 'expiresAt' }
    );

    const parentLinksTable = createTable(
      'ParentLinksTable',
      `LearnfyraParentLinks-${appEnv}`,
      'id'
    );

    const adminPoliciesTable = createTable(
      'AdminPoliciesTable',
      `LearnfyraAdminPolicies-${appEnv}`,
      'id'
    );

    const adminAuditEventsTable = createTable(
      'AdminAuditEventsTable',
      `LearnfyraAdminAuditEvents-${appEnv}`,
      'id'
    );

    const adminIdempotencyTable = createTable(
      'AdminIdempotencyTable',
      `LearnfyraAdminIdempotency-${appEnv}`,
      'id',
      { ttlAttribute: 'expiresAt' }
    );

    const repeatCapOverridesTable = createTable(
      'RepeatCapOverridesTable',
      `LearnfyraRepeatCapOverrides-${appEnv}`,
      'id'
    );

    // PK: userId (S), SK: exposureKey (S) = "{grade}#{subject}#{topic}#{questionId}"
    const questionExposureTable = createTable(
      'QuestionExposureTable',
      `LearnfyraQuestionExposure-${appEnv}`,
      'userId',
      { sortKeyName: 'exposureKey' }
    );

    const worksheetsTable = createTable(
      'WorksheetsTable',
      `LearnfyraWorksheets-${appEnv}`,
      'worksheetId',
      {
        ttlAttribute: 'expiresAt',
        gsis: [
          {
            indexName: 'slug-index',
            partitionKeyName: 'slug',
            projectionType: dynamodb.ProjectionType.ALL,
          },
          {
            indexName: 'createdBy-index',
            partitionKeyName: 'createdBy',
            sortKeyName: 'createdAt',
            projectionType: dynamodb.ProjectionType.ALL,
          },
        ],
      }
    );

    const guestSessionsTable = createTable(
      'GuestSessionsTable',
      `LearnfyraGuestSessions-${appEnv}`,
      'PK',
      { ttlAttribute: 'ttl' }
    );

    const userQuestionHistoryTable = createTable(
      'UserQuestionHistoryTable',
      `LearnfyraUserQuestionHistory-${appEnv}`,
      'PK',
      { sortKeyName: 'SK', ttlAttribute: 'ttl' }
    );

    const feedbackTable = createTable(
      'FeedbackTable',
      `LearnfyraFeedback-${appEnv}`,
      'feedbackId',
      { gsis: [{ indexName: 'worksheetId-index', partitionKeyName: 'worksheetId' }] }
    );

    // ── DynamoDB seed: initial config entries ─────────────────────────────────
    const seedConfigRole = new iam.Role(this, 'SeedConfigRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBPut: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['dynamodb:PutItem'],
              resources: [configTable.tableArn],
            }),
          ],
        }),
      },
    });

    const seedTimestamp = '2026-04-04T00:00:00Z';

    new cr.AwsCustomResource(this, 'SeedGuardrailPolicy', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: configTable.tableName,
          Item: {
            configKey: { S: 'guardrail:policy' },
            value: {
              S: JSON.stringify({
                guardrailLevel: 'medium',
                retryLimit: 3,
                enableAwsComprehend: false,
                comprehToxicityThreshold: 0.75,
                validationFilters: ['profanity', 'sensitiveTopics'],
              }),
            },
            updatedAt: { S: seedTimestamp },
            updatedBy: { S: 'system' },
          },
          ConditionExpression: 'attribute_not_exists(configKey)',
        },
        physicalResourceId: cr.PhysicalResourceId.of(`seed-guardrail-policy-${appEnv}`),
      },
      role: seedConfigRole,
      logRetention: logs.RetentionDays.ONE_MONTH,
    }).node.addDependency(configTable);

    new cr.AwsCustomResource(this, 'SeedGuardrailMediumTemplate', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: configTable.tableName,
          Item: {
            configKey: { S: 'guardrail:medium:template' },
            value: {
              S: 'You are generating educational worksheets for Grade [grade] students (ages [age]). All content must be safe, factual, age-appropriate, and aligned with US educational standards. Avoid violence, politics, religion, mature themes, stereotypes, or culturally insensitive material.',
            },
            version: { N: '1' },
            updatedAt: { S: seedTimestamp },
            updatedBy: { S: 'system' },
          },
          ConditionExpression: 'attribute_not_exists(configKey)',
        },
        physicalResourceId: cr.PhysicalResourceId.of(`seed-guardrail-medium-template-${appEnv}`),
      },
      role: seedConfigRole,
      logRetention: logs.RetentionDays.ONE_MONTH,
    }).node.addDependency(configTable);

    new cr.AwsCustomResource(this, 'SeedGuardrailStrictTemplate', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: configTable.tableName,
          Item: {
            configKey: { S: 'guardrail:strict:template' },
            value: {
              S: 'You are generating educational worksheets for young students in Grade [grade] (ages [age]). Content MUST be completely safe and appropriate for children. Use only simple, positive, and encouraging language. Do NOT include any references to violence, conflict, politics, religion, death, illness, mature themes, stereotypes, or any potentially frightening or upsetting content. All examples must use age-appropriate scenarios (family, school, nature, animals, everyday activities).',
            },
            version: { N: '1' },
            updatedAt: { S: seedTimestamp },
            updatedBy: { S: 'system' },
          },
          ConditionExpression: 'attribute_not_exists(configKey)',
        },
        physicalResourceId: cr.PhysicalResourceId.of(`seed-guardrail-strict-template-${appEnv}`),
      },
      role: seedConfigRole,
      logRetention: logs.RetentionDays.ONE_MONTH,
    }).node.addDependency(configTable);

    new cr.AwsCustomResource(this, 'SeedRepeatCapGlobal', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: configTable.tableName,
          Item: {
            configKey: { S: 'repeatCap:global' },
            value: {
              S: JSON.stringify({
                value: 20,
                updatedAt: seedTimestamp,
                updatedBy: 'system',
              }),
            },
            updatedAt: { S: seedTimestamp },
            updatedBy: { S: 'system' },
          },
          ConditionExpression: 'attribute_not_exists(configKey)',
        },
        physicalResourceId: cr.PhysicalResourceId.of(`seed-repeat-cap-global-${appEnv}`),
      },
      role: seedConfigRole,
      logRetention: logs.RetentionDays.ONE_MONTH,
    }).node.addDependency(configTable);

    // ── Expose all outputs ────────────────────────────────────────────────────
    this.outputs = {
      worksheetBucket,
      frontendBucket,
      frontendOai,
      usersTable,
      attemptsTable,
      aggregatesTable,
      certificatesTable,
      rewardProfilesTable,
      classesTable,
      membershipsTable,
      questionBankTable,
      generationLogTable,
      modelConfigTable,
      modelAuditLogTable,
      questionExposureHistoryTable,
      configTable,
      passwordResetsTable,
      parentLinksTable,
      adminPoliciesTable,
      adminAuditEventsTable,
      adminIdempotencyTable,
      repeatCapOverridesTable,
      questionExposureTable,
      worksheetsTable,
      guestSessionsTable,
      userQuestionHistoryTable,
      feedbackTable,
    };
  }
}
