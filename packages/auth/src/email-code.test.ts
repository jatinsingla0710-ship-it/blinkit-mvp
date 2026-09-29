import { describe, expect, it } from 'vitest';
import { createAuthProvider, type PublicAuthConfig } from './index';
import {
  assertSixDigitCode,
  emailCodeErrorMessage,
  MOCK_EMAIL_CODE,
} from './index';
import { createSupabaseAuthProvider } from './providers/supabase-auth-provider';
import type { SupabaseAuthClientLike } from './providers/supabase-auth-provider';

const mockConfig: PublicAuthConfig = {
  appEnv: 'development',
  authProvider: 'mock',
  supabaseUrl: null,
  supabaseAnonKey: null,
  mockAutoRole: 'salesman',
};

describe('email code helpers', () => {
  it('rejects a code that is not 6 digits', () => {
    expect(() => assertSixDigitCode('12345')).toThrow(/6-digit/);
    expect(assertSixDigitCode('123456')).toBe('123456');
  });

  it('maps rate limits and unknown accounts to recovery messages', () => {
    expect(emailCodeErrorMessage('email rate limit exceeded', 'send')).toMatch(/Wait a minute/);
    expect(emailCodeErrorMessage('Signups not allowed for otp', 'send')).toMatch(/use your password/);
    expect(emailCodeErrorMessage('Token has expired or is invalid', 'verify')).toMatch(/Request a new code/);
  });
});

describe('mock email code and password fallback', () => {
  it('signs in with the emailed code and still accepts a password', async () => {
    const provider = createAuthProvider({
      config: mockConfig,
      autoSignIn: false,
      initialRole: 'salesman',
    });
    await provider.requestEmailCode('  Sales@Company.test ');
    await expect(provider.verifyEmailCode('sales@company.test', '000000')).rejects.toThrow(
      /not valid/,
    );
    const session = await provider.verifyEmailCode('sales@company.test', MOCK_EMAIL_CODE);
    expect(session.user.email).toBe('sales@company.test');
    expect(session.user.primaryRole).toBe('salesman');
    expect(session.provider).toBe('mock');

    const passwordSession = await provider.signIn({
      email: 'sales@company.test',
      password: 'existing-password',
    });
    expect(passwordSession.user.primaryRole).toBe('salesman');
    expect(passwordSession.accessToken).toBeTruthy();
  });
});

describe('supabase email code', () => {
  it('requests a code without creating a user, then verifies it', async () => {
    const calls: string[] = [];
    const client = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => {
          calls.push('password');
          return {
            data: {
              session: {
                access_token: 'pw',
                refresh_token: 'pw-r',
                user: { id: 'user-1', email: 'a@co.test', phone: null },
              },
              user: { id: 'user-1', email: 'a@co.test', phone: null },
            },
            error: null,
          };
        },
        signInWithOtp: async (credentials: { email: string; options?: { shouldCreateUser?: boolean } }) => {
          calls.push(`otp:${credentials.email}:${String(credentials.options?.shouldCreateUser)}`);
          return { error: null };
        },
        verifyOtp: async () => {
          calls.push('verify');
          return {
            data: {
              session: {
                access_token: 'otp',
                refresh_token: 'otp-r',
                user: { id: 'user-1', email: 'a@co.test', phone: null },
              },
            },
            error: null,
          };
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'user-1',
                display_name: 'Asha',
                mobile: '919800000000',
                roles: ['SALESMAN'],
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseAuthClientLike;

    const provider = createSupabaseAuthProvider({
      config: { ...mockConfig, authProvider: 'supabase' },
      client,
      autoSignInCredentials: null,
    });
    await provider.requestEmailCode('A@co.test');
    const session = await provider.verifyEmailCode('a@co.test', '654321');
    expect(calls).toContain('otp:a@co.test:false');
    expect(calls).toContain('verify');
    expect(session.accessToken).toBe('otp');
    expect(session.user.displayName).toBe('Asha');

    await provider.signIn({ email: 'a@co.test', password: 'secret' });
    expect(calls).toContain('password');
  });

  it('does not treat a failed code request as a session', async () => {
    const client = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
        signInWithOtp: async () => ({ error: { message: 'Signups not allowed for otp' } }),
        verifyOtp: async () => ({ data: { session: null }, error: { message: 'invalid' } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseAuthClientLike;

    const provider = createSupabaseAuthProvider({
      config: { ...mockConfig, authProvider: 'supabase' },
      client,
      autoSignInCredentials: null,
    });
    await expect(provider.requestEmailCode('missing@co.test')).rejects.toThrow(/use your password/);
    expect(provider.getState().status).not.toBe('authenticated');
  });
});
