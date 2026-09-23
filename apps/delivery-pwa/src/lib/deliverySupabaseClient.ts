import {
  createGroAurumSupabaseClient,
  resolvePublicSupabaseConfigFromEnv,
  type GroAurumSupabaseClient,
} from '@groaurum/api-client';
import { publicOperationalEnv } from '@/lib/operationalEnv';

let singleton: GroAurumSupabaseClient | null = null;

/**
 * Single Supabase client for Delivery PWA auth + data.
 * Sharing the instance ensures JWT from sign-in is used by the delivery service.
 */
export function getDeliverySupabaseClient(): GroAurumSupabaseClient {
  if (singleton) return singleton;
  singleton = createGroAurumSupabaseClient(
    resolvePublicSupabaseConfigFromEnv(publicOperationalEnv()),
  );
  return singleton;
}

export function resetDeliverySupabaseClient(): void {
  singleton = null;
}
