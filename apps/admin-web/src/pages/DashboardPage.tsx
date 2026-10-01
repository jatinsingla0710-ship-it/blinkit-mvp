import { ExecutiveKpiCards } from '@/components/dashboard/ExecutiveKpiCards';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { OperationsAtGlance } from '@/components/dashboard/OperationsAtGlance';
import { AttentionRequired } from '@/components/dashboard/AttentionRequired';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentBusinessActivity } from '@/components/dashboard/RecentBusinessActivity';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  useDashboardSnapshotQuery,
  useOwnerFinancialOverviewQuery,
} from '@/data/hooks';
import { executiveOpsKpisWithoutDuplicateSales } from '@/data/financial-reports';
import { PageHeader } from '@/components/ui/PageHeader';
import { Link } from 'react-router-dom';
import './DashboardPage.css';

/**
 * Admin Dashboard — owner control center.
 * Hierarchy: Money → Needs attention → Operations → Quick actions.
 */
export function DashboardPage() {
  const { state } = useDashboardSnapshotQuery();
  const financial = useOwnerFinancialOverviewQuery();

  return (
    <QueryStateGate title="Dashboard" state={state}>
      {(snapshot) => {
        const opsKpis = executiveOpsKpisWithoutDuplicateSales(
          snapshot.executiveKpis,
        );

        return (
          <div className="ga-dashboard">
            <PageHeader
              title="Dashboard"
              subtitle="How the business is doing today"
              meta={snapshot.generatedAtLabel}
            />

            {financial.data ? (
              <section aria-label="Business money snapshot">
                <div className="ga-dashboard__section-head">
                  <h2 className="ga-dashboard__section-title">Money</h2>
                  <Link to="/reports" className="ga-dashboard__section-link">
                    Reports →
                  </Link>
                </div>
                <KpiCards items={financial.data.kpis} />
              </section>
            ) : financial.isError ? (
              <p className="ga-dashboard__financial-error">
                Could not load financial overview. Operations below still work.
              </p>
            ) : null}

            <section aria-label="Needs attention">
              <AttentionRequired alerts={snapshot.attentionAlerts} />
            </section>

            <section aria-label="Operational status">
              <div className="ga-dashboard__section-head">
                <h2 className="ga-dashboard__section-title">Operations</h2>
              </div>
              <ExecutiveKpiCards items={opsKpis} />
              <OperationsAtGlance metrics={snapshot.operations} />
            </section>

            <section aria-label="Quick actions">
              <QuickActions actions={snapshot.quickActions} />
            </section>

            <RecentBusinessActivity items={snapshot.recentActivity} />
          </div>
        );
      }}
    </QueryStateGate>
  );
}
