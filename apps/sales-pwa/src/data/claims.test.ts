import { describe, expect, it } from 'vitest';
import {
  claimStatusLabel,
  expenseAmountError,
  expenseDateError,
  returnQuantityError,
  returnReasonError,
} from './claims';

describe('expense and return validation', () => {
  it('rejects a missing, zero, or huge amount', () => {
    expect(expenseAmountError('')).toMatch(/greater than zero/);
    expect(expenseAmountError('0')).toMatch(/greater than zero/);
    expect(expenseAmountError('-5')).toMatch(/greater than zero/);
    expect(expenseAmountError('10000000')).toMatch(/greater than zero/);
    expect(expenseAmountError('120.5')).toBeNull();
  });

  it('rejects a future expense date', () => {
    expect(expenseDateError('2026-09-28', '2026-09-28')).toBeNull();
    expect(expenseDateError('2026-09-29', '2026-09-28')).toMatch(/future/);
    expect(expenseDateError('', '2026-09-28')).toMatch(/date/);
  });

  it('rejects an empty, zero, or over-line quantity and a blank reason', () => {
    expect(returnQuantityError('0', 2)).toMatch(/greater than zero/);
    expect(returnQuantityError('3', 2)).toMatch(/order line/);
    expect(returnQuantityError('2', 2)).toBeNull();
    expect(returnReasonError('  ')).toMatch(/reason/);
    expect(returnReasonError('Damaged pack')).toBeNull();
  });

  it('labels claim status for the field', () => {
    expect(claimStatusLabel('PENDING')).toBe('Pending');
    expect(claimStatusLabel('APPROVED')).toBe('Approved');
    expect(claimStatusLabel('REJECTED')).toBe('Rejected');
  });
});
