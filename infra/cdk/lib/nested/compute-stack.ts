/**
 * @file infra/cdk/lib/nested/compute-stack.ts
 * @description NestedStack: All 16 Lambda functions + IAM grants + environment variables.
 *              Estimated CloudFormation resources: ~145
 */

import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { existsSync } from 'fs';
import { BaseNestedStackProps, StorageOutputs, AuthOutputs, ComputeOutputs, ComputeFunctionArns } from '../types';

export interface ComputeStackProps extends BaseNestedStackProps {
  storage: StorageOutputs;
  auth: AuthOutputs;
  allowedOrigin: string;
  /**
   * OAUTH_CALLBACK_BASE_URL set here to avoid Compute → Cdn circular dependency.
   * The parent orchestrator computes the value statically (webDomainName when
   * custom domains are enabled, or '*' as a placeholder that CDN stack will
   * never introduce a back-reference to Compute).
   *
   * When custom domains are disabled the parent passes the CloudFront domain
   * using a concrete string only when it can be computed without referencing
   * CdnStack outputs — i.e. the parent uses webDomainName when available.
   * In practice: pass webDomainName-based URL when enableCustomDomains=true,
   * otherwise pass a '*' placeholder (authFn will fall back to ALLOWED_ORIGIN
   * at runtime for local redirect construction).
   */
  oauthCallbackBaseUrl: string;
}

function resolveHandlerEntry(handlerFile: string): string {
  const candidates = [
    // ts-node / source path: infra/cdk/lib/nested -> repo root via ../../../../../
    path.resolve(__dirname, '../../../../backend/handlers', handlerFile),
    // compiled test path: infra/cdk/dist/lib/nested -> repo root
    path.resolve(__dirname, '../../../../../backend/handlers', handlerFile),
    // when cwd is repository root
    path.resolve(process.cwd(), 'backend/handlers', handlerFile),
    // when cwd is infra/cdk
    path.resolve(process.cwd(), '../../backend/handlers', handlerFile),
  ];

  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new Error(`Cannot resolve handler entry for ${handlerFile}`);
  }
  return resolved;
}

export class ComputeStack extends cdk.NestedStack {
  public readonly outputs: ComputeOutputs;
  public readonly functionArns: ComputeFunctionArns;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { appEnv, storage, auth, allowedOrigin, oauthCallbackBaseUrl } = props;
    const isDev = appEnv === 'dev';
    const isProd = appEnv === 'prod';
    const tracingMode =
      isProd || appEnv === 'staging' ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED;

    const anthropicKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'AnthropicApiKey',
      { parameterName: `/learnfyra/${appEnv}/anthropic-api-key` }
    );

    // Shared esbuild bundling options — bundles handler + all src/ imports into
    // a single CJS file. @aws-sdk/* is excluded (provided by the Lambda runtime).
    const bundling = {
      format: OutputFormat.CJS,
      target: 'node20',
      externalModules: [
        '@aws-sdk/*',
        'typescript',
        'puppeteer',
        ...(process.env.NODE_ENV === 'test' ? ['puppeteer-core', '@sparticuz/chromium'] : []),
      ],
      ...(process.env.NODE_ENV !== 'test' && {
        nodeModules: ['puppeteer-core', '@sparticuz/chromium'],
      }),
      minify: true,
      sourceMap: false,
    };

    // ── Lambda functions ──────────────────────────────────────────────────────

    const generateFn = new NodejsFunction(this, 'GenerateFunction', {
      functionName: `learnfyra-${appEnv}-lambda-generate`,
      runtime: lambda.Runtime.NODEJS_20_X,
      // @sparticuz/chromium does not provide an ARM Lambda binary here, so
      // the PDF-generating function must run on x86_64 to execute Chromium in /tmp.
      architecture: lambda.Architecture.X86_64,
      entry: resolveHandlerEntry('generateHandler.js'),
      handler: 'handler',
      memorySize: isDev ? 512 : 1024,
      timeout: cdk.Duration.seconds(60),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: storage.worksheetBucket.bucketName,
        CLAUDE_MODEL: 'claude-sonnet-4-20250514',
        MOCK_AI: 'false',
        SSM_PARAM_NAME: `/learnfyra/${appEnv}/anthropic-api-key`,
        MAX_RETRIES: isProd ? '0' : '1',
        ANTHROPIC_REQUEST_TIMEOUT_MS: '22000',
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-generate — worksheet generation`,
    });

    storage.worksheetBucket.grantPut(generateFn);
    storage.worksheetBucket.grantRead(generateFn);
    anthropicKeyParam.grantRead(generateFn);

    const downloadFn = new NodejsFunction(this, 'DownloadFunction', {
      functionName: `learnfyra-${appEnv}-lambda-download`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('downloadHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: storage.worksheetBucket.bucketName,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-download — presigned URL generation`,
    });

    storage.worksheetBucket.grantRead(downloadFn);
    downloadFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [storage.worksheetBucket.arnForObjects('*')],
      })
    );

    const authFn = new NodejsFunction(this, 'AuthFunction', {
      functionName: `learnfyra-${appEnv}-lambda-auth`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('authHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-auth — auth route handler`,
    });

    const apiAuthorizerFn = new NodejsFunction(this, 'ApiAuthorizerFunction', {
      functionName: `learnfyra-${appEnv}-lambda-api-authorizer`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('apiAuthorizerHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-api-authorizer — API Gateway JWT authorizer`,
    });

    const solveFn = new NodejsFunction(this, 'SolveFunction', {
      functionName: `learnfyra-${appEnv}-lambda-solve`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('solveHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: storage.worksheetBucket.bucketName,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-solve — worksheet solve retrieval`,
    });

    const submitFn = new NodejsFunction(this, 'SubmitFunction', {
      functionName: `learnfyra-${appEnv}-lambda-submit`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('submitHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: storage.worksheetBucket.bucketName,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-submit — worksheet answer scoring`,
    });

    const progressFn = new NodejsFunction(this, 'ProgressFunction', {
      functionName: `learnfyra-${appEnv}-lambda-progress`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('progressHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-progress — student progress routes`,
    });

    const analyticsFn = new NodejsFunction(this, 'AnalyticsFunction', {
      functionName: `learnfyra-${appEnv}-lambda-analytics`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('analyticsHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-analytics — class analytics routes`,
    });

    const classFn = new NodejsFunction(this, 'ClassFunction', {
      functionName: `learnfyra-${appEnv}-lambda-class`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('classHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-class — class management routes`,
    });

    const rewardsFn = new NodejsFunction(this, 'RewardsFunction', {
      functionName: `learnfyra-${appEnv}-lambda-rewards`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('rewardsHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-rewards — student/class rewards routes`,
    });

    const studentFn = new NodejsFunction(this, 'StudentFunction', {
      functionName: `learnfyra-${appEnv}-lambda-student`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('studentHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-student — student profile and membership routes`,
    });

    const adminFn = new NodejsFunction(this, 'AdminFunction', {
      functionName: `learnfyra-${appEnv}-lambda-admin`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('questionBankHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-admin — admin question-bank routes`,
    });

    const dashboardFn = new NodejsFunction(this, 'DashboardFunction', {
      functionName: `learnfyra-${appEnv}-lambda-dashboard`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('dashboardHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-dashboard — dashboard stats, recent worksheets, subject progress`,
    });

    const certificatesFn = new NodejsFunction(this, 'CertificatesFunction', {
      functionName: `learnfyra-${appEnv}-lambda-certificates`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('certificatesHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-certificates — student certificate list and download`,
    });

    const guestFixtureFn = new NodejsFunction(this, 'GuestFixtureFunction', {
      functionName: `learnfyra-${appEnv}-lambda-guest-fixture`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('guestFixtureHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-guest-fixture — guest role preview fixtures`,
    });

    const adminPoliciesFn = new NodejsFunction(this, 'AdminPoliciesFunction', {
      functionName: `learnfyra-${appEnv}-lambda-admin-policies`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('adminHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling,
      environment: {
        NODE_ENV: appEnv,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-admin-policies — admin policies and audit events`,
    });

    const feedbackFn = new NodejsFunction(this, 'FeedbackFunction', {
      functionName: `learnfyra-${appEnv}-lambda-feedback`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: resolveHandlerEntry('feedbackHandler.js'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        FEEDBACK_TABLE_NAME: storage.feedbackTable.tableName,
      },
      logRetention: logs.RetentionDays.THREE_YEARS,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-feedback — user feedback collection`,
    });

    // ── S3 grants ─────────────────────────────────────────────────────────────

    storage.worksheetBucket.grantRead(solveFn);
    storage.worksheetBucket.grantRead(submitFn);

    // ── ALLOWED_ORIGIN on all functions ──────────────────────────────────────

    [
      generateFn,
      downloadFn,
      authFn,
      solveFn,
      submitFn,
      progressFn,
      analyticsFn,
      classFn,
      rewardsFn,
      studentFn,
      adminFn,
      dashboardFn,
      certificatesFn,
      adminPoliciesFn,
      guestFixtureFn,
      feedbackFn,
    ].forEach((fn) => {
      fn.addEnvironment('ALLOWED_ORIGIN', allowedOrigin);
    });

    // ── JWT_SECRET + AUTH_MODE on auth-protected functions ───────────────────

    [
      authFn,
      generateFn,
      progressFn,
      analyticsFn,
      classFn,
      rewardsFn,
      studentFn,
      dashboardFn,
      certificatesFn,
      adminPoliciesFn,
      adminFn,
    ].forEach((fn) => {
      fn.addEnvironment('JWT_SECRET', auth.jwtSecretValue);
      fn.addEnvironment('AUTH_MODE', 'hybrid');
    });

    // ── APP_RUNTIME / DYNAMO_ENV / DEBUG_MODE on DynamoDB-using functions ────

    [
      generateFn,
      authFn,
      solveFn,
      submitFn,
      progressFn,
      analyticsFn,
      classFn,
      rewardsFn,
      studentFn,
      adminFn,
      dashboardFn,
      certificatesFn,
      adminPoliciesFn,
      feedbackFn,
    ].forEach((fn) => {
      fn.addEnvironment('APP_RUNTIME', 'aws');
      fn.addEnvironment('DYNAMO_ENV', appEnv);
      if (isDev) fn.addEnvironment('DEBUG_MODE', 'true');
    });

    // ── Per-function table name env vars ──────────────────────────────────────

    authFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);
    authFn.addEnvironment('PWRESET_TABLE_NAME', storage.passwordResetsTable.tableName);
    authFn.addEnvironment('GUEST_SESSIONS_TABLE', storage.guestSessionsTable.tableName);

    const cookieDomains: Record<string, string> = {
      dev: '.dev.learnfyra.com',
      staging: '.qa.learnfyra.com',
      prod: '.learnfyra.com',
    };
    authFn.addEnvironment('COOKIE_DOMAIN', cookieDomains[appEnv] ?? 'localhost');

    generateFn.addEnvironment('MODEL_CONFIG_TABLE_NAME', storage.modelConfigTable.tableName);
    generateFn.addEnvironment('MODEL_AUDIT_LOG_TABLE_NAME', storage.modelAuditLogTable.tableName);
    generateFn.addEnvironment(
      'QUESTION_EXPOSURE_HISTORY_TABLE_NAME',
      storage.questionExposureHistoryTable.tableName
    );
    generateFn.addEnvironment('ADMIN_POLICIES_TABLE_NAME', storage.adminPoliciesTable.tableName);
    generateFn.addEnvironment(
      'REPEAT_CAP_OVERRIDES_TABLE_NAME',
      storage.repeatCapOverridesTable.tableName
    );
    generateFn.addEnvironment('WORKSHEETS_TABLE_NAME', storage.worksheetsTable.tableName);
    generateFn.addEnvironment('GUEST_SESSIONS_TABLE', storage.guestSessionsTable.tableName);
    generateFn.addEnvironment(
      'USER_QUESTION_HISTORY_TABLE',
      storage.userQuestionHistoryTable.tableName
    );

    solveFn.addEnvironment('WORKSHEETS_TABLE_NAME', storage.worksheetsTable.tableName);
    submitFn.addEnvironment('WORKSHEETS_TABLE_NAME', storage.worksheetsTable.tableName);

    progressFn.addEnvironment('WORKSHEETS_TABLE_NAME', storage.worksheetsTable.tableName);
    progressFn.addEnvironment(
      'USER_QUESTION_HISTORY_TABLE',
      storage.userQuestionHistoryTable.tableName
    );
    progressFn.addEnvironment('ATTEMPTS_TABLE_NAME', storage.attemptsTable.tableName);
    progressFn.addEnvironment('AGGREGATES_TABLE_NAME', storage.aggregatesTable.tableName);
    progressFn.addEnvironment('CERTIFICATES_TABLE_NAME', storage.certificatesTable.tableName);
    progressFn.addEnvironment('PARENT_LINKS_TABLE_NAME', storage.parentLinksTable.tableName);
    progressFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);

    analyticsFn.addEnvironment('ATTEMPTS_TABLE_NAME', storage.attemptsTable.tableName);
    analyticsFn.addEnvironment('AGGREGATES_TABLE_NAME', storage.aggregatesTable.tableName);
    analyticsFn.addEnvironment('CLASSES_TABLE_NAME', storage.classesTable.tableName);
    analyticsFn.addEnvironment('MEMBERSHIPS_TABLE_NAME', storage.membershipsTable.tableName);
    analyticsFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);

    classFn.addEnvironment('CLASSES_TABLE_NAME', storage.classesTable.tableName);
    classFn.addEnvironment('MEMBERSHIPS_TABLE_NAME', storage.membershipsTable.tableName);
    classFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);

    rewardsFn.addEnvironment('ATTEMPTS_TABLE_NAME', storage.attemptsTable.tableName);
    rewardsFn.addEnvironment('MEMBERSHIPS_TABLE_NAME', storage.membershipsTable.tableName);
    rewardsFn.addEnvironment('REWARD_PROFILES_TABLE_NAME', storage.rewardProfilesTable.tableName);
    rewardsFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);

    studentFn.addEnvironment('CLASSES_TABLE_NAME', storage.classesTable.tableName);
    studentFn.addEnvironment('MEMBERSHIPS_TABLE_NAME', storage.membershipsTable.tableName);
    studentFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);

    dashboardFn.addEnvironment('ATTEMPTS_TABLE_NAME', storage.attemptsTable.tableName);
    dashboardFn.addEnvironment('AGGREGATES_TABLE_NAME', storage.aggregatesTable.tableName);
    dashboardFn.addEnvironment('WORKSHEETS_TABLE_NAME', storage.worksheetsTable.tableName);

    adminFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);
    adminFn.addEnvironment('ATTEMPTS_TABLE_NAME', storage.attemptsTable.tableName);
    adminFn.addEnvironment('AGGREGATES_TABLE_NAME', storage.aggregatesTable.tableName);
    adminFn.addEnvironment('CERTIFICATES_TABLE_NAME', storage.certificatesTable.tableName);
    adminFn.addEnvironment('CLASSES_TABLE_NAME', storage.classesTable.tableName);
    adminFn.addEnvironment('MEMBERSHIPS_TABLE_NAME', storage.membershipsTable.tableName);
    adminFn.addEnvironment('GENLOG_TABLE_NAME', storage.generationLogTable.tableName);
    adminFn.addEnvironment('CONFIG_TABLE_NAME', storage.configTable.tableName);
    adminFn.addEnvironment('MODEL_CONFIG_TABLE_NAME', storage.modelConfigTable.tableName);
    adminFn.addEnvironment('MODEL_AUDIT_LOG_TABLE_NAME', storage.modelAuditLogTable.tableName);
    adminFn.addEnvironment(
      'QUESTION_EXPOSURE_HISTORY_TABLE_NAME',
      storage.questionExposureHistoryTable.tableName
    );
    adminFn.addEnvironment('REWARD_PROFILES_TABLE_NAME', storage.rewardProfilesTable.tableName);
    adminFn.addEnvironment('PARENT_LINKS_TABLE_NAME', storage.parentLinksTable.tableName);
    adminFn.addEnvironment('PWRESET_TABLE_NAME', storage.passwordResetsTable.tableName);
    adminFn.addEnvironment('ADMIN_POLICIES_TABLE_NAME', storage.adminPoliciesTable.tableName);
    adminFn.addEnvironment(
      'ADMIN_AUDIT_EVENTS_TABLE_NAME',
      storage.adminAuditEventsTable.tableName
    );
    adminFn.addEnvironment(
      'ADMIN_IDEMPOTENCY_TABLE_NAME',
      storage.adminIdempotencyTable.tableName
    );
    adminFn.addEnvironment(
      'REPEAT_CAP_OVERRIDES_TABLE_NAME',
      storage.repeatCapOverridesTable.tableName
    );
    // Guardrails and repeat-cap env vars (formerly on guardrailsAdminFn, now merged into adminFn)
    adminFn.addEnvironment('QUESTION_EXPOSURE_TABLE_NAME', storage.questionExposureTable.tableName);

    certificatesFn.addEnvironment('CERTIFICATES_TABLE_NAME', storage.certificatesTable.tableName);
    certificatesFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);

    adminPoliciesFn.addEnvironment('USERS_TABLE_NAME', storage.usersTable.tableName);
    adminPoliciesFn.addEnvironment('ADMIN_POLICIES_TABLE_NAME', storage.adminPoliciesTable.tableName);
    adminPoliciesFn.addEnvironment(
      'ADMIN_AUDIT_EVENTS_TABLE_NAME',
      storage.adminAuditEventsTable.tableName
    );
    adminPoliciesFn.addEnvironment(
      'ADMIN_IDEMPOTENCY_TABLE_NAME',
      storage.adminIdempotencyTable.tableName
    );
    adminPoliciesFn.addEnvironment('CONFIG_TABLE_NAME', storage.configTable.tableName);
    adminPoliciesFn.addEnvironment('MODEL_CONFIG_TABLE_NAME', storage.modelConfigTable.tableName);
    adminPoliciesFn.addEnvironment(
      'MODEL_AUDIT_LOG_TABLE_NAME',
      storage.modelAuditLogTable.tableName
    );
    adminPoliciesFn.addEnvironment(
      'REPEAT_CAP_OVERRIDES_TABLE_NAME',
      storage.repeatCapOverridesTable.tableName
    );

    apiAuthorizerFn.addEnvironment('JWT_SECRET', auth.jwtSecretValue);
    apiAuthorizerFn.addEnvironment('AUTH_MODE', 'cognito');

    // ── QB env vars on generate + admin functions ────────────────────────────

    [generateFn, adminFn].forEach((fn) => {
      fn.addEnvironment('QB_ADAPTER', 'dynamodb');
      fn.addEnvironment('DYNAMO_ENV', appEnv);
      fn.addEnvironment('QB_TABLE_NAME', `LearnfyraQuestionBank-${appEnv}`);
    });

    // ── Cognito env vars on authFn ───────────────────────────────────────────
    // OAUTH_CALLBACK_BASE_URL is set here using the value passed in from the
    // parent orchestrator. The parent computes it statically (webDomainName
    // when custom domains are on, '*' otherwise) so no Compute → Cdn ref forms.
    authFn.addEnvironment('COGNITO_USER_POOL_ID', auth.userPool.userPoolId);
    authFn.addEnvironment('COGNITO_APP_CLIENT_ID', auth.userPoolClient.userPoolClientId);
    authFn.addEnvironment('COGNITO_DOMAIN', auth.cognitoDomainUrl);
    authFn.addEnvironment('OAUTH_CALLBACK_BASE_URL', oauthCallbackBaseUrl);

    // ── dev: skip question bank lookup ───────────────────────────────────────

    if (appEnv === 'dev') {
      generateFn.addEnvironment('SKIP_BANK_LOOKUP', 'true');
    }

    // ── Per-function DynamoDB IAM (least privilege) ──────────────────────────

    const grantDynamo = (
      fn: NodejsFunction,
      tables: import('aws-cdk-lib/aws-dynamodb').Table[],
      actions: string[]
    ) => {
      const resources = tables.flatMap((t) => [t.tableArn, `${t.tableArn}/index/*`]);
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: actions.map((a) => `dynamodb:${a}`),
          resources,
        })
      );
    };

    const readWrite = ['GetItem', 'PutItem', 'UpdateItem', 'Query'];
    const readWriteDelete = ['GetItem', 'PutItem', 'UpdateItem', 'DeleteItem', 'Query'];
    const readOnly = ['GetItem', 'Query'];
    const fullAccess = [
      'GetItem',
      'PutItem',
      'UpdateItem',
      'DeleteItem',
      'Query',
      'Scan',
      'BatchGetItem',
      'BatchWriteItem',
    ];

    grantDynamo(generateFn, [
      storage.worksheetsTable,
      storage.modelConfigTable,
      storage.modelAuditLogTable,
      storage.questionExposureHistoryTable,
      storage.adminPoliciesTable,
      storage.repeatCapOverridesTable,
      storage.guestSessionsTable,
      storage.userQuestionHistoryTable,
      storage.questionBankTable,
    ], ['GetItem', 'PutItem', 'UpdateItem', 'Query', 'BatchGetItem', 'BatchWriteItem']);

    grantDynamo(authFn, [
      storage.usersTable,
      storage.passwordResetsTable,
      storage.guestSessionsTable,
    ], readWriteDelete);

    grantDynamo(solveFn, [storage.worksheetsTable], readOnly);

    grantDynamo(submitFn, [storage.worksheetsTable], readWrite);

    grantDynamo(progressFn, [
      storage.worksheetsTable,
      storage.userQuestionHistoryTable,
      storage.attemptsTable,
      storage.aggregatesTable,
      storage.certificatesTable,
      storage.parentLinksTable,
      storage.usersTable,
    ], readWrite);

    grantDynamo(analyticsFn, [
      storage.attemptsTable,
      storage.aggregatesTable,
      storage.classesTable,
      storage.membershipsTable,
      storage.usersTable,
    ], ['GetItem', 'Query', 'Scan']);

    grantDynamo(classFn, [
      storage.classesTable,
      storage.membershipsTable,
      storage.usersTable,
    ], readWriteDelete);

    grantDynamo(rewardsFn, [
      storage.attemptsTable,
      storage.membershipsTable,
      storage.rewardProfilesTable,
      storage.usersTable,
    ], readWrite);

    grantDynamo(studentFn, [
      storage.classesTable,
      storage.membershipsTable,
      storage.usersTable,
    ], readWriteDelete);

    grantDynamo(adminFn, [
      storage.usersTable,
      storage.attemptsTable,
      storage.aggregatesTable,
      storage.certificatesTable,
      storage.classesTable,
      storage.membershipsTable,
      storage.generationLogTable,
      storage.configTable,
      storage.modelConfigTable,
      storage.modelAuditLogTable,
      storage.questionExposureHistoryTable,
      storage.rewardProfilesTable,
      storage.parentLinksTable,
      storage.passwordResetsTable,
      storage.adminPoliciesTable,
      storage.adminAuditEventsTable,
      storage.adminIdempotencyTable,
      storage.repeatCapOverridesTable,
      storage.questionBankTable,
    ], fullAccess);

    grantDynamo(dashboardFn, [
      storage.attemptsTable,
      storage.aggregatesTable,
      storage.worksheetsTable,
    ], readOnly);

    grantDynamo(certificatesFn, [
      storage.certificatesTable,
      storage.usersTable,
    ], ['GetItem', 'PutItem', 'Query']);

    grantDynamo(adminPoliciesFn, [
      storage.usersTable,
      storage.adminPoliciesTable,
      storage.adminAuditEventsTable,
      storage.adminIdempotencyTable,
      storage.configTable,
      storage.modelConfigTable,
      storage.modelAuditLogTable,
      storage.repeatCapOverridesTable,
    ], ['GetItem', 'PutItem', 'UpdateItem', 'DeleteItem', 'Query', 'BatchGetItem', 'BatchWriteItem']);

    grantDynamo(feedbackFn, [storage.feedbackTable], ['GetItem', 'PutItem', 'Query']);

    // ── Expose outputs ────────────────────────────────────────────────────────

    this.outputs = {
      generateFn,
      downloadFn,
      authFn,
      apiAuthorizerFn,
      solveFn,
      submitFn,
      progressFn,
      analyticsFn,
      classFn,
      rewardsFn,
      studentFn,
      adminFn,
      dashboardFn,
      certificatesFn,
      guestFixtureFn,
      adminPoliciesFn,
      feedbackFn,
    };

    // ── Function ARNs as plain strings (no cross-stack CFn refs) ─────────────
    // ApiStack imports these via lambda.Function.fromFunctionArn() so that
    // Lambda::Permission resources land in ApiStack, not ComputeStack.
    // This breaks the Compute ↔ Api circular dependency.
    this.functionArns = {
      generateFnArn: generateFn.functionArn,
      downloadFnArn: downloadFn.functionArn,
      authFnArn: authFn.functionArn,
      apiAuthorizerFnArn: apiAuthorizerFn.functionArn,
      solveFnArn: solveFn.functionArn,
      submitFnArn: submitFn.functionArn,
      progressFnArn: progressFn.functionArn,
      analyticsFnArn: analyticsFn.functionArn,
      classFnArn: classFn.functionArn,
      rewardsFnArn: rewardsFn.functionArn,
      studentFnArn: studentFn.functionArn,
      adminFnArn: adminFn.functionArn,
      dashboardFnArn: dashboardFn.functionArn,
      certificatesFnArn: certificatesFn.functionArn,
      guestFixtureFnArn: guestFixtureFn.functionArn,
      adminPoliciesFnArn: adminPoliciesFn.functionArn,
      feedbackFnArn: feedbackFn.functionArn,
    };
  }
}
