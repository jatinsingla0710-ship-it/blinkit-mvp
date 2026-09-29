import { ActionBar, Button } from '@groaurum/ui';

export type SalesmenQuickActionId =
  | 'add_customer'
  | 'create_order'
  | 'view_territory'
  | 'provision_salesman';

type Props = {
  onAction?: (id: SalesmenQuickActionId) => void;
  /** customers:manage / salesmen:manage / orders:manage gated by caller. */
  canManageCustomers?: boolean;
  canManageOrders?: boolean;
  canManageSalesmen?: boolean;
};

export function SalesmenQuickActions({
  onAction,
  canManageCustomers = false,
  canManageOrders = false,
  canManageSalesmen = false,
}: Props) {
  return (
    <ActionBar>
      {canManageSalesmen ? (
        <Button
          variant="primary"
          onClick={() => onAction?.('provision_salesman')}
        >
          Provision Salesman
        </Button>
      ) : null}
      {canManageCustomers ? (
        <Button variant="secondary" onClick={() => onAction?.('add_customer')}>
          Add Customer
        </Button>
      ) : null}
      {canManageOrders ? (
        <Button variant="secondary" onClick={() => onAction?.('create_order')}>
          Create Order
        </Button>
      ) : null}
      <Button variant="secondary" onClick={() => onAction?.('view_territory')}>
        View Territory
      </Button>
    </ActionBar>
  );
}
