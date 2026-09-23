import type { DailyFocusItem } from '@/data/dashboard-types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import './DailyFocusCard.css';

type Props = {
  items: DailyFocusItem[];
};

function priorityTone(priority: DailyFocusItem['priority']) {
  if (priority === 'high') return 'danger' as const;
  if (priority === 'medium') return 'warning' as const;
  return 'neutral' as const;
}

export function DailyFocusCard({ items }: Props) {
  return (
    <Card title="Daily Focus">
      {items.length === 0 ? (
        <EmptyState
          title="No focus items"
          detail="Connect operational alerts for today’s actions."
        />
      ) : (
        <ul className="ga-focus-list">
          {items.map((item) => (
            <li key={item.id} className="ga-focus-item">
              <div className="ga-focus-item__main">
                <p className="ga-focus-item__title">{item.title}</p>
                <p className="ga-focus-item__detail">{item.detail}</p>
              </div>
              <Badge tone={priorityTone(item.priority)}>
                {item.priority}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
