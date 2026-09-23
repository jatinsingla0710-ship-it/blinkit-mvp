import type { VisitStatus } from '@/data/salesmen-types';
import { isInMonth, startOfMonth } from '@/data/dashboard-helpers';

/** Count orders whose created_at falls in the calendar month of `now`. */
export function countOrdersInCalendarMonth(
  orders: ReadonlyArray<{ created_at?: string | null }>,
  now: Date = new Date(),
): number {
  const monthStart = startOfMonth(now);
  let count = 0;
  for (const order of orders) {
    const iso = order.created_at ?? '';
    if (!iso) continue;
    if (isInMonth(iso, monthStart)) count += 1;
  }
  return count;
}

/** Sum order totals in the current calendar month. */
export function sumOrderRevenueInCalendarMonth(
  orders: ReadonlyArray<{ created_at?: string | null; total?: number | null }>,
  now: Date = new Date(),
): number {
  const monthStart = startOfMonth(now);
  let sum = 0;
  for (const order of orders) {
    const iso = order.created_at ?? '';
    if (!iso || !isInMonth(iso, monthStart)) continue;
    sum += Number(order.total) || 0;
  }
  return sum;
}

/** Group order counts by salesman for the current calendar month only. */
export function countOrdersThisMonthBySalesman(
  orders: ReadonlyArray<{
    created_by_profile_id?: string | null;
    created_at?: string | null;
  }>,
  now: Date = new Date(),
): Map<string, number> {
  const monthStart = startOfMonth(now);
  const map = new Map<string, number>();
  for (const order of orders) {
    const salesmanId = (order.created_by_profile_id ?? '').trim();
    const iso = order.created_at ?? '';
    if (!salesmanId || !iso) continue;
    if (!isInMonth(iso, monthStart)) continue;
    map.set(salesmanId, (map.get(salesmanId) ?? 0) + 1);
  }
  return map;
}

/** Latest order ISO per shop_id (honest last-order for assigned customers). */
export function latestOrderAtByShop(
  orders: ReadonlyArray<{
    shop_id?: string | null;
    created_at?: string | null;
  }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const order of orders) {
    const shopId = (order.shop_id ?? '').trim();
    const iso = (order.created_at ?? '').trim();
    if (!shopId || !iso) continue;
    const prev = map.get(shopId);
    if (!prev || iso > prev) map.set(shopId, iso);
  }
  return map;
}

/**
 * Latest visit activity ISO per shop for a salesman.
 * Prefers visited_at when present, else planned_at.
 */
export function latestVisitAtByShop(
  visits: ReadonlyArray<{
    shop_id?: string | null;
    planned_at?: string | null;
    visited_at?: string | null;
  }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const visit of visits) {
    const shopId = (visit.shop_id ?? '').trim();
    const iso = (visit.visited_at ?? visit.planned_at ?? '').trim();
    if (!shopId || !iso) continue;
    const prev = map.get(shopId);
    if (!prev || iso > prev) map.set(shopId, iso);
  }
  return map;
}

/** Map DB sales_visit_status → admin VisitStatus. */
export function mapSalesVisitStatus(dbStatus: string): VisitStatus {
  switch (dbStatus.toUpperCase()) {
    case 'VISITED':
      return 'completed';
    case 'MISSED':
      return 'missed';
    case 'PLANNED':
    case 'PENDING':
    default:
      return 'planned';
  }
}

/** Map admin VisitStatus action → DB enum for admin_update_sales_visit_status. */
export function mapVisitStatusToDb(
  status: 'completed' | 'missed',
): 'VISITED' | 'MISSED' {
  return status === 'completed' ? 'VISITED' : 'MISSED';
}

/** Honest empty-state copy when sales_visits has no rows. */
export const SALESMAN_VISITS_EMPTY_DETAIL =
  'No rows in sales_visits for this salesman. Admin can create a PLANNED visit for an assigned shop; mark completed/missed here or in the Sales PWA.';
