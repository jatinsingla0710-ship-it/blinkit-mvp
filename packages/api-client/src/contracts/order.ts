import type {
  Order,
  OrderLine,
  OrderStatus,
  OrderTotals,
  PaymentMethodIntent,
  SellingUnit,
} from '@groaurum/shared-types';

export interface ServiceActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface DraftOrderLineInput {
  skuId: string;
  quantity: number;
  sellingUnit: SellingUnit;
}

export interface ConfirmCustomerOrderInput {
  orderId: string;
  paymentMethodIntent: PaymentMethodIntent;
  customerOtp: string;
}

export interface OrderService {
  getOrderById(orderId: string): Promise<Order | null>;
  listOrdersForShop(shopId: string): Promise<Order[]>;
  createDraftAssistedOrder(
    shopId: string,
    lines: DraftOrderLineInput[],
    createdByProfileId: string
  ): Promise<ServiceActionResult<Order>>;
  sendForCustomerConfirmation(orderId: string): Promise<ServiceActionResult<Order>>;
  confirmCustomerOrder(
    input: ConfirmCustomerOrderInput
  ): Promise<ServiceActionResult<Order>>;
  reserveOrderStock(orderId: string): Promise<ServiceActionResult<Order>>;
  markOrderProcessing(orderId: string): Promise<ServiceActionResult<Order>>;
  markReadyForDispatch(orderId: string): Promise<ServiceActionResult<Order>>;
  assignOrderToRoute(orderId: string, routeId: string): Promise<ServiceActionResult<Order>>;
  markOutForDelivery(orderId: string): Promise<ServiceActionResult<Order>>;
  completeDelivery(orderId: string): Promise<ServiceActionResult<Order>>;
  failDelivery(
    orderId: string,
    reason: string,
    note?: string
  ): Promise<ServiceActionResult<Order>>;
  cancelOrder(orderId: string, reason?: string): Promise<ServiceActionResult<Order>>;
  buildOrderTotals(lines: OrderLine[]): Promise<OrderTotals>;
  getOrderStatus(orderId: string): Promise<OrderStatus | null>;
}
