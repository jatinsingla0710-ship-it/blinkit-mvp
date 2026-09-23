import { ActionBar, Button } from '@groaurum/ui';

export type DeliveryQuickActionId =
  | 'create_route'
  | 'schedule_assign'
  | 'assign_driver'
  | 'assign_orders'
  | 'start_route'
  | 'close_route';

type Props = {
  onAction?: (id: DeliveryQuickActionId) => void;
  /** When false, mutation actions are hidden (delivery:manage). */
  canManage?: boolean;
  /** List: create only. Detail: driver / orders / start / close. */
  surface?: 'list' | 'detail';
  allowStartRoute?: boolean;
  allowCloseRoute?: boolean;
  startPending?: boolean;
  closePending?: boolean;
};

/**
 * Honest quick actions — no Export Manifest / no-op buttons.
 * Close and assign driver/orders are detail-only (selected routeId).
 */
export function DeliveryQuickActions({
  onAction,
  canManage = false,
  surface = 'list',
  allowStartRoute = false,
  allowCloseRoute = false,
  startPending = false,
  closePending = false,
}: Props) {
  if (!canManage) return null;

  if (surface === 'list') {
    return (
      <ActionBar>
        <Button
          variant="primary"
          onClick={() => onAction?.('schedule_assign')}
        >
          Create Delivery Trip
        </Button>
        <Button variant="secondary" onClick={() => onAction?.('create_route')}>
          New empty trip shell
        </Button>
      </ActionBar>
    );
  }

  return (
    <ActionBar>
      <Button variant="secondary" onClick={() => onAction?.('assign_driver')}>
        Assign Driver
      </Button>
      <Button variant="secondary" onClick={() => onAction?.('assign_orders')}>
        Assign Orders
      </Button>
      {allowStartRoute ? (
        <Button
          variant="secondary"
          disabled={startPending}
          onClick={() => onAction?.('start_route')}
        >
          {startPending ? 'Starting…' : 'Start Route'}
        </Button>
      ) : null}
      {allowCloseRoute ? (
        <Button
          variant="secondary"
          disabled={closePending}
          onClick={() => onAction?.('close_route')}
        >
          {closePending ? 'Closing…' : 'Close Route'}
        </Button>
      ) : null}
    </ActionBar>
  );
}
