import type { AppEnv, PublicAuthConfig } from '../env';
import { audienceForRole, type AppRole } from '../roles';
import type {
  AuthProvider,
  AuthSession,
  AuthState,
  AuthStateListener,
  AuthUser,
  SignInCredentials,
} from '../types';
import { assertLoginEmail, assertSixDigitCode } from '../email-code';
import { createAuthError } from '../errors';

/** Fixed code for mock auth only. Production email codes come from the mail provider. */
export const MOCK_EMAIL_CODE = '123456';

const MOCK_USERS: Record<AppRole, Omit<AuthUser, 'primaryRole' | 'roles'>> = {
  super_admin: {
    id: 'mock-super-admin',
    email: 'superadmin@groaurum.local',
    phone: null,
    displayName: 'Super Admin (Mock)',
  },
  operations_manager: {
    id: 'mock-ops',
    email: 'ops@groaurum.local',
    phone: null,
    displayName: 'Operations Manager (Mock)',
  },
  warehouse_manager: {
    id: 'mock-warehouse',
    email: 'warehouse@groaurum.local',
    phone: null,
    displayName: 'Warehouse Manager (Mock)',
  },
  sales_manager: {
    id: 'mock-sales-mgr',
    email: 'salesmgr@groaurum.local',
    phone: null,
    displayName: 'Sales Manager (Mock)',
  },
  delivery_manager: {
    id: 'mock-delivery-mgr',
    email: 'deliverymgr@groaurum.local',
    phone: null,
    displayName: 'Delivery Manager (Mock)',
  },
  salesman: {
    id: 'mock-salesman',
    email: null,
    phone: '+919800000014',
    displayName: 'Field Salesman (Mock)',
  },
  delivery_executive: {
    id: 'mock-delivery-exec',
    email: null,
    phone: '+919800000055',
    displayName: 'Delivery Executive (Mock)',
  },
  retail_customer: {
    id: 'mock-customer',
    email: null,
    phone: '+919800000001',
    displayName: 'Retail Customer (Mock)',
  },
  read_only: {
    id: 'mock-readonly',
    email: 'readonly@groaurum.local',
    phone: null,
    displayName: 'Read Only (Mock)',
  },
};

function buildUser(role: AppRole): AuthUser {
  const base = MOCK_USERS[role];
  return {
    ...base,
    primaryRole: role,
    roles: [role],
  };
}

function buildSession(role: AppRole, _env: AppEnv): AuthSession {
  const user = buildUser(role);
  const issuedAt = new Date().toISOString();
  return {
    user,
    accessToken: `mock-access-${role}`,
    refreshToken: `mock-refresh-${role}`,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    audience: audienceForRole(role),
    provider: 'mock',
    issuedAt,
  };
}

export type MockAuthProviderOptions = {
  config: PublicAuthConfig;
  /** Initial role when autoSignIn is true. */
  initialRole?: AppRole;
  /**
   * When true (default in development admin ERP), bootstrap an authenticated session
   * so the UI shell works before login screens exist.
   */
  autoSignIn?: boolean;
};

/**
 * In-memory auth provider for Sprint 2.
 * Replace with createSupabaseAuthProvider when wiring live Auth.
 */
export function createMockAuthProvider(
  options: MockAuthProviderOptions,
): AuthProvider {
  const {
    config,
    initialRole = 'super_admin',
    autoSignIn = config.appEnv === 'development',
  } = options;

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

  // Bootstrap after microtask so subscribers can attach first.
  queueMicrotask(() => {
    if (autoSignIn) {
      setState({
        status: 'authenticated',
        session: buildSession(initialRole, config.appEnv),
        error: null,
      });
    } else {
      setState({ status: 'unauthenticated', session: null, error: null });
    }
  });

  const pendingCodes = new Map<string, string>();

  const provider: AuthProvider = {
    kind: 'mock',
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
      const role = credentials.mockRole ?? initialRole;
      const session = buildSession(role, config.appEnv);
      if (credentials.email) {
        session.user.email = credentials.email.trim().toLowerCase();
      }
      setState({ status: 'authenticated', session, error: null });
      return session;
    },
    async requestEmailCode(email: string) {
      const normalized = assertLoginEmail(email);
      pendingCodes.set(normalized, MOCK_EMAIL_CODE);
    },
    async verifyEmailCode(email: string, code: string) {
      const normalized = assertLoginEmail(email);
      const token = assertSixDigitCode(code);
      if (pendingCodes.get(normalized) !== token) {
        throw createAuthError(
          'unauthorized',
          'That code is not valid. Request a new code and try again.',
        );
      }
      pendingCodes.delete(normalized);
      return this.signIn({ email: normalized, mockRole: initialRole });
    },
    async signOut() {
      setState({ status: 'unauthenticated', session: null, error: null });
    },
    async refreshSession() {
      if (!state.session) return null;
      const role = state.session.user.primaryRole;
      const session = buildSession(role, config.appEnv);
      setState({ status: 'authenticated', session, error: null });
      return session;
    },
    async hydrateFromExternal() {
      setState({
        status: 'error',
        session: null,
        error: createAuthError(
          'unexpected',
          'Mock provider does not hydrate external tokens. Use Supabase adapter.',
        ),
      });
      return null;
    },
  };

  return provider;
}
