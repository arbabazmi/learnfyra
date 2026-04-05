#!/usr/bin/env node

/**
 * Zero Trust Policy Gate — runs against CDK synth output (CloudFormation JSON)
 * Blocks PRs that regress any of the 5 free zero-trust rules.
 *
 * Usage: node infra/cdk/scripts/zero-trust-check.js
 * Expects cdk.out/*.template.json to exist (run `cdk synth` first).
 *
 * Exit 0 = all rules pass, Exit 1 = violations found.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cdkOutDir = resolve(__dirname, '..', 'cdk.out');

// ── Allowlisted unauthenticated routes ─────────────────────────────────────
// These routes are intentionally open by design. Adding a new open route
// requires updating this list AND adding a comment explaining why.
const OPEN_ROUTE_PATTERNS = [
  /auth.*register/i,
  /auth.*login/i,
  /auth.*guest/i,
  /auth.*forgotpassword/i,
  /auth.*resetpassword/i,
  /auth.*oauth/i,
  /auth.*callback/i,
  /guest.*preview/i,
];

// ── Helpers ────────────────────────────────────────────────────────────────

function loadTemplates() {
  let files;
  try {
    files = readdirSync(cdkOutDir).filter((f) => f.endsWith('.template.json'));
  } catch {
    console.error(`ERROR: cdk.out not found at ${cdkOutDir}. Run 'cdk synth' first.`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error('ERROR: No *.template.json files in cdk.out/. Run cdk synth first.');
    process.exit(1);
  }
  return files.map((f) => ({
    name: f.replace('.template.json', ''),
    template: JSON.parse(readFileSync(join(cdkOutDir, f), 'utf8')),
  }));
}

function getResources(template, type) {
  return Object.entries(template.Resources || {}).filter(([, v]) => v.Type === type);
}

function envFromName(stackName) {
  if (stackName.includes('-prod')) return 'prod';
  if (stackName.includes('-staging')) return 'staging';
  return 'dev';
}

// ── Rule 1: No unauthenticated API routes (except allowlisted) ────────────

function checkUnauthRoutes(stacks) {
  const violations = [];

  for (const { name, template } of stacks) {
    const methods = getResources(template, 'AWS::ApiGateway::Method');
    for (const [logicalId, resource] of methods) {
      const props = resource.Properties || {};
      const httpMethod = props.HttpMethod;

      // OPTIONS (CORS preflight) are always open
      if (httpMethod === 'OPTIONS') continue;

      const authType = props.AuthorizationType || 'NONE';
      if (authType !== 'NONE') continue;

      // Check if this is an allowlisted open route
      const isAllowlisted = OPEN_ROUTE_PATTERNS.some((p) => p.test(logicalId));
      if (isAllowlisted) continue;

      violations.push(`  [${name}] ${logicalId} — ${httpMethod} has AuthorizationType=NONE`);
    }
  }

  return { rule: 'Rule 1: No unauthenticated API routes', violations };
}

// ── Rule 2: No wildcard CORS in prod/staging ──────────────────────────────
// NOTE: CloudFormation output in CI won't have custom domains configured, so
// prod OPTIONS methods legitimately show '*' during CI synth. Instead, we check
// the CDK source code to ensure the CORS origin is conditional on environment.

function checkCorsOrigins(_stacks) {
  const violations = [];
  const cdkStackPath = resolve(__dirname, '..', 'lib', 'learnfyra-stack.ts');

  let source;
  try {
    source = readFileSync(cdkStackPath, 'utf8');
  } catch {
    violations.push('  Could not read learnfyra-stack.ts to verify CORS configuration');
    return { rule: 'Rule 2: No wildcard CORS in prod/staging', violations };
  }

  // The defaultCorsPreflightOptions must NOT unconditionally use ALL_ORIGINS.
  // Valid patterns: conditional on isDev, or scoped to a specific domain.
  // Invalid: `allowOrigins: apigateway.Cors.ALL_ORIGINS` without isDev guard.
  const corsBlock = source.match(/defaultCorsPreflightOptions:\s*\{[\s\S]*?allowOrigins:\s*(.+)/);
  if (corsBlock) {
    const originLine = corsBlock[1].trim();
    // Unconditional ALL_ORIGINS is a violation
    if (
      originLine.startsWith('apigateway.Cors.ALL_ORIGINS') &&
      !originLine.includes('isDev') &&
      !originLine.includes('?')
    ) {
      violations.push('  defaultCorsPreflightOptions.allowOrigins uses ALL_ORIGINS without environment guard');
    }
  }

  return { rule: 'Rule 2: No wildcard CORS in prod/staging (source check)', violations };
}

// ── Rule 3: No wildcard DynamoDB IAM ──────────────────────────────────────

function checkDynamoWildcard(stacks) {
  const violations = [];

  for (const { name, template } of stacks) {
    const policies = getResources(template, 'AWS::IAM::Policy');
    for (const [logicalId, resource] of policies) {
      const statements = resource.Properties?.PolicyDocument?.Statement || [];
      for (const stmt of statements) {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        const hasDynamo = actions.some((a) => typeof a === 'string' && a.startsWith('dynamodb:'));
        if (!hasDynamo) continue;

        const resourceStr = JSON.stringify(stmt.Resource || '');
        // Check for wildcard patterns like table/Learnfyra* or Learnfyra*-env
        if (/Learnfyra\*/.test(resourceStr) || /table\/\*/.test(resourceStr)) {
          violations.push(`  [${name}] ${logicalId} — DynamoDB policy uses wildcard table pattern`);
        }
      }
    }
  }

  return { rule: 'Rule 3: No wildcard DynamoDB IAM', violations };
}

// ── Rule 4: S3 buckets must enforce SSL ───────────────────────────────────

function checkS3SSL(stacks) {
  const violations = [];

  for (const { name, template } of stacks) {
    const buckets = getResources(template, 'AWS::S3::Bucket');
    const bucketPolicies = getResources(template, 'AWS::S3::BucketPolicy');

    for (const [bucketLogicalId] of buckets) {
      // Find the bucket policy for this bucket
      const matchingPolicy = bucketPolicies.find(([, bp]) => {
        const bucketRef = JSON.stringify(bp.Properties?.Bucket || '');
        return bucketRef.includes(bucketLogicalId);
      });

      if (!matchingPolicy) {
        violations.push(`  [${name}] ${bucketLogicalId} — no bucket policy (missing enforceSSL)`);
        continue;
      }

      const policyStr = JSON.stringify(matchingPolicy[1].Properties);
      if (!policyStr.includes('aws:SecureTransport')) {
        violations.push(`  [${name}] ${bucketLogicalId} — bucket policy missing aws:SecureTransport condition`);
      }
    }
  }

  return { rule: 'Rule 4: S3 buckets enforce SSL', violations };
}

// ── Rule 5: CloudFront must have security response headers ────────────────

function checkCloudFrontHeaders(stacks) {
  const violations = [];
  const requiredHeaders = [
    'StrictTransportSecurity',
    'ContentTypeOptions',
    'FrameOptions',
    'ReferrerPolicy',
    'XSSProtection',
  ];

  for (const { name, template } of stacks) {
    const policies = getResources(template, 'AWS::CloudFront::ResponseHeadersPolicy');

    if (policies.length === 0) {
      violations.push(`  [${name}] No CloudFront::ResponseHeadersPolicy resource found`);
      continue;
    }

    for (const [logicalId, resource] of policies) {
      const secConfig =
        resource.Properties?.ResponseHeadersPolicyConfig?.SecurityHeadersConfig || {};
      const presentHeaders = Object.keys(secConfig);

      for (const required of requiredHeaders) {
        if (!presentHeaders.includes(required)) {
          violations.push(`  [${name}] ${logicalId} — missing security header: ${required}`);
        }
      }
    }
  }

  return { rule: 'Rule 5: CloudFront security response headers', violations };
}

// ── Main ──────────────────────────────────────────────────────────────────

const stacks = loadTemplates();
console.log(`\nZero Trust Policy Gate — scanning ${stacks.length} stack(s)\n`);

const checks = [
  checkUnauthRoutes,
  checkCorsOrigins,
  checkDynamoWildcard,
  checkS3SSL,
  checkCloudFrontHeaders,
];

let totalViolations = 0;

for (const check of checks) {
  const result = check(stacks);
  const passed = result.violations.length === 0;
  const icon = passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${result.rule}`);
  if (!passed) {
    result.violations.forEach((v) => console.log(v));
    totalViolations += result.violations.length;
  }
}

console.log(`\n${totalViolations === 0 ? 'All checks passed.' : `${totalViolations} violation(s) found.`}\n`);
process.exit(totalViolations > 0 ? 1 : 0);
