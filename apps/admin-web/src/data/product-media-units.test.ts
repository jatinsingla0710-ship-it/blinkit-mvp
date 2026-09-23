import { describe, expect, it } from 'vitest';
import {
  CUSTOM_SELLING_UNIT,
  SELLING_UNITS,
  isStandardSellingUnit,
} from '@groaurum/shared-types';
import {
  deriveSellingUnitCode,
  isPriceBasisCompatible,
  priceBasesForPackUnit,
} from './pack-units';

describe('selling unit catalog (shared-types)', () => {
  it('includes common standard units', () => {
    expect(SELLING_UNITS).toContain('PCS');
    expect(SELLING_UNITS).toContain('BOX');
    expect(SELLING_UNITS).toContain('KG');
    expect(SELLING_UNITS).toContain('CARTON');
  });

  it('recognizes standard codes', () => {
    expect(isStandardSellingUnit('kg')).toBe(true);
    expect(isStandardSellingUnit('PACK')).toBe(true);
    expect(isStandardSellingUnit('Drum')).toBe(false);
  });

  it('keeps CUSTOM sentinel for free-text paths', () => {
    expect(CUSTOM_SELLING_UNIT).toBe('CUSTOM');
  });
});

describe('pack-driven selling_unit derivation', () => {
  it('maps pack unit to skus.selling_unit without a separate UI field', () => {
    expect(deriveSellingUnitCode('g')).toBe('PACK');
    expect(deriveSellingUnitCode('bottle')).toBe('BOTTLE');
  });

  it('filters price basis by pack unit', () => {
    expect(priceBasesForPackUnit('pcs')).toContain('per_piece');
    expect(isPriceBasisCompatible('litre', 'per_kg')).toBe(false);
  });
});
