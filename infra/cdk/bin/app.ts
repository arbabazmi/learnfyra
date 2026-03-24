#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EduSheetAiStack } from '../lib/edusheet-stack';

const app = new cdk.App();

const env = (app.node.tryGetContext('env') as string) || 'dev';
if (!['dev', 'staging', 'prod'].includes(env)) {
  throw new Error(`Invalid env "${env}". Must be dev | staging | prod.`);
}

new EduSheetAiStack(app, `EduSheetAiStack-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  appEnv: env as 'dev' | 'staging' | 'prod',
  description: `EduSheet AI — ${env} environment`,
});

app.synth();
