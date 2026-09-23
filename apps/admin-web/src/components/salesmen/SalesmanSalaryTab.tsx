import { useEffect, useState } from 'react';
import { Button, Field, FieldGrid, TextField } from '@groaurum/ui';
import type {
  SalesmanEarningModelVm,
  SalesmanSalaryMonthVm,
  SalesmanSalaryTermsVm,
} from '@/data/salesmen-types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useSetSalesmanEarningModelMutation,
  useSetSalesmanSalaryTermsMutation,
} from '@/data/mutations';
import '@groaurum/ui/styles/data-table.css';
import './SalesmanSalaryTab.css';

const EARNING_MODELS: { value: SalesmanEarningModelVm; label: string }[] = [
  { value: 'SALARY', label: 'Salary' },
  { value: 'COMMISSION', label: 'Commission' },
  { value: 'SALARY_PLUS_COMMISSION', label: 'Salary + Commission' },
];

type Props = {
  profileId: string;
  earningModel: SalesmanEarningModelVm;
  salaryMonth: SalesmanSalaryMonthVm | null;
  currentSalary: SalesmanSalaryTermsVm | null;
  salaryHistory: SalesmanSalaryTermsVm[];
  canManage: boolean;
};

function parseMoney(raw: string): number {
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

export function SalesmanSalaryTab({
  profileId,
  earningModel,
  salaryMonth,
  currentSalary,
  salaryHistory,
  canManage,
}: Props) {
  const setSalary = useSetSalesmanSalaryTermsMutation();
  const setEarningModel = useSetSalesmanEarningModelMutation();
  const [model, setModel] = useState<SalesmanEarningModelVm>(earningModel);
  const [monthlySalary, setMonthlySalary] = useState(
    currentSalary ? String(currentSalary.monthlySalary) : '',
  );
  const [dailyAllowance, setDailyAllowance] = useState(
    currentSalary ? String(currentSalary.dailyAllowance) : '0',
  );
  const [otherAllowance, setOtherAllowance] = useState(
    currentSalary ? String(currentSalary.otherAllowance) : '0',
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  useEffect(() => {
    setModel(earningModel);
  }, [earningModel]);

  const pending = setSalary.isPending || setEarningModel.isPending;

  const onSaveEarningModel = () => {
    setError(null);
    setOkNote(null);
    setEarningModel.mutate(
      { profileId, earningModel: model },
      {
        onSuccess: () => {
          setOkNote('Earning model saved. Salary terms were not changed.');
        },
        onError: (err) => {
          setError(formatMutationError(err, 'Could not set earning model'));
        },
      },
    );
  };

  const onSaveTerms = () => {
    setError(null);
    setOkNote(null);
    const monthly = parseMoney(monthlySalary);
    const da = parseMoney(dailyAllowance || '0');
    const other = parseMoney(otherAllowance || '0');
    if (!Number.isFinite(monthly) || monthly <= 0) {
      setError('Monthly salary must be greater than 0');
      return;
    }
    if (!Number.isFinite(da) || da < 0 || !Number.isFinite(other) || other < 0) {
      setError('Allowances must be non-negative numbers');
      return;
    }
    if (!effectiveFrom) {
      setError('Effective from date is required');
      return;
    }
    setSalary.mutate(
      {
        profileId,
        monthlySalary: monthly,
        dailyAllowance: da,
        otherAllowance: other,
        effectiveFrom,
      },
      {
        onSuccess: () => {
          setOkNote('Salary terms saved (append-only).');
        },
        onError: (err) => {
          setError(formatMutationError(err, 'Could not set salary terms'));
        },
      },
    );
  };

  return (
    <div className="ga-sm-salary">
      <section className="ga-sm-salary__month">
        <h3 className="ga-sm-salary__heading">
          This month{salaryMonth ? ` · ${salaryMonth.monthLabel}` : ''}
        </h3>
        {!salaryMonth ? (
          <EmptyState
            title="Salary month unavailable"
            detail="Employment and active salary terms are required to compute payable."
          />
        ) : salaryMonth.unavailableReason ? (
          <EmptyState
            title="Salary month unavailable"
            detail={salaryMonth.unavailableReason}
          />
        ) : (
          <>
            <div className="ga-sm-salary__cards">
              <Card>
                <p className="ga-sm-salary__label">Final payable</p>
                <p className="ga-sm-salary__value">
                  {salaryMonth.finalPayableLabel}
                </p>
              </Card>
              <Card>
                <p className="ga-sm-salary__label">Monthly salary</p>
                <p className="ga-sm-salary__value">
                  {salaryMonth.monthlySalaryLabel}
                </p>
              </Card>
              <Card>
                <p className="ga-sm-salary__label">Daily rate</p>
                <p className="ga-sm-salary__value">
                  {salaryMonth.dailyRateLabel}
                </p>
              </Card>
              <Card>
                <p className="ga-sm-salary__label">Unpaid deduction</p>
                <p className="ga-sm-salary__value">
                  {salaryMonth.unpaidDeductionLabel}
                </p>
              </Card>
            </div>
            <FieldGrid columns={4}>
              <Field label="Scheduled working days">
                {salaryMonth.scheduledWorkingDays}
              </Field>
              <Field label="Present">{salaryMonth.presentDays}</Field>
              <Field label="Paid leave">{salaryMonth.paidLeaveDays}</Field>
              <Field label="Unpaid leave">{salaryMonth.unpaidLeaveDays}</Field>
              <Field label="Absent">{salaryMonth.absentDays}</Field>
              <Field label="Weekly off">{salaryMonth.weeklyOffDays}</Field>
              <Field label="Holiday">{salaryMonth.holidayDays}</Field>
              <Field label="DA">{salaryMonth.dailyAllowanceLabel}</Field>
              <Field label="Other">{salaryMonth.otherAllowanceLabel}</Field>
            </FieldGrid>
            <p className="ga-sm-salary__formula">{salaryMonth.formulaLabel}</p>
          </>
        )}
      </section>

      <section className="ga-sm-salary__form" aria-label="Earning model">
        <h3 className="ga-sm-salary__heading">Earning model</h3>
        <p className="ga-sm-salary__hint">
          Applies to future assisted sales. Existing salary terms and earned
          commission stay as recorded.
        </p>
        <div className="ga-sm-salary__models" role="radiogroup" aria-label="Earning model">
          {EARNING_MODELS.map((option) => (
            <label key={option.value} className="ga-sm-salary__model">
              <input
                type="radio"
                name="earning-model"
                value={option.value}
                checked={model === option.value}
                disabled={!canManage || pending}
                onChange={() => setModel(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {canManage ? (
          <div className="ga-sm-salary__form-actions">
            <Button
              type="button"
              onClick={onSaveEarningModel}
              disabled={pending || model === earningModel}
            >
              Save earning model
            </Button>
          </div>
        ) : null}
      </section>

      {canManage ? (
        <section className="ga-sm-salary__form" aria-label="Set salary terms">
          <h3 className="ga-sm-salary__heading">Set new salary terms</h3>
          <p className="ga-sm-salary__hint">
            Append-only: previous terms are closed when a new effective-from
            date is set.
          </p>
          <div className="ga-sm-salary__form-row">
            <TextField
              label="Monthly salary (₹)"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
            />
            <TextField
              label="Daily allowance / DA (₹)"
              value={dailyAllowance}
              onChange={(e) => setDailyAllowance(e.target.value)}
            />
            <TextField
              label="Other allowance (₹)"
              value={otherAllowance}
              onChange={(e) => setOtherAllowance(e.target.value)}
            />
            <TextField
              label="Effective from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div className="ga-sm-salary__form-actions">
            <Button variant="primary" onClick={onSaveTerms} disabled={pending}>
              {pending ? 'Saving…' : 'Save salary terms'}
            </Button>
          </div>
          {error ? <p className="ga-sm-salary__error">{error}</p> : null}
          {okNote ? (
            <p className="ga-sm-salary__ok" role="status">
              {okNote}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3 className="ga-sm-salary__heading">Salary history</h3>
        {salaryHistory.length === 0 ? (
          <EmptyState
            title="No salary terms"
            detail="Set monthly salary, DA, and other allowance above."
          />
        ) : (
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Effective from</th>
                  <th>Effective to</th>
                  <th>Monthly</th>
                  <th>DA</th>
                  <th>Other</th>
                </tr>
              </thead>
              <tbody>
                {salaryHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.effectiveFromLabel}</td>
                    <td>{row.effectiveToLabel ?? 'Current'}</td>
                    <td>{row.monthlySalaryLabel}</td>
                    <td>{row.dailyAllowanceLabel}</td>
                    <td>{row.otherAllowanceLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
