/**
 * Phase 17 — Customer & supplier dues assistant.
 * Rules-based ranking over existing receivables/payables snapshots.
 * Honest: no LLM, no collection-probability inventing.
 */

import type { ReceivableAgeingBucket } from '@/data/customer-ageing';
import type {
  ReceivableRow,
  ReceivablesSnapshot,
} from '@/data/customer-ledger';
import { formatDate, formatInr } from '@/data/live/format';
import type {
  SupplierPayableRow,
  SupplierPayablesSnapshot,
} from '@/data/supplier-ledger';

function moneyLabel(value: number): string {
  return formatInr(Math.round((Number(value) || 0) * 100) / 100);
}

export type DuesQuestionId =
  | 'who_owes_me'
  | 'whom_do_i_owe'
  | 'stale_customers'
  | 'biggest_balances';

export type DuesQuestion = {
  id: DuesQuestionId;
  label: string;
  shortLabel: string;
};

export const DUES_QUESTIONS: readonly DuesQuestion[] = [
  {
    id: 'who_owes_me',
    label: 'Who owes me money?',
    shortLabel: 'Customers due',
  },
  {
    id: 'whom_do_i_owe',
    label: 'Whom do I need to pay?',
    shortLabel: 'Suppliers to pay',
  },
  {
    id: 'stale_customers',
    label: 'Which customer dues are oldest?',
    shortLabel: 'Oldest dues',
  },
  {
    id: 'biggest_balances',
    label: 'What are the biggest open balances?',
    shortLabel: 'Biggest balances',
  },
] as const;

export type DuesPartyKind = 'customer' | 'supplier';

export type DuesPriorityRow = {
  kind: DuesPartyKind;
  id: string;
  name: string;
  meta: string;
  outstanding: number;
  outstandingLabel: string;
  ageDays: number | null;
  ageingLabel: string;
  reason: string;
  href: string;
  actionHref: string | null;
  actionLabel: string | null;
};

export type DuesAnswer = {
  questionId: DuesQuestionId;
  title: string;
  summary: string;
  honestyNote: string;
  rows: DuesPriorityRow[];
  emptyTitle: string;
  emptyDetail: string;
};

export type DuesAssistantSnapshot = {
  generatedAtLabel: string;
  receivablesTotal: number;
  receivablesTotalLabel: string;
  payablesTotal: number;
  payablesTotalLabel: string;
  customersWithDues: number;
  suppliersWithDues: number;
  questions: readonly DuesQuestion[];
  answers: Record<DuesQuestionId, DuesAnswer>;
};

const HONESTY_NOTE =
  'Answered from your books with ranking rules — not AI prediction or collection likelihood.';

const AGE_SEVERITY: Record<ReceivableAgeingBucket, number> = {
  days_61_plus: 4,
  days_31_60: 3,
  days_1_30: 2,
  current: 1,
  none: 0,
};

const DEFAULT_LIMIT = 15;

function compareAgeThenAmount(
  a: {
    ageingBucket: ReceivableAgeingBucket;
    outstanding: number;
    oldestOpenDays: number | null;
  },
  b: {
    ageingBucket: ReceivableAgeingBucket;
    outstanding: number;
    oldestOpenDays: number | null;
  },
): number {
  const severity =
    AGE_SEVERITY[b.ageingBucket] - AGE_SEVERITY[a.ageingBucket];
  if (severity !== 0) return severity;
  if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
  return (b.oldestOpenDays ?? 0) - (a.oldestOpenDays ?? 0);
}

function customerReason(row: ReceivableRow): string {
  if (row.oldestOpenDays == null) return 'Open balance on books';
  if (row.oldestOpenDays >= 61) {
    return `Oldest open order ${row.oldestOpenDays} days — prioritize follow-up`;
  }
  if (row.oldestOpenDays >= 31) {
    return `${row.oldestOpenDays} days open · ${row.ageingLabel}`;
  }
  return `${row.ageingLabel} · ₹ due from orders`;
}

function supplierReason(row: SupplierPayableRow): string {
  if (row.oldestOpenDays == null) return 'Open balance on books';
  if (row.oldestOpenDays >= 61) {
    return `Oldest received bill ~${row.oldestOpenDays} days — review payment`;
  }
  if (row.oldestOpenDays >= 31) {
    return `${row.oldestOpenDays} days since oldest bill · ${row.ageingLabel}`;
  }
  return `${row.ageingLabel} · supplier payable`;
}

function toCustomerPriority(row: ReceivableRow): DuesPriorityRow {
  return {
    kind: 'customer',
    id: row.customerId,
    name: row.shopName,
    meta: [row.phoneLabel, row.areaLabel].filter(Boolean).join(' · '),
    outstanding: row.outstanding,
    outstandingLabel: row.outstandingLabel,
    ageDays: row.oldestOpenDays,
    ageingLabel: row.ageingLabel,
    reason: customerReason(row),
    href: row.ledgerHref,
    actionHref: row.collectHref,
    actionLabel: row.collectHref ? 'Collect' : null,
  };
}

function toSupplierPriority(row: SupplierPayableRow): DuesPriorityRow {
  return {
    kind: 'supplier',
    id: row.supplierId,
    name: row.supplierName,
    meta: [row.contactLabel, row.mobileLabel].filter(Boolean).join(' · '),
    outstanding: row.outstanding,
    outstandingLabel: row.outstandingLabel,
    ageDays: row.oldestOpenDays,
    ageingLabel: row.ageingLabel,
    reason: supplierReason(row),
    href: row.ledgerHref,
    actionHref: row.outstanding > 0 ? row.payHref : null,
    actionLabel: row.outstanding > 0 ? 'Pay' : null,
  };
}

function answerWhoOwesMe(customers: readonly ReceivableRow[]): DuesAnswer {
  const due = customers
    .filter((r) => r.outstanding > 0)
    .slice()
    .sort(compareAgeThenAmount)
    .slice(0, DEFAULT_LIMIT)
    .map(toCustomerPriority);
  const total = customers
    .filter((r) => r.outstanding > 0)
    .reduce((s, r) => s + r.outstanding, 0);
  return {
    questionId: 'who_owes_me',
    title: 'Who owes me money?',
    summary:
      due.length === 0
        ? 'No customer balances are open right now.'
        : `${due.length} customer${due.length === 1 ? '' : 's'} ranked by age, then amount (${moneyLabel(total)} open in view).`,
    honestyNote: HONESTY_NOTE,
    rows: due,
    emptyTitle: 'Nobody owes you right now',
    emptyDetail: 'Customer Money Due is clear on the books.',
  };
}

function answerWhomDoIOwe(suppliers: readonly SupplierPayableRow[]): DuesAnswer {
  const due = suppliers
    .filter((r) => r.outstanding > 0)
    .slice()
    .sort(compareAgeThenAmount)
    .slice(0, DEFAULT_LIMIT)
    .map(toSupplierPriority);
  const total = suppliers
    .filter((r) => r.outstanding > 0)
    .reduce((s, r) => s + r.outstanding, 0);
  return {
    questionId: 'whom_do_i_owe',
    title: 'Whom do I need to pay?',
    summary:
      due.length === 0
        ? 'No supplier balances are open right now.'
        : `${due.length} supplier${due.length === 1 ? '' : 's'} ranked by age, then amount (${moneyLabel(total)} to pay in view).`,
    honestyNote: HONESTY_NOTE,
    rows: due,
    emptyTitle: 'Nothing to pay right now',
    emptyDetail: 'Supplier Money to Pay is clear on the books.',
  };
}

function answerStaleCustomers(customers: readonly ReceivableRow[]): DuesAnswer {
  const stale = customers
    .filter(
      (r) =>
        r.outstanding > 0 &&
        (r.ageingBucket === 'days_61_plus' || (r.oldestOpenDays ?? 0) >= 61),
    )
    .slice()
    .sort(compareAgeThenAmount)
    .slice(0, DEFAULT_LIMIT)
    .map(toCustomerPriority);
  return {
    questionId: 'stale_customers',
    title: 'Which customer dues are oldest?',
    summary:
      stale.length === 0
        ? 'No customer dues are in the 61+ day bucket.'
        : `${stale.length} customer${stale.length === 1 ? '' : 's'} with oldest open order 61+ days.`,
    honestyNote: HONESTY_NOTE,
    rows: stale,
    emptyTitle: 'No 61+ day customer dues',
    emptyDetail: 'Nothing in the oldest ageing bucket right now.',
  };
}

function answerBiggestBalances(
  customers: readonly ReceivableRow[],
  suppliers: readonly SupplierPayableRow[],
): DuesAnswer {
  const merged = [
    ...customers.filter((r) => r.outstanding > 0).map(toCustomerPriority),
    ...suppliers.filter((r) => r.outstanding > 0).map(toSupplierPriority),
  ]
    .sort((a, b) => {
      if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
      return (b.ageDays ?? 0) - (a.ageDays ?? 0);
    })
    .slice(0, DEFAULT_LIMIT)
    .map((row) => ({
      ...row,
      reason:
        row.kind === 'customer'
          ? `Customer due · ${row.outstandingLabel}`
          : `Supplier to pay · ${row.outstandingLabel}`,
    }));
  return {
    questionId: 'biggest_balances',
    title: 'What are the biggest open balances?',
    summary:
      merged.length === 0
        ? 'No open customer or supplier balances.'
        : `Top ${merged.length} open balance${merged.length === 1 ? '' : 's'} by amount (customers and suppliers mixed).`,
    honestyNote: HONESTY_NOTE,
    rows: merged,
    emptyTitle: 'No open balances',
    emptyDetail: 'Receivables and payables are clear on the books.',
  };
}

/** Build the Phase 17 dues assistant from existing money snapshots. */
export function buildDuesAssistantSnapshot(input: {
  generatedAtIso: string;
  receivables: ReceivablesSnapshot;
  payables: SupplierPayablesSnapshot;
}): DuesAssistantSnapshot {
  const customers = input.receivables.rows;
  const suppliers = input.payables.rows;
  const customersWithDues = customers.filter((r) => r.outstanding > 0).length;
  const suppliersWithDues = suppliers.filter((r) => r.outstanding > 0).length;

  return {
    generatedAtLabel: formatDate(input.generatedAtIso),
    receivablesTotal: input.receivables.totalOutstanding,
    receivablesTotalLabel: input.receivables.totalOutstandingLabel,
    payablesTotal: input.payables.totalOutstanding,
    payablesTotalLabel: input.payables.totalOutstandingLabel,
    customersWithDues,
    suppliersWithDues,
    questions: DUES_QUESTIONS,
    answers: {
      who_owes_me: answerWhoOwesMe(customers),
      whom_do_i_owe: answerWhomDoIOwe(suppliers),
      stale_customers: answerStaleCustomers(customers),
      biggest_balances: answerBiggestBalances(customers, suppliers),
    },
  };
}

export function getDuesAnswer(
  snapshot: DuesAssistantSnapshot,
  questionId: DuesQuestionId,
): DuesAnswer {
  return snapshot.answers[questionId];
}
