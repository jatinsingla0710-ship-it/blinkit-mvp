import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useLedgerStatementsQuery } from '@/data/hooks';
import { dateRangeForPreset, type SalesDatePreset } from '@/data/sales-fiscal';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

function toYmd(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TrialBalancePage() {
  const [preset, setPreset] = useState<SalesDatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(
    () =>
      dateRangeForPreset(preset, {
        from: customFrom || undefined,
        to: customTo || undefined,
      }),
    [preset, customFrom, customTo],
  );

  const dateFrom = toYmd(range.from) || toYmd(new Date());
  const dateTo = toYmd(range.to) || toYmd(new Date());
  const { state } = useLedgerStatementsQuery({ dateFrom, dateTo });

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Trial Balance"
        subtitle="Account balances from Books as of the end date"
        meta={`As of ${dateTo}`}
      />
      <Link to="/reports" className="ga-rp-back">
        ← Reports
      </Link>

      <div className="ga-rp-actions">
        <SalesDateFilter
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={setPreset}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
        <Link to="/accounting" className="ga-rp-back">
          Open Books
        </Link>
      </div>

      <QueryStateGate title="Trial Balance" state={state}>
        {(snapshot) => {
          if (!snapshot.hasLedgerActivity) {
            return (
              <EmptyState
                title="No Books journals yet"
                detail={snapshot.honestyNote}
              />
            );
          }
          return (
            <div className="ga-rp-pl">
              <KpiCards
                items={[
                  {
                    id: 'debits',
                    label: 'Total debits',
                    value: snapshot.trialBalanceDebitTotalLabel,
                  },
                  {
                    id: 'credits',
                    label: 'Total credits',
                    value: snapshot.trialBalanceCreditTotalLabel,
                    tone: snapshot.trialBalanceBalanced ? 'positive' : 'danger',
                    hint: snapshot.trialBalanceBalanced
                      ? 'Debits = credits'
                      : 'Out of balance',
                  },
                ]}
              />

              {snapshot.trialBalance.length === 0 ? (
                <EmptyState
                  title="No balances"
                  detail="Posted journals through this date have zero account activity."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th>Debit</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.trialBalance.map((row) => (
                        <tr key={row.accountId}>
                          <td className="ga-table__mono">{row.code}</td>
                          <td>{row.name}</td>
                          <td>{row.accountTypeLabel}</td>
                          <td>{row.debitLabel}</td>
                          <td>{row.creditLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="ga-rp-disclaimer">{snapshot.honestyNote}</p>
              <Button variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          );
        }}
      </QueryStateGate>
    </div>
  );
}
