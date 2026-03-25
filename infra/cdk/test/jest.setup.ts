// Disable CDK nodeModules bundling during unit tests.
// CDK NodejsFunction with nodeModules runs npm ci + esbuild during synthesis,
// which is slow and causes Windows EPERM rename errors when file watchers lock
// files in the cdk.out directory. Setting NODE_ENV=test causes learnfyra-stack.ts
// to skip the nodeModules option (puppeteer-core + @sparticuz/chromium install).
// CI/CD runs on Linux (ubuntu-latest) where this issue doesn't occur.
process.env.NODE_ENV = 'test';
process.env.JSII_SILENCE_WARNING_UNTESTED_NODE_VERSION = 'true';
