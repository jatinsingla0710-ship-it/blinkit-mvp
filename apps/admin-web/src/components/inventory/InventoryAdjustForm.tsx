import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { InventorySkuDetail } from '@/data/inventory-types';
import { inventoryOuterLabel } from '@/data/inventory-display';
import { formatMutationError } from '@/data/mutation-errors';
import {
  mixedInventorySummary,
  mixedStockToPacks,
  packUnitPluralLabel,
} from '@/data/pack-units';
import { useUpdateInventoryMutation } from '@/data/mutations';
import './InventoryAdjustForm.css';

type Props = {
  detail: InventorySkuDetail;
  canManage: boolean;
  onWarehouseChange: (balanceId: string) => void;
};

type AdjustMode = 'add' | 'remove' | 'set';

export function InventoryAdjustForm({
  detail,
  canManage,
  onWarehouseChange,
}: Props) {
  const updateInventory = useUpdateInventoryMutation();
  const [mode, setMode] = useState<AdjustMode>('add');
  const [outerQty, setOuterQty] = useState('');
  const [packQty, setPackQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasOuter = Boolean(detail.packsPerCarton && detail.packsPerCarton > 0);
  const outerSingular = inventoryOuterLabel(detail.outerType, 1);
  const outerPlural = inventoryOuterLabel(detail.outerType, 2);
  const packWord = packUnitPluralLabel(detail.netQuantityUnit, 2);

  const preview = useMemo(() => {
    if (!hasOuter && !packQty.trim()) return null;
    if (hasOuter && !outerQty.trim() && !packQty.trim()) return null;

    const converted = mixedStockToPacks({
      outerCount: outerQty.trim() === '' ? 0 : Number(outerQty),
      loosePacks: packQty.trim() === '' ? 0 : Number(packQty),
      packsPerOuter: detail.packsPerCarton,
    });
    if ('error' in converted) {
      if (!hasOuter && Number(packQty) > 0) {
        const packs = Math.round(Number(packQty));
        return {
          packs,
          label: `${packs} ${packUnitPluralLabel(detail.netQuantityUnit, packs)}`,
        };
      }
      return { error: converted.error };
    }

    const summary =
      detail.packsPerCarton && detail.packsPerCarton > 0
        ? mixedInventorySummary({
            totalPacks: converted.onHandPacks,
            packsPerOuter: detail.packsPerCarton,
            outerType: detail.outerType ?? 'bag',
            packQuantity: detail.netQuantity ?? 1,
            packUnit: detail.netQuantityUnit,
          })
        : `${converted.onHandPacks} ${packWord}`;

    return {
      packs: converted.onHandPacks,
      label: `${summary} = ${converted.onHandPacks} ${packWord} total`,
    };
  }, [
    detail.packsPerCarton,
    detail.outerType,
    detail.netQuantity,
    detail.netQuantityUnit,
    hasOuter,
    outerQty,
    packQty,
    packWord,
  ]);

  const submit = () => {
    setError(null);
    if (!canManage || !detail.warehouseActive) return;

    let deltaPacks = 0;
    if (hasOuter) {
      const converted = mixedStockToPacks({
        outerCount: outerQty.trim() === '' ? 0 : Number(outerQty),
        loosePacks: packQty.trim() === '' ? 0 : Number(packQty),
        packsPerOuter: detail.packsPerCarton,
      });
      if ('error' in converted) {
        setError(converted.error);
        return;
      }
      deltaPacks = converted.onHandPacks;
    } else {
      const parsed = Number(packQty);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Enter a positive quantity');
        return;
      }
      deltaPacks = Math.round(parsed);
    }

    if (deltaPacks <= 0 && mode !== 'set') {
      setError('Enter a quantity greater than zero');
      return;
    }

    const current = Number(detail.onHandQuantity ?? 0);
    let nextOnHand = current;
    if (mode === 'add') nextOnHand = current + deltaPacks;
    else if (mode === 'remove') nextOnHand = current - deltaPacks;
    else nextOnHand = deltaPacks;

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
          reason: reason.trim() || `Inventory ${mode}`,
        },
      },
      {
        onSuccess: () => {
          setOuterQty('');
          setPackQty('');
          setReason('');
        },
        onError: (err) =>
          setError(formatMutationError(err, 'Inventory adjustment failed')),
      },
    );
  };

  if (!canManage) {
    return (
      <p className="ga-inv-adjust__note">
        You do not have permission to adjust inventory.
      </p>
    );
  }

  if (!detail.warehouseActive) {
    return (
      <p className="ga-inv-adjust__note">
        This warehouse is inactive. Historical movements remain visible; new
        adjustments are disabled.
      </p>
    );
  }

  return (
    <div className="ga-inv-adjust">
      <ol className="ga-inv-adjust__steps">
        <li>
          <span className="ga-inv-adjust__step-label">Step 1 · Warehouse</span>
          <select
            value={detail.balanceId}
            onChange={(e) => onWarehouseChange(e.target.value)}
            aria-label="Select warehouse"
          >
            {detail.warehouses.map((wh) => (
              <option key={wh.balanceId} value={wh.balanceId}>
                {wh.warehouseName}
                {!wh.warehouseActive ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
          <p className="ga-inv-adjust__current">
            Current on hand: <strong>{detail.onHandLabel}</strong>
            {' · '}
            Available: <strong>{detail.availableLabel}</strong>
          </p>
        </li>

        <li>
          <span className="ga-inv-adjust__step-label">Step 2 · Action</span>
          <div className="ga-inv-adjust__modes">
            {(
              [
                ['add', 'Add Stock'],
                ['remove', 'Remove Stock'],
                ['set', 'Set Exact Stock'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={
                  mode === id
                    ? 'ga-inv-adjust__mode ga-inv-adjust__mode--active'
                    : 'ga-inv-adjust__mode'
                }
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </li>

        <li>
          <span className="ga-inv-adjust__step-label">Step 3 · Quantity</span>
          <div className="ga-inv-adjust__qty-row">
            {hasOuter ? (
              <label>
                {outerPlural}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={outerQty}
                  onChange={(e) => {
                    setOuterQty(e.target.value);
                    setError(null);
                  }}
                  placeholder={`e.g. 2`}
                />
              </label>
            ) : null}
            <label>
              {hasOuter ? `Extra ${packWord}` : packWord}
              <input
                type="number"
                min={0}
                step={1}
                value={packQty}
                onChange={(e) => {
                  setPackQty(e.target.value);
                  setError(null);
                }}
                placeholder={hasOuter ? 'e.g. 5' : 'e.g. 10'}
              />
            </label>
          </div>
          {hasOuter ? (
            <p className="ga-inv-adjust__hint">
              1 {outerSingular} = {detail.packsPerCarton} {packWord}
            </p>
          ) : null}
          {preview && 'label' in preview ? (
            <p className="ga-inv-adjust__preview">
              Preview: <strong>{preview.label}</strong>
            </p>
          ) : null}
          {preview && 'error' in preview ? (
            <p className="ga-inv-adjust__error">{preview.error}</p>
          ) : null}
        </li>
      </ol>

      <label className="ga-inv-adjust__reason">
        Reason (optional)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Physical count correction"
        />
      </label>

      {error ? (
        <p className="ga-inv-adjust__error" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        disabled={updateInventory.isPending}
        onClick={submit}
      >
        {updateInventory.isPending
          ? 'Saving…'
          : mode === 'add'
            ? 'Add stock'
            : mode === 'remove'
              ? 'Remove stock'
              : 'Set stock'}
      </Button>
    </div>
  );
}
