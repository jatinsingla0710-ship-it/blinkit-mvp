/**
 * Phase 12 — field / payroll owner summaries (reuse attendance, visits, claims).
 */

export function kolkataWorkDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export type FieldAttendanceInput = {
  profileId: string;
  status: string;
  dayStartedAt: string | null;
};

export type FieldTodaySummary = {
  workDate: string;
  startedCount: number;
  notStartedCount: number;
  absentCount: number;
  onLeaveCount: number;
  pendingExpenseClaims: number;
  pendingReturnClaims: number;
};

/** Summarise today's field presence for active salesmen. */
export function summarizeFieldToday(input: {
  workDate: string;
  activeSalesmanIds: readonly string[];
  attendance: readonly FieldAttendanceInput[];
  pendingExpenseClaims?: number;
  pendingReturnClaims?: number;
}): FieldTodaySummary {
  let startedCount = 0;
  let absentCount = 0;
  let onLeaveCount = 0;
  const byId = new Map(
    input.attendance.map((row) => [row.profileId, row] as const),
  );

  for (const id of input.activeSalesmanIds) {
    const row = byId.get(id);
    if (!row) continue;
    const status = row.status.toUpperCase();
    if (status === 'ABSENT') {
      absentCount += 1;
      continue;
    }
    if (status === 'PAID_LEAVE' || status === 'UNPAID_LEAVE') {
      onLeaveCount += 1;
      continue;
    }
    if (row.dayStartedAt || status === 'PRESENT') {
      startedCount += 1;
    }
  }

  let notStartedCount = 0;
  for (const id of input.activeSalesmanIds) {
    const row = byId.get(id);
    if (!row) {
      notStartedCount += 1;
      continue;
    }
    const status = row.status.toUpperCase();
    if (
      status === 'ABSENT' ||
      status === 'PAID_LEAVE' ||
      status === 'UNPAID_LEAVE' ||
      status === 'HOLIDAY' ||
      status === 'WEEKLY_OFF'
    ) {
      continue;
    }
    if (row.dayStartedAt || status === 'PRESENT') continue;
    notStartedCount += 1;
  }

  return {
    workDate: input.workDate,
    startedCount,
    notStartedCount,
    absentCount,
    onLeaveCount,
    pendingExpenseClaims: input.pendingExpenseClaims ?? 0,
    pendingReturnClaims: input.pendingReturnClaims ?? 0,
  };
}

export type VisitCoverageInput = {
  status: string;
};

export type VisitCoverageSummary = {
  rangeLabel: string;
  planned: number;
  completed: number;
  missed: number;
  total: number;
};

export function summarizeVisitCoverage(input: {
  rangeLabel: string;
  visits: readonly VisitCoverageInput[];
}): VisitCoverageSummary {
  let planned = 0;
  let completed = 0;
  let missed = 0;
  for (const visit of input.visits) {
    const status = visit.status.toUpperCase();
    if (status === 'VISITED' || status === 'COMPLETED') completed += 1;
    else if (status === 'MISSED' || status === 'SHOP_CLOSED') missed += 1;
    else planned += 1; // PLANNED / PENDING
  }
  return {
    rangeLabel: input.rangeLabel,
    planned,
    completed,
    missed,
    total: input.visits.length,
  };
}

export type PendingTeamClaimKind = 'expense' | 'return';

export type PendingTeamClaimRow = {
  id: string;
  kind: PendingTeamClaimKind;
  salesmanProfileId: string;
  salesmanName: string;
  title: string;
  detail: string;
  amountLabel: string | null;
  createdAtLabel: string;
  href: string;
};
