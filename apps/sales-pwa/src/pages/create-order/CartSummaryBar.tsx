import type { ReactNode } from 'react';
import { Button } from '@groaurum/ui';
import type { OrderPreviewState } from '@/data/order-preview';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';

function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

export type CartSummaryStatus =
  | { kind: 'empty' }
  | { kind: 'offline' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string }
  | { kind: 'invalid'; total: number }
  | { kind: 'ready'; total: number };

export function cartSummaryStatus(input: {
  itemCount: number;
  online: boolean;
  preview: OrderPreviewState;
}): CartSummaryStatus {
  if (input.itemCount === 0) return { kind: 'empty' };
  if (!input.online) return { kind: 'offline' };
  const { current } = input.preview;
  if (current) {
    return current.allValid
      ? { kind: 'ready', total: current.total }
      : { kind: 'invalid', total: current.total };
  }
  if (input.preview.isError) {
    return {
      kind: 'error',
      message: errorMessage(input.preview.error, 'Prices could not be loaded.'),
    };
  }
  return { kind: 'pending' };
}

export function CartSummaryBar({
  itemCount,
  status,
  onRetry,
  retrying,
  action,
  note,
}: {
  itemCount: number;
  status: CartSummaryStatus;
  onRetry: () => void;
  retrying: boolean;
  action: ReactNode;
  note?: string | null;
}) {
  let total: ReactNode;
  let detail: ReactNode = null;
  switch (status.kind) {
    case 'empty':
      total = <span className="ga-sales-muted">Add products</span>;
      break;
    case 'offline':
      total = <span className="ga-sales-summary__warn">Offline</span>;
      detail = 'Draft saved on this phone. Prices and submit need internet.';
      break;
    case 'pending':
      total = (
        <span className="ga-sales-muted" aria-busy="true">
          Calculating…
        </span>
      );
      break;
    case 'error':
      total = <span className="ga-sales-summary__error">Total unavailable</span>;
      detail = (
        <span className="ga-sales-summary__retry">
          <span>Couldn’t get prices: {status.message}</span>
          <Button type="button" variant="secondary" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Retrying…' : 'Retry prices'}
          </Button>
        </span>
      );
      break;
    case 'invalid':
      total = <span className="ga-sales-summary__amount">{formatMoney(status.total)}</span>;
      detail = <span className="ga-sales-summary__error">Fix the highlighted items to continue.</span>;
      break;
    case 'ready':
      total = <span className="ga-sales-summary__amount">{formatMoney(status.total)}</span>;
      break;
  }

  return (
    <div className="ga-sales-summary" role="region" aria-label="Cart total">
      <div className="ga-sales-summary__row" aria-live="polite">
        <span className="ga-sales-summary__count">{itemsLabel(itemCount)}</span>
        <span aria-hidden="true">·</span>
        {total}
      </div>
      {detail ? <div className="ga-sales-summary__detail">{detail}</div> : null}
      {note ? <p className="ga-sales-summary__note">{note}</p> : null}
      {action}
    </div>
  );
}
