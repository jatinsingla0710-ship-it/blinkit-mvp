import { useMemo, useState } from 'react';
import { Button } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import {
  useCodCustodyCollectionsQuery,
  useManagerCodCustodyBreakdownQuery,
} from '@/data/hooks';
import {
  useConfirmOwnerCodReceiptSelectedMutation,
  useSettleDeliveryCodSelectedMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { groupCodCustodyByPerson } from '@/data/live/deliveryH5Api';
import { formatInr } from '@/data/live/format';
import type { CodCustodyCollectionRow } from '@/data/delivery-types';

type SettleStage = 'with_driver' | 'with_manager' | 'owner';

const STAGE_TABS: TabItem<SettleStage>[] = [
  { id: 'with_driver', label: 'With Delivery Boys' },
  { id: 'with_manager', label: 'With Managers' },
  { id: 'owner', label: 'Received by Owner' },
];

function statusForStage(
  stage: SettleStage,
): 'WITH_DRIVER' | 'RECEIVED_BY_MANAGER' | 'RECEIVED_BY_OWNER' {
  if (stage === 'with_driver') return 'WITH_DRIVER';
  if (stage === 'with_manager') return 'RECEIVED_BY_MANAGER';
  return 'RECEIVED_BY_OWNER';
}

export function selectedCollectionsTotal(
  rows: CodCustodyCollectionRow[],
  selectedIds: ReadonlySet<string>,
): number {
  let total = 0;
  for (const row of rows) {
    if (selectedIds.has(row.orderId)) total += row.amount;
  }
  return Math.round(total * 100) / 100;
}

type Props = {
  canManage: boolean;
  initialStage?: SettleStage;
  showManagerWarehouseBreakdown?: boolean;
};

/**
 * Settlements: select full custody rows by order_id (never amount matching).
 */
export function CodSettlementsPanel({
  canManage,
  initialStage = 'with_driver',
  showManagerWarehouseBreakdown = false,
}: Props) {
  const [stage, setStage] = useState<SettleStage>(initialStage);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const status = statusForStage(stage);
  const collections = useCodCustodyCollectionsQuery(status, true);
  const managerBreakdown = useManagerCodCustodyBreakdownQuery(
    stage === 'with_manager' && showManagerWarehouseBreakdown,
  );
  const settleSelected = useSettleDeliveryCodSelectedMutation();
  const confirmOwnerSelected = useConfirmOwnerCodReceiptSelectedMutation();

  const groups = useMemo(
    () => groupCodCustodyByPerson(collections.data ?? []),
    [collections.data],
  );

  const expanded = groups.find((g) => g.deliveryProfileId === expandedId) ?? null;
  const selectedTotal = useMemo(
    () =>
      selectedCollectionsTotal(expanded?.collections ?? [], selected),
    [expanded, selected],
  );

  const onStageChange = (next: SettleStage) => {
    setStage(next);
    setExpandedId(null);
    setSelected(new Set());
    setError(null);
    setOk(null);
  };

  const toggleOne = (orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectAll = (rows: CodCustodyCollectionRow[]) => {
    setSelected(new Set(rows.map((r) => r.orderId)));
  };

  const clearSelection = () => setSelected(new Set());

  const onReceive = async () => {
    setError(null);
    setOk(null);
    if (!expanded || selected.size === 0) {
      setError('Select at least one collection');
      return;
    }
    const orderIds = [...selected];
    try {
      if (stage === 'with_driver') {
        const res = await settleSelected.mutateAsync({
          deliveryProfileId: expanded.deliveryProfileId,
          orderIds,
        });
        setOk(
          `Manager received ₹${res['appliedAmount'] ?? selectedTotal} · ${orderIds.length} collection(s). Owner confirmation still required.`,
        );
      } else if (stage === 'with_manager') {
        const res = await confirmOwnerSelected.mutateAsync({
          deliveryProfileId: expanded.deliveryProfileId,
          orderIds,
        });
        setOk(
          `Owner confirmed ₹${res['appliedAmount'] ?? selectedTotal} · ${orderIds.length} collection(s).`,
        );
      }
      clearSelection();
    } catch (err) {
      setError(
        formatMutationError(
          err,
          stage === 'with_driver'
            ? 'Could not receive selected cash'
            : 'Could not confirm selected owner receipt',
        ),
      );
    }
  };

  const pending =
    settleSelected.isPending || confirmOwnerSelected.isPending;

  return (
    <div className="ga-cod-settle">
      <p className="ga-payments-page__note">
        Cash custody: With Delivery Boy → Received by Manager → Received by
        Owner. Receive by selecting collections — never by typing an amount.
      </p>

      <Tabs items={STAGE_TABS} active={stage} onChange={onStageChange} />

      {stage === 'with_manager' && showManagerWarehouseBreakdown ? (
        <div className="ga-cod-settle__mgr-overview">
          {managerBreakdown.isPending ? (
            <p>Loading manager breakdown…</p>
          ) : managerBreakdown.isError ? (
            <p className="ga-payments-page__error">
              {managerBreakdown.error instanceof Error
                ? managerBreakdown.error.message
                : 'Could not load manager breakdown'}
            </p>
          ) : (managerBreakdown.data?.rows.length ?? 0) > 0 ? (
            <p className="ga-payments-page__note">
              Manager hold total:{' '}
              <strong>{managerBreakdown.data?.totalLabel}</strong> — select
              collections below by delivery boy to confirm Owner receipt.
            </p>
          ) : null}
        </div>
      ) : null}

      {collections.isPending ? (
        <p>Loading collections…</p>
      ) : collections.isError ? (
        <p className="ga-payments-page__error">
          {collections.error instanceof Error
            ? collections.error.message
            : 'Could not load custody collections'}
        </p>
      ) : groups.length === 0 ? (
        <EmptyState
          title={
            stage === 'with_driver'
              ? 'No cash with delivery boys'
              : stage === 'with_manager'
                ? 'No cash with managers'
                : 'No owner-confirmed cash yet'
          }
          detail={
            stage === 'with_driver'
              ? 'Collect Cash on a delivery stop creates a WITH_DRIVER custody row.'
              : stage === 'with_manager'
                ? 'Receive selected collections from a delivery boy first.'
                : 'Confirm selected manager-held collections to move cash to Owner.'
          }
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Collections</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.deliveryProfileId}>
                  <td>{g.driverName}</td>
                  <td>{g.collectionCount}</td>
                  <td>{g.totalLabel}</td>
                  <td>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setExpandedId(
                          expandedId === g.deliveryProfileId
                            ? null
                            : g.deliveryProfileId,
                        );
                        clearSelection();
                        setError(null);
                        setOk(null);
                      }}
                    >
                      {expandedId === g.deliveryProfileId
                        ? 'Hide'
                        : 'View collections'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded ? (
        <div className="ga-cod-settle__detail">
          <h3 className="ga-payments-page__subhead">
            {expanded.driverName} · {expanded.totalLabel} (
            {expanded.collectionCount})
          </h3>
          <div className="ga-cod-settle__actions">
            <Button
              variant="secondary"
              onClick={() => selectAll(expanded.collections)}
            >
              Select all
            </Button>
            <Button variant="secondary" onClick={clearSelection}>
              Clear
            </Button>
          </div>
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  {stage !== 'owner' && canManage ? <th /> : null}
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Collected</th>
                </tr>
              </thead>
              <tbody>
                {expanded.collections.map((row) => (
                  <tr key={row.orderId}>
                    {stage !== 'owner' && canManage ? (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(row.orderId)}
                          onChange={() => toggleOne(row.orderId)}
                          aria-label={`Select ${row.orderCode}`}
                        />
                      </td>
                    ) : null}
                    <td>{row.orderCode}</td>
                    <td>{row.shopName}</td>
                    <td>{row.amountLabel}</td>
                    <td>{row.collectedAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stage !== 'owner' && canManage ? (
            <div className="ga-cod-settle__footer">
              <p>
                Selected: <strong>{formatInr(selectedTotal)}</strong> (
                {selected.size})
              </p>
              <Button
                variant="primary"
                disabled={pending || selected.size === 0}
                onClick={() => void onReceive()}
              >
                {stage === 'with_driver'
                  ? 'Receive Selected Cash'
                  : 'Confirm Owner Received Selected'}
              </Button>
            </div>
          ) : null}
          {stage === 'owner' ? (
            <p className="ga-payments-page__note">
              These collections are already received by Owner (final stage).
            </p>
          ) : null}
          {!canManage && stage !== 'owner' ? (
            <p className="ga-payments-page__note">
              Cash handovers require payments:manage.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="ga-payments-page__error">{error}</p> : null}
      {ok ? <p className="ga-payments-page__ok">{ok}</p> : null}
    </div>
  );
}
