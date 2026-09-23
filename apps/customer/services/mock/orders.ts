import type {
  Address,
  CartLine,
  Order,
  OrderLine,
  OrderStatus,
  OrderTotals,
  Product,
} from '@/types';
import { computeOrderTotals } from '@/utils/order-totals';
import { decrementStock, getLiveStock, getProductById } from './catalog';
import { getStoreById } from './geo';
import { presetAddresses } from './data';
import {
  buildCompletedStatusHistory,
  getOrderStatusLabel as timelineStatusLabel,
  WHOLESALE_ORDER_TIMELINE,
} from '@/services/order-timeline';

const RIDER_NAMES = ['Aman', 'Priya', 'Rohit', 'Neha', 'Vikram'];

let orders: Order[] = [];
const timers = new Map<string, ReturnType<typeof setInterval>>();

const STATUS_FLOW: OrderStatus[] = WHOLESALE_ORDER_TIMELINE.map((s) => s.status);

function delay(ms = 200) {
  return new Promise((r) => setTimeout(r, ms));
}

export function computeTotals(lines: { price: number; qty: number }[]): OrderTotals {
  return computeOrderTotals(lines);
}

export type StockIssue = {
  productId: string;
  name: string;
  requested: number;
  available: number;
};

export async function validateCartStock(
  lines: CartLine[]
): Promise<StockIssue[]> {
  await delay(80);
  const issues: StockIssue[] = [];
  for (const line of lines) {
    const available = getLiveStock(line.productId);
    if (line.qty > available) {
      const product = await getProductById(line.productId);
      issues.push({
        productId: line.productId,
        name: product?.name ?? line.productId,
        requested: line.qty,
        available,
      });
    }
  }
  return issues;
}

export async function createOrder(input: {
  storeId: string;
  lines: CartLine[];
  address: Address;
  paymentMethod: string;
  notes?: string;
  shopName?: string;
  salesExecutive?: string;
  deliverySchedule?: string;
}): Promise<Order> {
  await delay(350);

  const store = getStoreById(input.storeId);
  if (!store) throw new Error('Store not found');

  const issues = await validateCartStock(input.lines);
  if (issues.length) {
    throw new Error(
      `Stock changed: ${issues.map((i) => i.name).join(', ')}`
    );
  }

  const orderLines: OrderLine[] = [];
  for (const line of input.lines) {
    const product = await getProductById(line.productId);
    if (!product) continue;
    const ok = decrementStock(line.productId, line.qty);
    if (!ok) throw new Error(`Out of stock: ${product.name}`);
    orderLines.push({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      price: product.price,
      qty: line.qty,
      imageEmoji: product.imageEmoji,
    });
  }

  if (!orderLines.length) throw new Error('Cart is empty');

  const createdAt = new Date().toISOString();
  const order: Order = {
    id: `GA-${Date.now().toString(36).toUpperCase()}`,
    storeId: store.id,
    storeName: store.name,
    shopName: input.shopName,
    salesExecutive: input.salesExecutive,
    deliverySchedule: input.deliverySchedule,
    notes: input.notes?.trim() || undefined,
    status: 'CONFIRMED',
    statusHistory: [{ status: 'CONFIRMED', at: createdAt }],
    lines: orderLines,
    totals: computeTotals(orderLines),
    address: input.address,
    createdAt,
    etaMinutes: store.etaMinutes,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod.toLowerCase().includes('cash')
      ? 'UNPAID'
      : 'PAID',
    riderMock: {
      name: RIDER_NAMES[Math.floor(Math.random() * RIDER_NAMES.length)],
      progress: 0,
    },
  };

  orders = [order, ...orders];
  startStatusSimulator(order.id);
  return order;
}

function startStatusSimulator(orderId: string) {
  if (timers.has(orderId)) return;

  const interval = setInterval(() => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      clearInterval(interval);
      timers.delete(orderId);
      return;
    }

    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) {
      order.riderMock.progress = 1;
      clearInterval(interval);
      timers.delete(orderId);
      return;
    }

    const next = STATUS_FLOW[idx + 1];
    const at = new Date().toISOString();
    order.status = next;
    order.statusHistory = [...order.statusHistory, { status: next, at }];

    const progress = (idx + 1) / (STATUS_FLOW.length - 1);
    order.riderMock.progress = progress;

    if (next === 'DELIVERED') {
      clearInterval(interval);
      timers.delete(orderId);
    }
  }, 2800);

  timers.set(orderId, interval);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  await delay(80);
  const order = orders.find((o) => o.id === orderId);
  return order
    ? {
        ...order,
        riderMock: { ...order.riderMock },
        statusHistory: [...order.statusHistory],
        lines: [...order.lines],
      }
    : null;
}

export async function getOrders(): Promise<Order[]> {
  await delay(120);
  return orders.map((o) => ({
    ...o,
    riderMock: { ...o.riderMock },
    statusHistory: [...o.statusHistory],
    lines: [...o.lines],
  }));
}

export function getOrderStatusLabel(status: OrderStatus): string {
  return timelineStatusLabel(status);
}

/**
 * Seeds a prior delivered order for Restock demo (mock adapter only).
 * Does not invent SKU business rules — callers pass qty already normalized.
 */
export function seedMockDeliveredOrder(
  storeId: string,
  lines: Array<{ product: Product; qty: number }>,
): Order | null {
  if (orders.some((o) => o.storeId === storeId && o.status === 'DELIVERED')) {
    return null;
  }

  const store = getStoreById(storeId);
  if (!store || !lines.length) return null;

  const orderLines: OrderLine[] = lines.map(({ product, qty }) => ({
    productId: product.id,
    name: product.name,
    unit: product.unit,
    price: product.price,
    qty,
    imageEmoji: product.imageEmoji,
  }));

  const address: Address = presetAddresses[0];
  const createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const order: Order = {
    id: `GA-RESTOCK-SEED`,
    storeId: store.id,
    storeName: store.name,
    shopName: 'Demo Kirana',
    salesExecutive: 'Priya Sharma',
    deliverySchedule: 'Tomorrow · 10:00 – 13:00',
    notes: undefined,
    status: 'DELIVERED',
    statusHistory: buildCompletedStatusHistory(createdAt),
    lines: orderLines,
    totals: computeTotals(orderLines),
    address,
    createdAt,
    etaMinutes: store.etaMinutes,
    paymentMethod: 'Pay Online',
    paymentStatus: 'PAID',
    riderMock: { name: 'Aman', progress: 1 },
  };

  orders = [order, ...orders];
  return order;
}
