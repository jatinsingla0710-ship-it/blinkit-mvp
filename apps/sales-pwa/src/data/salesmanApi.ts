import { createSupabaseSalesmanService, type SalesmanService } from '@groaurum/api-client';
import { getSalesSupabaseClient } from '@/lib/salesSupabaseClient';
import { resolveOperationalDataAdapter } from '@/lib/operationalEnv';

/** Public salesman API surface used by pages (excludes internal mappers). */
export type SalesmanApi = Omit<SalesmanService, '_maps'>;

let devMockApi: SalesmanApi | null = null;

/** Called from the development boot path only. Production never loads the mock module. */
export function installDevMockSalesmanApi(api: SalesmanApi): void {
  devMockApi = api;
}

export function createSalesmanApi(): SalesmanApi {
  if (resolveOperationalDataAdapter() === 'supabase') {
    return createSupabaseSalesmanService(getSalesSupabaseClient());
  }
  if (devMockApi) return devMockApi;
  throw new Error(
    'Demo data is only available in local development. Production requires VITE_DATA_ADAPTER=supabase.',
  );
}

/** True when Sales PWA is using in-memory mock/demo data (not Supabase). */
export function isSalesDataMockMode(): boolean {
  return resolveOperationalDataAdapter() !== 'supabase';
}
