import type { SalesmanAttendance } from '@groaurum/api-client';

export type AttendanceView =
  | 'unavailable'
  | 'loading'
  | 'error'
  | 'not_started'
  | 'recorded';

export type AttendanceControls = {
  view: AttendanceView;
  canStartDay: boolean;
  canEndDay: boolean;
};

const NON_WORKING = new Set([
  'WEEKLY_OFF',
  'HOLIDAY',
  'PAID_LEAVE',
  'UNPAID_LEAVE',
]);

/**
 * Start/End Day are only offered once today's attendance is actually known.
 * A failed or pending lookup must never read as "day not started".
 */
export function deriveAttendanceControls(input: {
  enabled: boolean;
  isLoading: boolean;
  isError: boolean;
  attendance: SalesmanAttendance | null | undefined;
}): AttendanceControls {
  const blocked = { canStartDay: false, canEndDay: false };
  if (!input.enabled) return { view: 'unavailable', ...blocked };
  if (input.isError) return { view: 'error', ...blocked };
  if (input.isLoading || input.attendance === undefined) {
    return { view: 'loading', ...blocked };
  }

  const attendance = input.attendance;
  if (attendance === null) {
    return { view: 'not_started', canStartDay: true, canEndDay: false };
  }

  const hasStarted = Boolean(attendance.dayStartedAt);
  const nonWorking = NON_WORKING.has(attendance.status);
  return {
    view: 'recorded',
    canStartDay: !hasStarted && !nonWorking,
    canEndDay:
      attendance.status === 'PRESENT' && hasStarted && !attendance.dayEndedAt,
  };
}
