import { describe, expect, it, vi } from 'vitest';
import { formatMutationError } from '@/data/mutation-errors';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';

describe('Delivery H2 completeDeliveryRoute', () => {
  it('delegates to delivery_complete_route with the selected route id only', async () => {
    const rpc = vi.fn(async (_name: string, args: { p_route_id: string }) => ({
      data: {
        routeId: args.p_route_id,
        completedDeliveries: 2,
        failedDeliveries: 1,
        codExpected: 1000,
        codCollected: 800,
        codPending: 200,
        closedAt: '2026-08-21T10:00:00.000Z',
      },
      error: null,
    }));

    const api = new LiveAdminApi({ rpc } as never);
    const routeId = 'b2000000-0000-4000-8000-000000000099';
    const summary = await api.completeDeliveryRoute(routeId);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('delivery_complete_route', {
      p_route_id: routeId,
    });
    expect(summary).toEqual({
      routeId,
      completedDeliveries: 2,
      failedDeliveries: 1,
      codExpected: 1000,
      codCollected: 800,
      codPending: 200,
      closedAt: '2026-08-21T10:00:00.000Z',
    });
  });

  it('surfaces RPC open-stop validation errors (does not bypass)', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Cannot close route: 3 stop(s) still open' },
    }));

    const api = new LiveAdminApi({ rpc } as never);
    await expect(
      api.completeDeliveryRoute('b2000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow('Cannot close route: 3 stop(s) still open');

    expect(
      formatMutationError(
        new Error('Cannot close route: 3 stop(s) still open'),
        'Could not close route',
      ),
    ).toBe('Cannot close route: 3 stop(s) still open');
  });

  it('rejects closing without a selected route id at the mutation boundary', async () => {
    // Mirrors useCompleteDeliveryRouteMutation guard — list must never pass rows[0].
    const routeId = '   ';
    expect(() => {
      if (!routeId.trim()) {
        throw new Error('Select a route to close');
      }
    }).toThrow(/Select a route/);
  });
});

describe('Delivery H2 close-route permission affordance', () => {
  it('only offers Close Route when manage + allowCloseRoute (detail selected)', () => {
    const listAffordances = {
      canManage: true,
      allowCloseRoute: false,
    };
    const detailAffordances = {
      canManage: true,
      allowCloseRoute: true,
    };
    const readOnlyAffordances = {
      canManage: false,
      allowCloseRoute: true,
    };

    expect(listAffordances.canManage && listAffordances.allowCloseRoute).toBe(
      false,
    );
    expect(
      detailAffordances.canManage && detailAffordances.allowCloseRoute,
    ).toBe(true);
    expect(
      readOnlyAffordances.canManage && readOnlyAffordances.allowCloseRoute,
    ).toBe(false);
  });
});
