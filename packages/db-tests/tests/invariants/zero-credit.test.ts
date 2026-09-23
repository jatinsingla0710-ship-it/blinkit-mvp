import { describe, expect, it } from 'vitest';
import { isPgError } from '../../src/env';
import { getPool } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

describe('zero credit representation', () => {
  it('has no CREDIT payment method intent enum value', async () => {
    const pool = getPool();
    const { rows } = await pool.query<{ label: string }>(
      `SELECT e.enumlabel AS label
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname = 'payment_method_intent'`,
    );
    const labels = rows.map((row) => row.label);
    expect(labels).toContain('PAY_ONLINE_NOW');
    expect(labels).toContain('PAY_ON_DELIVERY');
    expect(labels).not.toContain('CREDIT');
  });

  it('has no CREDIT payment collection method enum value', async () => {
    const pool = getPool();
    const { rows } = await pool.query<{ label: string }>(
      `SELECT e.enumlabel AS label
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname = 'payment_collection_method'`,
    );
    const labels = rows.map((row) => row.label);
    expect(labels).not.toContain('CREDIT');
  });

  it('rejects inserting an invalid payment method intent', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Credit Guard');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);

    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `91${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });

    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });

    await expect(
      pool.query(
        `INSERT INTO public.payments (order_id, status, method_intent, amount)
         VALUES ($1, 'UNPAID', 'CREDIT', 100)`,
        [orderId],
      ),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '22P02'));
  });
});
