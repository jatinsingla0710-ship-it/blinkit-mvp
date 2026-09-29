import type { SalesmanClaimStatus, SalesmanExpenseCategory } from '@groaurum/api-client';

export const EXPENSE_CATEGORIES: { value: SalesmanExpenseCategory; label: string }[] = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'FOOD', label: 'Food' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'OTHER', label: 'Other' },
];

export function expenseCategoryLabel(category: string): string {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export function claimStatusLabel(status: SalesmanClaimStatus | string): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

export function claimStatusTone(status: string): 'warning' | 'success' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'neutral';
}

export function expenseAmountError(raw: string): string | null {
  const amount = Number(raw.replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999.99) {
    return 'Enter an amount greater than zero.';
  }
  return null;
}

export function kolkataToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

export function expenseDateError(value: string, today = kolkataToday()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Choose a date.';
  if (value > today) return 'Expense date cannot be in the future.';
  return null;
}

export function returnQuantityError(raw: string, max?: number): string | null {
  const quantity = Number(raw.replace(/,/g, '').trim());
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 'Enter a quantity greater than zero.';
  }
  if (max != null && quantity > max) {
    return 'Quantity cannot be more than the order line.';
  }
  return null;
}

export function returnReasonError(value: string): string | null {
  const reason = value.trim();
  if (reason.length < 1 || reason.length > 200) {
    return 'Enter a reason up to 200 characters.';
  }
  return null;
}
