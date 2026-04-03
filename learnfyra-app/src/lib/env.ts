/**
 * @file src/lib/env.ts
 * @description Environment-based configuration.
 *
 * All VITE_ prefixed variables are set in:
 *   .env.local          → local dev (git-ignored)
 *   .env.staging        → staging build
 *   .env.production     → production build
 *
 * Never hardcode URLs — always read from env.
 */

const meta = import.meta.env;

// ── App environment ───────────────────────────────────────────────────────
// VITE_APP_ENV is set per .env.{mode} file: local | dev | qa | prod
export type AppEnv = 'local' | 'dev' | 'qa' | 'prod';
export const appEnv: AppEnv = (meta.VITE_APP_ENV as AppEnv) || (meta.DEV ? 'local' : 'prod');
export const isLocal: boolean = appEnv === 'local';
export const mailhogUrl: string = meta.VITE_MAILHOG_URL || 'http://localhost:8025';

// ── Derived base URL ───────────────────────────────────────────────────────
// Priority: explicit VITE_APP_URL → infer from window.location
const appUrl: string =
  meta.VITE_APP_URL ??
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : '');

// ── API base URL ───────────────────────────────────────────────────────────
// In dev, Vite proxies /api → localhost:3000 so we can use relative paths.
// In production the API lives on the same origin via API Gateway.
export const apiUrl: string = meta.VITE_API_URL ?? (meta.DEV ? 'http://localhost:3000' : '');

// ── Google OAuth ───────────────────────────────────────────────────────────
// Flow: Frontend POSTs to /api/auth/oauth/google → backend returns
// { authorizationUrl } → frontend redirects browser there → Google redirects
// back to /api/auth/callback/google → backend redirects to React app with token.
export const googleOAuth = {
  clientId: meta.VITE_GOOGLE_CLIENT_ID ?? '',

  /** Backend OAuth initiation endpoint — POST here to get authorizationUrl */
  initiateUrl: `${apiUrl}/api/auth/oauth/google`,

  /** Redirect URI registered in Google Console for this environment */
  redirectUri:
    meta.VITE_GOOGLE_REDIRECT_URI ??
    (meta.DEV
      ? 'http://localhost:3000/api/auth/callback/google'
      : `${appUrl}/api/auth/callback/google`),
} as const;

// ── Runtime environment label ──────────────────────────────────────────────
export const envLabel: 'development' | 'staging' | 'production' = meta.DEV
  ? 'development'
  : (meta.VITE_APP_URL ?? '').includes('staging')
  ? 'staging'
  : 'production';
