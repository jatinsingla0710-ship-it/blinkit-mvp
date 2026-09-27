import { describe, expect, it } from 'vitest';
import type { SalesmanAttendance } from '@groaurum/api-client';
import { deriveAttendanceControls } from './attendance-controls';

function attendance(overrides: Partial<SalesmanAttendance> = {}): SalesmanAttendance {
  return {
    id: 'att-1',
    profileId: 'p1',
    workDate: '2026-09-26',
    status: 'PRESENT',
    dayStartedAt: null,
    dayEndedAt: null,
    dayStartedAtLabel: null,
    dayEndedAtLabel: null,
    ...overrides,
  };
}

const base = { enabled: true, isLoading: false, isError: false };

describe('deriveAttendanceControls — loading (F)', () => {
  it('disables Start and End Day while attendance is loading', () => {
    expect(
      deriveAttendanceControls({ ...base, isLoading: true, attendance: undefined }),
    ).toEqual({ view: 'loading', canStartDay: false, canEndDay: false });
  });

  it('treats unresolved attendance as loading, not as "not started"', () => {
    expect(deriveAttendanceControls({ ...base, attendance: undefined })).toEqual({
      view: 'loading',
      canStartDay: false,
      canEndDay: false,
    });
  });

  it('is unavailable without a profile', () => {
    expect(
      deriveAttendanceControls({ ...base, enabled: false, attendance: undefined }),
    ).toEqual({ view: 'unavailable', canStartDay: false, canEndDay: false });
  });
});

describe('deriveAttendanceControls — error (G)', () => {
  it('shows the error view and blocks both actions', () => {
    expect(
      deriveAttendanceControls({ ...base, isError: true, attendance: undefined }),
    ).toEqual({ view: 'error', canStartDay: false, canEndDay: false });
  });

  it('keeps actions blocked on error even if stale data exists', () => {
    expect(
      deriveAttendanceControls({ ...base, isError: true, attendance: null }),
    ).toMatchObject({ view: 'error', canStartDay: false, canEndDay: false });
  });
});

describe('deriveAttendanceControls — success', () => {
  it('offers Start Day when no attendance row exists yet', () => {
    expect(deriveAttendanceControls({ ...base, attendance: null })).toEqual({
      view: 'not_started',
      canStartDay: true,
      canEndDay: false,
    });
  });

  it('offers only End Day once the day has started', () => {
    expect(
      deriveAttendanceControls({
        ...base,
        attendance: attendance({ dayStartedAt: '2026-09-26T03:30:00Z' }),
      }),
    ).toEqual({ view: 'recorded', canStartDay: false, canEndDay: true });
  });

  it('offers neither once the day has ended', () => {
    expect(
      deriveAttendanceControls({
        ...base,
        attendance: attendance({
          dayStartedAt: '2026-09-26T03:30:00Z',
          dayEndedAt: '2026-09-26T12:30:00Z',
        }),
      }),
    ).toMatchObject({ canStartDay: false, canEndDay: false });
  });

  it('blocks Start Day on non-working days', () => {
    for (const status of ['WEEKLY_OFF', 'HOLIDAY', 'PAID_LEAVE', 'UNPAID_LEAVE'] as const) {
      expect(
        deriveAttendanceControls({ ...base, attendance: attendance({ status }) }),
      ).toMatchObject({ canStartDay: false, canEndDay: false });
    }
  });
});
