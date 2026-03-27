# Learnfyra Domain Routing Plan (learnfyra.com)

Date: 2026-03-25

## Desired Hostnames

### Dev
- web.dev.learnfyra.com -> frontend
- api.dev.learnfyra.com -> backend APIs
- admin.dev.learnfyra.com -> admin panel
- auth.dev.learnfyra.com -> authentication

### QA (mapped from staging environment)
- web.qa.learnfyra.com
- api.qa.learnfyra.com
- admin.qa.learnfyra.com

### Production
- learnfyra.com -> frontend
- api.learnfyra.com -> backend
- admin.learnfyra.com -> admin

## Routing Model

- Frontend/admin:
  - dev: Route 53 CNAME records to S3 website endpoint (HTTP only, low-cost dev mode)
  - qa/prod: Route 53 alias A records to CloudFront
- API:
  - all environments: API Gateway custom domain + Route 53 alias A record
- Auth (dev):
  - Route 53 CNAME auth.dev.learnfyra.com -> api.dev.learnfyra.com

## Important Constraints

1. QA hostnames are created by deploying the staging stack. The stack maps staging -> qa label for DNS.
2. CloudFront custom domains require an ACM certificate in us-east-1.
3. API Gateway regional custom domains require an ACM certificate in the same region as API Gateway.
4. In current dev cost mode, web.dev/admin.dev use S3 website endpoints and are not HTTPS-terminated by CloudFront.

## CDK Support Added

The stack now supports optional custom-domain provisioning when enabled through CDK context.

Context keys:
- enableCustomDomains=true|false
- rootDomainName=learnfyra.com
- hostedZoneId=YOUR_ROUTE53_HOSTED_ZONE_ID
- cloudFrontCertificateArn=arn:aws:acm:us-east-1:...:certificate/...
- apiCertificateArn=arn:aws:acm:REGION:...:certificate/...

## CDK Deploy Commands

Dev with domains:
```bash
cd infra/cdk
npx cdk deploy --context env=dev \
  --context enableCustomDomains=true \
  --context rootDomainName=learnfyra.com \
  --context hostedZoneId=ZXXXXXXXXXXXXX \
  --context apiCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/API_CERT_ID \
  --require-approval never
```

Staging (QA) with domains:
```bash
cd infra/cdk
npx cdk deploy --context env=staging \
  --context enableCustomDomains=true \
  --context rootDomainName=learnfyra.com \
  --context hostedZoneId=ZXXXXXXXXXXXXX \
  --context cloudFrontCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/CF_CERT_ID \
  --context apiCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/API_CERT_ID \
  --require-approval never
```

Production with domains:
```bash
cd infra/cdk
npx cdk deploy --context env=prod \
  --context enableCustomDomains=true \
  --context rootDomainName=learnfyra.com \
  --context hostedZoneId=ZXXXXXXXXXXXXX \
  --context cloudFrontCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/CF_CERT_ID \
  --context apiCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/API_CERT_ID \
  --require-approval never
```

## Records Created by CDK (When Enabled)

### Dev deploy
- api.dev.learnfyra.com (A alias -> API Gateway custom domain)
- web.dev.learnfyra.com (CNAME -> dev frontend S3 website endpoint)
- admin.dev.learnfyra.com (CNAME -> web.dev.learnfyra.com)
- auth.dev.learnfyra.com (CNAME -> api.dev.learnfyra.com)

### Staging deploy (QA labels)
- api.qa.learnfyra.com (A alias -> API Gateway custom domain)
- web.qa.learnfyra.com (A alias -> CloudFront)
- admin.qa.learnfyra.com (A alias -> CloudFront)

### Production deploy
- api.learnfyra.com (A alias -> API Gateway custom domain)
- learnfyra.com (A alias -> CloudFront)
- admin.learnfyra.com (A alias -> CloudFront)

## Manual Route Option (No CDK DNS Changes)

If you prefer manual DNS management in Route 53, create the same records above manually and skip enableCustomDomains in CDK.

Minimal manual mapping guide:
- Frontend domains -> CloudFront distribution domain (or dev S3 website endpoint)
- API domains -> API Gateway custom domain target
- auth.dev -> CNAME to api.dev

## Validation Checklist

1. dig/nslookup each hostname and verify target resolution.
2. Open web/admin hostnames and verify frontend loads.
3. Call api hostname /api/generate or health endpoint and verify response.
4. Verify CORS origin allowlist includes each deployed frontend/admin domain.
5. Confirm ACM cert status is Issued before deploy.
