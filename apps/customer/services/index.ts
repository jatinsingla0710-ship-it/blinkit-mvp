import {
  createSupabaseCustomerServices,
  resolveCustomerSession,
} from '@groaurum/api-client';

import {
  notImplementedAssistedOrderService,
  notImplementedAuthService,
  notImplementedCatalogueService,
  notImplementedDeliveryRouteService,
  notImplementedInventoryService,
  notImplementedOrderService,
  notImplementedPaymentService,
  notImplementedServiceAreaService,
  notImplementedShopService,
} from './adapters/not-implemented';
import { getActiveAdapterMode, getSupabaseCustomerServices } from './adapters/factory';

/**
 * GroAurum service boundary.
 *
 * - In `supabase` mode, catalogue/shop/serviceArea/auth are real adapters.
 * - In `mock` mode, B2B contracts remain not-implemented; screens use
 *   `@/services/customer-catalogue` which delegates to legacy mock.
 * - `legacyMvp` re-exports the in-memory mock for development comparison.
 */
function buildB2B() {
  const mode = getActiveAdapterMode();
  if (mode === 'supabase') {
    const services = getSupabaseCustomerServices();
    if (!services) {
      throw new Error('Supabase customer services failed to initialize.');
    }
    return {
      catalogue: services.catalogue,
      serviceArea: services.serviceArea,
      shop: services.shop,
      auth: services.auth,
      order: notImplementedOrderService,
      assistedOrder: notImplementedAssistedOrderService,
      payment: notImplementedPaymentService,
      inventory: notImplementedInventoryService,
      deliveryRoute: notImplementedDeliveryRouteService,
    } as const;
  }

  return {
    catalogue: notImplementedCatalogueService,
    serviceArea: notImplementedServiceAreaService,
    shop: notImplementedShopService,
    auth: notImplementedAuthService,
    order: notImplementedOrderService,
    assistedOrder: notImplementedAssistedOrderService,
    payment: notImplementedPaymentService,
    inventory: notImplementedInventoryService,
    deliveryRoute: notImplementedDeliveryRouteService,
  } as const;
}

export const b2b = new Proxy({} as ReturnType<typeof buildB2B>, {
  get(_target, property) {
    return (buildB2B() as Record<string | symbol, unknown>)[property];
  },
});

export { resolveCustomerSession, createSupabaseCustomerServices };
export * as legacyMvp from './adapters/legacy-mvp';
export * from '@groaurum/api-client';
export * from './mock';
