import { formatDate, formatDateTime, formatInr } from '@/data/live/format';
import { calculateMonthlySalarySummary } from '@/data/salesman-salary';

export const PAYROLL_STATUSES = ['DRAFT', 'APPROVED', 'PAID'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export const PAYROLL_PAYMENT_METHODS = ['CASH', 'BANK', 'UPI', 'OTHER'] as const;
export type PayrollPaymentMethod = (typeof PAYROLL_PAYMENT_METHODS)[number];

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PAID: 'Paid',
};

export const PAYROLL_PAYMENT_METHOD_LABELS: Record<
  PayrollPaymentMethod,
  string
> = {
  CASH: 'Cash',
  BANK: 'Bank',
  UPI: 'UPI',
  OTHER: 'Other',
};

export type PayrollRow = {
  id: string;
  salesmanId: string;
  salesmanName: string;
  payrollMonth: string;
  payrollMonthLabel: string;
  earningModel: string;
  baseSalary: number;
  baseSalaryLabel: string;
  unpaidLeaveDays: number;
  unpaidDeduction: number;
  unpaidDeductionLabel: string;
  earnedCommission: number;
  earnedCommissionLabel: string;
  dailyAllowance: number;
  dailyAllowanceLabel: string;
  otherAllowance: number;
  otherAllowanceLabel: string;
  adjustments: number;
  adjustmentsLabel: string;
  totalAmount: number;
  totalAmountLabel: string;
  status: PayrollStatus;
  statusLabel: string;
  paidAtLabel: string | null;
  paymentMethod: PayrollPaymentMethod | null;
  paymentMethodLabel: string | null;
  paymentReference: string | null;
  notes: string | null;
  calculatedAtLabel: string;
};

export type PayrollMonthSummary = {
  month: string;
  monthLabel: string;
  totalPayroll: number;
  totalPayrollLabel: string;
  paidTotal: number;
  paidTotalLabel: string;
  pendingTotal: number;
  pendingTotalLabel: string;
  salesmanCount: number;
  rows: PayrollRow[];
};

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function payrollMonthStart(isoOrYmd: string): string {
  const raw = isoOrYmd.slice(0, 10);
  return `${raw.slice(0, 7)}-01`;
}

export function payrollMonthLabel(monthYmd: string): string {
  const d = new Date(`${payrollMonthStart(monthYmd)}T00:00:00Z`);
  return d.toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function isPayrollStatus(value: string): value is PayrollStatus {
  return (PAYROLL_STATUSES as readonly string[]).includes(value);
}

export function isPayrollPaymentMethod(
  value: string,
): value is PayrollPaymentMethod {
  return (PAYROLL_PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * Authoritative Admin payroll total from existing salary formula + ledger commission.
 * Mirrors admin_calculate_salesman_payroll:
 * base (salary − unpaid leave) + commission + DA + other + adjustments
 */
export function buildPayrollTotal(input: {
  earningModel: string;
  monthlySalary: number;
  dailyAllowance: number;
  otherAllowance: number;
  scheduledWorkingDays: number;
  unpaidLeaveDays: number;
  earnedCommission: number;
  adjustments?: number;
}): {
  baseSalary: number;
  unpaidDeduction: number;
  earnedCommission: number;
  dailyAllowance: number;
  otherAllowance: number;
  adjustments: number;
  totalAmount: number;
} {
  const model = input.earningModel.toUpperCase();
  const salaryApplies =
    model === 'SALARY' || model === 'SALARY_PLUS_COMMISSION';
  const commissionApplies =
    model === 'COMMISSION' || model === 'SALARY_PLUS_COMMISSION';

  let baseSalary = 0;
  let unpaidDeduction = 0;
  let dailyAllowance = 0;
  let otherAllowance = 0;

  if (salaryApplies) {
    const summary = calculateMonthlySalarySummary({
      monthlySalary: input.monthlySalary,
      dailyAllowance: input.dailyAllowance,
      otherAllowance: input.otherAllowance,
      scheduledWorkingDays: input.scheduledWorkingDays,
      presentDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: input.unpaidLeaveDays,
      weeklyOffDays: 0,
      holidayDays: 0,
      absentDays: 0,
    });
    unpaidDeduction = roundMoney(summary.unpaidDeduction);
    baseSalary = roundMoney(
      Math.max(0, input.monthlySalary - unpaidDeduction),
    );
    dailyAllowance = roundMoney(input.dailyAllowance);
    otherAllowance = roundMoney(input.otherAllowance);
  }

  const earnedCommission = commissionApplies
    ? roundMoney(input.earnedCommission)
    : 0;
  const adjustments = roundMoney(input.adjustments ?? 0);
  const totalAmount = roundMoney(
    baseSalary + earnedCommission + dailyAllowance + otherAllowance + adjustments,
  );

  return {
    baseSalary,
    unpaidDeduction,
    earnedCommission,
    dailyAllowance,
    otherAllowance,
    adjustments,
    totalAmount,
  };
}

export function mapPayrollRow(input: {
  id: string;
  salesman_profile_id: string;
  salesman_name?: string | null;
  payroll_month: string;
  earning_model: string;
  base_salary: number;
  unpaid_leave_days: number;
  unpaid_deduction: number;
  earned_commission: number;
  daily_allowance: number;
  other_allowance: number;
  adjustments: number;
  total_amount: number;
  status: string;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  calculated_at: string;
}): PayrollRow {
  const status = isPayrollStatus(input.status) ? input.status : 'DRAFT';
  const method =
    input.payment_method && isPayrollPaymentMethod(input.payment_method)
      ? input.payment_method
      : null;
  return {
    id: input.id,
    salesmanId: input.salesman_profile_id,
    salesmanName: input.salesman_name?.trim() || 'Salesman',
    payrollMonth: payrollMonthStart(input.payroll_month),
    payrollMonthLabel: payrollMonthLabel(input.payroll_month),
    earningModel: input.earning_model,
    baseSalary: Number(input.base_salary) || 0,
    baseSalaryLabel: formatInr(Number(input.base_salary) || 0),
    unpaidLeaveDays: Number(input.unpaid_leave_days) || 0,
    unpaidDeduction: Number(input.unpaid_deduction) || 0,
    unpaidDeductionLabel: formatInr(Number(input.unpaid_deduction) || 0),
    earnedCommission: Number(input.earned_commission) || 0,
    earnedCommissionLabel: formatInr(Number(input.earned_commission) || 0),
    dailyAllowance: Number(input.daily_allowance) || 0,
    dailyAllowanceLabel: formatInr(Number(input.daily_allowance) || 0),
    otherAllowance: Number(input.other_allowance) || 0,
    otherAllowanceLabel: formatInr(Number(input.other_allowance) || 0),
    adjustments: Number(input.adjustments) || 0,
    adjustmentsLabel: formatInr(Number(input.adjustments) || 0),
    totalAmount: Number(input.total_amount) || 0,
    totalAmountLabel: formatInr(Number(input.total_amount) || 0),
    status,
    statusLabel: PAYROLL_STATUS_LABELS[status],
    paidAtLabel: input.paid_at ? formatDateTime(input.paid_at) : null,
    paymentMethod: method,
    paymentMethodLabel: method
      ? PAYROLL_PAYMENT_METHOD_LABELS[method]
      : null,
    paymentReference: input.payment_reference ?? null,
    notes: input.notes ?? null,
    calculatedAtLabel: formatDate(input.calculated_at),
  };
}

export function buildPayrollMonthSummary(input: {
  month: string;
  rows: readonly PayrollRow[];
}): PayrollMonthSummary {
  const month = payrollMonthStart(input.month);
  let totalPayroll = 0;
  let paidTotal = 0;
  let pendingTotal = 0;
  for (const row of input.rows) {
    totalPayroll += row.totalAmount;
    if (row.status === 'PAID') paidTotal += row.totalAmount;
    else pendingTotal += row.totalAmount;
  }
  return {
    month,
    monthLabel: payrollMonthLabel(month),
    totalPayroll: roundMoney(totalPayroll),
    totalPayrollLabel: formatInr(roundMoney(totalPayroll)),
    paidTotal: roundMoney(paidTotal),
    paidTotalLabel: formatInr(roundMoney(paidTotal)),
    pendingTotal: roundMoney(pendingTotal),
    pendingTotalLabel: formatInr(roundMoney(pendingTotal)),
    salesmanCount: input.rows.length,
    rows: [...input.rows].sort((a, b) =>
      a.salesmanName.localeCompare(b.salesmanName),
    ),
  };
}

/** Day Book money-out rows from paid payroll only. */
export type PayrollDayBookInput = {
  id: string;
  salesmanId: string;
  salesmanName: string;
  payrollMonth: string;
  totalAmount: number;
  paidAt: string;
  paymentMethodLabel: string;
};

export function mapPaidPayrollToDayBookEntries(
  rows: readonly PayrollDayBookInput[],
): {
  id: string;
  atIso: string;
  type: 'payroll';
  typeLabel: string;
  description: string;
  partyLabel: string;
  moneyIn: number;
  moneyOut: number;
  paymentMethod: string;
  href: string;
  sortKey: number;
}[] {
  return rows.map((row) => ({
    id: `payroll-${row.id}`,
    atIso: row.paidAt,
    type: 'payroll' as const,
    typeLabel: 'Payroll',
    description: `${row.salesmanName} — ${payrollMonthLabel(row.payrollMonth)}`,
    partyLabel: row.salesmanName,
    moneyIn: 0,
    moneyOut: roundMoney(row.totalAmount),
    paymentMethod: row.paymentMethodLabel,
    href: `/salesmen/${row.salesmanId}`,
    sortKey: Date.parse(row.paidAt) || 0,
  }));
}
