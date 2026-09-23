import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';
import {
  groupCodCustodyByPerson,
} from '@/data/live/deliveryH5Api';
import { selectedCollectionsTotal } from '@/components/payments/CodSettlementsPanel';
import type { CodCustodyCollectionRow } from '@/data/delivery-types';

function row(
  partial: Partial<CodCustodyCollectionRow> &
    Pick<CodCustodyCollectionRow, 'orderId' | 'amount' | 'deliveryProfileId'>,
): CodCustodyCollectionRow {
  return {
    orderCode: partial.orderCode ?? 'GA-1',
    shopName: partial.shopName ?? 'Shop',
    driverName: partial.driverName ?? 'John',
    amountLabel: partial.amountLabel ?? `₹${partial.amount}`,
    status: partial.status ?? 'WITH_DRIVER',
    statusLabel: partial.statusLabel ?? 'With Delivery Boy',
    collectedAt: partial.collectedAt ?? '2026-08-31T10:00:00Z',
    collectedAtLabel: partial.collectedAtLabel ?? '31 Aug',
    ...partial,
  };
}

describe('COD custody selection helpers', () => {
  it('sums only selected collections (partial handover of whole rows)', () => {
    const rows = [
      row({ orderId: 'a', amount: 500, deliveryProfileId: 'd1' }),
      row({ orderId: 'b', amount: 700, deliveryProfileId: 'd1' }),
      row({ orderId: 'c', amount: 800, deliveryProfileId: 'd1' }),
    ];
    expect(selectedCollectionsTotal(rows, new Set(['a', 'b', 'c']))).toBe(2000);
    expect(selectedCollectionsTotal(rows, new Set(['a', 'b']))).toBe(1200);
    expect(selectedCollectionsTotal(rows, new Set(['c']))).toBe(800);
  });

  it('groups collections by delivery boy without requiring aggregate row', () => {
    const groups = groupCodCustodyByPerson([
      row({
        orderId: 'a',
        amount: 500,
        deliveryProfileId: 'd1',
        driverName: 'John',
      }),
      row({
        orderId: 'b',
        amount: 700,
        deliveryProfileId: 'd1',
        driverName: 'John',
      }),
      row({
        orderId: 'c',
        amount: 300,
        deliveryProfileId: 'd2',
        driverName: 'Rita',
      }),
    ]);
    expect(groups).toHaveLength(2);
    const john = groups.find((g) => g.deliveryProfileId === 'd1');
    expect(john?.collectionCount).toBe(2);
    expect(john?.totalAmount).toBe(1200);
  });
});

describe('Delivery H5 settleDeliveryCodSelected', () => {
  it('calls admin_settle_delivery_cod_selected with order ids (not amount)', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        settlementId: 's1',
        appliedAmount: 1200,
        orderIds: ['a', 'b'],
        toStatus: 'RECEIVED_BY_MANAGER',
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.settleDeliveryCodSelected({
      deliveryProfileId: 'dl-1',
      orderIds: ['a', 'b'],
    });
    expect(rpc).toHaveBeenCalledWith('admin_settle_delivery_cod_selected', {
      p_delivery_profile_id: 'dl-1',
      p_order_ids: ['a', 'b'],
      p_reference: null,
      p_note: null,
    });
    expect(result['appliedAmount']).toBe(1200);
  });

  it('calls admin_confirm_owner_cod_receipt_selected with order ids', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        settlementId: 's2',
        appliedAmount: 500,
        orderIds: ['a'],
        toStatus: 'RECEIVED_BY_OWNER',
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.confirmOwnerCodReceiptSelected({
      deliveryProfileId: 'dl-1',
      orderIds: ['a'],
    });
    expect(rpc).toHaveBeenCalledWith(
      'admin_confirm_owner_cod_receipt_selected',
      {
        p_delivery_profile_id: 'dl-1',
        p_order_ids: ['a'],
        p_reference: null,
        p_note: null,
      },
    );
  });
});
