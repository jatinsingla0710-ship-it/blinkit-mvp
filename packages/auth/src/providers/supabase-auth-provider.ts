import { audienceForRole, type AppRole } from '../roles';
import {
  STAFF_ROLE_TO_APP_ROLE,
  type LiveStaffRole,
} from '../staff-role-map';
import type { PublicAuthConfig } from '../env';
import { createAuthError } from '../errors';
import type {
  AuthProvider,
  AuthSession,
  AuthState,
  AuthStateListener,
  AuthUser,
  SignInCredentials,
} from '../types';

/** Minimal Supabase client surface used by the auth provider. */
export type SupabaseAuthClientLike = {
  auth: {
    getSession: () => Promise<{
      data: {
        session: {
          access_token: string;
          refresh_token: string;
          expires_at?: number | null;
          user: {
            id: string;
            email?: string | null;
            phone?: string | null;
          };
        } | null;
      };
      error: { message: string } | null;
    }>;
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
      data: {
        session: {
          access_token: string;
          refresh_token: string;
          expires_at?: number | null;
          user: {
            id: string;
            email?: string | null;
            phone?: string | null;
          };
        } | null;
        user: { id: string; email?: string | null; phone?: string | null } | null;
      };
      error: { message: string } | null;
    }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
    onAuthStateChange: (
      callback: (
        event: string,
        session: {
          access_token: string;
          refresh_token: string;
          expires_at?: number | null;
          user: {
            id: string;
            email?: string | null;
            phone?: string | null;
          };
        } | null,
      ) => void,
    ) => {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: {
            id: string;
            display_name: string | null;
            mobile: string | null;
            roles: string[] | null;
            is_active: boolean | null;
          } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

export type SupabaseAuthProviderOptions = {
  config: PublicAuthConfig;
  client: SupabaseAuthClientLike;
  /**
   * When set (typically development), auto sign-in after bootstrap so ERP works
   * before a dedicated login screen ships.
   */
  autoSignInCredentials?: { email: string; password: string } | null;
};

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function mapStaffRolesToAppRoles(roles: readonly string[]): AppRole[] {
  const mapped: AppRole[] = [];
  for (const role of roles) {
    if (Object.prototype.hasOwnProperty.call(STAFF_ROLE_TO_APP_ROLE, role)) {
      mapped.push(STAFF_ROLE_TO_APP_ROLE[role as LiveStaffRole]);
    }
  }
  return mapped.length > 0 ? mapped : ['read_only'];
}

async function loadProfile(
  client: SupabaseAuthClientLike,
  userId: string,
): Promise<{
  displayName: string;
  mobile: string | null;
  roles: AppRole[];
} | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, mobile, roles, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw createAuthError('unexpected', error.message, error);
  }
  if (!data || data.is_active === false) {
    return null;
  }

  return {
    displayName: data.display_name?.trim() || 'Staff',
    mobile: data.mobile,
    roles: mapStaffRolesToAppRoles(data.roles ?? []),
  };
}

function buildSession(args: {
  userId: string;
  email: string | null;
  phone: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  displayName: string;
  roles: AppRole[];
}): AuthSession {
  const primaryRole = args.roles[0] ?? 'read_only';
  const user: AuthUser = {
    id: args.userId,
    email: args.email,
    phone: args.phone,
    displayName: args.displayName,
    primaryRole,
    roles: args.roles,
  };

  return {
    user,
    accessToken: args.accessToken,
    refreshToken: args.refreshToken,
    expiresAt: args.expiresAt,
    audience: audienceForRole(primaryRole),
    provider: 'supabase',
    issuedAt: new Date().toISOString(),
  };
}

/**
 * Real Supabase Auth provider for Admin ERP.
 * Shares the same client instance as LiveAdminApi so JWT reaches PostgREST.
 */
export function createSupabaseAuthProvider(
  options: SupabaseAuthProviderOptions,
): AuthProvider {
  const { client, autoSignInCredentials = null } = options;

  let state: AuthState = {
    status: 'loading',
    session: null,
    error: null,
  };
  const listeners = new Set<AuthStateListener>();

  const emit = () => {
    for (const listener of listeners) listener(state);
  };

  const setState = (next: AuthState) => {
    state = next;
    emit();
  };

  const sessionFromAuthUser = async (authUser: {
    id: string;
    email?: string | null;
    phone?: string | null;
  }, tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string | null;
  }): Promise<AuthSession> => {
    const profile = await loadProfile(client, authUser.id);
    if (!profile) {
      throw createAuthError(
        'forbidden',
        'No active staff profile for this account.',
      );
    }
    return buildSession({
      userId: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone ?? profile.mobile,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      displayName: profile.displayName,
      roles: profile.roles,
    });
  };

  const hydrateFromCurrentSession = async (): Promise<AuthSession | null> => {
    const { data, error } = await client.auth.getSession();
    if (error) {
      throw createAuthError('unexpected', error.message, error);
    }
    const session = data.session;
    if (!session?.user) return null;
    return sessionFromAuthUser(session.user, {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    });
  };

  void (async () => {
    const BOOTSTRAP_TIMEOUT_MS = 12_000;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Fail open to Login instead of hanging forever on a stalled network.
      setState({ status: 'unauthenticated', session: null, error: null });
    }, BOOTSTRAP_TIMEOUT_MS);

    try {
      let session = await hydrateFromCurrentSession();
      if (!session && autoSignInCredentials) {
        const { data, error } = await client.auth.signInWithPassword({
          email: autoSignInCredentials.email,
          password: autoSignInCredentials.password,
        });
        if (error) {
          throw createAuthError('unauthorized', error.message, error);
        }
        if (!data.session?.user) {
          throw createAuthError(
            'unauthorized',
            'Sign-in succeeded without a session.',
          );
        }
        session = await sessionFromAuthUser(data.session.user, {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at
            ? new Date(data.session.expires_at * 1000).toISOString()
            : null,
        });
      }

      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (session) {
        setState({ status: 'authenticated', session, error: null });
      } else {
        setState({ status: 'unauthenticated', session: null, error: null });
      }
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setState({
        status: 'error',
        session: null,
        error:
          err && typeof err === 'object' && 'code' in err
            ? (err as AuthState['error'])
            : createAuthError(
                'unexpected',
                err instanceof Error ? err.message : 'Auth bootstrap failed',
                err,
              ),
      });
    }
  })();

  client.auth.onAuthStateChange((_event, nextSession) => {
    void (async () => {
      try {
        if (!nextSession?.user) {
          if (state.status !== 'loading') {
            setState({
              status: 'unauthenticated',
              session: null,
              error: null,
            });
          }
          return;
        }
        const session = await sessionFromAuthUser(nextSession.user, {
          accessToken: nextSession.access_token,
          refreshToken: nextSession.refresh_token,
          expiresAt: nextSession.expires_at
            ? new Date(nextSession.expires_at * 1000).toISOString()
            : null,
        });
        setState({ status: 'authenticated', session, error: null });
      } catch (err) {
        setState({
          status: 'error',
          session: null,
          error:
            err && typeof err === 'object' && 'code' in err
              ? (err as AuthState['error'])
              : createAuthError(
                  'unexpected',
                  err instanceof Error ? err.message : 'Auth state sync failed',
                  err,
                ),
        });
      }
    })();
  });

  const provider: AuthProvider = {
    kind: 'supabase',
    getState: () => state,
    async getSession() {
      return state.session;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    async signIn(credentials: SignInCredentials) {
      if (!credentials.email || !credentials.password) {
        throw createAuthError(
          'unauthorized',
          'Email and password are required for Supabase sign-in.',
        );
      }
      try {
        const { data, error } = await withTimeout(
          client.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          }),
          15_000,
          'Sign-in timed out. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.',
        );
        if (error) {
          throw createAuthError('unauthorized', error.message, error);
        }
        if (!data.session?.user) {
          throw createAuthError(
            'unauthorized',
            'Sign-in succeeded without a session.',
          );
        }
        const session = await sessionFromAuthUser(data.session.user, {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at
            ? new Date(data.session.expires_at * 1000).toISOString()
            : null,
        });
        setState({ status: 'authenticated', session, error: null });
        return session;
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err) {
          throw err;
        }
        throw createAuthError(
          'unauthorized',
          err instanceof Error ? err.message : 'Sign-in failed',
          err,
        );
      }
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) {
        throw createAuthError('unexpected', error.message, error);
      }
      setState({ status: 'unauthenticated', session: null, error: null });
    },
    async refreshSession() {
      try {
        const session = await hydrateFromCurrentSession();
        if (session) {
          setState({ status: 'authenticated', session, error: null });
        } else {
          setState({ status: 'unauthenticated', session: null, error: null });
        }
        return session;
      } catch (err) {
        setState({
          status: 'error',
          session: null,
          error:
            err && typeof err === 'object' && 'code' in err
              ? (err as AuthState['error'])
              : createAuthError(
                  'session_expired',
                  err instanceof Error ? err.message : 'Refresh failed',
                  err,
                ),
        });
        return null;
      }
    },
    async hydrateFromExternal() {
      return this.refreshSession();
    },
  };

  return provider;
}
