import {
  createSupabaseAuthProvider,
  parsePublicAuthConfig,
  type AuthProvider,
  type PublicAuthConfig,
} from '@groaurum/auth/supabase';
import { getSalesSupabaseClient } from '@/lib/salesSupabaseClient';
import {
  assertOperationalAuthProvider,
  publicOperationalEnv,
  readDevLoginPrefill,
} from '@/lib/operationalEnv';

type DevAuthFactory = (options: {
  config: PublicAuthConfig;
  autoSignIn?: boolean;
  initialRole?: 'salesman';
  autoSignInCredentials?: { email: string; password: string } | null;
}) => AuthProvider;

let providerSingleton: AuthProvider | null = null;
let devAuthFactory: DevAuthFactory | null = null;

/** Development boot registers mock auth. Production never calls this. */
export function registerDevAuthFactory(factory: DevAuthFactory): void {
  devAuthFactory = factory;
}

/**
 * Public env only — never read service-role keys in the browser.
 */
export function loadSalesAuthConfig(): PublicAuthConfig {
  return parsePublicAuthConfig(publicOperationalEnv());
}

export function getSalesAuthProvider(): AuthProvider {
  if (providerSingleton) return providerSingleton;

  const config = loadSalesAuthConfig();
  assertOperationalAuthProvider(config.authProvider);
  const devPrefill = readDevLoginPrefill();

  if (config.authProvider !== 'supabase') {
    if (!devAuthFactory) {
      throw new Error('Mock auth is only available in local development.');
    }
    providerSingleton = devAuthFactory({
      config,
      autoSignIn:
        import.meta.env.DEV &&
        (config.appEnv === 'development' || config.authProvider === 'mock'),
      initialRole: 'salesman',
      autoSignInCredentials: null,
    });
    return providerSingleton;
  }

  providerSingleton = createSupabaseAuthProvider({
    config,
    client: getSalesSupabaseClient() as never,
    autoSignInCredentials:
      import.meta.env.DEV &&
      config.appEnv === 'development' &&
      devPrefill.email &&
      devPrefill.password
        ? { email: devPrefill.email, password: devPrefill.password }
        : null,
  });
  return providerSingleton;
}

export function resetSalesAuthProvider(): void {
  providerSingleton = null;
}
