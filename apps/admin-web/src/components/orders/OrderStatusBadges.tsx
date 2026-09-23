import type {
  DeliveryStatusVm,
  PaymentStatusVm,
  WholesaleFulfillmentStatus,
} from '@/data/orders-types';
import { fulfillmentStatusLabel } from '@/data/order-helpers';
import { Badge } from '@/components/ui/Badge';

export function PaymentStatusBadge({ status }: { status: PaymentStatusVm }) {
  switch (status) {
    case 'PAID':
      return <Badge tone="success">Paid</Badge>;
    case 'REFUNDED':
      return <Badge tone="danger">Refunded</Badge>;
    case 'UNPAID':
      return <Badge tone="warning">Unpaid</Badge>;
    case 'PENDING':
      return <Badge tone="info">Pending</Badge>;
    case 'PARTIAL':
      return <Badge tone="warning">Partial</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function FulfillmentStatusBadge({
  status,
}: {
  status: WholesaleFulfillmentStatus;
}) {
  const label = fulfillmentStatusLabel(status);
  if (status === 'DELIVERED') return <Badge tone="success">{label}</Badge>;
  if (status === 'OUT_FOR_DELIVERY') return <Badge tone="info">{label}</Badge>;
  if (status === 'PACKING' || status === 'READY_FOR_DISPATCH') {
    return <Badge tone="warning">{label}</Badge>;
  }
  if (status === 'CANCELLED' || status === 'DELIVERY_FAILED') {
    return <Badge tone="danger">{label}</Badge>;
  }
  return <Badge tone="neutral">{label}</Badge>;
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatusVm }) {
  switch (status) {
    case 'delivered':
      return <Badge tone="success">Delivered</Badge>;
    case 'out_for_delivery':
      return <Badge tone="info">Out for Delivery</Badge>;
    case 'assigned':
      return <Badge tone="neutral">Assigned</Badge>;
    case 'failed':
      return <Badge tone="danger">Failed</Badge>;
    default:
      return <Badge tone="neutral">Not started</Badge>;
  }
}
