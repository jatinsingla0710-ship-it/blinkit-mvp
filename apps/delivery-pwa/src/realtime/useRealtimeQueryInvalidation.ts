import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSupabaseRealtimeBus } from '@groaurum/data';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';

type Spec = {
  entity: string;
  keys: readonly (readonly unknown[])[];
};

/** Sprint 9.1 — postgres_changes → React Query invalidation. */
export function useRealtimeQueryInvalidation(
  client: GroAurumSupabaseClient | null | undefined,
  specs: readonly Spec[],
  enabled = true,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !client) return;
    const bus = createSupabaseRealtimeBus(client as never);
    const unsubs = specs.map((spec) =>
      bus.subscribe(spec.entity, () => {
        for (const key of spec.keys) {
          void queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }),
    );
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [client, enabled, queryClient, specs]);
}
