import { describe, expect, it } from 'vitest';
import {
  applyReceiptExtractMatches,
  emptyReceiptExtract,
  matchExpenseCategoryFromHint,
  matchPaymentMethodFromHint,
  parseReceiptExtractJson,
  runManualReceiptExtractor,
} from './receipt-extract';

describe('Phase 14 receipt extract matching', () => {
  it('matches petrol/fuel to TRANSPORT and cash/upi payment methods', () => {
    expect(matchExpenseCategoryFromHint('petrol').category).toBe('TRANSPORT');
    expect(matchExpenseCategoryFromHint('Rent').category).toBe('RENT');
    expect(matchPaymentMethodFromHint('upi')).toBe('UPI');
    expect(matchPaymentMethodFromHint('gpay')).toBe('UPI');
  });

  it('applies matches onto extract draft', () => {
    const extract = emptyReceiptExtract();
    extract.merchantHint = 'Indian Oil';
    extract.categoryHint = 'petrol';
    extract.paymentMethodHint = 'cash';
    extract.amount = 2500;
    const matched = applyReceiptExtractMatches(extract);
    expect(matched.category).toBe('TRANSPORT');
    expect(matched.paymentMethod).toBe('CASH');
    expect(matched.description).toContain('Indian Oil');
  });

  it('manual extractor returns empty labeled draft', async () => {
    const draft = await runManualReceiptExtractor({
      imageFileName: 'receipt.jpg',
    });
    expect(draft.extractorLabel).toBe('manual');
    expect(draft.amount).toBeNull();
  });

  it('parses extract JSON safely', () => {
    const parsed = parseReceiptExtractJson({
      merchantHint: 'Shop',
      amount: '1200',
      category: 'OFFICE',
      paymentMethod: 'BANK',
      extractorLabel: 'manual',
    });
    expect(parsed.amount).toBe(1200);
    expect(parsed.category).toBe('OFFICE');
    expect(parsed.paymentMethod).toBe('BANK');
  });
});
