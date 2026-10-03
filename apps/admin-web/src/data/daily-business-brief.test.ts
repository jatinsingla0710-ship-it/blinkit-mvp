import { describe, expect, it } from 'vitest';
import { buildProfitLoss } from './financial-reports';
import {
  briefGreeting,
  buildDailyBusinessBriefSnapshot,
  DEFAULT_DAILY_BRIEF_CONFIG,
} from './daily-business-brief';

describe('Phase 20 daily business brief', () => {
  it('greets by hour', () => {
    expect(briefGreeting(8)).toBe('Good morning');
    expect(briefGreeting(14)).toBe('Good afternoon');
    expect(briefGreeting(20)).toBe('Good evening');
  });

  it('builds yesterday metrics, attention, and ranked recommendations', () => {
    const pl = buildProfitLoss({
      salesTotal: 50000,
      collectionsTotal: 40000,
      refundsTotal: 0,
      expensesTotal: 5000,
      payrollPaidTotal: 0,
      cogsTotal: 30000,
    });

    const snapshot = buildDailyBusinessBriefSnapshot({
      generatedAtIso: '2026-10-03T04:30:00.000Z',
      hour: 10,
      yesterdayDateLabel: '2 Oct 2026',
      profitLossYesterday: pl,
      yesterdayRangeLabel: 'Yesterday',
      customersWithDues: 5,
      staleCustomers: 2,
      suppliersWithDues: 3,
      lowStockCount: 4,
      outOfStockCount: 1,
      draftPurchaseCount: 1,
      billScansPendingCount: 1,
      customers: [
        {
          customerId: 'c1',
          shopName: 'Ramesh Traders',
          outstanding: 12000,
          outstandingLabel: '₹12,000.00',
          oldestOpenDays: 70,
          ageingBucket: 'days_61_plus',
          ledgerHref: '/customers/c1',
        },
      ],
      suppliers: [
        {
          supplierId: 's1',
          supplierName: 'Nut Co',
          outstanding: 8000,
          outstandingLabel: '₹8,000.00',
          payHref: '/suppliers/s1?pay=1',
        },
      ],
      topPurchase: {
        productName: 'Almonds',
        recommendedQtyLabel: '200 Boxes',
        purchaseHref: '/purchases/new?supplierId=s1',
      },
      unusualExpenseNote: 'Expenses up sharply vs last month',
    });

    expect(snapshot.greeting).toBe('Good morning');
    expect(snapshot.honestyNote).toMatch(/not an AI-written story/i);
    expect(snapshot.yesterday?.salesTotalLabel).toContain('50,000');
    expect(snapshot.attention.map((a) => a.id)).toContain('stale-customers');
    expect(snapshot.attention.map((a) => a.id)).toContain('bill-scans');
    expect(snapshot.recommendations[0]?.title).toMatch(/Almonds/i);
    expect(
      snapshot.recommendations.some((r) =>
        r.title.includes('Ramesh Traders'),
      ),
    ).toBe(true);
    expect(
      snapshot.recommendations.some((r) => r.id === 'review-expense'),
    ).toBe(true);
  });

  it('honors configurable section toggles', () => {
    const snapshot = buildDailyBusinessBriefSnapshot({
      generatedAtIso: '2026-10-03T04:30:00.000Z',
      hour: 10,
      yesterdayDateLabel: '2 Oct 2026',
      profitLossYesterday: buildProfitLoss({
        salesTotal: 1,
        collectionsTotal: 1,
        refundsTotal: 0,
        expensesTotal: 0,
        payrollPaidTotal: 0,
        cogsTotal: 0,
      }),
      yesterdayRangeLabel: 'Yesterday',
      customersWithDues: 2,
      staleCustomers: 0,
      suppliersWithDues: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      draftPurchaseCount: 0,
      billScansPendingCount: 0,
      customers: [],
      suppliers: [],
      topPurchase: null,
      unusualExpenseNote: null,
      config: {
        ...DEFAULT_DAILY_BRIEF_CONFIG,
        sections: ['attention'],
      },
    });
    expect(snapshot.yesterday).toBeNull();
    expect(snapshot.recommendations).toEqual([]);
    expect(snapshot.attention.length).toBeGreaterThan(0);
  });
});
