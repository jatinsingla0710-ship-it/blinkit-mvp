export {
  parsePublicAuthConfig,
  assertPublicAuthConfig,
  APP_ENVS,
  type AppEnv,
  type PublicAuthConfig,
  type EnvSource,
} from './env';

export {
  createSupabaseAuthProvider,
  type SupabaseAuthClientLike,
  type SupabaseAuthProviderOptions,
} from './providers/supabase-auth-provider';

export type { AuthProvider } from './types';

export {
  assertLoginEmail,
  assertSixDigitCode,
  emailCodeErrorMessage,
  normalizeLoginEmail,
} from './email-code';
