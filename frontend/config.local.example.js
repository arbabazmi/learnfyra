/**
 * @file frontend/config.local.example.js
 *
 * Local development config for Learnfyra frontend (ADR-010).
 *
 * SETUP:
 *   cp frontend/config.local.example.js frontend/config.local.js
 *   Fill in your Google OAuth Client ID below.
 *
 * HOW IT WORKS:
 *   server.js serves frontend/ as static files, so this file is available
 *   at http://localhost:3000/config.local.js
 *
 *   Every HTML page includes:
 *     <script src="/config.local.js"></script>   ← local dev
 *     <script src="/config.js"></script>          ← CI/CD generated for AWS
 *
 * NEVER commit config.local.js — it is gitignored.
 * This example file (config.local.example.js) IS committed.
 */

window.LEARNFYRA_CONFIG = {
  // Local Express dev server
  apiBaseUrl: 'http://localhost:3000',

  // Google OAuth — Cognito Hosted UI authorize endpoint for local dev
  // Format: https://{cognito-domain}/oauth2/authorize
  // Your Cognito domain is in AWS Console → Cognito → User Pool → App Integration
  cognitoAuthorizeUrl: 'https://YOUR-COGNITO-DOMAIN.auth.us-east-1.amazoncognito.com/oauth2/authorize',

  // Your Cognito App Client ID (public — safe to commit in example)
  clientId: 'YOUR_COGNITO_APP_CLIENT_ID',

  // Must match exactly what is registered in Google Cloud Console AND Cognito
  // For local dev this is always http://localhost:3000/login.html
  redirectUri: 'http://localhost:3000/login.html',

  // OAuth scopes to request
  scope: 'openid email profile',

  // Environment label (used for logging/debugging only)
  env: 'local'
};
