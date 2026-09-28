import type { SalesmanRetailer, SalesVisitStatus } from '@groaurum/api-client';
import type { BadgeTone } from '@groaurum/ui';

/** Green = done, amber = pending / needs attention, red = blocked or overdue. */
export function activationTone(
  status: SalesmanRetailer['activationStatus'],
): BadgeTone {
  switch (status) {
    case 'activated':
      return 'success';
    case 'app_link_sent':
      return 'warning';
    case 'access_disabled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function visitTone(status: SalesVisitStatus): BadgeTone {
  switch (status) {
    case 'VISITED':
      return 'success';
    case 'MISSED':
      return 'danger';
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
    case 'PENDING':
      return 'Pending';
    default:
      return 'Planned';
  }
}
