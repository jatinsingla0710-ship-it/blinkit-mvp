import { describe, expect, it } from 'vitest';
import {
  CASH_BANK_JOURNAL_ENTRY_LIMIT,
  DEFAULT_AR_AP_RECONCILIATION_TOLERANCE,
  buildArApReconciliation,
  isValidBusinessYmd,
} from './ar-ap-reconciliation';

const today = '2026-10-15';

function base(overrides: Partial<Parameters<typeof buildArApReconciliation>[0]> = {}) {
  return buildArApReconciliation({
    asOfDate: today,
    todayBusinessDate: today,
    domainReceivablesTotal: 100000,
    booksArBalance: 100000,
    domainPayablesTotal: 40000,
    booksApBalance: 40000,
    pendingSupplierPaymentTotal: 0,
    booksEntryCount: 120,
    entryLimit: CASH_BANK_JOURNAL_ENTRY_LIMIT,
    ...overrides,
  });
}

describe('buildArApReconciliation', () => {
  it('matches AR and AP within default tolerance', () => {
    const result = base({
      domainReceivablesTotal: 100000.004,
      booksArBalance: 100000,
      domainPayablesTotal: 40000.005,
      booksApBalance: 40000,
    });
    expect(result.tolerance).toBe(DEFAULT_AR_AP_RECONCILIATION_TOLERANCE);
    expect(result.ar.status).toBe('match');
    expect(result.ap.status).toBe('match');
    expect(result.ar.delta).toBe(0);
    expect(result.ap.delta).toBe(0);
    expect(result.ar.reason).toBeNull();
    expect(result.ap.reason).toBeNull();
  });

  it('reports mismatch with signed domain − Books delta', () => {
    const result = base({
      domainReceivablesTotal: 125000,
      booksArBalance: 100000,
      domainPayablesTotal: 35000,
      booksApBalance: 40000,
    });
    expect(result.ar.status).toBe('mismatch');
    expect(result.ar.delta).toBe(25000);
    expect(result.ap.status).toBe('mismatch');
    expect(result.ap.delta).toBe(-5000);
  });

  it('treats any positive pending supplier payment as AP inconclusive, including at or below tolerance', () => {
    const zeroPending = base({ pendingSupplierPaymentTotal: 0 });
    expect(zeroPending.ap.status).toBe('match');
    expect(zeroPending.ap.reason).toBeNull();

    const atTolerance = base({
      domainPayablesTotal: 39999.99,
      booksApBalance: 40000,
      pendingSupplierPaymentTotal: 0.01,
      tolerance: 0.01,
    });
    expect(atTolerance.ap.status).toBe('inconclusive');
    expect(atTolerance.ap.reason).toMatch(/pending Books journal sync/i);
    expect(atTolerance.ap.reason).not.toMatch(/₹0\.00/);
    expect(Number.isFinite(atTolerance.ap.delta)).toBe(true);

    const tinyPositive = base({
      pendingSupplierPaymentTotal: 0.004,
      tolerance: 0.01,
    });
    expect(tinyPositive.ap.status).toBe('inconclusive');
    expect(tinyPositive.ap.reason).toMatch(/pending Books journal sync/i);
    expect(tinyPositive.ap.reason).not.toMatch(/₹/);
    expect(tinyPositive.ar.status).toBe('match');

    const belowTolerance = base({
      pendingSupplierPaymentTotal: 0.005,
      tolerance: 0.01,
    });
    expect(belowTolerance.ap.status).toBe('inconclusive');
    expect(belowTolerance.ap.reason).toMatch(/pending Books journal sync/i);
    expect(belowTolerance.ar.status).toBe('match');

    const largePending = base({
      domainPayablesTotal: 36000,
      booksApBalance: 40000,
      pendingSupplierPaymentTotal: 4000,
    });
    expect(largePending.ap.status).toBe('inconclusive');
    expect(largePending.ap.delta).toBe(-4000);
    expect(largePending.ap.reason).not.toMatch(/₹4000/);
    expect(
      largePending.notes.some((n) => /await Books journal sync/i.test(n)),
    ).toBe(true);
  });

  it('fails closed when pendingSupplierPaymentTotal is negative', () => {
    const result = base({ pendingSupplierPaymentTotal: -1 });
    expect(result.ap.status).toBe('inconclusive');
    expect(result.ap.reason).toMatch(
      /pendingSupplierPaymentTotal must be a finite number greater than or equal to zero/i,
    );
    expect(Number.isFinite(result.ap.delta)).toBe(true);
    expect(result.ar.status).toBe('match');
  });

  it('marks both sides inconclusive when as-of is not today', () => {
    const result = base({ asOfDate: '2026-10-01' });
    expect(result.ar.status).toBe('inconclusive');
    expect(result.ap.status).toBe('inconclusive');
    expect(result.ar.reason).toMatch(/not today/i);
    expect(result.ap.reason).toMatch(/current-only/i);
  });

  it('marks both sides inconclusive when Books entry count hits the query limit', () => {
    const result = base({
      booksEntryCount: CASH_BANK_JOURNAL_ENTRY_LIMIT,
      entryLimit: CASH_BANK_JOURNAL_ENTRY_LIMIT,
    });
    expect(result.ar.status).toBe('inconclusive');
    expect(result.ap.status).toBe('inconclusive');
    expect(result.ar.reason).toMatch(/query limit \(5000\)/i);
    expect(result.ap.reason).toMatch(/truncated/i);
  });

  it('surfaces receivables flooring and payables credit exclusions as notes', () => {
    const result = base();
    expect(
      result.notes.some((n) => /floor each shop outstanding at zero/i.test(n)),
    ).toBe(true);
    expect(
      result.notes.some((n) => /excludes supplier credits/i.test(n)),
    ).toBe(true);
    expect(
      result.notes.some((n) => /source_type=supplier_payment/i.test(n)),
    ).toBe(true);
    const mismatch = base({
      domainReceivablesTotal: 110000,
      booksArBalance: 100000,
    });
    expect(mismatch.ar.status).toBe('mismatch');
    expect(mismatch.notes.some((n) => /floor each shop/i.test(n))).toBe(true);
  });

  it('honors a custom finite non-negative tolerance', () => {
    const tight = base({
      domainReceivablesTotal: 100000.5,
      booksArBalance: 100000,
      tolerance: 0.01,
    });
    expect(tight.ar.status).toBe('mismatch');
    expect(tight.ar.delta).toBe(0.5);

    const loose = base({
      domainReceivablesTotal: 100000.5,
      booksArBalance: 100000,
      tolerance: 1,
    });
    expect(loose.ar.status).toBe('match');
    expect(loose.tolerance).toBe(1);
  });

  it('rejects invalid or empty dates with inconclusive reasons', () => {
    expect(isValidBusinessYmd('2026-10-15')).toBe(true);
    expect(isValidBusinessYmd('2026-02-31')).toBe(false);
    expect(isValidBusinessYmd('')).toBe(false);
    expect(isValidBusinessYmd('not-a-date')).toBe(false);

    for (const overrides of [
      { asOfDate: '', todayBusinessDate: today },
      { asOfDate: today, todayBusinessDate: '' },
      { asOfDate: '2026-02-31', todayBusinessDate: today },
      { asOfDate: 'nope', todayBusinessDate: 'nope' },
    ] as const) {
      const result = base(overrides);
      expect(result.ar.status).toBe('inconclusive');
      expect(result.ap.status).toBe('inconclusive');
      expect(result.ar.reason).toMatch(/YYYY-MM-DD/i);
      expect(result.ap.reason).toBe(result.ar.reason);
      expect(Number.isFinite(result.ar.delta)).toBe(true);
      expect(Number.isFinite(result.ap.delta)).toBe(true);
    }
  });

  it('returns inconclusive for non-finite money inputs without NaN deltas', () => {
    const arBad = base({ domainReceivablesTotal: Number.NaN });
    expect(arBad.ar.status).toBe('inconclusive');
    expect(arBad.ar.reason).toMatch(/AR money inputs must be finite/i);
    expect(Number.isFinite(arBad.ar.delta)).toBe(true);
    expect(arBad.ap.status).toBe('match');

    const apBad = base({ booksApBalance: Number.POSITIVE_INFINITY });
    expect(apBad.ap.status).toBe('inconclusive');
    expect(apBad.ap.reason).toMatch(/AP money inputs must be finite/i);
    expect(Number.isFinite(apBad.ap.delta)).toBe(true);
    expect(apBad.ar.status).toBe('match');

    const pendingBad = base({ pendingSupplierPaymentTotal: Number.NaN });
    expect(pendingBad.ap.status).toBe('inconclusive');
    expect(pendingBad.ap.reason).toMatch(/pendingSupplierPaymentTotal/i);
  });

  it('returns inconclusive for invalid tolerance without substituting a default', () => {
    const negative = base({ tolerance: -1 });
    expect(negative.ar.status).toBe('inconclusive');
    expect(negative.ap.status).toBe('inconclusive');
    expect(negative.ar.reason).toMatch(/Tolerance must be a finite number/i);
    expect(negative.tolerance).toBe(-1);

    const nanTol = base({ tolerance: Number.NaN });
    expect(nanTol.ar.status).toBe('inconclusive');
    expect(nanTol.ap.status).toBe('inconclusive');
    expect(Number.isNaN(nanTol.tolerance)).toBe(true);
  });

  it('fails closed on invalid booksEntryCount or entryLimit', () => {
    const badCount = base({ booksEntryCount: -1 });
    expect(badCount.ar.status).toBe('inconclusive');
    expect(badCount.ap.status).toBe('inconclusive');
    expect(badCount.ar.reason).toMatch(/booksEntryCount must be a finite non-negative integer/i);

    const floatCount = base({ booksEntryCount: 1.5 });
    expect(floatCount.ar.status).toBe('inconclusive');
    expect(floatCount.ar.reason).toMatch(/booksEntryCount/i);

    const badLimit = base({ entryLimit: 0 });
    expect(badLimit.ar.status).toBe('inconclusive');
    expect(badLimit.ap.status).toBe('inconclusive');
    expect(badLimit.ar.reason).toMatch(/entryLimit must be a finite positive integer/i);
  });

  it('applies precedence: invalid inputs before historical and entry-limit checks', () => {
    const invalidOverHistorical = base({
      asOfDate: '2026-10-01',
      tolerance: -0.5,
    });
    expect(invalidOverHistorical.ar.reason).toMatch(/Tolerance must be a finite number/i);

    const invalidOverLimit = base({
      booksEntryCount: CASH_BANK_JOURNAL_ENTRY_LIMIT,
      booksArBalance: Number.NaN,
      tolerance: -1,
    });
    expect(invalidOverLimit.ar.reason).toMatch(/Tolerance must be a finite number/i);

    const historicalOverLimit = base({
      asOfDate: '2026-10-01',
      booksEntryCount: CASH_BANK_JOURNAL_ENTRY_LIMIT,
    });
    expect(historicalOverLimit.ar.reason).toMatch(/not today/i);
  });
});
