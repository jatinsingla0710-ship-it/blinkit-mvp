import { useEffect, useMemo, useState } from 'react';
import type { OrderDetail, OrderLineItem } from '@/data/orders-types';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePricesListQuery } from '@/data/hooks';
import { useReplaceOrderLinesMutation } from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { formatInr } from '@/data/live/format';
import { Button, SelectField } from '@groaurum/ui';
import '@groaurum/ui/styles/data-table.css';
import './OrderItemsTab.css';

type EditableLine = {
  key: string;
  skuId: string;
  productName: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  orderId: string;
  lines: OrderLineItem[];
  payment: OrderDetail['payment'];
  canEdit?: boolean;
};

function toEditable(lines: OrderLineItem[]): EditableLine[] {
  return lines.map((line) => ({
    key: line.id,
    skuId: line.skuId ?? '',
    productName: line.productName || line.skuName,
    skuCode: line.skuCode,
    skuName: line.skuName,
    quantity: line.quantity ?? 0,
    unitPrice: line.unitPrice ?? 0,
  }));
}

export function OrderItemsTab({
  orderId,
  lines,
  payment,
  canEdit = false,
}: Props) {
  const replaceLines = useReplaceOrderLinesMutation();
  const { state: pricesState } = usePricesListQuery();
  const skus = useMemo(
    () =>
      (pricesState.data ?? []).filter(
        (row) => row.status === 'live' && row.currentTradePrice != null,
      ),
    [pricesState.data],
  );

  const [draft, setDraft] = useState<EditableLine[]>(() => toEditable(lines));
  const [addSkuId, setAddSkuId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toEditable(lines));
  }, [lines]);

  useEffect(() => {
    if (!addSkuId && skus[0]) setAddSkuId(skus[0].skuId);
  }, [skus, addSkuId]);

  const draftTotal = draft.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );

  const onSave = () => {
    setError(null);
    setOk(null);
    if (!draft.length) {
      setError('At least one line is required');
      return;
    }
    if (draft.some((l) => !l.skuId || l.quantity <= 0)) {
      setError('Each line needs a SKU and quantity > 0');
      return;
    }
    replaceLines.mutate(
      {
        orderId,
        lines: draft.map((l) => ({
          skuId: l.skuId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      },
      {
        onSuccess: (result) => {
          setOk(
            `Saved ${result.lineCount} line(s) · total ${formatInr(result.total)}`,
          );
        },
        onError: (err) => {
          setError(formatMutationError(err, 'Could not save lines'));
        },
      },
    );
  };

  const addLine = () => {
    const sku = skus.find((s) => s.skuId === addSkuId);
    if (!sku || sku.currentTradePrice == null) {
      setError('Select a SKU with a live price');
      return;
    }
    setDraft((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        skuId: sku.skuId,
        productName: sku.productName,
        skuCode: sku.skuCode,
        skuName: sku.skuName,
        quantity: 1,
        unitPrice: sku.currentTradePrice ?? 0,
      },
    ]);
    setError(null);
  };

  if (lines.length === 0 && !canEdit) {
    return (
      <EmptyState
        title="No line items"
        detail="Ordered products will appear here."
      />
    );
  }

  return (
    <div className="ga-ord-items">
      {canEdit ? (
        <p className="ga-ord-items__edit-hint">
          Lines are editable until packing starts. Save replaces all lines on
          the order.
        </p>
      ) : null}

      <div className="ga-table-wrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {draft.map((line) => (
              <tr key={line.key}>
                <td>
                  <span className="ga-table__primary">
                    {line.productName || line.skuName}
                  </span>
                </td>
                <td className="ga-table__mono">{line.skuCode}</td>
                <td>
                  {canEdit ? (
                    <input
                      className="ga-ord-items__input"
                      type="number"
                      min={0}
                      step="any"
                      value={line.quantity}
                      aria-label="Quantity"
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setDraft((prev) =>
                          prev.map((row) =>
                            row.key === line.key ? { ...row, quantity: qty } : row,
                          ),
                        );
                      }}
                    />
                  ) : (
                    line.quantity
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <input
                      className="ga-ord-items__input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitPrice}
                      aria-label="Unit price"
                      onChange={(e) => {
                        const unitPrice = Number(e.target.value);
                        setDraft((prev) =>
                          prev.map((row) =>
                            row.key === line.key
                              ? { ...row, unitPrice }
                              : row,
                          ),
                        );
                      }}
                    />
                  ) : (
                    formatInr(line.unitPrice)
                  )}
                </td>
                <td>{formatInr(line.quantity * line.unitPrice)}</td>
                {canEdit ? (
                  <td>
                    <button
                      type="button"
                      className="ga-ord-items__remove"
                      onClick={() =>
                        setDraft((prev) =>
                          prev.filter((row) => row.key !== line.key),
                        )
                      }
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <div className="ga-ord-items__edit-bar">
          <SelectField label="Add SKU" value={addSkuId} onChange={setAddSkuId}>
            <option value="">Select SKU…</option>
            {skus.map((sku) => (
              <option key={sku.skuId} value={sku.skuId}>
                {sku.productName} · {sku.skuCode}
              </option>
            ))}
          </SelectField>
          <Button variant="secondary" onClick={addLine}>
            Add line
          </Button>
          <Button
            variant="primary"
            disabled={replaceLines.isPending}
            onClick={onSave}
          >
            {replaceLines.isPending ? 'Saving…' : 'Save lines'}
          </Button>
        </div>
      ) : null}

      {error ? <p className="ga-ord-items__error">{error}</p> : null}
      {ok ? <p className="ga-ord-items__ok">{ok}</p> : null}

      <dl className="ga-ord-items__totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{canEdit ? formatInr(draftTotal) : payment.subtotalLabel}</dd>
        </div>
        <div className="ga-ord-items__grand">
          <dt>Grand Total</dt>
          <dd>{canEdit ? formatInr(draftTotal) : payment.totalLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
