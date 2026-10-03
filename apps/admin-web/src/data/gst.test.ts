import { describe, expect, it } from 'vitest';
import {
  classifyGstSupplyType,
  gstComponentsMatchTax,
  isValidGstin,
  normalizeGstin,
  parseOptionalGstin,
  splitGstTaxAmount,
  stateCodeFromGstin,
} from './gst';

describe('Phase 9 GST helpers', () => {
  it('normalizes and validates GSTIN structure', () => {
    expect(normalizeGstin(' 07aabcg1234d1z5 ')).toBe('07AABCG1234D1Z5');
    expect(isValidGstin('07AABCG1234D1Z5')).toBe(true);
    expect(isValidGstin('INVALID')).toBe(false);
    expect(stateCodeFromGstin('07AABCG1234D1Z5')).toBe('07');
    expect(parseOptionalGstin('').ok).toBe(true);
    expect(parseOptionalGstin('bad').ok).toBe(false);
  });

  it('classifies intra vs inter state supply', () => {
    expect(classifyGstSupplyType('07', '07')).toBe('INTRA');
    expect(classifyGstSupplyType('07', '27')).toBe('INTER');
    expect(classifyGstSupplyType('07', null)).toBe('UNSET');
  });

  it('splits tax into CGST/SGST or IGST', () => {
    const intra = splitGstTaxAmount(100, 'INTRA');
    expect(intra.cgstAmount + intra.sgstAmount).toBe(100);
    expect(intra.igstAmount).toBe(0);

    const inter = splitGstTaxAmount(180, 'INTER');
    expect(inter.igstAmount).toBe(180);
    expect(inter.cgstAmount).toBe(0);

    expect(
      gstComponentsMatchTax({
        taxAmount: 100,
        cgstAmount: 50,
        sgstAmount: 50,
        igstAmount: 0,
      }),
    ).toBe(true);
  });
});
