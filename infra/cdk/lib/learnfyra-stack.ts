/**
 * @file infra/cdk/lib/learnfyra-stack.ts
 * @description Parent stack — thin orchestrator that instantiates NestedStacks and
 *              wires cross-stack references via props.
 *
 * Resource budget (CloudFormation 500-resource limit applies per nested stack):
 *   StorageStack      ~60   (S3 x2, DDB x24, OAI, seed custom resources)
 *   AuthStack          ~5   (Cognito UserPool, IdP, domain, client)
 *   ComputeStack     ~145   (17 Lambda functions + IAM policies)
 *   ApiStack         ~324   (RestApi + all routes + authorizer + gateway responses)
 *   CdnStack           ~6   (CloudFront + security headers policy)
 *   MonitoringStack   ~72   (45 alarms + dashboard + 7 log query definitions)
 *   WafStack           ~2   (WebACL + association — prod only)
 *
 * Acyclic dependency graph (DAG — no cycles):
 *   Storage  (no deps)
 *   Auth     (no deps)
 *   Compute  → Storage, Auth
 *   Api      → Compute  (via imported function ARNs — no back-ref to Compute)
 *   Cdn      → Storage  (OAI + bucket), Api (restApiId string — one-directional)
 *   Monitoring → Compute (function metrics), Api (plain string name + log group name)
 *   Waf      → Api (deploymentStageArn string — no CFn Ref back to ApiStack)
 *
 * Cycle-breaking techniques applied:
 *   1. Storage → Cdn (was): OAI moved to StorageStack; grantRead called there.
 *      CdnStack receives OAI as a prop and uses it without calling grantRead.
 *   2. Compute ↔ Api (was): ApiStack receives ComputeFunctionArns (plain strings)
 *      and imports each via lambda.Function.fromFunctionArn(). Lambda::Permission
 *      resources land in ApiStack (the importer), not ComputeStack (the owner).
 *   3. Compute → Cdn (was): oauthCallbackBaseUrl computed statically in this
 *      parent before ComputeStack is created; passed as a prop to ComputeStack
 *      which sets OAUTH_CALLBACK_BASE_URL on authFn internally. No post-wire.
 *   4. Monitoring → Api (was): MonitoringStack receives restApiName and
 *      apiAccessLogGroupName as plain strings; CloudWatch metrics built with
 *      cloudwatch.Metric dimensionsMap using those string literals.
 *   5. Waf → Api (was): WafStack receives apiStageArn as a plain string.
 */

import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

import { StorageStack } from './nested/storage-stack';
import { AuthStack } from './nested/auth-stack';
import { ComputeStack } from './nested/compute-stack';
import { ApiStack } from './nested/api-stack';
import { CdnStack } from './nested/cdn-stack';
import { MonitoringStack } from './nested/monitoring-stack';
import { WafStack } from './nested/waf-stack';

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

    this.templateOptions.description =
      `Learnfyra ${appEnv} stack: API, Lambda handlers, Cognito auth, CloudFront, and S3 assets`;

    if (enableCustomDomains && (!props.rootDomainName || !props.hostedZoneId)) {
      throw new Error(
        'Custom domains enabled but rootDomainName/hostedZoneId not provided in stack props.'
      );
    }

    // ── Domain name computations ──────────────────────────────────────────────
    const rootDomainName = props.rootDomainName;
    const hostedZoneId = props.hostedZoneId;

    const apiDomainName = rootDomainName
      ? isProd ? `api.${rootDomainName}` : `api.${dnsEnvLabel}.${rootDomainName}`
      : undefined;
    const webDomainName = rootDomainName
      ? isProd ? `${rootDomainName}` : `web.${dnsEnvLabel}.${rootDomainName}`
      : undefined;
    const wwwDomainName = rootDomainName ? `www.${rootDomainName}` : undefined;
    const adminDomainName = rootDomainName
      ? isProd ? `admin.${rootDomainName}` : `admin.${dnsEnvLabel}.${rootDomainName}`
      : undefined;
    const authDomainName = rootDomainName
      ? isProd ? `auth.${rootDomainName}` : `auth.${dnsEnvLabel}.${rootDomainName}`
      : undefined;

    const zone: route53.IHostedZone | undefined =
      enableCustomDomains && rootDomainName && hostedZoneId
        ? route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            zoneName: rootDomainName,
            hostedZoneId,
          })
        : undefined;

    const allowedOrigin = isDev
      ? '*'
      : enableCustomDomains && webDomainName
      ? `https://${webDomainName}`
      : '*';

    // ── OAUTH_CALLBACK_BASE_URL — computed statically BEFORE ComputeStack ─────
    // When custom domains are enabled, the callback URL is deterministic from
    // webDomainName (known at synth time, no CFn dependency on CdnStack).
    // When custom domains are disabled, the CloudFront domain is not known
    // until runtime — pass '*' as a placeholder; authFn will construct the
    // redirect URL dynamically using request headers at runtime.
    const oauthCallbackBaseUrl = enableCustomDomains && webDomainName
      ? `https://${webDomainName}`
      : '*';

    // ── Tags ─────────────────────────────────────────────────────────────────
    cdk.Tags.of(this).add('Project', 'learnfyra');
    cdk.Tags.of(this).add('Application', 'learnfyra');
    cdk.Tags.of(this).add('Env', appEnv);
    cdk.Tags.of(this).add('Environment', appEnv);
    cdk.Tags.of(this).add('Stage', appEnv);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Repository', 'arbabazmi/learnfyra');
    cdk.Tags.of(this).add('Workload', 'serverless');

    // Cognito OAuth URLs by environment
    const cognitoOAuthUrlsByEnv: Record<
      'dev' | 'staging' | 'prod',
      { callbackUrls: string[]; logoutUrls: string[] }
    > = {
      dev: {
        callbackUrls: [
          'https://web.dev.learnfyra.com/api/auth/callback/google',
          'http://localhost:5173/api/auth/callback/google',
        ],
        logoutUrls: [
          'https://dev.learnfyra.com',
          'https://web.dev.learnfyra.com',
          'http://localhost:5173',
        ],
      },
      staging: {
        callbackUrls: [
          'https://qa.learnfyra.com/api/auth/callback/google',
          'https://web.qa.learnfyra.com/api/auth/callback/google',
          'http://localhost:5173/api/auth/callback/google',
        ],
        logoutUrls: [
          'https://qa.learnfyra.com',
          'https://web.qa.learnfyra.com',
          'http://localhost:5173',
        ],
      },
      prod: {
        callbackUrls: [
          'https://learnfyra.com/api/auth/callback/google',
          'https://www.learnfyra.com/api/auth/callback/google',
        ],
        logoutUrls: ['https://learnfyra.com', 'https://www.learnfyra.com'],
      },
    };

    // ── 1. Storage ────────────────────────────────────────────────────────────
    const storage = new StorageStack(this, 'Storage', { appEnv });

    // ── 2. Auth ───────────────────────────────────────────────────────────────
    const auth = new AuthStack(this, 'Auth', {
      appEnv,
      oauthUrls: cognitoOAuthUrlsByEnv[appEnv],
    });

    // ── 3. Compute ────────────────────────────────────────────────────────────
    // oauthCallbackBaseUrl is computed above from static domain strings so no
    // Compute → Cdn cross-stack dependency forms.
    const compute = new ComputeStack(this, 'Compute', {
      appEnv,
      storage: storage.outputs,
      auth: auth.outputs,
      allowedOrigin,
      oauthCallbackBaseUrl,
    });

    // ── 4. API (RestApi + all routes + authorizer) ────────────────────────────
    // ApiStack receives ComputeFunctionArns (plain ARN strings) — not the
    // NodejsFunction objects. Lambda::Permission lands in ApiStack only.
    const apiStack = new ApiStack(this, 'Api', {
      appEnv,
      computeArns: compute.functionArns,
      allowedOrigin,
      enableCustomDomains,
      isDev,
      isProd,
      apiCertificateArn: props.apiCertificateArn,
      apiDomainName,
      zone,
      webDomainName,
      wwwDomainName,
      adminDomainName,
      authDomainName,
    });

    // ── 5. CDN ────────────────────────────────────────────────────────────────
    // OAI comes from StorageStack (already grantRead'd there).
    // apiRestApiId is a plain string from ApiStack outputs — creates a one-
    // directional Cdn → Api dependency, but no back-reference from Api → Cdn.
    const cdn = new CdnStack(this, 'Cdn', {
      appEnv,
      frontendBucket: storage.outputs.frontendBucket,
      frontendOai: storage.outputs.frontendOai,
      apiRestApiId: apiStack.outputs.api.restApiId,
      isProd,
      enableCustomDomains,
      webDomainName,
      wwwDomainName,
      adminDomainName,
      cloudFrontCertificateArn: props.cloudFrontCertificateArn,
    });

    // ── Post-wire: pass distribution to ApiStack for Route53 web/www/admin records
    if (enableCustomDomains && zone) {
      apiStack.addCdnRoute53Records(cdn.outputs.distribution, {
        zone,
        webDomainName,
        wwwDomainName,
        adminDomainName,
        isProd,
        isDev,
        authDomainName,
        apiDomainName,
      });
    }

    // ── 6. Monitoring ─────────────────────────────────────────────────────────
    // restApiName and apiAccessLogGroupName passed as plain strings — no CFn Ref
    // from MonitoringStack back to ApiStack.
    new MonitoringStack(this, 'Monitoring', {
      appEnv,
      restApiName: apiStack.outputs.restApiName,
      apiAccessLogGroupName: apiStack.outputs.apiAccessLogGroup.logGroupName,
      compute: compute.outputs,
      isDev,
      isProd,
    });

    // ── 7. WAF (prod only) ────────────────────────────────────────────────────
    // apiStageArn passed as a plain string — no CFn Ref from WafStack to ApiStack.
    if (isProd) {
      new WafStack(this, 'Waf', {
        appEnv,
        apiStageArn: apiStack.outputs.deploymentStageArn,
      });
    }

    // ── CloudFormation Outputs ────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${cdn.outputs.distribution.distributionDomainName}`,
      description: 'CloudFront URL (open this in your browser)',
      exportName: `learnfyra-${appEnv}-frontend-url`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: cdn.outputs.distribution.distributionId,
      description: 'CloudFront distribution ID (for cache invalidation)',
      exportName: `learnfyra-${appEnv}-cloudfront-id`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: apiStack.outputs.api.url,
      description: 'API Gateway URL',
      exportName: `learnfyra-${appEnv}-apigw-url`,
    });

    new cdk.CfnOutput(this, 'WorksheetBucketName', {
      value: storage.outputs.worksheetBucket.bucketName,
      description: 'Worksheet S3 bucket name',
      exportName: `learnfyra-${appEnv}-s3-worksheets-name`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: storage.outputs.frontendBucket.bucketName,
      description: 'Frontend S3 bucket name',
      exportName: `learnfyra-${appEnv}-s3-frontend-name`,
    });

    if (enableCustomDomains && webDomainName) {
      new cdk.CfnOutput(this, 'FrontendCustomDomain', {
        value: webDomainName,
        description: 'Frontend custom domain for this environment',
      });

      if (adminDomainName) {
        new cdk.CfnOutput(this, 'AdminCustomDomain', {
          value: adminDomainName,
          description: 'Admin custom domain for this environment',
        });
      }

      if (apiDomainName) {
        new cdk.CfnOutput(this, 'ApiCustomDomainOutput', {
          value: apiDomainName,
          description: 'API custom domain for this environment',
        });
      }

      if (isDev && authDomainName) {
        new cdk.CfnOutput(this, 'AuthCustomDomainDev', {
          value: authDomainName,
          description: 'Auth custom domain for dev environment',
        });
      }
    }
  }
}
