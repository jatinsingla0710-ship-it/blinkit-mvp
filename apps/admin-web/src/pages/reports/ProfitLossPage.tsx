import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useProfitLossQuery } from '@/data/hooks';
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
  const { state } = useProfitLossQuery({ dateFrom, dateTo });

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Profit & Loss"
        subtitle="Sales vs recorded expenses and paid payroll"
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
      </div>

      <QueryStateGate title="Profit & Loss" state={state}>
        {(snapshot) => {
          const pl = snapshot.profitLoss;
          return (
            <div className="ga-rp-pl">
              <KpiCards
                items={[
                  {
                    id: 'sales',
                    label: 'Total Sales',
                    value: pl.salesTotalLabel,
                    hint: 'Converted invoices',
                  },
                  {
                    id: 'costs',
                    label: 'Total Expenses',
                    value: pl.totalCostsLabel,
                    hint: 'Company expenses + paid payroll',
                  },
                  {
                    id: 'result',
                    label: 'Operating Result',
                    value: pl.operatingResultLabel,
                    tone: pl.operatingResult >= 0 ? 'positive' : 'danger',
                  },
                  {
                    id: 'cash',
                    label: 'Net Cash Movement',
                    value: pl.netCashMovementLabel,
                    hint: 'Collections − refunds − costs',
                  },
                ]}
              />

              <section className="ga-rp-pl__section" aria-label="Income">
                <h3>Income / Sales</h3>
                <div className="ga-rp-pl__row">
                  <span>Sales</span>
                  <span>{pl.salesTotalLabel}</span>
                </div>
              </section>

              <section className="ga-rp-pl__section" aria-label="Money movement">
                <h3>Money Movement</h3>
                <div className="ga-rp-pl__row">
                  <span>Collections</span>
                  <span>{pl.collectionsTotalLabel}</span>
                </div>
                <div className="ga-rp-pl__row">
                  <span>Refunds</span>
                  <span>{pl.refundsTotalLabel}</span>
                </div>
              </section>

              <section className="ga-rp-pl__section" aria-label="Expenses">
                <h3>Expenses</h3>
                <div className="ga-rp-pl__row">
                  <span>Company Expenses</span>
                  <span>{pl.expensesTotalLabel}</span>
                </div>
                <div className="ga-rp-pl__row">
                  <span>Paid Payroll</span>
                  <span>{pl.payrollPaidTotalLabel}</span>
                </div>
                <div className="ga-rp-pl__row ga-rp-pl__row--total">
                  <span>Operating result</span>
                  <span>{pl.operatingResultLabel}</span>
                </div>
              </section>

              <p className="ga-rp-disclaimer">{pl.disclaimer}</p>
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
