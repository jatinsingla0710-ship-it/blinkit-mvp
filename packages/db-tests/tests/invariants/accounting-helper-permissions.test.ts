import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  getPool,
  getServiceClient,
  withUserClient,
} from '../../src/client';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

const POST_JOURNAL =
  'public._accounting_post_journal(date, text, uuid, text, jsonb, uuid)';
const REVERSE_JOURNAL =
  'public._accounting_reverse_posted_journal(text, uuid, text, uuid, text, date, uuid, text[])';
const REFUND_REVERSALS =
  'public._accounting_post_sale_refund_reversals(uuid, uuid, uuid, boolean, uuid)';

describe('Phase 7B.2B: accounting helper EXECUTE privileges', () => {
  it('API roles cannot EXECUTE internal accounting helpers; postgres can', async () => {
    const pool = getPool();
    const { rows } = await pool.query<{
      anon_post: boolean;
      auth_post: boolean;
      service_post: boolean;
      postgres_post: boolean;
      anon_rev: boolean;
      auth_rev: boolean;
      service_rev: boolean;
      postgres_rev: boolean;
      anon_refund: boolean;
      auth_refund: boolean;
      service_refund: boolean;
      postgres_refund: boolean;
    }>(
      `SELECT
         has_function_privilege('anon', $1, 'EXECUTE') AS anon_post,
         has_function_privilege('authenticated', $1, 'EXECUTE') AS auth_post,
         has_function_privilege('service_role', $1, 'EXECUTE') AS service_post,
         has_function_privilege('postgres', $1, 'EXECUTE') AS postgres_post,
         has_function_privilege('anon', $2, 'EXECUTE') AS anon_rev,
         has_function_privilege('authenticated', $2, 'EXECUTE') AS auth_rev,
         has_function_privilege('service_role', $2, 'EXECUTE') AS service_rev,
         has_function_privilege('postgres', $2, 'EXECUTE') AS postgres_rev,
         has_function_privilege('anon', $3, 'EXECUTE') AS anon_refund,
         has_function_privilege('authenticated', $3, 'EXECUTE') AS auth_refund,
         has_function_privilege('service_role', $3, 'EXECUTE') AS service_refund,
         has_function_privilege('postgres', $3, 'EXECUTE') AS postgres_refund`,
      [POST_JOURNAL, REVERSE_JOURNAL, REFUND_REVERSALS],
    );

    const r = rows[0];
    expect(r.anon_post).toBe(false);
    expect(r.auth_post).toBe(false);
    expect(r.service_post).toBe(false);
    expect(r.postgres_post).toBe(true);

    expect(r.anon_rev).toBe(false);
    expect(r.auth_rev).toBe(false);
    expect(r.service_rev).toBe(false);
    expect(r.postgres_rev).toBe(true);

    expect(r.anon_refund).toBe(false);
    expect(r.auth_refund).toBe(false);
    expect(r.service_refund).toBe(false);
    expect(r.postgres_refund).toBe(true);
  });

  it('authenticated and service_role RPC cannot call helpers directly', async () => {
    const user = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `974${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    await withUserClient(
      user.accessToken,
      async (client) => {
        const { error } = await client.rpc('_accounting_post_journal', {
          p_entry_date: '2026-10-13',
          p_source_type: 'probe',
          p_source_id: randomUUID(),
          p_memo: 'should fail',
          p_lines: [
            { account_code: '1000', debit: 1, credit: 0 },
            { account_code: '4000', debit: 0, credit: 1 },
          ],
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501|Could not find/i,
        );
      },
      { refreshToken: user.refreshToken },
    );

    const service = getServiceClient();
    const { error: serviceError } = await service.rpc(
      '_accounting_reverse_posted_journal',
      {
        p_original_source_type: 'sale',
        p_original_source_id: randomUUID(),
        p_reversal_source_type: 'probe_reversal',
        p_reversal_source_id: randomUUID(),
        p_memo: 'should fail',
      },
    );
    expect(serviceError).toBeTruthy();
    expect(serviceError?.message ?? '').toMatch(
      /permission denied|not authorized|42501|Could not find/i,
    );
  });

  it('admin refund still posts sale_refund via nested DEFINER call', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `975${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const serviceAreaId = await insertServiceArea(pool, 'Helper Perms Refund');
    const shopId = await insertShop(pool, { serviceAreaId });
    const locationId = await insertOperationalLocation(pool);
    const { skuId } = await insertMinimalCatalogue(pool);

    await pool.query(
      `UPDATE public.skus
       SET moq = 1, quantity_step = 1, packs_per_carton = 1
       WHERE id = $1`,
      [skuId],
    );
    await pool.query(
      `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
       VALUES ($1, 250, $2)`,
      [skuId, admin.id],
    );
    await pool.query(
      `INSERT INTO public.inventory_balances (
         sku_id, operational_location_id, on_hand_quantity, reserved_quantity,
         average_unit_cost, stock_value
       ) VALUES ($1, $2, 20, 0, 100::numeric, round(20 * 100::numeric, 2))`,
      [skuId, locationId],
    );

    const sale = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_complete_counter_sale', {
          p_shop: { shopId },
          p_lines: [{ kind: 'CATALOGUE', skuId, quantity: 1 }],
          p_payment: { amountPaid: 250, method: 'CASH' },
          p_client_request_id: `perm-${randomUUID()}`,
        });
        if (error) throw error;
        return data as { orderId: string; saleId: string };
      },
      { refreshToken: admin.refreshToken },
    );

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: sale.orderId,
          p_reason: 'Privilege nested-call proof',
          p_restock: false,
        });
        expect(error).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const { rows } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'sale_refund' AND source_id = $1`,
      [sale.saleId],
    );
    expect(Number(rows[0].c)).toBe(1);
  });

  it('admin supplier payment delete still posts reversal via nested DEFINER call', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `973${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    let paymentId = '';
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data: supplier, error: supplierError } = await client.rpc(
          'admin_create_supplier',
          {
            p_name: `HelperPerm ${Date.now()}`,
            p_mobile: null,
            p_is_active: true,
          },
        );
        expect(supplierError).toBeNull();
        const supplierId = (supplier as { id: string }).id;

        const { data: purchase, error: purchaseError } = await client.rpc(
          'admin_upsert_purchase_draft',
          {
            p_purchase_id: null,
            p_supplier_id: supplierId,
            p_operational_location_id: locationId,
            p_purchase_date: '2026-10-13',
            p_bill_number: `HP-${randomUUID().slice(0, 8)}`,
            p_tax_amount: 0,
            p_notes: null,
            p_supply_type: 'UNSET',
            p_cgst_amount: 0,
            p_sgst_amount: 0,
            p_igst_amount: 0,
            p_items: [{ sku_id: skuId, quantity: 1, unit_cost: 40 }],
          },
        );
        expect(purchaseError).toBeNull();
        const purchaseId = (purchase as { id: string }).id;

        const { error: receiveError } = await client.rpc(
          'admin_receive_purchase',
          { p_purchase_id: purchaseId },
        );
        expect(receiveError).toBeNull();

        const { data: payment, error: paymentError } = await client.rpc(
          'admin_record_supplier_payment',
          {
            p_supplier_id: supplierId,
            p_payment_date: '2026-10-13',
            p_amount: 40,
            p_payment_method: 'CASH',
            p_reference_number: null,
            p_notes: null,
            p_purchase_id: purchaseId,
          },
        );
        expect(paymentError).toBeNull();
        paymentId = (payment as { id: string }).id;

        const sync = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: '2026-10-01',
          p_date_to: '2026-10-31',
        });
        expect(sync.error).toBeNull();

        const { error: delError } = await client.rpc(
          'admin_delete_supplier_payment',
          { p_payment_id: paymentId },
        );
        expect(delError).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const { rows } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'supplier_payment_reversal' AND source_id = $1`,
      [paymentId],
    );
    expect(Number(rows[0].c)).toBe(1);
  });
});
