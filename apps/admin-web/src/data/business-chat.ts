/**
 * Phase 21 — Business chat (Ask your books).
 * Maps owner questions to typed intents + LiveAdminApi tools.
 * Never generates or runs SQL from prompts. Not an LLM.
 */

import { formatInr } from '@/data/live/format';

const HONESTY_NOTE =
  'Answered with typed books tools and ranking rules — not freeform AI, and never by running SQL from your question.';

export type BusinessChatIntentId =
  | 'sales_yesterday'
  | 'cash_today'
  | 'who_owes_me'
  | 'total_outstanding'
  | 'expenses_fuel_month'
  | 'expenses_why_up'
  | 'top_product_sales'
  | 'top_product_margin'
  | 'what_to_buy'
  | 'owe_suppliers'
  | 'profit_this_month'
  | 'customers_above_threshold'
  | 'unknown';

export type BusinessChatPreset = {
  id: BusinessChatIntentId;
  label: string;
  example: string;
};

export const BUSINESS_CHAT_PRESETS: readonly BusinessChatPreset[] = [
  {
    id: 'sales_yesterday',
    label: 'Sales yesterday?',
    example: 'Sales yesterday?',
  },
  {
    id: 'cash_today',
    label: 'Cash in today?',
    example: 'How much cash came today?',
  },
  {
    id: 'who_owes_me',
    label: 'Who owes me?',
    example: 'Who owes me?',
  },
  {
    id: 'total_outstanding',
    label: 'Total outstanding?',
    example: 'What is my total outstanding?',
  },
  {
    id: 'owe_suppliers',
    label: 'Owe suppliers?',
    example: 'How much do I owe suppliers?',
  },
  {
    id: 'profit_this_month',
    label: 'Profit this month?',
    example: 'What is profit this month?',
  },
  {
    id: 'what_to_buy',
    label: 'What to purchase?',
    example: 'What should I purchase?',
  },
  {
    id: 'top_product_sales',
    label: 'Top selling product?',
    example: 'Which product sells most?',
  },
  {
    id: 'customers_above_threshold',
    label: 'Big unpaid customers?',
    example: 'Show unpaid customers above ₹50,000',
  },
  {
    id: 'expenses_why_up',
    label: 'Why expenses up?',
    example: 'Why did expenses increase?',
  },
] as const;

export type BusinessChatAnswerLine = {
  label: string;
  value: string;
};

export type BusinessChatLink = {
  label: string;
  href: string;
};

export type BusinessChatAnswer = {
  intentId: BusinessChatIntentId;
  matchedLabel: string;
  summary: string;
  lines: BusinessChatAnswerLine[];
  links: BusinessChatLink[];
  honestyNote: string;
  unsupportedDetail: string | null;
};

function moneyLabel(n: number): string {
  return formatInr(Math.round((Number(n) || 0) * 100) / 100);
}

function normalizeQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[?!.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse “above 50000” / “above ₹50,000” / “over 50k” — default 50000. */
export function parseOutstandingThreshold(query: string): number {
  const q = normalizeQuery(query);
  const match =
    q.match(/(?:above|over|more than|>)\s*₹?\s*([\d,]+)\s*k\b/) ||
    q.match(/(?:above|over|more than|>)\s*₹?\s*([\d,]+)/);
  if (!match?.[1]) return 50000;
  const raw = match[1].replace(/,/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 50000;
  if (/\d+\s*k\b/.test(q) || /k\b/.test(match[0])) return Math.round(n * 1000);
  return Math.round(n);
}

/**
 * Map free-text (or preset id) to a typed intent.
 * Conservative: unknown when no clear match — never invent SQL.
 */
export function matchBusinessChatIntent(
  query: string,
): BusinessChatIntentId {
  const q = normalizeQuery(query);
  if (!q) return 'unknown';

  // Exact preset labels / examples first
  for (const preset of BUSINESS_CHAT_PRESETS) {
    if (
      normalizeQuery(preset.label) === q ||
      normalizeQuery(preset.example) === q
    ) {
      return preset.id;
    }
  }

  if (
    (q.includes('margin') || q.includes('highest profit product')) &&
    (q.includes('product') || q.includes('sku') || q.includes('item'))
  ) {
    return 'top_product_margin';
  }
  if (
    (q.includes('sell') || q.includes('sold') || q.includes('top product')) &&
    (q.includes('product') || q.includes('most') || q.includes('best'))
  ) {
    return 'top_product_sales';
  }
  if (
    q.includes('purchase') ||
    q.includes('what to buy') ||
    q.includes('should i buy') ||
    q.includes('reorder')
  ) {
    return 'what_to_buy';
  }
  if (
    (q.includes('fuel') || q.includes('petrol') || q.includes('diesel')) &&
    (q.includes('spend') || q.includes('expense') || q.includes('spent'))
  ) {
    return 'expenses_fuel_month';
  }
  if (
    q.includes('expense') &&
    (q.includes('why') || q.includes('increase') || q.includes('up') || q.includes('rose'))
  ) {
    return 'expenses_why_up';
  }
  if (
    (q.includes('unpaid') || q.includes('due') || q.includes('owe')) &&
    (q.includes('customer') || q.includes('above') || q.includes('over')) &&
    (q.includes('above') || q.includes('over') || q.includes('50') || q.includes('₹'))
  ) {
    return 'customers_above_threshold';
  }
  if (
    q.includes('owe') &&
    (q.includes('supplier') || q.includes('payable') || q.includes('vendor'))
  ) {
    return 'owe_suppliers';
  }
  if (
    q.includes('who owes') ||
    (q.includes('owe') && q.includes('me')) ||
    q.includes('money due') ||
    q.includes('receivable')
  ) {
    return 'who_owes_me';
  }
  if (
    q.includes('total outstanding') ||
    (q.includes('outstanding') && !q.includes('supplier'))
  ) {
    return 'total_outstanding';
  }
  if (
    q.includes('profit') &&
    (q.includes('month') || q.includes('this month') || q.length < 40)
  ) {
    return 'profit_this_month';
  }
  if (
    q.includes('sales') &&
    (q.includes('yesterday') || q.includes('yester day'))
  ) {
    return 'sales_yesterday';
  }
  if (
    (q.includes('cash') || q.includes('collected') || q.includes('collection')) &&
    (q.includes('today') || q.includes('came'))
  ) {
    return 'cash_today';
  }

  return 'unknown';
}

export type BusinessChatToolBundle = {
  salesYesterdayLabel: string;
  salesYesterdayTotal: number;
  cashTodayLabel: string;
  cashTodayTotal: number;
  receivablesTotal: number;
  receivablesTotalLabel: string;
  customersWithDues: number;
  topCustomersDue: {
    name: string;
    outstandingLabel: string;
    href: string;
  }[];
  customersAbove: {
    name: string;
    outstanding: number;
    outstandingLabel: string;
    href: string;
  }[];
  payablesTotal: number;
  payablesTotalLabel: string;
  suppliersWithDues: number;
  topSuppliersDue: {
    name: string;
    outstandingLabel: string;
    href: string;
  }[];
  profitMonth: {
    salesLabel: string;
    cogsLabel: string;
    grossProfitLabel: string;
    grossMarginLabel: string;
    expensesLabel: string;
    operatingResultLabel: string;
    rangeLabel: string;
  };
  topProducts: { product: string; sku: string; quantity: number; salesValueLabel: string }[];
  topPurchase: {
    productName: string;
    recommendedQtyLabel: string;
    reason: string;
    href: string;
  } | null;
  transportExpensesMonthTotal: number;
  transportExpensesMonthLabel: string;
  fuelMentionExpensesTotal: number;
  fuelMentionExpensesLabel: string;
  expenseInsightSummary: string | null;
  thresholdUsed: number;
};

function intentLabel(id: BusinessChatIntentId): string {
  const preset = BUSINESS_CHAT_PRESETS.find((p) => p.id === id);
  if (preset) return preset.label;
  if (id === 'top_product_margin') return 'Highest margin product?';
  if (id === 'expenses_fuel_month') return 'Fuel / transport spend this month?';
  return 'Ask your books';
}

export function buildBusinessChatAnswer(
  intentId: BusinessChatIntentId,
  tools: BusinessChatToolBundle,
): BusinessChatAnswer {
  const matchedLabel = intentLabel(intentId);

  switch (intentId) {
    case 'sales_yesterday':
      return {
        intentId,
        matchedLabel,
        summary: `Yesterday’s sales: ${tools.salesYesterdayLabel}.`,
        lines: [
          { label: 'Sales yesterday', value: tools.salesYesterdayLabel },
        ],
        links: [
          { label: 'Sales report', href: '/reports/sales' },
          { label: 'Profit & Loss', href: '/reports/profit-loss' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'cash_today':
      return {
        intentId,
        matchedLabel,
        summary: `Money in today (collections + sales in Day Book): ${tools.cashTodayLabel}.`,
        lines: [{ label: 'Cash / collections today', value: tools.cashTodayLabel }],
        links: [
          { label: 'Day Book', href: '/day-book' },
          { label: 'Collections', href: '/payments' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'who_owes_me':
      return {
        intentId,
        matchedLabel,
        summary:
          tools.customersWithDues === 0
            ? 'No customers have open balances right now.'
            : `${tools.customersWithDues} customer${tools.customersWithDues === 1 ? '' : 's'} owe you ${tools.receivablesTotalLabel} total.`,
        lines: [
          { label: 'Total money due', value: tools.receivablesTotalLabel },
          { label: 'Customers with dues', value: String(tools.customersWithDues) },
          ...tools.topCustomersDue.slice(0, 5).map((c) => ({
            label: c.name,
            value: c.outstandingLabel,
          })),
        ],
        links: [
          { label: 'Dues assistant', href: '/dues' },
          { label: 'Money Due', href: '/receivables' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'total_outstanding':
      return {
        intentId,
        matchedLabel,
        summary: `Customer outstanding (Money Due): ${tools.receivablesTotalLabel}.`,
        lines: [
          { label: 'Customer outstanding', value: tools.receivablesTotalLabel },
          {
            label: 'Supplier to pay (separate)',
            value: tools.payablesTotalLabel,
          },
        ],
        links: [
          { label: 'Money Due', href: '/receivables' },
          { label: 'Money to Pay', href: '/payables' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'owe_suppliers':
      return {
        intentId,
        matchedLabel,
        summary:
          tools.suppliersWithDues === 0
            ? 'No open supplier balances right now.'
            : `You owe suppliers ${tools.payablesTotalLabel} across ${tools.suppliersWithDues} vendor${tools.suppliersWithDues === 1 ? '' : 's'}.`,
        lines: [
          { label: 'Total to pay', value: tools.payablesTotalLabel },
          ...tools.topSuppliersDue.slice(0, 5).map((s) => ({
            label: s.name,
            value: s.outstandingLabel,
          })),
        ],
        links: [
          { label: 'Money to Pay', href: '/payables' },
          { label: 'Dues assistant', href: '/dues' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'profit_this_month':
      return {
        intentId,
        matchedLabel,
        summary: `This month operating result: ${tools.profitMonth.operatingResultLabel} (gross profit ${tools.profitMonth.grossProfitLabel}, margin ${tools.profitMonth.grossMarginLabel}).`,
        lines: [
          { label: 'Range', value: tools.profitMonth.rangeLabel },
          { label: 'Sales', value: tools.profitMonth.salesLabel },
          { label: 'COGS', value: tools.profitMonth.cogsLabel },
          { label: 'Gross profit', value: tools.profitMonth.grossProfitLabel },
          { label: 'Gross margin', value: tools.profitMonth.grossMarginLabel },
          { label: 'Expenses', value: tools.profitMonth.expensesLabel },
          {
            label: 'Operating result',
            value: tools.profitMonth.operatingResultLabel,
          },
        ],
        links: [
          { label: 'Profit & Loss', href: '/reports/profit-loss' },
          { label: 'Profit insights', href: '/reports/profit-insights' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'what_to_buy':
      if (!tools.topPurchase) {
        return {
          intentId,
          matchedLabel,
          summary: 'No purchase suggestions right now under the stock + sales rules.',
          lines: [],
          links: [{ label: 'What to buy', href: '/purchases/recommend' }],
          honestyNote: HONESTY_NOTE,
          unsupportedDetail: null,
        };
      }
      return {
        intentId,
        matchedLabel,
        summary: `Suggested: buy ${tools.topPurchase.recommendedQtyLabel} of ${tools.topPurchase.productName}.`,
        lines: [
          { label: 'Product', value: tools.topPurchase.productName },
          { label: 'Suggested qty', value: tools.topPurchase.recommendedQtyLabel },
          { label: 'Why', value: tools.topPurchase.reason },
        ],
        links: [
          { label: 'Start purchase', href: tools.topPurchase.href },
          { label: 'What to buy', href: '/purchases/recommend' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'top_product_sales':
      if (tools.topProducts.length === 0) {
        return {
          intentId,
          matchedLabel,
          summary: 'No product sales in the current report window.',
          lines: [],
          links: [{ label: 'Product sales', href: '/reports/products' }],
          honestyNote: HONESTY_NOTE,
          unsupportedDetail: null,
        };
      }
      return {
        intentId,
        matchedLabel,
        summary: `Top seller by sales value: ${tools.topProducts[0]!.product} (${tools.topProducts[0]!.salesValueLabel}).`,
        lines: tools.topProducts.slice(0, 5).map((p) => ({
          label: `${p.product} · ${p.sku}`,
          value: `${p.salesValueLabel} · qty ${p.quantity}`,
        })),
        links: [{ label: 'Product sales report', href: '/reports/products' }],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'top_product_margin':
      return {
        intentId,
        matchedLabel,
        summary:
          'Per-product margin is not available as a typed tool yet (needs SKU-level COGS on sales). Showing top sellers by sales value instead.',
        lines: tools.topProducts.slice(0, 5).map((p) => ({
          label: `${p.product} · ${p.sku}`,
          value: p.salesValueLabel,
        })),
        links: [
          { label: 'Product sales', href: '/reports/products' },
          { label: 'Profit & Loss', href: '/reports/profit-loss' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail:
          'Highest-margin product needs stamped COGS per sold SKU — not exposed as a typed report tool yet.',
      };

    case 'customers_above_threshold': {
      const thresholdLabel = moneyLabel(tools.thresholdUsed);
      if (tools.customersAbove.length === 0) {
        return {
          intentId,
          matchedLabel,
          summary: `No unpaid customers above ${thresholdLabel}.`,
          lines: [{ label: 'Threshold', value: thresholdLabel }],
          links: [{ label: 'Money Due', href: '/receivables' }],
          honestyNote: HONESTY_NOTE,
          unsupportedDetail: null,
        };
      }
      return {
        intentId,
        matchedLabel,
        summary: `${tools.customersAbove.length} unpaid customer${tools.customersAbove.length === 1 ? '' : 's'} above ${thresholdLabel}.`,
        lines: tools.customersAbove.slice(0, 10).map((c) => ({
          label: c.name,
          value: c.outstandingLabel,
        })),
        links: [
          { label: 'Money Due', href: '/receivables' },
          { label: 'Dues assistant', href: '/dues' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };
    }

    case 'expenses_fuel_month':
      return {
        intentId,
        matchedLabel,
        summary: `This month Transport category: ${tools.transportExpensesMonthLabel}. Lines mentioning fuel/petrol/diesel: ${tools.fuelMentionExpensesLabel}.`,
        lines: [
          {
            label: 'Transport (category)',
            value: tools.transportExpensesMonthLabel,
          },
          {
            label: 'Fuel keywords in description',
            value: tools.fuelMentionExpensesLabel,
          },
        ],
        links: [{ label: 'Expenses', href: '/expenses' }],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail:
          'There is no separate Fuel expense category — Transport + description keywords are used.',
      };

    case 'expenses_why_up':
      return {
        intentId,
        matchedLabel,
        summary:
          tools.expenseInsightSummary ??
          'No unusual expense flags vs last month under current rules. Open Profit insights for the full comparison.',
        lines: [
          {
            label: 'This month expenses (P&L)',
            value: tools.profitMonth.expensesLabel,
          },
        ],
        links: [
          { label: 'Profit insights', href: '/reports/profit-insights' },
          { label: 'Expenses', href: '/expenses' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };

    case 'unknown':
    default:
      return {
        intentId: 'unknown',
        matchedLabel: 'Not understood',
        summary:
          'I could not map that to a typed books question. Try a preset below — answers only come from application tools, never from SQL.',
        lines: [],
        links: [
          { label: "Today's brief", href: '/brief' },
          { label: 'Dues assistant', href: '/dues' },
          { label: 'What to buy', href: '/purchases/recommend' },
        ],
        honestyNote: HONESTY_NOTE,
        unsupportedDetail: null,
      };
  }
}
