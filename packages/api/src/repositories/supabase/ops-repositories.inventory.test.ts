import { describe, expect, it, vi } from 'vitest';
import { createInventoryRepository } from './ops-repositories';

const BALANCE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SKU_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LOC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function balanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BALANCE_ID,
    sku_id: SKU_ID,
    operational_location_id: LOC_ID,
    on_hand_quantity: 100,
    reserved_quantity: 20,
    available_quantity: 80,
    updated_at: '2026-08-20T12:00:00.000Z',
    ...overrides,
  };
}

function createClient(options: {
  existing?: Record<string, unknown> | null;
  rpcResult?: { data: unknown; error: { message: string } | null };
}) {
  const existing = options.existing === undefined ? balanceRow() : options.existing;
  const rpc = vi.fn().mockResolvedValue(
    options.rpcResult ?? { data: balanceRow({ on_hand_quantity: 150 }), error: null },
  );

  const maybeSingle = vi.fn().mockResolvedValue({
    data: existing,
    error: null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { client: { rpc, from } as never, rpc, from };
}

describe('createInventoryRepository.update', () => {
  it('delegates adjustments to admin_adjust_inventory_balance RPC', async () => {
    const { client, rpc, from } = createClient({});
    const repo = createInventoryRepository(client);

    const row = await repo.update(BALANCE_ID, {
      skuId: SKU_ID,
      operationalLocationId: LOC_ID,
      onHandQuantity: 150,
      reason: 'Cycle count',
      actorProfileId: ACTOR_ID,
    });

    expect(rpc).toHaveBeenCalledWith('admin_adjust_inventory_balance', {
      p_balance_id: BALANCE_ID,
      p_new_on_hand_quantity: 150,
      p_reason: 'Cycle count',
      p_actor_profile_id: ACTOR_ID,
    });
    // Must not fall back to direct balance update / movement insert.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('inventory_balances');
    expect(row.onHandQuantity).toBe(150);
  });

  it('rejects reserved-stock violations before calling the RPC', async () => {
    const { client, rpc } = createClient({});
    const repo = createInventoryRepository(client);

    await expect(
      repo.update(BALANCE_ID, {
        skuId: SKU_ID,
        operationalLocationId: LOC_ID,
        onHandQuantity: 10,
        reason: 'Too low',
      }),
    ).rejects.toThrow(/below reserved stock/i);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('still calls RPC for zero-delta adjustments (no-op under lock)', async () => {
    const { client, rpc } = createClient({
      rpcResult: { data: balanceRow(), error: null },
    });
    const repo = createInventoryRepository(client);

    const row = await repo.update(BALANCE_ID, {
      skuId: SKU_ID,
      operationalLocationId: LOC_ID,
      onHandQuantity: 100,
      reason: 'No change',
    });

    expect(rpc).toHaveBeenCalledWith(
      'admin_adjust_inventory_balance',
      expect.objectContaining({
        p_balance_id: BALANCE_ID,
        p_new_on_hand_quantity: 100,
      }),
    );
    expect(row.onHandQuantity).toBe(100);
  });

  it('surfaces RPC reserved-stock errors', async () => {
    const { client, rpc } = createClient({
      existing: balanceRow({ reserved_quantity: 0 }),
      rpcResult: {
        data: null,
        error: {
          message:
            'Cannot set on-hand (5) below reserved stock (20) for this warehouse',
        },
      },
    });
    const repo = createInventoryRepository(client);

    await expect(
      repo.update(BALANCE_ID, {
        skuId: SKU_ID,
        operationalLocationId: LOC_ID,
        onHandQuantity: 5,
        reason: 'Race',
      }),
    ).rejects.toThrow(/below reserved stock/i);

    expect(rpc).toHaveBeenCalled();
  });
});
