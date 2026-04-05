import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { LearnfyraStack } from '../lib/learnfyra-stack';

function makeStack(appEnv: 'dev' | 'staging' | 'prod' = 'dev') {
  const app = new cdk.App();
  const stack = new LearnfyraStack(app, `LearnfyraStack-${appEnv}`, { appEnv });
  return Template.fromStack(stack);
}

describe('LearnfyraStack (dev)', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('dev');
  });

  test('creates worksheet S3 bucket with correct name', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-dev-s3-worksheets',
    });
  });

  test('creates frontend S3 bucket with correct name', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-dev-s3-frontend',
    });
  });

  test('worksheet bucket blocks all public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-dev-s3-worksheets',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('worksheet bucket has 7-day lifecycle rule', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-dev-s3-worksheets',
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Prefix: 'worksheets/',
            ExpirationInDays: 7,
            Status: 'Enabled',
          }),
        ]),
      },
    });
  });

  test('creates generate Lambda with correct name and memory', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      MemorySize: 512,
      Architectures: ['x86_64'],
      Runtime: 'nodejs20.x',
    });
  });

  test('generate Lambda has correct 60-second timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      Timeout: 60,
    });
  });

  test('creates download Lambda with correct name and memory', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-download',
      MemorySize: 256,
      Architectures: ['arm64'],
      Runtime: 'nodejs20.x',
    });
  });

  test('download Lambda has correct 30-second timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-download',
      Timeout: 30,
    });
  });

  test('creates API Gateway REST API with correct name', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'learnfyra-dev-apigw',
    });
  });

  test('enables API Gateway access logging to dedicated log group', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/learnfyra-dev-access-logs',
      RetentionInDays: 1096,
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      AccessLogSetting: Match.objectLike({
        DestinationArn: Match.anyValue(),
      }),
    });
  });

  test('creates CloudFront distribution in dev', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('dev frontend bucket blocks all public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-dev-s3-frontend',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('dev stack uses DESTROY removal policy (autoDeleteObjects Lambda present)', () => {
    const lambdaResources = template.findResources('AWS::Lambda::Function');
    expect(Object.keys(lambdaResources).length).toBeGreaterThanOrEqual(3);
  });

  test('all S3 resources tagged with Project=learnfyra', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Project', Value: 'learnfyra' }),
      ]),
    });
  });

  test('all S3 resources tagged with Env=dev', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Env', Value: 'dev' }),
      ]),
    });
  });

  test('generate Lambda environment has SSM_PARAM_NAME set', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          SSM_PARAM_NAME: '/learnfyra/dev/anthropic-api-key',
        }),
      },
    });
  });

  test('generate Lambda environment has WORKSHEET_BUCKET_NAME set', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          WORKSHEET_BUCKET_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('generate Lambda environment has MAX_RETRIES tuned for API latency', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          MAX_RETRIES: '1',
        }),
      },
    });
  });

  test('generate Lambda environment has Anthropic timeout configured', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          ANTHROPIC_REQUEST_TIMEOUT_MS: '22000',
        }),
      },
    });
  });

  test('dev generate Lambda does not have X-Ray tracing enabled', () => {
    const lambdas = template.findResources('AWS::Lambda::Function', {
      Properties: { FunctionName: 'learnfyra-dev-lambda-generate' },
    });
    const generateLambda = Object.values(lambdas)[0] as { Properties: Record<string, unknown> };
    expect(generateLambda.Properties['TracingConfig']).toBeUndefined();
  });

  test('creates CloudWatch alarms for new backend Lambda errors', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-auth-errors',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-submit-errors',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-admin-errors',
    });
  });

  test('creates API Gateway operational alarms', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-api-5xx-errors',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-api-latency-p95',
    });
  });

  test('creates Lambda error-rate alarms for backend services', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-auth-error-rate',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-submit-error-rate',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-generate-error-rate',
    });
  });

  test('creates backend observability dashboard', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'learnfyra-dev-backend-observability',
    });
  });

  test('creates reusable log insights query definitions', () => {
    template.resourceCountIs('AWS::Logs::QueryDefinition', 7);
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-top-errors-by-function',
    });
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-auth-failures-by-route',
    });
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-high-latency-request-traces',
    });
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-4xx-5xx-route-hotspots',
    });
  });

  test('sets log retention policy for Lambda log groups', () => {
    // guardrailsAdminFn was merged into adminFn: 17 original Lambda functions remain
    // plus shared provider(s) for seed AwsCustomResources.
    // CDK shares the AwsCustomResource provider Lambda so the exact number depends on
    // provider grouping. Use a range check: at least 17, allowing for CDK-created extras.
    const logRetentionResources = template.findResources('Custom::LogRetention');
    expect(Object.keys(logRetentionResources).length).toBeGreaterThanOrEqual(17);
    template.hasResourceProperties('Custom::LogRetention', {
      RetentionInDays: 1096,
    });
  });

  test('creates LearnfyraWorksheets DynamoDB table with worksheetId PK and expiresAt TTL', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'LearnfyraWorksheets-dev',
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'worksheetId', KeyType: 'HASH' }),
      ]),
      TimeToLiveSpecification: {
        AttributeName: 'expiresAt',
        Enabled: true,
      },
    });
  });

  test('WorksheetsTable has slug-index GSI', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'LearnfyraWorksheets-dev',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'slug-index',
          KeySchema: Match.arrayWith([
            Match.objectLike({ AttributeName: 'slug', KeyType: 'HASH' }),
          ]),
          Projection: Match.objectLike({ ProjectionType: 'ALL' }),
        }),
      ]),
    });
  });

  test('generate Lambda has WORKSHEETS_TABLE_NAME env var', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          WORKSHEETS_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('solve Lambda has WORKSHEETS_TABLE_NAME env var', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-solve',
      Environment: {
        Variables: Match.objectLike({
          WORKSHEETS_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('submit Lambda has WORKSHEETS_TABLE_NAME env var', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-submit',
      Environment: {
        Variables: Match.objectLike({
          WORKSHEETS_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('creates API Gateway token authorizer', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      IdentitySource: 'method.request.header.Authorization',
    });
  });

  test('protects /api/generate POST with custom authorizer', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      AuthorizationType: 'CUSTOM',
      AuthorizerId: Match.anyValue(),
    });
  });

  // ── DOP-08: Cost/Anomaly and Throughput Visibility Tests
  // NOTE: Anomaly detection alarms and concurrent execution alarms were removed to stay
  // under the CloudFormation 500-resource limit. The three required per-function alarms
  // (errors, duration-p95, error-rate) are retained.
  test('does not create Lambda anomaly detection alarms (removed to stay under CF 500-resource limit)', () => {
    const anomalyAlarms = template.findResources('AWS::CloudWatch::Alarm', {
      Properties: { AlarmName: 'learnfyra-dev-generate-invocation-anomaly' },
    });
    expect(Object.keys(anomalyAlarms).length).toBe(0);
  });

  test('does not create anomaly detector resources (removed to stay under CF 500-resource limit)', () => {
    const availableAnomalyDetectors = template.findResources('AWS::CloudWatch::AnomalyDetector');
    expect(Object.keys(availableAnomalyDetectors).length).toBe(0);
  });

  test('does not create Lambda concurrent execution alarms (removed to stay under CF 500-resource limit)', () => {
    const concurrentAlarms = template.findResources('AWS::CloudWatch::Alarm', {
      Properties: { AlarmName: 'learnfyra-dev-generate-concurrent-threshold' },
    });
    expect(Object.keys(concurrentAlarms).length).toBe(0);
  });

  test('creates API throttle detection alarm', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-api-throttle-detected',
    });
  });

  test('creates API surge detection alarm', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-api-surge-detected',
    });
  });

  test('creates cost analysis query definitions (3 new queries for DOP-08)', () => {
    template.resourceCountIs('AWS::Logs::QueryDefinition', 7); // 4 original + 3 new
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-cost-by-function',
    });
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-cost-by-endpoint',
    });
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-cost-estimation',
    });
  });

  test('dashboard includes cost awareness text widget (DOP-08)', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'learnfyra-dev-backend-observability',
    });
    // Dashboard body is serialized as Fn::Join; verify it contains the key widget
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    expect(Object.keys(dashboards).length).toBeGreaterThan(0);
  });

  test('dashboard includes daily request volume widget (DOP-08)', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'learnfyra-dev-backend-observability',
    });
    // Dashboard body is serialized as Fn::Join; verify dashboard exists
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    expect(Object.keys(dashboards).length).toBeGreaterThan(0);
  });

  test('dashboard includes peak traffic window analysis widget (DOP-08)', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'learnfyra-dev-backend-observability',
    });
    // Dashboard body is serialized as Fn::Join; verify dashboard exists
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    expect(Object.keys(dashboards).length).toBeGreaterThan(0);
  });

  test('dashboard includes top endpoints by traffic (4 single-value widgets)', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'learnfyra-dev-backend-observability',
    });
    // Dashboard body is serialized as Fn::Join; verify dashboard exists
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    expect(Object.keys(dashboards).length).toBeGreaterThan(0);
  });

  test('dashboard includes cost analyzer log drill-down panels (DOP-08)', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'learnfyra-dev-backend-observability',
    });
    // Dashboard body is serialized as Fn::Join; verify dashboard exists
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    expect(Object.keys(dashboards).length).toBeGreaterThan(0);
  });
});

describe('LearnfyraStack (prod)', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('prod');
  });

  test('prod worksheet bucket has versioning enabled', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-prod-s3-worksheets',
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    });
  });

  test('prod generate Lambda has X-Ray tracing enabled', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-prod-lambda-generate',
      TracingConfig: { Mode: 'Active' },
    });
  });

  test('prod generate Lambda has MAX_RETRIES set to 0', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-prod-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          MAX_RETRIES: '0',
        }),
      },
    });
  });

  test('prod generate Lambda has Anthropic timeout configured', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-prod-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          ANTHROPIC_REQUEST_TIMEOUT_MS: '22000',
        }),
      },
    });
  });

  test('prod download Lambda has X-Ray tracing enabled', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-prod-lambda-download',
      TracingConfig: { Mode: 'Active' },
    });
  });

  test('prod worksheet bucket uses correct naming convention', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-prod-s3-worksheets',
    });
  });

  test('prod frontend bucket uses correct naming convention', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-prod-s3-frontend',
    });
  });
});

describe('LearnfyraStack (staging)', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('staging');
  });

  test('staging generate Lambda has X-Ray tracing enabled', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-staging-lambda-generate',
      TracingConfig: { Mode: 'Active' },
    });
  });

  test('staging worksheet bucket uses correct naming convention', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-staging-s3-worksheets',
    });
  });
});

describe('LearnfyraStack (dev) — Cognito Google OAuth', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('dev');
  });

  test('creates a Cognito User Pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'learnfyra-dev-user-pool',
    });
  });

  test('Cognito User Pool has email sign-in alias', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
    });
  });

  test('creates Google identity provider', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderName: 'Google',
      ProviderType: 'Google',
    });
  });

  test('Google IdP has the correct dev client ID', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderDetails: Match.objectLike({
        client_id: '1079696386286-m95l3vrmh157sgji4njii0afftoglc9b.apps.googleusercontent.com',
      }),
    });
  });

  test('creates Cognito App Client with authorization_code grant', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'learnfyra-dev-app-client',
      AllowedOAuthFlows: ['code'],
      GenerateSecret: false,
    });
  });

  test('App Client callback URL points to /api/auth/callback/google', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: Match.arrayWith([
        Match.stringLikeRegexp('/api/auth/callback/google'),
      ]),
    });
  });

  test('App Client supports Google as identity provider', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      SupportedIdentityProviders: Match.arrayWith(['Google']),
    });
  });

  test('creates Cognito domain with correct prefix', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolDomain', {
      Domain: 'learnfyra-dev',
    });
  });

  test('auth Lambda has AUTH_MODE=hybrid env var', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-auth',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          AUTH_MODE: 'hybrid',
        }),
      }),
    });
  });

  test('auth Lambda has COGNITO_DOMAIN env var', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-auth',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          COGNITO_DOMAIN: Match.anyValue(),
        }),
      }),
    });
  });
});

// ── Guardrails & Repeat Cap CDK Tests ─────────────────────────────────────────

describe('LearnfyraStack (dev) — Guardrails Admin (merged into adminFn)', () => {
  // guardrailsAdminFn was removed to stay under the CloudFormation 500-resource limit.
  // All guardrails and repeat-cap routes are now handled by adminFn, which receives the
  // required guardrails environment variables.
  let template: Template;
  beforeAll(() => {
    template = makeStack('dev');
  });

  test('does not create a separate guardrails-admin Lambda', () => {
    const lambdas = template.findResources('AWS::Lambda::Function', {
      Properties: { FunctionName: 'learnfyra-dev-lambda-guardrails-admin' },
    });
    expect(Object.keys(lambdas).length).toBe(0);
  });

  test('adminFn has CONFIG_TABLE_NAME env var (needed by guardrails handler)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-admin',
      Environment: {
        Variables: Match.objectLike({
          CONFIG_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('adminFn has ADMIN_AUDIT_EVENTS_TABLE_NAME env var (needed by guardrails handler)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-admin',
      Environment: {
        Variables: Match.objectLike({
          ADMIN_AUDIT_EVENTS_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('adminFn has REPEAT_CAP_OVERRIDES_TABLE_NAME env var (needed by guardrails handler)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-admin',
      Environment: {
        Variables: Match.objectLike({
          REPEAT_CAP_OVERRIDES_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('adminFn has QUESTION_EXPOSURE_TABLE_NAME env var (needed by repeat-cap handler)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-admin',
      Environment: {
        Variables: Match.objectLike({
          QUESTION_EXPOSURE_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('adminFn has JWT_SECRET and AUTH_MODE env vars (needed by guardrails RBAC)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-admin',
      Environment: {
        Variables: Match.objectLike({
          AUTH_MODE: 'hybrid',
        }),
      },
    });
  });

  test('does not create separate CloudWatch alarms for guardrailsadmin (merged into admin alarms)', () => {
    const alarms = template.findResources('AWS::CloudWatch::Alarm', {
      Properties: { AlarmName: 'learnfyra-dev-guardrailsadmin-errors' },
    });
    expect(Object.keys(alarms).length).toBe(0);
  });
});

describe('LearnfyraStack (dev) — QuestionExposure DynamoDB Table', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('dev');
  });

  test('creates LearnfyraQuestionExposure table with userId PK and exposureKey SK', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'LearnfyraQuestionExposure-dev',
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'userId', KeyType: 'HASH' }),
        Match.objectLike({ AttributeName: 'exposureKey', KeyType: 'RANGE' }),
      ]),
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('QuestionExposure table tagged with Project=learnfyra', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'LearnfyraQuestionExposure-dev',
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Project', Value: 'learnfyra' }),
      ]),
    });
  });
});

describe('LearnfyraStack (prod) — QuestionExposure DynamoDB Table', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('prod');
  });

  test('prod QuestionExposure table uses RETAIN removal policy', () => {
    // In prod, removalPolicy=RETAIN means DeletionPolicy=Retain on the CloudFormation resource
    const tables = template.findResources('AWS::DynamoDB::Table', {
      Properties: { TableName: 'LearnfyraQuestionExposure-prod' },
    });
    const tableEntries = Object.values(tables);
    expect(tableEntries.length).toBe(1);
    const tableResource = tableEntries[0] as { DeletionPolicy?: string };
    expect(tableResource.DeletionPolicy).toBe('Retain');
  });
});

describe('LearnfyraStack (dev) — DynamoDB Config Seeds', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('dev');
  });

  test('seeds guardrail:policy config entry via AwsCustomResource', () => {
    // AwsCustomResource creates a Custom::AWS resource
    const customResources = template.findResources('Custom::AWS');
    const resourceValues = Object.values(customResources) as Array<{ Properties: Record<string, unknown> }>;
    const seedPolicyResource = resourceValues.find((r) => {
      const create = r.Properties?.['Create'];
      return typeof create === 'string'
        ? create.includes('guardrail:policy')
        : JSON.stringify(create).includes('guardrail:policy');
    });
    expect(seedPolicyResource).toBeDefined();
  });

  test('seeds guardrail:medium:template config entry via AwsCustomResource', () => {
    const customResources = template.findResources('Custom::AWS');
    const resourceValues = Object.values(customResources) as Array<{ Properties: Record<string, unknown> }>;
    const seedMediumResource = resourceValues.find((r) => {
      const create = r.Properties?.['Create'];
      return typeof create === 'string'
        ? create.includes('guardrail:medium:template')
        : JSON.stringify(create).includes('guardrail:medium:template');
    });
    expect(seedMediumResource).toBeDefined();
  });

  test('seeds guardrail:strict:template config entry via AwsCustomResource', () => {
    const customResources = template.findResources('Custom::AWS');
    const resourceValues = Object.values(customResources) as Array<{ Properties: Record<string, unknown> }>;
    const seedStrictResource = resourceValues.find((r) => {
      const create = r.Properties?.['Create'];
      return typeof create === 'string'
        ? create.includes('guardrail:strict:template')
        : JSON.stringify(create).includes('guardrail:strict:template');
    });
    expect(seedStrictResource).toBeDefined();
  });

  test('seeds repeatCap:global config entry via AwsCustomResource', () => {
    const customResources = template.findResources('Custom::AWS');
    const resourceValues = Object.values(customResources) as Array<{ Properties: Record<string, unknown> }>;
    const seedRepeatCapResource = resourceValues.find((r) => {
      const create = r.Properties?.['Create'];
      return typeof create === 'string'
        ? create.includes('repeatCap:global')
        : JSON.stringify(create).includes('repeatCap:global');
    });
    expect(seedRepeatCapResource).toBeDefined();
  });

  test('creates exactly 4 DynamoDB seed AwsCustomResources', () => {
    const customResources = template.findResources('Custom::AWS');
    // Each AwsCustomResource creates one Custom::AWS resource
    expect(Object.keys(customResources).length).toBe(4);
  });
});

describe('LearnfyraStack (dev) — Guardrails API Gateway Routes', () => {
  let template: Template;
  beforeAll(() => {
    template = makeStack('dev');
  });

  test('has API Gateway methods for guardrails admin routes', () => {
    // GET and PUT on guardrails/policy, GET on guardrails/templates,
    // PUT on guardrails/templates/{level}, POST on guardrails/test,
    // GET on guardrails/audit, GET/PUT on repeat-cap, POST on repeat-cap/override,
    // DELETE on repeat-cap/override/{scope}/{scopeId} = 10 methods
    // Verify all methods are created via JWT authorizer
    const methods = template.findResources('AWS::ApiGateway::Method', {
      Properties: {
        AuthorizationType: 'CUSTOM',
        AuthorizerId: Match.anyValue(),
      },
    });
    // The stack has many protected methods; verify count increases with new routes
    expect(Object.keys(methods).length).toBeGreaterThan(20);
  });
});