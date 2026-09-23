import { useMemo } from 'react';
import { isMockAdapterMode } from '@/config/env';
import { useCustomerSession } from '@/context/CustomerSessionProvider';
import { useLocationStore } from '@/store/location';

/**
 * Catalogue query scope:
 * - mock mode: legacy dark-store id
 * - supabase mode: linked shop id (never a dark-store)
 */
export function useCatalogueScope(): {
  scopeId: string | null;
  ready: boolean;
  shopName: string | null;
} {
  const { snapshot } = useCustomerSession();
  const store = useLocationStore((s) => s.store);
  const serviceable = useLocationStore((s) => s.serviceable);

  return useMemo(() => {
    if (isMockAdapterMode()) {
      return {
        scopeId: serviceable && store ? store.id : null,
        ready: Boolean(serviceable && store),
        shopName: store?.name ?? null,
      };
    }

    const shop = snapshot.shopContext?.shop;
    const ok =
      snapshot.phase === 'LINKED_SHOP_READY' &&
      Boolean(snapshot.serviceability?.serviceable) &&
      Boolean(shop);

    return {
      scopeId: ok && shop ? shop.id : null,
      ready: ok,
      shopName: shop?.tradeName ?? null,
    };
  }, [snapshot, store, serviceable]);
}
