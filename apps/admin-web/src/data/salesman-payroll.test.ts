import { describe, expect, it } from 'vitest';
import {
  buildPayrollMonthSummary,
  buildPayrollTotal,
  mapPaidPayrollToDayBookEntries,
  mapPayrollRow,
  payrollMonthStart,
} from './salesman-payroll';

describe('salesman payroll calculation', () => {
  it('uses salary − unpaid leave + commission + allowances + adjustments', () => {
    const result = buildPayrollTotal({
      earningModel: 'SALARY_PLUS_COMMISSION',
      monthlySalary: 30000,
      dailyAllowance: 1000,
      otherAllowance: 500,
      scheduledWorkingDays: 26,
      unpaidLeaveDays: 2,
      earnedCommission: 4200,
      adjustments: -200,
    });

    // daily rate = 30000/26 ≈ 1153.85 → unpaid 2307.69
    expect(result.unpaidDeduction).toBeCloseTo(2307.69, 1);
    expect(result.baseSalary).toBeCloseTo(27692.31, 1);
    expect(result.earnedCommission).toBe(4200);
    expect(result.dailyAllowance).toBe(1000);
    expect(result.otherAllowance).toBe(500);
    expect(result.adjustments).toBe(-200);
    expect(result.totalAmount).toBeCloseTo(
      result.baseSalary + 4200 + 1000 + 500 - 200,
      1,
    );
  });

  it('commission-only ignores salary terms', () => {
    const result = buildPayrollTotal({
      earningModel: 'COMMISSION',
      monthlySalary: 30000,
      dailyAllowance: 1000,
      otherAllowance: 500,
      scheduledWorkingDays: 26,
      unpaidLeaveDays: 2,
      earnedCommission: 8000,
      adjustments: 0,
    });
    expect(result.baseSalary).toBe(0);
    expect(result.dailyAllowance).toBe(0);
    expect(result.earnedCommission).toBe(8000);
    expect(result.totalAmount).toBe(8000);
  });

  it('salary-only ignores commission', () => {
    const result = buildPayrollTotal({
      earningModel: 'SALARY',
      monthlySalary: 20000,
      dailyAllowance: 0,
      otherAllowance: 0,
      scheduledWorkingDays: 20,
      unpaidLeaveDays: 0,
      earnedCommission: 9999,
      adjustments: 0,
    });
    expect(result.earnedCommission).toBe(0);
    expect(result.totalAmount).toBe(20000);
  });

  it('normalizes month boundaries to the first of the month', () => {
    expect(payrollMonthStart('2026-09-15')).toBe('2026-09-01');
    expect(payrollMonthStart('2026-09-01')).toBe('2026-09-01');
  });

  it('keeps historical snapshot numbers when mapping paid rows', () => {
    const row = mapPayrollRow({
      id: 'p1',
      salesman_profile_id: 's1',
      salesman_name: 'Ravi',
      payroll_month: '2026-09-15',
      earning_model: 'SALARY_PLUS_COMMISSION',
      base_salary: 25000,
      unpaid_leave_days: 1,
      unpaid_deduction: 1000,
      earned_commission: 3000,
      daily_allowance: 500,
      other_allowance: 0,
      adjustments: 0,
      total_amount: 28500,
      status: 'PAID',
      paid_at: '2026-10-01T10:00:00.000Z',
      payment_method: 'BANK',
      calculated_at: '2026-09-30T10:00:00.000Z',
    });
    expect(payrollMonthStart(row.payrollMonth)).toBe('2026-09-01');
    expect(row.statusLabel).toBe('Paid');
    expect(row.totalAmountLabel).toContain('28,500');
  });

  it('does not change historical snapshot after later salary/commission terms change', () => {
    const snapshot = mapPayrollRow({
      id: 'p1',
      salesman_profile_id: 's1',
      salesman_name: 'Ravi',
      payroll_month: '2026-08-01',
      earning_model: 'SALARY_PLUS_COMMISSION',
      base_salary: 20000,
      unpaid_leave_days: 0,
      unpaid_deduction: 0,
      earned_commission: 1500,
      daily_allowance: 0,
      other_allowance: 0,
      adjustments: 0,
      total_amount: 21500,
      status: 'PAID',
      paid_at: '2026-09-05T10:00:00.000Z',
      payment_method: 'UPI',
      calculated_at: '2026-08-31T10:00:00.000Z',
    });

    const live = buildPayrollTotal({
      earningModel: 'SALARY_PLUS_COMMISSION',
      monthlySalary: 35000,
      dailyAllowance: 2000,
      otherAllowance: 1000,
      scheduledWorkingDays: 26,
      unpaidLeaveDays: 0,
      earnedCommission: 9000,
      adjustments: 0,
    });
    expect(live.totalAmount).toBe(47000);
    expect(snapshot.totalAmount).toBe(21500);
    expect(snapshot.earnedCommission).toBe(1500);
  });

  it('summarizes month paid vs pending', () => {
    const summary = buildPayrollMonthSummary({
      month: '2026-09-01',
      rows: [
        mapPayrollRow({
          id: '1',
          salesman_profile_id: 'a',
          salesman_name: 'A',
          payroll_month: '2026-09-01',
          earning_model: 'SALARY',
          base_salary: 10000,
          unpaid_leave_days: 0,
          unpaid_deduction: 0,
          earned_commission: 0,
          daily_allowance: 0,
          other_allowance: 0,
          adjustments: 0,
          total_amount: 10000,
          status: 'PAID',
          calculated_at: '2026-09-30T00:00:00.000Z',
        }),
        mapPayrollRow({
          id: '2',
          salesman_profile_id: 'b',
          salesman_name: 'B',
          payroll_month: '2026-09-01',
          earning_model: 'SALARY',
          base_salary: 12000,
          unpaid_leave_days: 0,
          unpaid_deduction: 0,
          earned_commission: 0,
          daily_allowance: 0,
          other_allowance: 0,
          adjustments: 0,
          total_amount: 12000,
          status: 'DRAFT',
          calculated_at: '2026-09-30T00:00:00.000Z',
        }),
      ],
    });
    expect(summary.totalPayroll).toBe(22000);
    expect(summary.paidTotal).toBe(10000);
    expect(summary.pendingTotal).toBe(12000);
    expect(summary.salesmanCount).toBe(2);
  });

  it('maps paid payroll to a single Day Book money-out row', () => {
    const entries = mapPaidPayrollToDayBookEntries([
      {
        id: 'pay1',
        salesmanId: 's1',
        salesmanName: 'Ravi',
        payrollMonth: '2026-09-01',
        totalAmount: 28500,
        paidAt: '2026-10-01T10:00:00.000Z',
        paymentMethodLabel: 'Bank',
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe('payroll');
    expect(entries[0]?.moneyOut).toBe(28500);
    expect(entries[0]?.moneyIn).toBe(0);
    expect(entries[0]?.description).toContain('Ravi');
    expect(entries[0]?.description).toContain('September');
    expect(entries[0]?.href).toBe('/salesmen/s1');
  });

  it('exposes only Draft / Approved / Paid status labels', () => {
    expect(
      ['DRAFT', 'APPROVED', 'PAID'].map((status) =>
        mapPayrollRow({
          id: 'x',
          salesman_profile_id: 's',
          payroll_month: '2026-09-01',
          earning_model: 'SALARY',
          base_salary: 1,
          unpaid_leave_days: 0,
          unpaid_deduction: 0,
          earned_commission: 0,
          daily_allowance: 0,
          other_allowance: 0,
          adjustments: 0,
          total_amount: 1,
          status,
          paid_at: status === 'PAID' ? '2026-10-01T00:00:00.000Z' : null,
          payment_method: status === 'PAID' ? 'CASH' : null,
          calculated_at: '2026-09-30T00:00:00.000Z',
        }).statusLabel,
      ),
    ).toEqual(['Draft', 'Approved', 'Paid']);
  });
});
