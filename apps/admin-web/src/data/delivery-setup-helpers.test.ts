import { describe, expect, it } from 'vitest';
import {
  buildDeliverySetupGuidance,
  formatPackAssignSuccess,
  friendlyTimeSlotLabel,
  mapDeliveryBoyUiStatus,
  mapVehicleUiStatus,
  resolveVehicleIdForRpc,
} from '@/data/delivery-setup-helpers';

describe('delivery setup helpers', () => {
  it('guides add driver when no delivery boys', () => {
    const g = buildDeliverySetupGuidance(
      {
        assigned: false,
        needsAttention: true,
        reason: 'No available delivery boy',
        missingResources: ['drivers'],
      },
      { availableDrivers: 0, activeDrivers: 0 },
    );
    expect(g?.showAddDriver).toBe(true);
    expect(g?.showAssignTrip).toBe(false);
    expect(g?.message).toMatch(/packed successfully/i);
  });

  it('guides manual assign when driver exists but auto failed', () => {
    const g = buildDeliverySetupGuidance(
      {
        assigned: false,
        needsAttention: true,
        missingResources: ['manual_assign'],
      },
      { availableDrivers: 2, availableVehicles: 1 },
    );
    expect(g?.showAssignTrip).toBe(true);
    expect(g?.showAddDriver).toBe(false);
  });

  it('formatPackAssignSuccess mentions own vehicle when flagged', () => {
    expect(
      formatPackAssignSuccess({ assigned: true, usesOwnVehicle: true }),
    ).toMatch(/own vehicle/i);
    expect(formatPackAssignSuccess({ assigned: true })).toBe(
      'Order packed and assigned for delivery',
    );
  });

  it('maps delivery boy operational labels', () => {
    expect(
      mapDeliveryBoyUiStatus({
        employmentStatus: 'ACTIVE',
        operationalStatus: 'ON_ROUTE',
      }),
    ).toBe('On Delivery');
    expect(
      mapDeliveryBoyUiStatus({
        employmentStatus: 'INACTIVE',
        operationalStatus: 'AVAILABLE',
      }),
    ).toBe('Inactive');
  });

  it('maps vehicle status labels', () => {
    expect(mapVehicleUiStatus('AVAILABLE', true)).toBe('Available');
    expect(mapVehicleUiStatus('ON_ROUTE', true)).toBe('In Use');
    expect(mapVehicleUiStatus('MAINTENANCE', true)).toBe('Maintenance');
  });

  it('friendlyTimeSlotLabel simplifies seeded slots', () => {
    expect(friendlyTimeSlotLabel('Morning (9–11)')).toBe('Morning');
    expect(friendlyTimeSlotLabel('4–6')).toBe('Evening');
  });

  it('resolveVehicleIdForRpc sends null for own vehicle', () => {
    expect(resolveVehicleIdForRpc('__own_vehicle__')).toBeNull();
    expect(resolveVehicleIdForRpc('veh-1')).toBe('veh-1');
  });
});
