import { Badge } from '@groaurum/ui';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={orderStatusTone(status)}>{orderStatusLabel(status)}</Badge>;
}
