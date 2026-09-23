/**
 * Delivery H5 live queries / RPCs — used by LiveAdminApi wrappers.
 */
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import {
  formatDateTime,
  formatInr,
  shortCode,
} from './format';
import { throwRpcError } from '../rpc-error';
import {
  isOnDeliveryPayment,
  type PaymentLike,
} from '../delivery-cod';
import { notificationHonestyLabel } from '../delivery-h5-honesty';
import type { ManagerCodCustodyRow } from '../dashboard-types';
import {
  mapDbVehicleStatusToUi,
  type AssignmentRecommendation,
  type CodCustodyCollectionRow,
  type CodCustodyPersonGroup,
  type CodCustodySummary,
  type DeliveryBoyDetail,
  type DeliveryBoyListRow,
  type DeliveryBoysSnapshot,
  type DeliveryEmploymentStatusVm,
  type DeliveryExceptionActionVm,
  type DeliveryExceptionCategoryVm,
  type DeliveryExceptionRow,
  type DeliveryNotificationEventRow,
  type DeliveryOperationalStatusVm,
  type DeliveryOpsDashboard,
  type DeliveryScheduleEvent,
  type DeliveryTimeSlotOption,
  type ReadyQueueOrder,
  type VehicleListRow,
} from '../delivery-types';
import { toDateOnly } from '../dashboard-helpers';

type Row = Record<string, unknown>;
type Sb = GroAurumSupabaseClient;

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function provisionDelivery(
  sb: Sb,
  input: {
    displayName: string;
    mobile: string;
    email: string;
    temporaryPassword: string;
    isActive?: boolean;
  },
): Promise<{
  profileId: string;
  authUserId: string;
  email: string;
  displayName: string;
  mobile: string;
  alreadyProvisioned: boolean;
  createdAuthUser: boolean;
  temporaryPasswordSet?: boolean;
}> {
  const { data, error } = await sb.functions.invoke('provision-delivery', {
    body: {
      displayName: input.displayName,
      mobile: input.mobile,
      email: input.email,
      temporaryPassword: input.temporaryPassword,
      isActive: input.isActive ?? true,
    },
  });
  if (error) {
    const ctx = error as { context?: Response; message?: string };
    let detail = ctx.message ?? 'Could not provision delivery boy';
    try {
      if (ctx.context) {
        const payload = (await ctx.context.json()) as {
          error?: string;
          code?: string;
        };
        if (payload.error) detail = payload.error;
      }
    } catch {
      /* keep detail */
    }
    throw new Error(detail);
  }
  const row = (data ?? {}) as Record<string, unknown>;
  if (row['error']) {
    throw new Error(str(row['error']));
  }
  return {
    profileId: str(row['profileId']),
    authUserId: str(row['authUserId'] ?? row['profileId']),
    email: str(row['email'] ?? input.email),
    displayName: str(row['displayName'] ?? input.displayName),
    mobile: str(row['mobile'] ?? input.mobile),
    alreadyProvisioned: Boolean(row['alreadyProvisioned']),
    createdAuthUser: Boolean(row['createdAuthUser']),
    temporaryPasswordSet:
      row['temporaryPasswordSet'] === undefined
        ? undefined
        : Boolean(row['temporaryPasswordSet']),
  };
}

export async function upsertDeliveryEmployment(
  sb: Sb,
  input: {
    profileId: string;
    joiningDate?: string;
    employmentStatus?: DeliveryEmploymentStatusVm;
    operationalStatus?: DeliveryOperationalStatusVm;
    address?: string;
    contactEmail?: string;
    idProofType?: 'AADHAAR' | 'PAN' | 'OTHER' | null;
    idProofNumber?: string;
    primaryServiceAreaId?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc('admin_upsert_delivery_employment', {
    p_profile_id: input.profileId,
    p_joining_date: input.joiningDate ?? null,
    p_employment_status: input.employmentStatus ?? 'ACTIVE',
    p_operational_status: input.operationalStatus ?? null,
    p_address: input.address ?? null,
    p_contact_email: input.contactEmail || null,
    p_id_proof_type: input.idProofType ?? null,
    p_id_proof_number: input.idProofNumber ?? null,
    p_primary_service_area_id: input.primaryServiceAreaId ?? null,
  });
  if (error) throwRpcError(error, 'Could not save delivery employment');
  return (data ?? {}) as Record<string, unknown>;
}

export async function getDeliveryBoysSnapshot(
  sb: Sb,
): Promise<DeliveryBoysSnapshot> {
  const { data: profiles } = await sb
    .from('profiles')
    .select('*')
    .contains('roles', ['DELIVERY'])
    .is('deleted_at', null)
    .order('display_name', { ascending: true });

  if (!profiles?.length) {
    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      kpis: [],
      rows: [],
    };
  }

  const ids = (profiles as unknown as Row[]).map((p) => str(p['id']));
  const [
    { data: employment },
    { data: areas },
    { data: routes },
    { data: vehicles },
  ] = await Promise.all([
    sb.from('delivery_employment').select('*').in('profile_id', ids),
    sb.from('service_areas').select('id, name'),
    sb
      .from('delivery_routes')
      .select('id, assigned_delivery_profile_id, status, route_date')
      .in('assigned_delivery_profile_id', ids)
      .is('deleted_at', null)
      .in('status', ['DRAFT', 'PLANNED', 'IN_PROGRESS']),
    sb
      .from('vehicles')
      .select('id, vehicle_number, assigned_delivery_profile_id')
      .in('assigned_delivery_profile_id', ids)
      .is('deleted_at', null),
  ]);

  const empMap = new Map(
    ((employment ?? []) as Row[]).map((e) => [str(e['profile_id']), e]),
  );
  const areaMap = new Map(
    ((areas ?? []) as Row[]).map((a) => [str(a['id']), str(a['name'])]),
  );
  const routeByDriver = new Map<string, Row>();
  for (const r of (routes ?? []) as Row[]) {
    const pid = str(r['assigned_delivery_profile_id']);
    if (!routeByDriver.has(pid)) routeByDriver.set(pid, r);
  }
  const vehicleByDriver = new Map(
    ((vehicles ?? []) as Row[]).map((v) => [
      str(v['assigned_delivery_profile_id']),
      v,
    ]),
  );

  const rows: DeliveryBoyListRow[] = (profiles as unknown as Row[]).map((p) => {
    const id = str(p['id']);
    const emp = empMap.get(id);
    const areaId = emp ? str(emp['primary_service_area_id']) : '';
    const route = routeByDriver.get(id);
    const vehicle = vehicleByDriver.get(id);
    return {
      id,
      name: str(p['display_name']) || '—',
      mobileLabel: str(p['mobile']) || '—',
      emailLabel: str(p['email']) || '—',
      employmentStatus: (emp
        ? str(emp['employment_status'])
        : 'ACTIVE') as DeliveryEmploymentStatusVm,
      operationalStatus: (emp
        ? str(emp['operational_status'])
        : 'AVAILABLE') as DeliveryOperationalStatusVm,
      serviceAreaLabel: areaId ? (areaMap.get(areaId) ?? '—') : '—',
      currentRouteLabel: route ? shortCode(str(route['id']), 'RT') : null,
      vehicleLabel: vehicle ? str(vehicle['vehicle_number']) : null,
      isActive: Boolean(p['is_active']),
      updatedAtLabel: formatDateTime(
        str(emp?.['updated_at'] ?? p['updated_at']),
      ),
    };
  });

  const active = rows.filter((r) => r.employmentStatus === 'ACTIVE').length;
  const onRoute = rows.filter((r) => r.operationalStatus === 'ON_ROUTE').length;

  return {
    generatedAtLabel: formatDateTime(new Date().toISOString()),
    kpis: [
      { id: 'total', label: 'Delivery boys', value: `${rows.length}` },
      { id: 'active', label: 'Active', value: `${active}`, tone: 'positive' },
      {
        id: 'on_route',
        label: 'On route',
        value: `${onRoute}`,
        tone: onRoute ? 'warning' : 'default',
      },
    ],
    rows,
  };
}

export async function listDeliveryBoys(sb: Sb): Promise<DeliveryBoyListRow[]> {
  const snap = await getDeliveryBoysSnapshot(sb);
  return snap.rows;
}

export async function getDeliveryBoyDetail(
  sb: Sb,
  id: string,
): Promise<DeliveryBoyDetail | null> {
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!profile) return null;
  const p = profile as unknown as Row;
  const roles = (p['roles'] as string[] | null) ?? [];
  if (!roles.includes('DELIVERY')) return null;

  const [{ data: emp }, { data: areas }, { data: routes }, { data: vehicles }] =
    await Promise.all([
      sb
        .from('delivery_employment')
        .select('*')
        .eq('profile_id', id)
        .maybeSingle(),
      sb.from('service_areas').select('id, name'),
      sb
        .from('delivery_routes')
        .select('id, status, route_date')
        .eq('assigned_delivery_profile_id', id)
        .is('deleted_at', null)
        .in('status', ['DRAFT', 'PLANNED', 'IN_PROGRESS'])
        .order('created_at', { ascending: false })
        .limit(1),
      sb
        .from('vehicles')
        .select('id, vehicle_number')
        .eq('assigned_delivery_profile_id', id)
        .is('deleted_at', null)
        .limit(1),
    ]);

  const e = emp as Row | null;
  const areaMap = new Map(
    ((areas ?? []) as Row[]).map((a) => [str(a['id']), str(a['name'])]),
  );
  const areaId = e ? str(e['primary_service_area_id']) : '';
  const route = ((routes ?? []) as Row[])[0];
  const vehicle = ((vehicles ?? []) as Row[])[0];

  return {
    id,
    name: str(p['display_name']) || '—',
    mobile: str(p['mobile']) || '',
    email: str(p['email']) || '',
    isActive: Boolean(p['is_active']),
    joiningDate: e ? str(e['joining_date']) || null : null,
    employmentStatus: (e
      ? str(e['employment_status'])
      : 'ACTIVE') as DeliveryEmploymentStatusVm,
    operationalStatus: (e
      ? str(e['operational_status'])
      : 'AVAILABLE') as DeliveryOperationalStatusVm,
    address: e ? str(e['address']) || null : null,
    contactEmail: e ? str(e['contact_email']) || null : null,
    idProofType: e
      ? ((str(e['id_proof_type']) || null) as
          | 'AADHAAR'
          | 'PAN'
          | 'OTHER'
          | null)
      : null,
    idProofNumber: e ? str(e['id_proof_number']) || null : null,
    primaryServiceAreaId: areaId || null,
    serviceAreaLabel: areaId ? (areaMap.get(areaId) ?? '—') : '—',
    currentRouteId: route ? str(route['id']) : null,
    currentRouteLabel: route ? shortCode(str(route['id']), 'RT') : null,
    vehicleId: vehicle ? str(vehicle['id']) : null,
    vehicleLabel: vehicle ? str(vehicle['vehicle_number']) : null,
    updatedAtLabel: formatDateTime(str(e?.['updated_at'] ?? p['updated_at'])),
  };
}

export async function upsertVehicle(
  sb: Sb,
  input: {
    vehicleId?: string | null;
    vehicleNumber: string;
    vehicleType?: string;
    capacityLabel?: string;
    isActive?: boolean;
    status?:
      | 'AVAILABLE'
      | 'ASSIGNED'
      | 'ON_ROUTE'
      | 'MAINTENANCE'
      | 'UNAVAILABLE'
      | null;
    assignedDeliveryProfileId?: string | null;
    notes?: string;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc('admin_upsert_vehicle', {
    p_vehicle_id: input.vehicleId ?? null,
    p_vehicle_number: input.vehicleNumber,
    p_vehicle_type: input.vehicleType ?? 'VAN',
    p_capacity_label: input.capacityLabel ?? null,
    p_is_active: input.isActive ?? true,
    p_status: input.status ?? null,
    p_assigned_delivery_profile_id: input.assignedDeliveryProfileId ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throwRpcError(error, 'Could not save vehicle');
  return (data ?? {}) as Record<string, unknown>;
}

export async function listVehicles(sb: Sb): Promise<VehicleListRow[]> {
  const { data: vehicles } = await sb
    .from('vehicles')
    .select('*')
    .is('deleted_at', null)
    .order('vehicle_number', { ascending: true });
  if (!vehicles?.length) return [];

  const driverIds = [
    ...new Set(
      (vehicles as Row[])
        .map((v) => str(v['assigned_delivery_profile_id']))
        .filter(Boolean),
    ),
  ];
  const { data: profiles } = driverIds.length
    ? await sb.from('profiles').select('id, display_name').in('id', driverIds)
    : { data: [] as Row[] };
  const profileMap = new Map(
    ((profiles ?? []) as Row[]).map((p) => [
      str(p['id']),
      str(p['display_name']),
    ]),
  );

  return (vehicles as Row[]).map((v) => {
    const mapped = mapDbVehicleStatusToUi(str(v['status']));
    const driverId = str(v['assigned_delivery_profile_id']) || null;
    return {
      id: str(v['id']),
      vehicleNumber: str(v['vehicle_number']),
      vehicleType: str(v['vehicle_type']) || 'VAN',
      capacityLabel: str(v['capacity_label']) || '—',
      status: mapped.status,
      statusLabel: mapped.statusLabel,
      isActive: Boolean(v['is_active']),
      assignedDriverId: driverId,
      assignedDriverName: driverId ? (profileMap.get(driverId) ?? null) : null,
      notes: str(v['notes']) || null,
      updatedAtLabel: formatDateTime(str(v['updated_at'])),
    };
  });
}

export async function listDeliveryTimeSlots(
  sb: Sb,
): Promise<DeliveryTimeSlotOption[]> {
  const { data } = await sb
    .from('delivery_time_slots')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  return ((data ?? []) as Row[]).map((s) => ({
    id: str(s['id']),
    label: str(s['label']),
    startTime: str(s['start_time']),
    endTime: str(s['end_time']),
    sortOrder: num(s['sort_order']),
  }));
}

export async function listReadyForDeliveryOrders(
  sb: Sb,
): Promise<ReadyQueueOrder[]> {
  const { data: orders } = await sb
    .from('orders')
    .select('id, shop_id, service_area_id, total, status, updated_at')
    .eq('status', 'READY_FOR_DISPATCH')
    .order('updated_at', { ascending: true });
  if (!orders?.length) return [];

  const orderIds = (orders as Row[]).map((o) => str(o['id']));
  const { data: stops } = await sb
    .from('route_stops')
    .select('order_id')
    .in('order_id', orderIds);
  const assigned = new Set(
    ((stops ?? []) as Row[]).map((s) => str(s['order_id'])),
  );
  const ready = (orders as Row[]).filter((o) => !assigned.has(str(o['id'])));
  if (!ready.length) return [];

  const shopIds = [...new Set(ready.map((o) => str(o['shop_id'])))];
  const areaIds = [
    ...new Set(ready.map((o) => str(o['service_area_id'])).filter(Boolean)),
  ];
  const [{ data: shops }, { data: areas }] = await Promise.all([
    sb.from('shops').select('id, trade_name').in('id', shopIds),
    areaIds.length
      ? sb.from('service_areas').select('id, name').in('id', areaIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);
  const shopMap = new Map(
    ((shops ?? []) as Row[]).map((s) => [str(s['id']), str(s['trade_name'])]),
  );
  const areaMap = new Map(
    ((areas ?? []) as Row[]).map((a) => [str(a['id']), str(a['name'])]),
  );

  return ready.map((o) => {
    const areaId = str(o['service_area_id']);
    return {
      id: str(o['id']),
      orderCode: shortCode(str(o['id']), 'GA'),
      customerName: shopMap.get(str(o['shop_id'])) ?? '—',
      serviceAreaId: areaId,
      serviceAreaLabel: areaMap.get(areaId) ?? '—',
      amountLabel: formatInr(num(o['total'])),
      statusLabel: 'Ready for dispatch',
      packedAtLabel: formatDateTime(str(o['updated_at'])),
    };
  });
}

export async function scheduleAndAssignDelivery(
  sb: Sb,
  input: {
    orderIds: string[];
    deliveryProfileId: string;
    vehicleId?: string | null;
    deliveryDate: string;
    timeSlotId?: string | null;
    routeId?: string | null;
    serviceAreaId?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc(
    'admin_schedule_and_assign_delivery',
    {
      p_order_ids: input.orderIds,
      p_delivery_profile_id: input.deliveryProfileId,
      p_vehicle_id: input.vehicleId ?? null,
      p_delivery_date: input.deliveryDate,
      p_time_slot_id: input.timeSlotId ?? null,
      p_route_id: input.routeId ?? null,
      p_service_area_id: input.serviceAreaId ?? null,
    } as never,
  );
  if (error) throwRpcError(error, 'Could not schedule delivery');
  return (data ?? {}) as Record<string, unknown>;
}

export async function recommendDeliveryAssignment(
  sb: Sb,
  serviceAreaId: string,
  deliveryDate: string,
): Promise<AssignmentRecommendation> {
  const { data, error } = await sb.rpc('admin_recommend_delivery_assignment', {
    p_service_area_id: serviceAreaId,
    p_delivery_date: deliveryDate,
  });
  if (error) throwRpcError(error, 'Could not recommend assignment');
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    deliveryProfileId: row['deliveryProfileId']
      ? str(row['deliveryProfileId'])
      : null,
    displayName: row['displayName'] ? str(row['displayName']) : null,
    stopCount: num(row['stopCount'] ?? 0),
    existingRouteId: row['existingRouteId']
      ? str(row['existingRouteId'])
      : null,
    sameServiceArea: Boolean(row['sameServiceArea']),
    operationalStatus: row['operationalStatus']
      ? (str(row['operationalStatus']) as DeliveryOperationalStatusVm)
      : null,
    vehicleId: row['vehicleId'] ? str(row['vehicleId']) : null,
  };
}

export async function settleDeliveryCod(
  sb: Sb,
  input: {
    deliveryProfileId: string;
    amount: number;
    reference?: string;
    note?: string;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc('admin_settle_delivery_cod', {
    p_delivery_profile_id: input.deliveryProfileId,
    p_amount: input.amount,
    p_reference: input.reference ?? null,
    p_note: input.note ?? null,
  });
  if (error) throwRpcError(error, 'Could not receive cash from delivery boy');
  return (data ?? {}) as Record<string, unknown>;
}

export async function settleDeliveryCodSelected(
  sb: Sb,
  input: {
    deliveryProfileId: string;
    orderIds: string[];
    reference?: string;
    note?: string;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc('admin_settle_delivery_cod_selected', {
    p_delivery_profile_id: input.deliveryProfileId,
    p_order_ids: input.orderIds,
    p_reference: input.reference ?? null,
    p_note: input.note ?? null,
  });
  if (error) throwRpcError(error, 'Could not receive selected cash from delivery boy');
  return (data ?? {}) as Record<string, unknown>;
}

export async function confirmOwnerCodReceipt(
  sb: Sb,
  input: {
    deliveryProfileId: string;
    amount: number;
    reference?: string;
    note?: string;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc('admin_confirm_owner_cod_receipt', {
    p_delivery_profile_id: input.deliveryProfileId,
    p_amount: input.amount,
    p_reference: input.reference ?? null,
    p_note: input.note ?? null,
  });
  if (error) throwRpcError(error, 'Could not confirm owner cash receipt');
  return (data ?? {}) as Record<string, unknown>;
}

export async function confirmOwnerCodReceiptSelected(
  sb: Sb,
  input: {
    deliveryProfileId: string;
    orderIds: string[];
    reference?: string;
    note?: string;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc(
    'admin_confirm_owner_cod_receipt_selected',
    {
      p_delivery_profile_id: input.deliveryProfileId,
      p_order_ids: input.orderIds,
      p_reference: input.reference ?? null,
      p_note: input.note ?? null,
    },
  );
  if (error) throwRpcError(error, 'Could not confirm selected owner cash receipt');
  return (data ?? {}) as Record<string, unknown>;
}

export async function listDeliveryExceptions(
  sb: Sb,
  opts?: { openOnly?: boolean },
): Promise<DeliveryExceptionRow[]> {
  let q = sb
    .from('delivery_exceptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (opts?.openOnly !== false) {
    q = q.eq('status', 'OPEN');
  }
  const { data } = await q;
  if (!data?.length) return [];

  return (data as Row[]).map((e) => ({
    id: str(e['id']),
    category: str(e['category']) as DeliveryExceptionCategoryVm,
    reasonCode: str(e['reason_code']),
    reasonNote: str(e['reason_note']) || null,
    status: str(e['status']) as 'OPEN' | 'RESOLVED' | 'CANCELLED',
    routeId: str(e['route_id']) || null,
    routeLabel: e['route_id'] ? shortCode(str(e['route_id']), 'RT') : null,
    orderId: str(e['order_id']) || null,
    orderCode: e['order_id'] ? shortCode(str(e['order_id']), 'GA') : null,
    actionTaken: e['action_taken']
      ? (str(e['action_taken']) as DeliveryExceptionActionVm)
      : null,
    createdAtLabel: formatDateTime(str(e['created_at'])),
    resolvedAtLabel: e['resolved_at']
      ? formatDateTime(str(e['resolved_at']))
      : null,
  }));
}

export async function createDeliveryException(
  sb: Sb,
  input: {
    category: DeliveryExceptionCategoryVm;
    reasonCode: string;
    reasonNote?: string;
    routeId?: string | null;
    orderId?: string | null;
    routeStopId?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc('admin_create_delivery_exception', {
    p_category: input.category,
    p_reason_code: input.reasonCode,
    p_reason_note: input.reasonNote ?? null,
    p_route_id: input.routeId ?? null,
    p_order_id: input.orderId ?? null,
    p_route_stop_id: input.routeStopId ?? null,
  });
  if (error) throwRpcError(error, 'Could not create exception');
  return (data ?? {}) as Record<string, unknown>;
}

export async function resolveDeliveryException(
  sb: Sb,
  input: {
    exceptionId: string;
    action: DeliveryExceptionActionVm;
    actionNote?: string;
    replacementDeliveryProfileId?: string | null;
    replacementVehicleId?: string | null;
    newDeliveryDate?: string | null;
    newTimeSlotId?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc('admin_resolve_delivery_exception', {
    p_exception_id: input.exceptionId,
    p_action: input.action,
    p_action_note: input.actionNote ?? null,
    p_replacement_delivery_profile_id:
      input.replacementDeliveryProfileId ?? null,
    p_replacement_vehicle_id: input.replacementVehicleId ?? null,
    p_new_delivery_date: input.newDeliveryDate ?? null,
    p_new_time_slot_id: input.newTimeSlotId ?? null,
  });
  if (error) throwRpcError(error, 'Could not resolve exception');
  return (data ?? {}) as Record<string, unknown>;
}

export async function getDeliveryOpsDashboard(
  sb: Sb,
  date?: string,
): Promise<DeliveryOpsDashboard> {
  const today = date ?? toDateOnly(new Date());
  const [routesRes, stopsRes, custodyRes, ofdRes] = await Promise.all([
    sb
      .from('delivery_routes')
      .select('id, status')
      .eq('route_date', today)
      .is('deleted_at', null),
    sb.from('route_stops').select('id, status, route_id, order_id'),
    sb.from('delivery_cod_custody').select('amount, status'),
    sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'OUT_FOR_DELIVERY'),
  ]);

  const todayRouteIds = new Set(
    ((routesRes.data ?? []) as Row[]).map((r) => str(r['id'])),
  );
  const todayStops = ((stopsRes.data ?? []) as Row[]).filter((s) =>
    todayRouteIds.has(str(s['route_id'])),
  );
  const delivered = todayStops.filter(
    (s) => str(s['status']) === 'COMPLETED',
  ).length;
  const failed = todayStops.filter((s) => str(s['status']) === 'FAILED').length;
  const pending = todayStops.filter(
    (s) =>
      str(s['status']) === 'PENDING' || str(s['status']) === 'IN_PROGRESS',
  ).length;
  const outForDelivery = ofdRes.count ?? 0;

  let codExpected = 0;
  let codCollected = 0;
  let codWithDrivers = 0;
  let codSettled = 0;
  for (const c of (custodyRes.data ?? []) as Row[]) {
    const amt = num(c['amount']);
    const st = str(c['status']);
    if (st === 'WITH_DRIVER') {
      codWithDrivers += amt;
      codCollected += amt;
    } else if (
      st === 'RECEIVED_BY_MANAGER' ||
      st === 'RECEIVED_BY_OWNER' ||
      st === 'HANDED_TO_COMPANY' ||
      st === 'RECONCILED'
    ) {
      codSettled += amt;
      codCollected += amt;
    }
  }

  const todayOrderIds = new Set(todayStops.map((s) => str(s['order_id'])));
  if (todayOrderIds.size) {
    const { data: pays } = await sb
      .from('payments')
      .select('order_id, method_intent, collection_method, status, amount')
      .in('order_id', [...todayOrderIds]);
    for (const p of (pays ?? []) as Row[]) {
      if (!isOnDeliveryPayment(p as PaymentLike)) continue;
      codExpected += num(p['amount']);
    }
  }

  const routesToday = ((routesRes.data ?? []) as Row[]).length;
  const ordersToday = todayStops.length;

  const kpis = [
    { id: 'routes', label: 'Routes today', value: `${routesToday}` },
    { id: 'orders', label: 'Stops today', value: `${ordersToday}` },
    {
      id: 'delivered',
      label: 'Delivered',
      value: `${delivered}`,
      tone: 'positive' as const,
    },
    {
      id: 'ofd',
      label: 'Out for delivery',
      value: `${outForDelivery}`,
      tone: 'warning' as const,
    },
    { id: 'pending', label: 'Pending stops', value: `${pending}` },
    {
      id: 'failed',
      label: 'Failed',
      value: `${failed}`,
      tone: failed ? ('danger' as const) : ('default' as const),
    },
    {
      id: 'cod_expected',
      label: 'COD expected',
      value: formatInr(codExpected),
    },
    {
      id: 'cod_collected',
      label: 'COD collected',
      value: formatInr(codCollected),
    },
    {
      id: 'cod_drivers',
      label: 'COD with drivers',
      value: formatInr(codWithDrivers),
      tone: codWithDrivers ? ('warning' as const) : ('default' as const),
    },
    {
      id: 'cod_settled',
      label: 'COD settled',
      value: formatInr(codSettled),
    },
  ];

  return {
    generatedAtLabel: formatDateTime(new Date().toISOString()),
    date: today,
    routesToday,
    ordersToday,
    delivered,
    outForDelivery,
    pending,
    failed,
    codExpected,
    codCollected,
    codWithDrivers,
    codSettled,
    kpis,
  };
}

export async function listOrderScheduleEvents(
  sb: Sb,
  orderId: string,
): Promise<DeliveryScheduleEvent[]> {
  const { data } = await sb
    .from('delivery_schedule_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (!data?.length) return [];

  const slotIds = [
    ...new Set(
      (data as Row[]).map((e) => str(e['time_slot_id'])).filter(Boolean),
    ),
  ];
  const profileIds = [
    ...new Set(
      (data as Row[])
        .map((e) => str(e['delivery_profile_id']))
        .filter(Boolean),
    ),
  ];
  const vehicleIds = [
    ...new Set(
      (data as Row[]).map((e) => str(e['vehicle_id'])).filter(Boolean),
    ),
  ];
  const [{ data: slots }, { data: profiles }, { data: vehicles }] =
    await Promise.all([
      slotIds.length
        ? sb.from('delivery_time_slots').select('id, label').in('id', slotIds)
        : Promise.resolve({ data: [] as Row[] }),
      profileIds.length
        ? sb.from('profiles').select('id, display_name').in('id', profileIds)
        : Promise.resolve({ data: [] as Row[] }),
      vehicleIds.length
        ? sb.from('vehicles').select('id, vehicle_number').in('id', vehicleIds)
        : Promise.resolve({ data: [] as Row[] }),
    ]);
  const slotMap = new Map(
    ((slots ?? []) as Row[]).map((s) => [str(s['id']), str(s['label'])]),
  );
  const profileMap = new Map(
    ((profiles ?? []) as Row[]).map((p) => [
      str(p['id']),
      str(p['display_name']),
    ]),
  );
  const vehicleMap = new Map(
    ((vehicles ?? []) as Row[]).map((v) => [
      str(v['id']),
      str(v['vehicle_number']),
    ]),
  );

  return (data as Row[]).map((e) => ({
    id: str(e['id']),
    kind: str(e['kind']) as 'SCHEDULED' | 'RESCHEDULED' | 'DELAYED',
    deliveryDate: str(e['delivery_date']),
    timeSlotLabel: slotMap.get(str(e['time_slot_id'])) ?? null,
    driverName: profileMap.get(str(e['delivery_profile_id'])) ?? null,
    vehicleLabel: vehicleMap.get(str(e['vehicle_id'])) ?? null,
    reason: str(e['reason']) || null,
    atLabel: formatDateTime(str(e['created_at'])),
  }));
}

export async function listOrderNotificationEvents(
  sb: Sb,
  orderId: string,
): Promise<DeliveryNotificationEventRow[]> {
  const { data } = await sb
    .from('delivery_notification_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as Row[]).map((e) => {
    const configured = Boolean(e['provider_configured']);
    return {
      id: str(e['id']),
      kind: str(e['kind']),
      messagePreview: str(e['message_preview']),
      providerConfigured: configured,
      honestyLabel: notificationHonestyLabel(configured),
      atLabel: formatDateTime(str(e['created_at'])),
    };
  });
}

export async function listCodCustodySummaries(
  sb: Sb,
): Promise<CodCustodySummary[]> {
  const { data } = await sb
    .from('delivery_cod_custody')
    .select('delivery_profile_id, amount, status');
  if (!data?.length) return [];

  const byDriver = new Map<
    string,
    {
      withDriver: number;
      withManager: number;
      owner: number;
      count: number;
    }
  >();
  for (const c of data as Row[]) {
    const pid = str(c['delivery_profile_id']);
    const cur = byDriver.get(pid) ?? {
      withDriver: 0,
      withManager: 0,
      owner: 0,
      count: 0,
    };
    const amt = num(c['amount']);
    const st = str(c['status']);
    if (st === 'WITH_DRIVER') {
      cur.withDriver += amt;
      cur.count += 1;
    } else if (st === 'RECEIVED_BY_MANAGER') {
      cur.withManager += amt;
    } else if (st === 'RECEIVED_BY_OWNER' || st === 'RECONCILED') {
      cur.owner += amt;
    }
    byDriver.set(pid, cur);
  }

  const ids = [...byDriver.keys()];
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name')
    .in('id', ids);
  const profileMap = new Map(
    ((profiles ?? []) as Row[]).map((p) => [
      str(p['id']),
      str(p['display_name']),
    ]),
  );

  return ids.map((id) => {
    const cur = byDriver.get(id)!;
    const collected = cur.withDriver + cur.withManager + cur.owner;
    return {
      deliveryProfileId: id,
      driverName: profileMap.get(id) ?? '—',
      withDriverAmount: cur.withDriver,
      withDriverLabel: formatInr(cur.withDriver),
      withManagerAmount: cur.withManager,
      withManagerLabel: formatInr(cur.withManager),
      handedOverAmount: cur.withManager,
      settledAmount: cur.owner,
      collectedAmount: collected,
      collectedLabel: formatInr(collected),
      adminSettledAmount: cur.owner,
      adminSettledLabel: formatInr(cur.owner),
      orderCount: cur.count,
    };
  });
}

function custodyStatusLabel(status: string): string {
  switch (status) {
    case 'WITH_DRIVER':
      return 'With Delivery Boy';
    case 'RECEIVED_BY_MANAGER':
      return 'Received by Manager';
    case 'RECEIVED_BY_OWNER':
    case 'RECONCILED':
    case 'HANDED_TO_COMPANY':
      return 'Received by Owner';
    default:
      return status.replace(/_/g, ' ') || '—';
  }
}

/**
 * Individual custody collections (order_id PK). Used for checkbox receive UI.
 */
export async function listCodCustodyCollections(
  sb: Sb,
  opts?: {
    status?: 'WITH_DRIVER' | 'RECEIVED_BY_MANAGER' | 'RECEIVED_BY_OWNER';
  },
): Promise<CodCustodyCollectionRow[]> {
  let q = sb
    .from('delivery_cod_custody')
    .select(
      'order_id, delivery_profile_id, amount, status, collected_at, updated_at',
    )
    .order('collected_at', { ascending: true })
    .limit(1000);
  if (opts?.status) {
    q = q.eq('status', opts.status);
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];

  const orderIds = [...new Set(rows.map((r) => str(r['order_id'])).filter(Boolean))];
  const driverIds = [
    ...new Set(rows.map((r) => str(r['delivery_profile_id'])).filter(Boolean)),
  ];

  const orderMap = new Map<string, Row>();
  const shopIds = new Set<string>();
  if (orderIds.length > 0) {
    const { data: orders, error: ordersErr } = await sb
      .from('orders')
      .select('id, shop_id')
      .in('id', orderIds);
    if (ordersErr) throw ordersErr;
    for (const o of (orders ?? []) as Row[]) {
      orderMap.set(str(o['id']), o);
      const sid = str(o['shop_id']);
      if (sid) shopIds.add(sid);
    }
  }

  const shopMap = new Map<string, string>();
  if (shopIds.size > 0) {
    const { data: shops, error: shopsErr } = await sb
      .from('shops')
      .select('id, trade_name')
      .in('id', [...shopIds]);
    if (shopsErr) throw shopsErr;
    for (const s of (shops ?? []) as Row[]) {
      shopMap.set(str(s['id']), str(s['trade_name']));
    }
  }

  const driverMap = new Map<string, string>();
  if (driverIds.length > 0) {
    const { data: profiles, error: profilesErr } = await sb
      .from('profiles')
      .select('id, display_name')
      .in('id', driverIds);
    if (profilesErr) throw profilesErr;
    for (const p of (profiles ?? []) as Row[]) {
      driverMap.set(str(p['id']), str(p['display_name']));
    }
  }

  return rows.map((c) => {
    const orderId = str(c['order_id']);
    const order = orderMap.get(orderId);
    const shopId = order ? str(order['shop_id']) : '';
    const status = str(c['status']);
    const amount = num(c['amount']);
    const collectedAt = str(c['collected_at'] ?? c['updated_at']);
    const deliveryProfileId = str(c['delivery_profile_id']);
    return {
      orderId,
      orderCode: shortCode(orderId, 'GA'),
      shopName: shopMap.get(shopId) || '—',
      deliveryProfileId,
      driverName: driverMap.get(deliveryProfileId) || '—',
      amount,
      amountLabel: formatInr(amount),
      status,
      statusLabel: custodyStatusLabel(status),
      collectedAt,
      collectedAtLabel: formatDateTime(collectedAt),
    };
  });
}

export function groupCodCustodyByPerson(
  rows: CodCustodyCollectionRow[],
): CodCustodyPersonGroup[] {
  const map = new Map<string, CodCustodyPersonGroup>();
  for (const row of rows) {
    const cur = map.get(row.deliveryProfileId) ?? {
      deliveryProfileId: row.deliveryProfileId,
      driverName: row.driverName,
      collectionCount: 0,
      totalAmount: 0,
      totalLabel: formatInr(0),
      collections: [],
    };
    cur.collections.push(row);
    cur.collectionCount += 1;
    cur.totalAmount += row.amount;
    cur.totalLabel = formatInr(cur.totalAmount);
    map.set(row.deliveryProfileId, cur);
  }
  return [...map.values()].sort((a, b) =>
    a.driverName.localeCompare(b.driverName),
  );
}

export type ManagerCodCustodyBreakdownRpcRow = {
  managerProfileId?: string;
  managerName?: string;
  warehouseId?: string;
  warehouseName?: string;
  amount?: number;
  handoverCount?: number;
  oldestHandoverAt?: string;
  newestHandoverAt?: string;
};

export async function listManagerCodCustodyBreakdown(sb: Sb): Promise<{
  totalAmount: number;
  totalLabel: string;
  rows: ManagerCodCustodyRow[];
}> {
  const { data, error } = await sb.rpc('admin_manager_cod_custody_breakdown');
  if (error) throwRpcError(error, 'admin_manager_cod_custody_breakdown');
  const payload = (data ?? {}) as {
    totalAmount?: number;
    rows?: ManagerCodCustodyBreakdownRpcRow[];
  };
  const totalAmount = num(payload.totalAmount);
  const rows = (payload.rows ?? []).map((row) => ({
    managerProfileId: str(row.managerProfileId),
    managerName: str(row.managerName) || 'Unknown manager',
    warehouseId: str(row.warehouseId),
    warehouseName: str(row.warehouseName) || 'Unassigned warehouse',
    amount: num(row.amount),
    amountLabel: formatInr(num(row.amount)),
    handoverCount: num(row.handoverCount),
    oldestHandoverLabel: row.oldestHandoverAt
      ? formatDateTime(str(row.oldestHandoverAt))
      : '—',
    newestHandoverLabel: row.newestHandoverAt
      ? formatDateTime(str(row.newestHandoverAt))
      : '—',
  }));
  return {
    totalAmount,
    totalLabel: formatInr(totalAmount),
    rows,
  };
}

export async function deliveryProviderConfigured(sb: Sb): Promise<boolean> {
  const { data, error } = await sb.rpc('delivery_provider_configured');
  if (error) return false;
  return Boolean(data);
}

/** Resolve vehicle label map for route rows that have vehicle_id. */
export async function vehicleLabelMap(
  sb: Sb,
  vehicleIds: string[],
): Promise<Map<string, string>> {
  if (!vehicleIds.length) return new Map();
  const { data } = await sb
    .from('vehicles')
    .select('id, vehicle_number')
    .in('id', vehicleIds);
  return new Map(
    ((data ?? []) as Row[]).map((v) => [
      str(v['id']),
      str(v['vehicle_number']),
    ]),
  );
}
