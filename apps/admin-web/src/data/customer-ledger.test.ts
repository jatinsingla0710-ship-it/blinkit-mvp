import { describe, expect, it } from 'vitest';
import {
  buildCustomerLedger,
  buildReceivableRow,
  buildReceivablesSnapshot,
  customerOutstandingTotal,
  exportCustomerStatementCsv,
  filterReceivableRows,
  orderOutstandingResidual,
  paymentCollectedAmount,
} from './customer-ledger';

describe('customer ledger residual', () => {
  it('returns full total when there is no payment row', () => {
    expect(
      orderOutstandingResidual({ status: 'DELIVERED', total: 5000 }, null),
    ).toBe(5000);
  });

  it('returns 0 for PAID and REFUNDED payments', () => {
    expect(
      orderOutstandingResidual(
        { status: 'DELIVERED', total: 5000 },
        { status: 'PAID', cash_collected_amount: 0, online_collected_amount: 0 },
      ),
    ).toBe(0);
    expect(
      orderOutstandingResidual(
        { status: 'DELIVERED', total: 5000 },
        { status: 'REFUNDED', cash_collected_amount: 5000 },
      ),
    ).toBe(0);
  });

  it('computes residual after partial cash/online', () => {
    expect(
      orderOutstandingResidual(
        { status: 'OUT_FOR_DELIVERY', total: 5000 },
        {
          status: 'PAYMENT_PENDING',
          cash_collected_amount: 2000,
          online_collected_amount: 500,
        },
      ),
    ).toBe(2500);
  });

  it('excludes cancelled orders', () => {
    expect(
      orderOutstandingResidual({ status: 'CANCELLED', total: 5000 }, null),
    ).toBe(0);
  });

  it('does not treat unpaid payment.amount as collected', () => {
    expect(
      paymentCollectedAmount({
        status: 'UNPAID',
        amount: 5000,
        cash_collected_amount: 0,
        online_collected_amount: 0,
      }),
    ).toBe(0);
    expect(
      paymentCollectedAmount({
        status: 'PAID',
        amount: 5000,
        cash_collected_amount: 0,
        online_collected_amount: 0,
      }),
    ).toBe(5000);
  });
});

describe('customer ledger build', () => {
  const orders = [
    {
      id: 'o1',
      status: 'DELIVERED',
      total: 5000,
      created_at: '2026-07-01T10:00:00.000Z',
      order_code: 'GA-1',
    },
    {
      id: 'o2',
      status: 'DELIVERED',
      total: 3000,
      created_at: '2026-07-05T10:00:00.000Z',
      order_code: 'GA-2',
    },
    {
      id: 'o3',
      status: 'CANCELLED',
      total: 9000,
      created_at: '2026-07-06T10:00:00.000Z',
      order_code: 'GA-3',
    },
  ];

  it('builds chronological balance for unpaid then partial then paid', () => {
    const unpaid = buildCustomerLedger({ orders: [orders[0]!], payments: [] });
    expect(unpaid.outstanding).toBe(5000);
    expect(unpaid.entries).toHaveLength(1);
    expect(unpaid.entries[0]?.type).toBe('sale');
    expect(unpaid.entries[0]?.balance).toBe(5000);
    expect(unpaid.collectHref).toBe('/orders/o1');

    const partial = buildCustomerLedger({
      orders: [orders[0]!],
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'PAYMENT_PENDING',
          amount: 5000,
          cash_collected_amount: 2000,
          online_collected_amount: 0,
          paid_at: '2026-07-02T10:00:00.000Z',
        },
      ],
    });
    expect(partial.outstanding).toBe(3000);
    expect(partial.totalPaid).toBe(2000);
    expect(partial.entries.map((e) => e.type)).toEqual(['payment', 'sale']);
    expect(partial.entries[0]?.balance).toBe(3000);

    const paid = buildCustomerLedger({
      orders: [orders[0]!],
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'PAID',
          amount: 5000,
          cash_collected_amount: 5000,
          online_collected_amount: 0,
          paid_at: '2026-07-03T10:00:00.000Z',
        },
      ],
    });
    expect(paid.outstanding).toBe(0);
    expect(paid.collectHref).toBeNull();
  });

  it('handles multiple sales and payments and ignores cancelled', () => {
    const ledger = buildCustomerLedger({
      orders,
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'PAID',
          amount: 5000,
          cash_collected_amount: 5000,
          created_at: '2026-07-02T10:00:00.000Z',
        },
        {
          id: 'p2',
          order_id: 'o2',
          status: 'PAYMENT_PENDING',
          amount: 3000,
          cash_collected_amount: 1000,
          created_at: '2026-07-06T10:00:00.000Z',
        },
      ],
    });
    expect(ledger.totalSales).toBe(8000);
    expect(ledger.totalPaid).toBe(6000);
    expect(ledger.outstanding).toBe(2000);
    expect(ledger.entries.some((e) => e.reference === 'GA-3')).toBe(false);
  });

  it('customerOutstandingTotal matches ledger outstanding', () => {
    const payments = [
      {
        id: 'p2',
        order_id: 'o2',
        status: 'UNPAID',
        amount: 3000,
        cash_collected_amount: 0,
      },
    ];
    expect(customerOutstandingTotal(orders, payments)).toBe(8000);
  });
});

describe('receivables', () => {
  it('aggregates who owes money and filters paid/outstanding', () => {
    const snapshot = buildReceivablesSnapshot({
      generatedAtIso: '2026-07-10T12:00:00.000Z',
      customers: [
        {
          customerId: 'c1',
          shopName: 'Alpha Mart',
          phoneLabel: '9000000001',
          areaLabel: 'North',
          orders: [
            {
              id: 'o1',
              status: 'DELIVERED',
              total: 1000,
              created_at: '2026-07-01T10:00:00.000Z',
            },
          ],
          payments: [],
        },
        {
          customerId: 'c2',
          shopName: 'Beta Store',
          phoneLabel: '9000000002',
          areaLabel: 'South',
          orders: [
            {
              id: 'o2',
              status: 'DELIVERED',
              total: 2000,
              created_at: '2026-07-01T10:00:00.000Z',
            },
          ],
          payments: [
            {
              id: 'p2',
              order_id: 'o2',
              status: 'PAID',
              amount: 2000,
              cash_collected_amount: 2000,
              paid_at: '2026-07-02T10:00:00.000Z',
            },
          ],
        },
        {
          customerId: 'c3',
          shopName: 'Empty Shop',
          phoneLabel: '9000000003',
          areaLabel: 'East',
          orders: [],
          payments: [],
        },
      ],
    });

    expect(snapshot.rows.map((r) => r.customerId)).toEqual(['c1', 'c2']);
    expect(snapshot.totalOutstanding).toBe(1000);

    const outstandingOnly = filterReceivableRows(
      snapshot.rows,
      '',
      'outstanding',
    );
    expect(outstandingOnly).toHaveLength(1);
    expect(outstandingOnly[0]?.customerId).toBe('c1');

    const paidOnly = filterReceivableRows(snapshot.rows, '', 'paid');
    expect(paidOnly).toHaveLength(1);
    expect(paidOnly[0]?.customerId).toBe('c2');

    const search = filterReceivableRows(snapshot.rows, 'beta', 'all');
    expect(search).toHaveLength(1);
  });

  it('links ledger and collect actions', () => {
    const row = buildReceivableRow({
      customerId: 'c1',
      shopName: 'Shop',
      phoneLabel: '1',
      areaLabel: 'A',
      orders: [
        {
          id: 'o9',
          status: 'DELIVERED',
          total: 100,
          created_at: '2026-07-01T10:00:00.000Z',
        },
      ],
      payments: [],
      asOfIso: '2026-10-01T10:00:00.000Z',
    });
    expect(row.ledgerHref).toBe('/customers/c1#ledger');
    expect(row.collectHref).toBe('/orders/o9');
    expect(row.oldestOpenDays).toBe(92);
    expect(row.ageingBucket).toBe('days_61_plus');
  });

  it('exports a chronological customer statement CSV', () => {
    const ledger = buildCustomerLedger({
      orders: [
        {
          id: 'o1',
          status: 'DELIVERED',
          total: 500,
          created_at: '2026-09-01T10:00:00.000Z',
          order_code: 'GA-1',
        },
      ],
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'PAYMENT_PENDING',
          amount: 500,
          cash_collected_amount: 200,
          online_collected_amount: 0,
          paid_at: '2026-09-10T10:00:00.000Z',
        },
      ],
    });
    const csv = exportCustomerStatementCsv({
      shopName: 'Alpha Mart',
      phoneLabel: '999',
      generatedAtIso: '2026-10-01T00:00:00.000Z',
      ledger,
    });
    expect(csv).toContain('Customer,Alpha Mart');
    expect(csv).toContain('Outstanding,300');
    expect(csv.indexOf('Sale')).toBeLessThan(csv.indexOf('Payment'));
  });
});
