import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ButtonVariant } from '@groaurum/ui';

type Props = {
  to: string;
  variant?: ButtonVariant;
  block?: boolean;
  children: ReactNode;
};

/** Navigation styled as a button: one focusable element, no <a><button> nesting. */
export function ButtonLink({ to, variant = 'secondary', block, children }: Props) {
  return (
    <Link
      to={to}
      className={['ga-btn', `ga-btn--${variant}`, block ? 'ga-sales-btn-block' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Link>
  );
}
