import type { SalesVisitStatus } from '@groaurum/api-client';
import type { BadgeTone } from '@groaurum/ui';

/** Green = done, amber = pending / needs attention, red = blocked or overdue. */
export function visitTone(status: SalesVisitStatus): BadgeTone {
  switch (status) {
    case 'VISITED':
      return 'success';
    case 'MISSED':
      return 'danger';
    case 'SHOP_CLOSED':
      return 'warning';
    case 'PENDING':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function visitStatusLabel(status: SalesVisitStatus): string {
  switch (status) {
    case 'VISITED':
      return 'Visited';
    case 'MISSED':
      return 'Missed';
    case 'SHOP_CLOSED':
      return 'Shop Closed';
    case 'PENDING':
      return 'Pending';
    default:
      return 'Planned';
  }
}
