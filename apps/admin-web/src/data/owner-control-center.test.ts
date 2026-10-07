import { describe, expect, it } from 'vitest';
import {
  OWNER_CONTROL_QUICK_ACTIONS,
  buildUnreviewedAiDocumentsAlert,
  ownerControlQuickActionIds,
  pendingAiDocumentsHref,
  totalPendingAiDocuments,
} from './owner-control-center';

describe('Phase 23 owner control center', () => {
  it('exposes Scan Bill and Ask AI alongside money actions', () => {
    expect(ownerControlQuickActionIds()).toEqual([
      'new_sale',
      'new_purchase',
      'record_expense',
      'collect_payment',
      'scan_bill',
      'ask_ai',
    ]);
    const scan = OWNER_CONTROL_QUICK_ACTIONS.find((a) => a.id === 'scan_bill');
    const ask = OWNER_CONTROL_QUICK_ACTIONS.find((a) => a.id === 'ask_ai');
    expect(scan?.href).toBe('/purchases/scan');
    expect(ask?.href).toBe('/ask');
  });

  it('builds unreviewed AI documents attention only when scans are pending', () => {
    expect(
      buildUnreviewedAiDocumentsAlert({
        billScans: 0,
        receiptScans: 0,
        dayBookScans: 0,
        paymentProofScans: 0,
      }),
    ).toBeNull();

    const alert = buildUnreviewedAiDocumentsAlert({
      billScans: 2,
      receiptScans: 1,
      dayBookScans: 0,
      paymentProofScans: 0,
    });
    expect(alert?.id).toBe('unreviewed_ai_documents');
    expect(alert?.count).toBe(3);
    expect(alert?.href).toBe('/purchases/scan');
    expect(totalPendingAiDocuments({
      billScans: 2,
      receiptScans: 1,
      dayBookScans: 0,
      paymentProofScans: 0,
    })).toBe(3);
  });

  it('routes attention to the first scan surface that still has work', () => {
    expect(
      pendingAiDocumentsHref({
        billScans: 0,
        receiptScans: 3,
        dayBookScans: 1,
        paymentProofScans: 0,
      }),
    ).toBe('/expenses/scan');
    expect(
      pendingAiDocumentsHref({
        billScans: 0,
        receiptScans: 0,
        dayBookScans: 0,
        paymentProofScans: 2,
      }),
    ).toBe('/payments/scan');
  });
});
