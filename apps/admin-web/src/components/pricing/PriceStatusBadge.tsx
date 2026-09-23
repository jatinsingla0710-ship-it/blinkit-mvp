import type { PriceRecordStatus } from '@/data/pricing-types';
import { Badge } from '@/components/ui/Badge';

export function PriceStatusBadge({ status }: { status: PriceRecordStatus }) {
  switch (status) {
    case 'live':
      return <Badge tone="success">Live</Badge>;
    case 'expired':
      return <Badge tone="neutral">Expired</Badge>;
    case 'unpriced':
      return <Badge tone="warning">Unpriced</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
