import { ExecutiveKpiCards } from '@/components/dashboard/ExecutiveKpiCards';
import { OperationsAtGlance } from '@/components/dashboard/OperationsAtGlance';
import { AttentionRequired } from '@/components/dashboard/AttentionRequired';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentBusinessActivity } from '@/components/dashboard/RecentBusinessActivity';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useDashboardSnapshotQuery } from '@/data/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import './DashboardPage.css';

/**
 * Admin Dashboard — live business control center (Supabase + React Query).
 */
export function DashboardPage() {
  const { state } = useDashboardSnapshotQuery();

  return (
    <QueryStateGate title="Dashboard" state={state}>
      {(snapshot) => (
        <div className="ga-dashboard">
          <PageHeader
            title="Dashboard"
            subtitle="Business control center · live operations"
            meta={snapshot.generatedAtLabel}
          />

          <ExecutiveKpiCards items={snapshot.executiveKpis} />

          <OperationsAtGlance metrics={snapshot.operations} />

          <div className="ga-dashboard__row ga-dashboard__row--split">
            <AttentionRequired alerts={snapshot.attentionAlerts} />
            <QuickActions actions={snapshot.quickActions} />
          </div>

          <RecentBusinessActivity items={snapshot.recentActivity} />
        </div>
      )}
    </QueryStateGate>
  );
}
