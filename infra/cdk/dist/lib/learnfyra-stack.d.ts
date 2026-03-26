import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface LearnfyraStackProps extends cdk.StackProps {
    appEnv: 'dev' | 'staging' | 'prod';
    rootDomainName?: string;
    hostedZoneId?: string;
    enableCustomDomains?: boolean;
    cloudFrontCertificateArn?: string;
    apiCertificateArn?: string;
}
export declare class LearnfyraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: LearnfyraStackProps);
}
