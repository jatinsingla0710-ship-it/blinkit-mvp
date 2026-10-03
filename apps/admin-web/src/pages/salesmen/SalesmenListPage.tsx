import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import {
  EMPTY_SALESMAN_BROWSE,
  browseSalesmen,
} from '@/data/browse-helpers';
import type { SalesmanBrowseState } from '@/data/salesmen-types';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { SalesmenBrowseBar } from '@/components/salesmen/SalesmenBrowseBar';
import { SalesmenQuickActions } from '@/components/salesmen/SalesmenQuickActions';
import { SalesmanOrderFormModal } from '@/components/salesmen/SalesmanOrderFormModal';
import { SalesmanProvisionModal } from '@/components/salesmen/SalesmanProvisionModal';
import { CustomerFormModal } from '@/components/customers/CustomerFormModal';
import { SalesmenTable } from '@/components/salesmen/SalesmenTable';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useSalesmenSnapshotQuery } from '@/data/hooks';
import { TEAM_SECTION_LINKS } from '@/data/section-links';
import './SalesmenListPage.css';

/**
 * Sales Team — field salesmen, performance, and commission rules.
 */
export function SalesmenListPage() {
  const { state } = useSalesmenSnapshotQuery();
  const [browse, setBrowse] = useState<SalesmanBrowseState>(EMPTY_SALESMAN_BROWSE);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManageCustomers = hasPermission('customers:manage');
  const canManageOrders = hasPermission('orders:manage');
  const canManageSalesmen = hasPermission('salesmen:manage');

  const result = useMemo(() => {
    if (!state.data) {
      return { rows: [], pageCount: 1, total: 0 };
    }
    return browseSalesmen(state.data.rows, browse);
  }, [state.data, browse]);

  return (
    <QueryStateGate title="Salesmen" state={state}>
      {(snapshot) => {
        const field = snapshot.fieldToday;
        const visits = snapshot.visitCoverage;
        const pendingClaims =
          field.pendingExpenseClaims + field.pendingReturnClaims;

        return (
          <div className="ga-sm-list">
            <PageHeader
              title="Salesmen"
              subtitle="Field team coverage, visits, earnings, and claims"
              meta={snapshot.generatedAtLabel}
            />

            <SectionRelatedLinks
              label="Team section"
              links={[...TEAM_SECTION_LINKS]}
            />

            <KpiCards items={snapshot.kpis} />

            <div className="ga-sm-list__field" aria-label="Today in the field">
              <Card title={`Today · ${field.workDate}`}>
                <div className="ga-sm-list__field-grid">
                  <div>
                    <p className="ga-sm-list__field-label">Started day</p>
                    <p className="ga-sm-list__field-value">{field.startedCount}</p>
                  </div>
                  <div>
                    <p className="ga-sm-list__field-label">Not started</p>
                    <p className="ga-sm-list__field-value">{field.notStartedCount}</p>
                  </div>
                  <div>
                    <p className="ga-sm-list__field-label">Absent / leave</p>
                    <p className="ga-sm-list__field-value">
                      {field.absentCount + field.onLeaveCount}
                    </p>
                  </div>
                  <div>
                    <p className="ga-sm-list__field-label">Visits</p>
                    <p className="ga-sm-list__field-value">
                      {visits.completed}/{visits.total}
                    </p>
                    <p className="ga-sm-list__field-hint">
                      {visits.planned} open · {visits.missed} missed
                    </p>
                  </div>
                  <div>
                    <p className="ga-sm-list__field-label">Pending claims</p>
                    <p className="ga-sm-list__field-value">{pendingClaims}</p>
                    <Link to="/salesmen/claims" className="ga-sm-list__field-link">
                      Review inbox →
                    </Link>
                  </div>
                </div>
              </Card>
            </div>

            <Card title="Quick Actions">
              <SalesmenQuickActions
                canManageCustomers={canManageCustomers}
                canManageOrders={canManageOrders}
                canManageSalesmen={canManageSalesmen}
                onAction={(id) => {
                  if (id === 'provision_salesman' && canManageSalesmen) {
                    setProvisionOpen(true);
                    return;
                  }
                  if (id === 'add_customer' && canManageCustomers) {
                    setCreateCustomerOpen(true);
                    return;
                  }
                  if (id === 'create_order' && canManageOrders) {
                    setCreateOrderOpen(true);
                    return;
                  }
                  if (id === 'view_territory') {
                    navigate('/service-areas');
                  }
                }}
              />
            </Card>

            <SalesmenBrowseBar state={browse} onChange={setBrowse} />

            <SalesmenTable
              rows={result.rows}
              page={Math.min(browse.page, result.pageCount)}
              pageCount={result.pageCount}
              total={result.total}
              onPageChange={(page) => setBrowse((s) => ({ ...s, page }))}
            />

            {canManageSalesmen ? (
              <SalesmanProvisionModal
                open={provisionOpen}
                onClose={() => setProvisionOpen(false)}
                onSuccess={(profileId) => navigate(`/salesmen/${profileId}`)}
              />
            ) : null}
            {canManageCustomers ? (
              <CustomerFormModal
                open={createCustomerOpen}
                onClose={() => setCreateCustomerOpen(false)}
                onSuccess={(customerId) => navigate(`/customers/${customerId}`)}
              />
            ) : null}
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
