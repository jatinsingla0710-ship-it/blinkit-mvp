import { describe, expect, it, vi } from 'vitest';
import { createOrdersRepository } from '@groaurum/api';

function thenableResult(data: unknown) {
  const result = { data, error: null };
  return {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve(result)),
    maybeSingle: async () => result,
    single: async () => result,
    eq: () => thenableResult(data),
    select: () => thenableResult(data),
    order: () => thenableResult(data),
  };
}

describe('Orders H1 assisted create via place_assisted_order', () => {
  it('createOrdersRepository.create calls place_assisted_order (not orders insert)', async () => {
    const orderId = 'a1000000-0000-4000-8000-000000000099';
    const orderRow = {
      id: orderId,
      shop_id: 'shop-1',
      service_area_id: 'area-1',
      source: 'SALESMAN_ASSISTED',
      created_by_profile_id: 'admin-1',
      status: 'AWAITING_CUSTOMER_CONFIRMATION',
      subtotal: 1000,
      adjustments: 0,
      total: 1000,
      currency: 'INR',
      created_at: '2026-08-21T10:00:00.000Z',
      updated_at: '2026-08-21T10:00:00.000Z',
    };
    const rpc = vi.fn(async () => ({ data: orderId, error: null }));
    const from = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: orderRow, error: null }),
            }),
            order: () => thenableResult([orderRow]),
          }),
          insert: () => {
            throw new Error('direct orders insert must not be used');
          },
        };
      }
      if (table === 'order_lines') {
        return {
          select: () => ({
            eq: () => thenableResult([]),
          }),
          insert: () => {
            throw new Error('direct order_lines insert must not be used');
          },
        };
      }
      return thenableResult([]);
    });

    const repo = createOrdersRepository({ rpc, from } as never);
    const created = await repo.create({
      shopId: 'shop-1',
      serviceAreaId: 'area-1',
      source: 'SALESMAN_ASSISTED',
      createdByProfileId: 'salesman-1',
      lines: [{ skuId: 'sku-1', quantity: 10, agreedUnitPrice: 100 }],
    });

    expect(rpc).toHaveBeenCalledWith('place_assisted_order', {
      p_shop_id: 'shop-1',
      p_service_area_id: 'area-1',
      p_lines: [{ skuId: 'sku-1', quantity: 10, agreedUnitPrice: 100 }],
      p_notes: 'Assisted order · attributed salesman salesman-1',
    });
    expect(created.id).toBe(orderId);
    expect(created.status).toBe('AWAITING_CUSTOMER_CONFIRMATION');
  });
});
