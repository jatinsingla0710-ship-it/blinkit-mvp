import type { ChartSeriesPoint, ChartKind } from '@/data/reports-types';
import './PlaceholderChart.css';

type Props = {
  kind: ChartKind;
  series?: ChartSeriesPoint[];
  placeholder?: boolean;
};

/**
 * Visual-only chart shell for Reports v1.
 * Replace with a real chart library when warehouse metrics are wired.
 */
export function PlaceholderChart({ kind, series = [], placeholder }: Props) {
  if (kind === 'table') return null;

  const max = Math.max(1, ...series.map((s) => s.value));

  if (placeholder) {
    return (
      <div className="ga-rp-chart ga-rp-chart--placeholder">
        <p>Chart placeholder · awaiting live metrics</p>
      </div>
    );
  }

  if (kind === 'donut') {
    return (
      <div className="ga-rp-chart ga-rp-chart--donut">
        <div className="ga-rp-chart__donut-ring" aria-hidden />
        <ul className="ga-rp-chart__legend">
          {series.map((point) => (
            <li key={point.label}>
              <span className="ga-rp-chart__swatch" />
              <span>
                {point.label}
                {point.displayValue ? ` · ${point.displayValue}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (kind === 'line') {
    return (
      <div className="ga-rp-chart ga-rp-chart--line">
        <div className="ga-rp-chart__line-track" aria-hidden>
          {series.map((point, i) => {
            const h = Math.round((point.value / max) * 100);
            return (
              <span
                key={point.label}
                className="ga-rp-chart__line-dot"
                style={{
                  left: `${(i / Math.max(1, series.length - 1)) * 100}%`,
                  bottom: `${h}%`,
                }}
                title={point.displayValue ?? String(point.value)}
              />
            );
          })}
          <span className="ga-rp-chart__line-path" />
        </div>
        <div className="ga-rp-chart__axis">
          {series.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </div>
    );
  }

  /* bar */
  return (
    <div className="ga-rp-chart ga-rp-chart--bar">
      <div className="ga-rp-chart__bars">
        {series.map((point) => {
          const h = Math.max(8, Math.round((point.value / max) * 100));
          return (
            <div key={point.label} className="ga-rp-chart__bar-col">
              <div
                className="ga-rp-chart__bar"
                style={{ height: `${h}%` }}
                title={point.displayValue ?? String(point.value)}
              />
              <span>{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
