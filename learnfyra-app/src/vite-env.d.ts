/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Google OAuth
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_REDIRECT_URI?: string;

  // App URLs
  readonly VITE_APP_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_MAILHOG_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
