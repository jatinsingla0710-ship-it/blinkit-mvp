/**
 * Realtime contracts + Supabase postgres_changes bus.
 */

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | 'INVALIDATE';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  entity: string;
  id?: string;
  payload?: T;
  at: string;
}

export type RealtimeListener<T = unknown> = (
  event: RealtimeEvent<T>,
) => void;

export type Unsubscribe = () => void;

export interface RealtimeBus {
  subscribe<T = unknown>(
    entity: string,
    listener: RealtimeListener<T>,
  ): Unsubscribe;
  publish?<T = unknown>(event: RealtimeEvent<T>): void;
}

export function createNoopRealtimeBus(): RealtimeBus {
  return {
    subscribe() {
      return () => undefined;
    },
  };
}

/** Minimal Supabase realtime client surface used by the live bus. */
export type SupabaseRealtimeClientLike = {
  channel: (name: string) => {
    on: (
      event: 'postgres_changes',
      filter: Record<string, unknown>,
      callback: (payload: {
        eventType: string;
        new: Record<string, unknown>;
        old: Record<string, unknown>;
      }) => void,
    ) => { subscribe: () => unknown };
  };
  removeChannel: (channel: unknown) => void;
};

/**
 * Map logical entity names used by admin/PWA repos to public tables.
 */
const ENTITY_TABLE: Record<string, string> = {
  orders: 'orders',
  order_events: 'order_events',
  inventory: 'inventory_balances',
  delivery: 'delivery_routes',
  delivery_routes: 'delivery_routes',
  route_stops: 'route_stops',
  payments: 'payments',
  products: 'products',
  skus: 'skus',
  sku_prices: 'sku_prices',
  shops: 'shops',
  categories: 'categories',
};

/**
 * Live Supabase Realtime bus for order / inventory / delivery / KPI refreshes.
 * Callers subscribe by entity name; UI should invalidate queries on events.
 */
export function createSupabaseRealtimeBus(
  client: SupabaseRealtimeClientLike,
): RealtimeBus {
  return {
    subscribe<T = unknown>(entity: string, listener: RealtimeListener<T>) {
      const table = ENTITY_TABLE[entity] ?? entity;
      const channelName = `groaurum:${entity}:${Math.random().toString(36).slice(2)}`;
      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            const row = (payload.new ?? payload.old ?? {}) as Record<
              string,
              unknown
            >;
            const type =
              payload.eventType === 'INSERT'
                ? 'INSERT'
                : payload.eventType === 'DELETE'
                  ? 'DELETE'
                  : 'UPDATE';
            listener({
              type,
              entity,
              id: typeof row.id === 'string' ? row.id : undefined,
              payload: (payload.new ?? payload.old) as T,
              at: new Date().toISOString(),
            });
          },
        );

      channel.subscribe();

      return () => {
        client.removeChannel(channel);
      };
    },
    publish(event) {
      void event;
    },
  };
}
