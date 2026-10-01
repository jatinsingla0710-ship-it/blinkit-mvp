import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useReportsSnapshotQuery } from '@/data/hooks';
import type { ReportMetricCard, ReportTableRow } from '@/data/reports-types';
import {
  downloadCsvFile,
  exportSalesmanPerformanceCsv,
} from '@/data/financial-reports';
import { formatInr } from '@/data/live/format';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

/**
 * Salesman performance from converted sales (order creator attribution).
 * Does not invent commission — use Payroll / commission ledger for earnings.
 */
export function SalesmanPerformanceReportPage() {
  const { state } = useReportsSnapshotQuery();

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Salesman Performance"
        subtitle="Orders and revenue from converted invoices (by order creator)"
      />
      <Link to="/reports" className="ga-rp-back">
        ← Reports
      </Link>

      <QueryStateGate title="Salesman Performance" state={state}>
        {(snapshot) => {
          const section = snapshot.sections.find((s) => s.id === 'salesmen');
          const tableReport: ReportMetricCard | undefined =
            section?.reports.find((r) => r.chartKind === 'table' && r.rows?.length);
          const columns = (tableReport?.columns ?? [
            'Salesman',
            'Orders',
            'Revenue',
          ]).filter((col) => !/commission/i.test(col));
          const tableRows: ReportTableRow[] = (tableReport?.rows ?? []).map(
            (row) => ({
              ...row,
              cells: row.cells.slice(0, 3),
            }),
          );

          const exportRows = tableRows.map((r) => {
            const salesman = String(r.cells[0] ?? '—');
            const orderCount =
              Number(String(r.cells[1] ?? '0').replace(/,/g, '')) || 0;
            const revenue = parseInr(String(r.cells[2] ?? '0'));
            return { salesman, orderCount, revenue };
          });

          return (
            <>
              <p className="ga-rp-disclaimer">
                Attribution uses the order creator (created_by), not the assigned
                salesman. Commission is not shown here — open Payroll for earned
                commission snapshots.
              </p>
              <div className="ga-rp-summary">
                <div>
                  <p className="ga-rp-summary__label">Salesmen</p>
                  <p className="ga-rp-summary__value">{exportRows.length}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Total revenue</p>
                  <p className="ga-rp-summary__value">
                    {formatInr(exportRows.reduce((s, r) => s + r.revenue, 0))}
                  </p>
                </div>
              </div>
              <div className="ga-rp-actions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadCsvFile(
                      `salesman-performance-${new Date().toISOString().slice(0, 10)}.csv`,
                      exportSalesmanPerformanceCsv(exportRows),
                    )
                  }
                >
                  Export CSV
                </Button>
                <Link to="/salesmen">Open Salesmen →</Link>
                <Link to="/reports/payroll">Payroll report →</Link>
              </div>
              {tableRows.length === 0 ? (
                <EmptyState
                  title="No salesman sales yet"
                  detail="Converted invoices will show here by order creator."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        <tr key={row.id}>
                          {row.cells.map((cell, i) => (
                            <td key={`${row.id}-${i}`}>{cell}</td>
                          ))}
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

function parseInr(label: string): number {
  const n = Number(label.replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
