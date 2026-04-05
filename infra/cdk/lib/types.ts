/**
 * @file infra/cdk/lib/types.ts
 * @description Shared interfaces and props for Learnfyra NestedStack refactor.
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as logs from 'aws-cdk-lib/aws-logs';

// ── Env / common ─────────────────────────────────────────────────────────────

export type AppEnv = 'dev' | 'staging' | 'prod';

export interface BaseNestedStackProps extends cdk.NestedStackProps {
  appEnv: AppEnv;
}

// ── StorageStack outputs ──────────────────────────────────────────────────────

export interface StorageOutputs {
  worksheetBucket: s3.Bucket;
  frontendBucket: s3.Bucket;
  // All 24 DynamoDB tables
  usersTable: dynamodb.Table;
  attemptsTable: dynamodb.Table;
  aggregatesTable: dynamodb.Table;
  certificatesTable: dynamodb.Table;
  rewardProfilesTable: dynamodb.Table;
  classesTable: dynamodb.Table;
  membershipsTable: dynamodb.Table;
  questionBankTable: dynamodb.Table;
  generationLogTable: dynamodb.Table;
  modelConfigTable: dynamodb.Table;
  modelAuditLogTable: dynamodb.Table;
  questionExposureHistoryTable: dynamodb.Table;
  configTable: dynamodb.Table;
  passwordResetsTable: dynamodb.Table;
  parentLinksTable: dynamodb.Table;
  adminPoliciesTable: dynamodb.Table;
  adminAuditEventsTable: dynamodb.Table;
  adminIdempotencyTable: dynamodb.Table;
  repeatCapOverridesTable: dynamodb.Table;
  questionExposureTable: dynamodb.Table;
  worksheetsTable: dynamodb.Table;
  guestSessionsTable: dynamodb.Table;
  userQuestionHistoryTable: dynamodb.Table;
  feedbackTable: dynamodb.Table;
}

// ── AuthStack outputs ─────────────────────────────────────────────────────────

export interface AuthOutputs {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  cognitoDomainUrl: string;
  jwtSecretValue: string;
}

// ── ComputeStack outputs ──────────────────────────────────────────────────────

export interface ComputeOutputs {
  generateFn: NodejsFunction;
  downloadFn: NodejsFunction;
  authFn: NodejsFunction;
  apiAuthorizerFn: NodejsFunction;
  solveFn: NodejsFunction;
  submitFn: NodejsFunction;
  progressFn: NodejsFunction;
  analyticsFn: NodejsFunction;
  classFn: NodejsFunction;
  rewardsFn: NodejsFunction;
  studentFn: NodejsFunction;
  adminFn: NodejsFunction;
  dashboardFn: NodejsFunction;
  certificatesFn: NodejsFunction;
  guestFixtureFn: NodejsFunction;
  adminPoliciesFn: NodejsFunction;
  feedbackFn: NodejsFunction;
}

// ── ApiStack outputs ─────────────────────────────────────────────────────────

export interface ApiOutputs {
  api: apigateway.RestApi;
  apiAccessLogGroup: logs.LogGroup;
}

// ── CdnStack outputs ──────────────────────────────────────────────────────────

export interface CdnOutputs {
  distribution: cloudfront.Distribution;
}

// ── MonitoringStack inputs ────────────────────────────────────────────────────

export interface MonitoredFunction {
  id: string;
  fn: NodejsFunction;
  p95MsThreshold: number;
}
