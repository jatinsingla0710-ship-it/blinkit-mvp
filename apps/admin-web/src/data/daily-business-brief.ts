/**
 * Phase 20 — Daily business brief.
 * Rules-based morning summary from existing books + attention signals.
 * Honest: not AI narrative generation; configurable sections.
 */

import { formatDate, formatInr } from '@/data/live/format';
import type { ProfitLossVm } from '@/data/financial-reports';

const HONESTY_NOTE =
  'Built from your books and open items with ranking rules — not an AI-written story.';

/** Owner-facing section toggles (Phase 20 “configurable”). */
export type DailyBriefSectionId =
  | 'yesterday'
  | 'attention'
  | 'recommendations';

export type DailyBriefConfig = {
  sections: readonly DailyBriefSectionId[];
  /** Prefer stale customers (61+ days) for follow-up recommendations. */
  preferStaleCustomers: boolean;
  maxAttentionItems: number;
  maxRecommendations: number;
};

export const DEFAULT_DAILY_BRIEF_CONFIG: DailyBriefConfig = {
  sections: ['yesterday', 'attention', 'recommendations'],
  preferStaleCustomers: true,
  maxAttentionItems: 8,
  maxRecommendations: 5,
};

export type DailyBriefYesterdayMetrics = {
  salesTotal: number;
  salesTotalLabel: string;
  collectionsTotal: number;
  collectionsTotalLabel: string;
  expensesTotal: number;
  expensesTotalLabel: string;
  grossProfit: number;
  grossProfitLabel: string;
  grossMarginLabel: string;
  rangeLabel: string;
};

export type DailyBriefAttentionItem = {
  id: string;
  title: string;
  count: number;
  detail: string;
  href: string;
  severity: 'info' | 'watch' | 'attention';
};

export type DailyBriefRecommendation = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type DailyBusinessBriefSnapshot = {
  generatedAtLabel: string;
  greeting: string;
  asOfLabel: string;
  yesterdayDateLabel: string;
  honestyNote: string;
  config: DailyBriefConfig;
  yesterday: DailyBriefYesterdayMetrics | null;
  attention: DailyBriefAttentionItem[];
  recommendations: DailyBriefRecommendation[];
};

export type DailyBriefCustomerSignal = {
  customerId: string;
  shopName: string;
  outstanding: number;
  outstandingLabel: string;
  oldestOpenDays: number | null;
  ageingBucket: string;
  ledgerHref: string;
};

export type DailyBriefSupplierSignal = {
  supplierId: string;
  supplierName: string;
  outstanding: number;
  outstandingLabel: string;
  payHref: string;
};

export type DailyBriefPurchaseSignal = {
  productName: string;
  recommendedQtyLabel: string;
  purchaseHref: string;
};

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function moneyLabel(n: number): string {
  return formatInr(roundMoney(n));
}

/** Greeting for local hour (0–23). */
export function briefGreeting(hour: number): string {
  const h = ((Number(hour) % 24) + 24) % 24;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function yesterdayMetricsFromProfitLoss(
  pl: ProfitLossVm,
  rangeLabel: string,
): DailyBriefYesterdayMetrics {
  return {
    salesTotal: pl.salesTotal,
    salesTotalLabel: pl.salesTotalLabel,
    collectionsTotal: pl.collectionsTotal,
    collectionsTotalLabel: pl.collectionsTotalLabel,
    expensesTotal: pl.expensesTotal,
    expensesTotalLabel: pl.expensesTotalLabel,
    grossProfit: pl.grossProfit,
    grossProfitLabel: pl.grossProfitLabel,
    grossMarginLabel: pl.grossMarginLabel,
    rangeLabel,
  };
}

export function buildDailyBriefAttention(input: {
  customersWithDues: number;
  staleCustomers: number;
  suppliersWithDues: number;
  lowStockCount: number;
  outOfStockCount: number;
  draftPurchaseCount: number;
  billScansPendingCount: number;
  config?: DailyBriefConfig;
}): DailyBriefAttentionItem[] {
  const config = input.config ?? DEFAULT_DAILY_BRIEF_CONFIG;
  const items: DailyBriefAttentionItem[] = [];

  if (input.staleCustomers > 0) {
    items.push({
      id: 'stale-customers',
      title: 'Customers overdue 61+ days',
      count: input.staleCustomers,
      detail: 'Oldest open balances need follow-up',
      href: '/dues',
      severity: 'attention',
    });
  }
  if (input.customersWithDues > 0) {
    items.push({
      id: 'customers-due',
      title: 'Customers with money due',
      count: input.customersWithDues,
      detail: 'Open receivables on the books',
      href: '/receivables',
      severity: 'watch',
    });
  }
  if (input.suppliersWithDues > 0) {
    items.push({
      id: 'suppliers-due',
      title: 'Suppliers to pay',
      count: input.suppliersWithDues,
      detail: 'Open payables on the books',
      href: '/payables',
      severity: 'watch',
    });
  }
  if (input.outOfStockCount > 0) {
    items.push({
      id: 'out-of-stock',
      title: 'Out of stock SKUs',
      count: input.outOfStockCount,
      detail: 'Nothing available to sell on these SKUs',
      href: '/inventory?status=out_of_stock',
      severity: 'attention',
    });
  }
  if (input.lowStockCount > 0) {
    items.push({
      id: 'low-stock',
      title: 'Low stock products',
      count: input.lowStockCount,
      detail: 'Available under the usual low-stock threshold',
      href: '/inventory?status=low',
      severity: 'watch',
    });
  }
  if (input.draftPurchaseCount > 0) {
    items.push({
      id: 'draft-purchases',
      title: 'Draft purchases waiting',
      count: input.draftPurchaseCount,
      detail: 'Finish or receive open purchase drafts',
      href: '/purchases',
      severity: 'info',
    });
  }
  if (input.billScansPendingCount > 0) {
    items.push({
      id: 'bill-scans',
      title: 'Bill scans waiting for review',
      count: input.billScansPendingCount,
      detail: 'Confirm extracted supplier bills before they post',
      href: '/purchases/scan',
      severity: 'watch',
    });
  }

  return items.slice(0, config.maxAttentionItems);
}

export function buildDailyBriefRecommendations(input: {
  customers: readonly DailyBriefCustomerSignal[];
  suppliers: readonly DailyBriefSupplierSignal[];
  topPurchase: DailyBriefPurchaseSignal | null;
  unusualExpenseNote: string | null;
  config?: DailyBriefConfig;
}): DailyBriefRecommendation[] {
  const config = input.config ?? DEFAULT_DAILY_BRIEF_CONFIG;
  const recs: DailyBriefRecommendation[] = [];

  if (input.topPurchase) {
    recs.push({
      id: 'buy',
      title: `Purchase ${input.topPurchase.recommendedQtyLabel} of ${input.topPurchase.productName}`,
      detail: 'From stock + recent sales rules',
      href: input.topPurchase.purchaseHref,
    });
  }

  const dueCustomers = input.customers
    .filter((c) => c.outstanding > 0)
    .slice()
    .sort((a, b) => {
      if (config.preferStaleCustomers) {
        const aStale = (a.oldestOpenDays ?? 0) >= 61 ? 1 : 0;
        const bStale = (b.oldestOpenDays ?? 0) >= 61 ? 1 : 0;
        if (bStale !== aStale) return bStale - aStale;
        return (b.oldestOpenDays ?? 0) - (a.oldestOpenDays ?? 0);
      }
      return b.outstanding - a.outstanding;
    });
  const follow = dueCustomers[0];
  if (follow) {
    recs.push({
      id: 'follow-customer',
      title: `Follow up with ${follow.shopName}`,
      detail: `${follow.outstandingLabel} due${
        follow.oldestOpenDays != null
          ? ` · ${follow.oldestOpenDays} days open`
          : ''
      }`,
      href: follow.ledgerHref,
    });
  }

  const topSupplier = input.suppliers
    .filter((s) => s.outstanding > 0)
    .slice()
    .sort((a, b) => b.outstanding - a.outstanding)[0];
  if (topSupplier) {
    recs.push({
      id: 'pay-supplier',
      title: `Review payment to ${topSupplier.supplierName}`,
      detail: `${topSupplier.outstandingLabel} outstanding`,
      href: topSupplier.payHref,
    });
  }

  if (input.unusualExpenseNote) {
    recs.push({
      id: 'review-expense',
      title: 'Review unusually high expense',
      detail: input.unusualExpenseNote,
      href: '/reports/profit-insights',
    });
  }

  return recs.slice(0, config.maxRecommendations);
}

export function buildDailyBusinessBriefSnapshot(input: {
  generatedAtIso: string;
  hour: number;
  yesterdayDateLabel: string;
  asOfLabel?: string;
  profitLossYesterday: ProfitLossVm | null;
  yesterdayRangeLabel: string;
  customersWithDues: number;
  staleCustomers: number;
  suppliersWithDues: number;
  lowStockCount: number;
  outOfStockCount: number;
  draftPurchaseCount: number;
  billScansPendingCount: number;
  customers: readonly DailyBriefCustomerSignal[];
  suppliers: readonly DailyBriefSupplierSignal[];
  topPurchase: DailyBriefPurchaseSignal | null;
  unusualExpenseNote: string | null;
  config?: DailyBriefConfig;
}): DailyBusinessBriefSnapshot {
  const config = input.config ?? DEFAULT_DAILY_BRIEF_CONFIG;
  const sections = new Set(config.sections);

  const yesterday =
    sections.has('yesterday') && input.profitLossYesterday
      ? yesterdayMetricsFromProfitLoss(
          input.profitLossYesterday,
          input.yesterdayRangeLabel,
        )
      : null;

  const attention = sections.has('attention')
    ? buildDailyBriefAttention({
        customersWithDues: input.customersWithDues,
        staleCustomers: input.staleCustomers,
        suppliersWithDues: input.suppliersWithDues,
        lowStockCount: input.lowStockCount,
        outOfStockCount: input.outOfStockCount,
        draftPurchaseCount: input.draftPurchaseCount,
        billScansPendingCount: input.billScansPendingCount,
        config,
      })
    : [];

  const recommendations = sections.has('recommendations')
    ? buildDailyBriefRecommendations({
        customers: input.customers,
        suppliers: input.suppliers,
        topPurchase: input.topPurchase,
        unusualExpenseNote: input.unusualExpenseNote,
        config,
      })
    : [];

  return {
    generatedAtLabel: formatDate(input.generatedAtIso),
    greeting: briefGreeting(input.hour),
    asOfLabel: input.asOfLabel ?? formatDate(input.generatedAtIso),
    yesterdayDateLabel: input.yesterdayDateLabel,
    honestyNote: HONESTY_NOTE,
    config,
    yesterday,
    attention,
    recommendations,
  };
}

/** Tiny helper for tests / UI summaries. */
export function briefAttentionTotal(items: readonly DailyBriefAttentionItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

export function formatBriefMoney(n: number): string {
  return moneyLabel(n);
}
