import { useEffect, useMemo, useState } from 'react';
import { Modal, Button } from '@groaurum/ui';
import { formatMutationError } from '@/data/mutation-errors';
import { previewAdjustmentPacks } from '@/data/product-inventory-display';
import {
  OUTER_PACKAGES,
  packUnitPluralLabel,
  type OuterPackageKey,
} from '@/data/pack-units';
import { useInventoryDetailQuery } from '@/data/hooks';
import { useUpdateInventoryMutation } from '@/data/mutations';
import './ProductStockAdjustModal.css';

type Props = {
  open: boolean;
  skuId: string | undefined;
  productName: string;
  /** Prefer this warehouse balance when opening the modal. */
  preferredBalanceId?: string | null;
  onClose: () => void;
};

type AdjustMode = 'add' | 'remove' | 'set';

export function ProductStockAdjustModal({
  open,
  skuId,
  productName,
  preferredBalanceId,
  onClose,
}: Props) {
  const [selectedBalanceId, setSelectedBalanceId] = useState<string | undefined>(
    preferredBalanceId ?? undefined,
  );
  const { state } = useInventoryDetailQuery(skuId, selectedBalanceId);
  const updateInventory = useUpdateInventoryMutation();
  const [mode, setMode] = useState<AdjustMode>('add');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'pack' | 'outer'>('outer');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const detail = state.data;
  const pending = updateInventory.isPending;

  useEffect(() => {
    if (!open) return;
    setSelectedBalanceId(preferredBalanceId ?? undefined);
    setQuantity('');
    setReason('');
    setError(null);
    setMode('add');
  }, [open, preferredBalanceId]);

  useEffect(() => {
    if (!detail) return;
    if (detail.packsPerCarton && detail.packsPerCarton > 0) {
      setUnit('outer');
    } else {
      setUnit('pack');
    }
  }, [detail?.balanceId, detail?.packsPerCarton]);

  const warehouses = detail?.warehouses ?? [];

  const outerKey = (detail?.outerType ?? 'bag') as OuterPackageKey;
  const outerLabel = OUTER_PACKAGES[outerKey]?.label ?? 'Bag';
  const outerPlural = OUTER_PACKAGES[outerKey]?.plural ?? 'Bags';

  const preview = useMemo(() => {
    if (!detail || !quantity.trim()) return null;
    return previewAdjustmentPacks({
      quantity: Number(quantity),
      unit,
      packsPerOuter: detail.packsPerCarton,
      netQuantity: detail.netQuantity,
      netQuantityUnit: detail.netQuantityUnit,
      outerType: detail.outerType,
    });
  }, [detail, quantity, unit]);

  const onSubmit = () => {
    if (!detail || !skuId) return;
    setError(null);

    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Enter a positive quantity');
      return;
    }

    const converted = previewAdjustmentPacks({
      quantity: parsedQty,
      unit,
      packsPerOuter: detail.packsPerCarton,
      netQuantity: detail.netQuantity,
      netQuantityUnit: detail.netQuantityUnit,
      outerType: detail.outerType,
    });
    if ('error' in converted) {
      setError(converted.error);
      return;
    }

    const current = Number(detail.onHandQuantity ?? 0);
    let nextOnHand = current;
    if (mode === 'add') nextOnHand = current + converted.packs;
    else if (mode === 'remove') nextOnHand = current - converted.packs;
    else nextOnHand = converted.packs;

    if (nextOnHand < 0) {
      setError('Cannot reduce stock below zero');
      return;
    }

    updateInventory.mutate(
      {
        id: detail.balanceId,
        input: {
          skuId: detail.skuId,
          operationalLocationId: detail.warehouseId,
          onHandQuantity: nextOnHand,
          reason: reason.trim() || `Product stock ${mode}`,
        },
      },
      {
        onSuccess: () => {
          setQuantity('');
          setReason('');
          onClose();
        },
        onError: (err) =>
          setError(formatMutationError(err, 'Could not adjust stock')),
      },
    );
  };

  return (
    <Modal
      open={open}
      title={`Adjust Stock — ${productName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={pending || !detail}
          >
            {pending ? 'Saving…' : 'Save adjustment'}
          </Button>
        </>
      }
    >
      {!detail ? (
        <p>Loading inventory…</p>
      ) : (
        <div className="ga-product-adjust">
          <label className="ga-product-adjust__field">
            Warehouse
            <select
              value={detail.balanceId}
              onChange={(e) => setSelectedBalanceId(e.target.value)}
              aria-label="Warehouse"
            >
              {warehouses.map((wh) => (
                <option key={wh.balanceId} value={wh.balanceId}>
                  {wh.warehouseName}
                  {!wh.warehouseActive ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </label>

          <p className="ga-product-adjust__current">
            Current stock at {detail.warehouseName}:{' '}
            <strong>{detail.onHandLabel}</strong>
          </p>

          <fieldset className="ga-product-adjust__fieldset">
            <legend>What do you want to do?</legend>
            <div className="ga-product-adjust__modes">
              {(['add', 'remove', 'set'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    mode === value
                      ? 'ga-product-adjust__mode ga-product-adjust__mode--active'
                      : 'ga-product-adjust__mode'
                  }
                  onClick={() => setMode(value)}
                >
                  {value === 'add'
                    ? 'Add Stock'
                    : value === 'remove'
                      ? 'Remove Stock'
                      : 'Set Correct Stock'}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="ga-product-adjust__qty">
            <label className="ga-product-adjust__field">
              Quantity
              <input
                type="number"
                min={0}
                step={1}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 5"
                aria-label="Adjustment quantity"
              />
            </label>
            <label className="ga-product-adjust__field">
              Unit
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'pack' | 'outer')}
                aria-label="Unit"
              >
                {detail.packsPerCarton && detail.packsPerCarton > 0 ? (
                  <option value="outer">{outerPlural}</option>
                ) : null}
                <option value="pack">
                  {packUnitPluralLabel(detail.netQuantityUnit, 2)}
                </option>
              </select>
            </label>
          </div>

          {preview && !('error' in preview) ? (
            <p className="ga-product-adjust__preview">
              Conversion: {preview.preview}
            </p>
          ) : null}
          {preview && 'error' in preview ? (
            <p className="ga-product-adjust__error">{preview.error}</p>
          ) : null}

          {detail.packsPerCarton && detail.packsPerCarton > 0 ? (
            <p className="ga-product-adjust__hint">
              1 {outerLabel} = {detail.packsPerCarton} packs
              {detail.netQuantity && detail.netQuantityUnit
                ? ` · each pack is ${detail.netQuantity} ${detail.netQuantityUnit}`
                : ''}
            </p>
          ) : null}

          <label className="ga-product-adjust__field">
            Reason (optional)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received delivery"
              aria-label="Adjustment reason"
            />
          </label>

          {error ? <p className="ga-product-adjust__error">{error}</p> : null}
        </div>
      )}
    </Modal>
  );
}
