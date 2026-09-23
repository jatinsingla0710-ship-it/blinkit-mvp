import { useMemo, useState } from 'react';
import { SalesRegister } from '@/components/orders/SalesRegister';
import { SalesDashboardKpis } from '@/components/sales/SalesDashboardKpis';
import { MonthlySalesChart } from '@/components/sales/MonthlySalesChart';
import {
  SalesFyComparisonPanel,
  SalesGrowthPanel,
  SalesPerformanceSummary,
  SalesTopInsights,
} from '@/components/sales/SalesAnalyticsPanels';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useSalesDashboardQuery,
  useSalesRegisterQuery,
} from '@/data/hooks';
import { dateRangeForPreset, type SalesDatePreset } from '@/data/sales-fiscal';
import { exportSalesRegisterCsv } from '@/data/live/salesDashboardApi';
import './SalesListPage.css';

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sales dashboard + register — converted sale invoices only.
 */
export function SalesListPage() {
  const dashboard = useSalesDashboardQuery();
  const [preset, setPreset] = useState<SalesDatePreset>('all_time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');

  const range = useMemo(
    () =>
      dateRangeForPreset(preset, {
        from: customFrom || undefined,
        to: customTo || undefined,
      }),
    [preset, customFrom, customTo],
  );

  const register = useSalesRegisterQuery({
    fromIso: range.from?.toISOString() ?? null,
    toIso: range.to?.toISOString() ?? null,
    search: search.trim() || undefined,
  });

  const filteredRegister = register.data ?? [];

  const onExport = () => {
    const csv = exportSalesRegisterCsv(filteredRegister);
    downloadCsv(`sales-${preset}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="ga-sales-list">
      <PageHeader
        title="Sales"
        subtitle="Completed sales · financial year analytics · invoice register"
        meta={
          dashboard.data
            ? `As of ${dashboard.data.asOfDate} (${dashboard.data.timezone})`
            : undefined
        }
        actions={
          <label className="ga-sales-list__search">
            <span aria-hidden>⌕</span>
            <input
              type="search"
              placeholder="Invoice, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search sales register"
            />
          </label>
        }
      />

      {dashboard.isPending ? (
        <Card>
          <p className="ga-sales-list__loading">Loading sales dashboard…</p>
        </Card>
      ) : dashboard.isError ? (
        <Card>
          <p className="ga-sales-list__error">
            {dashboard.error instanceof Error
              ? dashboard.error.message
              : 'Could not load sales dashboard'}
          </p>
        </Card>
      ) : dashboard.data ? (
        <>
          {!dashboard.data.hasSales ? (
            <EmptyState
              title="No sales yet"
              detail="Your sales analytics will appear here once orders are delivered and converted into sales."
            />
          ) : null}
          <SalesDashboardKpis metrics={dashboard.data} />
          <Card>
            <MonthlySalesChart metrics={dashboard.data} />
          </Card>
          <SalesPerformanceSummary metrics={dashboard.data} />
          <div className="ga-sales-list__compare-grid">
            <SalesGrowthPanel metrics={dashboard.data} />
            <SalesFyComparisonPanel metrics={dashboard.data} />
          </div>
          <SalesTopInsights metrics={dashboard.data} />
        </>
      ) : null}

      <section className="ga-sales-list__register">
        <div className="ga-sales-list__register-head">
          <h2 className="ga-sales-list__subhead">Sales Register</h2>
          <SalesDateFilter
            preset={preset}
            customFrom={customFrom}
            customTo={customTo}
            onPresetChange={setPreset}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        </div>
        <p className="ga-sales-list__register-note">
          Showing: <strong>{range.label}</strong>
          {filteredRegister.length > 0
            ? ` · ${filteredRegister.length} sale(s)`
            : ''}
        </p>
        <SalesRegister
          rows={filteredRegister}
          loading={register.isPending}
          onExportCsv={filteredRegister.length > 0 ? onExport : undefined}
        />
      </section>
    </div>
  );
}
