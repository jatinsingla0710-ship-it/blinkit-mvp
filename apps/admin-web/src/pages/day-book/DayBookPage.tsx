import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  exportDayBookCsv,
  type DayBookEntryType,
} from '@/data/day-book';
import { useDayBookSnapshotQuery } from '@/data/hooks';
import { todayExpenseDate } from '@/data/company-expenses';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './DayBookPage.css';

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TYPE_OPTIONS: { id: DayBookEntryType | 'all'; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'sale', label: 'Sale' },
  { id: 'collection', label: 'Collection' },
  { id: 'expense', label: 'Expense' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'refund', label: 'Refund' },
];

const METHOD_OPTIONS = [
  'all',
  'Cash',
  'Bank',
  'UPI',
  'Other',
  'Online',
  'Pay on delivery',
  '—',
] as const;

export function DayBookPage() {
  const today = todayExpenseDate();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [type, setType] = useState<DayBookEntryType | 'all'>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');

  const { state } = useDayBookSnapshotQuery({
    dateFrom,
    dateTo,
    type,
    paymentMethod,
  });

  const methodOptions = useMemo(() => [...METHOD_OPTIONS], []);

  return (
    <QueryStateGate
      title="Day Book"
      state={state}
      emptyTitle="No money movement today"
      emptyDetail="Sales collections and expenses for this date will show here."
    >
      {(snapshot) => (
        <div className="ga-daybook">
          <PageHeader
            title="Day Book"
            subtitle="See all money coming in and going out"
            meta={`As of ${snapshot.generatedAtLabel}`}
            actions={
              <Button
                variant="ghost"
                onClick={() =>
                  downloadCsv(
                    `day-book-${dateFrom}-to-${dateTo}.csv`,
                    exportDayBookCsv(snapshot.entries),
                  )
                }
                disabled={snapshot.entries.length === 0}
              >
                Export
              </Button>
            }
          />

          <SectionRelatedLinks
            label="Accounting"
            links={[...ACCOUNTING_SECTION_LINKS]}
          />

          <div className="ga-daybook__filters">
            <label>
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as DayBookEntryType | 'all')
                }
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Payment method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {methodOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'all' ? 'All methods' : opt}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ga-daybook__summary">
            <div>
              <p className="ga-daybook__label">Money in</p>
              <p className="ga-daybook__value ga-daybook__value--in">
                {snapshot.moneyInLabel}
              </p>
            </div>
            <div>
              <p className="ga-daybook__label">Money out</p>
              <p className="ga-daybook__value ga-daybook__value--out">
                {snapshot.moneyOutLabel}
              </p>
            </div>
            <div>
              <p className="ga-daybook__label">Net</p>
              <p className="ga-daybook__value">{snapshot.netLabel}</p>
            </div>
          </div>

          {snapshot.entries.length === 0 ? (
            <EmptyState
              title="Nothing in this range"
              detail="Try another date or clear the filters."
            />
          ) : (
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.entries.map((row) => (
                    <tr key={row.id}>
                      <td>{row.dateLabel}</td>
                      <td>{row.typeLabel}</td>
                      <td>
                        {row.href ? (
                          <Link to={row.href}>{row.description}</Link>
                        ) : (
                          row.description
                        )}
                      </td>
                      <td>{row.moneyInLabel}</td>
                      <td>{row.moneyOutLabel}</td>
                      <td>{row.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
