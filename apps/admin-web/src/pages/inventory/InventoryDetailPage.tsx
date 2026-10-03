import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { usePermissions } from '@groaurum/auth/react';
import { AdjustmentsTable } from '@/components/inventory/AdjustmentsTable';
import { InventoryAdjustForm } from '@/components/inventory/InventoryAdjustForm';
import {
  InventoryQuickActions,
  type InventoryQuickActionId,
} from '@/components/inventory/InventoryQuickActions';
import { InventoryOverviewTab } from '@/components/inventory/InventoryOverviewTab';
import { InventoryStatusBadge } from '@/components/inventory/InventoryStatusBadge';
import { MovementHistoryTimeline } from '@/components/inventory/MovementHistoryTimeline';
import { ReservationsTable } from '@/components/inventory/ReservationsTable';
import { Card } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QueryStateGate } from '@/data/QueryStateGate';
import { inventoryDetailPath } from '@/data/inventory-detail-key';
import { useInventoryDetailQuery } from '@/data/hooks';
import './InventoryDetailPage.css';

type InventoryTab = 'overview' | 'adjust' | 'movements' | 'reservations';

const TABS: TabItem<InventoryTab>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'adjust', label: 'Adjust Stock' },
  { id: 'movements', label: 'Activity' },
  { id: 'reservations', label: 'Reservations' },
];

/**
 * Inventory Management — warehouse-scoped stock detail for a SKU.
 */
export function InventoryDetailPage() {
  const { skuId } = useParams<{ skuId: string }>();
  const [searchParams] = useSearchParams();
  const balanceId = searchParams.get('balance');
  const navigate = useNavigate();
  const [tab, setTab] = useState<InventoryTab>('overview');
  const { state } = useInventoryDetailQuery(skuId, balanceId);
  const { hasPermission } = usePermissions();
  const canManageInventory = hasPermission('inventory:manage');

  const selectWarehouse = (nextBalanceId: string) => {
    if (!skuId) return;
    navigate(inventoryDetailPath(skuId, nextBalanceId), { replace: true });
  };

  const onAction = (id: InventoryQuickActionId) => {
    if (id === 'receive_stock') {
      navigate('/purchases');
      return;
    }
    if (id === 'view_ledger') {
      setTab('movements');
      return;
    }
    if (id === 'adjust_stock') {
      if (!canManageInventory) return;
      setTab('adjust');
    }
  };

  return (
    <QueryStateGate
      title="Inventory"
      state={state}
      emptyTitle="SKU position not found"
      emptyDetail="Return to Inventory and select a stock row."
    >
      {(detail) => (
        <div className="ga-inv-detail">
          <Link to="/inventory" className="ga-inv-detail__back">
            ← Inventory
          </Link>

          <header className="ga-inv-detail__hero">
            <div className="ga-inv-detail__thumb" aria-hidden>
              {detail.imageUrl ? (
                <img src={detail.imageUrl} alt="" />
              ) : (
                <span>{detail.productName.slice(0, 1)}</span>
              )}
            </div>
            <div className="ga-inv-detail__hero-main">
              <h1>{detail.productName}</h1>
              <p className="ga-inv-detail__hero-meta">
                <span className="ga-table__mono">{detail.skuCode}</span>
                <span>·</span>
                <span>{detail.categoryName}</span>
                <span>·</span>
                <span>{detail.skuName}</span>
              </p>
              <div className="ga-inv-detail__hero-badges">
                <InventoryStatusBadge status={detail.overallStatus} />
                <span className="ga-inv-detail__hero-stock">
                  {detail.totalMixedStockLabel}
                </span>
              </div>
            </div>
            <div className="ga-inv-detail__hero-actions">
              <InventoryQuickActions
                onAction={onAction}
                canManage={canManageInventory}
              />
            </div>
          </header>

          <Card className="ga-inv-detail__main">
            <Tabs items={TABS} active={tab} onChange={setTab} />
            <div className="ga-inv-detail__panel">
              {tab === 'overview' ? (
                <InventoryOverviewTab
                  detail={detail}
                  onSelectWarehouse={selectWarehouse}
                />
              ) : null}
              {tab === 'adjust' ? (
                <div>
                  <InventoryAdjustForm
                    detail={detail}
                    canManage={canManageInventory}
                    onWarehouseChange={selectWarehouse}
                  />
                  <AdjustmentsTable rows={detail.adjustments} />
                </div>
              ) : null}
              {tab === 'movements' ? (
                <MovementHistoryTimeline rows={detail.movements} />
              ) : null}
              {tab === 'reservations' ? (
                <ReservationsTable rows={detail.reservations} />
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </QueryStateGate>
  );
}
