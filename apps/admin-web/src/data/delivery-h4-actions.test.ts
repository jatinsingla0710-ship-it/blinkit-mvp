import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';

describe('Delivery H4 start / in-progress / collect COD', () => {
  it('startDeliveryRoute delegates to delivery_start_route', async () => {
    const rpc = vi.fn(async () => ({ data: 'route-1', error: null }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.startDeliveryRoute('route-1');
    expect(rpc).toHaveBeenCalledWith('delivery_start_route', {
      p_route_id: 'route-1',
    });
  });

  it('markStopInProgress delegates to delivery_mark_stop_in_progress', async () => {
    const rpc = vi.fn(async () => ({ data: 'stop-1', error: null }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.markStopInProgress('stop-1');
    expect(rpc).toHaveBeenCalledWith('delivery_mark_stop_in_progress', {
      p_stop_id: 'stop-1',
    });
  });

  it('collectDeliveryCod delegates to delivery_collect_cod', async () => {
    const rpc = vi.fn(async () => ({ data: 'pay-1', error: null }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.collectDeliveryCod('ord-1', 500, 'UPI_ON_DELIVERY');
    expect(rpc).toHaveBeenCalledWith('delivery_collect_cod', {
      p_order_id: 'ord-1',
      p_collected_amount: 500,
      p_collection_method: 'UPI_ON_DELIVERY',
    });
  });

  it('surfaces RPC errors from startDeliveryRoute', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Route cannot be started from status COMPLETED' },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(api.startDeliveryRoute('route-1')).rejects.toThrow(
      /cannot be started/i,
    );
  });
});
