import type {
  RouteStatus,
  StopDeliveryStatus,
  VehicleStatus,
} from '@/data/delivery-types';
import { Badge } from '@/components/ui/Badge';

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  switch (status) {
    case 'planned':
      return <Badge tone="info">Planned</Badge>;
    case 'loading':
      return <Badge tone="warning">Loading</Badge>;
    case 'running':
      return <Badge tone="success">Running</Badge>;
    case 'completed':
      return <Badge tone="neutral">Completed</Badge>;
    case 'cancelled':
      return <Badge tone="danger">Cancelled</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function StopDeliveryStatusBadge({
  status,
}: {
  status: StopDeliveryStatus;
}) {
  switch (status) {
    case 'pending':
      return <Badge tone="neutral">Pending</Badge>;
    case 'in_progress':
      return <Badge tone="info">In Progress</Badge>;
    case 'out_for_delivery':
      return <Badge tone="info">Out for Delivery</Badge>;
    case 'delivered':
      return <Badge tone="success">Delivered</Badge>;
    case 'skipped':
      return <Badge tone="warning">Skipped</Badge>;
    case 'failed':
      return <Badge tone="danger">Failed</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  switch (status) {
    case 'available':
    case 'idle':
      return <Badge tone="neutral">Available</Badge>;
    case 'assigned':
    case 'loading':
      return <Badge tone="warning">Assigned</Badge>;
    case 'on_route':
    case 'running':
      return <Badge tone="success">On route</Badge>;
    case 'maintenance':
      return <Badge tone="danger">Maintenance</Badge>;
    case 'unavailable':
      return <Badge tone="danger">Unavailable</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
