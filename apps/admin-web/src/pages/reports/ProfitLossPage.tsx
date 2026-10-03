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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ProfitLossPage() {
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
        title="Profit & Loss"
        subtitle="Revenue, cost of goods, expenses, and profit from Books"
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
        <Link to="/accounting" className="ga-rp-back">
          Open Books
        </Link>
      </div>

      <QueryStateGate title="Profit & Loss" state={state}>
        {(snapshot) => {
          const pl = snapshot.profitLoss;
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
                    id: 'revenue',
                    label: 'Revenue',
                    value: pl.revenueLabel,
                    hint: 'Sales from Books',
                  },
                  {
                    id: 'cogs',
                    label: 'Cost of Goods Sold',
                    value: pl.cogsLabel,
                  },
                  {
                    id: 'gross',
                    label: 'Gross Profit',
                    value: pl.grossProfitLabel,
                    hint: `Margin ${pl.grossMarginLabel}`,
                    tone: pl.grossProfit >= 0 ? 'positive' : 'danger',
                  },
                  {
                    id: 'net',
                    label: 'Net Profit',
                    value: pl.netProfitLabel,
                    hint: 'After expenses and payroll',
                    tone: pl.netProfit >= 0 ? 'positive' : 'danger',
                  },
                ]}
              />

              <section className="ga-rp-pl__section" aria-label="Profit and loss">
                <h3>Statement</h3>
                {pl.lines.map((line) => (
                  <div
                    key={line.id}
                    className={
                      line.emphasis
                        ? 'ga-rp-pl__row ga-rp-pl__row--total'
                        : 'ga-rp-pl__row'
                    }
                  >
                    <span>{line.label}</span>
                    <span>{line.amountLabel}</span>
                  </div>
                ))}
              </section>

              <p className="ga-rp-disclaimer">{pl.disclaimer}</p>
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
