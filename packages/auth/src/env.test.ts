import { describe, expect, it } from 'vitest';
import { assertPublicAuthConfig, parsePublicAuthConfig } from './env';

describe('parsePublicAuthConfig', () => {
  it('reads GROAURUM_* fallbacks for Supabase keys', () => {
    const config = parsePublicAuthConfig({
      GROAURUM_AUTH_PROVIDER: 'supabase',
      GROAURUM_SUPABASE_URL: 'https://example.supabase.co',
      GROAURUM_SUPABASE_ANON_KEY: 'anon-key',
    });

    expect(config.authProvider).toBe('supabase');
    expect(config.supabaseUrl).toBe('https://example.supabase.co');
    expect(config.supabaseAnonKey).toBe('anon-key');
  });

  it('defaults to mock auth when provider is unset', () => {
    expect(parsePublicAuthConfig({}).authProvider).toBe('mock');
  });
});

describe('assertPublicAuthConfig', () => {
  it('throws when supabase auth is selected without public keys', () => {
    expect(() =>
      assertPublicAuthConfig({
        appEnv: 'development',
        authProvider: 'supabase',
        supabaseUrl: null,
        supabaseAnonKey: null,
        mockAutoRole: 'super_admin',
      }),
    ).toThrow(/public URL\/key are missing/i);
  });
});
