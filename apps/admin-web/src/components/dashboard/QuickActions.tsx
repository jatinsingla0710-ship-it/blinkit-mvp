import { Link } from 'react-router-dom';
import type { DashboardQuickAction } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import './QuickActions.css';

type Props = {
  actions: DashboardQuickAction[];
  onAction?: (action: DashboardQuickAction) => void;
};

export function QuickActions({ actions, onAction }: Props) {
  return (
    <Card title="Quick Actions">
      <div className="ga-quick-grid">
        {actions.map((action) => {
          if (action.comingSoon || !action.href) {
            if (!action.comingSoon && onAction) {
              return (
                <button
                  key={action.id}
                  type="button"
                  className="ga-quick-action"
                  onClick={() => onAction(action)}
                >
                  <span className="ga-quick-action__label">{action.label}</span>
                  <span className="ga-quick-action__desc">{action.description}</span>
                </button>
              );
            }
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
