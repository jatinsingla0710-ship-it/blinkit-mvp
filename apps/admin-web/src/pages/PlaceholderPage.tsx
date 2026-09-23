import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

type Props = {
  title: string;
  description: string;
};

/** Placeholder route pages — navigation shell only for Admin Dashboard v1. */
export function PlaceholderPage({ title, description }: Props) {
  return (
    <div>
      <PageHeader title={title} subtitle={description} />
      <Card>
        <EmptyState
          title={`${title} module`}
          detail="UI shell ready. Business workflows will be implemented in a later phase."
        />
      </Card>
    </div>
  );
}
