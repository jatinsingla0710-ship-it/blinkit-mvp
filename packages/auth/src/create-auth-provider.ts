import { assertPublicAuthConfig, type PublicAuthConfig } from './env';
import { isAppRole, type AppRole } from './roles';
import { createMockAuthProvider } from './providers/mock-auth-provider';
import {
  createSupabaseAuthProvider,
  type SupabaseAuthClientLike,
} from './providers/supabase-auth-provider';
import { createSupabaseAuthProviderStub } from './providers/supabase-auth-provider.stub';
import type { AuthProvider } from './types';

export type CreateAuthProviderOptions = {
  config: PublicAuthConfig;
  /** Override mock auto-sign-in (admin ERP defaults to true in development). */
  autoSignIn?: boolean;
  initialRole?: AppRole;
  /** Required for real Supabase auth — share with data layer client. */
  supabaseClient?: SupabaseAuthClientLike;
  /** Dev bootstrap credentials when autoSignIn is true. */
  autoSignInCredentials?: { email: string; password: string } | null;
};

/**
 * Factory used by all GroAurum apps.
 * Pass supabaseClient to enable real JWT sessions for Admin ERP.
 */
export function createAuthProvider(
  options: CreateAuthProviderOptions,
): AuthProvider {
  const { config } = options;
  assertPublicAuthConfig(config);

  if (config.authProvider === 'supabase') {
    if (!options.supabaseClient) {
      return createSupabaseAuthProviderStub(config);
    }
    return createSupabaseAuthProvider({
      config,
      client: options.supabaseClient,
      autoSignInCredentials:
        options.autoSignIn === false
          ? null
          : options.autoSignInCredentials ?? null,
    });
  }

  const role = isAppRole(config.mockAutoRole)
    ? config.mockAutoRole
    : options.initialRole ?? 'super_admin';

  return createMockAuthProvider({
    config,
    initialRole: options.initialRole ?? role,
    autoSignIn: options.autoSignIn,
  });
}
