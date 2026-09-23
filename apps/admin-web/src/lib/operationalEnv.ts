export type OperationalDataAdapter = 'mock' | 'supabase';

/**
 * Development login hints. Vite removes this branch from production builds,
 * so dev emails and passwords are not shipped in the production bundle.
 */
export function readDevLoginPrefill(): { email: string; password: string } {
  if (!import.meta.env.DEV) {
    return { email: '', password: '' };
  }
  return {
    email: import.meta.env.VITE_AUTH_DEV_EMAIL ?? '',
    password: import.meta.env.VITE_AUTH_DEV_PASSWORD ?? '',
  };
}

/**
 * Local `vite dev` may omit the adapter and use mock fixtures.
 * A production build must name the live adapter explicitly.
 */
export function resolveOperationalDataAdapter(): OperationalDataAdapter {
  const raw = (import.meta.env.VITE_DATA_ADAPTER ?? '').trim().toLowerCase();
  if (import.meta.env.PROD) {
    if (raw !== 'supabase') {
      throw new Error(
        'Production requires VITE_DATA_ADAPTER=supabase. Mock mode is not available in a production build.',
      );
    }
    return 'supabase';
  }
  return raw === 'supabase' ? 'supabase' : 'mock';
}

/** Keys the browser is allowed to see. Dev login fields are not included. */
export function publicOperationalEnv(): Record<string, string | undefined> {
  return {
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_AUTH_PROVIDER: import.meta.env.VITE_AUTH_PROVIDER,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_AUTH_MOCK_ROLE: import.meta.env.DEV
      ? import.meta.env.VITE_AUTH_MOCK_ROLE
      : undefined,
  };
}

export function assertOperationalAuthProvider(provider: string): void {
  if (import.meta.env.PROD && provider !== 'supabase') {
    throw new Error(
      'Production requires VITE_AUTH_PROVIDER=supabase. Mock auth is not available in a production build.',
    );
  }
}
