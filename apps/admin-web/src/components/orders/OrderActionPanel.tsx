import type { OrderDetail } from '@/data/orders-types';

import {

  getNextOrderAction,

  getOrderBusinessStage,

  ORDER_WORKFLOW_STEPS,

  orderWorkflowStepIndex,

  type OrderNextActionId,

} from '@/data/order-helpers';

import { Button } from '@groaurum/ui';

import './OrderActionPanel.css';



export type OrderActionPanelHandlers = {

  onConfirmOrder: () => void;

  onProcessOrder: () => void;

  onPackOrder: () => void;

  onAssignDelivery: () => void;

  onReceivePayment: () => void;

  onConvertToSale: () => void;

  pending?: boolean;

  /** Specific label while the primary workflow action runs. */

  pendingLabel?: string | null;

  errorMessage?: string | null;

  /** Success / info after pack or process. */

  statusMessage?: string | null;

};



type Props = {

  order: OrderDetail;

  handlers: OrderActionPanelHandlers;

  /** When false, mutating workflow actions are hidden (orders:manage). */

  canManage?: boolean;

};



function actionHandler(

  id: OrderNextActionId,

  handlers: OrderActionPanelHandlers,

): (() => void) | undefined {

  switch (id) {

    case 'confirm_order':

      return handlers.onConfirmOrder;

    case 'process_order':

      return handlers.onProcessOrder;

    case 'pack_order':

      return handlers.onPackOrder;

    case 'assign_delivery':
    case 'assignment_pending':
      return handlers.onAssignDelivery;

    case 'receive_payment':

      return handlers.onReceivePayment;

    case 'convert_to_sale':

      return handlers.onConvertToSale;

    default:

      return undefined;

  }

}



/**

 * Single next-action panel — one primary business action at a time.

 */

export function OrderActionPanel({

  order,

  handlers,

  canManage = false,

}: Props) {

  const stage = getOrderBusinessStage({

    dbStatus: order.dbStatus,

    fulfillmentStatus: order.fulfillmentStatus,

    paymentStatus: order.paymentStatus,

    saleId: order.sale?.id,

    invoiceNumber: order.invoiceNumber,

    deliveryPersonName: order.delivery.deliveryPersonName,

    needsAttention: order.needsAttention,

    attentionReason: order.attentionReason,

  });

  const next = getNextOrderAction({

    dbStatus: order.dbStatus,

    fulfillmentStatus: order.fulfillmentStatus,

    paymentStatus: order.paymentStatus,

    invoiceNumber: order.invoiceNumber,

    saleId: order.sale?.id,

    deliveryPersonId: order.delivery.deliveryPersonId,

    deliveryPersonName: order.delivery.deliveryPersonName,

  });

  const stepIndex = orderWorkflowStepIndex(next.id);

  const run = actionHandler(next.id, handlers);

  const pending = Boolean(handlers.pending);

  const showPrimaryAction =

    next.kind === 'action' && Boolean(run) && canManage;

  const workingLabel = handlers.pendingLabel ?? 'Working…';



  const stageClass = [

    'ga-ord-action__stage',

    stage.kind === 'attention' ? 'ga-ord-action__stage--attention' : '',

    stage.kind === 'done' ? 'ga-ord-action__stage--done' : '',

  ]

    .filter(Boolean)

    .join(' ');



  return (

    <section className="ga-ord-action" aria-label="Next action">

      <p className={stageClass} role="status">

        <span className="ga-ord-action__stage-label">{stage.label}</span>

        <span className="ga-ord-action__stage-hint">{stage.hint}</span>

      </p>



      {order.delivery.deliveryPersonName &&

      (order.fulfillmentStatus === 'ASSIGNED_TO_ROUTE' ||

        order.fulfillmentStatus === 'OUT_FOR_DELIVERY' ||

        (order.fulfillmentStatus === 'READY_FOR_DISPATCH' &&

          order.delivery.deliveryPersonId)) ? (

        <p className="ga-ord-action__assignee" role="status">

          Assigned to {order.delivery.deliveryPersonName}

          {order.delivery.scheduledDate

            ? ` · ${order.delivery.scheduledDate}`

            : ''}

          {order.delivery.timeSlotLabel

            ? ` · ${order.delivery.timeSlotLabel}`

            : ''}

        </p>

      ) : null}



      <div className="ga-ord-action__progress" aria-hidden>

        {ORDER_WORKFLOW_STEPS.map((label, i) => (

          <span

            key={label}

            className={[

              'ga-ord-action__step',

              i < stepIndex ? 'ga-ord-action__step--done' : '',

              i === stepIndex ? 'ga-ord-action__step--current' : '',

            ]

              .filter(Boolean)

              .join(' ')}

          >

            {label}

          </span>

        ))}

      </div>



      <div className="ga-ord-action__body">

        <div className="ga-ord-action__copy">

          <p className="ga-ord-action__eyebrow">Next action</p>

          <h2 className="ga-ord-action__title">{next.label}</h2>

          <p className="ga-ord-action__hint">{next.hint}</p>

          {next.kind === 'action' && !showPrimaryAction ? (

            <p className="ga-ord-action__hint">

              You do not have permission to run this order action.

            </p>

          ) : null}

        </div>



        {showPrimaryAction && run ? (

          <Button

            variant="primary"

            className="ga-ord-action__btn"

            disabled={pending}

            onClick={run}

          >

            {pending ? workingLabel : next.label}

          </Button>

        ) : null}



        {next.kind === 'waiting' ? (

          <div className="ga-ord-action__waiting" role="status">

            {next.id === 'waiting_delivery' || next.id === 'waiting_driver'

              ? 'Updates automatically from Delivery PWA'

              : 'No action required right now'}

          </div>

        ) : null}



        {next.kind === 'done' ? (

          <div className="ga-ord-action__done" role="status">

            {next.id === 'completed' ? '✓ Complete' : '—'}

          </div>

        ) : null}

      </div>



      {handlers.statusMessage ? (

        <p

          className={[

            'ga-ord-action__status',

            handlers.statusMessage.toLowerCase().includes('needs attention')

              ? 'ga-ord-action__status--attention'

              : '',

          ]

            .filter(Boolean)

            .join(' ')}

          role="status"

        >

          {handlers.statusMessage}

        </p>

      ) : null}



      {handlers.errorMessage ? (

        <p className="ga-ord-action__error">{handlers.errorMessage}</p>

      ) : null}

    </section>

  );

}


