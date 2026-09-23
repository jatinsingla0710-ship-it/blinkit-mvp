import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { SalesmanReassignModal } from '@/components/customers/SalesmanReassignModal';
import { SalesmanAttendanceTab } from '@/components/salesmen/SalesmanAttendanceTab';
import { SalesmanOrdersTab } from '@/components/salesmen/SalesmanOrdersTab';
import { SalesmanOverviewTab } from '@/components/salesmen/SalesmanOverviewTab';
import { SalesmanPerformanceTab } from '@/components/salesmen/SalesmanPerformanceTab';
import { SalesmanSalaryTab } from '@/components/salesmen/SalesmanSalaryTab';
import {
  SalesmenQuickActions,
  type SalesmenQuickActionId,
} from '@/components/salesmen/SalesmenQuickActions';
import { SalesmanStatusBadge } from '@/components/salesmen/SalesmanStatusBadges';
import { SalesmanVisitsTab } from '@/components/salesmen/SalesmanVisitsTab';
import { SalesmanWorkTab } from '@/components/salesmen/SalesmanWorkTab';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useSalesmanDetailQuery } from '@/data/hooks';
import './SalesmanDetailPage.css';

type SalesmanTab =
  | 'profile'
  | 'work'
  | 'attendance'
  | 'visits'
  | 'orders'
  | 'salary'
  | 'performance';

const TABS: TabItem<SalesmanTab>[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'work', label: 'Work' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'visits', label: 'Visits' },
  { id: 'orders', label: 'Orders' },
  { id: 'salary', label: 'Salary' },
  { id: 'performance', label: 'Performance' },
];

/**
 * Salesman Management — field salesman detail (H2–H4).
 */
export function SalesmanDetailPage() {
  const { salesmanId } = useParams<{ salesmanId: string }>();
  const [tab, setTab] = useState<SalesmanTab>('profile');
  const [reassignShopId, setReassignShopId] = useState<string | null>(null);
  const { state } = useSalesmanDetailQuery(salesmanId);
  const { hasPermission } = usePermissions();
  const canManageCustomers = hasPermission('customers:manage');
  const canManageOrders = hasPermission('orders:manage');
  const canManageSalesmen = hasPermission('salesmen:manage');

  const onAction = (id: SalesmenQuickActionId) => {
    if (id === 'add_customer' || id === 'view_territory') {
      setTab('work');
      return;
    }
    if (id === 'create_order') {
      if (!canManageOrders) return;
      setTab('orders');
      return;
    }
    if (id === 'send_invitation') {
      if (!canManageCustomers) return;
      setTab('work');
      return;
    }
  };

  return (
    <QueryStateGate
      title="Salesman"
      state={state}
      emptyTitle="Salesman not found"
      emptyDetail="Return to Salesmen and select a team member."
    >
      {(salesman) => (
        <div className="ga-sm-detail">
          <PageHeader
            title={salesman.name}
            subtitle={`${salesman.employeeId} · ${salesman.territory}`}
            meta={
              <span className="ga-sm-detail__meta">
                <SalesmanStatusBadge status={salesman.status} />
                <span>Updated {salesman.updatedAtLabel}</span>
              </span>
            }
          />

          <div className="ga-sm-detail__toolbar">
            <Link to="/salesmen" className="ga-sm-detail__back">
              ← Salesmen
            </Link>
            <SalesmenQuickActions
              canManageCustomers={canManageCustomers}
              canManageOrders={canManageOrders}
              canManageSalesmen={canManageSalesmen}
              onAction={onAction}
            />
          </div>

          <Card className="ga-sm-detail__main">
            <Tabs items={TABS} active={tab} onChange={setTab} />
            <div className="ga-sm-detail__panel">
              {tab === 'profile' ? (
                <SalesmanOverviewTab salesman={salesman} />
              ) : null}
              {tab === 'work' ? (
                <SalesmanWorkTab
                  salesman={salesman}
                  onCreateOrder={() => setTab('orders')}
                  onReassign={(customerId) => {
                    if (!canManageCustomers) return;
                    setReassignShopId(customerId);
                  }}
                />
              ) : null}
              {tab === 'attendance' ? (
                <SalesmanAttendanceTab
                  profileId={salesman.id}
                  rows={salesman.attendance}
                  canManage={canManageSalesmen}
                />
              ) : null}
              {tab === 'visits' ? (
                <SalesmanVisitsTab
                  salesmanProfileId={salesman.id}
                  visits={salesman.visits}
                  assignedCustomers={salesman.assignedCustomers}
                  visitsSource={salesman.visitsSource}
                  canCreate={canManageCustomers || canManageSalesmen}
                  canUpdateStatus={canManageCustomers || canManageSalesmen}
                />
              ) : null}
              {tab === 'orders' ? (
                <>
                  <SalesmanOrdersTab rows={salesman.orders} />
                  <p className="ga-sm-detail__footnote">
                    Collection totals and history are under Performance.
                  </p>
                </>
              ) : null}
              {tab === 'salary' ? (
                <SalesmanSalaryTab
                  profileId={salesman.id}
                  earningModel={salesman.employment?.earningModel ?? 'SALARY'}
                  salaryMonth={salesman.salaryMonth}
                  currentSalary={salesman.currentSalary}
                  salaryHistory={salesman.salaryHistory}
                  canManage={canManageSalesmen}
                />
              ) : null}
              {tab === 'performance' ? (
                <SalesmanPerformanceTab
                  performance={salesman.performance}
                  collections={salesman.collections}
                  collectionHistory={salesman.collectionHistory}
                />
              ) : null}
            </div>
          </Card>

          {reassignShopId && canManageCustomers ? (
            <SalesmanReassignModal
              open
              customerId={reassignShopId}
              currentSalesmanProfileId={salesman.id}
              onClose={() => setReassignShopId(null)}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
