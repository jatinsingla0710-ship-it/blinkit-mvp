import { ActionBar, Button } from '@groaurum/ui';

export type InventoryQuickActionId =
  | 'receive_stock'
  | 'adjust_stock'
  | 'view_ledger';

type Props = {
  onAction?: (id: InventoryQuickActionId) => void;
  /** When false, receive/adjust actions are hidden (inventory:manage). */
  canManage?: boolean;
};

export function InventoryQuickActions({
  onAction,
  canManage = false,
}: Props) {
  return (
    <ActionBar>
      {canManage ? (
        <>
          <Button variant="primary" onClick={() => onAction?.('receive_stock')}>
            Receive via purchase
          </Button>
          <Button variant="secondary" onClick={() => onAction?.('adjust_stock')}>
            Adjust Stock
          </Button>
        </>
      ) : null}
      <Button variant="secondary" onClick={() => onAction?.('view_ledger')}>
        View Ledger
      </Button>
    </ActionBar>
  );
}
