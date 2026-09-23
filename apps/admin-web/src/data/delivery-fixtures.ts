import type {
  DeliveryBrowseState,
  DeliveryRouteDetail,
  DeliveryRouteListRow,
  DeliverySnapshot,
} from './delivery-types';

/**
 * Layout fixtures only — replace with Supabase route / vehicle / stop queries.
 * Browse helpers are client-side for UI review until live APIs exist.
 */

export const EMPTY_DELIVERY_BROWSE: DeliveryBrowseState = {
  query: '',
  status: 'all',
  sort: 'updated_desc',
  page: 1,
  pageSize: 5,
};

export const DELIVERY_ROUTE_LIST_FIXTURE: DeliveryRouteListRow[] = [
  {
    id: 'rt-d14',
    routeCode: 'RT-D14',
    driverName: 'Suresh Yadav',
    vehicleLabel: 'DL-01-AB-4421',
    deliveryArea: 'Central Delhi',
    ordersAssigned: 12,
    codAmountLabel: '₹1.4L',
    status: 'running',
    updatedAtLabel: '16 Jul 2026, 14:20',
  },
  {
    id: 'rt-s08',
    routeCode: 'RT-S08',
    driverName: 'Imran Khan',
    vehicleLabel: 'DL-03-CD-1188',
    deliveryArea: 'South Delhi',
    ordersAssigned: 9,
    codAmountLabel: '₹0.9L',
    status: 'loading',
    updatedAtLabel: '16 Jul 2026, 13:55',
  },
  {
    id: 'rt-w03',
    routeCode: 'RT-W03',
    driverName: 'Ravi Kumar',
    vehicleLabel: 'DL-07-EF-9902',
    deliveryArea: 'West Delhi',
    ordersAssigned: 7,
    codAmountLabel: '₹0.6L',
    status: 'planned',
    updatedAtLabel: '16 Jul 2026, 11:10',
  },
  {
    id: 'rt-e11',
    routeCode: 'RT-E11',
    driverName: 'Deepak Singh',
    vehicleLabel: 'DL-09-GH-3310',
    deliveryArea: 'East Delhi',
    ordersAssigned: 14,
    codAmountLabel: '₹1.1L',
    status: 'completed',
    updatedAtLabel: '15 Jul 2026, 19:40',
  },
  {
    id: 'rt-n02',
    routeCode: 'RT-N02',
    driverName: 'Ajay Pal',
    vehicleLabel: 'DL-05-IJ-7744',
    deliveryArea: 'North Delhi',
    ordersAssigned: 5,
    codAmountLabel: '₹0.3L',
    status: 'cancelled',
    updatedAtLabel: '15 Jul 2026, 08:15',
  },
  {
    id: 'rt-g05',
    routeCode: 'RT-G05',
    driverName: 'Manoj Tiwari',
    vehicleLabel: 'HR-26-KL-2201',
    deliveryArea: 'Gurugram',
    ordersAssigned: 10,
    codAmountLabel: '₹0.8L',
    status: 'running',
    updatedAtLabel: '16 Jul 2026, 12:05',
  },
];

export const DELIVERY_SNAPSHOT_FIXTURE: DeliverySnapshot = {
  generatedAtLabel: 'Today · layout fixture',
  kpis: [
    {
      id: 'active_routes',
      label: 'Active Routes',
      value: '3',
      hint: 'Loading + running',
      tone: 'positive',
    },
    {
      id: 'vehicles',
      label: 'Vehicles Running',
      value: '2',
      hint: 'On last-mile',
    },
    {
      id: 'ofd',
      label: 'Orders Out For Delivery',
      value: '22',
      hint: 'On active routes',
    },
    {
      id: 'completed',
      label: 'Deliveries Completed',
      value: '38',
      hint: 'Today',
      tone: 'positive',
    },
    {
      id: 'pending_cod',
      label: 'Pending COD Collections',
      value: '₹2.1L',
      hint: 'Across open routes',
      tone: 'warning',
    },
    {
      id: 'failed',
      label: 'Failed Deliveries',
      value: '3',
      hint: 'Need follow-up',
      tone: 'danger',
    },
  ],
  rows: DELIVERY_ROUTE_LIST_FIXTURE,
};

export function browseDeliveryRoutes(
  rows: DeliveryRouteListRow[],
  state: DeliveryBrowseState,
): { rows: DeliveryRouteListRow[]; total: number; pageCount: number } {
  const q = state.query.trim().toLowerCase();
  let next = rows.filter((row) => {
    if (state.status !== 'all' && row.status !== state.status) return false;
    if (!q) return true;
    return (
      row.routeCode.toLowerCase().includes(q) ||
      row.driverName.toLowerCase().includes(q) ||
      row.vehicleLabel.toLowerCase().includes(q) ||
      row.deliveryArea.toLowerCase().includes(q)
    );
  });

  next = [...next].sort((a, b) => {
    switch (state.sort) {
      case 'orders_desc':
        return (
          b.ordersAssigned - a.ordersAssigned ||
          a.routeCode.localeCompare(b.routeCode)
        );
      case 'cod_desc':
        return b.codAmountLabel.localeCompare(a.codAmountLabel);
      case 'updated_desc':
        return b.updatedAtLabel.localeCompare(a.updatedAtLabel);
      case 'route_az':
      default:
        return a.routeCode.localeCompare(b.routeCode);
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

export const DELIVERY_ROUTE_DETAIL_FIXTURES: Record<string, DeliveryRouteDetail> =
  {
    'rt-d14': {
      id: 'rt-d14',
      routeCode: 'RT-D14',
      routeNumberLabel: 'RT-D14 · Wave 2',
      serviceAreaId: 'area-central',
      assignedDeliveryProfileId: 'drv-suresh',
      driverName: 'Suresh Yadav',
      vehicleLabel: 'DL-01-AB-4421',
      warehouseName: 'Okhla DC',
      deliveryArea: 'Central Delhi',
      departureTimeLabel: '16 Jul 2026, 10:15',
      expectedCompletionLabel: '16 Jul 2026, 16:30',
      status: 'running',
      updatedAtLabel: '16 Jul 2026, 14:20',
      assignedOrders: [
        {
          id: 'o1',
          orderId: 'o1',
          orderCode: 'GA-14K2',
          customerName: 'Sharma Kirana',
          areaLabel: 'Connaught Place',
          amountLabel: '₹24,850',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'delivered',
          deliveryStatusLabel: 'Delivered',
        },
        {
          id: 'o2',
          orderId: 'o2',
          orderCode: 'GA-15A1',
          customerName: 'Mehta Wholesale',
          areaLabel: 'Noida Sec 18',
          amountLabel: '₹41,600',
          paymentTypeLabel: 'Online',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'out_for_delivery',
          deliveryStatusLabel: 'Out for Delivery',
        },
        {
          id: 'o3',
          orderId: 'o3',
          orderCode: 'GA-13P1',
          customerName: 'Quick Mart',
          areaLabel: 'Lajpat Nagar',
          amountLabel: '₹12,100',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'failed',
          deliveryStatusLabel: 'Failed',
        },
        {
          id: 'o4',
          orderId: 'o4',
          orderCode: 'GA-12R4',
          customerName: 'City Dry Fruits',
          areaLabel: 'Karol Bagh',
          amountLabel: '₹9,450',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'pending',
          deliveryStatusLabel: 'Pending',
        },
      ],
      timeline: [
        {
          id: 'route_created',
          label: 'Route Created',
          atLabel: '16 Jul · 08:40',
          state: 'done',
        },
        {
          id: 'route_started',
          label: 'Route Started',
          atLabel: '16 Jul · 09:55',
          state: 'done',
        },
        {
          id: 'stop-mock',
          label: 'Stop events',
          atLabel: '16 Jul · 10:15',
          state: 'done',
        },
        {
          id: 'delivering',
          label: 'Delivering',
          atLabel: 'In progress',
          state: 'current',
          note: '8 of 12 stops complete',
        },
        {
          id: 'route_completed',
          label: 'Route Completed',
          state: 'upcoming',
        },
      ],
      collections: {
        codExpectedLabel: '₹1.4L',
        codCollectedLabel: '₹0.9L',
        pendingCollectionLabel: '₹0.5L',
      },
      collectionHistory: [
        {
          id: 'c1',
          orderCode: 'GA-14K2',
          customerName: 'Sharma Kirana',
          amountLabel: '₹24,850',
          statusLabel: 'Collected',
          atLabel: '16 Jul 2026, 11:20',
        },
        {
          id: 'c2',
          orderCode: 'GA-13P1',
          customerName: 'Quick Mart',
          amountLabel: '₹12,100',
          statusLabel: 'Pending',
          atLabel: '16 Jul 2026, 12:05',
        },
      ],
      performance: {
        ordersDelivered: 8,
        deliverySuccessRateLabel: '89%',
        averageDeliveryTimeLabel: '28 min',
        failedDeliveries: 1,
        customerRatingLabel: '—',
      },
      vehicle: {
        vehicleNumber: 'DL-01-AB-4421',
        driverName: 'Suresh Yadav',
        capacityLabel: '1.5T · 24 crates',
        status: 'running',
        statusLabel: 'Running',
      },
    },
    'rt-s08': {
      id: 'rt-s08',
      routeCode: 'RT-S08',
      routeNumberLabel: 'RT-S08 · Wave 2',
      serviceAreaId: 'area-south',
      assignedDeliveryProfileId: 'drv-imran',
      driverName: 'Imran Khan',
      vehicleLabel: 'DL-03-CD-1188',
      warehouseName: 'Okhla DC',
      deliveryArea: 'South Delhi',
      departureTimeLabel: 'Pending load',
      expectedCompletionLabel: '16 Jul 2026, 17:00',
      status: 'loading',
      updatedAtLabel: '16 Jul 2026, 13:55',
      assignedOrders: [
        {
          id: 'os1',
          orderId: 'os1',
          orderCode: 'GA-14M8',
          customerName: 'Gupta Traders',
          areaLabel: 'Saket',
          amountLabel: '₹18,200',
          paymentTypeLabel: 'Online',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'pending',
          deliveryStatusLabel: 'Pending',
        },
        {
          id: 'os2',
          orderId: 'os2',
          orderCode: 'GA-15B2',
          customerName: 'Green Basket',
          areaLabel: 'Hauz Khas',
          amountLabel: '₹7,800',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'pending',
          deliveryStatusLabel: 'Pending',
        },
      ],
      timeline: [
        {
          id: 'route_created',
          label: 'Route Created',
          atLabel: '16 Jul · 11:20',
          state: 'done',
        },
        {
          id: 'route_started',
          label: 'Route Started',
          atLabel: 'In progress',
          state: 'current',
          note: 'Bay 3 · packing dock',
        },
        {
          id: 'stop-mock',
          label: 'Stop events',
          state: 'upcoming',
        },
        {
          id: 'delivering',
          label: 'Delivering',
          state: 'upcoming',
        },
        {
          id: 'route_completed',
          label: 'Route Completed',
          state: 'upcoming',
        },
      ],
      collections: {
        codExpectedLabel: '₹0.9L',
        codCollectedLabel: '₹0',
        pendingCollectionLabel: '₹0.9L',
      },
      collectionHistory: [],
      performance: {
        ordersDelivered: 0,
        deliverySuccessRateLabel: '—',
        averageDeliveryTimeLabel: '—',
        failedDeliveries: 0,
        customerRatingLabel: '—',
      },
      vehicle: {
        vehicleNumber: 'DL-03-CD-1188',
        driverName: 'Imran Khan',
        capacityLabel: '1.2T · 18 crates',
        status: 'loading',
        statusLabel: 'Loading',
      },
    },
    'rt-w03': {
      id: 'rt-w03',
      routeCode: 'RT-W03',
      routeNumberLabel: 'RT-W03 · Wave 3',
      serviceAreaId: 'area-west',
      assignedDeliveryProfileId: 'drv-ravi',
      driverName: 'Ravi Kumar',
      vehicleLabel: 'DL-07-EF-9902',
      warehouseName: 'Okhla DC',
      deliveryArea: 'West Delhi',
      departureTimeLabel: 'Scheduled 15:00',
      expectedCompletionLabel: '16 Jul 2026, 19:00',
      status: 'planned',
      updatedAtLabel: '16 Jul 2026, 11:10',
      assignedOrders: [
        {
          id: 'ow1',
          orderId: 'ow1',
          orderCode: 'GA-11G2',
          customerName: 'Punjabi Store',
          areaLabel: 'Rajouri Garden',
          amountLabel: '₹15,600',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'pending',
          deliveryStatusLabel: 'Pending',
        },
      ],
      timeline: [
        {
          id: 'route_created',
          label: 'Route Created',
          atLabel: '16 Jul · 11:10',
          state: 'done',
        },
        {
          id: 'route_started',
          label: 'Route Started',
          state: 'upcoming',
        },
        {
          id: 'stop-mock',
          label: 'Stop events',
          state: 'upcoming',
        },
        {
          id: 'delivering',
          label: 'Delivering',
          state: 'upcoming',
        },
        {
          id: 'route_completed',
          label: 'Route Completed',
          state: 'upcoming',
        },
      ],
      collections: {
        codExpectedLabel: '₹0.6L',
        codCollectedLabel: '₹0',
        pendingCollectionLabel: '₹0.6L',
      },
      collectionHistory: [],
      performance: {
        ordersDelivered: 0,
        deliverySuccessRateLabel: '—',
        averageDeliveryTimeLabel: '—',
        failedDeliveries: 0,
        customerRatingLabel: '—',
      },
      vehicle: {
        vehicleNumber: 'DL-07-EF-9902',
        driverName: 'Ravi Kumar',
        capacityLabel: '1.0T · 16 crates',
        status: 'idle',
        statusLabel: 'Idle',
      },
    },
    'rt-e11': {
      id: 'rt-e11',
      routeCode: 'RT-E11',
      routeNumberLabel: 'RT-E11 · Wave 1',
      serviceAreaId: 'area-east',
      assignedDeliveryProfileId: 'drv-deepak',
      driverName: 'Deepak Singh',
      vehicleLabel: 'DL-09-GH-3310',
      warehouseName: 'Okhla DC',
      deliveryArea: 'East Delhi',
      departureTimeLabel: '15 Jul 2026, 09:00',
      expectedCompletionLabel: '15 Jul 2026, 18:30',
      status: 'completed',
      updatedAtLabel: '15 Jul 2026, 19:40',
      assignedOrders: [
        {
          id: 'oe1',
          orderId: 'oe1',
          orderCode: 'GA-10E1',
          customerName: 'Laxmi Stores',
          areaLabel: 'Laxmi Nagar',
          amountLabel: '₹22,400',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'delivered',
          deliveryStatusLabel: 'Delivered',
        },
        {
          id: 'oe2',
          orderId: 'oe2',
          orderCode: 'GA-10E2',
          customerName: 'East End Mart',
          areaLabel: 'Mayur Vihar',
          amountLabel: '₹8,900',
          paymentTypeLabel: 'Online',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'delivered',
          deliveryStatusLabel: 'Delivered',
        },
        {
          id: 'oe3',
          orderId: 'oe3',
          orderCode: 'GA-10E3',
          customerName: 'Old Town Nuts',
          areaLabel: 'Shahdara',
          amountLabel: '₹5,200',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'skipped',
          deliveryStatusLabel: 'Skipped',
        },
      ],
      timeline: [
        {
          id: 'route_created',
          label: 'Route Created',
          atLabel: '15 Jul · 07:30',
          state: 'done',
        },
        {
          id: 'route_started',
          label: 'Route Started',
          atLabel: '15 Jul · 08:40',
          state: 'done',
        },
        {
          id: 'stop-mock',
          label: 'Stop events',
          atLabel: '15 Jul · 09:00',
          state: 'done',
        },
        {
          id: 'delivering',
          label: 'Delivering',
          atLabel: '15 Jul · 09:20–18:10',
          state: 'done',
        },
        {
          id: 'route_completed',
          label: 'Route Completed',
          atLabel: '15 Jul · 19:40',
          state: 'done',
        },
      ],
      collections: {
        codExpectedLabel: '₹1.1L',
        codCollectedLabel: '₹1.05L',
        pendingCollectionLabel: '₹0.05L',
      },
      collectionHistory: [
        {
          id: 'ce1',
          orderCode: 'GA-10E1',
          customerName: 'Laxmi Stores',
          amountLabel: '₹22,400',
          statusLabel: 'Collected',
          atLabel: '15 Jul 2026, 11:05',
        },
        {
          id: 'ce2',
          orderCode: 'GA-10E3',
          customerName: 'Old Town Nuts',
          amountLabel: '₹5,200',
          statusLabel: 'Skipped',
          atLabel: '15 Jul 2026, 14:20',
        },
      ],
      performance: {
        ordersDelivered: 13,
        deliverySuccessRateLabel: '93%',
        averageDeliveryTimeLabel: '24 min',
        failedDeliveries: 0,
        customerRatingLabel: '—',
      },
      vehicle: {
        vehicleNumber: 'DL-09-GH-3310',
        driverName: 'Deepak Singh',
        capacityLabel: '1.5T · 24 crates',
        status: 'idle',
        statusLabel: 'Idle',
      },
    },
    'rt-n02': {
      id: 'rt-n02',
      routeCode: 'RT-N02',
      routeNumberLabel: 'RT-N02 · Wave 1',
      serviceAreaId: 'area-north',
      assignedDeliveryProfileId: 'drv-ajay',
      driverName: 'Ajay Pal',
      vehicleLabel: 'DL-05-IJ-7744',
      warehouseName: 'Okhla DC',
      deliveryArea: 'North Delhi',
      departureTimeLabel: '—',
      expectedCompletionLabel: '—',
      status: 'cancelled',
      updatedAtLabel: '15 Jul 2026, 08:15',
      assignedOrders: [],
      timeline: [
        {
          id: 'route_created',
          label: 'Route Created',
          atLabel: '15 Jul · 07:00',
          state: 'done',
        },
        {
          id: 'route_started',
          label: 'Route Started',
          state: 'skipped',
        },
        {
          id: 'stop-mock',
          label: 'Stop events',
          state: 'skipped',
        },
        {
          id: 'delivering',
          label: 'Delivering',
          state: 'skipped',
        },
        {
          id: 'route_completed',
          label: 'Route Completed',
          atLabel: '15 Jul · 08:15',
          state: 'skipped',
          note: 'Vehicle unavailable',
        },
      ],
      collections: {
        codExpectedLabel: '₹0.3L',
        codCollectedLabel: '₹0',
        pendingCollectionLabel: '₹0',
      },
      collectionHistory: [],
      performance: {
        ordersDelivered: 0,
        deliverySuccessRateLabel: '—',
        averageDeliveryTimeLabel: '—',
        failedDeliveries: 0,
        customerRatingLabel: '—',
      },
      vehicle: {
        vehicleNumber: 'DL-05-IJ-7744',
        driverName: 'Ajay Pal',
        capacityLabel: '1.0T · 14 crates',
        status: 'maintenance',
        statusLabel: 'Maintenance',
      },
    },
    'rt-g05': {
      id: 'rt-g05',
      routeCode: 'RT-G05',
      routeNumberLabel: 'RT-G05 · Wave 2',
      serviceAreaId: 'area-gurgaon',
      assignedDeliveryProfileId: 'drv-manoj',
      driverName: 'Manoj Tiwari',
      vehicleLabel: 'HR-26-KL-2201',
      warehouseName: 'Okhla DC',
      deliveryArea: 'Gurugram',
      departureTimeLabel: '16 Jul 2026, 09:30',
      expectedCompletionLabel: '16 Jul 2026, 17:30',
      status: 'running',
      updatedAtLabel: '16 Jul 2026, 12:05',
      assignedOrders: [
        {
          id: 'og1',
          orderId: 'og1',
          orderCode: 'GA-11G2',
          customerName: 'Cyber Hub Mart',
          areaLabel: 'Gurugram',
          amountLabel: '₹15,600',
          paymentTypeLabel: 'Online',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'delivered',
          deliveryStatusLabel: 'Delivered',
        },
        {
          id: 'og2',
          orderId: 'og2',
          orderCode: 'GA-11G5',
          customerName: 'Sector 29 Store',
          areaLabel: 'Gurugram',
          amountLabel: '₹11,200',
          paymentTypeLabel: 'COD',
          codCollectable: false,
          codSuggestedAmount: null,
          deliveryStatus: 'out_for_delivery',
          deliveryStatusLabel: 'Out for Delivery',
        },
      ],
      timeline: [
        {
          id: 'route_created',
          label: 'Route Created',
          atLabel: '16 Jul · 07:50',
          state: 'done',
        },
        {
          id: 'route_started',
          label: 'Route Started',
          atLabel: '16 Jul · 09:05',
          state: 'done',
        },
        {
          id: 'stop-mock',
          label: 'Stop events',
          atLabel: '16 Jul · 09:30',
          state: 'done',
        },
        {
          id: 'delivering',
          label: 'Delivering',
          atLabel: 'In progress',
          state: 'current',
        },
        {
          id: 'route_completed',
          label: 'Route Completed',
          state: 'upcoming',
        },
      ],
      collections: {
        codExpectedLabel: '₹0.8L',
        codCollectedLabel: '₹0.4L',
        pendingCollectionLabel: '₹0.4L',
      },
      collectionHistory: [
        {
          id: 'cg1',
          orderCode: 'GA-11G2',
          customerName: 'Cyber Hub Mart',
          amountLabel: '₹15,600',
          statusLabel: 'Online settled',
          atLabel: '16 Jul 2026, 10:40',
        },
      ],
      performance: {
        ordersDelivered: 4,
        deliverySuccessRateLabel: '100%',
        averageDeliveryTimeLabel: '32 min',
        failedDeliveries: 0,
        customerRatingLabel: '—',
      },
      vehicle: {
        vehicleNumber: 'HR-26-KL-2201',
        driverName: 'Manoj Tiwari',
        capacityLabel: '1.2T · 20 crates',
        status: 'running',
        statusLabel: 'Running',
      },
    },
  };

export function getDeliveryRouteDetailFixture(
  routeId: string,
): DeliveryRouteDetail | null {
  return DELIVERY_ROUTE_DETAIL_FIXTURES[routeId] ?? null;
}
