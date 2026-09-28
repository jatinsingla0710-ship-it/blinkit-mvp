import type { ReactNode } from 'react';
import { Card, EmptyState } from '@groaurum/ui';

type Props = {
  title: string;
  detail?: string;
  /** Next step for the salesman, so an empty screen is never a dead end. */
  action?: ReactNode;
};

export function EmptyStateCard({ title, detail, action }: Props) {
  return (
    <Card>
      <EmptyState title={title} detail={detail} />
      {action ? <div className="ga-sales-empty-action">{action}</div> : null}
    </Card>
  );
}
