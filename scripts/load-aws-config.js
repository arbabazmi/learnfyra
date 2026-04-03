/**
 * @file scripts/load-aws-config.js
 * @description Fetches config from AWS for local development.
 *
 * Loads:
 *   1. SSM Parameter Store — secrets (ANTHROPIC_API_KEY, JWT_SECRET)
 *   2. Lambda env vars — table names, model config, feature flags
 *
 * Usage:
 *   import { loadAwsConfig } from './scripts/load-aws-config.js';
 *   await loadAwsConfig('dev');  // sets process.env.* from AWS
 *
 * Requires: AWS CLI configured with access to the target account.
 * Falls back gracefully if AWS is not available (returns false).
 */

// Lazy imports — resolved inside loadAwsConfig() to avoid crashing
// when @aws-sdk/client-lambda is not installed (CI, production Lambda)
let SSMClient, GetParametersByPathCommand, LambdaClient, GetFunctionConfigurationCommand;

// SSM parameter name → process.env key mapping
const SSM_KEY_MAP = {
  'anthropic-api-key': 'ANTHROPIC_API_KEY',
  'jwt-secret': 'JWT_SECRET',
};

// Lambda env vars to copy (skip AWS-internal and vars we override locally)
const SKIP_LAMBDA_VARS = new Set([
  'APP_RUNTIME',      // local uses 'dynamodb', not 'aws'
  'NODE_ENV',         // local uses 'development'
  'DYNAMO_ENV',       // set locally
  'DEBUG_MODE',       // set locally
  'ALLOWED_ORIGIN',   // override to '*' for local CORS
  'AWS_NODEJS_CONNECTION_REUSE_ENABLED', // AWS SDK internal
]);

// Local overrides applied after AWS config is loaded
const LOCAL_OVERRIDES = {
  APP_RUNTIME: 'dynamodb',
  DYNAMO_ENV: 'dev',     // will be overridden by LEARNFYRA_ENV if set
  NODE_ENV: 'development',
  ALLOWED_ORIGIN: '*',
  DEBUG_MODE: 'true',
  OAUTH_CALLBACK_BASE_URL: 'http://localhost:5173',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/callback/google',
};

/**
 * Fetches all SSM parameters under /learnfyra/{env}/ and sets them as env vars.
 * @param {SSMClient} ssm
 * @param {string} env - Environment name (dev, staging, prod)
 * @returns {Promise<number>} Number of parameters loaded
 */
async function loadSsmParams(ssm, env) {
  let loaded = 0;
  let nextToken;

  do {
    const result = await ssm.send(new GetParametersByPathCommand({
      Path: `/learnfyra/${env}/`,
      Recursive: true,
      WithDecryption: true,
      NextToken: nextToken,
    }));

    for (const param of result.Parameters || []) {
      // Extract the key name from the full path: /learnfyra/dev/anthropic-api-key → anthropic-api-key
      const paramKey = param.Name.split('/').pop();
      const envKey = SSM_KEY_MAP[paramKey];

      if (envKey && param.Value) {
        process.env[envKey] = param.Value;
        loaded++;
      }
    }

    nextToken = result.NextToken;
  } while (nextToken);

  return loaded;
}

/**
 * Fetches env vars from a Lambda function configuration.
 * @param {LambdaClient} lambda
 * @param {string} functionName
 * @returns {Promise<number>} Number of env vars loaded
 */
async function loadLambdaEnv(lambda, functionName) {
  const result = await lambda.send(new GetFunctionConfigurationCommand({
    FunctionName: functionName,
  }));

  const vars = result.Environment?.Variables || {};
  let loaded = 0;

  for (const [key, value] of Object.entries(vars)) {
    if (SKIP_LAMBDA_VARS.has(key)) continue;
    // Don't overwrite SSM values (SSM has higher priority for secrets)
    if (!process.env[key]) {
      process.env[key] = value;
      loaded++;
    }
  }

  return loaded;
}

/**
 * Loads AWS config into process.env for local development.
 *
 * Priority: SSM params > Lambda env vars > local overrides > .env (via dotenv)
 *
 * @param {string} [env] - Environment (default: process.env.LEARNFYRA_ENV || 'dev')
 * @returns {Promise<boolean>} true if config was loaded from AWS, false on failure
 */
export async function loadAwsConfig(env) {
  const targetEnv = env || process.env.LEARNFYRA_ENV || 'dev';
  const region = process.env.AWS_REGION || 'us-east-1';

  try {
    // Lazy-load AWS SDKs — avoids top-level import crash when packages are missing
    if (!SSMClient) {
      const ssmMod = await import('@aws-sdk/client-ssm');
      SSMClient = ssmMod.SSMClient;
      GetParametersByPathCommand = ssmMod.GetParametersByPathCommand;
    }
    if (!LambdaClient) {
      const lambdaMod = await import('@aws-sdk/client-lambda');
      LambdaClient = lambdaMod.LambdaClient;
      GetFunctionConfigurationCommand = lambdaMod.GetFunctionConfigurationCommand;
    }

    const ssm = new SSMClient({ region });
    const lambda = new LambdaClient({ region });

    // 1. Load secrets from SSM Parameter Store
    const ssmCount = await loadSsmParams(ssm, targetEnv);

    // 2. Load env vars from generate Lambda (has the most complete config)
    const lambdaFn = `learnfyra-${targetEnv}-lambda-generate`;
    const lambdaCount = await loadLambdaEnv(lambda, lambdaFn);

    // 2b. Load env vars from auth Lambda (OAuth-specific: Cognito, Google, cookie config)
    const authLambdaFn = `learnfyra-${targetEnv}-lambda-auth`;
    const authCount = await loadLambdaEnv(lambda, authLambdaFn).catch(() => 0);

    // 3. Apply local overrides
    LOCAL_OVERRIDES.DYNAMO_ENV = targetEnv;
    for (const [key, value] of Object.entries(LOCAL_OVERRIDES)) {
      process.env[key] = value;
    }

    console.log(`\n  ☁️  AWS config loaded (${targetEnv}): ${ssmCount} secrets + ${lambdaCount + authCount} env vars`);
    return true;
  } catch (err) {
    // Fail gracefully — fall back to .env
    const msg = err.name === 'CredentialsProviderError'
      ? 'AWS credentials not configured'
      : err.message;
    console.warn(`\n  ⚠️  AWS config unavailable (${msg}) — falling back to .env`);
    return false;
  }
}
