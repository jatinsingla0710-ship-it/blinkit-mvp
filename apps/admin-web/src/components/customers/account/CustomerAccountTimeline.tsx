import { Link } from 'react-router-dom';
import type { CustomerTimelineEvent } from '@/data/customers-types';
import { Card } from '@/components/ui/Card';
import './CustomerAccountSections.css';

type Props = {
  events: CustomerTimelineEvent[];
};

export function CustomerAccountTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <Card title="Customer Activity" className="ga-cust-account-card">
        <p className="ga-cust-account-empty">No activity recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card title="Customer Activity" className="ga-cust-account-card">
      <ol className="ga-cust-account-timeline">
        {events.map((event) => (
          <li key={event.id}>
            <span className="ga-cust-account-timeline__dot" aria-hidden />
            <div>
              {event.href ? (
                <Link to={event.href} className="ga-cust-account-timeline__title">
                  {event.title}
                </Link>
              ) : (
                <p className="ga-cust-account-timeline__title">{event.title}</p>
              )}
              {event.detail ? (
                <p className="ga-cust-account-timeline__detail">{event.detail}</p>
              ) : null}
              <time className="ga-cust-account-timeline__time">{event.atLabel}</time>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
