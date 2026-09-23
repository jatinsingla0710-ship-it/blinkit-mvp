import { ActionBar, Button } from '@groaurum/ui';

export type PricingQuickActionId = 'set_price' | 'update_price' | 'view_history';

type Props = {
  hasCurrentPrice: boolean;
  onAction?: (id: PricingQuickActionId) => void;
};

export function PricingQuickActions({ hasCurrentPrice, onAction }: Props) {
  return (
    <ActionBar>
      <Button
        variant="primary"
        onClick={() =>
          onAction?.(hasCurrentPrice ? 'update_price' : 'set_price')
        }
      >
        {hasCurrentPrice ? 'Update Price' : 'Set Price'}
      </Button>
      <Button variant="secondary" onClick={() => onAction?.('view_history')}>
        View History
      </Button>
    </ActionBar>
  );
}
