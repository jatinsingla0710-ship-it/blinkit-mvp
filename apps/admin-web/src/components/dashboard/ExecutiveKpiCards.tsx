import { Link } from 'react-router-dom';
import type { ExecutiveKpi, ExecutiveKpiId } from '@/data/dashboard-types';
import './ExecutiveKpiCards.css';

type Props = {
  items: ExecutiveKpi[];
};

function KpiIcon({ id }: { id: ExecutiveKpiId }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (id) {
    case 'monthly_revenue':
      return <span className="ga-exec-kpi__rupee-glyph">₹</span>;
    case 'pending_orders':
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case 'manager_collections_pending':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M7 8V6a5 5 0 0 1 10 0v2" />
          <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'in_transit':
      return (
        <svg {...common}>
          <path d="M3 17h4l2-7h6l2 4h4" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </svg>
      );
    case 'pending_to_receive':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 15h3" />
        </svg>
      );
    case 'driver_collections_pending':
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="3" />
          <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
          <path d="M16 14l3 2v3" />
        </svg>
      );
    default:
      return null;
  }
}

function displayKpiValue(kpi: ExecutiveKpi): string {
  const raw = (kpi.value ?? '').trim();
  const moneyIds: ExecutiveKpiId[] = [
    'monthly_revenue',
    'manager_collections_pending',
    'pending_to_receive',
    'driver_collections_pending',
  ];
  if (!moneyIds.includes(kpi.id)) {
    return raw || '—';
  }
  if (!raw || raw === '—') return '₹0';
  if (raw.startsWith('₹')) return raw;
  const cleaned = raw.replace(/^(INR|Rs\.?)\s*/i, '');
  return `₹${cleaned}`;
}

function KpiBody({ kpi }: { kpi: ExecutiveKpi }) {
  return (
    <>
      <div className="ga-exec-kpi__top">
        <span className="ga-exec-kpi__icon" aria-hidden="true">
          <KpiIcon id={kpi.id} />
        </span>
        <p className="ga-exec-kpi__label">{kpi.label}</p>
      </div>
      <p className="ga-exec-kpi__value">{displayKpiValue(kpi)}</p>
      {kpi.hint ? (
        <p className="ga-exec-kpi__hint">{kpi.hint}</p>
      ) : kpi.trend ? (
        <p className="ga-exec-kpi__hint">{kpi.trend.label}</p>
      ) : (
        <p className="ga-exec-kpi__hint ga-exec-kpi__hint--muted">
          Live from operations
        </p>
      )}
    </>
  );
}

export function ExecutiveKpiCards({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="ga-exec-kpi-grid ga-exec-kpi-grid--empty">
        <p className="ga-exec-kpi-empty">No KPI data available yet.</p>
      </div>
    );
  }

  return (
    <div className="ga-exec-kpi-grid">
      {items.map((kpi) => {
        const className = [
          'ga-exec-kpi',
          kpi.tone ? `ga-exec-kpi--${kpi.tone}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <Link key={kpi.id} to={kpi.href} className={className}>
            <KpiBody kpi={kpi} />
          </Link>
        );
      })}
    </div>
  );
}

export function ExecutiveKpiCardsSkeleton() {
  return (
    <div className="ga-exec-kpi-grid" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="ga-exec-kpi ga-exec-kpi--skeleton">
          <div className="ga-skeleton ga-skeleton--line ga-skeleton--short" />
          <div className="ga-skeleton ga-skeleton--line ga-skeleton--value" />
          <div className="ga-skeleton ga-skeleton--line ga-skeleton--hint" />
        </div>
      ))}
    </div>
  );
}
