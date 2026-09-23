import { describe, expect, it } from 'vitest';

import {

  canEditOrderLines,

  getNextOrderAction,

  getOrderBusinessStage,

  orderNeedsAttentionFromEvents,

  orderWorkflowStepIndex,

} from '@/data/order-helpers';



describe('order lifecycle next action matrix', () => {

  it('draft / awaiting → approve order', () => {

    expect(

      getNextOrderAction({

        dbStatus: 'DRAFT_ASSISTED',

        fulfillmentStatus: 'CONFIRMED',

        paymentStatus: 'UNPAID',

      }).id,

    ).toBe('confirm_order');

    expect(

      getNextOrderAction({

        dbStatus: 'DRAFT_ASSISTED',

        fulfillmentStatus: 'CONFIRMED',

        paymentStatus: 'UNPAID',

      }).label,

    ).toBe('Approve Order');

  });



  it('confirmed → single process order action', () => {

    expect(

      getNextOrderAction({

        dbStatus: 'CONFIRMED',

        fulfillmentStatus: 'CONFIRMED',

        paymentStatus: 'UNPAID',

      }).id,

    ).toBe('process_order');

    expect(

      getNextOrderAction({

        dbStatus: 'STOCK_RESERVED',

        fulfillmentStatus: 'STOCK_RESERVED',

        paymentStatus: 'UNPAID',

        invoiceNumber: 'INV-ABC12345',

      }).id,

    ).toBe('process_order');

  });



  it('processing → mark packed', () => {

    expect(

      getNextOrderAction({

        dbStatus: 'PROCESSING',

        fulfillmentStatus: 'PACKING',

        paymentStatus: 'UNPAID',

        invoiceNumber: 'INV-ABC12345',

      }).id,

    ).toBe('pack_order');

    expect(

      getNextOrderAction({

        dbStatus: 'PROCESSING',

        fulfillmentStatus: 'PACKING',

        paymentStatus: 'UNPAID',

        invoiceNumber: 'INV-ABC12345',

      }).label,

    ).toBe('Mark Packed');

  });



  it('ready without driver → assign delivery (primary action)', () => {

    const next = getNextOrderAction({

      dbStatus: 'READY_FOR_DISPATCH',

      fulfillmentStatus: 'READY_FOR_DISPATCH',

      paymentStatus: 'UNPAID',

      invoiceNumber: 'INV-ABC12345',

    });

    expect(next.id).toBe('assignment_pending');

    expect(next.kind).toBe('action');

    expect(next.label).toBe('Assign Delivery');

  });



  it('assigned → waiting with driver name', () => {

    const next = getNextOrderAction({

      fulfillmentStatus: 'ASSIGNED_TO_ROUTE',

      paymentStatus: 'UNPAID',

      deliveryPersonId: 'drv-1',

      deliveryPersonName: 'Suresh Yadav',

    });

    expect(next.id).toBe('waiting_driver');

    expect(next.label).toContain('Suresh Yadav');

  });



  it('out for delivery → waiting delivery', () => {

    expect(

      getNextOrderAction({

        fulfillmentStatus: 'OUT_FOR_DELIVERY',

        paymentStatus: 'UNPAID',

        deliveryPersonId: 'drv-1',

        deliveryPersonName: 'Suresh Yadav',

      }).id,

    ).toBe('waiting_delivery');

  });



  it('delivered unpaid → record payment', () => {

    expect(

      getNextOrderAction({

        fulfillmentStatus: 'DELIVERED',

        paymentStatus: 'UNPAID',

      }).id,

    ).toBe('receive_payment');

  });



  it('delivered paid no sale → convert to sale', () => {

    expect(

      getNextOrderAction({

        fulfillmentStatus: 'DELIVERED',

        paymentStatus: 'PAID',

      }).id,

    ).toBe('convert_to_sale');

  });



  it('has sale → completed', () => {

    expect(

      getNextOrderAction({

        fulfillmentStatus: 'DELIVERED',

        paymentStatus: 'PAID',

        saleId: 'sale-1',

      }).id,

    ).toBe('completed');

  });

});



describe('order business stage labels', () => {

  it('shows attention stage when packed but unassigned', () => {

    const stage = getOrderBusinessStage({

      fulfillmentStatus: 'READY_FOR_DISPATCH',

      paymentStatus: 'UNPAID',

      needsAttention: true,

      attentionReason: 'Assignment pending',

    });

    expect(stage.kind).toBe('attention');

    expect(stage.label).toMatch(/assignment needs attention/i);

  });



  it('shows driver when assigned', () => {

    const stage = getOrderBusinessStage({

      fulfillmentStatus: 'ASSIGNED_TO_ROUTE',

      paymentStatus: 'UNPAID',

      deliveryPersonName: 'Imran Khan',

    });

    expect(stage.label).toBe('Assigned to Imran Khan');

  });

});



describe('order lifecycle helpers', () => {

  it('canEditOrderLines before PROCESSING only', () => {

    expect(canEditOrderLines('STOCK_RESERVED')).toBe(true);

    expect(canEditOrderLines('PROCESSING')).toBe(false);

    expect(canEditOrderLines('CONFIRMED', 'sale-1')).toBe(false);

  });



  it('orderNeedsAttentionFromEvents detects NEEDS_ATTENTION notes', () => {

    expect(

      orderNeedsAttentionFromEvents([

        'NEEDS_ATTENTION: Automatic delivery assignment failed',

      ]),

    ).toBe(true);

    expect(orderNeedsAttentionFromEvents(['Packed · ready for delivery'])).toBe(

      false,

    );

  });



  it('workflow step index maps Approve → Process → Pack → Deliver → Pay → Complete', () => {

    expect(orderWorkflowStepIndex('confirm_order')).toBe(0);

    expect(orderWorkflowStepIndex('process_order')).toBe(1);

    expect(orderWorkflowStepIndex('pack_order')).toBe(2);

    expect(orderWorkflowStepIndex('waiting_driver')).toBe(3);

    expect(orderWorkflowStepIndex('receive_payment')).toBe(4);

    expect(orderWorkflowStepIndex('convert_to_sale')).toBe(5);

    expect(orderWorkflowStepIndex('completed')).toBe(6);

  });

});


