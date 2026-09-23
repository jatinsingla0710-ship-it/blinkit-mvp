import { useMemo } from 'react';
import type { AuthUser } from '../types';
import { useSessionContext } from './SessionProvider';

export function useAuthSession() {
  const ctx = useSessionContext();
  return useMemo(
    () => ({
      status: ctx.status,
      session: ctx.session,
      error: ctx.error,
      isSessionLoading: ctx.isSessionLoading,
      isAuthenticated: ctx.isAuthenticated,
      signIn: ctx.signIn,
      signOut: ctx.signOut,
      refreshSession: ctx.refreshSession,
    }),
    [ctx],
  );
}

export function useCurrentUser(): AuthUser | null {
  const { session } = useSessionContext();
  return session?.user ?? null;
}

export function useSession() {
  return useAuthSession();
}
