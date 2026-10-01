import { useMemo, useState } from 'react';
import { Button, TextField } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryStateGate } from '@/data/QueryStateGate';
import { formatMutationError } from '@/data/mutation-errors';
import { useSalesmanPayrollQuery } from '@/data/hooks';
import {
  useApproveSalesmanPayrollMutation,
  useCalculateSalesmanPayrollMutation,
  useMarkSalesmanPayrollPaidMutation,
  useSetSalesmanPayrollAdjustmentsMutation,
} from '@/data/mutations';
import { formatInr } from '@/data/live/format';
import {
  PAYROLL_PAYMENT_METHODS,
  PAYROLL_PAYMENT_METHOD_LABELS,
  payrollMonthLabel,
  payrollMonthStart,
  type PayrollPaymentMethod,
  type PayrollRow,
} from '@/data/salesman-payroll';
import '@groaurum/ui/styles/data-table.css';
import './SalesmanPayrollTab.css';

type Props = {
  profileId: string;
  canManage: boolean;
};

function currentMonthYmd(): string {
  const now = new Date();
  return payrollMonthStart(
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`,
  );
}

function monthInputValue(ymd: string): string {
  return payrollMonthStart(ymd).slice(0, 7);
}

/**
 * Salesman Detail → Payroll.
 * Snapshots salary + ledger commission for a month; Paid rows are locked.
 */
export function SalesmanPayrollTab({
  profileId,
  canManage,
}: Props) {
  const { state } = useSalesmanPayrollQuery(profileId);
  const [month, setMonth] = useState(currentMonthYmd);
  const [adjustments, setAdjustments] = useState('0');
  const [notes, setNotes] = useState('');
  const [payMethod, setPayMethod] = useState<PayrollPaymentMethod>('BANK');
  const [payRef, setPayRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const calculate = useCalculateSalesmanPayrollMutation();
  const approve = useApproveSalesmanPayrollMutation();
  const markPaid = useMarkSalesmanPayrollPaidMutation();
  const setAdj = useSetSalesmanPayrollAdjustmentsMutation();

  const pending =
    calculate.isPending ||
    approve.isPending ||
    markPaid.isPending ||
    setAdj.isPending;

  return (
    <QueryStateGate
      title="Payroll"
      state={state}
      emptyTitle="No payroll yet"
      emptyDetail="Calculate payroll for a month to create the first record."
    >
      {(rows) => {
        const current = rows.find((r) => r.payrollMonth === month) ?? null;
        return (
          <PayrollPanel
            canManage={canManage}
            rows={rows}
            month={month}
            setMonth={setMonth}
            current={current}
            adjustments={adjustments}
            setAdjustments={setAdjustments}
            notes={notes}
            setNotes={setNotes}
            payMethod={payMethod}
            setPayMethod={setPayMethod}
            payRef={payRef}
            setPayRef={setPayRef}
            error={error}
            setError={setError}
            okNote={okNote}
            setOkNote={setOkNote}
            pending={pending}
            onCalculate={() => {
              setError(null);
              setOkNote(null);
              const adj = Number(String(adjustments).replace(/,/g, '').trim());
              calculate.mutate(
                {
                  salesmanId: profileId,
                  month,
                  adjustments: Number.isFinite(adj) ? adj : 0,
                  notes: notes.trim() || null,
                },
                {
                  onSuccess: (row) => {
                    setAdjustments(String(row.adjustments));
                    setOkNote(`Payroll calculated for ${row.payrollMonthLabel}.`);
                  },
                  onError: (err) =>
                    setError(
                      formatMutationError(err, 'Could not calculate payroll'),
                    ),
                },
              );
            }}
            onSaveAdjustments={() => {
              if (!current) return;
              setError(null);
              setOkNote(null);
              const adj = Number(String(adjustments).replace(/,/g, '').trim());
              if (!Number.isFinite(adj)) {
                setError('Adjustments must be a number');
                return;
              }
              setAdj.mutate(
                {
                  payrollId: current.id,
                  adjustments: adj,
                  notes: notes.trim() || null,
                },
                {
                  onSuccess: () => setOkNote('Adjustments saved.'),
                  onError: (err) =>
                    setError(
                      formatMutationError(err, 'Could not save adjustments'),
                    ),
                },
              );
            }}
            onApprove={() => {
              if (!current) return;
              setError(null);
              setOkNote(null);
              approve.mutate(current.id, {
                onSuccess: () => setOkNote('Payroll approved.'),
                onError: (err) =>
                  setError(formatMutationError(err, 'Could not approve payroll')),
              });
            }}
            onMarkPaid={() => {
              if (!current) return;
              setError(null);
              setOkNote(null);
              markPaid.mutate(
                {
                  payrollId: current.id,
                  paymentMethod: payMethod,
                  paymentReference: payRef.trim() || null,
                },
                {
                  onSuccess: () =>
                    setOkNote('Payroll marked paid. Amount is locked.'),
                  onError: (err) =>
                    setError(
                      formatMutationError(err, 'Could not mark payroll paid'),
                    ),
                },
              );
            }}
          />
        );
      }}
    </QueryStateGate>
  );
}

function PayrollPanel(props: {
  canManage: boolean;
  rows: PayrollRow[];
  month: string;
  setMonth: (m: string) => void;
  current: PayrollRow | null;
  adjustments: string;
  setAdjustments: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  payMethod: PayrollPaymentMethod;
  setPayMethod: (v: PayrollPaymentMethod) => void;
  payRef: string;
  setPayRef: (v: string) => void;
  error: string | null;
  setError: (v: string | null) => void;
  okNote: string | null;
  setOkNote: (v: string | null) => void;
  pending: boolean;
  onCalculate: () => void;
  onSaveAdjustments: () => void;
  onApprove: () => void;
  onMarkPaid: () => void;
}) {
  const {
    canManage,
    rows,
    month,
    setMonth,
    current,
    adjustments,
    setAdjustments,
    notes,
    setNotes,
    payMethod,
    setPayMethod,
    payRef,
    setPayRef,
    error,
    okNote,
    pending,
    onCalculate,
    onSaveAdjustments,
    onApprove,
    onMarkPaid,
  } = props;

  const locked = current?.status === 'PAID';
  const allowancesLabel = useMemo(() => {
    if (!current) return '—';
    const n = current.dailyAllowance + current.otherAllowance;
    return n === 0 ? '—' : formatInr(n);
  }, [current]);

  return (
    <div className="ga-sm-payroll">
      <label className="ga-sm-payroll__month">
        <span>Payroll month</span>
        <input
          type="month"
          value={monthInputValue(month)}
          onChange={(e) => {
            const next = e.target.value
              ? payrollMonthStart(`${e.target.value}-01`)
              : currentMonthYmd();
            setMonth(next);
            const existing = rows.find((r) => r.payrollMonth === next);
            setAdjustments(existing ? String(existing.adjustments) : '0');
            setNotes(existing?.notes ?? '');
          }}
        />
      </label>

      {current ? (
        <section className="ga-sm-payroll__current" aria-label="Current month">
          <div className="ga-sm-payroll__status-row">
            <p className="ga-sm-payroll__heading">{current.payrollMonthLabel}</p>
            <span
              className={`ga-sm-payroll__badge ga-sm-payroll__badge--${current.status.toLowerCase()}`}
            >
              {current.statusLabel}
            </span>
          </div>

          <div className="ga-sm-payroll__cards">
            <div>
              <p className="ga-sm-payroll__label">Base salary</p>
              <p className="ga-sm-payroll__value">{current.baseSalaryLabel}</p>
            </div>
            <div>
              <p className="ga-sm-payroll__label">Earned commission</p>
              <p className="ga-sm-payroll__value">
                {current.earnedCommissionLabel}
              </p>
            </div>
            <div>
              <p className="ga-sm-payroll__label">Allowances</p>
              <p className="ga-sm-payroll__value">{allowancesLabel}</p>
            </div>
            <div>
              <p className="ga-sm-payroll__label">Adjustments</p>
              <p className="ga-sm-payroll__value">{current.adjustmentsLabel}</p>
            </div>
            <div>
              <p className="ga-sm-payroll__label">Total</p>
              <p className="ga-sm-payroll__value ga-sm-payroll__value--total">
                {current.totalAmountLabel}
              </p>
            </div>
          </div>

          {current.unpaidLeaveDays > 0 ? (
            <p className="ga-sm-payroll__hint">
              Unpaid leave {current.unpaidLeaveDays} day
              {current.unpaidLeaveDays === 1 ? '' : 's'} · deduction{' '}
              {current.unpaidDeductionLabel}
            </p>
          ) : (
            <p className="ga-sm-payroll__hint">
              Uses salary terms, unpaid leave attendance, and commission ledger.
              Leave beyond recorded unpaid days is not applied.
            </p>
          )}

          {locked ? (
            <p className="ga-sm-payroll__hint">
              Paid {current.paidAtLabel}
              {current.paymentMethodLabel
                ? ` · ${current.paymentMethodLabel}`
                : ''}
              {current.paymentReference
                ? ` · Ref ${current.paymentReference}`
                : ''}
              . Amount is locked.
            </p>
          ) : null}
        </section>
      ) : (
        <EmptyState
          title={`No payroll for ${payrollMonthLabel(month)}`}
          detail={
            canManage
              ? 'Calculate payroll to snapshot salary and commission for this month.'
              : 'Ask an admin to calculate payroll for this month.'
          }
        />
      )}

      {canManage && !locked ? (
        <section className="ga-sm-payroll__form" aria-label="Payroll actions">
          <div className="ga-sm-payroll__form-row">
            <TextField
              label="Adjustments (₹)"
              value={adjustments}
              onChange={(e) => setAdjustments(e.target.value)}
              inputMode="decimal"
            />
            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="ga-sm-payroll__actions">
            <Button
              variant="primary"
              disabled={pending}
              onClick={onCalculate}
            >
              {current ? 'Recalculate payroll' : 'Calculate payroll'}
            </Button>
            {current && current.status === 'DRAFT' ? (
              <>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={onSaveAdjustments}
                >
                  Save adjustments
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={onApprove}
                >
                  Approve
                </Button>
              </>
            ) : null}
          </div>

          {current?.status === 'APPROVED' ? (
            <div className="ga-sm-payroll__pay">
              <div className="ga-sm-payroll__form-row">
                <label className="ga-sm-payroll__select-field">
                  <span>Payment method</span>
                  <select
                    value={payMethod}
                    onChange={(e) =>
                      setPayMethod(e.target.value as PayrollPaymentMethod)
                    }
                  >
                    {PAYROLL_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYROLL_PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Reference (optional)"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>
              <div className="ga-sm-payroll__actions">
                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={onMarkPaid}
                >
                  Mark as paid
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="ga-sm-payroll__error">{error}</p> : null}
      {okNote ? <p className="ga-sm-payroll__ok">{okNote}</p> : null}

      <section aria-label="Payroll history">
        <h3 className="ga-sm-payroll__heading">History</h3>
        {rows.length === 0 ? (
          <p className="ga-sm-payroll__hint">No payroll records yet.</p>
        ) : (
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Salary</th>
                  <th>Commission</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.payrollMonth === month
                        ? 'ga-sm-payroll__row--active'
                        : undefined
                    }
                    onClick={() => {
                      setMonth(row.payrollMonth);
                      setAdjustments(String(row.adjustments));
                      setNotes(row.notes ?? '');
                    }}
                  >
                    <td>{row.payrollMonthLabel}</td>
                    <td>{row.baseSalaryLabel}</td>
                    <td>{row.earnedCommissionLabel}</td>
                    <td>{row.totalAmountLabel}</td>
                    <td>{row.statusLabel}</td>
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
