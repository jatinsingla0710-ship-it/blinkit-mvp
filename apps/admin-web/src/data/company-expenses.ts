import { formatDate, formatInr } from '@/data/live/format';

export const COMPANY_EXPENSE_CATEGORIES = [
  'PURCHASE',
  'TRANSPORT',
  'RENT',
  'SALARY',
  'UTILITIES',
  'MARKETING',
  'OFFICE',
  'MAINTENANCE',
  'OTHER',
] as const;

export type CompanyExpenseCategory = (typeof COMPANY_EXPENSE_CATEGORIES)[number];

export const COMPANY_EXPENSE_PAYMENT_METHODS = [
  'CASH',
  'BANK',
  'UPI',
  'OTHER',
] as const;

export type CompanyExpensePaymentMethod =
  (typeof COMPANY_EXPENSE_PAYMENT_METHODS)[number];

export const COMPANY_EXPENSE_CATEGORY_LABELS: Record<
  CompanyExpenseCategory,
  string
> = {
  PURCHASE: 'Purchase',
  TRANSPORT: 'Transport',
  RENT: 'Rent',
  SALARY: 'Salary',
  UTILITIES: 'Utilities',
  MARKETING: 'Marketing',
  OFFICE: 'Office',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

export const COMPANY_EXPENSE_PAYMENT_METHOD_LABELS: Record<
  CompanyExpensePaymentMethod,
  string
> = {
  CASH: 'Cash',
  BANK: 'Bank',
  UPI: 'UPI',
  OTHER: 'Other',
};

export type CompanyExpenseRow = {
  id: string;
  expenseDate: string;
  expenseDateLabel: string;
  category: CompanyExpenseCategory;
  categoryLabel: string;
  amount: number;
  amountLabel: string;
  description: string;
  paymentMethod: CompanyExpensePaymentMethod;
  paymentMethodLabel: string;
  referenceNumber: string | null;
  receiptPath: string | null;
  createdAtLabel: string;
  updatedAtLabel: string;
};

export type CompanyExpenseInput = {
  expenseDate: string;
  category: CompanyExpenseCategory;
  amount: number;
  description: string;
  paymentMethod: CompanyExpensePaymentMethod;
  referenceNumber?: string | null;
  receiptPath?: string | null;
};

export type CompanyExpensesSnapshot = {
  generatedAtLabel: string;
  rows: CompanyExpenseRow[];
  thisMonthTotal: number;
  thisMonthLabel: string;
  todayTotal: number;
  todayLabel: string;
  cashTotal: number;
  cashLabel: string;
  bankUpiTotal: number;
  bankUpiLabel: string;
};

export function isCompanyExpenseCategory(
  value: string,
): value is CompanyExpenseCategory {
  return (COMPANY_EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function isCompanyExpensePaymentMethod(
  value: string,
): value is CompanyExpensePaymentMethod {
  return (COMPANY_EXPENSE_PAYMENT_METHODS as readonly string[]).includes(value);
}

export function expenseAmountError(amount: number | string): string | null {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'Enter an amount greater than 0';
  if (n > 9_999_999.99) return 'Amount is too large';
  return null;
}

export function expenseDateError(date: string): string | null {
  const trimmed = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Choose a valid date';
  const parsed = Date.parse(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed)) return 'Choose a valid date';
  return null;
}

export function expenseDescriptionError(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed) return 'Add a short description';
  if (trimmed.length > 500) return 'Description is too long';
  return null;
}

export function validateCompanyExpenseInput(
  input: CompanyExpenseInput,
): string | null {
  return (
    expenseDateError(input.expenseDate) ||
    expenseAmountError(input.amount) ||
    expenseDescriptionError(input.description) ||
    (isCompanyExpenseCategory(input.category)
      ? null
      : 'Choose a category') ||
    (isCompanyExpensePaymentMethod(input.paymentMethod)
      ? null
      : 'Choose a payment method')
  );
}

function kolkataYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function todayExpenseDate(): string {
  return kolkataYmd();
}

export function mapCompanyExpenseRow(input: {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  reference_number?: string | null;
  receipt_path?: string | null;
  created_at: string;
  updated_at: string;
}): CompanyExpenseRow {
  const category = isCompanyExpenseCategory(input.category)
    ? input.category
    : 'OTHER';
  const paymentMethod = isCompanyExpensePaymentMethod(input.payment_method)
    ? input.payment_method
    : 'OTHER';
  const amount = Number(input.amount) || 0;
  return {
    id: input.id,
    expenseDate: input.expense_date,
    expenseDateLabel: formatDate(`${input.expense_date}T00:00:00`),
    category,
    categoryLabel: COMPANY_EXPENSE_CATEGORY_LABELS[category],
    amount,
    amountLabel: formatInr(amount),
    description: input.description,
    paymentMethod,
    paymentMethodLabel: COMPANY_EXPENSE_PAYMENT_METHOD_LABELS[paymentMethod],
    referenceNumber: input.reference_number ?? null,
    receiptPath: input.receipt_path ?? null,
    createdAtLabel: formatDate(input.created_at),
    updatedAtLabel: formatDate(input.updated_at),
  };
}

export function buildCompanyExpensesSnapshot(input: {
  generatedAtIso: string;
  rows: readonly CompanyExpenseRow[];
  todayYmd?: string;
}): CompanyExpensesSnapshot {
  const today = input.todayYmd ?? kolkataYmd();
  const monthPrefix = today.slice(0, 7);
  let thisMonthTotal = 0;
  let todayTotal = 0;
  let cashTotal = 0;
  let bankUpiTotal = 0;

  for (const row of input.rows) {
    if (row.expenseDate.startsWith(monthPrefix)) thisMonthTotal += row.amount;
    if (row.expenseDate === today) todayTotal += row.amount;
    if (row.paymentMethod === 'CASH') cashTotal += row.amount;
    if (row.paymentMethod === 'BANK' || row.paymentMethod === 'UPI') {
      bankUpiTotal += row.amount;
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    generatedAtLabel: formatDate(input.generatedAtIso),
    rows: [...input.rows].sort((a, b) =>
      b.expenseDate.localeCompare(a.expenseDate) ||
      b.id.localeCompare(a.id),
    ),
    thisMonthTotal: round(thisMonthTotal),
    thisMonthLabel: formatInr(round(thisMonthTotal)),
    todayTotal: round(todayTotal),
    todayLabel: formatInr(round(todayTotal)),
    cashTotal: round(cashTotal),
    cashLabel: formatInr(round(cashTotal)),
    bankUpiTotal: round(bankUpiTotal),
    bankUpiLabel: formatInr(round(bankUpiTotal)),
  };
}

export function filterCompanyExpenseRows(
  rows: readonly CompanyExpenseRow[],
  search: string,
): CompanyExpenseRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(
    (row) =>
      row.description.toLowerCase().includes(q) ||
      row.categoryLabel.toLowerCase().includes(q) ||
      row.paymentMethodLabel.toLowerCase().includes(q) ||
      (row.referenceNumber ?? '').toLowerCase().includes(q),
  );
}
