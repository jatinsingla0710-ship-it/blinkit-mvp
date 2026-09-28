import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BackIcon } from './icons';

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Parent screen. A fixed path keeps Back working after a deep link or reload. */
  backTo?: string;
  /** Name of the parent screen, e.g. "Customers". */
  backLabel?: string;
  actions?: ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Home',
  actions,
}: Props) {
  return (
    <header className="ga-sales-screen-header">
      {backTo ? (
        <Link
          to={backTo}
          className="ga-sales-back"
          aria-label={`Back to ${backLabel}`}
        >
          <BackIcon size={22} />
          <span>{backLabel}</span>
        </Link>
      ) : null}
      <div className="ga-sales-screen-header__row">
        <div className="ga-sales-screen-header__text">
          <h1 className="ga-sales-screen-header__title">{title}</h1>
          {subtitle ? (
            <p className="ga-sales-screen-header__subtitle">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="ga-sales-screen-header__actions">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
