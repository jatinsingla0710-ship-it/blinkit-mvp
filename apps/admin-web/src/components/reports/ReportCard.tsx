import type { ReportMetricCard } from '@/data/reports-types';
import { PlaceholderChart } from '@/components/reports/PlaceholderChart';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './ReportCard.css';

type Props = {
  report: ReportMetricCard;
};

function isEmptyReport(report: ReportMetricCard): boolean {
  if (report.unavailable) return true;
  if (report.chartKind === 'table') {
    return !report.rows || report.rows.length === 0;
  }
  return !report.series || report.series.length === 0;
}

export function ReportCard({ report }: Props) {
  const empty = isEmptyReport(report);

  return (
    <Card
      title={report.title}
      action={
        report.unavailable ? (
          <span className="ga-rp-card__badge">Not available</span>
        ) : report.placeholder ? (
          <span className="ga-rp-card__badge">Placeholder</span>
        ) : undefined
      }
    >
      <p className="ga-rp-card__question">{report.question}</p>
      {report.value ? (
        <div className="ga-rp-card__headline">
          <p className="ga-rp-card__value">{report.value}</p>
          {report.hint ? (
            <p className="ga-rp-card__hint">{report.hint}</p>
          ) : null}
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          title={report.unavailable ? 'Report not available' : 'No data yet'}
          detail={
            report.emptyDetail ??
            'No converted sales data for this view.'
          }
        />
      ) : report.chartKind === 'table' && report.columns && report.rows ? (
        <div className="ga-table-wrap ga-rp-card__table">
          <table className="ga-table">
            <thead>
              <tr>
                {report.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, i) => (
                    <td
                      key={`${row.id}-${i}`}
                      className={i === 0 ? 'ga-table__primary' : undefined}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PlaceholderChart
          kind={report.chartKind}
          series={report.series}
          placeholder={false}
        />
      )}
    </Card>
  );
}
