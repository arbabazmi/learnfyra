/**
 * @file infra/cdk/lib/nested/cdn-stack.ts
 * @description NestedStack: CloudFront distribution + security response headers policy.
 *              Estimated CloudFormation resources: ~7
 *
 * Cycle-breaking strategy:
 *   - OAI is created in StorageStack and passed as a prop. CdnStack does NOT
 *     call frontendBucket.grantRead() — that was already done in StorageStack.
 *     This prevents Storage → Cdn cross-stack bucket policy ref.
 *   - API Gateway is referenced as a plain restApiId string rather than the
 *     RestApi object. The execute domain is constructed locally from the string
 *     so no CloudFormation Ref to ApiStack is emitted by this stack.
 *     Cdn → Api is one-directional (string value flows parent → Cdn at synth
 *     time only), completing the acyclic dependency graph.
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { BaseNestedStackProps, CdnOutputs } from '../types';

export interface CdnStackProps extends BaseNestedStackProps {
  frontendBucket: s3.Bucket;
  /**
   * OAI created in StorageStack. frontendBucket.grantRead(oai) was already
   * called there. Do NOT call grantRead here — it would add a Storage → Cdn
   * cross-stack dependency via the bucket policy resource.
   */
  frontendOai: cloudfront.OriginAccessIdentity;
  /**
   * The REST API ID string (e.g. "abc123xyz"). The execute-api domain is
   * constructed as `${apiRestApiId}.execute-api.${region}.amazonaws.com`.
   * Passing a string avoids a CloudFormation Ref to ApiStack from this stack.
   */
  apiRestApiId: string;
  isProd: boolean;
  isDev: boolean;
  enableCustomDomains: boolean;
  webDomainName?: string;
  wwwDomainName?: string;
  adminDomainName?: string;
  /** ACM certificate ARN (us-east-1, required for CloudFront when custom domains enabled) */
  cloudFrontCertificateArn?: string;
  /** Route53 hosted zone — required when enableCustomDomains is true */
  zone?: route53.IHostedZone;
}

export class CdnStack extends cdk.NestedStack {
  public readonly outputs: CdnOutputs;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    const { appEnv, frontendBucket, frontendOai, apiRestApiId, isProd, enableCustomDomains } = props;

    // API Gateway execute domain — built from the plain string restApiId.
    // No CloudFormation Ref to ApiStack is introduced by this line.
    const apiGatewayExecuteDomain = `${apiRestApiId}.execute-api.${this.region}.amazonaws.com`;

    // Security response headers — HSTS, X-Frame-Options, CSP-adjacent protections
    const securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'SecurityHeadersPolicy',
      {
        responseHeadersPolicyName: `learnfyra-${appEnv}-security-headers`,
        securityHeadersBehavior: {
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.seconds(63072000),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
      }
    );

    let cloudFrontCertificate: acm.ICertificate | undefined;
    if (enableCustomDomains && props.cloudFrontCertificateArn) {
      cloudFrontCertificate = acm.Certificate.fromCertificateArn(
        this,
        'CloudFrontCertificate',
        props.cloudFrontCertificateArn
      );
    }

    const distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      comment: `learnfyra-${appEnv}-cloudfront`,
      defaultRootObject: 'index.html',
      domainNames:
        enableCustomDomains && props.webDomainName
          ? isProd
            ? [props.webDomainName, props.wwwDomainName!, props.adminDomainName!].filter(Boolean)
            : [props.webDomainName, props.adminDomainName!].filter(Boolean)
          : undefined,
      certificate: cloudFrontCertificate,
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, { originAccessIdentity: frontendOai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        responseHeadersPolicy: securityHeadersPolicy,
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
          responseHeadersPolicy: securityHeadersPolicy,
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

    // ── Route53 alias records for CloudFront (web, www, admin) ─────────────
    // These live in CdnStack (which owns the distribution) rather than ApiStack
    // to avoid an Api → Cdn cross-stack ref that would create a cycle with
    // the existing Cdn → Api ref (via apiRestApiId).
    if (enableCustomDomains && props.zone) {
      if (props.webDomainName) {
        new route53.ARecord(this, 'WebDomainRecord', {
          zone: props.zone,
          recordName: props.webDomainName,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.CloudFrontTarget(distribution)
          ),
        });
      }

      if (props.isProd && props.wwwDomainName) {
        new route53.ARecord(this, 'WwwDomainRecord', {
          zone: props.zone,
          recordName: props.wwwDomainName,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.CloudFrontTarget(distribution)
          ),
        });
      }

      if (props.adminDomainName) {
        new route53.ARecord(this, 'AdminDomainRecord', {
          zone: props.zone,
          recordName: props.adminDomainName,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.CloudFrontTarget(distribution)
          ),
        });
      }
    }

    this.outputs = { distribution };
  }
}
