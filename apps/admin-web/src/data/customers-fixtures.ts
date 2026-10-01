import type {
  CustomerDetail,
  CustomerListRow,
  CustomerOrderRow,
  CustomersSnapshot,
  DigitalAccessStatus,
} from './customers-types';
import { buildActivationWorkflow } from './customer-helpers';
import { buildDigitalAccessVm } from './customer-digital-access';
import {
  attachAttentionCount,
  buildCustomerAccountSummary,
  buildCustomerAttentionItems,
  buildCustomerTimeline,
} from './customer-account-dashboard';
import { buildCustomerLedger } from './customer-ledger';
import { SERVICE_AREA_LIST_FIXTURE } from './service-area-fixtures';

type CustomerDetailFixtureInput = Omit<
  CustomerDetail,
  'summary' | 'attentionItems' | 'timeline' | 'ledger'
> & {
  orders: Array<
    Omit<CustomerOrderRow, 'fulfillmentStatus' | 'totalAmount'> &
      Partial<Pick<CustomerOrderRow, 'fulfillmentStatus' | 'totalAmount'>>
  >;
};

function labelToFulfillmentStatus(label: string): string {
  const map: Record<string, string> = {
    packing: 'PACKING',
    delivered: 'DELIVERED',
    'ready for dispatch': 'READY_FOR_DISPATCH',
    'out for delivery': 'OUT_FOR_DELIVERY',
    'assigned to route': 'ASSIGNED_TO_ROUTE',
    confirmed: 'CONFIRMED',
  };
  return map[label.toLowerCase()] ?? label.toUpperCase().replace(/\s+/g, '_');
}

function parseInrLabel(valueLabel: string): number {
  const amount = Number(valueLabel.replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function enrichCustomerDetail(input: CustomerDetailFixtureInput): CustomerDetail {
  const orders: CustomerOrderRow[] = input.orders.map((order) => ({
    ...order,
    fulfillmentStatus:
      order.fulfillmentStatus ?? labelToFulfillmentStatus(order.fulfillmentLabel),
    totalAmount: order.totalAmount ?? parseInrLabel(order.valueLabel),
  }));

  const orderAggregates = orders.map((order) => ({
    id: order.id,
    status: order.fulfillmentStatus,
    total: order.totalAmount,
    created_at: order.placedAtLabel,
  }));
  const paymentAggregates = input.payments.map((payment) => ({
    order_id:
      orders.find((order) => order.orderCode === payment.orderCode)?.id ?? '',
    status: payment.status,
    amount: parseInrLabel(payment.amountLabel),
  }));

  const attentionItems = buildCustomerAttentionItems(orders);
  const summary = attachAttentionCount(
    buildCustomerAccountSummary({
      orders: orderAggregates,
      payments: paymentAggregates,
    }),
    attentionItems,
  );
  const ledger = buildCustomerLedger({
    orders: orderAggregates.map((order) => ({
      ...order,
      order_code: orders.find((row) => row.id === order.id)?.orderCode,
    })),
    payments: paymentAggregates,
  });

  const detail: CustomerDetail = {
    ...input,
    orders,
    summary,
    ledger,
    attentionItems,
    timeline: [],
  };

  return {
    ...detail,
    timeline: buildCustomerTimeline(detail),
  };
}

function fixtureDigital(
  access: DigitalAccessStatus,
  opts?: {
    mobile?: string;
    appLinkSentAt?: string;
    activatedAt?: string;
    isActive?: boolean;
  },
) {
  const isActive = opts?.isActive ?? access !== 'access_disabled';
  const vm = buildDigitalAccessVm({
    isActive,
    hasAuthLink: access === 'activated',
    hasAppLinkSent: access === 'app_link_sent',
    primaryMobile: opts?.mobile,
    appLinkSentAtLabel: opts?.appLinkSentAt,
    activatedAtLabel: opts?.activatedAt,
  });
  return {
    digitalAccess: vm.status,
    digitalAccessLabel: vm.label,
    digitalAccessVm: vm,
  };
}

/**
 * Layout fixtures only — replace with Supabase shop / invitation / order queries.
 * Activation workflow is a readiness rail, not a CRM pipeline board.
 */

export { buildActivationWorkflow };

export const CUSTOMER_LIST_FIXTURE: CustomerListRow[] = [
  {
    id: 'cust-sharma',
    shopName: 'Sharma Kirana',
    ownerName: 'Ramesh Sharma',
    phoneLabel: '+919811122201',
    areaLabel: 'Connaught Place',
    serviceAreaId: SERVICE_AREA_LIST_FIXTURE[0]?.id,
    salesmanName: 'Priya Sharma',
    lastOrderLabel: 'GA-14K2 · Today',
    preferredPayment: 'COD',
    status: 'active',
    digitalAccess: 'activated',
    digitalAccessLabel: 'Activated',
    createdAtIso: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'cust-gupta',
    shopName: 'Gupta Traders',
    ownerName: 'Suresh Gupta',
    phoneLabel: '+919811122202',
    areaLabel: 'Saket',
    serviceAreaId: SERVICE_AREA_LIST_FIXTURE[0]?.id,
    salesmanName: 'Rahul Mehta',
    lastOrderLabel: 'GA-14M8 · Today',
    preferredPayment: 'Online',
    status: 'active',
    digitalAccess: 'activated',
    digitalAccessLabel: 'Activated',
    createdAtIso: '2026-04-18T12:00:00.000Z',
  },
  {
    id: 'cust-mehta',
    shopName: 'Mehta Wholesale',
    ownerName: 'Anil Mehta',
    phoneLabel: '+919811122203',
    areaLabel: 'Noida Sec 18',
    salesmanName: 'Priya Sharma',
    lastOrderLabel: 'GA-15A1 · Yesterday',
    preferredPayment: 'Credit',
    status: 'active',
    digitalAccess: 'activated',
    digitalAccessLabel: 'Activated',
    createdAtIso: '2026-05-10T09:00:00.000Z',
  },
  {
    id: 'cust-city',
    shopName: 'City Dry Fruits',
    ownerName: 'Neha Kapoor',
    phoneLabel: '+919811122204',
    areaLabel: 'Saket',
    salesmanName: 'Aman Verma',
    lastOrderLabel: 'GA-15B2 · Today',
    preferredPayment: 'Online',
    status: 'active',
    digitalAccess: 'activated',
    digitalAccessLabel: 'Activated',
    createdAtIso: '2026-06-15T08:00:00.000Z',
  },
  {
    id: 'cust-new-invite',
    shopName: 'Laxmi Stores',
    ownerName: 'Vikram Singh',
    areaLabel: 'Karol Bagh',
    salesmanName: 'Rahul Mehta',
    lastOrderLabel: '—',
    preferredPayment: 'COD',
    status: 'active',
    digitalAccess: 'not_activated',
    digitalAccessLabel: 'Not Activated',
    phoneLabel: '+919876543210',
    createdAtIso: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'cust-inactive',
    shopName: 'Old Town Nuts',
    ownerName: 'Farooq Ali',
    areaLabel: 'Chandni Chowk',
    salesmanName: 'Aman Verma',
    lastOrderLabel: 'GA-08Z3 · 42 days ago',
    preferredPayment: 'COD',
    status: 'inactive',
    digitalAccess: 'access_disabled',
    digitalAccessLabel: 'Access disabled',
    phoneLabel: '+919811122207',
    createdAtIso: '2026-05-01T10:00:00.000Z',
  },
  {
    id: 'cust-blocked',
    shopName: 'Quick Mart',
    ownerName: 'Rohit Jain',
    phoneLabel: '+919811122208',
    areaLabel: 'Lajpat Nagar',
    salesmanName: 'Priya Sharma',
    lastOrderLabel: 'GA-07B1 · 18 days ago',
    preferredPayment: 'Credit',
    status: 'inactive',
    digitalAccess: 'access_disabled',
    digitalAccessLabel: 'Access disabled',
    createdAtIso: '2026-04-01T10:00:00.000Z',
  },
];

export const CUSTOMERS_SNAPSHOT_FIXTURE: CustomersSnapshot = {
  generatedAtLabel: 'Today · layout fixture',
  kpis: [
    {
      id: 'total',
      label: 'Total Customers',
      value: '7',
      hint: 'Retail shops in the network',
    },
    {
      id: 'active',
      label: 'Active Customers',
      value: '5',
      hint: 'Operational for orders and delivery',
      tone: 'positive',
    },
    {
      id: 'recent',
      label: 'Recently Added',
      value: '1',
      hint: 'Added in the last 7 days',
    },
  ],
  rows: CUSTOMER_LIST_FIXTURE,
  createDefaults: SERVICE_AREA_LIST_FIXTURE[0]
    ? {
        serviceAreaId: SERVICE_AREA_LIST_FIXTURE[0].id,
        deliveryCity: 'New Delhi',
        deliveryState: 'Delhi',
        deliveryPinCode: SERVICE_AREA_LIST_FIXTURE[0].pinCodes[0] ?? '110017',
      }
    : undefined,
};

export const CUSTOMER_DETAIL_FIXTURES: Record<string, CustomerDetailFixtureInput> = {
  'cust-sharma': {
    id: 'cust-sharma',
    shopName: 'Sharma Kirana',
    ownerName: 'Ramesh Sharma',
    phoneLabel: '+91 98XXX 11220',
    areaLabel: 'Connaught Place',
    assignedSalesmanProfileId: 'sm-priya',
    salesmanName: 'Priya Sharma',
    preferredPayment: 'COD',
    status: 'active',
    ...fixtureDigital('activated', {
      mobile: '+919811122201',
      activatedAt: '02 Mar 2026, 10:20',
    }),
    activationState: 'activated',
    orderClass: 'repeat',
    orderClassLabel: 'Repeat customer',
    deliveryLat: 28.6315,
    deliveryLng: 77.2167,
    createdAtLabel: '02 Mar 2026, 10:00',
    updatedAtLabel: '16 Jul 2026, 10:22',
    health: {
      ordersThisMonth: 8,
      averageOrderValueLabel: '₹18,420',
      lastOrderDateLabel: '16 Jul 2026',
      lastPaymentStatus: 'UNPAID',
    },
    activation: buildActivationWorkflow('activated', {
      created: '02 Mar 2026, 10:00',
      invitation_sent: '02 Mar 2026, 10:05',
      activated: '02 Mar 2026, 10:20',
    }),
    orders: [
      {
        id: 'o1',
        orderCode: 'GA-14K2',
        valueLabel: '₹24,850',
        fulfillmentLabel: 'Packing',
        fulfillmentStatus: 'PACKING',
        totalAmount: 24850,
        paymentStatus: 'UNPAID',
        placedAtLabel: '16 Jul 2026, 08:40',
      },
      {
        id: 'o2',
        orderCode: 'GA-13P1',
        valueLabel: '₹12,100',
        fulfillmentLabel: 'Delivered',
        fulfillmentStatus: 'DELIVERED',
        totalAmount: 12100,
        paymentStatus: 'PAID',
        placedAtLabel: '14 Jul 2026, 11:00',
      },
    ],
    payments: [
      {
        id: 'p1',
        orderCode: 'GA-14K2',
        methodLabel: 'Cash on Delivery',
        amountLabel: '₹24,850',
        status: 'UNPAID',
        atLabel: '16 Jul 2026, 08:40',
      },
      {
        id: 'p2',
        orderCode: 'GA-13P1',
        methodLabel: 'Pay Online',
        amountLabel: '₹12,100',
        status: 'PAID',
        atLabel: '14 Jul 2026, 11:05',
      },
    ],
    addresses: [
      {
        id: 'a1',
        label: 'Shop',
        text: '12 Barakhamba Road, Connaught Place, New Delhi',
        isPrimary: true,
        serviceable: true,
      },
    ],
    activity: [
      {
        id: 'act1',
        atLabel: '16 Jul 2026, 08:40',
        actorLabel: 'Customer',
        actionLabel: 'Order Confirmed',
        detail: 'GA-14K2 confirmed from Review Order.',
      },
      {
        id: 'act2',
        atLabel: '02 Mar 2026, 10:20',
        actorLabel: 'System',
        actionLabel: 'Activated',
        detail: 'Retailer account activated after OTP.',
      },
    ],
    documents: [
      {
        id: 'd1',
        name: 'GSTIN certificate',
        typeLabel: 'Tax',
        statusLabel: 'Verified',
        uploadedAtLabel: '03 Mar 2026',
      },
      {
        id: 'd2',
        name: 'Shop front photo',
        typeLabel: 'Identity',
        statusLabel: 'On file',
        uploadedAtLabel: '02 Mar 2026',
      },
    ],
  },
  'cust-gupta': {
    id: 'cust-gupta',
    shopName: 'Gupta Traders',
    ownerName: 'Suresh Gupta',
    phoneLabel: '+91 98XXX 33441',
    areaLabel: 'Saket',
    salesmanName: 'Rahul Mehta',
    preferredPayment: 'Online',
    status: 'active',
    ...fixtureDigital('activated', {
      mobile: '+919811122202',
      activatedAt: '18 Apr 2026, 12:25',
    }),
    activationState: 'activated',
    orderClass: 'repeat',
    orderClassLabel: 'Repeat customer',
    createdAtLabel: '18 Apr 2026, 12:00',
    updatedAtLabel: '16 Jul 2026, 09:55',
    health: {
      ordersThisMonth: 5,
      averageOrderValueLabel: '₹15,800',
      lastOrderDateLabel: '16 Jul 2026',
      lastPaymentStatus: 'PAID',
    },
    activation: buildActivationWorkflow('activated', {
      created: '18 Apr 2026, 12:00',
      invitation_sent: '18 Apr 2026, 12:10',
      activated: '18 Apr 2026, 12:25',
    }),
    orders: [
      {
        id: 'og1',
        orderCode: 'GA-14M8',
        valueLabel: '₹18,200',
        fulfillmentLabel: 'Ready for Dispatch',
        fulfillmentStatus: 'READY_FOR_DISPATCH',
        totalAmount: 18200,
        paymentStatus: 'PAID',
        placedAtLabel: '16 Jul 2026, 07:15',
      },
    ],
    payments: [
      {
        id: 'pg1',
        orderCode: 'GA-14M8',
        methodLabel: 'Pay Online',
        amountLabel: '₹18,200',
        status: 'PAID',
        atLabel: '16 Jul 2026, 07:20',
      },
    ],
    addresses: [
      {
        id: 'ag1',
        label: 'Warehouse gate',
        text: 'Select Citywalk loading bay, Saket, New Delhi',
        isPrimary: true,
        serviceable: true,
      },
    ],
    activity: [
      {
        id: 'ag-act1',
        atLabel: '16 Jul 2026, 07:15',
        actorLabel: 'Salesman',
        actionLabel: 'Assisted Order',
        detail: 'GA-14M8 assisted confirmation completed.',
      },
    ],
    documents: [
      {
        id: 'dg1',
        name: 'Trade license',
        typeLabel: 'Compliance',
        statusLabel: 'Verified',
        uploadedAtLabel: '19 Apr 2026',
      },
    ],
  },
  'cust-mehta': {
    id: 'cust-mehta',
    shopName: 'Mehta Wholesale',
    ownerName: 'Anil Mehta',
    phoneLabel: '+91 98XXX 55662',
    areaLabel: 'Noida Sec 18',
    salesmanName: 'Priya Sharma',
    preferredPayment: 'Credit',
    status: 'active',
    ...fixtureDigital('activated', {
      mobile: '+919811122203',
      activatedAt: '10 Jan 2026, 10:10',
    }),
    activationState: 'activated',
    orderClass: 'repeat',
    orderClassLabel: 'Repeat customer',
    createdAtLabel: '10 Jan 2026, 09:30',
    updatedAtLabel: '16 Jul 2026, 09:10',
    health: {
      ordersThisMonth: 3,
      averageOrderValueLabel: '₹36,400',
      lastOrderDateLabel: '15 Jul 2026',
      lastPaymentStatus: 'PENDING',
    },
    activation: buildActivationWorkflow('activated', {
      created: '10 Jan 2026, 09:30',
      invitation_sent: '10 Jan 2026, 09:40',
      activated: '10 Jan 2026, 10:10',
    }),
    orders: [
      {
        id: 'om1',
        orderCode: 'GA-15A1',
        valueLabel: '₹41,600',
        fulfillmentLabel: 'Assigned to Route',
        fulfillmentStatus: 'ASSIGNED_TO_ROUTE',
        totalAmount: 41600,
        paymentStatus: 'PENDING',
        placedAtLabel: '15 Jul 2026, 19:20',
      },
    ],
    payments: [
      {
        id: 'pm1',
        orderCode: 'GA-15A1',
        methodLabel: 'Cash on Delivery',
        amountLabel: '₹41,600',
        status: 'PENDING',
        atLabel: '15 Jul 2026, 19:20',
      },
    ],
    addresses: [
      {
        id: 'am1',
        label: 'Shop',
        text: 'Atta Market, Sector 18, Noida',
        isPrimary: true,
        serviceable: true,
      },
    ],
    activity: [
      {
        id: 'am-act1',
        atLabel: '15 Jul 2026, 19:20',
        actorLabel: 'Customer',
        actionLabel: 'Order Confirmed',
        detail: 'Large carton order GA-15A1.',
      },
    ],
    documents: [
      {
        id: 'dm1',
        name: 'Credit application',
        typeLabel: 'Credit',
        statusLabel: 'Approved',
        uploadedAtLabel: '12 Jan 2026',
      },
    ],
  },
  'cust-city': {
    id: 'cust-city',
    shopName: 'City Dry Fruits',
    ownerName: 'Neha Kapoor',
    phoneLabel: '+91 98XXX 77883',
    areaLabel: 'Saket',
    salesmanName: 'Aman Verma',
    preferredPayment: 'Online',
    status: 'active',
    ...fixtureDigital('activated', {
      mobile: '+919811122204',
      activatedAt: '22 Feb 2026, 15:22',
    }),
    activationState: 'activated',
    orderClass: 'repeat',
    orderClassLabel: 'Repeat customer',
    createdAtLabel: '22 Feb 2026, 15:00',
    updatedAtLabel: '16 Jul 2026, 08:05',
    health: {
      ordersThisMonth: 6,
      averageOrderValueLabel: '₹9,900',
      lastOrderDateLabel: '16 Jul 2026',
      lastPaymentStatus: 'PAID',
    },
    activation: buildActivationWorkflow('activated', {
      created: '22 Feb 2026, 15:00',
      invitation_sent: '22 Feb 2026, 15:08',
      activated: '22 Feb 2026, 15:22',
    }),
    orders: [
      {
        id: 'oc1',
        orderCode: 'GA-15B2',
        valueLabel: '₹9,450',
        fulfillmentLabel: 'Out for Delivery',
        fulfillmentStatus: 'OUT_FOR_DELIVERY',
        totalAmount: 9450,
        paymentStatus: 'PAID',
        placedAtLabel: '15 Jul 2026, 16:00',
      },
      {
        id: 'oc2',
        orderCode: 'GA-12R4',
        valueLabel: '₹6,300',
        fulfillmentLabel: 'Confirmed',
        fulfillmentStatus: 'CONFIRMED',
        totalAmount: 6300,
        paymentStatus: 'PARTIAL',
        placedAtLabel: '16 Jul 2026, 07:45',
      },
    ],
    payments: [
      {
        id: 'pc1',
        orderCode: 'GA-15B2',
        methodLabel: 'Pay Online',
        amountLabel: '₹9,450',
        status: 'PAID',
        atLabel: '15 Jul 2026, 16:05',
      },
      {
        id: 'pc2',
        orderCode: 'GA-12R4',
        methodLabel: 'Cash on Delivery',
        amountLabel: '₹6,300',
        status: 'PARTIAL',
        atLabel: '16 Jul 2026, 07:50',
      },
    ],
    addresses: [
      {
        id: 'ac1',
        label: 'Shop',
        text: 'Select Citywalk, Saket, New Delhi',
        isPrimary: true,
        serviceable: true,
      },
    ],
    activity: [
      {
        id: 'ac-act1',
        atLabel: '16 Jul 2026, 08:05',
        actorLabel: 'Driver',
        actionLabel: 'Out for Delivery',
        detail: 'GA-15B2 left Hub — Saket.',
      },
    ],
    documents: [],
  },
  'cust-new-invite': {
    id: 'cust-new-invite',
    shopName: 'Laxmi Stores',
    ownerName: 'Vikram Singh',
    phoneLabel: '+91 98XXX 99001',
    areaLabel: 'Karol Bagh',
    salesmanName: 'Rahul Mehta',
    preferredPayment: 'COD',
    status: 'active',
    ...fixtureDigital('app_link_sent', {
      mobile: '+919876543210',
      appLinkSentAt: '16 Jul 2026, 09:12',
    }),
    activationState: 'invitation_sent',
    orderClass: 'none',
    orderClassLabel: 'No orders yet',
    hasPendingInvitation: true,
    pendingInvitationExpiresAtLabel: '30 Jul 2026, 09:12',
    createdAtLabel: '16 Jul 2026, 09:00',
    updatedAtLabel: '16 Jul 2026, 09:12',
    health: {
      ordersThisMonth: 0,
      averageOrderValueLabel: '—',
      lastOrderDateLabel: '—',
      lastPaymentStatus: 'PENDING',
    },
    activation: buildActivationWorkflow('invitation_sent', {
      created: '16 Jul 2026, 09:00',
      invitation_sent: '16 Jul 2026, 09:12',
    }),
    orders: [],
    payments: [],
    addresses: [
      {
        id: 'an1',
        label: 'Shop',
        text: 'Ajmal Khan Road, Karol Bagh, New Delhi',
        isPrimary: true,
        serviceable: true,
      },
    ],
    activity: [
      {
        id: 'an-act1',
        atLabel: '16 Jul 2026, 09:12',
        actorLabel: 'Salesman',
        actionLabel: 'Send Invitation',
        detail: 'Activation invite sent to owner phone.',
      },
      {
        id: 'an-act2',
        atLabel: '16 Jul 2026, 09:00',
        actorLabel: 'Admin',
        actionLabel: 'Add Customer',
        detail: 'Shop created in retailer network.',
      },
    ],
    documents: [],
  },
  'cust-inactive': {
    id: 'cust-inactive',
    shopName: 'Old Town Nuts',
    ownerName: 'Farooq Ali',
    phoneLabel: '+91 98XXX 22110',
    areaLabel: 'Chandni Chowk',
    salesmanName: 'Aman Verma',
    preferredPayment: 'COD',
    status: 'inactive',
    ...fixtureDigital('access_disabled', {
      mobile: '+919811122207',
      isActive: false,
    }),
    activationState: 'activated',
    orderClass: 'repeat',
    orderClassLabel: 'Repeat customer',
    createdAtLabel: '05 Nov 2025, 11:00',
    updatedAtLabel: '04 Jun 2026, 16:00',
    health: {
      ordersThisMonth: 0,
      averageOrderValueLabel: '₹8,200',
      lastOrderDateLabel: '04 Jun 2026',
      lastPaymentStatus: 'PAID',
    },
    activation: buildActivationWorkflow('activated', {
      created: '05 Nov 2025, 11:00',
      invitation_sent: '05 Nov 2025, 11:10',
      activated: '05 Nov 2025, 11:30',
    }),
    orders: [
      {
        id: 'oi1',
        orderCode: 'GA-08Z3',
        valueLabel: '₹7,800',
        fulfillmentLabel: 'Delivered',
        fulfillmentStatus: 'DELIVERED',
        totalAmount: 7800,
        paymentStatus: 'PAID',
        placedAtLabel: '04 Jun 2026, 12:00',
      },
    ],
    payments: [
      {
        id: 'pi1',
        orderCode: 'GA-08Z3',
        methodLabel: 'Cash on Delivery',
        amountLabel: '₹7,800',
        status: 'PAID',
        atLabel: '05 Jun 2026, 14:00',
      },
    ],
    addresses: [
      {
        id: 'ai1',
        label: 'Shop',
        text: 'Khari Baoli approach, Chandni Chowk, New Delhi',
        isPrimary: true,
        serviceable: true,
      },
    ],
    activity: [
      {
        id: 'ai-act1',
        atLabel: '10 Jul 2026, 10:00',
        actorLabel: 'System',
        actionLabel: 'Marked Inactive',
        detail: 'No orders in 30+ days.',
      },
    ],
    documents: [],
  },
  'cust-blocked': {
    id: 'cust-blocked',
    shopName: 'Quick Mart',
    ownerName: 'Rohit Jain',
    phoneLabel: '+91 98XXX 44332',
    areaLabel: 'Lajpat Nagar',
    salesmanName: 'Priya Sharma',
    preferredPayment: 'Credit',
    status: 'inactive',
    ...fixtureDigital('access_disabled', {
      mobile: '+919811122208',
      isActive: false,
    }),
    activationState: 'activated',
    orderClass: 'repeat',
    orderClassLabel: 'Repeat customer',
    createdAtLabel: '14 Dec 2025, 09:00',
    updatedAtLabel: '28 Jun 2026, 11:00',
    health: {
      ordersThisMonth: 0,
      averageOrderValueLabel: '₹22,100',
      lastOrderDateLabel: '28 Jun 2026',
      lastPaymentStatus: 'UNPAID',
    },
    activation: buildActivationWorkflow('activated', {
      created: '14 Dec 2025, 09:00',
      invitation_sent: '14 Dec 2025, 09:15',
      activated: '14 Dec 2025, 09:45',
    }),
    orders: [
      {
        id: 'ob1',
        orderCode: 'GA-07B1',
        valueLabel: '₹19,400',
        fulfillmentLabel: 'Delivered',
        fulfillmentStatus: 'DELIVERED',
        totalAmount: 19400,
        paymentStatus: 'UNPAID',
        placedAtLabel: '28 Jun 2026, 10:00',
      },
    ],
    payments: [
      {
        id: 'pb1',
        orderCode: 'GA-07B1',
        methodLabel: 'Credit',
        amountLabel: '₹19,400',
        status: 'UNPAID',
        atLabel: '28 Jun 2026, 10:00',
      },
    ],
    addresses: [
      {
        id: 'ab1',
        label: 'Shop',
        text: 'Central Market, Lajpat Nagar, New Delhi',
        isPrimary: true,
        serviceable: true,
      },
    ],
    activity: [
      {
        id: 'ab-act1',
        atLabel: '28 Jun 2026, 11:00',
        actorLabel: 'Admin',
        actionLabel: 'Blocked',
        detail: 'Credit overdues exceeded policy threshold.',
      },
    ],
    documents: [
      {
        id: 'db1',
        name: 'Credit note history',
        typeLabel: 'Credit',
        statusLabel: 'Under review',
        uploadedAtLabel: '28 Jun 2026',
      },
    ],
  },
};

export function getCustomerDetailFixture(
  customerId: string,
): CustomerDetail | null {
  const raw = CUSTOMER_DETAIL_FIXTURES[customerId];
  return raw ? enrichCustomerDetail(raw) : null;
}
