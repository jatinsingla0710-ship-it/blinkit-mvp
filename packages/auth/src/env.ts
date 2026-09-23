import type { AuthProviderKind } from './types';

export const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface PublicAuthConfig {
  appEnv: AppEnv;
  authProvider: AuthProviderKind;
  /**
   * Public Supabase URL — required only when authProvider === 'supabase'.
   * Never put service-role keys here.
   */
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  /** Default mock role for auto sign-in (admin ERP). */
  mockAutoRole: string;
}

export type EnvSource = Record<string, string | undefined>;

function read(source: EnvSource, key: string): string | undefined {
  const value = source[key];
  return value && value.trim() ? value.trim() : undefined;
}

function parseAppEnv(raw: string | undefined): AppEnv {
  if (raw === 'staging' || raw === 'production' || raw === 'development') {
    return raw;
  }
  return 'development';
}

function parseProvider(raw: string | undefined): AuthProviderKind {
  return raw === 'supabase' ? 'supabase' : 'mock';
}

/**
 * Parse public auth config from Vite / Expo / Node env bags.
 * Accepts both VITE_* and EXPO_PUBLIC_* / GROAURUM_* keys.
 */
export function parsePublicAuthConfig(source: EnvSource): PublicAuthConfig {
  const appEnv = parseAppEnv(
    read(source, 'VITE_APP_ENV') ??
      read(source, 'EXPO_PUBLIC_APP_ENV') ??
      read(source, 'GROAURUM_APP_ENV'),
  );

  const authProvider = parseProvider(
    read(source, 'VITE_AUTH_PROVIDER') ??
      read(source, 'EXPO_PUBLIC_AUTH_PROVIDER') ??
      read(source, 'GROAURUM_AUTH_PROVIDER'),
  );

  const supabaseUrl =
    read(source, 'VITE_SUPABASE_URL') ??
    read(source, 'EXPO_PUBLIC_SUPABASE_URL') ??
    read(source, 'GROAURUM_SUPABASE_URL') ??
    null;

  const supabaseAnonKey =
    read(source, 'VITE_SUPABASE_ANON_KEY') ??
    read(source, 'EXPO_PUBLIC_SUPABASE_ANON_KEY') ??
    read(source, 'GROAURUM_SUPABASE_ANON_KEY') ??
    null;

  const mockAutoRole =
    read(source, 'VITE_AUTH_MOCK_ROLE') ??
    read(source, 'EXPO_PUBLIC_AUTH_MOCK_ROLE') ??
    'super_admin';

  return {
    appEnv,
    authProvider,
    supabaseUrl,
    supabaseAnonKey,
    mockAutoRole,
  };
}

export function assertPublicAuthConfig(config: PublicAuthConfig): void {
  if (config.authProvider === 'supabase') {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error(
        'Supabase auth selected but public URL/key are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the app .env.local (or GROAURUM_SUPABASE_* / EXPO_PUBLIC_SUPABASE_*).',
      );
    }
  }
}
