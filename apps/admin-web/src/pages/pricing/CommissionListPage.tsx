import { useState } from 'react';
import { usePermissions } from '@groaurum/auth/react';
import { Button, Modal, TextField } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import type { SkuCommissionRowVm } from '@/data/commission-types';
import { useSkuCommissionListQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import { useSetSkuCommissionTermMutation } from '@/data/mutations';
import { TEAM_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './CommissionListPage.css';

function moneyLabel(amount: number, unit: string): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `₹${formatted} / ${unit}`;
}

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

export function CommissionListPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('pricing:manage');
  const { state } = useSkuCommissionListQuery();
  const [editing, setEditing] = useState<SkuCommissionRowVm | null>(null);

  return (
    <QueryStateGate title="Commission" state={state}>
      {(rows) => (
        <div className="ga-commission-list">
          <PageHeader
            title="Commission"
            subtitle="How much salesmen earn per product unit sold"
            meta={`${rows.filter((row) => row.open).length} active${canManage ? '' : ' · read-only'}`}
          />

          <SectionRelatedLinks
            label="Team section"
            links={[...TEAM_SECTION_LINKS]}
          />
          <Card title="SKU commission">
            {rows.length === 0 ? (
              <p className="ga-commission-list__empty">No active SKUs.</p>
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Selling unit</th>
                      <th>Current commission</th>
                      <th>Effective from</th>
                      <th>Status</th>
                      {canManage ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.skuId}>
                        <td>{row.productName}</td>
                        <td>
                          <span className="ga-table__primary">{row.skuName}</span>
                          <span className="ga-table__mono">{row.skuCode}</span>
                        </td>
                        <td>{row.sellingUnit}</td>
                        <td>
                          {row.currentAmount == null
                            ? '—'
                            : moneyLabel(row.currentAmount, row.sellingUnit)}
                        </td>
                        <td>{row.effectiveFrom ?? '—'}</td>
                        <td>{row.open ? 'Active' : 'Not set'}</td>
                        {canManage ? (
                          <td>
                            <Button type="button" onClick={() => setEditing(row)}>
                              Edit
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {editing ? (
            <CommissionEditModal
              row={editing}
              onClose={() => setEditing(null)}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}

function CommissionEditModal({
  row,
  onClose,
}: {
  row: SkuCommissionRowVm;
  onClose: () => void;
}) {
  const save = useSetSkuCommissionTermMutation();
  const [amount, setAmount] = useState(
    row.currentAmount == null ? '' : String(row.currentAmount),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseAmount(amount);
  const currentLabel =
    row.currentAmount == null
      ? 'Not set'
      : moneyLabel(row.currentAmount, row.sellingUnit);

  const onReview = () => {
    setError(null);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Commission must be zero or greater.');
      return;
    }
    if (!effectiveFrom) {
      setError('Effective from date is required.');
      return;
    }
    setConfirming(true);
  };

  const onSave = () => {
    setError(null);
    save.mutate(
      {
        skuId: row.skuId,
        fixedAmountPerUnit: parsed,
        effectiveFrom,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => {
          setConfirming(false);
          setError(formatMutationError(err, 'Could not save commission'));
        },
      },
    );
  };

  return (
    <Modal
      open
      title={`Commission · ${row.skuName}`}
      onClose={onClose}
      footer={
        confirming ? (
          <>
            <Button type="button" onClick={() => setConfirming(false)} disabled={save.isPending}>
              Back
            </Button>
            <Button type="button" variant="primary" onClick={onSave} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Confirm change'}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={onReview}>
              Save commission
            </Button>
          </>
        )
      }
    >
      <div className="ga-commission-edit">
        <p>
          <strong>{row.productName}</strong> · {row.skuName}
        </p>
        <p>Current: {currentLabel}</p>
        {confirming ? (
          <p className="ga-commission-edit__confirm">
            Future salesman earnings for this SKU will use{' '}
            {moneyLabel(parsed, row.sellingUnit)} from {effectiveFrom}. Already
            earned commission stays at the rate recorded on each sale.
          </p>
        ) : (
          <>
            <TextField
              label={`New commission (₹ / ${row.sellingUnit})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
            <TextField
              label="Effective from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </>
        )}
        {row.history.length > 0 ? (
          <div>
            <h3 className="ga-commission-edit__history-title">Previous terms</h3>
            <ul className="ga-commission-edit__history">
              {row.history.map((term) => (
                <li key={`${term.effectiveFrom}-${term.effectiveTo ?? 'open'}`}>
                  {moneyLabel(term.amount, row.sellingUnit)} · {term.effectiveFrom}
                  {term.open
                    ? ' · Active'
                    : term.effectiveTo
                      ? ` – ${term.effectiveTo}`
                      : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? <p className="ga-commission-edit__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
