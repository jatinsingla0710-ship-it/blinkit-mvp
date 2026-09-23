import type { SalesDashboardMetricsVm } from '@/data/sales-dashboard-map';
import { Card } from '@/components/ui/Card';
import './SalesAnalyticsPanels.css';

type Props = {
  metrics: SalesDashboardMetricsVm;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ga-sales-stat">
      <p className="ga-sales-stat__label">{label}</p>
      <p className="ga-sales-stat__value">{value}</p>
    </div>
  );
}

export function SalesPerformanceSummary({ metrics }: Props) {
  return (
    <Card title="Sales Performance">
      <div className="ga-sales-stats">
        <Stat label="Total Sales" value={metrics.performance.totalSalesLabel} />
        <Stat
          label="Number of Sales"
          value={`${metrics.performance.saleCount}`}
        />
        <Stat
          label="Average Sale Value"
          value={metrics.performance.avgSaleValueLabel}
        />
        <Stat
          label="Highest Sales Month"
          value={metrics.performance.highestMonthLabel}
        />
        <Stat
          label="Lowest Sales Month"
          value={metrics.performance.lowestMonthLabel}
        />
        <Stat label="Best Sales Day" value={metrics.performance.bestDayLabel} />
      </div>
    </Card>
  );
}

export function SalesGrowthPanel({ metrics }: Props) {
  const tone = metrics.monthComparison.isPositive ? 'positive' : 'negative';
  return (
    <Card title="Current Month vs Last Month">
      <div className={`ga-sales-compare ga-sales-compare--${tone}`}>
        <div>
          <p className="ga-sales-compare__label">Current Month</p>
          <p className="ga-sales-compare__value">
            {metrics.monthComparison.currentLabel}
          </p>
        </div>
        <div>
          <p className="ga-sales-compare__label">Last Month</p>
          <p className="ga-sales-compare__value">
            {metrics.monthComparison.previousLabel}
          </p>
        </div>
        <div>
          <p className="ga-sales-compare__label">Difference</p>
          <p className="ga-sales-compare__value">
            {metrics.monthComparison.differenceLabel}
          </p>
        </div>
        <div>
          <p className="ga-sales-compare__label">Growth</p>
          <p className="ga-sales-compare__value">
            {metrics.monthComparison.growthLabel}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function SalesFyComparisonPanel({ metrics }: Props) {
  return (
    <Card title="Financial Year Comparison">
      <div className="ga-table-wrap">
        <table className="ga-table ga-sales-fy-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{metrics.currentFinancialYear.label}</th>
              <th>{metrics.previousFinancialYear.label}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Sales</td>
              <td>{metrics.fyComparison.current.totalLabel}</td>
              <td>{metrics.fyComparison.previous.totalLabel}</td>
            </tr>
            <tr>
              <td>Number of Sales</td>
              <td>{metrics.fyComparison.current.count}</td>
              <td>{metrics.fyComparison.previous.count}</td>
            </tr>
            <tr>
              <td>Average Sale Value</td>
              <td>{metrics.fyComparison.current.avgLabel}</td>
              <td>{metrics.fyComparison.previous.avgLabel}</td>
            </tr>
            <tr>
              <td>Growth</td>
              <td colSpan={2}>{metrics.fyComparison.growthLabel}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function SalesTopInsights({ metrics }: Props) {
  if (
    metrics.topCustomers.length === 0 &&
    metrics.topProducts.length === 0 &&
    metrics.paymentBreakdown.length === 0
  ) {
    return null;
  }

  return (
    <div className="ga-sales-insights">
      {metrics.topCustomers.length > 0 ? (
        <Card title="Top Customers">
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Revenue</th>
                  <th>Sales</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topCustomers.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.amountLabel}</td>
                    <td>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {metrics.topProducts.length > 0 ? (
        <Card title="Top Products">
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topProducts.map((p) => (
                  <tr key={`${p.sku}-${p.name}`}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td>{p.quantity}</td>
                    <td>{p.revenueLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {metrics.paymentBreakdown.length > 0 ? (
        <Card title="Payment Methods">
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Sales</th>
                </tr>
              </thead>
              <tbody>
                {metrics.paymentBreakdown.map((p) => (
                  <tr key={p.method}>
                    <td>{p.methodLabel}</td>
                    <td>{p.amountLabel}</td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
