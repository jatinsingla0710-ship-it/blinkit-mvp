import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Button } from './Button';
import './Modal.css';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Accessible description id */
  describedBy?: string;
};

/**
 * Accessible modal dialog shell.
 * No mutations wired — consumers control open state.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  describedBy,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ga-modal" role="presentation">
      <button
        type="button"
        className="ga-modal__backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="ga-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ga-modal-title"
        aria-describedby={describedBy}
      >
        <header className="ga-modal__header">
          <h2 id="ga-modal-title" className="ga-modal__title">
            {title}
          </h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </header>
        <div className="ga-modal__body">{children}</div>
        {footer ? <footer className="ga-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
