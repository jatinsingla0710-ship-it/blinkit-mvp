import type { InventoryHealthStatus } from '@/data/inventory-types';
import { Badge } from '@/components/ui/Badge';

export function InventoryStatusBadge({
  status,
}: {
  status: InventoryHealthStatus;
}) {
  switch (status) {
    case 'healthy':
      return <Badge tone="success">Healthy</Badge>;
    case 'low':
      return <Badge tone="warning">Low Stock</Badge>;
    case 'out_of_stock':
      return <Badge tone="danger">Out of Stock</Badge>;
    case 'incoming':
      return <Badge tone="info">Incoming</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
