/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Google OAuth
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_REDIRECT_URI?: string;

  // App URLs
  readonly VITE_APP_URL?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
