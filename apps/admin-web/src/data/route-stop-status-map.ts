import type { StopDeliveryStatus } from '@/data/delivery-types';

export type MappedRouteStopStatus = {
  deliveryStatus: StopDeliveryStatus;
  deliveryStatusLabel: string;
};

/**
 * Map public.route_stops.status (route_stop_status) → Admin Delivery UI stop status.
 * DB enum: PENDING | IN_PROGRESS | COMPLETED | FAILED | SKIPPED
 *
 * COMPLETED → delivered (Admin badge / performance counts).
 * IN_PROGRESS → in_progress (stop actively being delivered).
 */
export function mapDbRouteStopStatusToUi(
  raw: unknown,
): MappedRouteStopStatus {
  const normalized = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  switch (normalized) {
    case 'PENDING':
      return { deliveryStatus: 'pending', deliveryStatusLabel: 'Pending' };
    case 'IN_PROGRESS':
      return {
        deliveryStatus: 'in_progress',
        deliveryStatusLabel: 'In Progress',
      };
    case 'COMPLETED':
      return { deliveryStatus: 'delivered', deliveryStatusLabel: 'Delivered' };
    case 'FAILED':
      return { deliveryStatus: 'failed', deliveryStatusLabel: 'Failed' };
    case 'SKIPPED':
      return { deliveryStatus: 'skipped', deliveryStatusLabel: 'Skipped' };
    default:
      return { deliveryStatus: 'pending', deliveryStatusLabel: 'Pending' };
  }
}
