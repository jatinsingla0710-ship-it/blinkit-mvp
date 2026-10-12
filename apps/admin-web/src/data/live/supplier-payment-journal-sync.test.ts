import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from './LiveAdminApi';

describe('LiveAdminApi recordSupplierPayment journal sync (Phase 6B.4)', () => {
  it('best-effort syncs journals after payment and reports synced status', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'admin_record_supplier_payment') {
        return {
          data: {
            id: 'pay-1',
            supplier_id: 's1',
            purchase_id: 'p1',
            payment_date: '2026-10-11',
            amount: 100,
            payment_method: 'UPI',
            reference_number: null,
            notes: null,
            created_at: '2026-10-11T10:00:00Z',
          },
          error: null,
        };
      }
      if (name === 'admin_sync_accounting_journals') {
        return { data: { posted: 1, skipped: 0 }, error: null };
      }
      return { data: null, error: { message: `unexpected rpc ${name}` } };
    });

    const api = new LiveAdminApi({ rpc } as never);
    const payment = await api.recordSupplierPayment({
      supplierId: 's1',
      paymentDate: '2026-10-11',
      amount: 100,
      paymentMethod: 'UPI',
      purchaseId: 'p1',
    });

    expect(rpc).toHaveBeenCalledWith(
      'admin_record_supplier_payment',
      expect.any(Object),
    );
    expect(rpc).toHaveBeenCalledWith(
      'admin_sync_accounting_journals',
      expect.objectContaining({
        p_date_from: '2026-10-11',
        p_date_to: '2026-10-11',
      }),
    );
    expect(payment.journalSync).toEqual({
      status: 'synced',
      posted: 1,
      skipped: 0,
    });
  });

  it('keeps the payment when sync fails and marks journalSync pending', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'admin_record_supplier_payment') {
        return {
          data: {
            id: 'pay-2',
            supplier_id: 's1',
            purchase_id: null,
            payment_date: '2026-10-11',
            amount: 50,
            payment_method: 'CASH',
            reference_number: null,
            notes: null,
            created_at: '2026-10-11T10:00:00Z',
          },
          error: null,
        };
      }
      if (name === 'admin_sync_accounting_journals') {
        return { data: null, error: { message: 'sync unavailable' } };
      }
      return { data: null, error: { message: `unexpected rpc ${name}` } };
    });

    const api = new LiveAdminApi({ rpc } as never);
    const payment = await api.recordSupplierPayment({
      supplierId: 's1',
      paymentDate: '2026-10-11',
      amount: 50,
      paymentMethod: 'CASH',
    });

    expect(payment.id).toBe('pay-2');
    expect(payment.journalSync?.status).toBe('pending');
    expect(payment.journalSync?.error).toMatch(/sync unavailable|Books/i);
  });
});
