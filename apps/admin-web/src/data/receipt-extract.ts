/**
 * Phase 14 — expense receipt extract DTO + category helpers.
 * Default extractor is manual/stub. Never claim AI accuracy.
 * Confirm path creates a company expense only after owner review.
 */

import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  COMPANY_EXPENSE_PAYMENT_METHODS,
  isCompanyExpenseCategory,
  isCompanyExpensePaymentMethod,
  type CompanyExpenseCategory,
  type CompanyExpensePaymentMethod,
} from '@/data/company-expenses';

export type ReceiptExtractDraft = {
  merchantHint?: string | null;
  expenseDate?: string | null;
  amount?: number | null;
  category?: CompanyExpenseCategory | null;
  categoryHint?: string | null;
  categoryMatchConfidence?: 'exact' | 'partial' | 'none';
  paymentMethod?: CompanyExpensePaymentMethod | null;
  paymentMethodHint?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  notes?: string | null;
  /** Honest label shown in UI — never "AI verified". */
  extractorLabel: string;
};

export type ExpenseReceiptScanStatus =
  | 'UPLOADED'
  | 'REVIEWING'
  | 'CONFIRMED'
  | 'DISCARDED';

export type ExpenseReceiptScanVm = {
  id: string;
  status: ExpenseReceiptScanStatus;
  imagePath: string | null;
  imageUrl: string | null;
  extract: ReceiptExtractDraft;
  extractorLabel: string;
  expenseId: string | null;
  notes: string | null;
  createdAtLabel: string;
};

const CATEGORY_HINT_ALIASES: Record<string, CompanyExpenseCategory> = {
  petrol: 'TRANSPORT',
  fuel: 'TRANSPORT',
  diesel: 'TRANSPORT',
  transport: 'TRANSPORT',
  travel: 'TRANSPORT',
  rent: 'RENT',
  salary: 'SALARY',
  wages: 'SALARY',
  electricity: 'UTILITIES',
  water: 'UTILITIES',
  internet: 'UTILITIES',
  utility: 'UTILITIES',
  utilities: 'UTILITIES',
  marketing: 'MARKETING',
  ads: 'MARKETING',
  advertising: 'MARKETING',
  office: 'OFFICE',
  stationery: 'OFFICE',
  maintenance: 'MAINTENANCE',
  repair: 'MAINTENANCE',
  purchase: 'PURCHASE',
  other: 'OTHER',
};

const PAYMENT_HINT_ALIASES: Record<string, CompanyExpensePaymentMethod> = {
  cash: 'CASH',
  bank: 'BANK',
  neft: 'BANK',
  rtgs: 'BANK',
  imps: 'BANK',
  upi: 'UPI',
  gpay: 'UPI',
  phonepe: 'UPI',
  paytm: 'UPI',
  other: 'OTHER',
};

export function emptyReceiptExtract(
  extractorLabel = 'manual',
): ReceiptExtractDraft {
  return {
    merchantHint: null,
    expenseDate: null,
    amount: null,
    category: 'OTHER',
    categoryHint: null,
    categoryMatchConfidence: 'none',
    paymentMethod: 'CASH',
    paymentMethodHint: null,
    referenceNumber: null,
    description: null,
    notes: null,
    extractorLabel,
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchExpenseCategoryFromHint(
  hint: string | null | undefined,
): {
  category: CompanyExpenseCategory | null;
  categoryMatchConfidence: 'exact' | 'partial' | 'none';
} {
  const raw = normalize(hint);
  if (!raw) {
    return { category: null, categoryMatchConfidence: 'none' };
  }

  if (isCompanyExpenseCategory(raw.toUpperCase())) {
    return {
      category: raw.toUpperCase() as CompanyExpenseCategory,
      categoryMatchConfidence: 'exact',
    };
  }

  const alias = CATEGORY_HINT_ALIASES[raw];
  if (alias) {
    return { category: alias, categoryMatchConfidence: 'exact' };
  }

  for (const cat of COMPANY_EXPENSE_CATEGORIES) {
    const label = normalize(COMPANY_EXPENSE_CATEGORY_LABELS[cat]);
    if (label === raw || normalize(cat) === raw) {
      return { category: cat, categoryMatchConfidence: 'exact' };
    }
  }

  const partialCats = COMPANY_EXPENSE_CATEGORIES.filter((cat) => {
    const label = normalize(COMPANY_EXPENSE_CATEGORY_LABELS[cat]);
    return label.includes(raw) || raw.includes(label) || raw.includes(normalize(cat));
  });
  if (partialCats.length === 1) {
    return {
      category: partialCats[0]!,
      categoryMatchConfidence: 'partial',
    };
  }

  for (const [key, cat] of Object.entries(CATEGORY_HINT_ALIASES)) {
    if (raw.includes(key)) {
      return { category: cat, categoryMatchConfidence: 'partial' };
    }
  }

  return { category: null, categoryMatchConfidence: 'none' };
}

export function matchPaymentMethodFromHint(
  hint: string | null | undefined,
): CompanyExpensePaymentMethod | null {
  const raw = normalize(hint);
  if (!raw) return null;
  if (isCompanyExpensePaymentMethod(raw.toUpperCase())) {
    return raw.toUpperCase() as CompanyExpensePaymentMethod;
  }
  if (PAYMENT_HINT_ALIASES[raw]) return PAYMENT_HINT_ALIASES[raw]!;
  for (const method of COMPANY_EXPENSE_PAYMENT_METHODS) {
    if (raw.includes(normalize(method))) return method;
  }
  for (const [key, method] of Object.entries(PAYMENT_HINT_ALIASES)) {
    if (raw.includes(key)) return method;
  }
  return null;
}

export function applyReceiptExtractMatches(
  extract: ReceiptExtractDraft,
): ReceiptExtractDraft {
  const categoryMatch = matchExpenseCategoryFromHint(
    extract.categoryHint ?? extract.description ?? extract.merchantHint,
  );
  const payment =
    extract.paymentMethod ??
    matchPaymentMethodFromHint(extract.paymentMethodHint);

  const description =
    extract.description?.trim() ||
    [extract.merchantHint, extract.categoryHint]
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
      .join(' · ') ||
    null;

  return {
    ...extract,
    category: categoryMatch.category ?? extract.category ?? 'OTHER',
    categoryMatchConfidence: categoryMatch.categoryMatchConfidence,
    paymentMethod: payment ?? extract.paymentMethod ?? 'CASH',
    description,
  };
}

export async function runManualReceiptExtractor(_input: {
  imageFileName?: string | null;
}): Promise<ReceiptExtractDraft> {
  return emptyReceiptExtract('manual');
}

export function parseReceiptExtractJson(raw: unknown): ReceiptExtractDraft {
  if (!raw || typeof raw !== 'object') return emptyReceiptExtract();
  const row = raw as Record<string, unknown>;
  const categoryRaw =
    typeof row.category === 'string' ? row.category.toUpperCase() : null;
  const paymentRaw =
    typeof row.paymentMethod === 'string'
      ? row.paymentMethod.toUpperCase()
      : null;
  return {
    merchantHint:
      typeof row.merchantHint === 'string' ? row.merchantHint : null,
    expenseDate:
      typeof row.expenseDate === 'string' ? row.expenseDate.slice(0, 10) : null,
    amount:
      row.amount == null || row.amount === ''
        ? null
        : Number(row.amount) || null,
    category: isCompanyExpenseCategory(categoryRaw ?? '')
      ? (categoryRaw as CompanyExpenseCategory)
      : 'OTHER',
    categoryHint:
      typeof row.categoryHint === 'string' ? row.categoryHint : null,
    categoryMatchConfidence:
      row.categoryMatchConfidence === 'exact' ||
      row.categoryMatchConfidence === 'partial' ||
      row.categoryMatchConfidence === 'none'
        ? row.categoryMatchConfidence
        : 'none',
    paymentMethod: isCompanyExpensePaymentMethod(paymentRaw ?? '')
      ? (paymentRaw as CompanyExpensePaymentMethod)
      : 'CASH',
    paymentMethodHint:
      typeof row.paymentMethodHint === 'string'
        ? row.paymentMethodHint
        : null,
    referenceNumber:
      typeof row.referenceNumber === 'string' ? row.referenceNumber : null,
    description: typeof row.description === 'string' ? row.description : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    extractorLabel:
      typeof row.extractorLabel === 'string' && row.extractorLabel.trim()
        ? row.extractorLabel
        : 'manual',
  };
}
