import type { OrderDetail } from '@/data/orders-types';
import {
  DeliveryStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/OrderStatusBadges';
import './OrderOverviewTab.css';

type Props = {
  order: OrderDetail;
};

export function OrderOverviewTab({ order }: Props) {
  return (
    <div className="ga-ord-overview">
      <section className="ga-ord-overview__section">
        <h3 className="ga-ord-overview__heading">Customer Information</h3>
        <dl className="ga-ord-overview__grid">
          <div>
            <dt>Customer Name</dt>
            <dd>{order.customerName}</dd>
          </div>
          <div>
            <dt>Shop Name</dt>
            <dd>{order.shopName ?? order.customerName}</dd>
          </div>
          <div>
            <dt>Mobile Number</dt>
            <dd>{order.customerMobile ?? '—'}</dd>
          </div>
          <div className="ga-ord-overview__span">
            <dt>Delivery Address</dt>
            <dd>{order.deliveryAddress ?? order.delivery.addressText}</dd>
          </div>
        </dl>
      </section>

      <section className="ga-ord-overview__section">
        <h3 className="ga-ord-overview__heading">Order Information</h3>
        <dl className="ga-ord-overview__grid">
          <div>
            <dt>Order Number</dt>
            <dd className="ga-ord-overview__mono">{order.orderCode}</dd>
          </div>
          <div>
            <dt>Order Date</dt>
            <dd>{order.placedDateLabel ?? order.placedAtLabel}</dd>
          </div>
          <div>
            <dt>Order Time</dt>
            <dd>{order.placedTimeLabel ?? '—'}</dd>
          </div>
          <div>
            <dt>Salesman</dt>
            <dd>{order.salesmanName}</dd>
          </div>
          <div>
            <dt>Payment Method</dt>
            <dd>{order.payment.methodLabel}</dd>
          </div>
          <div>
            <dt>Payment Status</dt>
            <dd>
              <PaymentStatusBadge status={order.paymentStatus} />
            </dd>
          </div>
          <div>
            <dt>Order Status</dt>
            <dd>
              <FulfillmentStatusBadge status={order.fulfillmentStatus} />
            </dd>
          </div>
          <div>
            <dt>Delivery Status</dt>
            <dd>
              <DeliveryStatusBadge status={order.deliveryStatus} />
            </dd>
          </div>
          <div>
            <dt>Service Area</dt>
            <dd>{order.serviceAreaName ?? order.warehouseName}</dd>
          </div>
          <div>
            <dt>Sale Invoice</dt>
            <dd>
              {order.sale
                ? `${order.sale.invoiceNumber} · ${order.sale.convertedAtLabel}`
                : 'Not converted'}
            </dd>
          </div>
          <div>
            <dt>Order Value</dt>
            <dd>{order.orderValueLabel}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
