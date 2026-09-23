import { Link } from 'react-router-dom';
import type { AttentionAlert } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import './AttentionRequired.css';

type Props = {
  alerts: AttentionAlert[];
};

function severityClass(severity: AttentionAlert['severity']): string {
  return `ga-attention__item--${severity}`;
}

export function AttentionRequired({ alerts }: Props) {
  return (
    <Card title="Attention Required">
      {alerts.length === 0 ? (
        <div className="ga-attention__ok">
          <span className="ga-attention__ok-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="ga-attention__ok-title">Everything looks good</p>
            <p className="ga-attention__ok-detail">
              No urgent items need your attention right now.
            </p>
          </div>
        </div>
      ) : (
        <ul className="ga-attention__list">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                to={alert.href}
                className={['ga-attention__item', severityClass(alert.severity)].join(
                  ' ',
                )}
              >
                <span className="ga-attention__count">{alert.count}</span>
                <span className="ga-attention__title">{alert.title}</span>
                <span className="ga-attention__chevron" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AttentionRequiredSkeleton() {
  return (
    <Card title="Attention Required">
      <ul className="ga-attention__list" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i}>
            <div className="ga-attention__item ga-attention__item--skeleton">
              <div className="ga-skeleton ga-skeleton--line ga-skeleton--count-sm" />
              <div className="ga-skeleton ga-skeleton--line ga-skeleton--title" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
