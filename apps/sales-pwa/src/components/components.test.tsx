import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { isButtonDisabled, linkHref } from '@/test-utils/markup';
import { ButtonLink } from './ButtonLink';
import { EmptyStateCard } from './EmptyStateCard';
import { ErrorState } from './ErrorState';
import { ScreenHeader } from './ScreenHeader';
import { LoadingState } from './Skeleton';
import { ToastViewport } from './Toast';
import {
  MAX_VISIBLE_TOASTS,
  pushToast,
  removeToast,
  toastDurationMs,
  type ToastItem,
} from './toast-state';

function render(element: ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}

describe('ScreenHeader', () => {
  it('renders a labelled back link to the parent screen', () => {
    const html = render(
      <ScreenHeader title="Sharma Stores" backTo="/customers" backLabel="Customers" />,
    );
    expect(linkHref(html, 'Back to Customers')).toBe('/customers');
    expect(html).toContain('<h1 class="ga-sales-screen-header__title">Sharma Stores</h1>');
  });

  it('has no back link on tab root screens', () => {
    const html = render(<ScreenHeader title="Customers" />);
    expect(html).not.toContain('ga-sales-back');
  });
});

describe('ErrorState', () => {
  it('is an alert with an enabled Retry', () => {
    const html = render(<ErrorState message="Network down" onRetry={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Network down');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
  });

  it('disables Retry while retrying', () => {
    const html = render(
      <ErrorState message="Network down" onRetry={() => undefined} retrying />,
    );
    expect(isButtonDisabled(html, 'Retrying…')).toBe(true);
  });

  it('marks refresh failures over existing data as stale, not blocking', () => {
    const html = render(
      <ErrorState message="Timeout" onRetry={() => undefined} stale />,
    );
    expect(html).toContain('ga-sales-error-state--stale');
    expect(html).toContain('showing the last loaded data');
  });
});

describe('LoadingState', () => {
  it('announces loading to screen readers and hides skeleton shapes', () => {
    const html = render(<LoadingState label="Loading retailers…" rows={2} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading retailers…');
    expect(html.match(/ga-sales-skeleton/g)?.length).toBe(4);
  });
});

describe('EmptyStateCard', () => {
  it('offers a next step', () => {
    const html = render(
      <EmptyStateCard
        title="No retailers yet"
        action={<ButtonLink to="/customers/new">Add customer</ButtonLink>}
      />,
    );
    expect(html).toContain('No retailers yet');
    expect(linkHref(html, 'Add customer')).toBe('/customers/new');
  });
});

describe('ButtonLink', () => {
  it('is a single link styled as a button (no nested button)', () => {
    const html = render(
      <ButtonLink to="/orders/new" variant="primary">
        New order
      </ButtonLink>,
    );
    expect(html).toContain('ga-btn ga-btn--primary');
    expect(html).not.toContain('<button');
  });
});

describe('toasts', () => {
  const toast = (id: number, tone: ToastItem['tone'] = 'success'): ToastItem => ({
    id,
    tone,
    message: `t${id}`,
  });

  it('keeps only the newest toasts on screen', () => {
    let list: ToastItem[] = [];
    for (let id = 1; id <= MAX_VISIBLE_TOASTS + 2; id++) list = pushToast(list, toast(id));
    expect(list.map((t) => t.id)).toEqual([3, 4, 5]);
    expect(removeToast(list, 4).map((t) => t.id)).toEqual([3, 5]);
  });

  it('keeps errors on screen longer', () => {
    expect(toastDurationMs('error')).toBeGreaterThan(toastDurationMs('success'));
    expect(toastDurationMs('warning')).toBe(toastDurationMs('success'));
  });

  it('renders errors as alerts and others as status, each dismissible', () => {
    const html = renderToStaticMarkup(
      <ToastViewport
        toasts={[toast(1, 'success'), toast(2, 'warning'), toast(3, 'error')]}
        onDismiss={() => undefined}
      />,
    );
    expect(html).toContain('ga-sales-toast--success" role="status"');
    expect(html).toContain('ga-sales-toast--warning" role="status"');
    expect(html).toContain('ga-sales-toast--error" role="alert"');
    expect(html.match(/aria-label="Dismiss notification"/g)?.length).toBe(3);
  });
});
