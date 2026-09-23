/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_AUTH_PROVIDER?: string;
  readonly VITE_AUTH_MOCK_ROLE?: string;
  readonly VITE_AUTH_DEV_EMAIL?: string;
  readonly VITE_AUTH_DEV_PASSWORD?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DATA_ADAPTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
