import { useEffect, useState } from 'react';
import type { Sku } from '@groaurum/shared-types';
import {
  commitTypedQuantity,
  maxOrderQuantity,
  stepDown,
  stepUp,
} from '@/data/order-quantity';

type Props = {
  sku: Pick<Sku, 'id' | 'name' | 'moq' | 'quantityStep'>;
  quantity: number;
  available: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
  onAdjusted?: (reason: string) => void;
};

/**
 * − / + in valid steps with a typed field for fast entry. Only valid
 * quantities (or 0 = remove) ever leave this component.
 */
export function QuantityStepper({
  sku,
  quantity,
  available,
  disabled,
  onChange,
  onAdjusted,
}: Props) {
  const [text, setText] = useState(quantity ? String(quantity) : '');
  useEffect(() => {
    setText(quantity ? String(quantity) : '');
  }, [quantity]);

  const max = maxOrderQuantity(sku, available);
  const canAdd = !disabled && max > 0 && quantity < max;
  const canRemove = !disabled && quantity > 0;

  function commit() {
    const result = commitTypedQuantity(sku, text, available);
    if (result.adjustedReason) onAdjusted?.(result.adjustedReason);
    setText(result.quantity ? String(result.quantity) : '');
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
        inputMode="numeric"
        min={0}
        step={sku.quantityStep}
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
