import { Link } from 'react-router-dom';
import './KpiCards.css';

/** Shared KPI card shape for Dashboard and Inventory consoles. */
export type KpiCardItem = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'info';
  href?: string;
};

type Props = {
  items: KpiCardItem[];
};

export function KpiCards({ items }: Props) {
  return (
    <div className="ga-kpi-grid">
      {items.map((kpi) => {
        const body = (
          <>
            <p className="ga-kpi__label">{kpi.label}</p>
            <p className="ga-kpi__value">{kpi.value}</p>
            {kpi.hint ? <p className="ga-kpi__hint">{kpi.hint}</p> : null}
          </>
        );
        const className = ['ga-kpi', kpi.tone ? `ga-kpi--${kpi.tone}` : '']
          .filter(Boolean)
          .join(' ');
        if (kpi.href) {
          return (
            <Link key={kpi.id} to={kpi.href} className={`${className} ga-kpi--link`}>
              {body}
            </Link>
          );
        }
        return (
          <article key={kpi.id} className={className}>
            {body}
          </article>
        );
      })}
    </div>
  );
}
