import {
  assertAdapterMode,
  createSupabaseCustomerServices,
  type CustomerB2BServices,
  type CustomerDataAdapterMode,
} from '@groaurum/api-client';
import {
  getCustomerDataAdapterMode,
  getPublicSupabaseConfig,
} from '@/config/env';

let cached: CustomerB2BServices | null = null;
let cachedMode: CustomerDataAdapterMode | null = null;

/**
 * Returns Supabase-backed B2B services when adapter mode is `supabase`.
 * Throws if mode is supabase but config is invalid.
 * Returns null in mock mode (legacy mock path remains separate).
 */
export function getSupabaseCustomerServices(): CustomerB2BServices | null {
  const mode = assertAdapterMode(getCustomerDataAdapterMode());
  if (mode === 'mock') {
    return null;
  }

  if (cached && cachedMode === mode) {
    return cached;
  }

  const config = getPublicSupabaseConfig();
  cached = createSupabaseCustomerServices(config);
  cachedMode = mode;
  return cached;
}

export function resetCustomerServicesCache(): void {
  cached = null;
  cachedMode = null;
}

export function getActiveAdapterMode(): CustomerDataAdapterMode {
  return assertAdapterMode(getCustomerDataAdapterMode());
}
