import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getAdminDataClient,
  type AdminDataClient,
} from '@/data/adminDataClient';
import { getAdminSupabaseClient } from '@/lib/adminSupabaseClient';
import { useRealtimeQueryInvalidation } from '@/realtime/useRealtimeQueryInvalidation';

const DataClientContext = createContext<AdminDataClient | null>(null);

const ADMIN_REALTIME_SPECS = [
  {
    entity: 'orders',
    keys: [
      ['groaurum', 'orders'],
      ['groaurum', 'dashboard'],
    ] as const,
  },
  {
    entity: 'inventory',
    keys: [['groaurum', 'inventory'], ['groaurum', 'dashboard']] as const,
  },
  {
    entity: 'delivery',
    keys: [['groaurum', 'delivery'], ['groaurum', 'dashboard']] as const,
  },
] as const;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}

type Props = {
  children: ReactNode;
};

function AdminRealtimeBridge({ enabled }: { enabled: boolean }) {
  const client = enabled ? getAdminSupabaseClient() : null;
  useRealtimeQueryInvalidation(client, ADMIN_REALTIME_SPECS, enabled);
  return null;
}

/**
 * TanStack Query + repository client for Admin ERP reads.
 * Sprint 9.1: live Realtime invalidation when adapter=supabase.
 */
export function AdminDataProviders({ children }: Props) {
  const client = useMemo(() => getAdminDataClient(), []);
  const queryClient = useMemo(() => createQueryClient(), []);
  const live =
    client.mode === 'supabase' && Boolean(import.meta.env.VITE_SUPABASE_URL);

  return (
    <QueryClientProvider client={queryClient}>
      <DataClientContext.Provider value={client}>
        <AdminRealtimeBridge enabled={live} />
        {children}
      </DataClientContext.Provider>
    </QueryClientProvider>
  );
}

export function useAdminDataClient(): AdminDataClient {
  const ctx = useContext(DataClientContext);
  if (!ctx) {
    throw new Error('useAdminDataClient must be used within AdminDataProviders');
  }
  return ctx;
}
