import { describe, expect, it } from 'vitest';
import { buildGstTaxSummary } from './gst-report';

describe('Phase 9 GST tax summary', () => {
  it('aggregates purchase CGST/SGST/IGST and unclassified tax', () => {
    const summary = buildGstTaxSummary({
      generatedAtLabel: 'now',
      rangeLabel: '2026-10-01 → 2026-10-31',
      purchases: [
        {
          id: '1',
          billNumber: 'B1',
          purchaseDate: '2026-10-01',
          purchaseDateLabel: '1 Oct',
          supplierName: 'Local',
          supplyType: 'INTRA',
          subtotal: 10000,
          taxAmount: 1800,
          cgstAmount: 900,
          sgstAmount: 900,
          igstAmount: 0,
        },
        {
          id: '2',
          billNumber: 'B2',
          purchaseDate: '2026-10-02',
          purchaseDateLabel: '2 Oct',
          supplierName: 'Other state',
          supplyType: 'INTER',
          subtotal: 5000,
          taxAmount: 900,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 900,
        },
        {
          id: '3',
          billNumber: 'B3',
          purchaseDate: '2026-10-03',
          purchaseDateLabel: '3 Oct',
          supplierName: 'Legacy',
          supplyType: 'UNSET',
          subtotal: 2000,
          taxAmount: 100,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
        },
      ],
    });
    expect(summary.cgstInput).toBe(900);
    expect(summary.sgstInput).toBe(900);
    expect(summary.igstInput).toBe(900);
    expect(summary.unclassifiedInput).toBe(100);
    expect(summary.totalInputTax).toBe(2800);
    expect(summary.taxableValue).toBe(17000);
  });
});
