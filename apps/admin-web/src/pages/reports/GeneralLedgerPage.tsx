import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
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

export function GeneralLedgerPage() {
  const [preset, setPreset] = useState<SalesDatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [accountCode, setAccountCode] = useState('');

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
  const glAccountCode = accountCode.trim() || null;
  const { state } = useLedgerStatementsQuery({
    dateFrom,
    dateTo,
    glAccountCode,
  });

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="General Ledger"
        subtitle="Journal lines by account from Books"
        meta={range.label}
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
        <label>
          Account code
          <input
            type="text"
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            placeholder="All (e.g. 1000)"
          />
        </label>
        <Link to="/accounting" className="ga-rp-back">
          Open Books
        </Link>
      </div>

      <QueryStateGate title="General Ledger" state={state}>
        {(snapshot) => {
          if (!snapshot.hasLedgerActivity) {
            return (
              <EmptyState
                title="No Books journals yet"
                detail={snapshot.honestyNote}
              />
            );
          }
          if (snapshot.generalLedger.length === 0) {
            return (
              <EmptyState
                title="No ledger lines in this range"
                detail={
                  glAccountCode
                    ? `No lines for account ${glAccountCode} in ${snapshot.rangeLabel}.`
                    : 'Choose a wider date range or update Books.'
                }
              />
            );
          }
          return (
            <div className="ga-rp-pl">
              <p className="ga-rp-page__export-note">
                {snapshot.journalCount} journal(s) · {snapshot.generalLedger.length}{' '}
                line(s)
              </p>
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Account</th>
                      <th>Source</th>
                      <th>Memo</th>
                      <th>Debit</th>
                      <th>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.generalLedger.map((row) => (
                      <tr key={row.id}>
                        <td>{row.entryDateLabel}</td>
                        <td>
                          <span className="ga-table__mono">{row.accountCode}</span>{' '}
                          {row.accountName}
                        </td>
                        <td>{row.sourceType}</td>
                        <td>{row.memo}</td>
                        <td>{row.debitLabel}</td>
                        <td>{row.creditLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
