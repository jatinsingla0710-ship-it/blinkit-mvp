import type { ReactNode } from 'react';
import './Card.css';

type Props = {
  id?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({ id, title, action, children, className }: Props) {
  return (
    <section
      id={id}
      className={['ga-card', className].filter(Boolean).join(' ')}
    >
      {title ? (
        <header className="ga-card__header">
          <h2 className="ga-card__title">{title}</h2>
          {action ? <div className="ga-card__action">{action}</div> : null}
        </header>
      ) : null}
      <div className="ga-card__body">{children}</div>
    </section>
  );
}
