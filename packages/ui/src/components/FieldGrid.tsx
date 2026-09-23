import type { ReactNode } from 'react';
import './FieldGrid.css';

type FieldGridProps = {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
};

export function FieldGrid({
  children,
  columns = 4,
  className,
}: FieldGridProps) {
  return (
    <dl
      className={[
        'ga-field-grid',
        `ga-field-grid--cols-${columns}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </dl>
  );
}

type FieldProps = {
  label: string;
  children: ReactNode;
  wide?: boolean;
};

export function Field({ label, children, wide }: FieldProps) {
  return (
    <div className={wide ? 'ga-field-grid__wide' : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
