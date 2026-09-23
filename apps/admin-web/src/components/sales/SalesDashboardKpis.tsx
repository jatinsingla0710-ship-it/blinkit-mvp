import type { SalesDashboardMetricsVm } from '@/data/sales-dashboard-map';
import { KpiCards, type KpiCardItem } from '@/components/dashboard/KpiCards';

type Props = {
  metrics: SalesDashboardMetricsVm;
};

export function SalesDashboardKpis({ metrics }: Props) {
  const items: KpiCardItem[] = [
    {
      id: 'all_time',
      label: 'Total Sales',
      value: metrics.allTime.amountLabel,
      hint: `${metrics.allTime.count} completed sales · ${metrics.allTime.hint}`,
      tone: metrics.allTime.amount > 0 ? 'positive' : 'default',
    },
    {
      id: 'current_month',
      label: 'Current Month Sales',
      value: metrics.currentMonth.amountLabel,
      hint: `${metrics.currentMonth.periodLabel} · ${metrics.currentMonth.count} sales · ${metrics.currentMonth.compareHint}`,
      tone:
        metrics.currentMonth.growthPct >= 0 ? 'positive' : metrics.currentMonth.growthPct < 0 ? 'warning' : 'default',
    },
    {
      id: 'previous_month',
      label: 'Last Month Sales',
      value: metrics.previousMonth.amountLabel,
      hint: `${metrics.previousMonth.periodLabel} · ${metrics.previousMonth.hint} · ${metrics.previousMonth.growthLabel} vs prior month`,
    },
    {
      id: 'current_fy',
      label: 'Current Financial Year',
      value: metrics.currentFinancialYear.amountLabel,
      hint: `${metrics.currentFinancialYear.label} · ${metrics.currentFinancialYear.hint}`,
      tone: 'default',
    },
    {
      id: 'previous_fy',
      label: 'Previous Financial Year',
      value: metrics.previousFinancialYear.amountLabel,
      hint: `${metrics.previousFinancialYear.label} · ${metrics.previousFinancialYear.count} sales · ${metrics.previousFinancialYear.compareHint}`,
    },
  ];

  return <KpiCards items={items} />;
}
