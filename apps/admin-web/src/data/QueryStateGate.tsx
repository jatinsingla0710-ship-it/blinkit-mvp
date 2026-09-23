import type { ReactNode } from 'react';
import type { QueryState } from '@groaurum/data';
import { Card, EmptyState, PageHeader } from '@groaurum/ui';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

type Props<T> = {
  title: string;
  state: QueryState<T>;
  emptyTitle?: string;
  emptyDetail?: string;
  children: (data: T) => ReactNode;
};

/**
 * Shared Loading / Empty / Error / Success gate for repository-backed pages.
 * Loading uses a skeleton so the shell stays visible (no blank screen).
 */
export function QueryStateGate<T>({
  title,
  state,
  emptyTitle = 'No data',
  emptyDetail = 'Nothing to show for this view.',
  children,
}: Props<T>) {
  if (state.isLoading) {
    return <PageSkeleton title={title} />;
  }

  if (state.isError) {
    return (
      <div>
        <PageHeader title={title} subtitle="Error" />
        <Card>
          <EmptyState
            title="Unable to load"
            detail={state.error?.message ?? 'Unexpected data error'}
          />
        </Card>
      </div>
    );
  }

  if (state.isEmpty || state.data === null) {
    return (
      <div>
        <PageHeader title={title} subtitle="Empty" />
        <Card>
          <EmptyState title={emptyTitle} detail={emptyDetail} />
        </Card>
      </div>
    );
  }

  return <>{children(state.data)}</>;
}
