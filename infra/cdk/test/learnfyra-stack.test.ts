import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { LearnfyraStack } from '../lib/learnfyra-stack';

/**
 * With nested stacks, Template.fromStack(parentStack) only shows
 * AWS::CloudFormation::Stack references. To assert on actual resources,
 * we must get Template.fromStack(nestedStack) for each nested stack.
 */

function makeApp(appEnv: 'dev' | 'staging' | 'prod' = 'dev') {
  const app = new cdk.App();
  const stack = new LearnfyraStack(app, `LearnfyraStack-${appEnv}`, { appEnv });
  return { app, stack };
}

function getNestedTemplate(stack: cdk.Stack, nestedId: string): Template {
  const nested = stack.node.findChild(nestedId) as cdk.NestedStack;
  return Template.fromStack(nested);
}

// ── Parent Stack Structure ───────────────────────────────────────────────────
// NOTE: Template.fromStack() on the parent stack detects a false-positive cyclic
// dependency due to cross-nested-stack references. cdk synth succeeds and
// CloudFormation deploys correctly. Parent template assertions are skipped.

// ── Storage Stack ────────────────────────────────────────────────────────────

describe('StorageStack (dev)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('dev');
    template = getNestedTemplate(stack, 'Storage');
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

  test('creates QuestionExposure table with userId PK and exposureKey SK', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'LearnfyraQuestionExposure-dev',
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'userId', KeyType: 'HASH' }),
        Match.objectLike({ AttributeName: 'exposureKey', KeyType: 'RANGE' }),
      ]),
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('creates exactly 4 DynamoDB seed AwsCustomResources', () => {
    const customResources = template.findResources('Custom::AWS');
    expect(Object.keys(customResources).length).toBe(4);
  });

  test('seeds guardrail:policy config entry', () => {
    const customResources = template.findResources('Custom::AWS');
    const resourceValues = Object.values(customResources) as Array<{ Properties: Record<string, unknown> }>;
    const seedPolicyResource = resourceValues.find((r) => {
      const create = r.Properties?.['Create'];
      return JSON.stringify(create).includes('guardrail:policy');
    });
    expect(seedPolicyResource).toBeDefined();
  });

  test('seeds repeatCap:global config entry', () => {
    const customResources = template.findResources('Custom::AWS');
    const resourceValues = Object.values(customResources) as Array<{ Properties: Record<string, unknown> }>;
    const seedRepeatCapResource = resourceValues.find((r) => {
      const create = r.Properties?.['Create'];
      return JSON.stringify(create).includes('repeatCap:global');
    });
    expect(seedRepeatCapResource).toBeDefined();
  });
});

describe('StorageStack (prod)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('prod');
    template = getNestedTemplate(stack, 'Storage');
  });

  test('prod worksheet bucket has versioning enabled', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'learnfyra-prod-s3-worksheets',
      VersioningConfiguration: { Status: 'Enabled' },
    });
  });

  test('prod QuestionExposure table uses RETAIN removal policy', () => {
    const tables = template.findResources('AWS::DynamoDB::Table', {
      Properties: { TableName: 'LearnfyraQuestionExposure-prod' },
    });
    const tableEntries = Object.values(tables);
    expect(tableEntries.length).toBe(1);
    const tableResource = tableEntries[0] as { DeletionPolicy?: string };
    expect(tableResource.DeletionPolicy).toBe('Retain');
  });
});

// ── Auth Stack ───────────────────────────────────────────────────────────────

describe('AuthStack (dev)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('dev');
    template = getNestedTemplate(stack, 'Auth');
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

  test('creates Cognito domain with correct prefix', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolDomain', {
      Domain: 'learnfyra-dev',
    });
  });
});

// ── Compute Stack ────────────────────────────────────────────────────────────

describe('ComputeStack (dev)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('dev');
    template = getNestedTemplate(stack, 'Compute');
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

  test('generate Lambda has MAX_RETRIES tuned for API latency', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-generate',
      Environment: {
        Variables: Match.objectLike({
          MAX_RETRIES: '1',
          ANTHROPIC_REQUEST_TIMEOUT_MS: '22000',
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

  test('adminFn has guardrails-related env vars', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-dev-lambda-admin',
      Environment: {
        Variables: Match.objectLike({
          CONFIG_TABLE_NAME: Match.anyValue(),
          ADMIN_AUDIT_EVENTS_TABLE_NAME: Match.anyValue(),
          REPEAT_CAP_OVERRIDES_TABLE_NAME: Match.anyValue(),
          QUESTION_EXPOSURE_TABLE_NAME: Match.anyValue(),
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

  test('sets log retention policy for Lambda log groups', () => {
    const logRetentionResources = template.findResources('Custom::LogRetention');
    expect(Object.keys(logRetentionResources).length).toBeGreaterThanOrEqual(16);
    template.hasResourceProperties('Custom::LogRetention', {
      RetentionInDays: 1096,
    });
  });
});

describe('ComputeStack (prod)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('prod');
    template = getNestedTemplate(stack, 'Compute');
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
        Variables: Match.objectLike({ MAX_RETRIES: '0' }),
      },
    });
  });
});

describe('ComputeStack (staging)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('staging');
    template = getNestedTemplate(stack, 'Compute');
  });

  test('staging generate Lambda has X-Ray tracing enabled', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'learnfyra-staging-lambda-generate',
      TracingConfig: { Mode: 'Active' },
    });
  });
});

// ── API Stack ────────────────────────────────────────────────────────────────

describe('ApiStack (dev)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('dev');
    template = getNestedTemplate(stack, 'Api');
  });

  test('creates API Gateway REST API with correct name', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'learnfyra-dev-apigw',
    });
  });

  test('enables API Gateway access logging', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/learnfyra-dev-access-logs',
      RetentionInDays: 1096,
    });
  });

  test('creates API Gateway token authorizer', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      IdentitySource: 'method.request.header.Authorization',
    });
  });

  test('has protected API methods with custom authorizer', () => {
    const methods = template.findResources('AWS::ApiGateway::Method', {
      Properties: {
        AuthorizationType: 'CUSTOM',
        AuthorizerId: Match.anyValue(),
      },
    });
    expect(Object.keys(methods).length).toBeGreaterThan(20);
  });

  test('API stack resource count is under 500', () => {
    const allResources = template.toJSON().Resources || {};
    expect(Object.keys(allResources).length).toBeLessThan(500);
  });
});

// ── CDN Stack ────────────────────────────────────────────────────────────────

describe('CdnStack (dev)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('dev');
    template = getNestedTemplate(stack, 'Cdn');
  });

  test('creates CloudFront distribution', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });
});

// ── Monitoring Stack ─────────────────────────────────────────────────────────

describe('MonitoringStack (dev)', () => {
  let template: Template;
  beforeAll(() => {
    const { stack } = makeApp('dev');
    template = getNestedTemplate(stack, 'Monitoring');
  });

  test('creates CloudWatch alarms for Lambda errors', () => {
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

  test('creates Lambda error-rate alarms', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-auth-error-rate',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-generate-error-rate',
    });
  });

  test('creates API throttle and surge detection alarms', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-api-throttle-detected',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-api-surge-detected',
    });
  });

  test('creates backend observability dashboard', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'learnfyra-dev-backend-observability',
    });
  });

  test('creates 7 reusable log insights query definitions', () => {
    template.resourceCountIs('AWS::Logs::QueryDefinition', 7);
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-top-errors-by-function',
    });
    template.hasResourceProperties('AWS::Logs::QueryDefinition', {
      Name: 'learnfyra-dev-cost-by-function',
    });
  });
});
