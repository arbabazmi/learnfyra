/**
 * @file infra/cdk/lib/nested/auth-stack.ts
 * @description NestedStack: Cognito UserPool, Google IdP, Hosted UI domain, App Client.
 *              Estimated CloudFormation resources: ~5
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { BaseNestedStackProps, AuthOutputs } from '../types';

export interface AuthStackProps extends BaseNestedStackProps {
  oauthUrls: { callbackUrls: string[]; logoutUrls: string[] };
}

export class AuthStack extends cdk.NestedStack {
  public readonly outputs: AuthOutputs;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { appEnv, oauthUrls } = props;
    const isProd = appEnv === 'prod';
    const dnsEnvLabel = appEnv === 'staging' ? 'qa' : appEnv;
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // Google OAuth Client IDs per environment (public identifiers — not secrets)
    const googleClientIds: Record<string, string> = {
      dev:     '1079696386286-m95l3vrmh157sgji4njii0afftoglc9b.apps.googleusercontent.com',
      staging: '1079696386286-hjn155lvlt8sr4cc0g1e3f8mfvs6mgbk.apps.googleusercontent.com',
      prod:    '1079696386286-edsmfmdk6j8073qnm05uii6b2c6o655o.apps.googleusercontent.com',
    };

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `learnfyra-${appEnv}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      removalPolicy,
    });

    const googleIdp = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdp', {
      userPool,
      clientId: googleClientIds[appEnv],
      clientSecretValue: cdk.SecretValue.secretsManager(
        `/learnfyra/${dnsEnvLabel}/google-client-secret`
      ),
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
      },
    });

    const userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool,
      cognitoDomain: { domainPrefix: `learnfyra-${appEnv}` },
    });

    // Construct full Cognito domain URL — region resolves at deploy time
    const cognitoDomainUrl = `https://learnfyra-${appEnv}.auth.${this.region}.amazoncognito.com`;

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
        callbackUrls: oauthUrls.callbackUrls,
        logoutUrls: oauthUrls.logoutUrls,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
    });

    // App client must be created after the IdP exists
    userPoolClient.node.addDependency(googleIdp);
    // Suppress unused variable warning — domain is a required CDK construct
    void userPoolDomain;

    const jwtSecretValue = cdk.SecretValue.secretsManager(
      `/learnfyra/${dnsEnvLabel}/jwt-secret`
    ).unsafeUnwrap();

    this.outputs = {
      userPool,
      userPoolClient,
      cognitoDomainUrl,
      jwtSecretValue,
    };
  }
}
