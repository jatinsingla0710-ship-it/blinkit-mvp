import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createSalesmanApi,
  isSalesDataMockMode,
  type SalesmanApi,
} from '@/data/salesmanApi';
import { getSalesSupabaseClient } from '@/lib/salesSupabaseClient';
import { useRealtimeQueryInvalidation } from '@/realtime/useRealtimeQueryInvalidation';

const SalesmanApiContext = createContext<SalesmanApi | null>(null);

const SALES_REALTIME_SPECS = [
  {
    entity: 'shops',
    keys: [['sales', 'retailers'], ['sales', 'dashboard']] as const,
  },
  {
    entity: 'orders',
    keys: [['sales', 'dashboard']] as const,
  },
] as const;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

type Props = {
  children: ReactNode;
};

function SalesRealtimeBridge({ enabled }: { enabled: boolean }) {
  const client = enabled ? getSalesSupabaseClient() : null;
  useRealtimeQueryInvalidation(client, SALES_REALTIME_SPECS, enabled);
  return null;
}

/**
 * TanStack Query + salesman service for Sales PWA.
 */
export function SalesDataProviders({ children }: Props) {
  const api = useMemo(() => createSalesmanApi(), []);
  const queryClient = useMemo(() => createQueryClient(), []);
  const live =
    !isSalesDataMockMode() && Boolean(import.meta.env.VITE_SUPABASE_URL);

  return (
    <QueryClientProvider client={queryClient}>
      <SalesmanApiContext.Provider value={api}>
        <SalesRealtimeBridge enabled={live} />
        {children}
      </SalesmanApiContext.Provider>
    </QueryClientProvider>
  );
}

export function useSalesmanApi(): SalesmanApi {
  const ctx = useContext(SalesmanApiContext);
  if (!ctx) {
    throw new Error('useSalesmanApi must be used within SalesDataProviders');
  }
  return ctx;
}
