/** Extensible product type values. Launch examples: PACKED, BULK. */
export const PRODUCT_TYPES = ['PACKED', 'BULK'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/**
 * Standard selling units for grocery / FMCG wholesale SKUs.
 * DB `skus.selling_unit` is free text — custom names are allowed at write time.
 */
export const SELLING_UNITS = [
  'PCS',
  'BOX',
  'CARTON',
  'PACK',
  'BAG',
  'BOTTLE',
  'CAN',
  'KG',
  'GRAM',
  'LITRE',
  'ML',
  'DOZEN',
  'PAIR',
  'ROLL',
  'BUNDLE',
  'TRAY',
  'TIN',
] as const;
export type SellingUnit = (typeof SELLING_UNITS)[number];

/** UI sentinel for custom free-text unit (persisted as the custom name). */
export const CUSTOM_SELLING_UNIT = 'CUSTOM' as const;

export const SELLING_UNIT_LABELS: Record<SellingUnit, string> = {
  PCS: 'Piece / PCS',
  BOX: 'Box',
  CARTON: 'Carton',
  PACK: 'Packet',
  BAG: 'Bag',
  BOTTLE: 'Bottle',
  CAN: 'Can',
  KG: 'Kilogram / Kg',
  GRAM: 'Gram / g',
  LITRE: 'Litre / L',
  ML: 'Millilitre / ml',
  DOZEN: 'Dozen',
  PAIR: 'Pair',
  ROLL: 'Roll',
  BUNDLE: 'Bundle',
  TRAY: 'Tray',
  TIN: 'Tin',
};

export function isStandardSellingUnit(
  value: string | null | undefined,
): value is SellingUnit {
  const u = (value ?? '').trim().toUpperCase();
  return (SELLING_UNITS as readonly string[]).includes(u);
}

export const SHOP_LIFECYCLE_STATUSES = [
  'LEAD',
  'INVITED',
  'ACTIVATED',
  'FIRST_ORDER',
  'REPEAT_CUSTOMER',
  'INACTIVE_OR_FOLLOW_UP',
] as const;
export type ShopLifecycleStatus = (typeof SHOP_LIFECYCLE_STATUSES)[number];

export const STAFF_ROLES = [
  'CUSTOMER',
  'SALESMAN',
  'DELIVERY',
  'ADMIN',
  'READ_ONLY',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const SERVICEABILITY_RULE_TYPES = [
  'PIN_CODE',
  'ADMIN_AREA',
  'POLYGON',
] as const;
export type ServiceabilityRuleType = (typeof SERVICEABILITY_RULE_TYPES)[number];

export const INVENTORY_MOVEMENT_TYPES = [
  'RECEIPT',
  'ORDER_DISPATCH',
  'DAMAGE',
  'RETURN',
  'ADMIN_ADJUSTMENT',
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const STOCK_RESERVATION_STATUSES = [
  'PENDING',
  'RESERVED',
  'RELEASED',
  'FULFILLED',
  'FAILED',
] as const;
export type StockReservationStatus = (typeof STOCK_RESERVATION_STATUSES)[number];

export const ASSISTED_CONFIRMATION_STATUSES = [
  'PENDING',
  'CUSTOMER_CONFIRMED',
  'CUSTOMER_REQUESTED_CHANGES',
  'CUSTOMER_REJECTED',
  'EXPIRED',
] as const;
export type AssistedConfirmationStatus =
  (typeof ASSISTED_CONFIRMATION_STATUSES)[number];

export const PAYMENT_METHOD_INTENTS = [
  'PAY_ONLINE_NOW',
  'PAY_ON_DELIVERY',
] as const;
export type PaymentMethodIntent = (typeof PAYMENT_METHOD_INTENTS)[number];

export const DELIVERY_ROUTE_STATUSES = [
  'DRAFT',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type DeliveryRouteStatus = (typeof DELIVERY_ROUTE_STATUSES)[number];

export const ROUTE_STOP_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
] as const;
export type RouteStopStatus = (typeof ROUTE_STOP_STATUSES)[number];

export const DELIVERY_FAILURE_REASONS = [
  'CUSTOMER_UNAVAILABLE',
  'SHOP_CLOSED',
  'PAYMENT_NOT_AVAILABLE',
  'CUSTOMER_REQUESTED_CREDIT',
  'CUSTOMER_REFUSED_ORDER',
  'ADDRESS_LOCATION_ISSUE',
  'DAMAGED_ORDER_ISSUE',
  'OTHER',
] as const;
export type DeliveryFailureReason = (typeof DELIVERY_FAILURE_REASONS)[number];

/** User-facing labels for delivery failure / delivery problem reasons. */
export const DELIVERY_FAILURE_REASON_LABELS: Record<
  DeliveryFailureReason,
  string
> = {
  CUSTOMER_UNAVAILABLE: 'Customer Not Available',
  SHOP_CLOSED: 'Shop Closed',
  PAYMENT_NOT_AVAILABLE: 'Payment Problem',
  CUSTOMER_REQUESTED_CREDIT: 'Customer Asked for Credit',
  CUSTOMER_REFUSED_ORDER: 'Customer Refused Delivery',
  ADDRESS_LOCATION_ISSUE: 'Wrong Address',
  DAMAGED_ORDER_ISSUE: 'Product Damaged',
  OTHER: 'Other',
};

/** Admin Delivery Problem reason codes (stored in delivery_exceptions.reason_code). */
export const DELIVERY_PROBLEM_REASON_CODES = [
  'CUSTOMER_UNAVAILABLE',
  'SHOP_CLOSED',
  'CUSTOMER_REFUSED_ORDER',
  'ADDRESS_LOCATION_ISSUE',
  'VEHICLE_PROBLEM',
  'DAMAGED_ORDER_ISSUE',
  'PAYMENT_NOT_AVAILABLE',
  'OTHER',
] as const;

export const DELIVERY_PROBLEM_REASON_LABELS: Record<
  (typeof DELIVERY_PROBLEM_REASON_CODES)[number],
  string
> = {
  CUSTOMER_UNAVAILABLE: 'Customer Not Available',
  SHOP_CLOSED: 'Shop Closed',
  CUSTOMER_REFUSED_ORDER: 'Customer Refused Delivery',
  ADDRESS_LOCATION_ISSUE: 'Wrong Address',
  VEHICLE_PROBLEM: 'Vehicle Problem',
  DAMAGED_ORDER_ISSUE: 'Product Damaged',
  PAYMENT_NOT_AVAILABLE: 'Payment Problem',
  OTHER: 'Other',
};

export const OPERATIONAL_LOCATION_KINDS = [
  'OPS_BASE',
  'WAREHOUSE',
  'OTHER',
] as const;
export type OperationalLocationKind = (typeof OPERATIONAL_LOCATION_KINDS)[number];
