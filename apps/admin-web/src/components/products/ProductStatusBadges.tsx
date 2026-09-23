import type {
  InventoryReadinessStatus,
  ProductPublishStatus,
  ProductReadinessLabel,
} from '@/data/product-types';
import { Badge } from '@/components/ui/Badge';

export function PublishStatusBadge({ status }: { status: ProductPublishStatus }) {
  if (status === 'published') {
    return <Badge tone="success">Published</Badge>;
  }
  if (status === 'archived') {
    return <Badge tone="neutral">Archived</Badge>;
  }
  return <Badge tone="warning">Draft</Badge>;
}

export function InventoryStatusBadge({
  status,
}: {
  status: InventoryReadinessStatus;
}) {
  switch (status) {
    case 'in_stock':
      return <Badge tone="success">In stock</Badge>;
    case 'low_stock':
      return <Badge tone="warning">Low stock</Badge>;
    case 'out_of_stock':
      return <Badge tone="danger">Out of stock</Badge>;
    default:
      return <Badge tone="neutral">Not tracked</Badge>;
  }
}

export function ReadinessStatusBadge({
  label,
}: {
  label: ProductReadinessLabel;
}) {
  switch (label) {
    case 'Active':
      return <Badge tone="success">{label}</Badge>;
    case 'Ready to Publish':
      return <Badge tone="info">{label}</Badge>;
    case 'Missing SKU':
    case 'Missing Price':
      return <Badge tone="warning">{label}</Badge>;
    case 'Archived':
      return <Badge tone="neutral">{label}</Badge>;
    case 'Inactive':
      return <Badge tone="neutral">{label}</Badge>;
    default:
      return <Badge tone="warning">{label}</Badge>;
  }
}
