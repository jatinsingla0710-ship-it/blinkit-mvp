import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createDeliveryApi, type DeliveryApi } from '@/data/deliveryApi';
import { getDeliverySupabaseClient } from '@/lib/deliverySupabaseClient';
import { resolveOperationalDataAdapter } from '@/lib/operationalEnv';
import { useRealtimeQueryInvalidation } from '@/realtime/useRealtimeQueryInvalidation';

const DeliveryApiContext = createContext<DeliveryApi | null>(null);

const DELIVERY_REALTIME_SPECS = [
  {
    entity: 'delivery',
    keys: [['delivery', 'routes'], ['delivery', 'dashboard']] as const,
  },
  {
    entity: 'route_stops',
    keys: [
      ['delivery', 'route-stops'],
      ['delivery', 'dashboard'],
      ['delivery', 'cod'],
    ] as const,
  },
  {
    entity: 'orders',
    keys: [['delivery', 'dashboard'], ['delivery', 'cod']] as const,
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

function DeliveryRealtimeBridge({ enabled }: { enabled: boolean }) {
  const client = enabled ? getDeliverySupabaseClient() : null;
  useRealtimeQueryInvalidation(client, DELIVERY_REALTIME_SPECS, enabled);
  return null;
}

/**
 * TanStack Query + delivery service for Delivery PWA.
 */
export function DeliveryDataProviders({ children }: Props) {
  const api = useMemo(() => createDeliveryApi(), []);
  const queryClient = useMemo(() => createQueryClient(), []);
  const live =
    resolveOperationalDataAdapter() === 'supabase' &&
    Boolean(import.meta.env.VITE_SUPABASE_URL);

  return (
    <QueryClientProvider client={queryClient}>
      <DeliveryApiContext.Provider value={api}>
        <DeliveryRealtimeBridge enabled={live} />
        {children}
      </DeliveryApiContext.Provider>
    </QueryClientProvider>
  );
}

export function useDeliveryApi(): DeliveryApi {
  const ctx = useContext(DeliveryApiContext);
  if (!ctx) {
    throw new Error('useDeliveryApi must be used within DeliveryDataProviders');
  }
  return ctx;
}
