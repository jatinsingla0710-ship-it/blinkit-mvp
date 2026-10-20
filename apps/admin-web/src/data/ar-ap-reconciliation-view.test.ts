import { describe, expect, it } from 'vitest';
import {
  CASH_BANK_JOURNAL_ENTRY_LIMIT,
  buildArApReconciliation,
} from './ar-ap-reconciliation';
import {
  arApReconciliationHeadline,
  toArApReconciliationView,
} from './ar-ap-reconciliation-view';

const today = '2026-10-15';

function result(
  overrides: Partial<Parameters<typeof buildArApReconciliation>[0]> = {},
) {
  return buildArApReconciliation({
    asOfDate: today,
    todayBusinessDate: today,
    domainReceivablesTotal: 100000,
    booksArBalance: 100000,
    domainPayablesTotal: 40000,
    booksApBalance: 40000,
    pendingSupplierPaymentTotal: 0,
    booksEntryCount: 12,
    entryLimit: CASH_BANK_JOURNAL_ENTRY_LIMIT,
    ...overrides,
  });
}

describe('toArApReconciliationView', () => {
  it('labels a match without hiding the tolerance', () => {
    const view = toArApReconciliationView(result());
    expect(view.headline).toMatch(/match Books within ₹0\.01/);
    expect(view.sides[0]).toMatchObject({
      id: 'ar',
      title: 'Money Due',
      status: 'match',
      statusLabel: 'Match',
      deltaLabel: '₹0',
      reason: null,
    });
    expect(view.sides[1].statusLabel).toBe('Match');
    expect(view.notes.length).toBeGreaterThan(0);
  });

  it('shows a signed domain-minus-books difference', () => {
    const view = toArApReconciliationView(
      result({ domainReceivablesTotal: 100250.5, booksArBalance: 100000 }),
    );
    expect(view.headline).toMatch(/differ/);
    expect(view.sides[0]).toMatchObject({
      status: 'mismatch',
      statusLabel: 'Difference',
      deltaLabel: '+₹250.5',
    });
    expect(view.sides[1].status).toBe('match');
  });

  it('does not present a pending supplier-payment check as a match', () => {
    const built = result({ pendingSupplierPaymentTotal: 500 });
    const view = toArApReconciliationView(built);
    expect(arApReconciliationHeadline(built)).toMatch(/incomplete/);
    expect(view.headline).not.toMatch(/match Books/);
    expect(view.sides[1]).toMatchObject({
      status: 'inconclusive',
      statusLabel: 'Not compared',
      deltaLabel: '—',
    });
    expect(view.sides[1].reason).toMatch(/pending Books journal sync/);
  });

  it('uses an em dash when a money input is not a finite number', () => {
    const view = toArApReconciliationView(
      result({ domainReceivablesTotal: Number.NaN }),
    );
    expect(view.sides[0].domainLabel).toBe('—');
    expect(view.sides[0].statusLabel).toBe('Not compared');
    expect(view.sides[0].deltaLabel).toBe('—');
  });
});
