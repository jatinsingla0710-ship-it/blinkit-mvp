import { describe, expect, it } from 'vitest';
import { catalogueListPriceNote } from './catalogue-price-note';

describe('catalogueListPriceNote', () => {
  it('stays quiet when the server pack price matches the list price', () => {
    expect(catalogueListPriceNote(166, 166)).toBeNull();
    expect(catalogueListPriceNote(166, 166.004)).toBeNull();
  });

  it('notes a real difference and ignores a missing preview price', () => {
    expect(catalogueListPriceNote(166, 165.5)).toMatch(/different price/i);
    expect(catalogueListPriceNote(166, null)).toBeNull();
    expect(catalogueListPriceNote(166, undefined)).toBeNull();
    expect(catalogueListPriceNote(Number.NaN, 10)).toBeNull();
    expect(catalogueListPriceNote(166, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
