/**
 * Salesman H4 — working-day and salary calculation helpers.
 * Denominator = scheduled working days in the month (working_days ∩ !weekly_off ∩ !holidays).
 * Never uses a silent fixed 26-day denominator.
 */

export type Dow = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DOW_LABELS: Record<Dow, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export type AttendanceStatusCode =
  | 'PRESENT'
  | 'ABSENT'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'HOLIDAY'
  | 'WEEKLY_OFF';

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dowUtc(d: Date): Dow {
  return d.getUTCDay() as Dow;
}

/** Days in calendar month that are scheduled working days. */
export function countScheduledWorkingDays(input: {
  year: number;
  month: number; // 1–12
  workingDays: readonly number[];
  weeklyOffDow: number;
  holidayDates?: readonly string[];
}): number {
  const { year, month, workingDays, weeklyOffDow } = input;
  const holidays = new Set(
    (input.holidayDates ?? []).map((h) => h.slice(0, 10)),
  );
  const workSet = new Set(workingDays.filter((d) => d !== weeklyOffDow));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const iso = toIsoDate(date);
    const dow = dowUtc(date);
    if (dow === weeklyOffDow) continue;
    if (!workSet.has(dow)) continue;
    if (holidays.has(iso)) continue;
    count += 1;
  }
  return count;
}

export type SalaryMonthSummaryInput = {
  monthlySalary: number;
  dailyAllowance: number;
  otherAllowance: number;
  scheduledWorkingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  absentDays: number;
};

export type SalaryMonthSummary = SalaryMonthSummaryInput & {
  dailyRate: number;
  unpaidDeduction: number;
  finalPayable: number;
  formulaLabel: string;
};

/**
 * Final payable =
 *   monthlySalary - (unpaidLeaveDays * dailyRate) + DA + other
 * where dailyRate = monthlySalary / scheduledWorkingDays
 * Weekly offs and holidays are not deducted.
 * Paid leave is not deducted.
 */
export function calculateMonthlySalarySummary(
  input: SalaryMonthSummaryInput,
): SalaryMonthSummary {
  const scheduled = Math.max(0, input.scheduledWorkingDays);
  const dailyRate =
    scheduled > 0 && Number.isFinite(input.monthlySalary)
      ? input.monthlySalary / scheduled
      : 0;
  const unpaidDeduction = Math.max(0, input.unpaidLeaveDays) * dailyRate;
  const finalPayable =
    Math.max(0, input.monthlySalary) -
    unpaidDeduction +
    Math.max(0, input.dailyAllowance) +
    Math.max(0, input.otherAllowance);

  return {
    ...input,
    dailyRate,
    unpaidDeduction,
    finalPayable,
    formulaLabel:
      scheduled > 0
        ? `Daily rate = monthly ÷ ${scheduled} scheduled working days; unpaid leave deducted; weekly off / holiday / paid leave not deducted; DA + other added.`
        : 'No scheduled working days in this month — cannot compute daily rate.',
  };
}

export function summarizeAttendanceStatuses(
  rows: readonly { status: AttendanceStatusCode }[],
): {
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  absentDays: number;
} {
  const out = {
    presentDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    weeklyOffDays: 0,
    holidayDays: 0,
    absentDays: 0,
  };
  for (const row of rows) {
    switch (row.status) {
      case 'PRESENT':
        out.presentDays += 1;
        break;
      case 'PAID_LEAVE':
        out.paidLeaveDays += 1;
        break;
      case 'UNPAID_LEAVE':
        out.unpaidLeaveDays += 1;
        break;
      case 'WEEKLY_OFF':
        out.weeklyOffDays += 1;
        break;
      case 'HOLIDAY':
        out.holidayDays += 1;
        break;
      case 'ABSENT':
        out.absentDays += 1;
        break;
      default:
        break;
    }
  }
  return out;
}
