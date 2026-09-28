import type { CSSProperties } from 'react';

type SkeletonProps = {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
};

export function Skeleton({ width = '100%', height = 16 }: SkeletonProps) {
  return (
    <span
      className="ga-sales-skeleton"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

type LoadingStateProps = {
  /** Announced to screen readers; not shown visually. */
  label: string;
  variant?: 'list' | 'kpis' | 'detail';
  rows?: number;
};

/** Placeholder shaped like the content that is loading. */
export function LoadingState({ label, variant = 'list', rows = 3 }: LoadingStateProps) {
  return (
    <div className="ga-sales-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="ga-sales-sr-only">{label}</span>
      {variant === 'kpis' ? (
        <div className="ga-sales-kpi-grid">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="ga-sales-kpi" aria-hidden="true">
              <Skeleton width="60%" height={14} />
              <Skeleton width="45%" height={28} />
            </div>
          ))}
        </div>
      ) : null}
      {variant === 'list' ? (
        <div className="ga-sales-list">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="ga-sales-list-item" aria-hidden="true">
              <Skeleton width="55%" height={18} />
              <Skeleton width="80%" height={14} />
            </div>
          ))}
        </div>
      ) : null}
      {variant === 'detail' ? (
        <div className="ga-sales-card-skeleton" aria-hidden="true">
          <Skeleton width="50%" height={22} />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} width={i % 2 ? '70%' : '90%'} height={14} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
