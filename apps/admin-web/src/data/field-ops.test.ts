import { describe, expect, it } from 'vitest';
import {
  summarizeFieldToday,
  summarizeVisitCoverage,
} from './field-ops';

describe('Phase 12 field ops', () => {
  it('summarises who started today', () => {
    const summary = summarizeFieldToday({
      workDate: '2026-10-03',
      activeSalesmanIds: ['a', 'b', 'c', 'd'],
      attendance: [
        {
          profileId: 'a',
          status: 'PRESENT',
          dayStartedAt: '2026-10-03T03:00:00.000Z',
        },
        { profileId: 'b', status: 'ABSENT', dayStartedAt: null },
        { profileId: 'c', status: 'PAID_LEAVE', dayStartedAt: null },
      ],
      pendingExpenseClaims: 2,
      pendingReturnClaims: 1,
    });
    expect(summary.startedCount).toBe(1);
    expect(summary.absentCount).toBe(1);
    expect(summary.onLeaveCount).toBe(1);
    expect(summary.notStartedCount).toBe(1); // d
    expect(summary.pendingExpenseClaims).toBe(2);
  });

  it('summarises visit coverage', () => {
    const coverage = summarizeVisitCoverage({
      rangeLabel: 'Today',
      visits: [
        { status: 'PLANNED' },
        { status: 'VISITED' },
        { status: 'MISSED' },
        { status: 'PENDING' },
      ],
    });
    expect(coverage.planned).toBe(2);
    expect(coverage.completed).toBe(1);
    expect(coverage.missed).toBe(1);
    expect(coverage.total).toBe(4);
  });
});
