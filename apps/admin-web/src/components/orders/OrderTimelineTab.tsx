import type { OrderActivityRow, OrderTimelineStage } from '@/data/orders-types';
import { EmptyState } from '@/components/ui/EmptyState';
import './OrderTimelineTab.css';

type Props = {
  stages: OrderTimelineStage[];
  events?: OrderActivityRow[];
};

/**
 * Read-only automatic order timeline — history only, no workflow controls.
 */
export function OrderTimelineTab({ stages, events = [] }: Props) {
  if (stages.length === 0 && events.length === 0) {
    return (
      <EmptyState
        title="No timeline"
        detail="Events appear automatically as the order progresses."
      />
    );
  }

  return (
    <div className="ga-ord-timeline-wrap">
      <p className="ga-ord-timeline__readonly">
        Automatic history — timeline entries are recorded when business actions
        happen. No manual stage clicks.
      </p>
      <ol className="ga-ord-timeline">
        {stages.map((stage, index) => (
          <li key={stage.status} className="ga-ord-timeline__item">
            <div className="ga-ord-timeline__rail">
              <span
                className={[
                  'ga-ord-timeline__dot',
                  stage.state === 'done' ? 'ga-ord-timeline__dot--done' : '',
                  stage.state === 'current'
                    ? 'ga-ord-timeline__dot--current'
                    : '',
                  stage.attention ? 'ga-ord-timeline__dot--attention' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              {index < stages.length - 1 ? (
                <span
                  className={[
                    'ga-ord-timeline__line',
                    stage.state === 'done' ? 'ga-ord-timeline__line--done' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ) : null}
            </div>
            <div className="ga-ord-timeline__body">
              <p
                className={[
                  'ga-ord-timeline__label',
                  stage.state !== 'upcoming'
                    ? 'ga-ord-timeline__label--active'
                    : '',
                  stage.attention ? 'ga-ord-timeline__label--attention' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {stage.state === 'done' ? '✓ ' : ''}
                {stage.label}
              </p>
              {stage.at ? (
                <p className="ga-ord-timeline__at">{stage.at}</p>
              ) : stage.state === 'upcoming' ? (
                <p className="ga-ord-timeline__pending">Pending</p>
              ) : null}
              {stage.actorLabel ? (
                <p className="ga-ord-timeline__actor">By {stage.actorLabel}</p>
              ) : null}
              <p className="ga-ord-timeline__expl">{stage.explanation}</p>
            </div>
          </li>
        ))}
      </ol>

      {events.length > 0 ? (
        <section className="ga-ord-timeline__events">
          <h3 className="ga-ord-timeline__events-title">Workflow Events</h3>
          <ul className="ga-ord-timeline__event-list">
            {[...events].reverse().map((event) => (
              <li key={event.id} className="ga-ord-timeline__event">
                <div className="ga-ord-timeline__event-main">
                  <strong>{event.actionLabel}</strong>
                  <span>{event.atLabel}</span>
                </div>
                <p className="ga-ord-timeline__event-meta">
                  User: {event.actorLabel}
                  {event.detail ? ` · ${event.detail}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
