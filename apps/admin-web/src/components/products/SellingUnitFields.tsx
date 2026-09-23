import {
  CUSTOM_SELLING_UNIT,
  SELLING_UNIT_LABELS,
  SELLING_UNITS,
  isStandardSellingUnit,
} from '@groaurum/shared-types';
import { SelectField, TextField } from '@groaurum/ui';

type Props = {
  sellingUnit: string;
  customUnit: string;
  onSellingUnitChange: (unit: string) => void;
  onCustomUnitChange: (custom: string) => void;
  disabled?: boolean;
};

/**
 * Standard selling units + Custom free-text.
 * Persisted value is a SELLING_UNITS code or the custom name string.
 */
export function SellingUnitFields({
  sellingUnit,
  customUnit,
  onSellingUnitChange,
  onCustomUnitChange,
  disabled,
}: Props) {
  const selectValue = isStandardSellingUnit(sellingUnit)
    ? sellingUnit.toUpperCase()
    : sellingUnit
      ? CUSTOM_SELLING_UNIT
      : 'PCS';

  return (
    <div className="ga-selling-unit-fields">
      <SelectField
        label="Selling unit"
        value={selectValue}
        disabled={disabled}
        onChange={(value) => onSellingUnitChange(value)}
      >
        {SELLING_UNITS.map((u) => (
          <option key={u} value={u}>
            {SELLING_UNIT_LABELS[u]}
          </option>
        ))}
        <option value={CUSTOM_SELLING_UNIT}>Custom unit…</option>
      </SelectField>
      {selectValue === CUSTOM_SELLING_UNIT ? (
        <TextField
          label="Custom unit name"
          value={customUnit}
          disabled={disabled}
          placeholder="e.g. Drum, Sack, Case"
          onChange={(e) => onCustomUnitChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

/** Resolve UI selection into the string stored on skus.selling_unit. */
export function resolveSellingUnitForSave(
  sellingUnit: string,
  customUnit: string,
): string | { error: string } {
  if (sellingUnit === CUSTOM_SELLING_UNIT || !isStandardSellingUnit(sellingUnit)) {
    const custom = customUnit.trim();
    if (!custom) return { error: 'Enter a custom unit name' };
    if (custom.length > 40) return { error: 'Custom unit must be at most 40 characters' };
    return custom;
  }
  return sellingUnit.toUpperCase();
}

export function sellingUnitFormFromStored(stored: string | undefined): {
  sellingUnit: string;
  customUnit: string;
} {
  const raw = (stored ?? 'PCS').trim();
  if (isStandardSellingUnit(raw)) {
    return { sellingUnit: raw.toUpperCase(), customUnit: '' };
  }
  return { sellingUnit: CUSTOM_SELLING_UNIT, customUnit: raw };
}
