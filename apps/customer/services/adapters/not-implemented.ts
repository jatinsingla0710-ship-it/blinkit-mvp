import type {
  AssistedOrderConfirmationService,
  AuthenticationShopLinkingService,
  CatalogueService,
  DeliveryRouteService,
  InventoryService,
  OrderService,
  PaymentService,
  ServiceAreaService,
  ShopService,
} from '@groaurum/api-client';

const NOT_IMPLEMENTED =
  'B2B service implementation is not available until backend cutover (Phase 3+).';

function notImplementedMethod(method: string): never {
  throw new Error(`${method}: ${NOT_IMPLEMENTED}`);
}

function createProxy<T extends object>(label: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      return () => notImplementedMethod(`${label}.${String(property)}`);
    },
  });
}

export const notImplementedCatalogueService: CatalogueService =
  createProxy<CatalogueService>('CatalogueService');

export const notImplementedServiceAreaService: ServiceAreaService =
  createProxy<ServiceAreaService>('ServiceAreaService');

export const notImplementedShopService: ShopService =
  createProxy<ShopService>('ShopService');

export const notImplementedAuthService: AuthenticationShopLinkingService =
  createProxy<AuthenticationShopLinkingService>('AuthenticationShopLinkingService');

export const notImplementedOrderService: OrderService =
  createProxy<OrderService>('OrderService');

export const notImplementedAssistedOrderService: AssistedOrderConfirmationService =
  createProxy<AssistedOrderConfirmationService>('AssistedOrderConfirmationService');

export const notImplementedPaymentService: PaymentService =
  createProxy<PaymentService>('PaymentService');

export const notImplementedInventoryService: InventoryService =
  createProxy<InventoryService>('InventoryService');

export const notImplementedDeliveryRouteService: DeliveryRouteService =
  createProxy<DeliveryRouteService>('DeliveryRouteService');
