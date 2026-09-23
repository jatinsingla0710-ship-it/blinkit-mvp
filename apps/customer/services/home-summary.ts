import type {
  HomeLastOrderSummary,
  HomeServiceSummary,
  Product,
  TradePriceMovement,
} from '@/types';
import { getOrderStatusLabel, getOrders } from '@/services/mock/orders';
import { fetchCustomerOrders } from '@/services/customer-orders';
import { isMockAdapterMode } from '@/config/env';

/** Demo last order for mock home when the retailer has not placed an order yet. */
const MOCK_LAST_ORDER: HomeLastOrderSummary = {
  id: 'demo-last',
  fulfillmentLabel: 'Delivered',
  paymentStatus: 'PAID',
  total: 24850,
};

export function buildTradePriceMovements(products: Product[]): TradePriceMovement[] {
  return products.slice(0, 6).map((product) => {
    const changeAmount = Number((product.price - product.mrp).toFixed(0));
    const baseline = product.mrp || product.price;
    const changePercent =
      baseline === 0 ? 0 : Number(((changeAmount / baseline) * 100).toFixed(1));
    return {
      id: product.id,
      name: product.name,
      unit: product.unit,
      tradePrice: product.price,
      changeAmount,
      changePercent,
    };
  });
}

export function getHomeServiceSummary(): HomeServiceSummary {
  return {
    nextDeliveryLabel: 'Tomorrow',
    timeSlot: '10:00 – 13:00',
  };
}

/** Promotions remain a placeholder strip until marketing tables ship. */
export function getHomePromotionsPlaceholder(): { id: string; title: string }[] {
  return [{ id: 'promo-placeholder', title: 'Promotions · coming soon' }];
}

export async function getHomeLastOrderSummary(
  shopId?: string | null,
): Promise<HomeLastOrderSummary | null> {
  if (!isMockAdapterMode()) {
    if (!shopId) return null;
    const orders = await fetchCustomerOrders(shopId);
    const latest = orders[0];
    if (!latest) return null;
    return {
      id: latest.id,
      fulfillmentLabel: getOrderStatusLabel(latest.status),
      paymentStatus: latest.paymentStatus,
      total: latest.totals.total,
    };
  }

  const orders = await getOrders();
  const latest = orders[0];
  if (!latest) {
    return MOCK_LAST_ORDER;
  }

  return {
    id: latest.id,
    fulfillmentLabel: getOrderStatusLabel(latest.status),
    paymentStatus: latest.paymentStatus,
    total: latest.totals.total,
  };
}
