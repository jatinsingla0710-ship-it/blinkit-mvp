import { Link } from 'react-router-dom';
import type { OperationsMetric } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import './OperationsAtGlance.css';

type Props = {
  metrics: OperationsMetric[];
};

export function OperationsAtGlance({ metrics }: Props) {
  return (
    <Card title="Today's Operations at a Glance">
      {metrics.length === 0 ? (
        <p className="ga-ops-glance__empty">No operational data available.</p>
      ) : (
        <div className="ga-ops-glance__grid">
          {metrics.map((metric) => (
            <Link
              key={metric.id}
              to={metric.href}
              className="ga-ops-glance__card"
            >
              <span className="ga-ops-glance__count">{metric.count}</span>
              <span className="ga-ops-glance__label">{metric.label}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function OperationsAtGlanceSkeleton() {
  return (
    <Card title="Today's Operations at a Glance">
      <div className="ga-ops-glance__grid" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="ga-ops-glance__card ga-ops-glance__card--skeleton">
            <div className="ga-skeleton ga-skeleton--line ga-skeleton--count" />
            <div className="ga-skeleton ga-skeleton--line ga-skeleton--label" />
          </div>
        ))}
      </div>
    </Card>
  );
}
