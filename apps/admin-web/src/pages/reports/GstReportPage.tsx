import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useGstTaxSummaryQuery } from '@/data/hooks';
import { GST_SUPPLY_TYPE_LABELS } from '@/data/gst';
import { dateRangeForPreset, type SalesDatePreset } from '@/data/sales-fiscal';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

function toYmd(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function GstReportPage() {
  const [preset, setPreset] = useState<SalesDatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(
    () =>
      dateRangeForPreset(preset, {
        from: customFrom || undefined,
        to: customTo || undefined,
      }),
    [preset, customFrom, customTo],
  );

  const dateFrom = toYmd(range.from) || toYmd(new Date());
  const dateTo = toYmd(range.to) || toYmd(new Date());
  const { state } = useGstTaxSummaryQuery({ dateFrom, dateTo });

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="GST Summary"
        subtitle="Input tax from received purchases — internal view, not a filing export"
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
        <Link to="/accounting" className="ga-rp-back">
          Open Books
        </Link>
      </div>

      <QueryStateGate title="GST Summary" state={state}>
        {(summary) => {
          if (summary.purchaseCount === 0) {
            return (
              <EmptyState
                title="No received purchases with tax in this range"
                detail="Receive supplier bills with tax (and GST supply type) to populate this summary."
              />
            );
          }
          return (
            <div className="ga-rp-pl">
              <KpiCards
                items={[
                  {
                    id: 'taxable',
                    label: 'Taxable value',
                    value: summary.taxableValueLabel,
                    hint: 'Purchase subtotals',
                  },
                  {
                    id: 'cgst',
                    label: 'CGST input',
                    value: summary.cgstInputLabel,
                  },
                  {
                    id: 'sgst',
                    label: 'SGST input',
                    value: summary.sgstInputLabel,
                  },
                  {
                    id: 'igst',
                    label: 'IGST input',
                    value: summary.igstInputLabel,
                  },
                  {
                    id: 'total',
                    label: 'Total input tax',
                    value: summary.totalInputTaxLabel,
                    hint:
                      summary.unclassifiedInput > 0
                        ? `Includes ${summary.unclassifiedInputLabel} unclassified`
                        : undefined,
                  },
                ]}
              />

              <p className="ga-rp-disclaimer">{summary.outputTaxNote}</p>

              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Bill</th>
                      <th>Supplier</th>
                      <th>Supply</th>
                      <th>Taxable</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>IGST</th>
                      <th>Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.purchaseDateLabel}</td>
                        <td>
                          <Link to={`/purchases/${row.id}`}>{row.billNumber}</Link>
                        </td>
                        <td>{row.supplierName}</td>
                        <td>{GST_SUPPLY_TYPE_LABELS[row.supplyType]}</td>
                        <td>{row.taxableValueLabel}</td>
                        <td>{row.cgstAmountLabel}</td>
                        <td>{row.sgstAmountLabel}</td>
                        <td>{row.igstAmountLabel}</td>
                        <td>{row.taxAmountLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="ga-rp-disclaimer">{summary.disclaimer}</p>
              <Button variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          );
        }}
      </QueryStateGate>
    </div>
  );
}
