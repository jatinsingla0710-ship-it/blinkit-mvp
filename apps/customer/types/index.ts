/**
 * Legacy consumer MVP types used by the current runnable Expo app.
 * Target GroAurum B2B domain types live in `@groaurum/shared-types`.
 * Service contracts live in `@groaurum/api-client`.
 */
import type { SellingUnit } from '@groaurum/shared-types';

/** Wholesale fulfilment lifecycle (Order Timeline v1). */
export type OrderStatus =
  | 'AWAITING_CUSTOMER_CONFIRMATION'
  | 'CONFIRMED'
  | 'STOCK_RESERVED'
  | 'PACKING'
  | 'READY_FOR_DISPATCH'
  | 'ASSIGNED_TO_ROUTE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
}

export type PaymentStatusUi = 'PAID' | 'UNPAID' | 'PENDING';

export type SellingUnitUi = SellingUnit | 'UNIT' | string;

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Store {
  id: string;
  name: string;
  lat: number;
  lng: number;
  serviceRadiusKm: number;
  etaMinutes: number;
  area: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  price: number;
  mrp: number;
  unit: string;
  imageEmoji: string;
  /** Cover product image URL when available (Supabase Storage / CDN). */
  imageUrl?: string;
  /** All product image URLs for gallery display. */
  imageUrls?: string[];
  stock: number;
  bestseller?: boolean;
  description?: string;
  /** B2B commercial fields (Phase 3+ UI) */
  grade?: string;
  specification?: string;
  moq: number;
  quantityStep: number;
  packsPerCarton?: number;
  outerType?: string;
  netQuantityUnit?: string;
  sellingUnit: SellingUnitUi;
  /** @deprecated Legacy pack-quantity absolute price tiers. */
  priceTiers?: Array<{ minQuantity: number; unitPrice: number }>;
  /** Quantity discount per outer unit (Bag/Box/Carton). */
  outerDiscountTiers?: Array<{
    minOuterQuantity: number;
    discountPerOuterUnit: number;
  }>;
  packDiscountType?: 'none' | 'percent' | 'fixed';
  packDiscountValue?: number;
  containerPriceMode?: 'calculated' | 'custom';
  containerCustomPrice?: number | null;
  containerDiscountType?: 'none' | 'percent' | 'fixed';
  containerDiscountValue?: number;
  stockStatus: StockStatus;
  /** Primary CTA label, e.g. "+ Add Carton" or "+ Add 10 KG" */
  addActionLabel: string;
}

export interface Address {
  id: string;
  label: string;
  text: string;
  lat: number;
  lng: number;
}

export interface CartLine {
  productId: string;
  qty: number;
}

export interface OrderLine {
  productId: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  imageEmoji: string;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  handlingFee: number;
  total: number;
}

export interface RiderMock {
  name: string;
  progress: number;
}

export interface Order {
  id: string;
  storeId: string;
  storeName: string;
  /** Retailer shop trade name when known. */
  shopName?: string;
  salesExecutive?: string;
  deliverySchedule?: string;
  notes?: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  lines: OrderLine[];
  totals: OrderTotals;
  address: Address;
  createdAt: string;
  etaMinutes: number;
  paymentMethod: string;
  paymentStatus: PaymentStatusUi;
  /** Legacy mock field — not shown on Order Timeline v1. */
  riderMock: RiderMock;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  store: Store | null;
  distanceKm: number | null;
}

export interface TradePriceMovement {
  id: string;
  name: string;
  unit: string;
  tradePrice: number;
  changeAmount: number;
  changePercent: number;
}

export interface HomeServiceSummary {
  nextDeliveryLabel: string;
  timeSlot: string;
}

export interface HomeLastOrderSummary {
  id: string;
  fulfillmentLabel: string;
  paymentStatus: PaymentStatusUi;
  total: number;
}

/** Restock suggestion row — quantities derived from order history + SKU config. */
export interface RestockSuggestion {
  product: Product;
  lastOrderedQty: number;
  suggestedQty: number;
}
