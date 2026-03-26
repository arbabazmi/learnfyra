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

  test('dev generate Lambda does not have X-Ray tracing enabled', () => {
    const lambdas = template.findResources('AWS::Lambda::Function', {
      Properties: { FunctionName: 'learnfyra-dev-lambda-generate' },
    });
    const generateLambda = Object.values(lambdas)[0] as { Properties: Record<string, unknown> };
    expect(generateLambda.Properties['TracingConfig']).toBeUndefined();
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