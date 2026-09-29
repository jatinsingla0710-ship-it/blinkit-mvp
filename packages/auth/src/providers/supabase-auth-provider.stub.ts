import type { PublicAuthConfig } from '../env';
import { createAuthError } from '../errors';
import type {
  AuthProvider,
  AuthSession,
  AuthState,
  AuthStateListener,
  SignInCredentials,
} from '../types';

/**
 * Stub Supabase Auth adapter — contract only until Sprint with live Auth.
 * Throws clear errors so apps never silently pretend to be connected.
 */
export function createSupabaseAuthProviderStub(
  _config: PublicAuthConfig,
): AuthProvider {
  let state: AuthState = {
    status: 'unauthenticated',
    session: null,
    error: createAuthError(
      'unexpected',
      'Supabase Auth adapter is not connected yet. Use VITE_AUTH_PROVIDER=mock.',
    ),
  };
  const listeners = new Set<AuthStateListener>();

  const emit = () => {
    for (const listener of listeners) listener(state);
  };

  const notConnected = async (): Promise<never> => {
    const error = createAuthError(
      'unexpected',
      'Supabase Auth is not wired in this sprint. Keep AUTH_PROVIDER=mock.',
    );
    state = { status: 'error', session: null, error };
    emit();
    throw error;
  };

  return {
    kind: 'supabase',
    getState: () => state,
    async getSession() {
      return null;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    signIn: (_credentials: SignInCredentials) => notConnected(),
    requestEmailCode: () => notConnected(),
    verifyEmailCode: () => notConnected(),
    signOut: () => notConnected(),
    refreshSession: async (): Promise<AuthSession | null> => {
      await notConnected();
      return null;
    },
    hydrateFromExternal: () => notConnected(),
  };
}
