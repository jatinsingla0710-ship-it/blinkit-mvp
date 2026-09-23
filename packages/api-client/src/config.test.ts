import { describe, expect, it } from 'vitest';
import {
  parsePublicSupabaseConfig,
  resolvePublicSupabaseConfigFromEnv,
} from './config';

describe('resolvePublicSupabaseConfigFromEnv', () => {
  const url = 'https://example.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

  it('prefers VITE_* keys', () => {
    expect(
      resolvePublicSupabaseConfigFromEnv({
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_ANON_KEY: anonKey,
        GROAURUM_SUPABASE_URL: 'https://ignored.example',
      }),
    ).toEqual({ url, anonKey });
  });

  it('falls back to GROAURUM_* and EXPO_PUBLIC_* keys', () => {
    expect(
      resolvePublicSupabaseConfigFromEnv({
        GROAURUM_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      }),
    ).toEqual({ url, anonKey });
  });

  it('throws when anon key is missing', () => {
    expect(() =>
      resolvePublicSupabaseConfigFromEnv({
        VITE_SUPABASE_URL: url,
      }),
    ).toThrow(/Missing Supabase anon/i);
  });

  it('rejects service-role keys', () => {
    expect(() =>
      parsePublicSupabaseConfig({
        url,
        anonKey: 'service_role_secret',
      }),
    ).toThrow(/Service-role keys are forbidden/i);
  });
});
