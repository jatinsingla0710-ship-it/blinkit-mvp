import { describe, expect, it } from 'vitest';
import {
  emptyCashBankJournalCompleteness,
  resolveCashBankJournalCompleteness,
  type CashBankJournalCompleteness,
} from './cash-bank';
import {
  composeArApReconciliation,
  composeArApReconciliationFromSnapshots,
  parsePendingSupplierPaymentJournals,
} from './ar-ap-reconciliation-load';

const today = '2026-10-18';

function completeBooks(): CashBankJournalCompleteness {
  return emptyCashBankJournalCompleteness();
}

function baseCompose(
  overrides: Partial<Parameters<typeof composeArApReconciliation>[0]> = {},
) {
  return composeArApReconciliation({
    asOfDate: today,
    todayBusinessDate: today,
    domainReceivablesTotal: 100000,
    domainPayablesTotal: 40000,
    booksArBalance: 100000,
    booksApBalance: 40000,
    journalCompleteness: completeBooks(),
    pending: { ok: true, pendingTotal: 0, pendingCount: 0 },
    ...overrides,
  });
}

describe('parsePendingSupplierPaymentJournals', () => {
  it('accepts a valid pendingTotal / pendingCount payload', () => {
    const parsed = parsePendingSupplierPaymentJournals({
      data: { pendingTotal: 12.5, pendingCount: 2 },
      error: null,
    });
    expect(parsed).toEqual({
      ok: true,
      pendingTotal: 12.5,
      pendingCount: 2,
    });
  });

  it('accepts explicit zero pendingTotal and pendingCount', () => {
    const parsed = parsePendingSupplierPaymentJournals({
      data: { pendingTotal: 0, pendingCount: 0 },
      error: null,
    });
    expect(parsed).toEqual({
      ok: true,
      pendingTotal: 0,
      pendingCount: 0,
    });
  });

  it('rejects RPC errors and malformed payloads instead of inventing zero', () => {
    expect(
      parsePendingSupplierPaymentJournals({
        data: { pendingTotal: 0, pendingCount: 0 },
        error: { message: 'Only admin can view pending supplier-payment journals' },
      }).ok,
    ).toBe(false);

    expect(
      parsePendingSupplierPaymentJournals({ data: null, error: null }).ok,
    ).toBe(false);

    expect(
      parsePendingSupplierPaymentJournals({
        data: { pendingTotal: -1, pendingCount: 0 },
        error: null,
      }).ok,
    ).toBe(false);

    expect(
      parsePendingSupplierPaymentJournals({
        data: { pendingTotal: 1, pendingCount: 1.5 },
        error: null,
      }).ok,
    ).toBe(false);

    // Number(null) / Number('') would become 0 — must not pass.
    for (const data of [
      { pendingTotal: null, pendingCount: 0 },
      { pendingCount: 0 },
      { pendingTotal: '', pendingCount: 0 },
      { pendingTotal: true, pendingCount: 0 },
      { pendingTotal: false, pendingCount: 0 },
      { pendingTotal: Number.NaN, pendingCount: 0 },
      { pendingTotal: Number.POSITIVE_INFINITY, pendingCount: 0 },
      { pendingTotal: 0, pendingCount: null },
      { pendingTotal: 0 },
      { pendingTotal: 0, pendingCount: '' },
      { pendingTotal: 0, pendingCount: true },
      { pendingTotal: 0, pendingCount: -1 },
      { pendingTotal: '0', pendingCount: 0 },
      { pendingTotal: 0, pendingCount: '0' },
    ]) {
      const parsed = parsePendingSupplierPaymentJournals({ data, error: null });
      expect(parsed.ok).toBe(false);
    }
  });
});

describe('composeArApReconciliation', () => {
  it('matches AR and AP when Books are complete and nothing is pending', () => {
    const result = baseCompose();
    expect(result.ar.status).toBe('match');
    expect(result.ap.status).toBe('match');
    expect(result.ar.delta).toBe(0);
    expect(result.ap.delta).toBe(0);
  });

  it('leaves AP inconclusive when supplier-payment journals are pending', () => {
    const result = baseCompose({
      pending: { ok: true, pendingTotal: 4000, pendingCount: 1 },
      domainPayablesTotal: 36000,
      booksApBalance: 40000,
    });
    expect(result.ar.status).toBe('match');
    expect(result.ap.status).toBe('inconclusive');
    expect(result.ap.reason).toMatch(/pending Books journal sync/i);
    expect(result.ap.delta).toBe(-4000);
  });

  it('treats pending RPC failure as AP inconclusive, never as zero pending', () => {
    const result = baseCompose({
      domainPayablesTotal: 40000,
      booksApBalance: 40000,
      pending: {
        ok: false,
        reason: 'Could not load pending supplier-payment journals.',
      },
    });
    expect(result.ar.status).toBe('match');
    expect(result.ap.status).toBe('inconclusive');
    expect(result.ap.reason).toMatch(/Could not load pending/i);
    // Would have been a match if pending were silently coerced to 0.
    expect(result.ap.status).not.toBe('match');
  });

  it('returns both sides inconclusive when Books completeness is truncated', () => {
    const truncated = resolveCashBankJournalCompleteness({
      entryExactCount: 2500,
      entryReturnedCount: 1000,
      lineExactCount: 3000,
      lineReturnedCount: 3000,
    });
    const result = baseCompose({ journalCompleteness: truncated });
    expect(result.ar.status).toBe('inconclusive');
    expect(result.ap.status).toBe('inconclusive');
    expect(result.ar.reason).toMatch(/incomplete|truncated/i);
    expect(result.ap.reason).toBe(result.ar.reason);
  });

  it('returns both sides inconclusive when Books completeness is unknown', () => {
    const unknown = resolveCashBankJournalCompleteness({
      entryExactCount: null,
      entryReturnedCount: 10,
      lineExactCount: 20,
      lineReturnedCount: 20,
    });
    const result = baseCompose({ journalCompleteness: unknown });
    expect(result.ar.status).toBe('inconclusive');
    expect(result.ap.status).toBe('inconclusive');
    expect(result.ar.reason).toMatch(/inconclusive|unknown|Could not establish/i);
  });

  it('does not claim a match when Books data is incomplete even if totals align', () => {
    const truncated = resolveCashBankJournalCompleteness({
      entryExactCount: 500,
      entryReturnedCount: 500,
      lineExactCount: 9000,
      lineReturnedCount: 8000,
    });
    const result = baseCompose({
      domainReceivablesTotal: 100000,
      booksArBalance: 100000,
      domainPayablesTotal: 40000,
      booksApBalance: 40000,
      journalCompleteness: truncated,
      pending: { ok: true, pendingTotal: 0, pendingCount: 0 },
    });
    expect(result.ar.status).toBe('inconclusive');
    expect(result.ap.status).toBe('inconclusive');
  });

  it('composes from existing snapshot field names without inventing totals', () => {
    const result = composeArApReconciliationFromSnapshots({
      asOfDate: today,
      todayBusinessDate: today,
      receivables: { totalOutstanding: 125000 },
      payables: { totalOutstanding: 35000 },
      cashBank: {
        asOfDate: today,
        moneyExpected: 100000,
        moneyToPay: 40000,
        journalCompleteness: completeBooks(),
      },
      pending: { ok: true, pendingTotal: 0, pendingCount: 0 },
    });
    expect(result.ar.status).toBe('mismatch');
    expect(result.ar.delta).toBe(25000);
    expect(result.ap.status).toBe('mismatch');
    expect(result.ap.delta).toBe(-5000);
  });
});
