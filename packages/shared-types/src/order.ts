import type {
  AssistedConfirmationStatus,
  PaymentMethodIntent,
  StaffRole,
} from './enums';
import type { SellingUnit } from './enums';

export const ORDER_STATUSES = [
  'DRAFT_ASSISTED',
  'AWAITING_CUSTOMER_CONFIRMATION',
  'CONFIRMED',
  'STOCK_RESERVED',
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'ASSIGNED_TO_ROUTE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderTotals {
  subtotal: number;
  adjustments: number;
  total: number;
  currency: string;
}

/**
 * Immutable commercial snapshot captured at customer confirmation.
 * Future catalogue edits must not mutate historical order lines.
 */
export interface OrderLine {
  id: string;
  orderId: string;
  skuId: string;
  productNameSnapshot: string;
  skuNameSnapshot: string;
  skuCodeSnapshot: string;
  specificationSnapshot?: string;
  sellingUnitSnapshot: SellingUnit | string;
  quantity: number;
  agreedUnitPrice: number;
  lineTotal: number;
}

export type OrderSource = 'CUSTOMER_SELF_SERVE' | 'SALESMAN_ASSISTED';

export interface Order {
  id: string;
  shopId: string;
  status: OrderStatus;
  source: OrderSource;
  createdByProfileId: string;
  paymentId: string | null;
  serviceAreaId: string;
  expectedDeliveryAt?: string;
  totals: OrderTotals;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorProfileId?: string;
  actorRole?: StaffRole;
  note?: string;
  createdAt: string;
}

export interface AssistedOrderConfirmationChallenge {
  id: string;
  orderId: string;
  token: string;
  status: AssistedConfirmationStatus;
  paymentMethodIntent?: PaymentMethodIntent;
  otpHash?: string;
  expiresAt: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}
