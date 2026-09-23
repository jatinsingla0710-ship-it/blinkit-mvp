import type {
  OrderDetail,
  OrderListRow,
  OrdersFilterState,
  OrdersSnapshot,
  OrderTimelineStage,
  WholesaleFulfillmentStatus,
} from './orders-types';

/**
 * Layout fixtures only — replace with Supabase order / event queries.
 * Activity log is append-only; timeline mirrors customer Order Timeline v1.
 */

const TIMELINE_DEFS: {
  status: WholesaleFulfillmentStatus;
  label: string;
  explanation: string;
}[] = [
  {
    status: 'CONFIRMED',
    label: 'Order Confirmed',
    explanation: 'Wholesale order confirmed and locked for fulfilment.',
  },
  {
    status: 'STOCK_RESERVED',
    label: 'Stock Reserved',
    explanation: 'Inventory reserved against this order.',
  },
  {
    status: 'PACKING',
    label: 'Packing',
    explanation: 'Warehouse packing SKUs to the packing list.',
  },
  {
    status: 'READY_FOR_DISPATCH',
    label: 'Ready for Dispatch',
    explanation: 'Packed and waiting for route assignment.',
  },
  {
    status: 'ASSIGNED_TO_ROUTE',
    label: 'Assigned to Route',
    explanation: 'Assigned to a delivery route for the shop area.',
  },
  {
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    explanation: 'On the delivery vehicle to the shop.',
  },
  {
    status: 'DELIVERED',
    label: 'Delivered',
    explanation: 'Delivered to the shop.',
  },
];

export function buildOrderTimeline(
  current: WholesaleFulfillmentStatus,
  stamps: Partial<Record<WholesaleFulfillmentStatus, string>>,
): OrderTimelineStage[] {
  const activeIndex = TIMELINE_DEFS.findIndex((s) => s.status === current);
  return TIMELINE_DEFS.map((stage, index) => {
    let state: OrderTimelineStage['state'] = 'upcoming';
    if (activeIndex >= 0 && index < activeIndex) state = 'done';
    if (activeIndex >= 0 && index === activeIndex) state = 'current';
    return {
      ...stage,
      state,
      at: stamps[stage.status],
    };
  });
}

export const EMPTY_ORDERS_FILTERS: OrdersFilterState = {
  search: '',
  date: '',
  status: 'all',
  payment: 'all',
  salesman: 'all',
  warehouse: 'all',
};

export const ORDER_LIST_FIXTURE: OrderListRow[] = [
  {
    id: 'ord-1',
    orderCode: 'GA-14K2',
    customerName: 'Sharma Kirana',
    orderValueLabel: '₹24,850',
    paymentStatus: 'UNPAID',
    fulfillmentStatus: 'PACKING',
    deliveryStatus: 'not_started',
    salesmanName: 'Priya Sharma',
    warehouseName: 'Hub — CP',
    updatedAtLabel: '16 Jul 2026, 10:22',
    placedAtLabel: '16 Jul 2026, 08:40',
    placedAtIso: '2026-07-16T08:40:00.000Z',
    updatedAtIso: '2026-07-16T10:22:00.000Z',
  },
  {
    id: 'ord-2',
    orderCode: 'GA-14M8',
    customerName: 'Gupta Traders',
    orderValueLabel: '₹18,200',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'READY_FOR_DISPATCH',
    deliveryStatus: 'not_started',
    salesmanName: 'Rahul Mehta',
    warehouseName: 'Hub — CP',
    updatedAtLabel: '16 Jul 2026, 09:55',
    placedAtLabel: '16 Jul 2026, 07:15',
    placedAtIso: '2026-07-16T07:15:00.000Z',
    updatedAtIso: '2026-07-16T09:55:00.000Z',
  },
  {
    id: 'ord-3',
    orderCode: 'GA-15A1',
    customerName: 'Mehta Wholesale',
    orderValueLabel: '₹41,600',
    paymentStatus: 'PENDING',
    fulfillmentStatus: 'ASSIGNED_TO_ROUTE',
    deliveryStatus: 'assigned',
    salesmanName: 'Priya Sharma',
    warehouseName: 'Hub — Saket',
    updatedAtLabel: '16 Jul 2026, 09:10',
    placedAtLabel: '15 Jul 2026, 19:20',
    placedAtIso: '2026-07-15T19:20:00.000Z',
    updatedAtIso: '2026-07-16T09:10:00.000Z',
  },
  {
    id: 'ord-4',
    orderCode: 'GA-15B2',
    customerName: 'City Dry Fruits',
    orderValueLabel: '₹9,450',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'OUT_FOR_DELIVERY',
    deliveryStatus: 'out_for_delivery',
    salesmanName: 'Aman Verma',
    warehouseName: 'Hub — Saket',
    updatedAtLabel: '16 Jul 2026, 08:05',
    placedAtLabel: '15 Jul 2026, 16:00',
    placedAtIso: '2026-07-15T16:00:00.000Z',
    updatedAtIso: '2026-07-16T08:05:00.000Z',
  },
  {
    id: 'ord-5',
    orderCode: 'GA-13P1',
    customerName: 'Sharma Kirana',
    orderValueLabel: '₹12,100',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'DELIVERED',
    deliveryStatus: 'delivered',
    salesmanName: 'Priya Sharma',
    warehouseName: 'Hub — CP',
    updatedAtLabel: '15 Jul 2026, 14:30',
    placedAtLabel: '14 Jul 2026, 11:00',
    placedAtIso: '2026-07-14T11:00:00.000Z',
    updatedAtIso: '2026-07-15T14:30:00.000Z',
  },
  {
    id: 'ord-6',
    orderCode: 'GA-12R4',
    customerName: 'City Dry Fruits',
    orderValueLabel: '₹6,300',
    paymentStatus: 'PARTIAL',
    fulfillmentStatus: 'CONFIRMED',
    deliveryStatus: 'not_started',
    salesmanName: 'Aman Verma',
    warehouseName: 'Hub — Saket',
    updatedAtLabel: '16 Jul 2026, 07:50',
    placedAtLabel: '16 Jul 2026, 07:45',
    placedAtIso: '2026-07-16T07:45:00.000Z',
    updatedAtIso: '2026-07-16T07:50:00.000Z',
  },
];

export const ORDERS_SNAPSHOT_FIXTURE: OrdersSnapshot = {
  generatedAtLabel: 'Today · layout fixture',
  kpis: [
    {
      id: 'today',
      label: "Today's Orders",
      value: '6',
      hint: 'Confirmed today',
    },
    {
      id: 'pending',
      label: 'Pending Confirmation',
      value: '1',
      hint: 'Awaiting stock lock',
      tone: 'warning',
    },
    {
      id: 'packing',
      label: 'Packing',
      value: '1',
      hint: 'In warehouse',
    },
    {
      id: 'ready',
      label: 'Ready for Dispatch',
      value: '1',
      hint: 'Awaiting route',
    },
    {
      id: 'ofd',
      label: 'Out for Delivery',
      value: '1',
      hint: 'On vehicle',
    },
    {
      id: 'delivered',
      label: 'Delivered',
      value: '1',
      hint: 'Completed today window',
      tone: 'positive',
    },
  ],
  rows: ORDER_LIST_FIXTURE,
  salesRows: [],
  filterOptions: {
    statuses: [
      { value: 'all', label: 'All statuses' },
      { value: 'CONFIRMED', label: 'Confirmed' },
      { value: 'PACKING', label: 'Packing' },
      { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
      { value: 'ASSIGNED_TO_ROUTE', label: 'Assigned to Route' },
      { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
      { value: 'DELIVERED', label: 'Delivered' },
    ],
    payments: [
      { value: 'all', label: 'All payments' },
      { value: 'PAID', label: 'Paid' },
      { value: 'UNPAID', label: 'Unpaid' },
      { value: 'PENDING', label: 'Pending' },
      { value: 'PARTIAL', label: 'Partial' },
    ],
    salesmen: [
      { value: 'all', label: 'All salesmen' },
      { value: 'Priya Sharma', label: 'Priya Sharma' },
      { value: 'Rahul Mehta', label: 'Rahul Mehta' },
      { value: 'Aman Verma', label: 'Aman Verma' },
    ],
    warehouses: [
      { value: 'all', label: 'All warehouses' },
      { value: 'Hub — CP', label: 'Hub — CP' },
      { value: 'Hub — Saket', label: 'Hub — Saket' },
    ],
  },
};

export function filterOrderRows(
  rows: OrderListRow[],
  filters: OrdersFilterState,
): OrderListRow[] {
  return rows.filter((row) => {
    if (filters.status !== 'all' && row.fulfillmentStatus !== filters.status) {
      return false;
    }
    if (filters.payment !== 'all' && row.paymentStatus !== filters.payment) {
      return false;
    }
    if (filters.salesman !== 'all' && row.salesmanName !== filters.salesman) {
      return false;
    }
    if (filters.warehouse !== 'all' && row.warehouseName !== filters.warehouse) {
      return false;
    }
    // Date filter is UI-ready; fixture labels are not ISO — ignored until live data.
    return true;
  });
}

export const ORDER_DETAIL_FIXTURES: Record<string, OrderDetail> = {
  'ord-1': {
    id: 'ord-1',
    orderCode: 'GA-14K2',
    customerName: 'Sharma Kirana',
    salesmanName: 'Priya Sharma',
    warehouseName: 'Hub — CP',
    placedAtLabel: '16 Jul 2026, 08:40',
    updatedAtLabel: '16 Jul 2026, 10:22',
    notes: 'Prefer morning delivery window.',
    fulfillmentStatus: 'PACKING',
    paymentStatus: 'UNPAID',
    deliveryStatus: 'not_started',
    orderValueLabel: '₹24,850',
    lines: [
      {
        id: 'li-1',
        skuCode: 'AKH-LA-10',
        skuName: 'Akhrot Giri · Light Amber',
        quantityLabel: '10 KG',
        unitPriceLabel: '₹920',
        lineTotalLabel: '₹9,200',
      },
      {
        id: 'li-2',
        skuCode: 'KIS-EL-CTN',
        skuName: 'Kishmish Green · Extra Long',
        quantityLabel: '4 Carton',
        unitPriceLabel: '₹210',
        lineTotalLabel: '₹840',
      },
      {
        id: 'li-3',
        skuCode: 'AKH-LA-CTN',
        skuName: 'Akhrot Giri · Carton',
        quantityLabel: '2 Carton',
        unitPriceLabel: '₹8,900',
        lineTotalLabel: '₹17,800',
      },
    ],
    timeline: buildOrderTimeline('PACKING', {
      CONFIRMED: '16 Jul 2026, 08:40',
      STOCK_RESERVED: '16 Jul 2026, 08:55',
      PACKING: '16 Jul 2026, 10:22',
    }),
    workflowEvents: [],
    payment: {
      methodLabel: 'Cash on Delivery',
      status: 'UNPAID',
      subtotalLabel: '₹27,840',
      adjustmentsLabel: '−₹2,990',
      totalLabel: '₹24,850',
      collectedLabel: '₹0',
      outstandingLabel: '₹24,850',
    },
    delivery: {
      addressLabel: 'Shop',
      addressText: '12 Barakhamba Road, Connaught Place, New Delhi',
      windowLabel: 'Tomorrow · 10:00 – 13:00',
      warehouseName: 'Hub — CP',
      deliveryStatus: 'not_started',
    },
    activity: [
      {
        id: 'act-1',
        atLabel: '16 Jul 2026, 10:22',
        actorLabel: 'Warehouse',
        actionLabel: 'Mark Packing',
        detail: 'Order moved to Packing.',
      },
      {
        id: 'act-2',
        atLabel: '16 Jul 2026, 08:55',
        actorLabel: 'System',
        actionLabel: 'Stock Reserved',
        detail: 'Reserved 3 SKUs at Hub — CP.',
      },
      {
        id: 'act-3',
        atLabel: '16 Jul 2026, 08:40',
        actorLabel: 'Customer',
        actionLabel: 'Order Confirmed',
        detail: 'Self-serve confirmation from Review Order.',
      },
    ],
  },
  'ord-2': {
    id: 'ord-2',
    orderCode: 'GA-14M8',
    customerName: 'Gupta Traders',
    salesmanName: 'Rahul Mehta',
    warehouseName: 'Hub — CP',
    placedAtLabel: '16 Jul 2026, 07:15',
    updatedAtLabel: '16 Jul 2026, 09:55',
    fulfillmentStatus: 'READY_FOR_DISPATCH',
    paymentStatus: 'PAID',
    deliveryStatus: 'not_started',
    orderValueLabel: '₹18,200',
    lines: [
      {
        id: 'li-21',
        skuCode: 'SPC-KC-1KG',
        skuName: 'Kashmiri Chilli · 1 KG pack',
        quantityLabel: '20 Pack',
        unitPriceLabel: '₹280',
        lineTotalLabel: '₹5,600',
      },
      {
        id: 'li-22',
        skuCode: 'AKH-LA-10',
        skuName: 'Akhrot Giri · Light Amber',
        quantityLabel: '10 KG',
        unitPriceLabel: '₹920',
        lineTotalLabel: '₹9,200',
      },
    ],
    timeline: buildOrderTimeline('READY_FOR_DISPATCH', {
      CONFIRMED: '16 Jul 2026, 07:15',
      STOCK_RESERVED: '16 Jul 2026, 07:30',
      PACKING: '16 Jul 2026, 08:40',
      READY_FOR_DISPATCH: '16 Jul 2026, 09:55',
    }),
    payment: {
      methodLabel: 'Pay Online',
      status: 'PAID',
      subtotalLabel: '₹18,200',
      adjustmentsLabel: '₹0',
      totalLabel: '₹18,200',
      collectedLabel: '₹18,200',
      outstandingLabel: '₹0',
    },
    delivery: {
      addressLabel: 'Warehouse gate',
      addressText: 'Select Citywalk loading bay, Saket, New Delhi',
      windowLabel: 'Today · 14:00 – 17:00',
      warehouseName: 'Hub — CP',
      deliveryStatus: 'not_started',
      challanLabel: 'CH-14M8',
    },
    activity: [
      {
        id: 'act-21',
        atLabel: '16 Jul 2026, 09:55',
        actorLabel: 'Warehouse',
        actionLabel: 'Ready for Dispatch',
        detail: 'Packing complete. Awaiting route.',
      },
      {
        id: 'act-22',
        atLabel: '16 Jul 2026, 07:20',
        actorLabel: 'System',
        actionLabel: 'Payment Captured',
        detail: 'Online payment marked PAID.',
      },
      {
        id: 'act-23',
        atLabel: '16 Jul 2026, 07:15',
        actorLabel: 'Salesman',
        actionLabel: 'Order Confirmed',
        detail: 'Assisted order confirmed by retailer OTP.',
      },
    ],
  },
  'ord-3': {
    id: 'ord-3',
    orderCode: 'GA-15A1',
    customerName: 'Mehta Wholesale',
    salesmanName: 'Priya Sharma',
    warehouseName: 'Hub — Saket',
    placedAtLabel: '15 Jul 2026, 19:20',
    updatedAtLabel: '16 Jul 2026, 09:10',
    fulfillmentStatus: 'ASSIGNED_TO_ROUTE',
    paymentStatus: 'PENDING',
    deliveryStatus: 'assigned',
    orderValueLabel: '₹41,600',
    lines: [
      {
        id: 'li-31',
        skuCode: 'AKH-LA-CTN',
        skuName: 'Akhrot Giri · Carton',
        quantityLabel: '4 Carton',
        unitPriceLabel: '₹8,900',
        lineTotalLabel: '₹35,600',
      },
      {
        id: 'li-32',
        skuCode: 'KIS-EL-CTN',
        skuName: 'Kishmish Green · Extra Long',
        quantityLabel: '10 Carton',
        unitPriceLabel: '₹210',
        lineTotalLabel: '₹2,100',
      },
    ],
    timeline: buildOrderTimeline('ASSIGNED_TO_ROUTE', {
      CONFIRMED: '15 Jul 2026, 19:20',
      STOCK_RESERVED: '15 Jul 2026, 19:35',
      PACKING: '16 Jul 2026, 07:00',
      READY_FOR_DISPATCH: '16 Jul 2026, 08:30',
      ASSIGNED_TO_ROUTE: '16 Jul 2026, 09:10',
    }),
    payment: {
      methodLabel: 'Cash on Delivery',
      status: 'PENDING',
      subtotalLabel: '₹41,600',
      adjustmentsLabel: '₹0',
      totalLabel: '₹41,600',
      collectedLabel: '₹0',
      outstandingLabel: '₹41,600',
    },
    delivery: {
      addressLabel: 'Shop',
      addressText: 'Atta Market, Sector 18, Noida',
      windowLabel: 'Tomorrow · 10:00 – 13:00',
      routeLabel: 'Route SA-07',
      warehouseName: 'Hub — Saket',
      deliveryStatus: 'assigned',
      challanLabel: 'CH-15A1',
    },
    activity: [
      {
        id: 'act-31',
        atLabel: '16 Jul 2026, 09:10',
        actorLabel: 'Dispatcher',
        actionLabel: 'Assign Route',
        detail: 'Assigned to Route SA-07.',
      },
      {
        id: 'act-32',
        atLabel: '15 Jul 2026, 19:20',
        actorLabel: 'Customer',
        actionLabel: 'Order Confirmed',
        detail: 'Large carton order confirmed.',
      },
    ],
  },
  'ord-4': {
    id: 'ord-4',
    orderCode: 'GA-15B2',
    customerName: 'City Dry Fruits',
    salesmanName: 'Aman Verma',
    warehouseName: 'Hub — Saket',
    placedAtLabel: '15 Jul 2026, 16:00',
    updatedAtLabel: '16 Jul 2026, 08:05',
    fulfillmentStatus: 'OUT_FOR_DELIVERY',
    paymentStatus: 'PAID',
    deliveryStatus: 'out_for_delivery',
    orderValueLabel: '₹9,450',
    lines: [
      {
        id: 'li-41',
        skuCode: 'KIS-EL-CTN',
        skuName: 'Kishmish Green · Extra Long',
        quantityLabel: '14 Carton',
        unitPriceLabel: '₹210',
        lineTotalLabel: '₹2,940',
      },
    ],
    timeline: buildOrderTimeline('OUT_FOR_DELIVERY', {
      CONFIRMED: '15 Jul 2026, 16:00',
      STOCK_RESERVED: '15 Jul 2026, 16:10',
      PACKING: '15 Jul 2026, 17:40',
      READY_FOR_DISPATCH: '15 Jul 2026, 18:20',
      ASSIGNED_TO_ROUTE: '16 Jul 2026, 07:30',
      OUT_FOR_DELIVERY: '16 Jul 2026, 08:05',
    }),
    payment: {
      methodLabel: 'Pay Online',
      status: 'PAID',
      subtotalLabel: '₹9,450',
      adjustmentsLabel: '₹0',
      totalLabel: '₹9,450',
      collectedLabel: '₹9,450',
      outstandingLabel: '₹0',
    },
    delivery: {
      addressLabel: 'Shop',
      addressText: 'Select Citywalk, Saket, New Delhi',
      windowLabel: 'Today · 09:00 – 12:00',
      routeLabel: 'Route SA-03',
      warehouseName: 'Hub — Saket',
      deliveryStatus: 'out_for_delivery',
      challanLabel: 'CH-15B2',
    },
    activity: [
      {
        id: 'act-41',
        atLabel: '16 Jul 2026, 08:05',
        actorLabel: 'Driver',
        actionLabel: 'Out for Delivery',
        detail: 'Left Hub — Saket on Route SA-03.',
      },
      {
        id: 'act-42',
        atLabel: '16 Jul 2026, 07:30',
        actorLabel: 'Dispatcher',
        actionLabel: 'Assign Route',
        detail: 'Assigned to Route SA-03.',
      },
    ],
  },
  'ord-5': {
    id: 'ord-5',
    orderCode: 'GA-13P1',
    customerName: 'Sharma Kirana',
    salesmanName: 'Priya Sharma',
    warehouseName: 'Hub — CP',
    placedAtLabel: '14 Jul 2026, 11:00',
    updatedAtLabel: '15 Jul 2026, 14:30',
    fulfillmentStatus: 'DELIVERED',
    paymentStatus: 'PAID',
    deliveryStatus: 'delivered',
    orderValueLabel: '₹12,100',
    lines: [
      {
        id: 'li-51',
        skuCode: 'AKH-LA-10',
        skuName: 'Akhrot Giri · Light Amber',
        quantityLabel: '10 KG',
        unitPriceLabel: '₹920',
        lineTotalLabel: '₹9,200',
      },
    ],
    timeline: buildOrderTimeline('DELIVERED', {
      CONFIRMED: '14 Jul 2026, 11:00',
      STOCK_RESERVED: '14 Jul 2026, 11:10',
      PACKING: '14 Jul 2026, 13:00',
      READY_FOR_DISPATCH: '14 Jul 2026, 15:00',
      ASSIGNED_TO_ROUTE: '15 Jul 2026, 08:00',
      OUT_FOR_DELIVERY: '15 Jul 2026, 10:00',
      DELIVERED: '15 Jul 2026, 14:30',
    }),
    payment: {
      methodLabel: 'Pay Online',
      status: 'PAID',
      subtotalLabel: '₹12,100',
      adjustmentsLabel: '₹0',
      totalLabel: '₹12,100',
      collectedLabel: '₹12,100',
      outstandingLabel: '₹0',
    },
    delivery: {
      addressLabel: 'Shop',
      addressText: '12 Barakhamba Road, Connaught Place, New Delhi',
      windowLabel: '15 Jul · 10:00 – 13:00',
      routeLabel: 'Route CP-02',
      warehouseName: 'Hub — CP',
      deliveryStatus: 'delivered',
      challanLabel: 'CH-13P1',
    },
    activity: [
      {
        id: 'act-51',
        atLabel: '15 Jul 2026, 14:30',
        actorLabel: 'Driver',
        actionLabel: 'Delivered',
        detail: 'POD captured at shop.',
      },
      {
        id: 'act-52',
        atLabel: '15 Jul 2026, 14:35',
        actorLabel: 'System',
        actionLabel: 'Generate Challan',
        detail: 'Challan CH-13P1 archived.',
      },
    ],
  },
  'ord-6': {
    id: 'ord-6',
    orderCode: 'GA-12R4',
    customerName: 'City Dry Fruits',
    salesmanName: 'Aman Verma',
    warehouseName: 'Hub — Saket',
    placedAtLabel: '16 Jul 2026, 07:45',
    updatedAtLabel: '16 Jul 2026, 07:50',
    notes: 'Pending stock confirmation on chilli pack.',
    fulfillmentStatus: 'CONFIRMED',
    paymentStatus: 'PARTIAL',
    deliveryStatus: 'not_started',
    orderValueLabel: '₹6,300',
    lines: [
      {
        id: 'li-61',
        skuCode: 'SPC-KC-1KG',
        skuName: 'Kashmiri Chilli · 1 KG pack',
        quantityLabel: '10 Pack',
        unitPriceLabel: '₹280',
        lineTotalLabel: '₹2,800',
      },
    ],
    timeline: buildOrderTimeline('CONFIRMED', {
      CONFIRMED: '16 Jul 2026, 07:45',
    }),
    payment: {
      methodLabel: 'Cash on Delivery',
      status: 'PARTIAL',
      subtotalLabel: '₹6,300',
      adjustmentsLabel: '₹0',
      totalLabel: '₹6,300',
      collectedLabel: '₹2,000',
      outstandingLabel: '₹4,300',
    },
    delivery: {
      addressLabel: 'Shop',
      addressText: 'Select Citywalk, Saket, New Delhi',
      windowLabel: 'Tomorrow · 10:00 – 13:00',
      warehouseName: 'Hub — Saket',
      deliveryStatus: 'not_started',
    },
    activity: [
      {
        id: 'act-61',
        atLabel: '16 Jul 2026, 07:50',
        actorLabel: 'System',
        actionLabel: 'Payment Partial',
        detail: 'Advance ₹2,000 recorded.',
      },
      {
        id: 'act-62',
        atLabel: '16 Jul 2026, 07:45',
        actorLabel: 'Customer',
        actionLabel: 'Order Confirmed',
        detail: 'Awaiting stock reservation.',
      },
    ],
  },
};

export function getOrderDetailFixture(orderId: string): OrderDetail | null {
  const detail = ORDER_DETAIL_FIXTURES[orderId];
  if (!detail) return null;
  return {
    ...detail,
    workflowEvents: detail.workflowEvents ?? detail.activity,
  };
}

export function fulfillmentStatusLabel(
  status: WholesaleFulfillmentStatus,
): string {
  return TIMELINE_DEFS.find((s) => s.status === status)?.label ?? status;
}
