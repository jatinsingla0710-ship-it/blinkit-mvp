import type { OrderDeliverySummary } from '@/data/orders-types';
import { DeliveryStatusBadge } from '@/components/orders/OrderStatusBadges';
import './OrderDeliveryTab.css';

type Props = {
  delivery: OrderDeliverySummary;
};

export function OrderDeliveryTab({ delivery }: Props) {
  return (
    <div className="ga-ord-delivery">
      <dl className="ga-ord-delivery__grid">
        <div>
          <dt>Delivery Address</dt>
          <dd>
            <strong>{delivery.addressLabel}</strong>
            <span>{delivery.addressText}</span>
          </dd>
        </div>
        <div>
          <dt>Service Area</dt>
          <dd>{delivery.serviceAreaName ?? delivery.warehouseName}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <DeliveryStatusBadge status={delivery.deliveryStatus} />
          </dd>
        </div>
        <div>
          <dt>Scheduled date</dt>
          <dd>{delivery.scheduledDate ?? '—'}</dd>
        </div>
        <div>
          <dt>Time slot</dt>
          <dd>{delivery.timeSlotLabel ?? delivery.windowLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>Delivery Person</dt>
          <dd>{delivery.deliveryPersonName ?? '—'}</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>{delivery.vehicleLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{delivery.routeLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{delivery.progressLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>COD / custody</dt>
          <dd>{delivery.codCustodyLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>Customer notification</dt>
          <dd>{delivery.notificationHonesty ?? '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
