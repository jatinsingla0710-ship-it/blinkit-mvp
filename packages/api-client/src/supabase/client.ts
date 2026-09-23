import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { parsePublicSupabaseConfig, type PublicSupabaseConfig } from '../config';

export type GroAurumSupabaseClient = SupabaseClient<Database>;

/**
 * Creates a typed Supabase client for customer (anon/publishable) usage.
 * Never pass service-role or database passwords here.
 */
export function createGroAurumSupabaseClient(
  config: PublicSupabaseConfig | { url?: string | null; anonKey?: string | null },
): GroAurumSupabaseClient {
  const validated = parsePublicSupabaseConfig({
    url: 'url' in config ? config.url : undefined,
    anonKey: 'anonKey' in config ? config.anonKey : undefined,
  });

  return createClient<Database>(validated.url, validated.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
