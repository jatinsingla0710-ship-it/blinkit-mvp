import type { ReactNode } from 'react';
import './ActionBar.css';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Horizontal button row for module quick actions. */
export function ActionBar({ children, className }: Props) {
  return (
    <div className={['ga-action-bar', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
