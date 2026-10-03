import { describe, expect, it } from 'vitest';
import { mapCompanyExpenseRow } from './company-expenses';
import { buildDayBookEntries } from './day-book';
import {
  aggregateProductSales,
  averageSaleValue,
  buildOwnerFinancialKpis,
  buildProfitLoss,
  executiveOpsKpisWithoutDuplicateSales,
  exportExpensesCsv,
  exportPayrollCsv,
  exportProductSalesCsv,
  exportReceivablesCsv,
  exportSalesmanPerformanceCsv,
  filterExpensesByDate,
  sumInventoryCogs,
  sumPaidPayroll,
  sumSalesTotal,
  summarizeDayBookByType,
  summarizePayrollRows,
  summarizeReceivableRows,
} from './financial-reports';
import { mapPayrollRow } from './salesman-payroll';
import { dateRangeForPreset } from './sales-fiscal';
import { buildReceivableRow } from './customer-ledger';
import { businessDateRangeInclusive } from './business-dates';

describe('Phase 3D financial reports', () => {
  it('builds gross profit from COGS and keeps cash separate', () => {
    const pl = buildProfitLoss({
      salesTotal: 500000,
      collectionsTotal: 400000,
      refundsTotal: 10000,
      expensesTotal: 20000,
      payrollPaidTotal: 30000,
      cogsTotal: 350000,
    });
    expect(pl.cogsTotal).toBe(350000);
    expect(pl.grossProfit).toBe(150000);
    expect(pl.grossMarginPercent).toBe(30);
    expect(pl.grossMarginLabel).toBe('30%');
    // Operating result = sales − COGS − expenses − payroll
    expect(pl.operatingResult).toBe(500000 - 350000 - 20000 - 30000);
    // Cash path still ignores COGS
    expect(pl.netCashMovement).toBe(400000 - 10000 - 20000 - 30000);
    expect(pl.disclaimer).toMatch(/Gross profit/i);
    expect(pl.disclaimer).toMatch(/COGS/i);
  });

  it('flags incomplete COGS when stock movements lacked unit cost', () => {
    const pl = buildProfitLoss({
      salesTotal: 10000,
      collectionsTotal: 7000,
      refundsTotal: 0,
      expensesTotal: 1000,
      payrollPaidTotal: 0,
      cogsTotal: 2000,
      cogsIncomplete: true,
    });
    expect(pl.cogsIncomplete).toBe(true);
    expect(pl.disclaimer).toMatch(/understated/i);
  });

  it('sums COGS from dispatch and return movements at stamped WAC', () => {
    const cogs = sumInventoryCogs([
      {
        movementType: 'ORDER_DISPATCH',
        quantityDelta: -10,
        unitCost: 100,
      },
      {
        movementType: 'ORDER_DISPATCH',
        quantityDelta: -5,
        unitCost: 120,
      },
      {
        movementType: 'RETURN',
        quantityDelta: 2,
        unitCost: 100,
      },
      {
        movementType: 'ADMIN_ADJUSTMENT',
        quantityDelta: -1,
        unitCost: 50,
      },
      {
        movementType: 'ORDER_DISPATCH',
        quantityDelta: -3,
        unitCost: null,
      },
    ]);
    expect(cogs.dispatchCost).toBe(1000 + 600);
    expect(cogs.returnCost).toBe(200);
    expect(cogs.cogsTotal).toBe(1400);
    expect(cogs.incompleteMovementCount).toBe(1);
  });

  it('keeps sales and collections separate in day book type summary', () => {
    const entries = buildDayBookEntries({
      orders: [
        {
          id: 'o1',
          status: 'DELIVERED',
          total: 5000,
          created_at: '2026-09-30T08:00:00.000Z',
          order_code: 'GA-1',
          shop_name: 'ABC',
        },
      ],
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'PAYMENT_PENDING',
          amount: 5000,
          cash_collected_amount: 2000,
          online_collected_amount: 0,
          paid_at: '2026-09-30T11:00:00.000Z',
          method_label: 'Cash',
        },
      ],
      expenses: [],
    });
    const byType = summarizeDayBookByType(entries);
    expect(byType.collectionsIn).toBe(2000);
    // Partial collection must not invent a second full sale cash-in equal to order total.
    expect(byType.salesIn).toBe(0);
  });

  it('counts paid payroll once and ignores unpaid payroll in cash out', () => {
    const paid = mapPayrollRow({
      id: '1',
      salesman_profile_id: 's1',
      salesman_name: 'A',
      payroll_month: '2026-09-01',
      earning_model: 'SALARY',
      base_salary: 10000,
      unpaid_leave_days: 0,
      unpaid_deduction: 0,
      earned_commission: 0,
      daily_allowance: 0,
      other_allowance: 0,
      adjustments: 0,
      total_amount: 10000,
      status: 'PAID',
      paid_at: '2026-10-01T00:00:00.000Z',
      payment_method: 'BANK',
      calculated_at: '2026-09-30T00:00:00.000Z',
    });
    const draft = mapPayrollRow({
      id: '2',
      salesman_profile_id: 's2',
      salesman_name: 'B',
      payroll_month: '2026-09-01',
      earning_model: 'SALARY',
      base_salary: 12000,
      unpaid_leave_days: 0,
      unpaid_deduction: 0,
      earned_commission: 0,
      daily_allowance: 0,
      other_allowance: 0,
      adjustments: 0,
      total_amount: 12000,
      status: 'DRAFT',
      calculated_at: '2026-09-30T00:00:00.000Z',
    });
    expect(sumPaidPayroll([paid, draft])).toBe(10000);

    const entries = buildDayBookEntries({
      orders: [],
      payments: [],
      expenses: [],
      paidPayroll: [
        {
          id: '1',
          salesmanId: 's1',
          salesmanName: 'A',
          payrollMonth: '2026-09-01',
          totalAmount: 10000,
          paidAt: '2026-10-01T00:00:00.000Z',
          paymentMethodLabel: 'Bank',
        },
      ],
    });
    expect(entries.filter((e) => e.type === 'payroll')).toHaveLength(1);
    expect(summarizeDayBookByType(entries).payrollOut).toBe(10000);
  });

  it('counts each company expense once in the filtered range', () => {
    const rows = [
      mapCompanyExpenseRow({
        id: 'e1',
        expense_date: '2026-09-15',
        category: 'TRANSPORT',
        amount: 800,
        description: 'Fuel',
        payment_method: 'CASH',
        created_at: '2026-09-15T10:00:00.000Z',
        updated_at: '2026-09-15T10:00:00.000Z',
      }),
      mapCompanyExpenseRow({
        id: 'e2',
        expense_date: '2026-08-01',
        category: 'RENT',
        amount: 5000,
        description: 'Rent',
        payment_method: 'BANK',
        created_at: '2026-08-01T10:00:00.000Z',
        updated_at: '2026-08-01T10:00:00.000Z',
      }),
    ];
    const filtered = filterExpensesByDate(rows, '2026-09-01', '2026-09-30');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.amount).toBe(800);
    expect(exportExpensesCsv(filtered)).toContain('Fuel');
    expect(exportExpensesCsv(filtered)).not.toContain('Rent');
  });

  it('excludes refunded sales from sales totals', () => {
    const total = sumSalesTotal([
      { id: '1', total: 1000, convertedAt: '2026-09-01', status: 'COMPLETED' },
      { id: '2', total: 5000, convertedAt: '2026-09-02', status: 'REFUNDED' },
    ]);
    expect(total).toBe(1000);
    expect(
      averageSaleValue([
        { id: '1', total: 1000, convertedAt: '2026-09-01' },
        { id: '2', total: 3000, convertedAt: '2026-09-02' },
      ]),
    ).toBe(2000);
  });

  it('aggregates product sales quantities from sale lines', () => {
    const rows = aggregateProductSales([
      {
        product_name: 'Oil',
        sku_code: 'OIL-1',
        quantity: 2,
        line_total: 400,
      },
      {
        product_name: 'Oil',
        sku_code: 'OIL-1',
        quantity: 3,
        line_total: 600,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity).toBe(5);
    expect(rows[0]?.salesValue).toBe(1000);
    expect(exportProductSalesCsv(rows)).toContain('Oil');
  });

  it('respects date presets including yesterday', () => {
    const asOf = new Date('2026-09-30T12:00:00');
    const today = dateRangeForPreset('today', undefined, asOf);
    const yesterday = dateRangeForPreset('yesterday', undefined, asOf);
    expect(today.label).toBe('Today');
    expect(yesterday.label).toBe('Yesterday');
    expect(yesterday.from?.getDate()).toBe(29);
    expect(yesterday.to?.getDate()).toBe(29);
  });

  it('builds owner KPIs without inventing duplicate metrics', () => {
    const kpis = buildOwnerFinancialKpis({
      todaySales: 1000,
      monthSales: 5000,
      collectionsToday: 800,
      outstanding: 2000,
      expensesMonth: 300,
      netCashToday: 500,
    });
    expect(kpis.map((k) => k.id)).toEqual([
      'today_sales',
      'month_sales',
      'collections_today',
      'outstanding',
      'expenses_month',
      'net_cash',
    ]);
    expect(kpis.find((k) => k.id === 'today_sales')?.value).toContain('1,000');
    expect(kpis.find((k) => k.id === 'month_sales')?.label).toBe(
      'Sales this month',
    );
  });

  it('drops duplicate Monthly Revenue from owner ops KPI strip', () => {
    const filtered = executiveOpsKpisWithoutDuplicateSales([
      { id: 'monthly_revenue', label: 'Monthly Revenue' },
      { id: 'pending_orders', label: 'Pending Orders' },
      { id: 'in_transit', label: 'In Transit' },
    ]);
    expect(filtered.map((k) => k.id)).toEqual([
      'pending_orders',
      'in_transit',
    ]);
  });

  it('exports salesman performance without inventing commission', () => {
    const csv = exportSalesmanPerformanceCsv([
      { salesman: 'Priya', orderCount: 2, revenue: 1500 },
    ]);
    expect(csv).toContain('Salesman,Orders,Revenue');
    expect(csv.toLowerCase()).not.toContain('commission');
    expect(csv).toContain('Priya');
  });

  it('summarizes outstanding KPIs from the filtered rows only', () => {
    const open = buildReceivableRow({
      customerId: 'c1',
      shopName: 'Open Shop',
      phoneLabel: '1',
      areaLabel: 'A',
      orders: [
        {
          id: 'o1',
          status: 'DELIVERED',
          total: 1000,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ],
      payments: [],
    });
    const paid = buildReceivableRow({
      customerId: 'c2',
      shopName: 'Paid Shop',
      phoneLabel: '2',
      areaLabel: 'B',
      orders: [
        {
          id: 'o2',
          status: 'DELIVERED',
          total: 500,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ],
      payments: [
        {
          id: 'p2',
          order_id: 'o2',
          status: 'PAID',
          amount: 500,
          cash_collected_amount: 500,
          online_collected_amount: 0,
          paid_at: '2026-09-02T00:00:00.000Z',
        },
      ],
    });
    const filtered = summarizeReceivableRows([open]);
    expect(filtered.customerCount).toBe(1);
    expect(filtered.totalOutstanding).toBe(1000);
    expect(filtered.totalSales).toBe(1000);
    expect(summarizeReceivableRows([open, paid]).customerCount).toBe(2);
  });

  it('summarizes payroll KPIs from status-filtered rows', () => {
    const paid = mapPayrollRow({
      id: 'p1',
      salesman_profile_id: 's1',
      salesman_name: 'A',
      payroll_month: '2026-09-01',
      earning_model: 'SALARY',
      base_salary: 10000,
      unpaid_leave_days: 0,
      unpaid_deduction: 0,
      earned_commission: 0,
      daily_allowance: 0,
      other_allowance: 0,
      adjustments: 0,
      total_amount: 10000,
      status: 'PAID',
      paid_at: '2026-10-01T00:00:00.000Z',
      payment_method: 'UPI',
      calculated_at: '2026-09-30T00:00:00.000Z',
    });
    const draft = mapPayrollRow({
      id: 'p2',
      salesman_profile_id: 's2',
      salesman_name: 'B',
      payroll_month: '2026-09-01',
      earning_model: 'SALARY',
      base_salary: 8000,
      unpaid_leave_days: 0,
      unpaid_deduction: 0,
      earned_commission: 0,
      daily_allowance: 0,
      other_allowance: 0,
      adjustments: 0,
      total_amount: 8000,
      status: 'DRAFT',
      paid_at: null,
      payment_method: null,
      calculated_at: '2026-09-30T00:00:00.000Z',
    });
    const paidOnly = summarizePayrollRows([paid]);
    expect(paidOnly.totalPayroll).toBe(10000);
    expect(paidOnly.paidTotal).toBe(10000);
    expect(paidOnly.pendingTotal).toBe(0);
    const draftOnly = summarizePayrollRows([draft]);
    expect(draftOnly.totalPayroll).toBe(8000);
    expect(draftOnly.paidTotal).toBe(0);
    expect(draftOnly.pendingTotal).toBe(8000);
  });

  it('uses the same IST window for P&L and Day Book date selection', () => {
    const range = businessDateRangeInclusive('2026-10-01', '2026-10-01');
    expect(range.fromIso).toBe('2026-10-01T00:00:00+05:30');
    expect(range.toIsoExclusive).toBe('2026-10-02T00:00:00+05:30');
    expect(range.toIsoInclusive).toBe('2026-10-01T23:59:59.999+05:30');
  });

  it('exports payroll and receivables with filter-sensitive rows only', () => {
    const payroll = mapPayrollRow({
      id: 'p1',
      salesman_profile_id: 's1',
      salesman_name: 'Ravi',
      payroll_month: '2026-09-01',
      earning_model: 'SALARY',
      base_salary: 20000,
      unpaid_leave_days: 0,
      unpaid_deduction: 0,
      earned_commission: 0,
      daily_allowance: 0,
      other_allowance: 0,
      adjustments: 0,
      total_amount: 20000,
      status: 'PAID',
      paid_at: '2026-10-01T00:00:00.000Z',
      payment_method: 'UPI',
      calculated_at: '2026-09-30T00:00:00.000Z',
    });
    expect(exportPayrollCsv([payroll])).toContain('Ravi');
    expect(exportPayrollCsv([payroll])).toContain('Paid');

    expect(
      exportReceivablesCsv([
        {
          customerId: 'c1',
          shopName: 'Shop A',
          phoneLabel: '999',
          areaLabel: 'North',
          totalSales: 1000,
          totalSalesLabel: '₹1,000',
          totalPaid: 400,
          totalPaidLabel: '₹400',
          outstanding: 600,
          outstandingLabel: '₹600',
          lastPaymentAtLabel: '1 Oct 2026',
          oldestOpenDays: 45,
          ageingBucket: 'days_31_60',
          ageingLabel: '31–60 days',
          ledgerHref: '/customers/c1',
          collectHref: null,
        },
      ]),
    ).toContain('Shop A');
    expect(
      exportReceivablesCsv([
        {
          customerId: 'c1',
          shopName: 'Shop A',
          phoneLabel: '999',
          areaLabel: 'North',
          totalSales: 1000,
          totalSalesLabel: '₹1,000',
          totalPaid: 400,
          totalPaidLabel: '₹400',
          outstanding: 600,
          outstandingLabel: '₹600',
          lastPaymentAtLabel: '1 Oct 2026',
          oldestOpenDays: 45,
          ageingBucket: 'days_31_60',
          ageingLabel: '31–60 days',
          ledgerHref: '/customers/c1',
          collectHref: null,
        },
      ]),
    ).toContain('31–60 days');
  });

  it('treats empty datasets as zero totals', () => {
    expect(sumSalesTotal([])).toBe(0);
    expect(sumPaidPayroll([])).toBe(0);
    expect(aggregateProductSales([])).toEqual([]);
    const emptyPl = buildProfitLoss({
      salesTotal: 0,
      collectionsTotal: 0,
      refundsTotal: 0,
      expensesTotal: 0,
      payrollPaidTotal: 0,
    });
    expect(emptyPl.operatingResult).toBe(0);
    expect(emptyPl.cogsTotal).toBe(0);
    expect(emptyPl.grossProfit).toBe(0);
    expect(emptyPl.grossMarginPercent).toBeNull();
  });
});
