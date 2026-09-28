import { Button } from '@groaurum/ui';

type Props = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  /**
   * Earlier data is still on screen, so this is a refresh failure (amber),
   * not a blocking error (red).
   */
  stale?: boolean;
};

export function ErrorState({
  message,
  onRetry,
  retrying = false,
  retryLabel = 'Retry',
  stale = false,
}: Props) {
  return (
    <div
      className={`ga-sales-error-state${stale ? ' ga-sales-error-state--stale' : ''}`}
      role="alert"
    >
      <p className="ga-sales-error-state__message">
        {stale ? `Couldn't refresh — showing the last loaded data. ${message}` : message}
      </p>
      {onRetry ? (
        <div className="ga-sales-actions">
          <Button
            variant="secondary"
            type="button"
            disabled={retrying}
            onClick={onRetry}
          >
            {retrying ? 'Retrying…' : retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
