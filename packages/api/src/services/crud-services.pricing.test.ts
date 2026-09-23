import { describe, expect, it, vi } from 'vitest';
import { CrudServices } from './crud-services';
import type { DomainCrudRepositories } from '../repositories/supabase/create-supabase-domain-repositories';

const SKU_ID = '11111111-1111-4111-8111-111111111111';

function createServices(overrides: {
  createPrice?: ReturnType<typeof vi.fn>;
  closePrice?: ReturnType<typeof vi.fn>;
}) {
  const repos = {
    prices: {
      create: overrides.createPrice ?? vi.fn().mockResolvedValue({ id: 'price-1' }),
      softDelete: overrides.closePrice ?? vi.fn().mockResolvedValue(undefined),
    },
  };
  return {
    services: new CrudServices(repos as unknown as DomainCrudRepositories),
    repos,
  };
}

describe('CrudServices pricing methods', () => {
  it('rejects invalid price input before calling the repository', () => {
    const createPrice = vi.fn();
    const { services } = createServices({ createPrice });
    expect(() =>
      services.createPrice({
        skuId: SKU_ID,
        tradePrice: -10,
      }),
    ).toThrow();
    expect(createPrice).not.toHaveBeenCalled();
  });

  it('sets the first price after validation', async () => {
    const createPrice = vi.fn().mockResolvedValue({ id: 'price-1' });
    const { services } = createServices({ createPrice });
    await services.createPrice({
      skuId: SKU_ID,
      tradePrice: 1500,
      currency: 'INR',
    });
    expect(createPrice).toHaveBeenCalledWith({
      skuId: SKU_ID,
      tradePrice: 1500,
      currency: 'INR',
    });
  });

  it('updates current price via the same create path (atomic replace in RPC)', async () => {
    const createPrice = vi.fn().mockResolvedValue({ id: 'price-2' });
    const { services } = createServices({ createPrice });
    await services.createPrice({
      skuId: SKU_ID,
      tradePrice: 1600,
      currency: 'INR',
    });
    expect(createPrice).toHaveBeenCalledWith({
      skuId: SKU_ID,
      tradePrice: 1600,
      currency: 'INR',
    });
  });

  it('delegates closePrice to the pricing repository', async () => {
    const closePrice = vi.fn().mockResolvedValue(undefined);
    const { services } = createServices({ closePrice });
    await services.closePrice('price-1');
    expect(closePrice).toHaveBeenCalledWith('price-1');
  });
});
