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

export function CashFlowPage() {
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
        title="Cash Flow"
        subtitle="How cash and bank moved — from Books sources"
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
        <Link to="/cash-bank" className="ga-rp-back">
          Cash & Bank
        </Link>
      </div>

      <QueryStateGate title="Cash Flow" state={state}>
        {(snapshot) => {
          const cf = snapshot.cashFlow;
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
                    id: 'opening',
                    label: 'Opening cash + bank',
                    value: cf.openingCashBankLabel,
                  },
                  {
                    id: 'net',
                    label: 'Net change',
                    value: formatSigned(cf.netChange, cf.sections[4]?.amountLabel),
                    tone: cf.netChange >= 0 ? 'positive' : 'danger',
                  },
                  {
                    id: 'closing',
                    label: 'Closing cash + bank',
                    value: cf.closingCashBankLabel,
                  },
                ]}
              />

              <section className="ga-rp-pl__section" aria-label="Cash flow">
                <h3>Statement</h3>
                {cf.sections.map((section) => (
                  <div
                    key={section.id}
                    className={
                      section.id === 'closing' || section.id === 'net'
                        ? 'ga-rp-pl__row ga-rp-pl__row--total'
                        : 'ga-rp-pl__row'
                    }
                  >
                    <span>{section.label}</span>
                    <span>{section.amountLabel}</span>
                  </div>
                ))}
              </section>

              <p className="ga-rp-disclaimer">{cf.disclaimer}</p>
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

function formatSigned(amount: number, label: string | undefined): string {
  return label ?? String(amount);
}
