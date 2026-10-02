import { useEffect, useState } from 'react';
import type { Sku } from '@groaurum/shared-types';
import {
  commitTypedQuantity,
  maxOrderQuantity,
  minOrderQuantity,
  stepDown,
  stepUp,
  toOrderUnits,
} from '@/data/order-quantity';

type Props = {
  sku: Pick<
    Sku,
    | 'id'
    | 'name'
    | 'moq'
    | 'quantityStep'
    | 'packsPerCarton'
    | 'outerType'
    | 'sellingUnit'
    | 'netQuantityUnit'
  >;
  /** Pack quantity stored in the cart. */
  quantity: number;
  available: number;
  disabled?: boolean;
  onChange: (packQuantity: number) => void;
  onAdjusted?: (reason: string) => void;
};

/**
 * − / + in valid steps with a typed field for fast entry.
 * The input shows salesman order units (Box/Kg/Pack); cart stores packs.
 */
export function QuantityStepper({
  sku,
  quantity,
  available,
  disabled,
  onChange,
  onAdjusted,
}: Props) {
  const orderQty = quantity > 0 ? toOrderUnits(sku, quantity) : 0;
  const [text, setText] = useState(orderQty ? String(orderQty) : '');
  useEffect(() => {
    setText(orderQty ? String(orderQty) : '');
  }, [orderQty]);

  const max = maxOrderQuantity(sku, available);
  const canAdd = !disabled && max > 0 && quantity < max;
  const canRemove = !disabled && quantity > 0;
  const stepOrder = toOrderUnits(sku, sku.quantityStep > 0 ? sku.quantityStep : 1);
  const allowsDecimal = stepOrder < 1 || Math.abs(stepOrder - Math.round(stepOrder)) > 1e-9;

  function commit() {
    const result = commitTypedQuantity(sku, text, available);
    if (result.adjustedReason) onAdjusted?.(result.adjustedReason);
    const nextOrder = result.quantity ? toOrderUnits(sku, result.quantity) : 0;
    setText(nextOrder ? String(nextOrder) : '');
    if (result.quantity !== quantity) onChange(result.quantity);
  }

  return (
    <div className="ga-sales-stepper" role="group" aria-label={`Quantity for ${sku.name}`}>
      <button
        type="button"
        className="ga-sales-stepper__btn"
        aria-label={`Decrease ${sku.name}`}
        disabled={!canRemove}
        onClick={() => onChange(stepDown(sku, quantity))}
      >
        −
      </button>
      <input
        className="ga-sales-stepper__input"
        type="number"
        inputMode={allowsDecimal ? 'decimal' : 'numeric'}
        min={0}
        step={stepOrder}
        aria-label={`${sku.name} quantity`}
        value={text}
        placeholder="0"
        disabled={disabled || max === 0}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        className="ga-sales-stepper__btn ga-sales-stepper__btn--add"
        aria-label={`Increase ${sku.name}`}
        disabled={!canAdd}
        onClick={() => onChange(stepUp(sku, quantity, available))}
      >
        +
      </button>
    </div>
  );
}

export { minOrderQuantity };
