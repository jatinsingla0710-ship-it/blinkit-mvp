import type { OrderTotals } from '@/types';

/** Pure cart totals — used by both mock and live adapters. */
export function computeOrderTotals(
  lines: { price: number; qty: number }[],
): OrderTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const deliveryFee = subtotal >= 499 ? 0 : 39;
  const handlingFee = subtotal > 0 ? 9 : 0;
  return {
    subtotal,
    deliveryFee,
    handlingFee,
    total: subtotal + deliveryFee + handlingFee,
  };
}
