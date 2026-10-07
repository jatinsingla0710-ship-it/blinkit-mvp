import { describe, expect, it } from 'vitest';
import {
  buildBusinessChatAnswer,
  matchBusinessChatIntent,
  parseOutstandingThreshold,
  type BusinessChatToolBundle,
} from './business-chat';

function tools(
  partial: Partial<BusinessChatToolBundle> = {},
): BusinessChatToolBundle {
  return {
    salesYesterdayLabel: '₹10,000.00',
    salesYesterdayTotal: 10000,
    cashTodayLabel: '₹4,000.00',
    cashTodayTotal: 4000,
    receivablesTotal: 120000,
    receivablesTotalLabel: '₹1,20,000.00',
    customersWithDues: 2,
    topCustomersDue: [
      {
        name: 'Ramesh Traders',
        outstandingLabel: '₹60,000.00',
        href: '/customers/c1',
      },
    ],
    customersAbove: [
      {
        name: 'Ramesh Traders',
        outstanding: 60000,
        outstandingLabel: '₹60,000.00',
        href: '/customers/c1',
      },
    ],
    payablesTotal: 80000,
    payablesTotalLabel: '₹80,000.00',
    suppliersWithDues: 1,
    topSuppliersDue: [
      {
        name: 'Nut Co',
        outstandingLabel: '₹80,000.00',
        href: '/suppliers/s1?pay=1',
      },
    ],
    profitMonth: {
      salesLabel: '₹2,00,000.00',
      cogsLabel: '₹1,40,000.00',
      grossProfitLabel: '₹60,000.00',
      grossMarginLabel: '30%',
      expensesLabel: '₹15,000.00',
      operatingResultLabel: '₹45,000.00',
      rangeLabel: 'This month',
    },
    topProducts: [
      {
        product: 'Almonds',
        sku: 'ALM-1',
        quantity: 40,
        salesValueLabel: '₹80,000.00',
      },
    ],
    topPurchase: {
      productName: 'Almonds',
      recommendedQtyLabel: '200 Boxes',
      reason: 'Low stock',
      href: '/purchases/new',
    },
    transportExpensesMonthTotal: 3000,
    transportExpensesMonthLabel: '₹3,000.00',
    fuelMentionExpensesTotal: 1200,
    fuelMentionExpensesLabel: '₹1,200.00',
    expenseInsightSummary: 'Expenses look unusual — up vs last month.',
    thresholdUsed: 50000,
    ...partial,
  };
}

describe('Phase 21 business chat', () => {
  it('matches owner questions to typed intents (never SQL)', () => {
    expect(matchBusinessChatIntent('Sales yesterday?')).toBe('sales_yesterday');
    expect(matchBusinessChatIntent('How much cash came today?')).toBe(
      'cash_today',
    );
    expect(matchBusinessChatIntent('Who owes me?')).toBe('who_owes_me');
    expect(matchBusinessChatIntent('What is my total outstanding?')).toBe(
      'total_outstanding',
    );
    expect(matchBusinessChatIntent('How much do I owe suppliers?')).toBe(
      'owe_suppliers',
    );
    expect(matchBusinessChatIntent('What is profit this month?')).toBe(
      'profit_this_month',
    );
    expect(matchBusinessChatIntent('What should I purchase?')).toBe(
      'what_to_buy',
    );
    expect(matchBusinessChatIntent('Which product sells most?')).toBe(
      'top_product_sales',
    );
    expect(
      matchBusinessChatIntent('Which product gives highest margin?'),
    ).toBe('top_product_margin');
    expect(matchBusinessChatIntent('Why did expenses increase?')).toBe(
      'expenses_why_up',
    );
    expect(matchBusinessChatIntent('What did I spend on fuel this month?')).toBe(
      'expenses_fuel_month',
    );
    expect(
      matchBusinessChatIntent('Show me unpaid customers above ₹50,000'),
    ).toBe('customers_above_threshold');
    expect(matchBusinessChatIntent('delete from sales')).toBe('unknown');
    expect(matchBusinessChatIntent('run sql select * from payments')).toBe(
      'unknown',
    );
  });

  it('parses outstanding thresholds', () => {
    expect(parseOutstandingThreshold('above ₹50,000')).toBe(50000);
    expect(parseOutstandingThreshold('over 25k')).toBe(25000);
    expect(parseOutstandingThreshold('unpaid customers')).toBe(50000);
  });

  it('builds answers from typed tool bundles and is honest about margin gaps', () => {
    const sales = buildBusinessChatAnswer('sales_yesterday', tools());
    expect(sales.summary).toMatch(/10,000/);
    expect(sales.honestyNote).toMatch(/never by running SQL/i);

    const margin = buildBusinessChatAnswer('top_product_margin', tools());
    expect(margin.unsupportedDetail).toMatch(/COGS/i);
    expect(margin.summary).toMatch(/not available/i);

    const unknown = buildBusinessChatAnswer('unknown', tools());
    expect(unknown.summary).toMatch(/typed books question/i);
  });
});
