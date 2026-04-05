/**
 * @file infra/cdk/lib/nested/cdn-stack.ts
 * @description NestedStack: CloudFront distribution + OAI + security response headers policy.
 *              Estimated CloudFormation resources: ~7
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { BaseNestedStackProps, CdnOutputs } from '../types';

export interface CdnStackProps extends BaseNestedStackProps {
  frontendBucket: s3.Bucket;
  api: apigateway.RestApi;
  isProd: boolean;
  enableCustomDomains: boolean;
  webDomainName?: string;
  wwwDomainName?: string;
  adminDomainName?: string;
  /** ACM certificate ARN (us-east-1, required for CloudFront when custom domains enabled) */
  cloudFrontCertificateArn?: string;
}

export class CdnStack extends cdk.NestedStack {
  public readonly outputs: CdnOutputs;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    const { appEnv, frontendBucket, api, isProd, enableCustomDomains } = props;

    // Origin Access Identity — grants CloudFront read access to the private bucket
    const oai = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
      comment: `OAI for learnfyra-${appEnv}-s3-frontend`,
    });
    frontendBucket.grantRead(oai);

    const apiGatewayExecuteDomain = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`;

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
        origin: new origins.S3Origin(frontendBucket, { originAccessIdentity: oai }),
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

    this.outputs = { distribution };
  }
}
