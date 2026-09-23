import { Link } from 'react-router-dom';
import type { DashboardQuickAction } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import './QuickActions.css';

type Props = {
  actions: DashboardQuickAction[];
};

export function QuickActions({ actions }: Props) {
  return (
    <Card title="Quick Actions">
      <div className="ga-quick-grid">
        {actions.map((action) => {
          if (action.comingSoon || !action.href) {
            return (
              <span
                key={action.id}
                className="ga-quick-action ga-quick-action--disabled"
                title="Coming Soon"
              >
                <span className="ga-quick-action__label">{action.label}</span>
                <span className="ga-quick-action__desc">{action.description}</span>
                <span className="ga-quick-action__soon">Coming Soon</span>
              </span>
            );
          }

          return (
            <Link
              key={action.id}
              to={action.href}
              className="ga-quick-action"
            >
              <span className="ga-quick-action__label">{action.label}</span>
              <span className="ga-quick-action__desc">{action.description}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
