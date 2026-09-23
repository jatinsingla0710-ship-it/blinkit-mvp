import { describe, expect, it, vi } from 'vitest';
import { createPricesRepository } from './catalogue-repositories';

describe('createPricesRepository', () => {
  it('uses admin_set_sku_price for first price and updates', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'price-1',
        sku_id: '11111111-1111-4111-8111-111111111111',
        trade_price: 240,
        currency: 'INR',
        effective_from: '2026-08-20T06:30:00.000Z',
        effective_to: null,
        recorded_by_profile_id: '22222222-2222-4222-8222-222222222222',
        created_at: '2026-08-20T06:30:00.000Z',
      },
      error: null,
    });
    const repo = createPricesRepository({ rpc } as never);

    const row = await repo.create({
      skuId: '11111111-1111-4111-8111-111111111111',
      tradePrice: 240,
      currency: 'INR',
      recordedByProfileId: '22222222-2222-4222-8222-222222222222',
    });

    expect(rpc).toHaveBeenCalledWith('admin_set_sku_price', {
      p_sku_id: '11111111-1111-4111-8111-111111111111',
      p_trade_price: 240,
      p_currency: 'INR',
      p_recorded_by_profile_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(rpc).not.toHaveBeenCalledWith(
      'admin_schedule_sku_price',
      expect.anything(),
    );
    expect(row).toMatchObject({
      id: 'price-1',
      skuId: '11111111-1111-4111-8111-111111111111',
      tradePrice: 240,
    });
  });

  it('does not fall back to direct table updates', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn();
    const repo = createPricesRepository({ rpc, from } as never);

    await expect(repo.update('price-1', { tradePrice: 1 } as never)).rejects.toThrow(
      /append-only/,
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('uses the trusted close RPC for price closing', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repo = createPricesRepository({ rpc } as never);

    await repo.softDelete('price-1');

    expect(rpc).toHaveBeenCalledWith(
      'admin_close_sku_price',
      expect.objectContaining({
        p_price_id: 'price-1',
      }),
    );
  });
});
