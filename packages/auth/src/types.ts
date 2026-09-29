import type { AppAudience, AppRole } from './roles';
import type { Permission } from './permissions';

export type AuthProviderKind = 'mock' | 'supabase';

export type SessionStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

export type AuthErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'session_expired'
  | 'offline'
  | 'unexpected';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  cause?: unknown;
}

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  /** Primary role used for navigation and default checks. */
  primaryRole: AppRole;
  /** Full role set (multi-role staff supported). */
  roles: AppRole[];
  /** Optional org / warehouse scopes for later Supabase RLS claims. */
  warehouseIds?: string[];
  territoryIds?: string[];
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  audience: AppAudience;
  provider: AuthProviderKind;
  issuedAt: string;
}

export interface AuthState {
  status: SessionStatus;
  session: AuthSession | null;
  error: AuthError | null;
}

export type AuthStateListener = (state: AuthState) => void;

export interface SignInCredentials {
  email?: string;
  password?: string;
  phone?: string;
  otp?: string;
  /** Dev-only role picker for mock provider. */
  mockRole?: AppRole;
}

/**
 * Provider contract — mock today, Supabase Auth adapter later.
 * Apps depend on this interface, not on Supabase SDK directly.
 */
export interface AuthProvider {
  readonly kind: AuthProviderKind;
  getSession(): Promise<AuthSession | null>;
  getState(): AuthState;
  subscribe(listener: AuthStateListener): () => void;
  /** Prepared for future login screens — mock may no-op or set role. */
  signIn(credentials: SignInCredentials): Promise<AuthSession>;
  /**
   * Email a 6-digit code to an existing account. Does not create a user.
   * Password sign-in stays available.
   */
  requestEmailCode(email: string): Promise<void>;
  /** Verify the 6-digit email code and start a persisted session. */
  verifyEmailCode(email: string, code: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  refreshSession(): Promise<AuthSession | null>;
  /**
   * Future: map Supabase JWT + profiles.roles → AuthSession.
   * Mock provider ignores.
   */
  hydrateFromExternal?(payload: unknown): Promise<AuthSession | null>;
}

export interface PermissionCheckInput {
  roles: readonly AppRole[];
  permission: Permission;
}
