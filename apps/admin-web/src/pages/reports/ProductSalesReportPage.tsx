import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useProductSalesReportQuery } from '@/data/hooks';
import { dateRangeForPreset, type SalesDatePreset } from '@/data/sales-fiscal';
import {
  downloadCsvFile,
  exportProductSalesCsv,
} from '@/data/financial-reports';
import { formatInr } from '@/data/live/format';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

function toYmd(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProductSalesReportPage() {
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

  const { state } = useProductSalesReportQuery({
    dateFrom: toYmd(range.from),
    dateTo: toYmd(range.to),
  });

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Product Sales"
        subtitle="Quantity and value from converted sale lines"
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
        <input
          type="search"
          placeholder="Search product"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <QueryStateGate title="Product Sales" state={state}>
        {(snapshot) => {
          const q = search.trim().toLowerCase();
          const rows = snapshot.rows.filter(
            (r) =>
              !q ||
              r.product.toLowerCase().includes(q) ||
              r.sku.toLowerCase().includes(q),
          );
          const qty = rows.reduce((s, r) => s + r.quantity, 0);
          const value = rows.reduce((s, r) => s + r.salesValue, 0);

          return (
            <>
              <div className="ga-rp-summary">
                <div>
                  <p className="ga-rp-summary__label">Products</p>
                  <p className="ga-rp-summary__value">{rows.length}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Quantity sold</p>
                  <p className="ga-rp-summary__value">{qty}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Sales value</p>
                  <p className="ga-rp-summary__value">{formatInr(value)}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsvFile(
                    `product-sales-${new Date().toISOString().slice(0, 10)}.csv`,
                    exportProductSalesCsv(rows),
                  )
                }
              >
                Export CSV
              </Button>
              {rows.length === 0 ? (
                <EmptyState
                  title="No product sales in this period"
                  detail="Try another date range."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity Sold</th>
                        <th>Sales Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.sku}-${row.product}`}>
                          <td>{row.product}</td>
                          <td>{row.sku}</td>
                          <td>{row.quantity}</td>
                          <td>{formatInr(row.salesValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}
      </QueryStateGate>
    </div>
  );
}
