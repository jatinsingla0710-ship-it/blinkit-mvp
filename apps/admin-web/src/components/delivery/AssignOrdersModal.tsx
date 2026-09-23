import { useEffect, useState } from 'react';
import { Modal, Button } from '@groaurum/ui';
import type { DeliveryAssignableOrder } from '@/data/delivery-types';
import { formatMutationError } from '@/data/mutation-errors';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { useAssignOrderToRouteMutation } from '@/data/mutations';
import './AssignDriverModal.css';
import './AssignOrdersModal.css';

type Props = {
  open: boolean;
  routeId: string;
  hasDriver: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function AssignOrdersModal({
  open,
  routeId,
  hasDriver,
  onClose,
  onSuccess,
}: Props) {
  const assign = useAssignOrderToRouteMutation();
  const [orders, setOrders] = useState<DeliveryAssignableOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!open) return;
    setActionError(null);
    setSelectedId('');
    if (!hasDriver) {
      setOrders([]);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void requireLiveAdminApi()
      .listAssignableOrdersForRoute(routeId)
      .then((rows) => {
        if (cancelled) return;
        setOrders(rows);
        setSelectedId(rows[0]?.id ?? '');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          formatMutationError(err, 'Could not load assignable orders'),
        );
        setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, routeId, hasDriver]);

  const pending = assign.isPending;

  const onSubmit = () => {
    if (!selectedId) {
      setActionError('Select an order');
      return;
    }
    setActionError(null);
    assign.mutate(
      { orderId: selectedId, routeId },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
        onError: (err) =>
          setActionError(
            formatMutationError(err, 'Could not assign order to route'),
          ),
      },
    );
  };

  return (
    <Modal
      open={open}
      title="Assign Orders"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={pending || !hasDriver || !selectedId || loading}
          >
            {pending ? 'Assigning…' : 'Assign to Route'}
          </Button>
        </>
      }
    >
      <div className="ga-dl-assign">
        {!hasDriver ? (
          <p className="ga-dl-assign__error">
            Assign a driver to this route before adding orders.
          </p>
        ) : null}
        {loading ? <p className="ga-dl-assign-orders__hint">Loading orders…</p> : null}
        {loadError ? <p className="ga-dl-assign__error">{loadError}</p> : null}
        {!loading && !loadError && hasDriver && orders.length === 0 ? (
          <p className="ga-dl-assign-orders__hint">
            No Ready for Dispatch orders in this service area are available to
            assign.
          </p>
        ) : null}
        {!loading && orders.length > 0 ? (
          <ul className="ga-dl-assign-orders__list">
            {orders.map((order) => (
              <li key={order.id}>
                <label className="ga-dl-assign-orders__row">
                  <input
                    type="radio"
                    name="assign-order"
                    value={order.id}
                    checked={selectedId === order.id}
                    onChange={() => setSelectedId(order.id)}
                  />
                  <span>
                    <strong className="ga-table__mono">{order.orderCode}</strong>
                    {' · '}
                    {order.customerName}
                    {' · '}
                    {order.amountLabel}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        {actionError ? <p className="ga-dl-assign__error">{actionError}</p> : null}
      </div>
    </Modal>
  );
}
