import type { ReactNode } from 'react';
import './Timeline.css';

export type TimelineState =
  | 'done'
  | 'current'
  | 'upcoming'
  | 'skipped'
  | 'completed'
  | 'planned'
  | 'missed';

export type TimelineItem = {
  id: string;
  title: string;
  meta?: string;
  note?: string;
  state?: TimelineState;
  trailing?: ReactNode;
};

type Props = {
  items: TimelineItem[];
  empty?: ReactNode;
};

export function Timeline({ items, empty }: Props) {
  if (items.length === 0) {
    return <>{empty ?? null}</>;
  }

  return (
    <ol className="ga-timeline">
      {items.map((item, index) => {
        const state = item.state ?? 'upcoming';
        return (
          <li key={item.id} className="ga-timeline__item">
            <div className="ga-timeline__rail">
              <span
                className={[
                  'ga-timeline__dot',
                  `ga-timeline__dot--${state}`,
                ].join(' ')}
              />
              {index < items.length - 1 ? (
                <span className="ga-timeline__line" />
              ) : null}
            </div>
            <div className="ga-timeline__body">
              <div className="ga-timeline__header">
                <p className="ga-timeline__title">{item.title}</p>
                {item.trailing ? (
                  <div className="ga-timeline__trailing">{item.trailing}</div>
                ) : item.meta ? (
                  <span className="ga-timeline__meta">{item.meta}</span>
                ) : null}
              </div>
              {item.meta && item.trailing ? (
                <p className="ga-timeline__meta-line">{item.meta}</p>
              ) : null}
              {item.note ? (
                <p className="ga-timeline__note">{item.note}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
