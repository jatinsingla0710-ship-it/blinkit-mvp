import { ActionBar, Button } from '@groaurum/ui';

export type CustomersQuickActionId =
  | 'add_customer'
  | 'reassign_salesman'
  | 'view_orders'
  | 'edit_profile';

type Props = {
  onAction?: (id: CustomersQuickActionId) => void;
  surface?: 'list' | 'detail';
  canCreate?: boolean;
  canManage?: boolean;
};

export function CustomersQuickActions({
  onAction,
  surface = 'detail',
  canCreate = false,
  canManage = false,
}: Props) {
  if (surface === 'list') {
    return (
      <ActionBar>
        {canCreate ? (
          <Button variant="primary" onClick={() => onAction?.('add_customer')}>
            Add Customer
          </Button>
        ) : null}
      </ActionBar>
    );
  }

  return (
    <ActionBar>
      {canManage ? (
        <Button
          variant="secondary"
          onClick={() => onAction?.('edit_profile')}
        >
          Edit profile
        </Button>
      ) : null}
      {canManage ? (
        <Button
          variant="secondary"
          onClick={() => onAction?.('reassign_salesman')}
        >
          Reassign Salesman
        </Button>
      ) : null}
      <Button variant="secondary" onClick={() => onAction?.('view_orders')}>
        View Orders
      </Button>
    </ActionBar>
  );
}
