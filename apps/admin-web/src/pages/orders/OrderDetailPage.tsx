import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import { OrderActionPanel } from '@/components/orders/OrderActionPanel';
import { OrderActivityLog } from '@/components/orders/OrderActivityLog';
import { OrderDeliveryAssign } from '@/components/orders/OrderDeliveryAssign';
import { OrderDeliverySetupBanner } from '@/components/orders/OrderDeliverySetupBanner';
import { ScheduleAssignModal } from '@/components/delivery/ScheduleAssignModal';
import { OrderDeliveryTab } from '@/components/orders/OrderDeliveryTab';
import { OrderInvoicePrint } from '@/components/orders/OrderInvoicePrint';
import { OrderItemsTab } from '@/components/orders/OrderItemsTab';
import { OrderOverviewTab } from '@/components/orders/OrderOverviewTab';
import { OrderPaymentTab } from '@/components/orders/OrderPaymentTab';
import {
  DeliveryStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/OrderStatusBadges';
import { OrderTimelineTab } from '@/components/orders/OrderTimelineTab';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useOrderDetailQuery } from '@/data/hooks';
import {
  useDeliveryBoysSnapshotQuery,
  useReadyForDeliveryOrdersQuery,
  useVehiclesListQuery,
} from '@/data/hooks';
import {
  buildDeliverySetupGuidance,
  formatPackAssignSuccess,
  type DeliverySetupGuidance,
  type PackAutoAssignResult,
} from '@/data/delivery-setup-helpers';
import {
  canCancelOrder,
  canEditOrderLines,
  canRefundConvertedSale,
} from '@/data/order-helpers';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useCancelOrderMutation,
  useConfirmOrderMutation,
  useConvertOrderToSaleMutation,
  useMarkOrderPackedMutation,
  useMarkOrderPaymentReceivedMutation,
  useProcessOrderMutation,
} from '@/data/mutations';
import { useEffect, useState } from 'react';
import './OrderDetailPage.css';

type OrderTab =
  | 'overview'
  | 'items'
  | 'timeline'
  | 'payment'
  | 'delivery'
  | 'invoice'
  | 'activity';

const TABS: TabItem<OrderTab>[] = [
  { id: 'overview', label: 'Order Summary' },
  { id: 'items', label: 'Products' },
  { id: 'payment', label: 'Payment' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'activity', label: 'Activity' },
];

function parseTab(value: string | null): OrderTab | undefined {
  if (
    value === 'overview' ||
    value === 'items' ||
    value === 'timeline' ||
    value === 'payment' ||
    value === 'delivery' ||
    value === 'invoice' ||
    value === 'activity'
  ) {
    return value;
  }
  return undefined;
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<OrderTab>(
    () => parseTab(searchParams.get('tab')) ?? 'overview',
  );
  const [openInvoicePreview, setOpenInvoicePreview] = useState(
    () => searchParams.get('preview') === '1',
  );
  const { state } = useOrderDetailQuery(orderId);
  const confirmOrder = useConfirmOrderMutation();
  const processOrder = useProcessOrderMutation();
  const markPacked = useMarkOrderPackedMutation();
  const markPaymentReceived = useMarkOrderPaymentReceivedMutation();
  const convertToSale = useConvertOrderToSaleMutation();
  const cancelOrder = useCancelOrderMutation();
  const { hasPermission } = usePermissions();
  // UI gate only — live RPCs still require profile is_admin() (see permissions.ts).
  const canManageOrders = hasPermission('orders:manage');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelOk, setCancelOk] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [setupGuidance, setSetupGuidance] =
    useState<DeliverySetupGuidance | null>(null);
  const [scheduleTripOpen, setScheduleTripOpen] = useState(false);
  const boysSnap = useDeliveryBoysSnapshotQuery();
  const vehiclesList = useVehiclesListQuery();
  const readyQueue = useReadyForDeliveryOrdersQuery();
  const [showChangeAssign, setShowChangeAssign] = useState(false);

  useEffect(() => {
    const next = parseTab(searchParams.get('tab'));
    if (next) setTab(next);
    if (
      searchParams.get('preview') === '1' &&
      (next === 'invoice' || searchParams.get('tab') === 'invoice')
    ) {
      setTab('invoice');
      setOpenInvoicePreview(true);
    }
  }, [searchParams]);

  const pending =
    confirmOrder.isPending ||
    processOrder.isPending ||
    markPacked.isPending ||
    markPaymentReceived.isPending ||
    convertToSale.isPending ||
    cancelOrder.isPending;

  const pendingLabel = markPacked.isPending
    ? 'Marking packed…'
    : processOrder.isPending
      ? 'Processing…'
      : confirmOrder.isPending
        ? 'Approving…'
        : markPaymentReceived.isPending
          ? 'Recording payment…'
          : convertToSale.isPending
            ? 'Converting…'
            : cancelOrder.isPending
              ? 'Cancelling…'
              : null;

  const errorMessage =
    cancelError ||
    (confirmOrder.error as Error | null)?.message ||
    (processOrder.error as Error | null)?.message ||
    (markPacked.error as Error | null)?.message ||
    (markPaymentReceived.error as Error | null)?.message ||
    (convertToSale.error as Error | null)?.message ||
    null;

  return (
    <QueryStateGate
      title="Order"
      state={state}
      emptyTitle="Order not found"
      emptyDetail="Return to Orders and select an operations row."
    >
      {(order) => {
        const assigned =
          order.fulfillmentStatus === 'ASSIGNED_TO_ROUTE' ||
          order.fulfillmentStatus === 'OUT_FOR_DELIVERY' ||
          order.fulfillmentStatus === 'DELIVERED';
        const showCancel =
          canManageOrders &&
          canCancelOrder({
            dbStatus: order.dbStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            saleId: order.sale?.id,
          });
        const editableLines =
          canManageOrders &&
          canEditOrderLines(order.dbStatus, order.sale?.id);
        const showAssignForm =
          canManageOrders &&
          (showChangeAssign ||
            order.fulfillmentStatus === 'READY_FOR_DISPATCH' ||
            order.fulfillmentStatus === 'PACKING' ||
            (order.fulfillmentStatus === 'ASSIGNED_TO_ROUTE' &&
              showChangeAssign));

        return (
          <div className="ga-ord-detail">
            <PageHeader
              title={order.orderCode}
              subtitle={`${order.shopName ?? order.customerName} · ${order.salesmanName}`}
              meta={
                <span className="ga-ord-detail__meta">
                  <FulfillmentStatusBadge status={order.fulfillmentStatus} />
                  <PaymentStatusBadge status={order.paymentStatus} />
                  <DeliveryStatusBadge status={order.deliveryStatus} />
                  {order.sale ? (
                    <span className="ga-ord-detail__sale">
                      Sale {order.sale.invoiceNumber}
                    </span>
                  ) : null}
                  {order.invoiceNumber && !order.sale ? (
                    <span className="ga-ord-detail__sale">
                      Inv {order.invoiceNumber}
                    </span>
                  ) : null}
                  <span>Updated {order.updatedAtLabel}</span>
                </span>
              }
            />

            <div className="ga-ord-detail__toolbar">
              <Link to="/orders" className="ga-ord-detail__back">
                ← Orders
              </Link>
              {order.sale?.id ? (
                <Link
                  to={`/sales/${order.id}`}
                  className="ga-ord-detail__back"
                >
                  View Sale
                </Link>
              ) : null}
              {showCancel ? (
                <div className="ga-ord-detail__actions">
                  <Button
                    variant="secondary"
                    disabled={cancelOrder.isPending}
                    onClick={() => {
                      if (!orderId) return;
                      const ok = window.confirm(
                        'Cancel this order? Open reservations will be released and open delivery stops marked failed. Payments are not refunded.',
                      );
                      if (!ok) return;
                      setCancelError(null);
                      setCancelOk(null);
                      cancelOrder.mutate(
                        { orderId },
                        {
                          onSuccess: (summary) => {
                            setCancelOk(
                              summary.alreadyCancelled
                                ? 'Order was already cancelled.'
                                : `Order cancelled · ${summary.reservationsReleased} reservation(s) released · ${summary.stopsFailed} stop(s) failed`,
                            );
                          },
                          onError: (err) => {
                            setCancelError(
                              formatMutationError(err, 'Could not cancel order'),
                            );
                          },
                        },
                      );
                    }}
                  >
                    {cancelOrder.isPending ? 'Cancelling…' : 'Cancel Order'}
                  </Button>
                </div>
              ) : null}
            </div>

            {cancelOk && !cancelError ? (
              <p className="ga-ord-detail__ok">{cancelOk}</p>
            ) : null}

            {order.needsAttention ? (
              <div className="ga-ord-detail__attention" role="status">
                <strong>Needs attention</strong>
                <span>
                  {order.attentionReason ??
                    'Review exceptions, assignment, or sale conversion.'}
                </span>
                {order.fulfillmentStatus === 'READY_FOR_DISPATCH' &&
                !order.delivery.deliveryPersonId ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setTab('delivery');
                      setShowChangeAssign(true);
                    }}
                  >
                    Assign Delivery
                  </Button>
                ) : null}
              </div>
            ) : null}

            {setupGuidance ? (
              <OrderDeliverySetupBanner
                guidance={setupGuidance}
                onAssignTrip={() => setScheduleTripOpen(true)}
              />
            ) : null}

            <OrderActionPanel
              order={order}
              canManage={canManageOrders}
              handlers={{
                pending,
                pendingLabel,
                errorMessage,
                statusMessage: workflowStatus,
                onConfirmOrder: () => {
                  if (!orderId || !canManageOrders || confirmOrder.isPending) return;
                  setWorkflowStatus(null);
                  confirmOrder.mutate({ orderId });
                },
                onProcessOrder: () => {
                  if (!orderId || !canManageOrders || processOrder.isPending) return;
                  setWorkflowStatus(null);
                  processOrder.mutate(
                    {
                      orderId,
                      hasInvoice: Boolean(order.invoiceNumber),
                      invoicePrinted: Boolean(order.invoicePrinted),
                      dbStatus: order.dbStatus ?? '',
                    },
                    {
                      onSuccess: () => {
                        setWorkflowStatus(
                          'Order processed · invoice ready · packing started',
                        );
                      },
                    },
                  );
                },
                onPackOrder: () => {
                  if (!orderId || !canManageOrders || markPacked.isPending) return;
                  setWorkflowStatus(null);
                  setSetupGuidance(null);
                  markPacked.mutate(
                    { orderId },
                    {
                      onSuccess: (result) => {
                        const a = result.autoAssign as PackAutoAssignResult;
                        const counts = {
                          activeDrivers:
                            boysSnap.state.data?.rows.filter(
                              (b) => b.employmentStatus === 'ACTIVE',
                            ).length ?? 0,
                          availableDrivers:
                            boysSnap.state.data?.rows.filter(
                              (b) =>
                                b.employmentStatus === 'ACTIVE' &&
                                b.operationalStatus === 'AVAILABLE',
                            ).length ?? 0,
                          activeVehicles:
                            vehiclesList.state.data?.filter((v) => v.isActive)
                              .length ?? 0,
                          availableVehicles:
                            vehiclesList.state.data?.filter(
                              (v) =>
                                v.isActive &&
                                (v.status === 'available' ||
                                  v.status === 'assigned'),
                            ).length ?? 0,
                        };
                        if (a.assigned) {
                          setWorkflowStatus(formatPackAssignSuccess(a));
                          setSetupGuidance(null);
                        } else {
                          setWorkflowStatus(null);
                          setSetupGuidance(
                            buildDeliverySetupGuidance(a, counts),
                          );
                          setTab('delivery');
                          setShowChangeAssign(true);
                        }
                      },
                    },
                  );
                },
                onAssignDelivery: () => {
                  setTab('delivery');
                  setShowChangeAssign(true);
                },
                onReceivePayment: () => {
                  if (!orderId || !canManageOrders) return;
                  setTab('payment');
                  markPaymentReceived.mutate({ orderId });
                },
                onConvertToSale: () => {
                  if (!orderId || !canManageOrders) return;
                  convertToSale.mutate(
                    { orderId },
                    {
                      onSuccess: () => {
                        navigate(`/sales/${orderId}`);
                      },
                    },
                  );
                },
              }}
            />

            <Card className="ga-ord-detail__main">
              <Tabs items={TABS} active={tab} onChange={setTab} />
              <div className="ga-ord-detail__panel">
                {tab === 'overview' ? <OrderOverviewTab order={order} /> : null}
                {tab === 'items' ? (
                  <OrderItemsTab
                    orderId={order.id}
                    lines={order.lines}
                    payment={order.payment}
                    canEdit={editableLines}
                  />
                ) : null}
                {tab === 'timeline' ? (
                  <OrderTimelineTab
                    stages={order.timeline}
                    events={order.workflowEvents ?? order.activity}
                  />
                ) : null}
                {tab === 'payment' ? (
                  <OrderPaymentTab
                    orderId={order.id}
                    payment={order.payment}
                    canReceivePayment={
                      canManageOrders &&
                      order.paymentStatus !== 'PAID' &&
                      order.paymentStatus !== 'REFUNDED' &&
                      (order.fulfillmentStatus === 'DELIVERED' ||
                        order.fulfillmentStatus === 'OUT_FOR_DELIVERY' ||
                        order.fulfillmentStatus === 'ASSIGNED_TO_ROUTE')
                    }
                    canRefund={
                      canManageOrders &&
                      canRefundConvertedSale({
                        fulfillmentStatus: order.fulfillmentStatus,
                        paymentStatus: order.paymentStatus,
                        saleId: order.sale?.id,
                      })
                    }
                  />
                ) : null}
                {tab === 'delivery' ? (
                  <div className="ga-ord-detail__delivery">
                    {order.delivery.deliveryPersonId ? (
                      <div className="ga-ord-detail__assign-summary">
                        <div>
                          <p>
                            <strong>Driver</strong>{' '}
                            {order.delivery.deliveryPersonName ?? '—'}
                          </p>
                          <p>
                            <strong>Vehicle</strong>{' '}
                            {order.delivery.vehicleLabel ?? '—'}
                          </p>
                          <p>
                            <strong>Route / slot</strong>{' '}
                            {order.delivery.routeLabel ?? '—'} ·{' '}
                            {order.delivery.timeSlotLabel ??
                              order.delivery.windowLabel ??
                              '—'}
                          </p>
                        </div>
                        {canManageOrders &&
                        (order.fulfillmentStatus === 'READY_FOR_DISPATCH' ||
                          order.fulfillmentStatus === 'ASSIGNED_TO_ROUTE') ? (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setShowChangeAssign((v) => !v)
                            }
                          >
                            {showChangeAssign ? 'Hide' : 'Change'}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {showAssignForm ? (
                      <OrderDeliveryAssign
                        order={order}
                        canManage={canManageOrders}
                      />
                    ) : null}
                    {assigned ? (
                      <div className="ga-ord-detail__auto-delivery">
                        <h3>Delivery automation</h3>
                        <p>
                          Out For Delivery and Delivered update automatically
                          when the delivery person starts the route and confirms
                          delivery in the Delivery PWA. No admin action needed.
                        </p>
                      </div>
                    ) : null}
                    <OrderDeliveryTab delivery={order.delivery} />
                  </div>
                ) : null}
                {tab === 'invoice' ? (
                  <OrderInvoicePrint
                    order={order}
                    autoOpenPreview={openInvoicePreview}
                    onPreviewHandled={() => setOpenInvoicePreview(false)}
                  />
                ) : null}
                {tab === 'activity' ? (
                  <OrderActivityLog rows={order.activity} />
                ) : null}
              </div>
            </Card>

            {canManageOrders ? (
              <ScheduleAssignModal
                open={scheduleTripOpen}
                onClose={() => setScheduleTripOpen(false)}
                orders={
                  readyQueue.data?.length
                    ? readyQueue.data
                    : [
                        {
                          id: order.id,
                          orderCode: order.orderCode,
                          customerName: order.customerName,
                          serviceAreaId: order.delivery.serviceAreaId ?? '',
                          serviceAreaLabel:
                            order.serviceAreaName ??
                            order.delivery.serviceAreaName ??
                            '—',
                          amountLabel: order.orderValueLabel,
                          statusLabel: order.fulfillmentStatus,
                          packedAtLabel: order.updatedAtLabel,
                        },
                      ]
                }
                preselectedOrderIds={[order.id]}
                onSuccess={() => {
                  setSetupGuidance(null);
                  setWorkflowStatus('Order assigned for delivery');
                  setScheduleTripOpen(false);
                }}
              />
            ) : null}
          </div>
        );
      }}
    </QueryStateGate>
  );
}
