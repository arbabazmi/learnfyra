/**
 * @file infra/cdk/lib/nested/waf-stack.ts
 * @description NestedStack: WAF WebACL + association (prod only).
 *              Estimated CloudFormation resources: ~2
 *
 * Cycle-breaking strategy:
 *   Receives apiStageArn as a plain string instead of the RestApi object.
 *   No CloudFormation cross-stack Ref to ApiStack is created.
 */

import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { BaseNestedStackProps } from '../types';

export interface WafStackProps extends BaseNestedStackProps {
  /**
   * API Gateway deployment stage ARN passed as a plain string from ApiStack
   * outputs. No CFn Ref to ApiStack is introduced — this breaks the Waf → Api
   * dependency that would otherwise be a cross-stack reference.
   */
  apiStageArn: string;
}

export class WafStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    const { appEnv, apiStageArn } = props;

    // Cost: ~$2/mo (1 WebACL $5 base already paid + 2 custom rules + 1 managed group)
    const wafAcl = new wafv2.CfnWebACL(this, 'GuestRateLimitACL', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `LearnfyraWAF-${appEnv}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rule 1: Rate limit guest token issuance — 20 req/5min per IP
        {
          name: 'GuestTokenIssuerRateLimit',
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `GuestTokenIssuerRateLimit-${appEnv}`,
            sampledRequestsEnabled: true,
          },
          statement: {
            rateBasedStatement: {
              limit: 20,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'CONTAINS',
                  searchString: '/auth/guest',
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              },
            },
          },
        },
        // Rule 2: Rate limit /api/generate — 100 req/5min per IP (protects Claude API costs)
        {
          name: 'GenerateEndpointRateLimit',
          priority: 2,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `GenerateRateLimit-${appEnv}`,
            sampledRequestsEnabled: true,
          },
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'CONTAINS',
                  searchString: '/api/generate',
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              },
            },
          },
        },
        // Rule 3: AWS Managed — Common Rule Set (OWASP top 10: SQLi, XSS, bad inputs, Log4Shell)
        {
          name: 'AWSCommonRuleSet',
          priority: 10,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `AWSCommonRuleSet-${appEnv}`,
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'GuestRateLimitACLAssociation', {
      resourceArn: apiStageArn,
      webAclArn: wafAcl.attrArn,
    });
  }
}
