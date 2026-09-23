import { describe, expect, it } from 'vitest';
import {
  calculateMonthlySalarySummary,
  countScheduledWorkingDays,
  summarizeAttendanceStatuses,
} from './salesman-salary';
import { hasPermission } from '@groaurum/auth';

describe('Salesman H4 working days', () => {
  it('excludes Sundays when weekly off is Sunday', () => {
    // August 2026: 31 days, Sundays = 2,9,16,23,30 → 5 Sundays
    // Working Mon–Sat → 31 - 5 = 26
    const scheduled = countScheduledWorkingDays({
      year: 2026,
      month: 8,
      workingDays: [1, 2, 3, 4, 5, 6],
      weeklyOffDow: 0,
    });
    expect(scheduled).toBe(26);
  });

  it('excludes approved holidays from scheduled working days', () => {
    const scheduled = countScheduledWorkingDays({
      year: 2026,
      month: 8,
      workingDays: [1, 2, 3, 4, 5, 6],
      weeklyOffDow: 0,
      holidayDates: ['2026-08-15'], // Saturday Independence Day
    });
    expect(scheduled).toBe(25);
  });

  it('does not treat weekly off as a working day even if listed', () => {
    const scheduled = countScheduledWorkingDays({
      year: 2026,
      month: 8,
      workingDays: [0, 1, 2, 3, 4, 5, 6],
      weeklyOffDow: 0,
    });
    expect(scheduled).toBe(26);
  });
});

describe('Salesman H4 salary calculation', () => {
  it('uses scheduled working days denominator (not fixed 26)', () => {
    const summary = calculateMonthlySalarySummary({
      monthlySalary: 20000,
      dailyAllowance: 2000,
      otherAllowance: 0,
      scheduledWorkingDays: 26,
      presentDays: 24,
      paidLeaveDays: 0,
      unpaidLeaveDays: 2,
      weeklyOffDays: 5,
      holidayDays: 0,
      absentDays: 0,
    });
    expect(summary.dailyRate).toBeCloseTo(20000 / 26, 5);
    expect(summary.unpaidDeduction).toBeCloseTo(2 * (20000 / 26), 5);
    expect(summary.finalPayable).toBeCloseTo(
      20000 - 2 * (20000 / 26) + 2000,
      5,
    );
  });

  it('does not deduct paid leave or weekly offs', () => {
    const summary = calculateMonthlySalarySummary({
      monthlySalary: 20000,
      dailyAllowance: 0,
      otherAllowance: 500,
      scheduledWorkingDays: 25,
      presentDays: 20,
      paidLeaveDays: 3,
      unpaidLeaveDays: 0,
      weeklyOffDays: 4,
      holidayDays: 1,
      absentDays: 0,
    });
    expect(summary.unpaidDeduction).toBe(0);
    expect(summary.finalPayable).toBe(20500);
  });

  it('summarizes attendance statuses honestly', () => {
    expect(
      summarizeAttendanceStatuses([
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'WEEKLY_OFF' },
        { status: 'UNPAID_LEAVE' },
        { status: 'PAID_LEAVE' },
        { status: 'HOLIDAY' },
        { status: 'ABSENT' },
      ]),
    ).toEqual({
      presentDays: 2,
      paidLeaveDays: 1,
      unpaidLeaveDays: 1,
      weeklyOffDays: 1,
      holidayDays: 1,
      absentDays: 1,
    });
  });
});

describe('Salesman H4 permission gates', () => {
  it('super_admin can manage salesmen', () => {
    expect(
      hasPermission({ roles: ['super_admin'], permission: 'salesmen:manage' }),
    ).toBe(true);
  });

  it('read_only cannot manage salesmen', () => {
    expect(
      hasPermission({ roles: ['read_only'], permission: 'salesmen:manage' }),
    ).toBe(false);
  });
});
