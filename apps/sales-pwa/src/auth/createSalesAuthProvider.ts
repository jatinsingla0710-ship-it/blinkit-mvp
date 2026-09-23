import {
  createAuthProvider,
  parsePublicAuthConfig,
  type AuthProvider,
  type PublicAuthConfig,
} from '@groaurum/auth';
import { getSalesSupabaseClient } from '@/lib/salesSupabaseClient';
import {
  assertOperationalAuthProvider,
  publicOperationalEnv,
  readDevLoginPrefill,
} from '@/lib/operationalEnv';

/**
 * Public env only — never read service-role keys in the browser.
 */
export function loadSalesAuthConfig(): PublicAuthConfig {
  return parsePublicAuthConfig(
    publicOperationalEnv(),
  );
}

let providerSingleton: AuthProvider | null = null;

export function getSalesAuthProvider(): AuthProvider {
  if (providerSingleton) return providerSingleton;

  const config = loadSalesAuthConfig();
  assertOperationalAuthProvider(config.authProvider);
  const useSupabase = config.authProvider === 'supabase';
  const devPrefill = readDevLoginPrefill();

  providerSingleton = createAuthProvider({
    config,
    autoSignIn:
      import.meta.env.DEV &&
      (config.appEnv === 'development' || config.authProvider === 'mock'),
    supabaseClient: useSupabase
      ? (getSalesSupabaseClient() as never)
      : undefined,
    autoSignInCredentials:
      import.meta.env.DEV &&
      useSupabase &&
      config.appEnv === 'development' &&
      devPrefill.email &&
      devPrefill.password
        ? { email: devPrefill.email, password: devPrefill.password }
        : null,
    // When VITE_AUTH_PROVIDER=mock, VITE_AUTH_MOCK_ROLE=salesman drives this.
    initialRole: 'salesman',
  });
  return providerSingleton;
}

export function resetSalesAuthProvider(): void {
  providerSingleton = null;
}
