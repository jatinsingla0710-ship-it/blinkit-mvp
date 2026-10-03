import { describe, expect, it } from 'vitest';
import { createAuthUser } from '../../src/fixtures';
import { withUserClient } from '../../src/client';

describe('RLS: supplier payables (Phase 2)', () => {
  it('lets admin record and delete a supplier payment against a received purchase', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `96400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data: location } = await client
        .from('operational_locations')
        .select('id')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      const { data: sku } = await client
        .from('skus')
        .select('id')
        .is('deleted_at', null)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!location?.id || !sku?.id) return;

      const { data: supplier, error: supplierError } = await client.rpc(
        'admin_create_supplier',
        {
          p_name: `Payable Supplier ${Date.now()}`,
          p_is_active: true,
        },
      );
      expect(supplierError).toBeNull();
      const supplierId = (supplier as { id?: string } | null)?.id;
      expect(supplierId).toBeTruthy();

      const { data: purchase, error: purchaseError } = await client.rpc(
        'admin_upsert_purchase_draft',
        {
          p_purchase_id: null,
          p_supplier_id: supplierId!,
          p_operational_location_id: location.id,
          p_purchase_date: '2026-10-02',
          p_bill_number: `PAY-${Date.now()}`,
          p_tax_amount: 0,
          p_notes: null,
          p_items: [{ sku_id: sku.id, quantity: 2, unit_cost: 50 }],
        },
      );
      expect(purchaseError).toBeNull();
      const purchaseId = (purchase as { id?: string } | null)?.id;
      expect(purchaseId).toBeTruthy();

      const { error: receiveError } = await client.rpc('admin_receive_purchase', {
        p_purchase_id: purchaseId!,
      });
      expect(receiveError).toBeNull();

      const { data: payment, error: paymentError } = await client.rpc(
        'admin_record_supplier_payment',
        {
          p_supplier_id: supplierId!,
          p_payment_date: '2026-10-02',
          p_amount: 40,
          p_payment_method: 'UPI',
          p_reference_number: 'UTR-TEST',
          p_notes: 'Partial payment',
          p_purchase_id: purchaseId!,
        },
      );
      expect(paymentError).toBeNull();
      const paymentId = (payment as { id?: string } | null)?.id;
      expect(paymentId).toBeTruthy();
      expect(Number((payment as { amount?: number }).amount)).toBe(40);

      const { error: deleteError } = await client.rpc(
        'admin_delete_supplier_payment',
        { p_payment_id: paymentId! },
      );
      expect(deleteError).toBeNull();
    });
  });
});
