import type { ReactNode } from 'react';
import './Tabs.css';

export type TabItem<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  trailing?: ReactNode;
};

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  trailing,
}: Props<T>) {
  return (
    <div className="ga-tabs">
      <div className="ga-tabs__list" role="tablist">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={[
                'ga-tabs__tab',
                selected ? 'ga-tabs__tab--active' : '',
              ].join(' ')}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="ga-tabs__trailing">{trailing}</div> : null}
    </div>
  );
}
