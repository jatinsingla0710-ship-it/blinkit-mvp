import type { EntityStatus } from '@/data/settings-types';
import { Badge } from '@/components/ui/Badge';

export function SettingsStatusBadge({ status }: { status: EntityStatus }) {
  if (status === 'active') {
    return <Badge tone="success">Active</Badge>;
  }
  return <Badge tone="neutral">Disabled</Badge>;
}
