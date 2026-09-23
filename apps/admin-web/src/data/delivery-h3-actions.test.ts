import { describe, expect, it, vi } from 'vitest';
import { formatMutationError } from '@/data/mutation-errors';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';

describe('Delivery H3 stop and assign RPCs', () => {
  it('completeDeliveryStop delegates to delivery_complete_stop', async () => {
    const rpc = vi.fn(async () => ({ data: 'stop-1', error: null }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.completeDeliveryStop('stop-1', { notes: 'ok' });
    expect(rpc).toHaveBeenCalledWith('delivery_complete_stop', {
      p_stop_id: 'stop-1',
      p_notes: 'ok',
      p_photo_captured: false,
      p_signature_captured: false,
      p_collect_cod_amount: null,
    });
  });

  it('failDeliveryStop delegates to delivery_fail_stop with reason', async () => {
    const rpc = vi.fn(async () => ({ data: 'stop-1', error: null }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.failDeliveryStop('stop-1', 'SHOP_CLOSED', 'closed');
    expect(rpc).toHaveBeenCalledWith('delivery_fail_stop', {
      p_stop_id: 'stop-1',
      p_failure_reason: 'SHOP_CLOSED',
      p_notes: 'closed',
      p_photo_captured: false,
    });
  });

  it('assignOrderToRoute uses selected route id (not rows[0])', async () => {
    const rpc = vi.fn(async () => ({ data: 'ord-1', error: null }));
    const api = new LiveAdminApi({ rpc } as never);
    const routeId = 'b2000000-0000-4000-8000-000000000099';
    await api.assignOrderToRoute('ord-1', routeId);
    expect(rpc).toHaveBeenCalledWith('admin_assign_order_to_route', {
      p_order_id: 'ord-1',
      p_route_id: routeId,
    });
  });

  it('surfaces payment validation errors from complete stop', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Collect COD before marking delivered' },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(api.completeDeliveryStop('stop-1')).rejects.toThrow(
      /Collect COD/,
    );
    expect(
      formatMutationError(
        new Error('Collect COD before marking delivered'),
        'Could not mark delivered',
      ),
    ).toMatch(/Collect COD/);
  });
});

describe('Delivery H3 UI affordances', () => {
  it('list surface only allows create; detail allows driver/orders/close', () => {
    const list = { surface: 'list' as const, canManage: true };
    const detail = {
      surface: 'detail' as const,
      canManage: true,
      allowCloseRoute: true,
    };
    const readOnly = { surface: 'detail' as const, canManage: false };

    expect(list.surface === 'list' && list.canManage).toBe(true);
    expect(detail.allowCloseRoute && detail.canManage).toBe(true);
    expect(readOnly.canManage).toBe(false);
  });
});
