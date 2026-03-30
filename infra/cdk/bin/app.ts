#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LearnfyraStack } from '../lib/learnfyra-stack';

const app = new cdk.App();

const env = (app.node.tryGetContext('env') as string) || 'dev';
const rootDomainName = app.node.tryGetContext('rootDomainName') as string | undefined;
const hostedZoneId = app.node.tryGetContext('hostedZoneId') as string | undefined;
const cloudFrontCertificateArn = app.node.tryGetContext('cloudFrontCertificateArn') as string | undefined;
const apiCertificateArn = app.node.tryGetContext('apiCertificateArn') as string | undefined;
const enableCustomDomains =
  (app.node.tryGetContext('enableCustomDomains') as string | undefined) === 'true';
if (!['dev', 'staging', 'prod'].includes(env)) {
  throw new Error(`Invalid env "${env}". Must be dev | staging | prod.`);
}

new LearnfyraStack(app, `LearnfyraStack-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  appEnv: env as 'dev' | 'staging' | 'prod',
  rootDomainName,
  hostedZoneId,
  enableCustomDomains,
  cloudFrontCertificateArn,
  apiCertificateArn,
  description: `Learnfyra — ${env} environment`,
});

app.synth();
