import { describe, expect, it } from 'vitest';
import {
  formatPaymentsOverview,
  reconcilePaymentStatus,
  reconciliationStatusLabel,
} from './payments-recon';

describe('reconcilePaymentStatus', () => {
  it('returns MATCHED only when PAID with provider_reference', () => {
    expect(
      reconcilePaymentStatus({
        status: 'PAID',
        providerReference: 'pay_abc123',
      }),
    ).toBe('MATCHED');
  });

  it('returns PENDING_VERIFICATION when PAID without provider_reference', () => {
    expect(
      reconcilePaymentStatus({
        status: 'PAID',
        providerReference: null,
      }),
    ).toBe('PENDING_VERIFICATION');
    expect(
      reconcilePaymentStatus({
        status: 'PAID',
        providerReference: '   ',
      }),
    ).toBe('PENDING_VERIFICATION');
  });

  it('returns PENDING_VERIFICATION for PAYMENT_PENDING', () => {
    expect(
      reconcilePaymentStatus({
        status: 'PAYMENT_PENDING',
        providerReference: 'pay_abc',
      }),
    ).toBe('PENDING_VERIFICATION');
  });

  it('returns NOT_CONFIGURED when bank confirmation is globally false', () => {
    expect(
      reconcilePaymentStatus({
        status: 'PAID',
        providerReference: 'pay_abc',
        bankConfirmationConfigured: false,
      }),
    ).toBe('NOT_CONFIGURED');
  });

  it('never returns MATCHED without evidence', () => {
    for (const status of ['UNPAID', 'FAILED', 'REFUNDED', 'PAYMENT_PENDING']) {
      expect(
        reconcilePaymentStatus({
          status,
          providerReference: null,
        }),
      ).not.toBe('MATCHED');
    }
  });

  it('labels statuses for UI', () => {
    expect(reconciliationStatusLabel('MATCHED')).toBe('Matched');
    expect(reconciliationStatusLabel('PENDING_VERIFICATION')).toBe(
      'Pending verification',
    );
    expect(reconciliationStatusLabel('NOT_CONFIGURED')).toBe('Not configured');
  });
});

describe('formatPaymentsOverview', () => {
  it('formats overview amounts and evidence-based recon flag', () => {
    const vm = formatPaymentsOverview({
      asOfDate: '2026-08-27',
      sales: 1000,
      received: 800,
      pendingCustomerPayment: 200,
      withDeliveryBoys: 150,
      settledToCompany: 50,
      online: 400,
      cash: 400,
      paymentBankConfirmationConfigured: true,
      reconciliationGlobalStatus: 'EVIDENCE_BASED',
    });
    expect(vm.asOfDate).toBe('2026-08-27');
    expect(vm.salesLabel).toMatch(/₹/);
    expect(vm.reconciliationGlobalStatus).toBe('EVIDENCE_BASED');
    expect(vm.paymentBankConfirmationConfigured).toBe(true);
  });

  it('marks NOT_CONFIGURED when bank confirmation is off', () => {
    const vm = formatPaymentsOverview({
      paymentBankConfirmationConfigured: false,
    });
    expect(vm.reconciliationGlobalStatus).toBe('NOT_CONFIGURED');
  });
});
