import type {
  SalesmanBrowseState,
  SalesmanDetail,
  SalesmanListRow,
  SalesmenSnapshot,
} from './salesmen-types';

/**
 * Layout fixtures only — replace with Supabase salesman / coverage / visit queries.
 * Browse helpers are client-side for UI review until live APIs exist.
 */

export const EMPTY_SALESMAN_BROWSE: SalesmanBrowseState = {
  query: '',
  status: 'all',
  sort: 'name_az',
  page: 1,
  pageSize: 5,
};

export const SALESMAN_LIST_FIXTURE: SalesmanListRow[] = [
  {
    id: 'sm-priya',
    name: 'Priya Sharma',
    territory: 'Central Delhi',
    assignedCustomers: 18,
    ordersThisMonth: 42,
    collectionsLabel: '₹4.8L',
    status: 'active',
    updatedAtLabel: '16 Jul 2026, 10:22',
  },
  {
    id: 'sm-rahul',
    name: 'Rahul Mehta',
    territory: 'South Delhi',
    assignedCustomers: 14,
    ordersThisMonth: 31,
    collectionsLabel: '₹3.2L',
    status: 'active',
    updatedAtLabel: '16 Jul 2026, 09:55',
  },
  {
    id: 'sm-aman',
    name: 'Aman Verma',
    territory: 'Saket / NCR',
    assignedCustomers: 11,
    ordersThisMonth: 24,
    collectionsLabel: '₹2.1L',
    status: 'active',
    updatedAtLabel: '16 Jul 2026, 08:40',
  },
  {
    id: 'sm-neha',
    name: 'Neha Joshi',
    territory: 'West Delhi',
    assignedCustomers: 9,
    ordersThisMonth: 8,
    collectionsLabel: '₹0.9L',
    status: 'on_leave',
    updatedAtLabel: '14 Jul 2026, 18:00',
  },
  {
    id: 'sm-vikram',
    name: 'Vikram Singh',
    territory: 'East Delhi',
    assignedCustomers: 6,
    ordersThisMonth: 0,
    collectionsLabel: '₹0',
    status: 'inactive',
    updatedAtLabel: '01 Jun 2026, 12:00',
  },
  {
    id: 'sm-kavya',
    name: 'Kavya Iyer',
    territory: 'Gurugram',
    assignedCustomers: 12,
    ordersThisMonth: 19,
    collectionsLabel: '₹1.7L',
    status: 'active',
    updatedAtLabel: '15 Jul 2026, 17:10',
  },
];

export const SALESMEN_SNAPSHOT_FIXTURE: SalesmenSnapshot = {
  generatedAtLabel: 'Today · layout fixture',
  kpis: [
    {
      id: 'active',
      label: 'Active Salesmen',
      value: '4',
      hint: 'In field today',
      tone: 'positive',
    },
    {
      id: 'customers',
      label: 'Customers Assigned',
      value: '70',
      hint: 'Across territories',
    },
    {
      id: 'orders',
      label: 'Orders This Month',
      value: '124',
      hint: 'Assisted + self-serve tagged',
    },
    {
      id: 'new_customers',
      label: 'New Customers Added',
      value: '7',
      hint: 'This month',
    },
    {
      id: 'pending',
      label: 'Pending Activations',
      value: '5',
      hint: 'Invite / OTP open',
      tone: 'warning',
    },
    {
      id: 'visits',
      label: "Today's Visits",
      value: '16',
      hint: 'Planned across team',
    },
  ],
  rows: SALESMAN_LIST_FIXTURE,
  fieldToday: {
    workDate: '2026-10-03',
    startedCount: 3,
    notStartedCount: 1,
    absentCount: 0,
    onLeaveCount: 1,
    pendingExpenseClaims: 2,
    pendingReturnClaims: 1,
  },
  visitCoverage: {
    rangeLabel: 'Today',
    planned: 8,
    completed: 6,
    missed: 2,
    total: 16,
  },
};

export function browseSalesmen(
  rows: SalesmanListRow[],
  state: SalesmanBrowseState,
): { rows: SalesmanListRow[]; total: number; pageCount: number } {
  const q = state.query.trim().toLowerCase();
  let next = rows.filter((row) => {
    if (state.status !== 'all' && row.status !== state.status) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.territory.toLowerCase().includes(q)
    );
  });

  next = [...next].sort((a, b) => {
    switch (state.sort) {
      case 'orders_desc':
        return b.ordersThisMonth - a.ordersThisMonth || a.name.localeCompare(b.name);
      case 'customers_desc':
        return (
          b.assignedCustomers - a.assignedCustomers || a.name.localeCompare(b.name)
        );
      case 'updated_desc':
        return b.updatedAtLabel.localeCompare(a.updatedAtLabel);
      case 'name_az':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const total = next.length;
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * state.pageSize;
  return {
    rows: next.slice(start, start + state.pageSize),
    total,
    pageCount,
  };
}

const H4_EMPTY = {
  emailLabel: '—',
  employment: null,
  currentSalary: null,
  salaryHistory: [] as SalesmanDetail['salaryHistory'],
  attendance: [] as SalesmanDetail['attendance'],
  salaryMonth: null,
} satisfies Pick<
  SalesmanDetail,
  | 'emailLabel'
  | 'employment'
  | 'currentSalary'
  | 'salaryHistory'
  | 'attendance'
  | 'salaryMonth'
>;

export const SALESMAN_DETAIL_FIXTURES: Record<string, SalesmanDetail> = {
  'sm-priya': {
    ...H4_EMPTY,
    id: 'sm-priya',
    name: 'Priya Sharma',
    phoneLabel: '+91 98XXX 10011',
    emailLabel: 'priya.sharma@example.com',
    employeeId: 'EMP-SA-014',
    territory: 'Central Delhi',
    joiningDateLabel: '12 Jan 2025',
    status: 'active',
    assignedCustomersCount: 18,
    totalOrders: 286,
    updatedAtLabel: '16 Jul 2026, 10:22',
    assignedCustomers: [
      {
        id: 'cust-sharma',
        shopName: 'Sharma Kirana',
        areaLabel: 'Connaught Place',
        accountStatusLabel: 'Active',
        lastOrderLabel: 'GA-14K2 · Today',
        lastVisitLabel: 'Today, 09:10',
        activationStatus: 'activated',
        activationLabel: 'Activated',
      },
      {
        id: 'cust-mehta',
        shopName: 'Mehta Wholesale',
        areaLabel: 'Noida Sec 18',
        accountStatusLabel: 'Active',
        lastOrderLabel: 'GA-15A1 · Yesterday',
        lastVisitLabel: 'Yesterday, 16:40',
        activationStatus: 'activated',
        activationLabel: 'Activated',
      },
      {
        id: 'cust-blocked',
        shopName: 'Quick Mart',
        areaLabel: 'Lajpat Nagar',
        accountStatusLabel: 'Blocked',
        lastOrderLabel: 'GA-07B1 · 18 days ago',
        lastVisitLabel: '12 Jul 2026',
        activationStatus: 'activated',
        activationLabel: 'Activated',
      },
    ],
    orders: [
      {
        id: 'o1',
        orderCode: 'GA-14K2',
        customerName: 'Sharma Kirana',
        amountLabel: '₹24,850',
        statusLabel: 'Packing',
        dateLabel: '16 Jul 2026',
      },
      {
        id: 'o2',
        orderCode: 'GA-15A1',
        customerName: 'Mehta Wholesale',
        amountLabel: '₹41,600',
        statusLabel: 'Assigned to Route',
        dateLabel: '15 Jul 2026',
      },
      {
        id: 'o3',
        orderCode: 'GA-13P1',
        customerName: 'Sharma Kirana',
        amountLabel: '₹12,100',
        statusLabel: 'Delivered',
        dateLabel: '14 Jul 2026',
      },
    ],
    collections: {
      codCollectedLabel: '₹1.9L',
      onlinePaymentsLabel: '₹2.9L',
      pendingCollectionsLabel: '₹0.6L',
    },
    collectionHistory: [
      {
        id: 'c1',
        orderCode: 'GA-13P1',
        customerName: 'Sharma Kirana',
        methodLabel: 'Online',
        amountLabel: '₹12,100',
        statusLabel: 'Collected',
        atLabel: '14 Jul 2026, 11:05',
      },
      {
        id: 'c2',
        orderCode: 'GA-14K2',
        customerName: 'Sharma Kirana',
        methodLabel: 'COD',
        amountLabel: '₹24,850',
        statusLabel: 'Pending',
        atLabel: '16 Jul 2026, 08:40',
      },
    ],
    performance: {
      ordersThisMonth: 42,
      revenueGeneratedLabel: '₹7.6L',
      newCustomers: 3,
      repeatCustomers: 15,
      activationSuccessRateLabel: '92%',
      averageOrderValueLabel: '₹18,100',
    },
    visits: [
      {
        id: 'v1',
        shopName: 'Sharma Kirana',
        areaLabel: 'Connaught Place',
        plannedAtLabel: 'Today · 09:00',
        status: 'completed',
        note: 'Restock discussion',
      },
      {
        id: 'v2',
        shopName: 'Mehta Wholesale',
        areaLabel: 'Noida Sec 18',
        plannedAtLabel: 'Today · 14:00',
        status: 'planned',
      },
      {
        id: 'v3',
        shopName: 'Quick Mart',
        areaLabel: 'Lajpat Nagar',
        plannedAtLabel: 'Today · 11:30',
        status: 'missed',
        note: 'Owner unavailable',
      },
    ],
  },
  'sm-rahul': {
    ...H4_EMPTY,
    id: 'sm-rahul',
    name: 'Rahul Mehta',
    phoneLabel: '+91 98XXX 20022',
    emailLabel: 'rahul.mehta@example.com',
    employeeId: 'EMP-SA-021',
    territory: 'South Delhi',
    joiningDateLabel: '03 Mar 2025',
    status: 'active',
    assignedCustomersCount: 14,
    totalOrders: 198,
    updatedAtLabel: '16 Jul 2026, 09:55',
    assignedCustomers: [
      {
        id: 'cust-gupta',
        shopName: 'Gupta Traders',
        areaLabel: 'Saket',
        accountStatusLabel: 'Active',
        lastOrderLabel: 'GA-14M8 · Today',
        lastVisitLabel: 'Today, 08:20',
        activationStatus: 'activated',
        activationLabel: 'Activated',
      },
      {
        id: 'cust-new-invite',
        shopName: 'Laxmi Stores',
        areaLabel: 'Karol Bagh',
        accountStatusLabel: 'Awaiting Activation',
        lastOrderLabel: '—',
        lastVisitLabel: 'Today, 10:05',
        activationStatus: 'invitation_sent',
        activationLabel: 'Invitation Sent',
      },
    ],
    orders: [
      {
        id: 'or1',
        orderCode: 'GA-14M8',
        customerName: 'Gupta Traders',
        amountLabel: '₹18,200',
        statusLabel: 'Ready for Dispatch',
        dateLabel: '16 Jul 2026',
      },
    ],
    collections: {
      codCollectedLabel: '₹0.8L',
      onlinePaymentsLabel: '₹2.4L',
      pendingCollectionsLabel: '₹0.2L',
    },
    collectionHistory: [
      {
        id: 'cr1',
        orderCode: 'GA-14M8',
        customerName: 'Gupta Traders',
        methodLabel: 'Online',
        amountLabel: '₹18,200',
        statusLabel: 'Collected',
        atLabel: '16 Jul 2026, 07:20',
      },
    ],
    performance: {
      ordersThisMonth: 31,
      revenueGeneratedLabel: '₹5.1L',
      newCustomers: 2,
      repeatCustomers: 11,
      activationSuccessRateLabel: '88%',
      averageOrderValueLabel: '₹16,450',
    },
    visits: [
      {
        id: 'vr1',
        shopName: 'Gupta Traders',
        areaLabel: 'Saket',
        plannedAtLabel: 'Today · 08:00',
        status: 'completed',
      },
      {
        id: 'vr2',
        shopName: 'Laxmi Stores',
        areaLabel: 'Karol Bagh',
        plannedAtLabel: 'Today · 10:00',
        status: 'completed',
        note: 'Invitation follow-up',
      },
      {
        id: 'vr3',
        shopName: 'Green Basket',
        areaLabel: 'Hauz Khas',
        plannedAtLabel: 'Today · 16:00',
        status: 'planned',
      },
    ],
  },
  'sm-aman': {
    ...H4_EMPTY,
    id: 'sm-aman',
    name: 'Aman Verma',
    phoneLabel: '+91 98XXX 30033',
    emailLabel: 'aman.verma@example.com',
    employeeId: 'EMP-SA-033',
    territory: 'Saket / NCR',
    joiningDateLabel: '21 Jun 2025',
    status: 'active',
    assignedCustomersCount: 11,
    totalOrders: 142,
    updatedAtLabel: '16 Jul 2026, 08:40',
    assignedCustomers: [
      {
        id: 'cust-city',
        shopName: 'City Dry Fruits',
        areaLabel: 'Saket',
        accountStatusLabel: 'Active',
        lastOrderLabel: 'GA-15B2 · Today',
        lastVisitLabel: 'Yesterday, 15:00',
        activationStatus: 'activated',
        activationLabel: 'Activated',
      },
      {
        id: 'cust-inactive',
        shopName: 'Old Town Nuts',
        areaLabel: 'Chandni Chowk',
        accountStatusLabel: 'Inactive',
        lastOrderLabel: 'GA-08Z3 · 42 days ago',
        lastVisitLabel: '10 Jul 2026',
        activationStatus: 'activated',
        activationLabel: 'Activated',
      },
    ],
    orders: [
      {
        id: 'oa1',
        orderCode: 'GA-15B2',
        customerName: 'City Dry Fruits',
        amountLabel: '₹9,450',
        statusLabel: 'Out for Delivery',
        dateLabel: '15 Jul 2026',
      },
      {
        id: 'oa2',
        orderCode: 'GA-12R4',
        customerName: 'City Dry Fruits',
        amountLabel: '₹6,300',
        statusLabel: 'Confirmed',
        dateLabel: '16 Jul 2026',
      },
    ],
    collections: {
      codCollectedLabel: '₹0.4L',
      onlinePaymentsLabel: '₹1.7L',
      pendingCollectionsLabel: '₹0.3L',
    },
    collectionHistory: [
      {
        id: 'ca1',
        orderCode: 'GA-15B2',
        customerName: 'City Dry Fruits',
        methodLabel: 'Online',
        amountLabel: '₹9,450',
        statusLabel: 'Collected',
        atLabel: '15 Jul 2026, 16:05',
      },
    ],
    performance: {
      ordersThisMonth: 24,
      revenueGeneratedLabel: '₹3.4L',
      newCustomers: 1,
      repeatCustomers: 9,
      activationSuccessRateLabel: '85%',
      averageOrderValueLabel: '₹14,200',
    },
    visits: [
      {
        id: 'va1',
        shopName: 'City Dry Fruits',
        areaLabel: 'Saket',
        plannedAtLabel: 'Today · 12:00',
        status: 'planned',
      },
      {
        id: 'va2',
        shopName: 'Old Town Nuts',
        areaLabel: 'Chandni Chowk',
        plannedAtLabel: 'Today · 09:30',
        status: 'missed',
      },
    ],
  },
  'sm-neha': {
    ...H4_EMPTY,
    id: 'sm-neha',
    name: 'Neha Joshi',
    phoneLabel: '+91 98XXX 40044',
    emailLabel: 'neha.joshi@example.com',
    employeeId: 'EMP-SA-044',
    territory: 'West Delhi',
    joiningDateLabel: '08 Sep 2025',
    status: 'on_leave',
    assignedCustomersCount: 9,
    totalOrders: 76,
    updatedAtLabel: '14 Jul 2026, 18:00',
    assignedCustomers: [],
    orders: [],
    collections: {
      codCollectedLabel: '₹0.3L',
      onlinePaymentsLabel: '₹0.6L',
      pendingCollectionsLabel: '₹0.1L',
    },
    collectionHistory: [],
    performance: {
      ordersThisMonth: 8,
      revenueGeneratedLabel: '₹1.1L',
      newCustomers: 0,
      repeatCustomers: 7,
      activationSuccessRateLabel: '80%',
      averageOrderValueLabel: '₹13,750',
    },
    visits: [
      {
        id: 'vn1',
        shopName: 'Punjabi Store',
        areaLabel: 'Rajouri Garden',
        plannedAtLabel: 'Today · 11:00',
        status: 'missed',
        note: 'On leave',
      },
    ],
  },
  'sm-vikram': {
    ...H4_EMPTY,
    id: 'sm-vikram',
    name: 'Vikram Singh',
    phoneLabel: '+91 98XXX 50055',
    emailLabel: 'vikram.singh@example.com',
    employeeId: 'EMP-SA-055',
    territory: 'East Delhi',
    joiningDateLabel: '19 Feb 2024',
    status: 'inactive',
    assignedCustomersCount: 6,
    totalOrders: 54,
    updatedAtLabel: '01 Jun 2026, 12:00',
    assignedCustomers: [],
    orders: [],
    collections: {
      codCollectedLabel: '₹0',
      onlinePaymentsLabel: '₹0',
      pendingCollectionsLabel: '₹0',
    },
    collectionHistory: [],
    performance: {
      ordersThisMonth: 0,
      revenueGeneratedLabel: '₹0',
      newCustomers: 0,
      repeatCustomers: 0,
      activationSuccessRateLabel: '—',
      averageOrderValueLabel: '—',
    },
    visits: [],
  },
  'sm-kavya': {
    ...H4_EMPTY,
    id: 'sm-kavya',
    name: 'Kavya Iyer',
    phoneLabel: '+91 98XXX 60066',
    emailLabel: 'kavya.iyer@example.com',
    employeeId: 'EMP-SA-066',
    territory: 'Gurugram',
    joiningDateLabel: '11 Nov 2025',
    status: 'active',
    assignedCustomersCount: 12,
    totalOrders: 97,
    updatedAtLabel: '15 Jul 2026, 17:10',
    assignedCustomers: [
      {
        id: 'cust-ggn-1',
        shopName: 'Cyber Hub Mart',
        areaLabel: 'Gurugram',
        accountStatusLabel: 'Active',
        lastOrderLabel: 'GA-11G2 · 3 days ago',
        lastVisitLabel: '15 Jul 2026',
        activationStatus: 'activated',
        activationLabel: 'Activated',
      },
    ],
    orders: [
      {
        id: 'ok1',
        orderCode: 'GA-11G2',
        customerName: 'Cyber Hub Mart',
        amountLabel: '₹15,600',
        statusLabel: 'Delivered',
        dateLabel: '13 Jul 2026',
      },
    ],
    collections: {
      codCollectedLabel: '₹0.5L',
      onlinePaymentsLabel: '₹1.2L',
      pendingCollectionsLabel: '₹0.1L',
    },
    collectionHistory: [
      {
        id: 'ck1',
        orderCode: 'GA-11G2',
        customerName: 'Cyber Hub Mart',
        methodLabel: 'Online',
        amountLabel: '₹15,600',
        statusLabel: 'Collected',
        atLabel: '13 Jul 2026, 18:00',
      },
    ],
    performance: {
      ordersThisMonth: 19,
      revenueGeneratedLabel: '₹2.8L',
      newCustomers: 1,
      repeatCustomers: 10,
      activationSuccessRateLabel: '90%',
      averageOrderValueLabel: '₹14,700',
    },
    visits: [
      {
        id: 'vk1',
        shopName: 'Cyber Hub Mart',
        areaLabel: 'Gurugram',
        plannedAtLabel: 'Today · 15:00',
        status: 'planned',
      },
    ],
  },
};

export function getSalesmanDetailFixture(
  salesmanId: string,
): SalesmanDetail | null {
  return SALESMAN_DETAIL_FIXTURES[salesmanId] ?? null;
}
