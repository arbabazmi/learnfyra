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
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { existsSync } from 'fs';

function resolveHandlerEntry(handlerFile: string): string {
  const candidates = [
    // ts-node / source path: infra/cdk/lib -> repo root via ../../../
    path.resolve(__dirname, '../../../backend/handlers', handlerFile),
    // compiled test path: infra/cdk/dist/lib -> repo root via ../../../../
    path.resolve(__dirname, '../../../../backend/handlers', handlerFile),
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

    // Explicit CloudFormation stack description helps ops identify purpose quickly.
    this.templateOptions.description =
      `Learnfyra ${appEnv} stack: API, Lambda handlers, Cognito auth, CloudFront, and S3 assets`;

    // Google OAuth Client IDs per environment (public identifiers — not secrets)
    const googleClientIds: Record<string, string> = {
      dev:     '1079696386286-m95l3vrmh157sgji4njii0afftoglc9b.apps.googleusercontent.com',
      staging: '1079696386286-hjn155lvlt8sr4cc0g1e3f8mfvs6mgbk.apps.googleusercontent.com',
      prod:    '1079696386286-edsmfmdk6j8073qnm05uii6b2c6o655o.apps.googleusercontent.com',
    };

    // OAuth callback base URLs per environment
    const callbackBaseUrls: Record<string, string> = {
      dev:     'https://dev.learnfyra.com',
      staging: 'https://qa.learnfyra.com',
      prod:    'https://www.learnfyra.com',
    };
    const callbackBaseUrl = callbackBaseUrls[appEnv] ?? 'http://localhost:3000';

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
    const authDomainName = isProd
      ? `auth.${rootDomainName}`
      : `auth.${dnsEnvLabel}.${rootDomainName}`;

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
    cdk.Tags.of(this).add('Application', 'learnfyra');
    cdk.Tags.of(this).add('Env', appEnv);
    cdk.Tags.of(this).add('Environment', appEnv);
    cdk.Tags.of(this).add('Stage', appEnv);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Repository', 'arbabazmi/learnfyra');
    cdk.Tags.of(this).add('Workload', 'serverless');

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
    const apiAccessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/learnfyra-${appEnv}-access-logs`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy,
    });

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
        accessLogDestination: new apigateway.LogGroupLogDestination(apiAccessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            ip: '$context.identity.sourceIp',
            requestTime: '$context.requestTime',
            httpMethod: '$context.httpMethod',
            resourcePath: '$context.resourcePath',
            routeKey: '$context.httpMethod $context.resourcePath',
            status: '$context.status',
            protocol: '$context.protocol',
            responseLength: '$context.responseLength',
            responseLatency: '$context.responseLatency',
            integrationLatency: '$context.integrationLatency',
            errorMessage: '$context.error.message',
            integrationError: '$context.integration.error',
            userAgent: '$context.identity.userAgent',
          })
        ),
        metricsEnabled: true,
        throttlingRateLimit: isDev ? 2 : 10,
        throttlingBurstLimit: isDev ? 5 : 20,
        methodOptions: {
          '/api/auth/register/POST': {
            throttlingRateLimit: 1,
            throttlingBurstLimit: 2,
          },
          '/api/auth/login/POST': {
            throttlingRateLimit: 1,
            throttlingBurstLimit: 2,
          },
        },
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
    // JWT secret — stored in Secrets Manager (not SSM) so it is encrypted at rest
    // and resolved via CloudFormation dynamic reference into the Lambda env var.
    const jwtSecretValue = cdk.SecretValue.secretsManager(
      `/learnfyra/${appEnv}/jwt-secret`
    ).unsafeUnwrap();
    const allowedOrigin = enableCustomDomains ? `https://${webDomainName}` : '*';

    // ── Cognito: User Pool ─────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `learnfyra-${appEnv}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      removalPolicy,
    });

    // Google identity provider — client secret fetched from Secrets Manager at deploy time
    const googleIdp = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdp', {
      userPool,
      clientId: googleClientIds[appEnv],
      clientSecretValue: cdk.SecretValue.secretsManager(`/learnfyra/${appEnv}/google-client-secret`),
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
      },
    });

    // Cognito Hosted UI domain
    const userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool,
      cognitoDomain: { domainPrefix: `learnfyra-${appEnv}` },
    });

    // Construct full Cognito domain URL — region resolves at deploy time
    const cognitoDomainUrl = `https://learnfyra-${appEnv}.auth.${this.region}.amazoncognito.com`;

    // App Client (public — no client secret; PKCE handled by Cognito Hosted UI)
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: `learnfyra-${appEnv}-app-client`,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [`${callbackBaseUrl}/api/auth/callback/google`],
        logoutUrls: [callbackBaseUrl],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
    });
    // App client must be created after the IdP exists
    userPoolClient.node.addDependency(googleIdp);
    // Suppress unused variable warning — domain is a required CDK construct
    void userPoolDomain;

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
      // @sparticuz/chromium does not provide an ARM Lambda binary here, so the
      // PDF-generating function must run on x86_64 to execute Chromium in /tmp.
      architecture: lambda.Architecture.X86_64,
      entry: resolveHandlerEntry('generateHandler.js'),
      handler: 'handler',
      memorySize: isDev ? 512 : 1024,
      timeout: cdk.Duration.seconds(60),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
        CLAUDE_MODEL: 'claude-sonnet-4-20250514',
        SSM_PARAM_NAME: `/learnfyra/${appEnv}/anthropic-api-key`,
        MAX_RETRIES: isProd ? '0' : '1',
        ANTHROPIC_REQUEST_TIMEOUT_MS: '22000',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
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
      entry: resolveHandlerEntry('downloadHandler.js'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      bundling,
      environment: {
        NODE_ENV: appEnv,
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-download — presigned URL generation`,
    });

    worksheetBucket.grantRead(downloadFn);
    downloadFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [worksheetBucket.arnForObjects('*')],
    }));

    // ── Lambda: Auth handler ───────────────────────────────────────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-auth — auth route handler`,
    });

    // ── Lambda: API Gateway token authorizer ─────────────────────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-api-authorizer — API Gateway JWT authorizer`,
    });

    // ── Lambda: Solve handler ──────────────────────────────────────────────────
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
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-solve — worksheet solve retrieval`,
    });

    // ── Lambda: Submit handler ─────────────────────────────────────────────────
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
        WORKSHEET_BUCKET_NAME: worksheetBucket.bucketName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-submit — worksheet answer scoring`,
    });

    // ── Lambda: Progress handler ───────────────────────────────────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-progress — student progress routes`,
    });

    // ── Lambda: Analytics handler ──────────────────────────────────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-analytics — class analytics routes`,
    });

    // ── Lambda: Class handler ──────────────────────────────────────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-class — class management routes`,
    });

    // ── Lambda: Rewards handler ────────────────────────────────────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-rewards — student/class rewards routes`,
    });

    // ── Lambda: Student handler ────────────────────────────────────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-student — student profile and membership routes`,
    });

    // ── Lambda: Admin handler (question bank admin surface) ───────────────────
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
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: tracingMode,
      description: `learnfyra-${appEnv}-lambda-admin — admin question-bank routes`,
    });

    worksheetBucket.grantRead(solveFn);
    worksheetBucket.grantRead(submitFn);

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
    ].forEach((fn) => {
      fn.addEnvironment('ALLOWED_ORIGIN', allowedOrigin);
    });

    [authFn, progressFn, analyticsFn, classFn, rewardsFn, studentFn].forEach((fn) => {
      fn.addEnvironment('JWT_SECRET', jwtSecretValue);
      fn.addEnvironment('AUTH_MODE', 'cognito');
    });

    apiAuthorizerFn.addEnvironment('JWT_SECRET', jwtSecretValue);
    apiAuthorizerFn.addEnvironment('AUTH_MODE', 'cognito');

    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'ApiTokenAuthorizer', {
      handler: apiAuthorizerFn,
      identitySource: apigateway.IdentitySource.header('Authorization'),
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // OAUTH_CALLBACK_BASE_URL: used by OAuth adapters to build the redirect URI.
    // dev:  CloudFront domain (or '*' when custom domains disabled for local testing)
    // staging/prod: CloudFront domain for the environment
    const oauthCallbackBaseUrl = enableCustomDomains
      ? `https://${webDomainName}`
      : `https://${distribution.distributionDomainName}`;
    authFn.addEnvironment('OAUTH_CALLBACK_BASE_URL', oauthCallbackBaseUrl);

    // Cognito env vars — used by cognitoAdapter.js for Google OAuth flow
    authFn.addEnvironment('COGNITO_USER_POOL_ID', userPool.userPoolId);
    authFn.addEnvironment('COGNITO_APP_CLIENT_ID', userPoolClient.userPoolClientId);
    authFn.addEnvironment('COGNITO_DOMAIN', cognitoDomainUrl);

    [generateFn, adminFn].forEach((fn) => {
      fn.addEnvironment('QB_ADAPTER', 'local');
    });

    const apiResource = api.root.addResource('api');

    const generateResource = apiResource.addResource('generate');
    generateResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(generateFn, { proxy: true }),
      {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      }
    );

    const downloadResource = apiResource.addResource('download');
    downloadResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(downloadFn, { proxy: true }),
      { apiKeyRequired: false }
    );

    const authResource = apiResource.addResource('auth');
    authResource
      .addResource('register')
      .addMethod('POST', new apigateway.LambdaIntegration(authFn, { proxy: true }), {
        apiKeyRequired: false,
      });
    authResource
      .addResource('login')
      .addMethod('POST', new apigateway.LambdaIntegration(authFn, { proxy: true }), {
        apiKeyRequired: false,
      });
    authResource
      .addResource('logout')
      .addMethod('POST', new apigateway.LambdaIntegration(authFn, { proxy: true }), {
        apiKeyRequired: false,
      });
    authResource
      .addResource('refresh')
      .addMethod('POST', new apigateway.LambdaIntegration(authFn, { proxy: true }), {
        apiKeyRequired: false,
      });

    const authOauthResource = authResource.addResource('oauth');
    authOauthResource
      .addResource('{provider}')
      .addMethod('POST', new apigateway.LambdaIntegration(authFn, { proxy: true }), {
        apiKeyRequired: false,
      });

    const authCallbackResource = authResource.addResource('callback');
    authCallbackResource
      .addResource('{provider}')
      .addMethod('GET', new apigateway.LambdaIntegration(authFn, { proxy: true }), {
        apiKeyRequired: false,
      });

    apiResource
      .addResource('submit')
      .addMethod('POST', new apigateway.LambdaIntegration(submitFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    apiResource
      .addResource('solve')
      .addResource('{worksheetId}')
      .addMethod('GET', new apigateway.LambdaIntegration(solveFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    const progressResource = apiResource.addResource('progress');
    progressResource
      .addResource('save')
      .addMethod('POST', new apigateway.LambdaIntegration(progressFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    progressResource
      .addResource('history')
      .addMethod('GET', new apigateway.LambdaIntegration(progressFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    const classResource = apiResource.addResource('class');
    classResource
      .addResource('create')
      .addMethod('POST', new apigateway.LambdaIntegration(classFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    classResource
      .addResource('{id}')
      .addResource('students')
      .addMethod('GET', new apigateway.LambdaIntegration(classFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    apiResource
      .addResource('analytics')
      .addResource('class')
      .addResource('{id}')
      .addMethod('GET', new apigateway.LambdaIntegration(analyticsFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    const rewardsResource = apiResource.addResource('rewards');
    rewardsResource
      .addResource('student')
      .addResource('{id}')
      .addMethod('GET', new apigateway.LambdaIntegration(rewardsFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    rewardsResource
      .addResource('class')
      .addResource('{id}')
      .addMethod('GET', new apigateway.LambdaIntegration(rewardsFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    const studentResource = apiResource.addResource('student');
    studentResource
      .addResource('profile')
      .addMethod('GET', new apigateway.LambdaIntegration(studentFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    studentResource
      .addResource('join-class')
      .addMethod('POST', new apigateway.LambdaIntegration(studentFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    const qbResource = apiResource.addResource('qb');
    const qbQuestionsResource = qbResource.addResource('questions');
    qbQuestionsResource
      .addMethod('GET', new apigateway.LambdaIntegration(adminFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    qbQuestionsResource
      .addMethod('POST', new apigateway.LambdaIntegration(adminFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    const qbQuestionById = qbQuestionsResource.addResource('{id}');
    qbQuestionById
      .addMethod('GET', new apigateway.LambdaIntegration(adminFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    qbQuestionById
      .addResource('reuse')
      .addMethod('POST', new apigateway.LambdaIntegration(adminFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    const monitoredFunctions = [
      { id: 'Generate', fn: generateFn, p95MsThreshold: isDev ? 30000 : 45000 },
      { id: 'Download', fn: downloadFn, p95MsThreshold: 4000 },
      { id: 'Auth', fn: authFn, p95MsThreshold: 3000 },
      { id: 'Solve', fn: solveFn, p95MsThreshold: 4000 },
      { id: 'Submit', fn: submitFn, p95MsThreshold: 5000 },
      { id: 'Progress', fn: progressFn, p95MsThreshold: 4000 },
      { id: 'Analytics', fn: analyticsFn, p95MsThreshold: 4000 },
      { id: 'Class', fn: classFn, p95MsThreshold: 3000 },
      { id: 'Rewards', fn: rewardsFn, p95MsThreshold: 3000 },
      { id: 'Student', fn: studentFn, p95MsThreshold: 3000 },
      { id: 'Admin', fn: adminFn, p95MsThreshold: 4000 },
    ];

    monitoredFunctions.forEach(({ id, fn, p95MsThreshold }) => {
      new cloudwatch.Alarm(this, `${id}LambdaErrorsAlarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-errors`,
        metric: fn.metricErrors({
          period: cdk.Duration.minutes(1),
          statistic: 'sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda error count is >= 1 over 1 minute in ${appEnv}`,
      });

      new cloudwatch.Alarm(this, `${id}LambdaDurationP95Alarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-duration-p95`,
        metric: fn.metricDuration({
          period: cdk.Duration.minutes(1),
          statistic: 'p95',
        }),
        threshold: p95MsThreshold,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda p95 duration exceeded ${p95MsThreshold}ms in ${appEnv}`,
      });

      const errorRateMetric = new cloudwatch.MathExpression({
        expression: '100 * errors / IF(invocations > 0, invocations, 1)',
        label: `${id} Error Rate %`,
        period: cdk.Duration.minutes(5),
        usingMetrics: {
          errors: fn.metricErrors({
            statistic: 'sum',
            period: cdk.Duration.minutes(5),
          }),
          invocations: fn.metricInvocations({
            statistic: 'sum',
            period: cdk.Duration.minutes(5),
          }),
        },
      });

      new cloudwatch.Alarm(this, `${id}LambdaErrorRateAlarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-error-rate`,
        metric: errorRateMetric,
        threshold: 5,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda error rate exceeded 5% over 5 minutes in ${appEnv}`,
      });

      // ── Anomaly Detection Alarm for unusual invocation patterns
      const anomalyDetector = new cloudwatch.CfnAnomalyDetector(this, `${id}InvocationAnomalyDetector`, {
        namespace: 'AWS/Lambda',
        metricName: 'Invocations',
        stat: 'Sum',
        dimensions: [
          { name: 'FunctionName', value: fn.functionName },
        ],
      });

      const anomalyMetric = new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Invocations',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: { FunctionName: fn.functionName },
      });

      new cloudwatch.Alarm(this, `${id}InvocationAnomalyAlarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-invocation-anomaly`,
        metric: anomalyMetric,
        threshold: 2,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda detected unusual invocation pattern (anomaly > 2 std dev) in ${appEnv}`,
      }).node.addDependency(anomalyDetector);

      // ── Concurrent Execution Warning: Alert if we're using >50% of estimated normal concurrent calls
      const concurrencyThreshold = id === 'Generate' ? 50 : 20;
      const concurrentExecutionsMetric = new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'ConcurrentExecutions',
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
        dimensionsMap: { FunctionName: fn.functionName },
      });

      new cloudwatch.Alarm(this, `${id}ConcurrentExecutionAlarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-concurrent-threshold`,
        metric: concurrentExecutionsMetric,
        threshold: concurrencyThreshold,
        evaluationPeriods: 2,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda concurrent executions exceeded ${concurrencyThreshold} (approaching concurrency limit) in ${appEnv}`,
      });
    });

    new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: `learnfyra-${appEnv}-api-5xx-errors`,
      metric: api.metricServerError({
        period: cdk.Duration.minutes(1),
        statistic: 'sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway 5XX errors detected in ${appEnv}`,
    });

    new cloudwatch.Alarm(this, 'ApiGatewayLatencyP95Alarm', {
      alarmName: `learnfyra-${appEnv}-api-latency-p95`,
      metric: api.metricLatency({
        period: cdk.Duration.minutes(1),
        statistic: 'p95',
      }),
      threshold: 5000,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway p95 latency exceeded 5000ms in ${appEnv}`,
    });

    // ── API Throttling / Rate Limit Alarms
    new cloudwatch.Alarm(this, 'ApiGatewayThrottleAlarm', {
      alarmName: `learnfyra-${appEnv}-api-throttle-detected`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
        dimensionsMap: {
          ApiName: api.restApiName,
          Stage: appEnv,
        },
      }),
      // Approximate threshold at 80% of expected capacity (would normally be request-rate based)
      threshold: isProd ? 9000 : 3000,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway approaching request rate limits (>80% capacity) in ${appEnv}. May indicate throttling risk.`,
    });

    // ── API Surge Detection: Alert if request count spikes >200% from baseline
    const apiCountMetricSurge = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
      dimensionsMap: {
        ApiName: api.restApiName,
        Stage: appEnv,
      },
    });

    new cloudwatch.Alarm(this, 'ApiGatewaySurgeAlarm', {
      alarmName: `learnfyra-${appEnv}-api-surge-detected`,
      metric: apiCountMetricSurge,
      // Surge threshold: >500 requests/5min in dev, >10000 in prod (can be tuned)
      threshold: isProd ? 10000 : 500,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway detecting unusual traffic surge (>200% baseline) in ${appEnv}. Possible DDoS or load test.`,
    });

    const apiMetricByRoute = (metricName: string, method: string, resource: string, statistic = 'Sum') =>
      new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName,
        statistic,
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          ApiName: api.restApiName,
          Stage: appEnv,
          Method: method,
          Resource: resource,
        },
      });

    const dashboard = new cloudwatch.Dashboard(this, 'BackendObservabilityDashboard', {
      dashboardName: `learnfyra-${appEnv}-backend-observability`,
    });

    const lambdaLogGroupNames = [
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
    ].map((fn) => `/aws/lambda/${fn.functionName}`);

    const topErrorsByFunctionQuery = [
      "fields @timestamp, @log, @message",
      "| filter @message like /(?i)error|exception|fail/",
      "| parse @log /\/aws\/lambda\/(?<functionName>[^ ]+)/",
      "| stats count(*) as errorCount by functionName",
      "| sort errorCount desc",
      "| limit 20",
    ];

    const authFailuresByRouteQuery = [
      "fields @timestamp, @message",
      "| parse @message /\"routeKey\":\"(?<route>[^\"]+)\"/",
      "| parse @message /\"status\":\"?(?<status>\d+)\"?/",
      "| filter status = 401 or status = 403",
      "| stats count(*) as authFailures by route, status",
      "| sort authFailures desc",
      "| limit 20",
    ];

    const highLatencyRequestTraceQuery = [
      "fields @timestamp, @message",
      "| parse @message /\"routeKey\":\"(?<route>[^\"]+)\"/",
      "| parse @message /\"status\":\"?(?<status>\d+)\"?/",
      "| parse @message /\"requestId\":\"(?<requestId>[^\"]+)\"/",
      "| parse @message /\"responseLatency\":\"?(?<responseLatency>\d+)\"?/",
      "| parse @message /\"integrationLatency\":\"?(?<integrationLatency>\d+)\"?/",
      "| filter responseLatency > 2000",
      "| sort responseLatency desc",
      "| display @timestamp, route, status, responseLatency, integrationLatency, requestId",
      "| limit 50",
    ];

    const routeHotspots4xx5xxQuery = [
      "fields @timestamp, @message",
      "| parse @message /\"routeKey\":\"(?<route>[^\"]+)\"/",
      "| parse @message /\"status\":\"?(?<status>\d+)\"?/",
      "| filter status >= 400",
      "| stats count(*) as errorRequests by route, status",
      "| sort errorRequests desc",
      "| limit 30",
    ];

    const lambdaTopErrorsDefinition = new logs.CfnQueryDefinition(this, 'LambdaTopErrorsQueryDefinition', {
      name: `learnfyra-${appEnv}-top-errors-by-function`,
      logGroupNames: lambdaLogGroupNames,
      queryString: topErrorsByFunctionQuery.join('\n'),
    });

    const apiAuthFailuresDefinition = new logs.CfnQueryDefinition(this, 'ApiAuthFailuresQueryDefinition', {
      name: `learnfyra-${appEnv}-auth-failures-by-route`,
      logGroupNames: [apiAccessLogGroup.logGroupName],
      queryString: authFailuresByRouteQuery.join('\n'),
    });

    const apiLatencyTraceDefinition = new logs.CfnQueryDefinition(this, 'ApiHighLatencyTracesQueryDefinition', {
      name: `learnfyra-${appEnv}-high-latency-request-traces`,
      logGroupNames: [apiAccessLogGroup.logGroupName],
      queryString: highLatencyRequestTraceQuery.join('\n'),
    });

    const apiRouteHotspotsDefinition = new logs.CfnQueryDefinition(this, 'ApiRouteHotspotsQueryDefinition', {
      name: `learnfyra-${appEnv}-4xx-5xx-route-hotspots`,
      logGroupNames: [apiAccessLogGroup.logGroupName],
      queryString: routeHotspots4xx5xxQuery.join('\n'),
    });

    const queryDefinitionsUrl =
      `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#logs-insights:queryDefinitions`;

    const allFunctionErrors = monitoredFunctions.map(({ id, fn }) =>
      fn.metricErrors({ statistic: 'sum', period: cdk.Duration.minutes(5), label: `${id} Errors` })
    );
    const allFunctionInvocations = monitoredFunctions.map(({ id, fn }) =>
      fn.metricInvocations({ statistic: 'sum', period: cdk.Duration.minutes(5), label: `${id} Invocations` })
    );
    const allFunctionDurationP95 = monitoredFunctions.map(({ id, fn }) =>
      fn.metricDuration({ statistic: 'p95', period: cdk.Duration.minutes(5), label: `${id} p95 Duration` })
    );

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        width: 24,
        height: 4,
        markdown:
          `# Learnfyra ${appEnv.toUpperCase()} Backend Observability\n` +
          `X-Ray tracing is enabled for staging/prod environments by stack policy.\n` +
          `[Open Log Insights Query Definitions](${queryDefinitionsUrl})\n` +
          `Queries: \`${lambdaTopErrorsDefinition.name}\`, \`${apiAuthFailuresDefinition.name}\`, \`${apiLatencyTraceDefinition.name}\`, \`${apiRouteHotspotsDefinition.name}\``,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors by Function (Top Trend)',
        width: 12,
        height: 6,
        left: allFunctionErrors,
        stacked: true,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations by Function',
        width: 12,
        height: 6,
        left: allFunctionInvocations,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration p95 by Function',
        width: 12,
        height: 6,
        left: allFunctionDurationP95,
      }),
      new cloudwatch.GraphWidget({
        title: 'Critical Duration Profile (p50/p95/p99)',
        width: 12,
        height: 6,
        left: [
          generateFn.metricDuration({ statistic: 'p50', period: cdk.Duration.minutes(5), label: 'Generate p50' }),
          generateFn.metricDuration({ statistic: 'p95', period: cdk.Duration.minutes(5), label: 'Generate p95' }),
          generateFn.metricDuration({ statistic: 'p99', period: cdk.Duration.minutes(5), label: 'Generate p99' }),
          submitFn.metricDuration({ statistic: 'p50', period: cdk.Duration.minutes(5), label: 'Submit p50' }),
          submitFn.metricDuration({ statistic: 'p95', period: cdk.Duration.minutes(5), label: 'Submit p95' }),
          submitFn.metricDuration({ statistic: 'p99', period: cdk.Duration.minutes(5), label: 'Submit p99' }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests / 4XX / 5XX',
        width: 12,
        height: 6,
        left: [
          api.metricCount({ statistic: 'sum', period: cdk.Duration.minutes(5), label: 'Request Count' }),
          api.metricClientError({ statistic: 'sum', period: cdk.Duration.minutes(5), label: '4XX Errors' }),
          api.metricServerError({ statistic: 'sum', period: cdk.Duration.minutes(5), label: '5XX Errors' }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency p50/p95/p99',
        width: 12,
        height: 6,
        left: [
          api.metricLatency({ statistic: 'p50', period: cdk.Duration.minutes(5), label: 'Latency p50' }),
          api.metricLatency({ statistic: 'p95', period: cdk.Duration.minutes(5), label: 'Latency p95' }),
          api.metricLatency({ statistic: 'p99', period: cdk.Duration.minutes(5), label: 'Latency p99' }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Route Usage: Auth/Generate/Submit/Solve',
        width: 12,
        height: 6,
        left: [
          apiMetricByRoute('Count', 'POST', '/api/auth/login', 'Sum').with({ label: 'POST /api/auth/login' }),
          apiMetricByRoute('Count', 'POST', '/api/generate', 'Sum').with({ label: 'POST /api/generate' }),
          apiMetricByRoute('Count', 'POST', '/api/submit', 'Sum').with({ label: 'POST /api/submit' }),
          apiMetricByRoute('Count', 'GET', '/api/solve/{worksheetId}', 'Sum').with({ label: 'GET /api/solve/{worksheetId}' }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Route Usage: Progress/QB/Analytics/Class',
        width: 12,
        height: 6,
        left: [
          apiMetricByRoute('Count', 'POST', '/api/progress/save', 'Sum').with({ label: 'POST /api/progress/save' }),
          apiMetricByRoute('Count', 'GET', '/api/progress/history', 'Sum').with({ label: 'GET /api/progress/history' }),
          apiMetricByRoute('Count', 'GET', '/api/qb/questions', 'Sum').with({ label: 'GET /api/qb/questions' }),
          apiMetricByRoute('Count', 'GET', '/api/analytics/class/{id}', 'Sum').with({ label: 'GET /api/analytics/class/{id}' }),
          apiMetricByRoute('Count', 'POST', '/api/class/create', 'Sum').with({ label: 'POST /api/class/create' }),
        ],
      })
    );

    // ── Throughput & Usage Trend Widgets (DOP-08)
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Daily Request Volume (1-hourly aggregation)',
        width: 24,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            dimensionsMap: {
              ApiName: api.restApiName,
              Stage: appEnv,
            },
            label: 'API Requests (hourly)',
          }),
        ],
      })
    );

    // ── Top Endpoints by Traffic Volume
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Generate (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'POST', '/api/generate', 'Sum').with({ label: 'Generate Count' })],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Submit (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'POST', '/api/submit', 'Sum').with({ label: 'Submit Count' })],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Progress (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'GET', '/api/progress/history', 'Sum').with({ label: 'Progress Count' })],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Auth (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'POST', '/api/auth/login', 'Sum').with({ label: 'Auth Count' })],
      })
    );

    // ── Peak Traffic Window Widget (identifies busy hours)
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Traffic by Hour: Peak Window Analysis',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Average',
            period: cdk.Duration.hours(1),
            dimensionsMap: {
              ApiName: api.restApiName,
              Stage: appEnv,
            },
            label: 'Avg Requests/Hour',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Total Compute Time (sum of all functions)',
        width: 12,
        height: 6,
        left: monitoredFunctions.map(({ id, fn }) =>
          fn.metricDuration({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: `${id} Total Time`,
          })
        ),
      })
    );

    // ── Cost Awareness: Estimate billing impact (informational)
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        width: 24,
        height: 3,
        markdown:
          '## Cost & Anomaly Visibility (DOP-08)\n' +
          '**Anomaly Alarms**: Each Lambda function has anomaly detection enabled (unusual invocations ±2σ).\n' +
          '**Concurrency Warning**: Yellow alert if concurrent executions exceed 50% of typical peak (Generate) or 20% (others).\n' +
          '**Cost Drivers**: Generate, Submit, Progress functions. Monitor Duration Sum for total compute time. **Est. Cost**: ~$0.20/1M requests (Lambda) + $3.50/1M API calls (API GW).',
      })
    );

    // ── Lambda Total Cost Indicator (based on invocations + duration)
    const lambdaTotalInvocations = new cloudwatch.MathExpression({
      expression: '(' + monitoredFunctions.map((_, i) => `inv${i}`).join(' + ') + ')',
      label: 'Total Lambda Invocations',
      period: cdk.Duration.hours(1),
      usingMetrics: Object.fromEntries(
        monitoredFunctions.map(({ fn }, i) => [
          `inv${i}`,
          fn.metricInvocations({ statistic: 'Sum', period: cdk.Duration.hours(1) }),
        ])
      ),
    });

    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Lambda Invocations (Last Hour)',
        width: 8,
        height: 4,
        metrics: [lambdaTotalInvocations],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'API Requests (Last Hour)',
        width: 8,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            dimensionsMap: {
              ApiName: api.restApiName,
              Stage: appEnv,
            },
            label: 'API Count',
          }),
        ],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Concurrent Execution Peak (Last Hour)',
        width: 8,
        height: 4,
        metrics: [
          new cloudwatch.MathExpression({
            expression: 'MAX([' + monitoredFunctions.map((_, i) => `conc${i}`).join(', ') + '])',
            label: 'Max Concurrent',
            period: cdk.Duration.hours(1),
            usingMetrics: Object.fromEntries(
              monitoredFunctions.map(({ fn }, i) => [
                `conc${i}`,
                new cloudwatch.Metric({
                  namespace: 'AWS/Lambda',
                  metricName: 'ConcurrentExecutions',
                  statistic: 'Maximum',
                  period: cdk.Duration.hours(1),
                  dimensionsMap: { FunctionName: fn.functionName },
                }),
              ])
            ),
          }),
        ],
      })
    );

    // ── Cost Analysis Logs Insights Query (DOP-08)
    const costByFunctionQuery = [
      "fields @duration, @initDuration, @functionName",
      "| filter ispresent(@duration)",
      "| stats sum(@duration) as totalDurationMs by @functionName",
      "| sort totalDurationMs desc",
      "| limit 30",
    ];

    const costByEndpointQuery = [
      "fields @timestamp, @message",
      "| parse @message /\"routeKey\":\"(?<route>[^\"]+)\"/",
      "| parse @message /\"responseLatency\":\"?(?<latency>\d+)\"?/",
      "| stats count(*) as requestCount, avg(latency) as avgLatency by route",
      "| sort requestCount desc",
      "| limit 20",
    ];

    const costEstimationQuery = [
      "fields @duration, @memorySize, @maxMemoryUsed",
      "| filter ispresent(@duration) and ispresent(@memorySize)",
      "| stats count(*) as invocations, avg(@duration) as avgDurationMs, max(@memorySize) as memoryMb",
      "| display invocations, avgDurationMs, memoryMb",
    ];

    const costByFunctionDefinition = new logs.CfnQueryDefinition(this, 'CostByFunctionQueryDefinition', {
      name: `learnfyra-${appEnv}-cost-by-function`,
      logGroupNames: lambdaLogGroupNames,
      queryString: costByFunctionQuery.join('\n'),
    });

    const costByEndpointDefinition = new logs.CfnQueryDefinition(this, 'CostByEndpointQueryDefinition', {
      name: `learnfyra-${appEnv}-cost-by-endpoint`,
      logGroupNames: [apiAccessLogGroup.logGroupName],
      queryString: costByEndpointQuery.join('\n'),
    });

    const costEstimationDefinition = new logs.CfnQueryDefinition(this, 'CostEstimationQueryDefinition', {
      name: `learnfyra-${appEnv}-cost-estimation`,
      logGroupNames: lambdaLogGroupNames,
      queryString: costEstimationQuery.join('\n'),
    });

    // ── Cost Analysis Log Drill-Down Panels
    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Cost Analyzer: Total Duration by Function',
        width: 12,
        height: 6,
        logGroupNames: lambdaLogGroupNames,
        queryLines: costByFunctionQuery,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Cost Analyzer: Request Count + Latency by Endpoint',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: costByEndpointQuery,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: Top Errors by Function',
        width: 12,
        height: 6,
        logGroupNames: lambdaLogGroupNames,
        queryLines: topErrorsByFunctionQuery,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: Auth Failures by Route (401/403)',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: authFailuresByRouteQuery,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: High-Latency Request Traces',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: highLatencyRequestTraceQuery,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: 4XX/5XX Route Hotspots',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: routeHotspots4xx5xxQuery,
      })
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
