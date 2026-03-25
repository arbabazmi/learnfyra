import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface LearnfyraStackProps extends cdk.StackProps {
  appEnv: 'dev' | 'staging' | 'prod';
  rootDomainName?: string;
  hostedZoneId?: string;
  enableCustomDomains?: boolean;
  cloudFrontCertificateArn?: string;
  apiCertificateArn?: string;
}

export class LearnfyraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LearnfyraStackProps) {
    super(scope, id, props);

    const { appEnv } = props;
    const isDev = appEnv === 'dev';
    const isProd = appEnv === 'prod';
    const dnsEnvLabel = appEnv === 'staging' ? 'qa' : appEnv;
    const enableCustomDomains = props.enableCustomDomains ?? false;
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const tracingMode =
      isProd || appEnv === 'staging' ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED;

    const rootDomainName = props.rootDomainName;
    const hostedZoneId = props.hostedZoneId;
    const zone =
      enableCustomDomains && rootDomainName && hostedZoneId
        ? route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            zoneName: rootDomainName,
            hostedZoneId,
          })
        : undefined;

    if (enableCustomDomains && (!rootDomainName || !hostedZoneId)) {
      throw new Error(
        'Custom domains enabled but rootDomainName/hostedZoneId not provided in stack props.'
      );
    }

    const apiDomainName = isProd
      ? `api.${rootDomainName}`
      : `api.${dnsEnvLabel}.${rootDomainName}`;
    const webDomainName = isProd
      ? `${rootDomainName}`
      : `web.${dnsEnvLabel}.${rootDomainName}`;
    const wwwDomainName = `www.${rootDomainName}`;
    const adminDomainName = isProd
      ? `admin.${rootDomainName}`
      : `admin.${dnsEnvLabel}.${rootDomainName}`;
    const authDomainName = `auth.dev.${rootDomainName}`;

    let cloudFrontCertificate: acm.ICertificate | undefined;
    if (enableCustomDomains) {
      if (!props.cloudFrontCertificateArn) {
        throw new Error('Custom domains for CloudFront require cloudFrontCertificateArn.');
      }
      cloudFrontCertificate = acm.Certificate.fromCertificateArn(
        this,
        'CloudFrontCertificate',
        props.cloudFrontCertificateArn
      );
    }

    // ── Tag all resources ─────────────────────────────────────────────────────
    cdk.Tags.of(this).add('Project', 'learnfyra');
    cdk.Tags.of(this).add('Env', appEnv);
    cdk.Tags.of(this).add('Environment', appEnv);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');

    // ── S3: Worksheet bucket (private) ────────────────────────────────────────
    const worksheetBucket = new s3.Bucket(this, 'WorksheetBucket', {
      bucketName: `learnfyra-${appEnv}-s3-worksheets`,
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
      bucketName: `learnfyra-${appEnv}-s3-frontend`,
      removalPolicy,
      autoDeleteObjects: !isProd,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ── API Gateway ────────────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `learnfyra-${appEnv}-apigw`,
      description: `Learnfyra API — ${appEnv}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: appEnv,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
        throttlingRateLimit: isDev ? 2 : 10,
        throttlingBurstLimit: isDev ? 5 : 20,
      },
    });

    // Origin Access Identity — grants CloudFront read access to the private bucket
    const oai = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
      comment: `OAI for learnfyra-${appEnv}-s3-frontend`,
    });
    frontendBucket.grantRead(oai);

    // ── CloudFront distribution ──────────────────────────────────────────────
    const apiGatewayExecuteDomain = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`;

    const distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      comment: `learnfyra-${appEnv}-cloudfront`,
      defaultRootObject: 'index.html',
      domainNames:
        enableCustomDomains && rootDomainName
          ? isProd
            ? [webDomainName, wwwDomainName, adminDomainName]
            : [webDomainName, adminDomainName]
          : undefined,
      certificate: cloudFrontCertificate,
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiGatewayExecuteDomain, {
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
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
    });

    // ── SSM: Anthropic API key ─────────────────────────────────────────────────
    const anthropicKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this, 'AnthropicApiKey',
      { parameterName: `/learnfyra/${appEnv}/anthropic-api-key` }
    );

    // Shared esbuild bundling options — bundles handler + all src/ imports into
    // a single CJS file. @aws-sdk/* is excluded (provided by the Lambda runtime).
    // CJS output avoids the "Cannot use import statement outside a module" error
    // that occurs when Lambda receives an unbundled ESM file without package.json.
    const bundling = {
      format: OutputFormat.CJS,
      target: 'node20',
      // In production/staging/dev: nodeModules installs puppeteer-core +
      // @sparticuz/chromium natively inside the Lambda zip (npm ci approach).
      // In test (NODE_ENV=test): mark them external so esbuild doesn't try to
      // bundle the 300MB Chromium binary. CDK unit tests validate CloudFormation
      // template structure only — they don't execute Lambda code.
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

    // ── Lambda: Generate handler ───────────────────────────────────────────────
    const generateFn = new NodejsFunction(this, 'GenerateFunction', {
      functionName: `learnfyra-${appEnv}-lambda-generate`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../../backend/handlers/generateHandler.js'),
      handler: 'handler',
      memorySize: isDev ? 512 : 1024,
      timeout: cdk.Duration.seconds(60),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
        CLAUDE_MODEL: 'claude-sonnet-4-20250514',
        SSM_PARAM_NAME: `/learnfyra/${appEnv}/anthropic-api-key`,
      },
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-generate — worksheet generation`,
    });

    worksheetBucket.grantPut(generateFn);
    worksheetBucket.grantRead(generateFn);
    anthropicKeyParam.grantRead(generateFn);

    // ── Lambda: Download handler ───────────────────────────────────────────────
    const downloadFn = new NodejsFunction(this, 'DownloadFunction', {
      functionName: `learnfyra-${appEnv}-lambda-download`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../../backend/handlers/downloadHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
      },
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-download — presigned URL generation`,
    });

    worksheetBucket.grantRead(downloadFn);
    downloadFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [worksheetBucket.arnForObjects('*')],
    }));

    const apiResource = api.root.addResource('api');

    const generateResource = apiResource.addResource('generate');
    generateResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(generateFn, { proxy: true }),
      { apiKeyRequired: false }
    );

    const downloadResource = apiResource.addResource('download');
    downloadResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(downloadFn, { proxy: true }),
      { apiKeyRequired: false }
    );

    let apiCustomDomain: apigateway.DomainName | undefined;
    if (enableCustomDomains) {
      if (!props.apiCertificateArn) {
        throw new Error('Custom domains for API Gateway require apiCertificateArn.');
      }

      const apiCertificate = acm.Certificate.fromCertificateArn(
        this,
        'ApiCertificate',
        props.apiCertificateArn
      );

      apiCustomDomain = new apigateway.DomainName(this, 'ApiCustomDomain', {
        domainName: apiDomainName,
        certificate: apiCertificate,
        endpointType: apigateway.EndpointType.REGIONAL,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
      });

      new apigateway.BasePathMapping(this, 'ApiBasePathMapping', {
        domainName: apiCustomDomain,
        restApi: api,
        stage: api.deploymentStage,
      });

      if (zone) {
        new route53.ARecord(this, 'ApiDomainRecord', {
          zone,
          recordName: apiDomainName,
          target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiCustomDomain)),
        });

        if (distribution) {
          new route53.ARecord(this, 'WebDomainRecord', {
            zone,
            recordName: webDomainName,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
          });

          if (isProd) {
            new route53.ARecord(this, 'WwwDomainRecord', {
              zone,
              recordName: wwwDomainName,
              target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
            });
          }

          new route53.ARecord(this, 'AdminDomainRecord', {
            zone,
            recordName: adminDomainName,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
          });

          if (isDev) {
            new route53.CnameRecord(this, 'AuthDomainRecordDev', {
              zone,
              recordName: authDomainName,
              domainName: apiDomainName,
              ttl: cdk.Duration.minutes(5),
            });
          }
        }
      }
    }

    // ── Outputs ────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL (open this in your browser)',
      exportName: `learnfyra-${appEnv}-frontend-url`,
    });

    if (distribution) {
      new cdk.CfnOutput(this, 'DistributionId', {
        value: distribution.distributionId,
        description: 'CloudFront distribution ID (for cache invalidation)',
        exportName: `learnfyra-${appEnv}-cloudfront-id`,
      });
    }

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `learnfyra-${appEnv}-apigw-url`,
    });

    new cdk.CfnOutput(this, 'WorksheetBucketName', {
      value: worksheetBucket.bucketName,
      description: 'Worksheet S3 bucket name',
      exportName: `learnfyra-${appEnv}-s3-worksheets-name`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 bucket name',
      exportName: `learnfyra-${appEnv}-s3-frontend-name`,
    });

    if (enableCustomDomains) {
      new cdk.CfnOutput(this, 'FrontendCustomDomain', {
        value: webDomainName,
        description: 'Frontend custom domain for this environment',
      });

      new cdk.CfnOutput(this, 'AdminCustomDomain', {
        value: adminDomainName,
        description: 'Admin custom domain for this environment',
      });


      new cdk.CfnOutput(this, 'ApiCustomDomainOutput', {
        value: apiDomainName,
        description: 'API custom domain for this environment',
      });

      if (isDev) {
        new cdk.CfnOutput(this, 'AuthCustomDomainDev', {
          value: authDomainName,
          description: 'Auth custom domain for dev environment',
        });
      }
    }
  }
}
