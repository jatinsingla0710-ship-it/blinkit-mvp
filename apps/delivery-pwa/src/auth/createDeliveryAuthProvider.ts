import {
  createAuthProvider,
  parsePublicAuthConfig,
  type AuthProvider,
  type PublicAuthConfig,
} from '@groaurum/auth';
import { getDeliverySupabaseClient } from '@/lib/deliverySupabaseClient';
import {
  assertOperationalAuthProvider,
  publicOperationalEnv,
} from '@/lib/operationalEnv';

/**
 * Public env only — never read service-role keys in the browser.
 */
export function loadDeliveryAuthConfig(): PublicAuthConfig {
  return parsePublicAuthConfig(
    publicOperationalEnv(),
  );
}

let providerSingleton: AuthProvider | null = null;

export function getDeliveryAuthProvider(): AuthProvider {
  if (providerSingleton) return providerSingleton;

  const config = loadDeliveryAuthConfig();
  assertOperationalAuthProvider(config.authProvider);
  const useSupabase = config.authProvider === 'supabase';

  providerSingleton = createAuthProvider({
    config,
    autoSignIn: config.authProvider === 'mock',
    supabaseClient: useSupabase
      ? (getDeliverySupabaseClient() as never)
      : undefined,
    autoSignInCredentials: null,
    // When VITE_AUTH_PROVIDER=mock, VITE_AUTH_MOCK_ROLE=delivery_executive drives this.
    initialRole: 'delivery_executive',
  });
  return providerSingleton;
}

export function resetDeliveryAuthProvider(): void {
  providerSingleton = null;
}
