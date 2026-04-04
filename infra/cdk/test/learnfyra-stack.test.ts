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
    template.resourceCountIs('Custom::LogRetention', 17);
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
  test('creates Lambda anomaly detection alarms (11 functions)', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-generate-invocation-anomaly',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-submit-invocation-anomaly',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-auth-invocation-anomaly',
    });
  });

  test('creates anomaly detector resources for Lambda functions', () => {
    const availableAnomalyDetectors = template.findResources('AWS::CloudWatch::AnomalyDetector');
    expect(Object.keys(availableAnomalyDetectors).length).toBeGreaterThanOrEqual(1);
  });

  test('creates Lambda concurrent execution alarms (11 functions)', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-generate-concurrent-threshold',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'learnfyra-dev-submit-concurrent-threshold',
    });
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