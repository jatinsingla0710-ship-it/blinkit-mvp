import type { ReactNode } from 'react';
import './FilterBar.css';

type FilterBarProps = {
  children: ReactNode;
  className?: string;
  /** CSS grid columns template. Default: search + filter + sort layout. */
  columns?: string;
};

export function FilterBar({
  children,
  className,
  columns = 'minmax(0, 1.4fr) minmax(140px, 0.6fr) minmax(0, 1.2fr)',
}: FilterBarProps) {
  return (
    <div
      className={['ga-filter-bar', className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}

export type ChipOption<T extends string> = {
  id: T;
  label: string;
};

type ChipGroupProps<T extends string> = {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (id: T) => void;
};

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChipGroupProps<T>) {
  return (
    <div className="ga-chip-group">
      <span className="ga-chip-group__label">{label}</span>
      <div className="ga-chip-group__options">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={[
                'ga-chip',
                active ? 'ga-chip--active' : '',
              ].join(' ')}
              onClick={() => onChange(opt.id)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
