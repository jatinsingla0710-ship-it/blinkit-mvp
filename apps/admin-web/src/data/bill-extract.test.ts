import { describe, expect, it } from 'vitest';
import {
  applyBillExtractMatches,
  emptyBillExtract,
  matchSkuFromHints,
  matchSupplierFromHints,
  parseBillExtractJson,
  runManualBillExtractor,
} from './bill-extract';

describe('Phase 13 bill extract matching', () => {
  const suppliers = [
    { id: 's1', name: 'Acme Foods', gstin: '27AAAAA0000A1Z5' },
    { id: 's2', name: 'Beta Traders', gstin: null },
  ];
  const skus = [
    { id: 'k1', skuCode: 'ATTA-5', name: 'Atta 5kg', productName: 'Atta' },
    { id: 'k2', skuCode: 'OIL-1', name: 'Oil 1L', productName: 'Oil' },
  ];

  it('matches supplier by GSTIN then exact name', () => {
    expect(
      matchSupplierFromHints(suppliers, { gstin: '27AAAAA0000A1Z5' })
        .matchedSupplierId,
    ).toBe('s1');
    expect(
      matchSupplierFromHints(suppliers, { name: 'beta traders' })
        .supplierMatchConfidence,
    ).toBe('exact');
  });

  it('matches SKU by code and single partial name', () => {
    expect(matchSkuFromHints(skus, { skuCode: 'ATTA-5' }).matchedSkuId).toBe(
      'k1',
    );
    expect(
      matchSkuFromHints(skus, { description: 'oil 1' }).matchConfidence,
    ).toBe('partial');
  });

  it('applies matches onto extract draft', () => {
    const extract = emptyBillExtract();
    extract.supplierGstinHint = '27AAAAA0000A1Z5';
    extract.lines = [
      {
        description: 'Atta 5kg',
        quantity: 10,
        unitCost: 200,
        skuCodeHint: 'ATTA-5',
      },
    ];
    const matched = applyBillExtractMatches(extract, suppliers, skus);
    expect(matched.matchedSupplierId).toBe('s1');
    expect(matched.lines[0]?.matchedSkuId).toBe('k1');
  });

  it('manual extractor returns empty labeled draft', async () => {
    const draft = await runManualBillExtractor({ imageFileName: 'bill.jpg' });
    expect(draft.extractorLabel).toBe('manual');
    expect(draft.lines).toEqual([]);
  });

  it('parses extract JSON safely', () => {
    const parsed = parseBillExtractJson({
      billNumber: 'B-1',
      lines: [{ description: 'X', quantity: 2, unitCost: 5 }],
    });
    expect(parsed.billNumber).toBe('B-1');
    expect(parsed.lines).toHaveLength(1);
  });
});
