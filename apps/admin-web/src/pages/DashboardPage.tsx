import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { ExecutiveKpiCards } from '@/components/dashboard/ExecutiveKpiCards';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { OperationsAtGlance } from '@/components/dashboard/OperationsAtGlance';
import { AttentionRequired } from '@/components/dashboard/AttentionRequired';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentBusinessActivity } from '@/components/dashboard/RecentBusinessActivity';
import { SalesmanOrderFormModal } from '@/components/salesmen/SalesmanOrderFormModal';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  useDashboardSnapshotQuery,
  useDailyBusinessBriefSnapshotQuery,
  useOwnerFinancialOverviewQuery,
} from '@/data/hooks';
import { executiveOpsKpisWithoutDuplicateSales } from '@/data/financial-reports';
import { PageHeader } from '@/components/ui/PageHeader';
import './DashboardPage.css';

/**
 * Admin Dashboard — owner control center (Phase 23).
 * Hierarchy: Brief → Money → Needs attention → Operations → Quick actions.
 */
export function DashboardPage() {
  const { state } = useDashboardSnapshotQuery();
  const financial = useOwnerFinancialOverviewQuery();
  const brief = useDailyBusinessBriefSnapshotQuery();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const canManageOrders = hasPermission('orders:manage');
  const canManageMoney = hasPermission('payments:manage');

  return (
    <QueryStateGate title="Dashboard" state={state}>
      {(snapshot) => {
        const opsKpis = executiveOpsKpisWithoutDuplicateSales(
          snapshot.executiveKpis,
        );
        const attentionAlerts = [
          ...(financial.data?.customersWithMoneyDue
            ? [
                {
                  id: 'customer_money_due',
                  title: 'Customers with money due',
                  count: financial.data.customersWithMoneyDue,
                  severity: 'medium' as const,
                  href: '/receivables',
                },
              ]
            : []),
          ...(financial.data?.suppliersWithMoneyToPay
            ? [
                {
                  id: 'supplier_money_to_pay',
                  title: 'Suppliers to pay',
                  count: financial.data.suppliersWithMoneyToPay,
                  severity: 'medium' as const,
                  href: '/payables',
                },
              ]
            : []),
          ...snapshot.attentionAlerts.filter(
            (alert) => alert.id !== 'pending_payments',
          ),
        ];
        const quickActions = snapshot.quickActions.filter((action) => {
          if (action.id === 'new_sale') return canManageOrders;
          if (action.id === 'ask_ai') return true;
          return canManageMoney;
        });

        return (
          <div className="ga-dashboard">
            <PageHeader
              title="Owner control center"
              subtitle="Money, attention, operations, and quick actions — including Scan Bill and Ask AI"
              meta={snapshot.generatedAtLabel}
            />

            {brief.data ? (
              <section
                className="ga-dashboard__brief"
                aria-label="Today's brief"
              >
                <div className="ga-dashboard__section-head">
                  <h2 className="ga-dashboard__section-title">
                    {brief.data.greeting}
                  </h2>
                  <div className="ga-dashboard__section-links">
                    <Link to="/brief" className="ga-dashboard__section-link">
                      Full brief →
                    </Link>
                    <Link to="/ask" className="ga-dashboard__section-link">
                      Ask AI →
                    </Link>
                  </div>
                </div>
                {brief.data.yesterday ? (
                  <p className="ga-dashboard__brief-line">
                    Yesterday · Sales {brief.data.yesterday.salesTotalLabel} ·
                    Collected {brief.data.yesterday.collectionsTotalLabel} ·
                    Gross profit {brief.data.yesterday.grossProfitLabel}
                  </p>
                ) : null}
                {brief.data.attention[0] ? (
                  <p className="ga-dashboard__brief-line">
                    Attention · {brief.data.attention[0].count}{' '}
                    {brief.data.attention[0].title.toLowerCase()}
                    {brief.data.attention.length > 1
                      ? ` · +${brief.data.attention.length - 1} more`
                      : ''}
                  </p>
                ) : null}
                {brief.data.recommendations[0] ? (
                  <p className="ga-dashboard__brief-line">
                    Next · {brief.data.recommendations[0].title}
                  </p>
                ) : null}
              </section>
            ) : brief.isError ? null : (
              <p className="ga-dashboard__financial-error" aria-live="polite">
                Loading today’s brief…
              </p>
            )}

            <section aria-label="Business money snapshot">
              <div className="ga-dashboard__section-head">
                <h2 className="ga-dashboard__section-title">Money</h2>
                <Link to="/reports" className="ga-dashboard__section-link">
                  Reports →
                </Link>
              </div>
              {financial.data ? (
                <KpiCards items={financial.data.kpis} />
              ) : (
                <p
                  className="ga-dashboard__financial-error"
                  aria-live="polite"
                >
                  {financial.isError
                    ? 'Could not load the money overview. Operations below still work.'
                    : 'Loading money overview…'}
                </p>
              )}
            </section>

            <section aria-label="Needs attention">
              <AttentionRequired alerts={attentionAlerts} />
            </section>

            <section aria-label="Operational status">
              <div className="ga-dashboard__section-head">
                <h2 className="ga-dashboard__section-title">Operations</h2>
              </div>
              <ExecutiveKpiCards items={opsKpis} />
              <OperationsAtGlance metrics={snapshot.operations} />
            </section>

            <section aria-label="Quick actions">
              <QuickActions
                actions={quickActions}
                onAction={(action) => {
                  if (action.id === 'new_sale') setCreateOrderOpen(true);
                }}
              />
            </section>

            <RecentBusinessActivity items={snapshot.recentActivity} />

            {canManageOrders ? (
              <SalesmanOrderFormModal
                open={createOrderOpen}
                onClose={() => setCreateOrderOpen(false)}
                onSuccess={(orderId) => navigate(`/orders/${orderId}`)}
              />
            ) : null}
          </div>
        );
      }}
    </QueryStateGate>
  );
}
