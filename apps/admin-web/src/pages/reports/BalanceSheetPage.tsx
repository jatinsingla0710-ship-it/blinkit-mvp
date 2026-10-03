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
import './ReportsPage.css';

function toYmd(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function BalanceSheetPage() {
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
        title="Balance Sheet"
        subtitle="What you own, what you owe, and equity — as of the end date"
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

      <QueryStateGate title="Balance Sheet" state={state}>
        {(snapshot) => {
          const bs = snapshot.balanceSheet;
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
                    id: 'assets',
                    label: 'Assets',
                    value: bs.assetsTotalLabel,
                  },
                  {
                    id: 'liabilities',
                    label: 'Liabilities',
                    value: bs.liabilitiesTotalLabel,
                  },
                  {
                    id: 'equity',
                    label: 'Equity',
                    value: bs.equityTotalLabel,
                    hint: 'Includes retained earnings',
                  },
                  {
                    id: 'balance',
                    label: 'Balanced',
                    value: bs.balanced ? 'Yes' : 'No',
                    tone: bs.balanced ? 'positive' : 'danger',
                    hint: bs.balanced
                      ? 'Assets = liabilities + equity'
                      : 'Check Books journals',
                  },
                ]}
              />

              <section className="ga-rp-pl__section" aria-label="Assets">
                <h3>Assets</h3>
                {bs.assets.length === 0 ? (
                  <p className="ga-rp-disclaimer">No asset balances</p>
                ) : (
                  bs.assets.map((row) => (
                    <div key={row.accountCode} className="ga-rp-pl__row">
                      <span>
                        {row.accountCode} · {row.accountName}
                      </span>
                      <span>{row.amountLabel}</span>
                    </div>
                  ))
                )}
                <div className="ga-rp-pl__row ga-rp-pl__row--total">
                  <span>Total assets</span>
                  <span>{bs.assetsTotalLabel}</span>
                </div>
              </section>

              <section className="ga-rp-pl__section" aria-label="Liabilities">
                <h3>Liabilities</h3>
                {bs.liabilities.length === 0 ? (
                  <p className="ga-rp-disclaimer">No liability balances</p>
                ) : (
                  bs.liabilities.map((row) => (
                    <div key={row.accountCode} className="ga-rp-pl__row">
                      <span>
                        {row.accountCode} · {row.accountName}
                      </span>
                      <span>{row.amountLabel}</span>
                    </div>
                  ))
                )}
                <div className="ga-rp-pl__row ga-rp-pl__row--total">
                  <span>Total liabilities</span>
                  <span>{bs.liabilitiesTotalLabel}</span>
                </div>
              </section>

              <section className="ga-rp-pl__section" aria-label="Equity">
                <h3>Equity</h3>
                {bs.equity.map((row) => (
                  <div key={row.accountCode} className="ga-rp-pl__row">
                    <span>
                      {row.accountCode} · {row.accountName}
                    </span>
                    <span>{row.amountLabel}</span>
                  </div>
                ))}
                <div className="ga-rp-pl__row">
                  <span>Retained earnings</span>
                  <span>{bs.retainedEarningsLabel}</span>
                </div>
                <div className="ga-rp-pl__row ga-rp-pl__row--total">
                  <span>Total equity</span>
                  <span>{bs.equityTotalLabel}</span>
                </div>
                <div className="ga-rp-pl__row ga-rp-pl__row--total">
                  <span>Liabilities + equity</span>
                  <span>{bs.liabilitiesAndEquityTotalLabel}</span>
                </div>
              </section>

              <p className="ga-rp-disclaimer">{bs.disclaimer}</p>
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
