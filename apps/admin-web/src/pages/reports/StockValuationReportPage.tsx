import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useInventorySnapshotQuery } from '@/data/hooks';
import {
  buildStockValuationReport,
  exportStockValuationCsv,
  filterInventoryListRows,
  type InventoryListStatusFilter,
} from '@/data/inventory-ops';
import { downloadCsvFile } from '@/data/financial-reports';
import { InventoryStatusBadge } from '@/components/inventory/InventoryStatusBadge';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

export function StockValuationReportPage() {
  const { state } = useInventorySnapshotQuery();
  const [status, setStatus] = useState<InventoryListStatusFilter>('all');
  const [search, setSearch] = useState('');

  const report = useMemo(() => {
    if (!state.data) return null;
    const filtered = filterInventoryListRows(state.data.rows, {
      search,
      status,
    });
    return buildStockValuationReport({
      generatedAtLabel: state.data.generatedAtLabel,
      rows: filtered,
    });
  }, [state.data, search, status]);

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Stock Valuation"
        subtitle="On-hand stock value at weighted average cost — same balances as Inventory"
      />
      <Link to="/reports" className="ga-rp-back">
        ← Reports
      </Link>

      <QueryStateGate title="Stock Valuation" state={state}>
        {() =>
          report && report.rows.length === 0 && !search && status === 'all' ? (
            <EmptyState
              title="No stock balances yet"
              detail="Stock value appears after warehouse balances exist."
            />
          ) : report ? (
            <>
              <KpiCards
                items={[
                  {
                    id: 'value',
                    label: 'Stock value (filtered)',
                    value: report.totalStockValueLabel,
                    hint: 'Weighted average cost',
                    tone: 'positive',
                  },
                  {
                    id: 'skus',
                    label: 'SKUs',
                    value: String(report.totalSkus),
                  },
                  {
                    id: 'low',
                    label: 'Low stock',
                    value: String(report.lowStockCount),
                    tone: report.lowStockCount > 0 ? 'warning' : 'default',
                  },
                  {
                    id: 'out',
                    label: 'Out of stock',
                    value: String(report.outOfStockCount),
                    tone: report.outOfStockCount > 0 ? 'danger' : 'default',
                  },
                  {
                    id: 'incomplete',
                    label: 'Cost incomplete',
                    value: String(report.incompleteCostCount),
                    tone:
                      report.incompleteCostCount > 0 ? 'warning' : 'default',
                  },
                ]}
              />

              <div className="ga-rp-actions">
                <input
                  type="search"
                  placeholder="Search product or SKU"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as InventoryListStatusFilter)
                  }
                >
                  <option value="all">All status</option>
                  <option value="healthy">In stock</option>
                  <option value="low">Low stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setStatus('all');
                  }}
                >
                  Reset filters
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadCsvFile(
                      `stock-valuation-${new Date().toISOString().slice(0, 10)}.csv`,
                      exportStockValuationCsv(report.rows),
                    )
                  }
                >
                  Export CSV
                </Button>
                <Link to="/inventory">Open Inventory →</Link>
                <Link to="/inventory?status=low">Low stock →</Link>
              </div>

              {report.rows.length === 0 ? (
                <EmptyState
                  title="No matching SKUs"
                  detail="Try another search or status filter."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Stock</th>
                        <th>Avg Cost</th>
                        <th>Stock Value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr key={row.skuId}>
                          <td>
                            <Link to={row.detailHref}>{row.productName}</Link>
                          </td>
                          <td className="ga-table__mono">{row.skuCode}</td>
                          <td>{row.mixedStockLabel}</td>
                          <td>{row.averageUnitCostLabel}</td>
                          <td>
                            <strong>{row.stockValueLabel}</strong>
                            {row.valuationIncomplete ? (
                              <div className="ga-rp-muted">Cost incomplete</div>
                            ) : null}
                          </td>
                          <td>
                            <InventoryStatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null
        }
      </QueryStateGate>
    </div>
  );
}
