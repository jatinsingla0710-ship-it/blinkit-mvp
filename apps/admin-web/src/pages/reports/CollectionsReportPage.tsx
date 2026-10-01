import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useDayBookSnapshotQuery } from '@/data/hooks';
import { dateRangeForPreset, type SalesDatePreset } from '@/data/sales-fiscal';
import {
  downloadCsvFile,
  exportCollectionsCsv,
  summarizeDayBookByType,
} from '@/data/financial-reports';
import { formatInr } from '@/data/live/format';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

function toYmd(d: Date | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CollectionsReportPage() {
  const [preset, setPreset] = useState<SalesDatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [method, setMethod] = useState('all');

  const range = useMemo(
    () =>
      dateRangeForPreset(preset, {
        from: customFrom || undefined,
        to: customTo || undefined,
      }),
    [preset, customFrom, customTo],
  );

  const dateFrom = toYmd(range.from);
  const dateTo = toYmd(range.to);
  const { state } = useDayBookSnapshotQuery({
    dateFrom,
    dateTo,
    type: 'all',
    paymentMethod: method === 'all' ? undefined : method,
  });

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Collections Report"
        subtitle="Money received — not the same as sales"
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
          Method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="all">All</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank">Bank</option>
            <option value="Online">Online</option>
          </select>
        </label>
      </div>

      <QueryStateGate title="Collections" state={state}>
        {(snapshot) => {
          const moneyRows = snapshot.entries.filter(
            (e) => e.type === 'sale' || e.type === 'collection',
          );
          const byType = summarizeDayBookByType(snapshot.entries);
          const totalCollected = byType.salesIn + byType.collectionsIn;
          const cash = moneyRows
            .filter((e) => /cash/i.test(e.paymentMethod))
            .reduce((s, e) => s + e.moneyIn, 0);
          const online = moneyRows
            .filter((e) => !/cash/i.test(e.paymentMethod))
            .reduce((s, e) => s + e.moneyIn, 0);

          return (
            <>
              <div className="ga-rp-summary">
                <div>
                  <p className="ga-rp-summary__label">Total collected</p>
                  <p className="ga-rp-summary__value">{formatInr(totalCollected)}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Cash</p>
                  <p className="ga-rp-summary__value">{formatInr(cash)}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Online / other</p>
                  <p className="ga-rp-summary__value">{formatInr(online)}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Collections</p>
                  <p className="ga-rp-summary__value">{moneyRows.length}</p>
                </div>
              </div>

              <div className="ga-rp-actions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadCsvFile(
                      `collections-${dateFrom}-${dateTo}.csv`,
                      exportCollectionsCsv(
                        moneyRows.map((e) => ({
                          date: e.atIso.slice(0, 10),
                          customer: e.partyLabel ?? '—',
                          amount: e.moneyIn,
                          method: e.paymentMethod,
                          reference: e.description,
                        })),
                      ),
                    )
                  }
                >
                  Export CSV
                </Button>
              </div>

              {moneyRows.length === 0 ? (
                <EmptyState
                  title="No collections in this period"
                  detail="Try another date range or method."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moneyRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.dateLabel}</td>
                          <td>
                            {row.href ? (
                              <Link to={row.href}>{row.partyLabel ?? '—'}</Link>
                            ) : (
                              row.partyLabel ?? '—'
                            )}
                          </td>
                          <td>{row.typeLabel}</td>
                          <td>{row.moneyInLabel}</td>
                          <td>{row.paymentMethod}</td>
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
