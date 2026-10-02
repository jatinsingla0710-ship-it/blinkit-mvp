import { describe, expect, it } from 'vitest';
import { createAuthUser } from '../../src/fixtures';
import { withUserClient } from '../../src/client';

describe('RLS: suppliers + purchases (Phase 5A)', () => {
  it('lets admin create supplier, draft purchase, receive stock once', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `96300${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data: location, error: locError } = await client
        .from('operational_locations')
        .select('id')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      expect(locError).toBeNull();
      if (!location?.id) return; // empty DB — skip stock path

      const { data: sku, error: skuError } = await client
        .from('skus')
        .select('id')
        .is('deleted_at', null)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      expect(skuError).toBeNull();
      if (!sku?.id) return;

      const { data: supplier, error: supplierError } = await client.rpc(
        'admin_create_supplier',
        {
          p_name: `Phase5A Supplier ${Date.now()}`,
          p_mobile: null,
          p_is_active: true,
        },
      );
      expect(supplierError).toBeNull();
      const supplierId = (supplier as { id?: string } | null)?.id;
      expect(supplierId).toBeTruthy();

      const { data: beforeBal } = await client
        .from('inventory_balances')
        .select('on_hand_quantity')
        .eq('sku_id', sku.id)
        .eq('operational_location_id', location.id)
        .maybeSingle();
      const beforeQty = Number(beforeBal?.on_hand_quantity ?? 0);

      const bill = `P5A-${Date.now()}`;
      const { data: purchase, error: purchaseError } = await client.rpc(
        'admin_upsert_purchase_draft',
        {
          p_purchase_id: null,
          p_supplier_id: supplierId!,
          p_operational_location_id: location.id,
          p_purchase_date: '2026-10-02',
          p_bill_number: bill,
          p_tax_amount: 0,
          p_notes: 'Phase 5A test',
          p_items: [
            { sku_id: sku.id, quantity: 5, unit_cost: 12.5 },
          ],
        },
      );
      expect(purchaseError).toBeNull();
      const purchaseId = (purchase as { id?: string } | null)?.id;
      expect(purchaseId).toBeTruthy();

      const { data: receive1, error: receiveError } = await client.rpc(
        'admin_receive_purchase',
        { p_purchase_id: purchaseId! },
      );
      expect(receiveError).toBeNull();
      expect((receive1 as { alreadyReceived?: boolean }).alreadyReceived).toBe(
        false,
      );

      const { data: afterBal } = await client
        .from('inventory_balances')
        .select('on_hand_quantity')
        .eq('sku_id', sku.id)
        .eq('operational_location_id', location.id)
        .maybeSingle();
      expect(Number(afterBal?.on_hand_quantity ?? 0)).toBe(beforeQty + 5);

      const { data: receive2, error: receive2Error } = await client.rpc(
        'admin_receive_purchase',
        { p_purchase_id: purchaseId! },
      );
      expect(receive2Error).toBeNull();
      expect((receive2 as { alreadyReceived?: boolean }).alreadyReceived).toBe(
        true,
      );

      const { data: afterRetry } = await client
        .from('inventory_balances')
        .select('on_hand_quantity')
        .eq('sku_id', sku.id)
        .eq('operational_location_id', location.id)
        .maybeSingle();
      expect(Number(afterRetry?.on_hand_quantity ?? 0)).toBe(beforeQty + 5);

      const { data: movements } = await client
        .from('inventory_movements')
        .select('id, movement_type, quantity_delta, reference_type')
        .eq('sku_id', sku.id)
        .eq('operational_location_id', location.id)
        .eq('movement_type', 'RECEIPT')
        .eq('reference_type', 'purchase_item');
      const forPurchase = (movements ?? []).filter(
        (m) => Number(m.quantity_delta) === 5,
      );
      expect(forPurchase.length).toBeGreaterThanOrEqual(1);

      const { error: editError } = await client.rpc(
        'admin_upsert_purchase_draft',
        {
          p_purchase_id: purchaseId!,
          p_supplier_id: supplierId!,
          p_operational_location_id: location.id,
          p_purchase_date: '2026-10-02',
          p_bill_number: bill,
          p_tax_amount: 0,
          p_items: [{ sku_id: sku.id, quantity: 99, unit_cost: 1 }],
        },
      );
      expect(editError).not.toBeNull();
    });
  }, 60_000);

  it('blocks salesman from suppliers and purchases', async () => {
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `96400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(salesman.accessToken, async (client) => {
      const { data: suppliers, error } = await client
        .from('suppliers')
        .select('id')
        .limit(1);
      expect(error).toBeNull();
      expect(suppliers ?? []).toEqual([]);

      const { error: createError } = await client.rpc('admin_create_supplier', {
        p_name: 'Should Fail',
      });
      expect(createError).not.toBeNull();
    });
  });
});
