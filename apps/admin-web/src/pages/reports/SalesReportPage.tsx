import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { SalesRegister } from '@/components/orders/SalesRegister';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSalesRegisterQuery } from '@/data/hooks';
import {
  businessDayEndInclusiveIso,
  businessDayStartIso,
} from '@/data/business-dates';
import { dateRangeForPreset, type SalesDatePreset } from '@/data/sales-fiscal';
import { exportSalesRegisterCsv } from '@/data/live/salesDashboardApi';
import {
  averageSaleValue,
  downloadCsvFile,
  sumSalesTotal,
} from '@/data/financial-reports';
import { formatInr } from '@/data/live/format';
import './ReportsPage.css';

function toYmd(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function SalesReportPage() {
  const [preset, setPreset] = useState<SalesDatePreset>('this_month');
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

  const fromYmd = toYmd(range.from);
  const toYmdVal = toYmd(range.to);

  const register = useSalesRegisterQuery({
    fromIso: fromYmd ? businessDayStartIso(fromYmd) : null,
    toIso: toYmdVal ? businessDayEndInclusiveIso(toYmdVal) : null,
    search: search.trim() || undefined,
  });

  const rows = register.data ?? [];
  const salesTotal = sumSalesTotal(
    rows.map((r) => ({
      id: r.saleId,
      total: r.amount,
      convertedAt: r.saleDateIso,
      status: r.saleStatus,
    })),
  );
  const avg = averageSaleValue(
    rows.map((r) => ({
      id: r.saleId,
      total: r.amount,
      convertedAt: r.saleDateIso,
      status: r.saleStatus,
    })),
  );

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Sales Report"
        subtitle="Converted invoices from the sales register"
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
          <span className="ga-sr-only">Search</span>
          <input
            type="search"
            placeholder="Search customer or invoice"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsvFile(
              `sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
              exportSalesRegisterCsv(rows),
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <div className="ga-rp-summary">
        <div>
          <p className="ga-rp-summary__label">Sales count</p>
          <p className="ga-rp-summary__value">{rows.length}</p>
        </div>
        <div>
          <p className="ga-rp-summary__label">Sales value</p>
          <p className="ga-rp-summary__value">{formatInr(salesTotal)}</p>
        </div>
        <div>
          <p className="ga-rp-summary__label">Average sale</p>
          <p className="ga-rp-summary__value">{formatInr(avg)}</p>
        </div>
      </div>

      {register.isError ? (
        <EmptyState
          title="Could not load sales"
          detail={register.error?.message ?? 'Try again.'}
        />
      ) : rows.length === 0 && !register.isPending ? (
        <EmptyState
          title="No sales in this period"
          detail="Try another date range."
        />
      ) : (
        <SalesRegister
          rows={rows}
          loading={register.isPending}
          onExportCsv={() =>
            downloadCsvFile(
              `sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
              exportSalesRegisterCsv(rows),
            )
          }
        />
      )}
    </div>
  );
}
