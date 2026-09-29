import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthProvider, AuthSession, AuthState, SignInCredentials } from '../types';
import { createAuthError } from '../errors';
import { isSessionExpired } from '../helpers';

export type SessionContextValue = AuthState & {
  provider: AuthProvider;
  isSessionLoading: boolean;
  isAuthenticated: boolean;
  signIn: (credentials: SignInCredentials) => Promise<AuthSession>;
  requestEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<AuthSession | null>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type Props = {
  provider: AuthProvider;
  children: ReactNode;
};

export function SessionProvider({ provider, children }: Props) {
  const [state, setState] = useState<AuthState>(() => provider.getState());

  useEffect(() => {
    return provider.subscribe((next) => {
      if (next.session && isSessionExpired(next.session)) {
        setState({
          status: 'error',
          session: null,
          error: createAuthError(
            'session_expired',
            'Your session has expired. Sign in again.',
          ),
        });
        void provider.signOut();
        return;
      }
      setState(next);
    });
  }, [provider]);

  const signIn = useCallback(
    (credentials: SignInCredentials) => provider.signIn(credentials),
    [provider],
  );
  const requestEmailCode = useCallback(
    (email: string) => provider.requestEmailCode(email),
    [provider],
  );
  const verifyEmailCode = useCallback(
    (email: string, code: string) => provider.verifyEmailCode(email, code),
    [provider],
  );

  const signOut = useCallback(() => provider.signOut(), [provider]);

  const refreshSession = useCallback(
    () => provider.refreshSession(),
    [provider],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      provider,
      isSessionLoading: state.status === 'loading',
      isAuthenticated: state.status === 'authenticated' && Boolean(state.session),
      signIn,
      requestEmailCode,
      verifyEmailCode,
      signOut,
      refreshSession,
    }),
    [state, provider, signIn, requestEmailCode, verifyEmailCode, signOut, refreshSession],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return ctx;
}
