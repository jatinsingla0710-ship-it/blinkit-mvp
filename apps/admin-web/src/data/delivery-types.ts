/**
 * Delivery Management view models (H1–H5).
 * Last-mile wholesale delivery operations.
 */

export type RouteStatus =
  | 'planned'
  | 'loading'
  | 'running'
  | 'completed'
  | 'cancelled';

export type RouteTimelineStageId = string;

export type TimelineStageState = 'done' | 'current' | 'upcoming' | 'skipped';

/**
 * Admin stop badge / assigned-order status.
 * Live path maps public.route_stop_status via mapDbRouteStopStatusToUi:
 *   PENDING → pending, IN_PROGRESS → in_progress, COMPLETED → delivered,
 *   FAILED → failed, SKIPPED → skipped.
 * `out_for_delivery` remains for mock fixtures only (not a DB stop status).
 */
export type StopDeliveryStatus =
  | 'pending'
  | 'in_progress'
  | 'out_for_delivery'
  | 'delivered'
  | 'skipped'
  | 'failed';

/** UI vehicle status — maps from DB vehicle_status. */
export type VehicleStatus =
  | 'available'
  | 'assigned'
  | 'on_route'
  | 'maintenance'
  | 'unavailable'
  /** @deprecated Prefer available|assigned|on_route — kept for older fixtures */
  | 'idle'
  | 'loading'
  | 'running';

export type DeliveryEmploymentStatusVm = 'ACTIVE' | 'INACTIVE';
export type DeliveryOperationalStatusVm =
  | 'AVAILABLE'
  | 'ON_ROUTE'
  | 'OFF_DUTY'
  | 'UNAVAILABLE';

export type DeliverySortId =
  | 'route_az'
  | 'orders_desc'
  | 'cod_desc'
  | 'updated_desc';

export interface DeliveryDashboardKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export interface DeliveryRouteListRow {
  id: string;
  routeCode: string;
  driverName: string;
  vehicleLabel: string;
  deliveryArea: string;
  ordersAssigned: number;
  codAmountLabel: string;
  status: RouteStatus;
  updatedAtLabel: string;
}

export interface DeliveryBrowseState {
  query: string;
  status: 'all' | RouteStatus;
  sort: DeliverySortId;
  page: number;
  pageSize: number;
}

export interface DeliveryAssignedOrder {
  /** route_stops.id */
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  areaLabel: string;
  amountLabel: string;
  paymentTypeLabel: string;
  /** PAY_ON_DELIVERY (or on-delivery method) and not yet PAID. */
  codCollectable: boolean;
  /** Suggested amount from payments.amount when collectable. */
  codSuggestedAmount: number | null;
  deliveryStatus: StopDeliveryStatus;
  deliveryStatusLabel: string;
}

export interface DeliveryRouteDetail {
  id: string;
  routeCode: string;
  routeNumberLabel: string;
  serviceAreaId: string;
  assignedDeliveryProfileId: string | null;
  driverName: string;
  vehicleLabel: string;
  warehouseName: string;
  deliveryArea: string;
  departureTimeLabel: string;
  expectedCompletionLabel: string;
  status: RouteStatus;
  updatedAtLabel: string;
  assignedOrders: DeliveryAssignedOrder[];
  timeline: DeliveryTimelineStage[];
  collections: DeliveryCollectionSummary;
  collectionHistory: DeliveryCollectionRow[];
  performance: DeliveryPerformance;
  vehicle: DeliveryVehicleInfo;
  /** H5: linked vehicle id when set */
  vehicleId?: string | null;
  timeSlotId?: string | null;
  timeSlotLabel?: string | null;
  routeDate?: string | null;
}

export type DeliveryAssignableOrder = {
  id: string;
  orderCode: string;
  customerName: string;
  amountLabel: string;
  statusLabel: string;
};

export interface DeliveryTimelineStage {
  id: RouteTimelineStageId;
  label: string;
  atLabel?: string;
  state: TimelineStageState;
  note?: string;
}

export interface DeliveryCollectionSummary {
  codExpectedLabel: string;
  codCollectedLabel: string;
  pendingCollectionLabel: string;
  /** H5 custody with drivers (route-scoped when on detail). */
  withDriversLabel?: string;
  settledLabel?: string;
}

export interface DeliveryCollectionRow {
  id: string;
  orderCode: string;
  customerName: string;
  amountLabel: string;
  statusLabel: string;
  atLabel: string;
}

export interface DeliveryPerformance {
  ordersDelivered: number;
  deliverySuccessRateLabel: string;
  averageDeliveryTimeLabel: string;
  failedDeliveries: number;
  customerRatingLabel: string;
}

export interface DeliveryVehicleInfo {
  vehicleNumber: string;
  driverName: string;
  capacityLabel: string;
  status: VehicleStatus;
  statusLabel: string;
}

export interface DeliverySnapshot {
  generatedAtLabel: string;
  kpis: DeliveryDashboardKpi[];
  rows: DeliveryRouteListRow[];
}

// ─── Delivery H5 ops types ───────────────────────────────────────────────────

export interface DeliveryBoyListRow {
  id: string;
  name: string;
  mobileLabel: string;
  emailLabel: string;
  employmentStatus: DeliveryEmploymentStatusVm;
  operationalStatus: DeliveryOperationalStatusVm;
  serviceAreaLabel: string;
  currentRouteLabel: string | null;
  vehicleLabel: string | null;
  isActive: boolean;
  updatedAtLabel: string;
}

export interface DeliveryBoyDetail {
  id: string;
  name: string;
  mobile: string;
  email: string;
  isActive: boolean;
  joiningDate: string | null;
  employmentStatus: DeliveryEmploymentStatusVm;
  operationalStatus: DeliveryOperationalStatusVm;
  address: string | null;
  contactEmail: string | null;
  idProofType: 'AADHAAR' | 'PAN' | 'OTHER' | null;
  idProofNumber: string | null;
  primaryServiceAreaId: string | null;
  serviceAreaLabel: string;
  currentRouteId: string | null;
  currentRouteLabel: string | null;
  vehicleId: string | null;
  vehicleLabel: string | null;
  updatedAtLabel: string;
}

export interface DeliveryBoysSnapshot {
  generatedAtLabel: string;
  kpis: DeliveryDashboardKpi[];
  rows: DeliveryBoyListRow[];
}

export interface VehicleListRow {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  capacityLabel: string;
  status: VehicleStatus;
  statusLabel: string;
  isActive: boolean;
  assignedDriverName: string | null;
  assignedDriverId: string | null;
  notes: string | null;
  updatedAtLabel: string;
}

export interface ReadyQueueOrder {
  id: string;
  orderCode: string;
  customerName: string;
  serviceAreaId: string;
  serviceAreaLabel: string;
  amountLabel: string;
  statusLabel: string;
  packedAtLabel: string;
}

export type DeliveryExceptionCategoryVm =
  | 'DRIVER'
  | 'VEHICLE'
  | 'WAREHOUSE_ORDER'
  | 'EXTERNAL'
  | 'CUSTOMER';

export type DeliveryExceptionActionVm =
  | 'RESUME'
  | 'REPLACE_DRIVER'
  | 'REPLACE_VEHICLE'
  | 'RESCHEDULE_ROUTE'
  | 'CANCEL_ATTEMPT';

export interface DeliveryExceptionRow {
  id: string;
  category: DeliveryExceptionCategoryVm;
  reasonCode: string;
  reasonNote: string | null;
  status: 'OPEN' | 'RESOLVED' | 'CANCELLED';
  routeId: string | null;
  routeLabel: string | null;
  orderId: string | null;
  orderCode: string | null;
  actionTaken: DeliveryExceptionActionVm | null;
  createdAtLabel: string;
  resolvedAtLabel: string | null;
}

export interface DeliveryOpsDashboard {
  generatedAtLabel: string;
  date: string;
  routesToday: number;
  ordersToday: number;
  delivered: number;
  outForDelivery: number;
  pending: number;
  failed: number;
  codExpected: number;
  codCollected: number;
  codWithDrivers: number;
  codSettled: number;
  kpis: DeliveryDashboardKpi[];
}

export interface DeliveryScheduleEvent {
  id: string;
  kind: 'SCHEDULED' | 'RESCHEDULED' | 'DELAYED';
  deliveryDate: string;
  timeSlotLabel: string | null;
  driverName: string | null;
  vehicleLabel: string | null;
  reason: string | null;
  atLabel: string;
}

export interface DeliveryNotificationEventRow {
  id: string;
  kind: string;
  messagePreview: string;
  providerConfigured: boolean;
  honestyLabel: string;
  atLabel: string;
}

export interface CodCustodySummary {
  deliveryProfileId: string;
  driverName: string;
  /** Cash still WITH_DRIVER (Card 6). */
  withDriverAmount: number;
  withDriverLabel: string;
  /** Cash with Manager — not yet Owner-confirmed. */
  withManagerAmount: number;
  withManagerLabel: string;
  handedOverAmount: number;
  settledAmount: number;
  /** Lifetime cash collected by this driver (all custody stages). */
  collectedAmount: number;
  collectedLabel: string;
  /** Owner-received cash (RECEIVED_BY_OWNER / legacy reconciled). */
  adminSettledAmount: number;
  adminSettledLabel: string;
  orderCount: number;
}

/** One COD custody collection (PK = order_id). Never split in UI/RPC. */
export interface CodCustodyCollectionRow {
  orderId: string;
  orderCode: string;
  shopName: string;
  deliveryProfileId: string;
  driverName: string;
  amount: number;
  amountLabel: string;
  status: 'WITH_DRIVER' | 'RECEIVED_BY_MANAGER' | 'RECEIVED_BY_OWNER' | string;
  statusLabel: string;
  collectedAt: string;
  collectedAtLabel: string;
}

export interface CodCustodyPersonGroup {
  deliveryProfileId: string;
  driverName: string;
  collectionCount: number;
  totalAmount: number;
  totalLabel: string;
  collections: CodCustodyCollectionRow[];
}

export interface AssignmentRecommendation {
  deliveryProfileId: string | null;
  displayName: string | null;
  stopCount: number;
  existingRouteId: string | null;
  sameServiceArea: boolean;
  operationalStatus: DeliveryOperationalStatusVm | null;
  vehicleId: string | null;
}

export interface DeliveryTimeSlotOption {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
}

export function mapDbVehicleStatusToUi(status: string): {
  status: VehicleStatus;
  statusLabel: string;
} {
  switch (String(status).toUpperCase()) {
    case 'AVAILABLE':
      return { status: 'available', statusLabel: 'Available' };
    case 'ASSIGNED':
      return { status: 'assigned', statusLabel: 'Assigned' };
    case 'ON_ROUTE':
      return { status: 'on_route', statusLabel: 'On route' };
    case 'MAINTENANCE':
      return { status: 'maintenance', statusLabel: 'Maintenance' };
    case 'UNAVAILABLE':
      return { status: 'unavailable', statusLabel: 'Unavailable' };
    default:
      return { status: 'unavailable', statusLabel: status || '—' };
  }
}
