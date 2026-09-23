import { describe, expect, it } from 'vitest';
import {
  buildRevenueByDayFromSales,
  buildSalesReportKpis,
  buildSalesmanLeaderboardFromSales,
  buildTopProductsFromSaleItems,
} from './reports-sales-map';

describe('Sales H2 reports from sales records', () => {
  it('computes KPIs from sales and sales_payments, not inventing order totals', () => {
    const kpis = buildSalesReportKpis({
      sales: [
        {
          id: 's1',
          order_id: 'o1',
          total: 1000,
          converted_at: '2026-08-20T10:00:00.000Z',
        },
        {
          id: 's2',
          order_id: 'o2',
          total: 500,
          converted_at: '2026-08-21T10:00:00.000Z',
        },
      ],
      payments: [
        { sale_id: 's1', status: 'PAID', amount: 1000 },
        { sale_id: 's2', status: 'PAID', amount: 500 },
      ],
    });

    expect(kpis.find((k) => k.id === 'invoiced_revenue')?.value).toContain('1,500');
    expect(kpis.find((k) => k.id === 'converted_sales')?.value).toBe('2');
    expect(kpis.find((k) => k.id === 'avg_sale')?.value).toContain('750');
    expect(kpis.find((k) => k.id === 'collected')?.value).toContain('1,500');
  });

  it('returns zero KPIs when there are no sales', () => {
    const kpis = buildSalesReportKpis({ sales: [], payments: [] });
    expect(kpis.find((k) => k.id === 'converted_sales')?.value).toBe('0');
    expect(kpis.find((k) => k.id === 'invoiced_revenue')?.value).toContain('0');
  });

  it('aggregates top products from sale_items', () => {
    const { rows, columns } = buildTopProductsFromSaleItems([
      {
        sale_id: 's1',
        product_name: 'Cashew',
        sku_code: 'CAS-1',
        quantity: 2,
        line_total: 400,
      },
      {
        sale_id: 's2',
        product_name: 'Cashew',
        sku_code: 'CAS-1',
        quantity: 1,
        line_total: 200,
      },
      {
        sale_id: 's2',
        product_name: 'Almond',
        sku_code: 'ALM-1',
        quantity: 5,
        line_total: 1000,
      },
    ]);

    expect(columns).toEqual(['Product', 'SKU', 'Qty', 'Revenue']);
    expect(rows[0].cells[0]).toBe('Almond');
    expect(rows[0].cells[2]).toBe('5');
    expect(rows[1].cells[0]).toBe('Cashew');
    expect(rows[1].cells[2]).toBe('3');
  });

  it('builds salesman leaderboard from sales linked to order creators', () => {
    const { rows } = buildSalesmanLeaderboardFromSales({
      sales: [
        {
          id: 's1',
          order_id: 'o1',
          total: 800,
          converted_at: '2026-08-20T10:00:00.000Z',
        },
        {
          id: 's2',
          order_id: 'o2',
          total: 200,
          converted_at: '2026-08-21T10:00:00.000Z',
        },
      ],
      orderSalesmanByOrderId: new Map([
        ['o1', 'Priya'],
        ['o2', 'Rahul'],
      ]),
    });

    expect(rows[0].cells).toEqual(['Priya', '1', expect.stringContaining('800')]);
    expect(rows[1].cells[0]).toBe('Rahul');
  });

  it('buckets revenue by local day for the last N days', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const series = buildRevenueByDayFromSales(
      [
        {
          id: 's1',
          order_id: 'o1',
          total: 250,
          converted_at: today.toISOString(),
        },
      ],
      3,
    );
    expect(series).toHaveLength(3);
    expect(series[2].value).toBe(250);
  });
});
