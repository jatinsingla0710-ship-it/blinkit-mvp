import {
  createGroAurumSupabaseClient,
  resolvePublicSupabaseConfigFromEnv,
  type GroAurumSupabaseClient,
} from '@groaurum/api-client';
import { publicOperationalEnv } from '@/lib/operationalEnv';

let singleton: GroAurumSupabaseClient | null = null;

/**
 * Single Supabase client for Admin ERP auth + data.
 * Sharing the instance ensures JWT from sign-in is used by LiveAdminApi / repos.
 */
export function getAdminSupabaseClient(): GroAurumSupabaseClient {
  if (singleton) return singleton;
  singleton = createGroAurumSupabaseClient(
    resolvePublicSupabaseConfigFromEnv(publicOperationalEnv()),
  );
  return singleton;
}

export function resetAdminSupabaseClient(): void {
  singleton = null;
}
