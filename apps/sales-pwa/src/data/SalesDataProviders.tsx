import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { SalesLanguageProvider } from '@/i18n/language';
import { listOfflineJobs, publishOfflineSync, replaceOfflineJobs } from '@/data/offline-queue';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
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

const QUERY_CACHE_KEY = 'sales.queryCache.v1';

function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  try {
    const raw = globalThis.localStorage?.getItem(QUERY_CACHE_KEY);
    const entries = raw ? (JSON.parse(raw) as { queryKey: unknown[]; data: unknown }[]) : [];
    for (const entry of entries) {
      client.setQueryData(entry.queryKey, entry.data);
    }
  } catch {
    // A damaged cache must not block the app.
  }
  client.getQueryCache().subscribe(() => {
    try {
      const entries = client
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.status === 'success' && Array.isArray(query.queryKey))
        .slice(0, 40)
        .map((query) => ({ queryKey: query.queryKey, data: query.state.data }));
      globalThis.localStorage?.setItem(QUERY_CACHE_KEY, JSON.stringify(entries));
    } catch {
      // Storage can be full or unavailable. The live query still works.
    }
  });
  return client;
}

function OfflineSync() {
  const online = useOnlineStatus();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    const jobs = listOfflineJobs();
    if (!online) {
      wasOffline.current = true;
      publishOfflineSync({ pending: jobs.length, failed: 0, phase: 'idle' });
      return;
    }
    if (!wasOffline.current && jobs.length === 0) return;
    wasOffline.current = false;
    if (jobs.length === 0) return;
    publishOfflineSync({ pending: jobs.length, failed: 0, phase: 'syncing' });
    void (async () => {
      const pending = [];
      for (const job of jobs) {
        try {
          if (job.kind === 'message') await api.sendMessage(job.body);
          if (job.kind === 'expense') {
            await api.createExpense({
              category: job.category,
              amount: job.amount,
              expenseDate: job.expenseDate,
              note: job.note,
            });
          }
        } catch {
          pending.push(job);
        }
      }
      replaceOfflineJobs(pending);
      publishOfflineSync({
        pending: pending.length,
        failed: pending.length,
        phase: pending.length === 0 ? 'sent' : 'failed',
      });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
    })();
  }, [online, api, queryClient]);

  return null;
}

function LanguageBridge({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const profile = useQuery({
    queryKey: ['sales', 'profile', user?.id ?? ''],
    queryFn: () => api.getOwnProfile(),
    enabled: Boolean(user?.id),
  });
  const locale = profile.data?.preferredLanguage === 'hi' ? 'hi' : 'en';
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <SalesLanguageProvider locale={locale}>{children}</SalesLanguageProvider>;
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
        <LanguageBridge>
          <OfflineSync />
          {children}
        </LanguageBridge>
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
