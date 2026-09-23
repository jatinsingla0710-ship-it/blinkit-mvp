/**
 * Customer orders bridge — mock UI Order shape ↔ live Supabase orders.
 */
import type { Order as B2BOrder, OrderStatus as B2BOrderStatus } from '@groaurum/shared-types';
import type { Address, Order, OrderStatus, OrderStatusEvent, PaymentStatusUi } from '@/types';
import { getActiveAdapterMode, getSupabaseCustomerServices } from './adapters/factory';
import * as mock from './mock';
import { getOrderStatusLabel as mockStatusLabel } from './mock/orders';

function mapUiStatus(status: B2BOrderStatus): OrderStatus {
  switch (status) {
    case 'DRAFT_ASSISTED':
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      return 'AWAITING_CUSTOMER_CONFIRMATION';
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'STOCK_RESERVED':
      return 'STOCK_RESERVED';
    case 'PROCESSING':
      return 'PACKING';
    case 'READY_FOR_DISPATCH':
      return 'READY_FOR_DISPATCH';
    case 'ASSIGNED_TO_ROUTE':
      return 'ASSIGNED_TO_ROUTE';
    case 'OUT_FOR_DELIVERY':
      return 'OUT_FOR_DELIVERY';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'DELIVERY_FAILED':
    case 'CANCELLED':
      return 'CONFIRMED';
    default:
      return 'CONFIRMED';
  }
}

function mapB2BOrderToUi(
  order: B2BOrder,
  opts: {
    shopName: string;
    address: Address;
    events?: Array<{ toStatus: B2BOrderStatus; at: string }>;
  },
): Order {
  const status = mapUiStatus(order.status);
  const history: OrderStatusEvent[] = (opts.events ?? []).map((event) => ({
    status: mapUiStatus(event.toStatus),
    at: event.at,
  }));
  if (history.length === 0) {
    history.push({ status, at: order.createdAt });
  }

  return {
    id: order.id,
    storeId: order.shopId,
    storeName: opts.shopName,
    shopName: opts.shopName,
    status,
    statusHistory: history,
    lines: order.lines.map((line) => ({
      productId: line.skuId,
      name: line.productNameSnapshot || line.skuNameSnapshot,
      unit: line.sellingUnitSnapshot,
      price: line.agreedUnitPrice,
      qty: line.quantity,
      imageEmoji: '📦',
    })),
    totals: {
      subtotal: order.totals.subtotal,
      deliveryFee: 0,
      handlingFee: order.totals.adjustments,
      total: order.totals.total,
    },
    address: opts.address,
    createdAt: order.createdAt,
    etaMinutes: 0,
    paymentMethod: 'Pay on Delivery',
    paymentStatus: (order.paymentId ? 'PAID' : 'UNPAID') as PaymentStatusUi,
    riderMock: { name: '—', progress: 0 },
    notes: undefined,
    deliverySchedule: undefined,
    salesExecutive: undefined,
  };
}

function shopAddressFromSession(shop: {
  id: string;
  tradeName: string;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}): Address {
  return {
    id: shop.id,
    label: shop.tradeName,
    text: `${shop.deliveryAddressLine}, ${shop.deliveryCity}, ${shop.deliveryState} ${shop.deliveryPinCode}`,
    lat: shop.deliveryLat ?? 0,
    lng: shop.deliveryLng ?? 0,
  };
}

export function getCustomerOrderStatusLabel(status: OrderStatus): string {
  return mockStatusLabel(status);
}

export async function fetchCustomerOrders(shopId: string): Promise<Order[]> {
  const mode = getActiveAdapterMode();
  if (mode === 'mock') {
    return mock.getOrders();
  }

  const services = getSupabaseCustomerServices();
  if (!services) {
    throw new Error('Supabase customer services are not configured.');
  }

  const shop = await services.shop.getShopById(shopId);
  const shopName = shop?.tradeName ?? 'Shop';
  const address = shop
    ? shopAddressFromSession(shop)
    : {
        id: shopId,
        label: 'Delivery',
        text: 'Linked shop address',
        lat: 0,
        lng: 0,
      };

  const orders = await services.order.listOrdersForShop(shopId);
  const result: Order[] = [];
  for (const order of orders) {
    const events = await services.order.listOrderEvents(order.id);
    result.push(
      mapB2BOrderToUi(order, {
        shopName,
        address,
        events,
      }),
    );
  }
  return result;
}

export async function fetchCustomerOrderById(
  orderId: string,
  shopId: string,
): Promise<Order | null> {
  const mode = getActiveAdapterMode();
  if (mode === 'mock') {
    return (await mock.getOrderById(orderId)) ?? null;
  }

  const services = getSupabaseCustomerServices();
  if (!services) {
    throw new Error('Supabase customer services are not configured.');
  }

  const order = await services.order.getOrderById(orderId);
  if (!order || order.shopId !== shopId) return null;

  const shop = await services.shop.getShopById(shopId);
  const events = await services.order.listOrderEvents(orderId);
  return mapB2BOrderToUi(order, {
    shopName: shop?.tradeName ?? 'Shop',
    address: shop
      ? shopAddressFromSession(shop)
      : {
          id: shopId,
          label: 'Delivery',
          text: 'Linked shop address',
          lat: 0,
          lng: 0,
        },
    events,
  });
}

export async function placeCustomerOrder(input: {
  shopId: string;
  serviceAreaId: string;
  lines: Array<{ skuId: string; quantity: number; agreedUnitPrice: number }>;
  notes?: string;
}): Promise<Order> {
  if (getActiveAdapterMode() === 'mock') {
    throw new Error(
      'Live order placement is not available in mock adapter mode.',
    );
  }

  const services = getSupabaseCustomerServices();
  if (!services) {
    throw new Error('Supabase customer services are not configured.');
  }

  const created = await services.order.placeCustomerSelfServeOrder(input);
  const shop = await services.shop.getShopById(input.shopId);
  const events = await services.order.listOrderEvents(created.id);
  return mapB2BOrderToUi(created, {
    shopName: shop?.tradeName ?? 'Shop',
    address: shop
      ? shopAddressFromSession(shop)
      : {
          id: input.shopId,
          label: 'Delivery',
          text: 'Linked shop address',
          lat: 0,
          lng: 0,
        },
    events,
  });
}
