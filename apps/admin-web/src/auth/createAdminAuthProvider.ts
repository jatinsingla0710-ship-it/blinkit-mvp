import {
  createAuthProvider,
  parsePublicAuthConfig,
  type AuthProvider,
  type PublicAuthConfig,
} from '@groaurum/auth';
import { getAdminSupabaseClient } from '@/lib/adminSupabaseClient';
import {
  assertOperationalAuthProvider,
  publicOperationalEnv,
} from '@/lib/operationalEnv';

/**
 * Public env only — never read service-role keys in the browser.
 */
export function loadAdminAuthConfig(): PublicAuthConfig {
  return parsePublicAuthConfig(
    publicOperationalEnv(),
  );
}

let providerSingleton: AuthProvider | null = null;

/**
 * Auth provider for Admin ERP.
 * - mock: auto sign-in for offline UI work
 * - supabase: restore persisted session only; login UI handles credentials
 *   (VITE_AUTH_DEV_* may prefill the Login page in development)
 */
export function getAdminAuthProvider(): AuthProvider {
  if (providerSingleton) return providerSingleton;

  const config = loadAdminAuthConfig();
  assertOperationalAuthProvider(config.authProvider);
  const useSupabase = config.authProvider === 'supabase';

  providerSingleton = createAuthProvider({
    config,
    autoSignIn: config.authProvider === 'mock',
    supabaseClient: useSupabase
      ? (getAdminSupabaseClient() as never)
      : undefined,
    // No silent password sign-in — dedicated Login page owns credentials.
    autoSignInCredentials: null,
  });
  return providerSingleton;
}

export function resetAdminAuthProvider(): void {
  providerSingleton = null;
}
