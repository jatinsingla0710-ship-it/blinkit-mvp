import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@groaurum/ui';
import { OrderInvoicePrint } from '@/components/orders/OrderInvoicePrint';
import {
  DeliveryStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/OrderStatusBadges';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useOrderDetailQuery } from '@/data/hooks';
import { useAdminDataClient } from '@/data/AdminDataProviders';
import './SaleDetailPage.css';

/**
 * Sale bill detail — owned by Sales module.
 * Accepts /sales/:saleId where saleId is sale UUID or legacy order UUID.
 */
export function SaleDetailPage() {
  const { saleId: saleOrOrderId } = useParams<{ saleId: string }>();
  const [searchParams] = useSearchParams();
  const [openPreview, setOpenPreview] = useState(
    () => searchParams.get('preview') === '1',
  );
  const [orderId, setOrderId] = useState<string | undefined>(saleOrOrderId);
  const [resolving, setResolving] = useState(true);
  const client = useAdminDataClient();
  const { state } = useOrderDetailQuery(orderId);

  useEffect(() => {
    if (searchParams.get('preview') === '1') setOpenPreview(true);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!saleOrOrderId) {
        setResolving(false);
        return;
      }
      setResolving(true);
      if (!client.liveApi) {
        setOrderId(saleOrOrderId);
        setResolving(false);
        return;
      }
      try {
        const resolved = await client.liveApi.resolveSaleToOrderId(saleOrOrderId);
        if (!cancelled) setOrderId(resolved);
      } catch {
        if (!cancelled) setOrderId(saleOrOrderId);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [saleOrOrderId, client.liveApi]);

  if (resolving) {
    return (
      <div className="ga-sale-detail">
        <p>Loading sale…</p>
      </div>
    );
  }

  return (
    <QueryStateGate title="Sale bill" state={state}>
      {(order) => {
        const hasSale = Boolean(order.sale?.id);
        const invoiceLabel =
          order.sale?.invoiceNumber ?? order.invoiceNumber ?? order.orderCode;
        return (
          <div className="ga-sale-detail">
            <PageHeader
              title={hasSale ? `Sale · ${invoiceLabel}` : `Sale · ${order.orderCode}`}
              subtitle={
                hasSale
                  ? `${order.customerName} · Converted sale bill`
                  : 'This order is not converted to a sale yet'
              }
              meta={
                <span className="ga-sale-detail__meta">
                  <Link to="/sales">← Sales</Link>
                  {' · '}
                  <Link to={`/orders/${order.id}`}>View Order</Link>
                </span>
              }
            />

            {!hasSale ? (
              <Card title="Not a sale">
                <p>
                  This order has not been converted to a sale. Open the order to
                  complete delivery and payment, then convert.
                </p>
                <Link to={`/orders/${order.id}`}>
                  <Button variant="primary">Open Order</Button>
                </Link>
              </Card>
            ) : (
              <>
                <Card title="Sale summary">
                  <dl className="ga-sale-detail__dl">
                    <div>
                      <dt>Invoice</dt>
                      <dd>{invoiceLabel}</dd>
                    </div>
                    <div>
                      <dt>Order</dt>
                      <dd>
                        <Link to={`/orders/${order.id}`}>{order.orderCode}</Link>
                      </dd>
                    </div>
                    <div>
                      <dt>Customer</dt>
                      <dd>{order.customerName}</dd>
                    </div>
                    <div>
                      <dt>Converted</dt>
                      <dd>{order.sale?.convertedAtLabel ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Payment</dt>
                      <dd>
                        <PaymentStatusBadge
                          status={order.sale?.paymentStatus ?? order.paymentStatus}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Delivery</dt>
                      <dd>
                        <DeliveryStatusBadge status={order.deliveryStatus} />
                      </dd>
                    </div>
                  </dl>
                </Card>
                <OrderInvoicePrint
                  order={order}
                  autoOpenPreview={openPreview}
                  onPreviewHandled={() => setOpenPreview(false)}
                />
              </>
            )}
          </div>
        );
      }}
    </QueryStateGate>
  );
}
