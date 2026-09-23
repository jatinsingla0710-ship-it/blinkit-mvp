import { useMemo, useState } from 'react';
import { PlaceholderChart } from '@/components/reports/PlaceholderChart';
import {
  chartSeriesForView,
  type ChartViewMode,
  type SalesDashboardMetricsVm,
} from '@/data/sales-dashboard-map';
import './MonthlySalesChart.css';

const VIEW_OPTIONS: { id: ChartViewMode; label: string }[] = [
  { id: 'current_financial_year', label: 'Current Financial Year' },
  { id: 'previous_financial_year', label: 'Previous Financial Year' },
  { id: 'calendar_year', label: 'Calendar Year' },
];

type Props = {
  metrics: SalesDashboardMetricsVm;
};

export function MonthlySalesChart({ metrics }: Props) {
  const [view, setView] = useState<ChartViewMode>('current_financial_year');
  const series = useMemo(
    () => chartSeriesForView(metrics, view),
    [metrics, view],
  );
  const viewLabel =
    view === 'calendar_year'
      ? `${metrics.monthlyBreakdown.calendarYear.year}`
      : view === 'previous_financial_year'
        ? metrics.previousFinancialYear.label
        : metrics.currentFinancialYear.label;

  return (
    <section className="ga-sales-chart">
      <div className="ga-sales-chart__head">
        <div>
          <h3 className="ga-sales-chart__title">Monthly Sales</h3>
          <p className="ga-sales-chart__sub">
            Completed sales by month · {viewLabel}
          </p>
        </div>
        <label className="ga-sales-chart__select">
          View
          <select
            value={view}
            onChange={(e) => setView(e.target.value as ChartViewMode)}
          >
            {VIEW_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {series.every((p) => p.value === 0) ? (
        <p className="ga-sales-chart__empty">
          No sales in this period yet. Bars will appear when orders are
          converted to sales.
        </p>
      ) : (
        <PlaceholderChart kind="bar" series={series} />
      )}
    </section>
  );
}
