import { describe, expect, it } from 'vitest';
import { createAuthUser, insertMinimalCatalogue, insertOperationalLocation } from '../../src/fixtures';
import { getPool, withUserClient } from '../../src/client';

describe('RLS: ADMIN inventory adjustment RPC', () => {
  async function seedBalance(
    pool: ReturnType<typeof getPool>,
    options: { onHand: number; reserved: number },
  ) {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `96100${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.inventory_balances (
         sku_id, operational_location_id, on_hand_quantity, reserved_quantity
       ) VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [skuId, locationId, options.onHand, options.reserved],
    );

    return {
      admin,
      skuId,
      locationId,
      balanceId: rows[0].id,
    };
  }

  it('atomically applies a positive adjustment and writes ADMIN_ADJUSTMENT', async () => {
    const pool = getPool();
    const { admin, skuId, locationId, balanceId } = await seedBalance(pool, {
      onHand: 100,
      reserved: 10,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client.rpc('admin_adjust_inventory_balance', {
        p_balance_id: balanceId,
        p_new_on_hand_quantity: 140,
        p_reason: 'Cycle count up',
        p_actor_profile_id: admin.id,
      });
      expect(error).toBeNull();
      expect(Number((data as { on_hand_quantity?: number | string } | null)?.on_hand_quantity)).toBe(
        140,
      );
    });

    const balance = await pool.query<{
      on_hand_quantity: string;
      reserved_quantity: string;
    }>(
      `SELECT on_hand_quantity::text, reserved_quantity::text
       FROM public.inventory_balances WHERE id = $1`,
      [balanceId],
    );
    expect(balance.rows[0].on_hand_quantity).toBe('140.000');
    expect(balance.rows[0].reserved_quantity).toBe('10.000');

    const movements = await pool.query<{
      movement_type: string;
      quantity_delta: string;
      reason: string | null;
      actor_profile_id: string | null;
      operational_location_id: string;
      sku_id: string;
    }>(
      `SELECT movement_type, quantity_delta::text, reason, actor_profile_id,
              operational_location_id, sku_id
       FROM public.inventory_movements
       WHERE sku_id = $1
       ORDER BY created_at DESC`,
      [skuId],
    );

    expect(movements.rows).toHaveLength(1);
    expect(movements.rows[0]).toMatchObject({
      movement_type: 'ADMIN_ADJUSTMENT',
      quantity_delta: '40.000',
      reason: 'Cycle count up',
      actor_profile_id: admin.id,
      operational_location_id: locationId,
      sku_id: skuId,
    });
  });

  it('atomically applies a negative adjustment', async () => {
    const pool = getPool();
    const { admin, skuId, balanceId } = await seedBalance(pool, {
      onHand: 100,
      reserved: 10,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { error } = await client.rpc('admin_adjust_inventory_balance', {
        p_balance_id: balanceId,
        p_new_on_hand_quantity: 85,
        p_reason: 'Damage write-down',
        p_actor_profile_id: admin.id,
      });
      expect(error).toBeNull();
    });

    const movements = await pool.query<{ quantity_delta: string }>(
      `SELECT quantity_delta::text
       FROM public.inventory_movements
       WHERE sku_id = $1 AND movement_type = 'ADMIN_ADJUSTMENT'`,
      [skuId],
    );
    expect(movements.rows[0].quantity_delta).toBe('-15.000');
  });

  it('does not insert a movement when delta is zero', async () => {
    const pool = getPool();
    const { admin, skuId, balanceId } = await seedBalance(pool, {
      onHand: 50,
      reserved: 5,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { error } = await client.rpc('admin_adjust_inventory_balance', {
        p_balance_id: balanceId,
        p_new_on_hand_quantity: 50,
        p_reason: 'No-op',
        p_actor_profile_id: admin.id,
      });
      expect(error).toBeNull();
    });

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM public.inventory_movements WHERE sku_id = $1`,
      [skuId],
    );
    expect(Number(count.rows[0].count)).toBe(0);
  });

  it('rejects on-hand below reserved without changing balance or ledger', async () => {
    const pool = getPool();
    const { admin, skuId, balanceId } = await seedBalance(pool, {
      onHand: 100,
      reserved: 40,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { error } = await client.rpc('admin_adjust_inventory_balance', {
        p_balance_id: balanceId,
        p_new_on_hand_quantity: 30,
        p_reason: 'Illegal',
        p_actor_profile_id: admin.id,
      });
      expect(error?.message).toMatch(/below reserved stock/i);
    });

    const balance = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances WHERE id = $1`,
      [balanceId],
    );
    expect(balance.rows[0].on_hand_quantity).toBe('100.000');

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM public.inventory_movements WHERE sku_id = $1`,
      [skuId],
    );
    expect(Number(count.rows[0].count)).toBe(0);
  });

  it('rejects READ_ONLY callers', async () => {
    const pool = getPool();
    const { balanceId } = await seedBalance(pool, { onHand: 20, reserved: 0 });
    const readOnly = await createAuthUser({
      roles: ['READ_ONLY'],
      mobile: `96200${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(readOnly.accessToken, async (client) => {
      const { error } = await client.rpc('admin_adjust_inventory_balance', {
        p_balance_id: balanceId,
        p_new_on_hand_quantity: 25,
        p_reason: 'Nope',
      });
      expect(error?.message).toMatch(/Admin role required/i);
    });
  });
});
