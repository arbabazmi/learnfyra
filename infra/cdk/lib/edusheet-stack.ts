import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface EduSheetAiStackProps extends cdk.StackProps {
  appEnv: 'dev' | 'staging' | 'prod';
}

export class EduSheetAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EduSheetAiStackProps) {
    super(scope, id, props);

    const { appEnv } = props;
    const isProd = appEnv === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const tracingMode =
      isProd || appEnv === 'staging' ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED;

    // ── Tag all resources ─────────────────────────────────────────────────────
    cdk.Tags.of(this).add('Project', 'edusheet');
    cdk.Tags.of(this).add('Env', appEnv);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');

    // ── S3: Worksheet bucket (private) ────────────────────────────────────────
    const worksheetBucket = new s3.Bucket(this, 'WorksheetBucket', {
      bucketName: `edusheet-${appEnv}-s3-worksheets`,
      removalPolicy,
      autoDeleteObjects: !isProd,
      versioned: isProd,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
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
      bucketName: `edusheet-${appEnv}-s3-frontend`,
      removalPolicy,
      autoDeleteObjects: !isProd,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Origin Access Identity — grants CloudFront read access to the private bucket
    const oai = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
      comment: `OAI for edusheet-${appEnv}-s3-frontend`,
    });
    frontendBucket.grantRead(oai);

    // ── SSM: Anthropic API key (pre-created manually as SecureString) ─────────
    const anthropicKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this, 'AnthropicApiKey',
      {
        parameterName: `/edusheet/${appEnv}/anthropic-api-key`,
      }
    );

    // ── Lambda: Generate handler ───────────────────────────────────────────────
    const generateFn = new lambda.Function(this, 'GenerateFunction', {
      functionName: `edusheet-${appEnv}-lambda-generate`,
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'generateHandler.handler',
      code: lambda.Code.fromAsset('../../backend/handlers', {
        exclude: ['*.test.js', '*.spec.js'],
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
        CLAUDE_MODEL: 'claude-sonnet-4-20250514',
        SSM_PARAM_NAME: `/edusheet/${appEnv}/anthropic-api-key`,
      },
      tracing: tracingMode,
      description: `edusheet-${appEnv}-lambda-generate — worksheet generation`,
    });

    // Grant S3 permissions to generate function
    worksheetBucket.grantPut(generateFn);
    worksheetBucket.grantRead(generateFn);

    // Grant SSM read permission so the function can fetch the API key at runtime
    anthropicKeyParam.grantRead(generateFn);

    // ── Lambda: Download handler ───────────────────────────────────────────────
    const downloadFn = new lambda.Function(this, 'DownloadFunction', {
      functionName: `edusheet-${appEnv}-lambda-download`,
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'downloadHandler.handler',
      code: lambda.Code.fromAsset('../../backend/handlers', {
        exclude: ['*.test.js', '*.spec.js'],
      }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
      },
      tracing: tracingMode,
      description: `edusheet-${appEnv}-lambda-download — presigned URL generation`,
    });

    // Grant S3 read + presigned URL generation to download function
    worksheetBucket.grantRead(downloadFn);
    downloadFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [worksheetBucket.arnForObjects('*')],
    }));

    // ── API Gateway ────────────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `edusheet-${appEnv}-apigw`,
      description: `EduSheet AI API — ${appEnv}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: appEnv,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
        throttlingRateLimit: 10,
        throttlingBurstLimit: 20,
      },
    });

    const apiResource = api.root.addResource('api');

    // POST /api/generate
    const generateResource = apiResource.addResource('generate');
    generateResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(generateFn, { proxy: true }),
      { apiKeyRequired: false }
    );

    // GET /api/download
    const downloadResource = apiResource.addResource('download');
    downloadResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(downloadFn, { proxy: true }),
      { apiKeyRequired: false }
    );

    // ── CloudFront distribution ────────────────────────────────────────────────
    // S3BucketOrigin.withOriginAccessControl() creates and attaches an OAC automatically,
    // granting CloudFront read access to the private bucket without making it public.
    const apiDomainName = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`;

    const distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      comment: `edusheet-${appEnv}-cloudfront`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiDomainName, {
            originPath: `/${appEnv}`,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // ── Outputs ────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL',
      exportName: `edusheet-${appEnv}-cloudfront-url`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (for cache invalidation)',
      exportName: `edusheet-${appEnv}-cloudfront-id`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `edusheet-${appEnv}-apigw-url`,
    });

    new cdk.CfnOutput(this, 'WorksheetBucketName', {
      value: worksheetBucket.bucketName,
      description: 'Worksheet S3 bucket name',
      exportName: `edusheet-${appEnv}-s3-worksheets-name`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 bucket name',
      exportName: `edusheet-${appEnv}-s3-frontend-name`,
    });
  }
}
