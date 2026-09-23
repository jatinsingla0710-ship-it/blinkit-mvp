import { describe, expect, it } from 'vitest';
import { mapDbRouteStopStatusToUi } from './route-stop-status-map';

describe('mapDbRouteStopStatusToUi', () => {
  it('maps every public.route_stop_status value to Admin UI stop status', () => {
    expect(mapDbRouteStopStatusToUi('PENDING')).toEqual({
      deliveryStatus: 'pending',
      deliveryStatusLabel: 'Pending',
    });
    expect(mapDbRouteStopStatusToUi('IN_PROGRESS')).toEqual({
      deliveryStatus: 'in_progress',
      deliveryStatusLabel: 'In Progress',
    });
    expect(mapDbRouteStopStatusToUi('COMPLETED')).toEqual({
      deliveryStatus: 'delivered',
      deliveryStatusLabel: 'Delivered',
    });
    expect(mapDbRouteStopStatusToUi('FAILED')).toEqual({
      deliveryStatus: 'failed',
      deliveryStatusLabel: 'Failed',
    });
    expect(mapDbRouteStopStatusToUi('SKIPPED')).toEqual({
      deliveryStatus: 'skipped',
      deliveryStatusLabel: 'Skipped',
    });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(mapDbRouteStopStatusToUi('completed').deliveryStatus).toBe(
      'delivered',
    );
    expect(mapDbRouteStopStatusToUi(' in_progress ').deliveryStatus).toBe(
      'in_progress',
    );
    expect(mapDbRouteStopStatusToUi('Failed').deliveryStatusLabel).toBe(
      'Failed',
    );
  });

  it('does not treat lowercase DB tokens as UI fixture names', () => {
    // Regression: prior LiveAdminApi cast toLowerCase() and checked for
    // "delivered" / "out_for_delivery", so COMPLETED → "completed" → pending.
    expect(mapDbRouteStopStatusToUi('COMPLETED').deliveryStatus).not.toBe(
      'pending',
    );
    expect(mapDbRouteStopStatusToUi('IN_PROGRESS').deliveryStatus).not.toBe(
      'pending',
    );
    expect(mapDbRouteStopStatusToUi('IN_PROGRESS').deliveryStatus).not.toBe(
      'out_for_delivery',
    );
  });

  it('falls back to pending for unknown or empty values', () => {
    expect(mapDbRouteStopStatusToUi(null).deliveryStatus).toBe('pending');
    expect(mapDbRouteStopStatusToUi(undefined).deliveryStatus).toBe('pending');
    expect(mapDbRouteStopStatusToUi('').deliveryStatus).toBe('pending');
    expect(mapDbRouteStopStatusToUi('LOADING').deliveryStatus).toBe('pending');
  });
});
