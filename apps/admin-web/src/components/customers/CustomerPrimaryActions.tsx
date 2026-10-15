import { Button } from '@groaurum/ui';
import './CustomerPrimaryActions.css';

type Props = {
  canManage: boolean;
  outstanding: number;
  hasOpening: boolean;
  onReceivePayment: () => void;
  onAddBillPhoto: () => void;
  onOpeningBalance: () => void;
};

/**
 * Always-visible primary actions for Customer 2.0.
 * Receive Payment + Add Bill Photo stay outside tabs.
 */
export function CustomerPrimaryActions({
  canManage,
  outstanding,
  hasOpening,
  onReceivePayment,
  onAddBillPhoto,
  onOpeningBalance,
}: Props) {
  if (!canManage) return null;

  return (
    <div className="ga-cust-primary-actions" aria-label="Customer actions">
      <Button
        variant="primary"
        type="button"
        className="ga-cust-primary-actions__main"
        onClick={onReceivePayment}
        disabled={outstanding <= 0}
      >
        Receive payment
      </Button>
      <Button
        variant="secondary"
        type="button"
        className="ga-cust-primary-actions__main"
        onClick={onAddBillPhoto}
      >
        Add bill photo
      </Button>
      <Button variant="ghost" type="button" onClick={onOpeningBalance}>
        {hasOpening ? 'Edit opening balance' : 'Set opening balance'}
      </Button>
    </div>
  );
}
