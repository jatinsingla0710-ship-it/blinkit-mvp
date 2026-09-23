import type { ReactNode } from 'react';
import './PageHeader.css';

type Props = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  /** Compact trailing actions (search, buttons). */
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, meta, actions }: Props) {
  return (
    <header className="ga-page-header">
      <div className="ga-page-header__main">
        <h1 className="ga-page-header__title">{title}</h1>
        {subtitle ? (
          <p className="ga-page-header__subtitle">{subtitle}</p>
        ) : null}
        {meta ? <div className="ga-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="ga-page-header__actions">{actions}</div> : null}
    </header>
  );
}
