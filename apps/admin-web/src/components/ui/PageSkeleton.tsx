import './PageSkeleton.css';

type Props = {
  title?: string;
  /** Number of placeholder blocks under the header. */
  blocks?: number;
};

/**
 * Shared loading skeleton — keeps layout visible instead of a blank screen.
 */
export function PageSkeleton({ title = 'Loading', blocks = 3 }: Props) {
  return (
    <div className="ga-page-skeleton" aria-busy="true" aria-live="polite">
      <div className="ga-page-skeleton__header">
        <div className="ga-skeleton ga-skeleton--title" />
        <div className="ga-skeleton ga-skeleton--subtitle" />
        <span className="ga-page-skeleton__sr">{title}</span>
      </div>
      <div className="ga-page-skeleton__kpis">
        <div className="ga-skeleton ga-skeleton--kpi" />
        <div className="ga-skeleton ga-skeleton--kpi" />
        <div className="ga-skeleton ga-skeleton--kpi" />
        <div className="ga-skeleton ga-skeleton--kpi" />
      </div>
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="ga-skeleton ga-skeleton--block" />
      ))}
    </div>
  );
}
