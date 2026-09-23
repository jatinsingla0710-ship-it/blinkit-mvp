import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';
import {
  isDoubleAssignmentError,
  notificationHonestyLabel,
} from '@/data/delivery-h5-honesty';

describe('Delivery H5 provisionDelivery', () => {
  it('invokes provision-delivery edge function with caller body', async () => {
    const invoke = vi.fn(async () => ({
      data: {
        profileId: 'dl-1',
        authUserId: 'dl-1',
        email: 'd@example.com',
        displayName: 'Dev',
        mobile: '919999999998',
        alreadyProvisioned: false,
        createdAuthUser: true,
        temporaryPasswordSet: true,
      },
      error: null,
    }));
    const api = new LiveAdminApi({
      functions: { invoke },
    } as never);

    const result = await api.provisionDelivery({
      displayName: 'Dev',
      mobile: '9999999998',
      email: 'd@example.com',
      temporaryPassword: 'TempPass12',
    });

    expect(invoke).toHaveBeenCalledWith('provision-delivery', {
      body: {
        displayName: 'Dev',
        mobile: '9999999998',
        email: 'd@example.com',
        temporaryPassword: 'TempPass12',
        isActive: true,
      },
    });
    expect(result.profileId).toBe('dl-1');
    expect(result.createdAuthUser).toBe(true);
  });
});

describe('Delivery H5 scheduleAndAssignDelivery', () => {
  it('calls admin_schedule_and_assign_delivery with rpc args', async () => {
    const rpc = vi.fn(async () => ({
      data: { routeId: 'rt-1', assigned: 2, createdRoute: true },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.scheduleAndAssignDelivery({
      orderIds: ['o1', 'o2'],
      deliveryProfileId: 'dl-1',
      vehicleId: 'v-1',
      deliveryDate: '2026-08-27',
      timeSlotId: 'slot-1',
      routeId: null,
      serviceAreaId: 'area-1',
    });
    expect(rpc).toHaveBeenCalledWith('admin_schedule_and_assign_delivery', {
      p_order_ids: ['o1', 'o2'],
      p_delivery_profile_id: 'dl-1',
      p_vehicle_id: 'v-1',
      p_delivery_date: '2026-08-27',
      p_time_slot_id: 'slot-1',
      p_route_id: null,
      p_service_area_id: 'area-1',
    });
  });

  it('surfaces double-assignment error message from rpc', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        message: 'Order o1 is already assigned to another route',
      },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(
      api.scheduleAndAssignDelivery({
        orderIds: ['o1'],
        deliveryProfileId: 'dl-1',
        vehicleId: 'v-1',
        deliveryDate: '2026-08-27',
        timeSlotId: 'slot-1',
      }),
    ).rejects.toThrow(/already assigned to another route/i);
  });
});

describe('Delivery H5 settleDeliveryCod', () => {
  it('calls admin_settle_delivery_cod', async () => {
    const rpc = vi.fn(async () => ({
      data: { settlementId: 's1', appliedAmount: 500, orderIds: ['o1'] },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.settleDeliveryCod({
      deliveryProfileId: 'dl-1',
      amount: 500,
      reference: 'CASH-1',
    });
    expect(rpc).toHaveBeenCalledWith('admin_settle_delivery_cod', {
      p_delivery_profile_id: 'dl-1',
      p_amount: 500,
      p_reference: 'CASH-1',
      p_note: null,
    });
    expect(result['settlementId']).toBe('s1');
  });

  it('calls admin_settle_delivery_cod_selected for multi-collection receive', async () => {
    const rpc = vi.fn(async () => ({
      data: { settlementId: 's2', appliedAmount: 2000, orderIds: ['a', 'b', 'c'] },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.settleDeliveryCodSelected({
      deliveryProfileId: 'dl-1',
      orderIds: ['a', 'b', 'c'],
    });
    expect(rpc).toHaveBeenCalledWith('admin_settle_delivery_cod_selected', {
      p_delivery_profile_id: 'dl-1',
      p_order_ids: ['a', 'b', 'c'],
      p_reference: null,
      p_note: null,
    });
    expect(result['appliedAmount']).toBe(2000);
  });
});

describe('Delivery H5 notification honesty', () => {
  it('labels unconfigured provider honestly', () => {
    expect(notificationHonestyLabel(false)).toBe(
      'Notification not configured',
    );
    expect(notificationHonestyLabel(true)).toBe('Notification queued');
  });

  it('detects double-assignment errors', () => {
    expect(
      isDoubleAssignmentError(
        'Order abc is already assigned to another route',
      ),
    ).toBe(true);
    expect(
      isDoubleAssignmentError(
        'Vehicle MH-01 is already assigned to another active route',
      ),
    ).toBe(true);
    expect(isDoubleAssignmentError('Admin role required')).toBe(false);
  });
});
