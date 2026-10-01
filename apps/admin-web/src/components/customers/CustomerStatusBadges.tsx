import type {
  PaymentStatusVm,
  PreferredPaymentVm,
} from '@/data/customers-types';
import { Badge } from '@/components/ui/Badge';

export function CustomerStatusBadge({
  status,
}: {
  status: 'active' | 'inactive';
}) {
  switch (status) {
    case 'active':
      return <Badge tone="success">Active</Badge>;
    case 'inactive':
      return <Badge tone="neutral">Inactive</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function PreferredPaymentBadge({
  payment,
}: {
  payment: PreferredPaymentVm;
}) {
  if (payment === 'not_set') {
    return <Badge tone="neutral">Not set</Badge>;
  }
  return <Badge tone="neutral">{payment}</Badge>;
}

export function CustomerPaymentStatusBadge({
  status,
}: {
  status: PaymentStatusVm;
}) {
  switch (status) {
    case 'PAID':
      return <Badge tone="success">Paid</Badge>;
    case 'UNPAID':
      return <Badge tone="warning">Unpaid</Badge>;
    case 'PENDING':
      return <Badge tone="info">Pending</Badge>;
    case 'PARTIAL':
      return <Badge tone="warning">Partial</Badge>;
    case 'REFUNDED':
      return <Badge tone="neutral">Refunded</Badge>;
    case 'UNKNOWN':
      return <Badge tone="neutral">-</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
