import React, { createContext, useContext, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerSessionProvider } from '@/context/CustomerSessionProvider';
import { CustomerFlowGate } from '@/components/CustomerFlowGate';
import { getSupabaseCustomerServices } from '@/services/adapters/factory';
import { isSupabaseAdapterMode } from '@/config/env';
import { useRealtimeQueryInvalidation } from '@/realtime/useRealtimeQueryInvalidation';

const QueryContext = createContext<QueryClient | null>(null);

const CUSTOMER_REALTIME_SPECS = [
  {
    entity: 'orders',
    keys: [
      ['customer', 'orders'],
      ['customer', 'order'],
      ['orders'],
      ['order'],
    ] as const,
  },
  {
    entity: 'order_events',
    keys: [['customer', 'order'], ['order']] as const,
  },
] as const;

function CustomerRealtimeBridge() {
  const services = useMemo(() => getSupabaseCustomerServices(), []);
  const enabled = isSupabaseAdapterMode() && Boolean(services?.client);
  useRealtimeQueryInvalidation(services?.client ?? null, CUSTOMER_REALTIME_SPECS, enabled);
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <QueryContext.Provider value={client}>
        <CustomerRealtimeBridge />
        <CustomerSessionProvider>
          <CustomerFlowGate>{children}</CustomerFlowGate>
        </CustomerSessionProvider>
      </QueryContext.Provider>
    </QueryClientProvider>
  );
}

export function useAppQueryClient() {
  return useContext(QueryContext);
}
