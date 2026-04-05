/**
 * @file infra/cdk/lib/nested/api-stack.ts
 * @description NestedStack: API Gateway RestApi + all routes/methods + authorizer
 *              + gateway responses + custom domain (optional).
 *              Estimated CloudFormation resources: ~324
 *
 * NOTE: CDK places all API Gateway resources in the stack that owns the RestApi,
 * regardless of where addResource() is called. Splitting routes across nested
 * stacks is not possible with L2 constructs. If this stack exceeds 500 resources,
 * use L1 CfnResource/CfnMethod in a second stack or request a CloudFormation
 * service quota increase.
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { BaseNestedStackProps, ComputeOutputs, ApiOutputs } from '../types';

export interface ApiStackProps extends BaseNestedStackProps {
  compute: ComputeOutputs;
  allowedOrigin: string;
  enableCustomDomains: boolean;
  isDev: boolean;
  isProd: boolean;
  apiCertificateArn?: string;
  apiDomainName?: string;
  zone?: route53.IHostedZone;
  webDomainName?: string;
  wwwDomainName?: string;
  adminDomainName?: string;
  authDomainName?: string;
}

export interface CdnRoute53RecordsOptions {
  zone: route53.IHostedZone;
  webDomainName?: string;
  wwwDomainName?: string;
  adminDomainName?: string;
  authDomainName?: string;
  apiDomainName?: string;
  isProd: boolean;
  isDev: boolean;
}

export class ApiStack extends cdk.NestedStack {
  public readonly outputs: ApiOutputs;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      appEnv,
      compute,
      allowedOrigin,
      enableCustomDomains,
      isDev,
      isProd,
    } = props;
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ── API Gateway access log group ─────────────────────────────────────────
    const apiAccessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/learnfyra-${appEnv}-access-logs`,
      retention: logs.RetentionDays.THREE_YEARS,
      removalPolicy,
    });

    // ── API Gateway RestApi ───────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `learnfyra-${appEnv}-apigw`,
      description: `Learnfyra API — ${appEnv}`,
      defaultCorsPreflightOptions: {
        allowOrigins: isDev
          ? apigateway.Cors.ALL_ORIGINS
          : enableCustomDomains && props.webDomainName
          ? [`https://${props.webDomainName}`]
          : apigateway.Cors.ALL_ORIGINS,
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

    // ── Gateway responses with CORS headers ───────────────────────────────────
    api.addGatewayResponse('GatewayResponseDefault4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${allowedOrigin}'`,
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
        'Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'",
      },
    });
    api.addGatewayResponse('GatewayResponseDefault5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${allowedOrigin}'`,
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
        'Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'",
      },
    });

    // ── Token authorizer ──────────────────────────────────────────────────────
    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'ApiTokenAuthorizer', {
      handler: compute.apiAuthorizerFn,
      identitySource: apigateway.IdentitySource.header('Authorization'),
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // ── Route tree: Core routes ───────────────────────────────────────────────

    const apiResource = api.root.addResource('api');

    // POST /api/generate
    apiResource
      .addResource('generate')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.generateFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    // GET /api/download
    apiResource
      .addResource('download')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.downloadFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    // /api/auth/*
    const authResource = apiResource.addResource('auth');
    authResource
      .addResource('register')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
      });
    authResource
      .addResource('login')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
      });
    authResource
      .addResource('logout')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    authResource
      .addResource('refresh')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });
    authResource
      .addResource('guest')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
      });
    authResource
      .addResource('forgot-password')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
      });
    authResource
      .addResource('reset-password')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
      });

    authResource
      .addResource('oauth')
      .addResource('{provider}')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
      });

    authResource
      .addResource('callback')
      .addResource('{provider}')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.authFn, { proxy: true }), {
        apiKeyRequired: false,
      });

    // GET /api/guest/preview
    apiResource
      .addResource('guest')
      .addResource('preview')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.guestFixtureFn, { proxy: true }), {
        apiKeyRequired: false,
      });

    // POST /api/submit
    apiResource
      .addResource('submit')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.submitFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    // POST /api/feedback
    apiResource
      .addResource('feedback')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.feedbackFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    // GET /api/solve/{worksheetId}
    apiResource
      .addResource('solve')
      .addResource('{worksheetId}')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.solveFn, { proxy: true }), {
        apiKeyRequired: false,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer: tokenAuthorizer,
      });

    // Helper — most protected routes use the same auth pattern
    const authOpts: apigateway.MethodOptions = {
      apiKeyRequired: false,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: tokenAuthorizer,
    };

    // ── Feature routes ───────────────────────────────────────────────────────

    // /api/progress/*
    const progressResource = apiResource.addResource('progress');
    progressResource
      .addResource('save')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.progressFn, { proxy: true }), authOpts);
    progressResource
      .addResource('history')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.progressFn, { proxy: true }), authOpts);
    progressResource
      .addResource('insights')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.progressFn, { proxy: true }), authOpts);
    progressResource
      .addResource('parent')
      .addResource('{childId}')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.progressFn, { proxy: true }), authOpts);

    // GET /api/worksheets/mine
    apiResource
      .addResource('worksheets')
      .addResource('mine')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.progressFn, { proxy: true }), authOpts);

    // /api/dashboard/*
    const dashboardResource = apiResource.addResource('dashboard');
    dashboardResource
      .addResource('stats')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.dashboardFn, { proxy: true }), authOpts);
    dashboardResource
      .addResource('recent-worksheets')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.dashboardFn, { proxy: true }), authOpts);
    dashboardResource
      .addResource('subject-progress')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.dashboardFn, { proxy: true }), authOpts);

    // /api/class/*
    const classResource = apiResource.addResource('class');
    classResource
      .addResource('create')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.classFn, { proxy: true }), authOpts);
    classResource
      .addResource('{id}')
      .addResource('students')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.classFn, { proxy: true }), authOpts);

    // GET /api/analytics/class/{id}
    apiResource
      .addResource('analytics')
      .addResource('class')
      .addResource('{id}')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.analyticsFn, { proxy: true }), authOpts);

    // /api/rewards/*
    const rewardsResource = apiResource.addResource('rewards');
    rewardsResource
      .addResource('student')
      .addResource('{id}')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.rewardsFn, { proxy: true }), authOpts);
    rewardsResource
      .addResource('class')
      .addResource('{id}')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.rewardsFn, { proxy: true }), authOpts);

    // /api/student/*
    const studentResource = apiResource.addResource('student');
    const studentProfileResource = studentResource.addResource('profile');
    studentProfileResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.studentFn, { proxy: true }),
      authOpts
    );
    studentProfileResource.addMethod(
      'PATCH',
      new apigateway.LambdaIntegration(compute.studentFn, { proxy: true }),
      authOpts
    );
    studentResource
      .addResource('join-class')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.studentFn, { proxy: true }), authOpts);

    // /api/qb/*
    const qbResource = apiResource.addResource('qb');
    const qbQuestionsResource = qbResource.addResource('questions');
    qbQuestionsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    qbQuestionsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    const qbQuestionById = qbQuestionsResource.addResource('{id}');
    qbQuestionById.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    qbQuestionById
      .addResource('reuse')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }), authOpts);

    // /api/certificates/*
    const certificatesResource = apiResource.addResource('certificates');
    certificatesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.certificatesFn, { proxy: true }),
      authOpts
    );
    certificatesResource
      .addResource('{id}')
      .addResource('download')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.certificatesFn, { proxy: true }), authOpts);

    // /api/admin/*
    const adminResource = apiResource.addResource('admin');

    const adminPoliciesResource = adminResource.addResource('policies');
    adminPoliciesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }),
      authOpts
    );
    adminPoliciesResource
      .addResource('model-routing')
      .addMethod('PUT', new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }), authOpts);
    adminPoliciesResource
      .addResource('budget-usage')
      .addMethod('PUT', new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }), authOpts);
    adminPoliciesResource
      .addResource('validation-profile')
      .addMethod('PUT', new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }), authOpts);

    const repeatCapResource = adminPoliciesResource.addResource('repeat-cap');
    repeatCapResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }),
      authOpts
    );
    repeatCapResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }),
      authOpts
    );
    repeatCapResource
      .addResource('overrides')
      .addMethod('PUT', new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }), authOpts);

    adminResource
      .addResource('audit')
      .addResource('events')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.adminPoliciesFn, { proxy: true }), authOpts);

    // /api/admin/guardrails/*
    const adminGuardrailsResource = adminResource.addResource('guardrails');
    const adminGuardrailsPolicyResource = adminGuardrailsResource.addResource('policy');
    adminGuardrailsPolicyResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    adminGuardrailsPolicyResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    const adminGuardrailsTemplatesResource = adminGuardrailsResource.addResource('templates');
    adminGuardrailsTemplatesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    adminGuardrailsTemplatesResource
      .addResource('{level}')
      .addMethod('PUT', new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }), authOpts);
    adminGuardrailsResource
      .addResource('test')
      .addMethod('POST', new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }), authOpts);
    adminGuardrailsResource
      .addResource('audit')
      .addMethod('GET', new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }), authOpts);

    // /api/admin/repeat-cap/*
    const adminRepeatCapResource = adminResource.addResource('repeat-cap');
    adminRepeatCapResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    adminRepeatCapResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    const adminRepeatCapOverrideResource = adminRepeatCapResource.addResource('override');
    adminRepeatCapOverrideResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }),
      authOpts
    );
    adminRepeatCapOverrideResource
      .addResource('{scope}')
      .addResource('{scopeId}')
      .addMethod('DELETE', new apigateway.LambdaIntegration(compute.adminFn, { proxy: true }), authOpts);

    // ── Optional: API Gateway custom domain + API Route53 A record ────────────
    if (enableCustomDomains && props.apiCertificateArn && props.apiDomainName) {
      const apiCertificate = acm.Certificate.fromCertificateArn(
        this,
        'ApiCertificate',
        props.apiCertificateArn
      );

      const apiCustomDomain = new apigateway.DomainName(this, 'ApiCustomDomain', {
        domainName: props.apiDomainName,
        certificate: apiCertificate,
        endpointType: apigateway.EndpointType.REGIONAL,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
      });

      new apigateway.BasePathMapping(this, 'ApiBasePathMapping', {
        domainName: apiCustomDomain,
        restApi: api,
        stage: api.deploymentStage,
      });

      if (props.zone) {
        new route53.ARecord(this, 'ApiDomainRecord', {
          zone: props.zone,
          recordName: props.apiDomainName,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.ApiGatewayDomain(apiCustomDomain)
          ),
        });

        if (props.isDev && props.authDomainName) {
          new route53.CnameRecord(this, 'AuthDomainRecordDev', {
            zone: props.zone,
            recordName: props.authDomainName,
            domainName: props.apiDomainName,
            ttl: cdk.Duration.minutes(5),
          });
        }
      }
    }

    this.outputs = { api, apiAccessLogGroup };
  }

  /**
   * Adds Route53 alias records pointing to the CloudFront distribution for
   * web, www (prod only), and admin subdomains. Called by the parent orchestrator
   * after CdnStack is created.
   */
  public addCdnRoute53Records(
    distribution: cloudfront.Distribution,
    opts: CdnRoute53RecordsOptions
  ): void {
    const { zone, webDomainName, wwwDomainName, adminDomainName, isProd } = opts;

    if (webDomainName) {
      new route53.ARecord(this, 'WebDomainRecord', {
        zone,
        recordName: webDomainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(distribution)
        ),
      });
    }

    if (isProd && wwwDomainName) {
      new route53.ARecord(this, 'WwwDomainRecord', {
        zone,
        recordName: wwwDomainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(distribution)
        ),
      });
    }

    if (adminDomainName) {
      new route53.ARecord(this, 'AdminDomainRecord', {
        zone,
        recordName: adminDomainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(distribution)
        ),
      });
    }
  }
}
