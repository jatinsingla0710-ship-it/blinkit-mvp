/**
 * Phase 15 — daily book / rojnama line extract helpers.
 * Default path: paste text → line-rules parser. Photo is archive-only (manual).
 * Never claim AI accuracy. Confirm posts expense/supplier payment only.
 * Collections remain proposals (need an order to collect against).
 */

import type { CompanyExpenseCategory } from '@/data/company-expenses';
import { matchExpenseCategoryFromHint } from '@/data/receipt-extract';
import {
  matchSupplierFromHints,
  type SupplierMatchCandidate,
} from '@/data/bill-extract';

export type DayBookLineKind =
  | 'collection'
  | 'expense'
  | 'supplier_payment'
  | 'unknown';

export type DayBookLineDecision = 'include' | 'skip' | 'needs_order';

export type DayBookProposedLine = {
  id: string;
  rawText: string;
  kind: DayBookLineKind;
  amount: number | null;
  partyHint: string | null;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  customerMatchConfidence: 'exact' | 'partial' | 'none';
  matchedSupplierId: string | null;
  matchedSupplierName: string | null;
  supplierMatchConfidence: 'exact' | 'partial' | 'none';
  expenseCategory: CompanyExpenseCategory | null;
  notes: string | null;
  ambiguous: boolean;
  ambiguityReason: string | null;
  decision: DayBookLineDecision;
  createdExpenseId?: string | null;
  createdSupplierPaymentId?: string | null;
  collectHref?: string | null;
};

export type DayBookExtractDraft = {
  entryDate: string | null;
  lines: DayBookProposedLine[];
  extractorLabel: string;
};

export type CustomerMatchCandidate = {
  id: string;
  shopName: string;
  ownerName?: string | null;
};

export type DayBookScanStatus =
  | 'UPLOADED'
  | 'REVIEWING'
  | 'CONFIRMED'
  | 'DISCARDED';

export type DayBookScanVm = {
  id: string;
  status: DayBookScanStatus;
  imagePath: string | null;
  imageUrl: string | null;
  sourceText: string | null;
  extract: DayBookExtractDraft;
  extractorLabel: string;
  notes: string | null;
  createdAtLabel: string;
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function newLineId(index: number): string {
  return `line-${index + 1}`;
}

export function emptyDayBookExtract(
  extractorLabel = 'manual',
): DayBookExtractDraft {
  return {
    entryDate: null,
    lines: [],
    extractorLabel,
  };
}

export function matchCustomerFromHints(
  customers: readonly CustomerMatchCandidate[],
  hints: { name?: string | null },
): {
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  customerMatchConfidence: 'exact' | 'partial' | 'none';
} {
  const name = normalize(hints.name);
  if (!name) {
    return {
      matchedCustomerId: null,
      matchedCustomerName: null,
      customerMatchConfidence: 'none',
    };
  }

  const exact = customers.find(
    (c) =>
      normalize(c.shopName) === name || normalize(c.ownerName) === name,
  );
  if (exact) {
    return {
      matchedCustomerId: exact.id,
      matchedCustomerName: exact.shopName,
      customerMatchConfidence: 'exact',
    };
  }

  const partial = customers.filter((c) => {
    const shop = normalize(c.shopName);
    const owner = normalize(c.ownerName);
    return (
      shop.includes(name) ||
      name.includes(shop) ||
      (owner.length > 0 && (owner.includes(name) || name.includes(owner)))
    );
  });
  if (partial.length === 1) {
    return {
      matchedCustomerId: partial[0]!.id,
      matchedCustomerName: partial[0]!.shopName,
      customerMatchConfidence: 'partial',
    };
  }

  return {
    matchedCustomerId: null,
    matchedCustomerName: null,
    customerMatchConfidence: 'none',
  };
}

function extractAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  const match = cleaned.match(
    /(?:₹|rs\.?\s*)?(\d+(?:\.\d{1,2})?)\s*(?:rs|inr)?\b/i,
  );
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stripAmount(text: string): string {
  return text
    .replace(/₹/g, ' ')
    .replace(/(?:rs\.?\s*)?\d+(?:\.\d{1,2})?\s*(?:rs|inr)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferKind(raw: string): DayBookLineKind {
  const t = normalize(raw);
  if (
    /\b(expense|spent|petrol|diesel|fuel|rent|salary|utility|utilities|office)\b/.test(
      t,
    )
  ) {
    return 'expense';
  }
  if (
    /\b(supplier|vendor|paid\s+to|pay\s+to|purchase\s+bill)\b/.test(t) ||
    /\bpaid\b/.test(t)
  ) {
    return 'supplier_payment';
  }
  if (
    /\b(received|collected|collection|from|customer)\b/.test(t)
  ) {
    return 'collection';
  }
  return 'unknown';
}

function partyHintFromRaw(raw: string, kind: DayBookLineKind): string | null {
  let text = stripAmount(raw);
  text = text
    .replace(
      /\b(cash|expense|spent|petrol|diesel|fuel|rent|received|collected|collection|from|customer|supplier|vendor|paid\s+to|pay\s+to|paid|to|for|of|on|upi|bank)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (kind === 'expense' && text.length < 2) return null;
  return text;
}

export function parseDayBookSourceText(
  sourceText: string,
  opts?: { entryDate?: string | null },
): DayBookExtractDraft {
  const lines = sourceText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    entryDate: opts?.entryDate ?? null,
    extractorLabel: 'line-rules',
    lines: lines.map((raw, index) => {
      const kind = inferKind(raw);
      const amount = extractAmount(raw);
      const partyHint = partyHintFromRaw(raw, kind);
      const ambiguous =
        !amount ||
        kind === 'unknown' ||
        (kind !== 'expense' && !partyHint);
      let ambiguityReason: string | null = null;
      if (!amount) ambiguityReason = 'Amount not found';
      else if (kind === 'unknown')
        ambiguityReason = 'Unclear if collection, expense, or supplier payment';
      else if (kind !== 'expense' && !partyHint)
        ambiguityReason = 'Party name not found';

      return {
        id: newLineId(index),
        rawText: raw,
        kind,
        amount,
        partyHint,
        matchedCustomerId: null,
        matchedCustomerName: null,
        customerMatchConfidence: 'none',
        matchedSupplierId: null,
        matchedSupplierName: null,
        supplierMatchConfidence: 'none',
        expenseCategory:
          kind === 'expense'
            ? matchExpenseCategoryFromHint(raw).category ?? 'OTHER'
            : null,
        notes: null,
        ambiguous,
        ambiguityReason,
        decision:
          kind === 'collection'
            ? 'needs_order'
            : ambiguous
              ? 'skip'
              : 'include',
      };
    }),
  };
}

export function applyDayBookMatches(
  extract: DayBookExtractDraft,
  customers: readonly CustomerMatchCandidate[],
  suppliers: readonly SupplierMatchCandidate[],
): DayBookExtractDraft {
  const lines = extract.lines.map((line) => {
    const customerMatch = matchCustomerFromHints(customers, {
      name: line.partyHint,
    });
    const supplierMatch = matchSupplierFromHints(suppliers, {
      name: line.partyHint,
    });

    let kind = line.kind;
    let ambiguous = line.ambiguous;
    let ambiguityReason = line.ambiguityReason;
    let decision = line.decision;

    if (kind === 'unknown' && line.amount) {
      if (
        customerMatch.customerMatchConfidence !== 'none' &&
        supplierMatch.supplierMatchConfidence === 'none'
      ) {
        kind = 'collection';
        decision = 'needs_order';
        ambiguous = customerMatch.customerMatchConfidence === 'partial';
        ambiguityReason = ambiguous
          ? 'Partial customer match — confirm then open collections'
          : 'Collection needs an order to record payment';
      } else if (
        supplierMatch.supplierMatchConfidence !== 'none' &&
        customerMatch.customerMatchConfidence === 'none'
      ) {
        kind = 'supplier_payment';
        decision = supplierMatch.supplierMatchConfidence === 'exact'
          ? 'include'
          : 'skip';
        ambiguous = supplierMatch.supplierMatchConfidence !== 'exact';
        ambiguityReason = ambiguous
          ? 'Partial supplier match — confirm before posting'
          : null;
      }
    }

    if (kind === 'collection') {
      decision = 'needs_order';
      if (!ambiguityReason) {
        ambiguityReason =
          'Collections need an order — use Open collections after review';
      }
      ambiguous = true;
    }

    if (
      kind === 'supplier_payment' &&
      !supplierMatch.matchedSupplierId &&
      !line.matchedSupplierId
    ) {
      ambiguous = true;
      ambiguityReason = ambiguityReason ?? 'Supplier not matched';
      if (decision === 'include') decision = 'skip';
    }

    const collectHref =
      kind === 'collection' && customerMatch.matchedCustomerId
        ? `/customers/${customerMatch.matchedCustomerId}`
        : line.collectHref ?? null;

    return {
      ...line,
      kind,
      ambiguous,
      ambiguityReason,
      decision,
      matchedCustomerId:
        customerMatch.matchedCustomerId ?? line.matchedCustomerId,
      matchedCustomerName:
        customerMatch.matchedCustomerName ?? line.matchedCustomerName,
      customerMatchConfidence: customerMatch.customerMatchConfidence,
      matchedSupplierId:
        supplierMatch.matchedSupplierId ?? line.matchedSupplierId,
      matchedSupplierName: supplierMatch.matchedSupplierId
        ? suppliers.find((s) => s.id === supplierMatch.matchedSupplierId)?.name ??
          line.matchedSupplierName
        : line.matchedSupplierName,
      supplierMatchConfidence: supplierMatch.supplierMatchConfidence,
      collectHref,
    };
  });

  return { ...extract, lines };
}

export function parseDayBookExtractJson(raw: unknown): DayBookExtractDraft {
  if (!raw || typeof raw !== 'object') return emptyDayBookExtract();
  const row = raw as Record<string, unknown>;
  const linesRaw = Array.isArray(row.lines) ? row.lines : [];
  return {
    entryDate:
      typeof row.entryDate === 'string' ? row.entryDate.slice(0, 10) : null,
    extractorLabel:
      typeof row.extractorLabel === 'string' && row.extractorLabel.trim()
        ? row.extractorLabel
        : 'line-rules',
    lines: linesRaw.map((item, index) => {
      const l = (item ?? {}) as Record<string, unknown>;
      const kind =
        l.kind === 'collection' ||
        l.kind === 'expense' ||
        l.kind === 'supplier_payment' ||
        l.kind === 'unknown'
          ? l.kind
          : 'unknown';
      const decision =
        l.decision === 'include' ||
        l.decision === 'skip' ||
        l.decision === 'needs_order'
          ? l.decision
          : 'skip';
      return {
        id: typeof l.id === 'string' ? l.id : newLineId(index),
        rawText: typeof l.rawText === 'string' ? l.rawText : '',
        kind,
        amount:
          l.amount == null || l.amount === ''
            ? null
            : Number(l.amount) || null,
        partyHint: typeof l.partyHint === 'string' ? l.partyHint : null,
        matchedCustomerId:
          typeof l.matchedCustomerId === 'string'
            ? l.matchedCustomerId
            : null,
        matchedCustomerName:
          typeof l.matchedCustomerName === 'string'
            ? l.matchedCustomerName
            : null,
        customerMatchConfidence:
          l.customerMatchConfidence === 'exact' ||
          l.customerMatchConfidence === 'partial' ||
          l.customerMatchConfidence === 'none'
            ? l.customerMatchConfidence
            : 'none',
        matchedSupplierId:
          typeof l.matchedSupplierId === 'string'
            ? l.matchedSupplierId
            : null,
        matchedSupplierName:
          typeof l.matchedSupplierName === 'string'
            ? l.matchedSupplierName
            : null,
        supplierMatchConfidence:
          l.supplierMatchConfidence === 'exact' ||
          l.supplierMatchConfidence === 'partial' ||
          l.supplierMatchConfidence === 'none'
            ? l.supplierMatchConfidence
            : 'none',
        expenseCategory:
          typeof l.expenseCategory === 'string'
            ? (l.expenseCategory as CompanyExpenseCategory)
            : null,
        notes: typeof l.notes === 'string' ? l.notes : null,
        ambiguous: Boolean(l.ambiguous),
        ambiguityReason:
          typeof l.ambiguityReason === 'string' ? l.ambiguityReason : null,
        decision,
        createdExpenseId:
          typeof l.createdExpenseId === 'string' ? l.createdExpenseId : null,
        createdSupplierPaymentId:
          typeof l.createdSupplierPaymentId === 'string'
            ? l.createdSupplierPaymentId
            : null,
        collectHref:
          typeof l.collectHref === 'string' ? l.collectHref : null,
      };
    }),
  };
}
