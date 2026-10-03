import { describe, expect, it } from 'vitest';
import {
  applyPaymentProofMatches,
  emptyPaymentProofExtract,
  matchCollectionMethodFromHint,
  matchOrderFromAmount,
  parsePaymentProofExtractJson,
  runManualPaymentProofExtractor,
} from './payment-proof-extract';

describe('Phase 16 payment proof matching', () => {
  const customers = [
    { id: 'c1', shopName: 'Ramesh Traders', ownerName: 'Ramesh' },
  ];
  const orders = [
    {
      orderId: 'o1',
      shopId: 'c1',
      total: 25000,
      outstanding: 25000,
      status: 'DELIVERED',
      createdAtLabel: 'today',
      shortLabel: 'o1',
    },
    {
      orderId: 'o2',
      shopId: 'c1',
      total: 10000,
      outstanding: 10000,
      status: 'DELIVERED',
      createdAtLabel: 'yesterday',
      shortLabel: 'o2',
    },
  ];

  it('matches UPI/cash method hints', () => {
    expect(matchCollectionMethodFromHint('gpay')).toBe('UPI_ON_DELIVERY');
    expect(matchCollectionMethodFromHint('cash')).toBe('CASH_ON_DELIVERY');
  });

  it('matches order by exact outstanding amount', () => {
    expect(matchOrderFromAmount(orders, 25000).matchedOrderId).toBe('o1');
    expect(matchOrderFromAmount(orders, 25000).orderMatchConfidence).toBe(
      'exact',
    );
  });

  it('applies customer + amount matches', () => {
    const extract = emptyPaymentProofExtract();
    extract.senderHint = 'Ramesh';
    extract.amount = 25000;
    const matched = applyPaymentProofMatches(extract, customers, orders);
    expect(matched.matchedCustomerId).toBe('c1');
    expect(matched.matchedOrderId).toBe('o1');
    expect(matched.orderMatchConfidence).toBe('exact');
  });

  it('manual extractor returns empty labeled draft', async () => {
    const draft = await runManualPaymentProofExtractor({
      imageFileName: 'upi.png',
    });
    expect(draft.extractorLabel).toBe('manual');
    expect(draft.amount).toBeNull();
  });

  it('parses extract JSON safely', () => {
    const parsed = parsePaymentProofExtractJson({
      amount: '1200',
      senderHint: 'Shop',
      collectionMethod: 'UPI_ON_DELIVERY',
      extractorLabel: 'manual',
    });
    expect(parsed.amount).toBe(1200);
    expect(parsed.collectionMethod).toBe('UPI_ON_DELIVERY');
  });
});
