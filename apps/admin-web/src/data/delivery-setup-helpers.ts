export type DeliveryMissingResource =
  | 'drivers'
  | 'vehicles'
  | 'service_area'
  | 'manual_assign';

export type DeliveryResourceCounts = {
  activeDrivers: number;
  availableDrivers: number;
  activeVehicles: number;
  availableVehicles: number;
  activeTimeSlots: number;
};

export type PackAutoAssignResult = {
  assigned: boolean;
  alreadyAssigned?: boolean;
  needsAttention?: boolean;
  reason?: string;
  missingResources?: DeliveryMissingResource[];
  usesOwnVehicle?: boolean;
  routeId?: string;
  deliveryProfileId?: string;
  vehicleId?: string | null;
};

export type DeliverySetupGuidance = {
  title: string;
  message: string;
  missing: DeliveryMissingResource[];
  showAddDriver: boolean;
  showAddVehicle: boolean;
  showAssignTrip: boolean;
};

const REASON_TO_MISSING: Record<string, DeliveryMissingResource[]> = {
  'No service area': ['service_area'],
  'No available delivery boy': ['drivers'],
  'No available driver/vehicle': ['drivers'],
  'No time slots': [],
  'No available driver': ['drivers'],
};

/** Parse auto-assign RPC gap for admin-friendly setup guidance. */
export function buildDeliverySetupGuidance(
  auto: PackAutoAssignResult,
  counts?: Partial<DeliveryResourceCounts>,
): DeliverySetupGuidance | null {
  if (auto.assigned) return null;

  const fromRpc = auto.missingResources ?? [];
  const fromReason = auto.reason
    ? (REASON_TO_MISSING[auto.reason] ?? [])
    : [];
  const missing = [...new Set([...fromRpc, ...fromReason])];

  const noDrivers =
    missing.includes('drivers') ||
    (counts?.availableDrivers ?? counts?.activeDrivers ?? 1) === 0;
  const noVehicles =
    missing.includes('vehicles') ||
    (counts?.availableVehicles ?? counts?.activeVehicles ?? 1) === 0;

  if (missing.includes('service_area')) {
    return {
      title: 'Delivery setup is needed',
      message:
        'This order has no service area. Update the customer shop or territory before assigning delivery.',
      missing: ['service_area'],
      showAddDriver: false,
      showAddVehicle: false,
      showAssignTrip: false,
    };
  }

  if (noDrivers) {
    return {
      title: 'Delivery setup is needed',
      message:
        'Order packed successfully. Add an active delivery boy to assign this order.',
      missing: ['drivers'],
      showAddDriver: true,
      showAddVehicle: false,
      showAssignTrip: false,
    };
  }

  if (
    missing.includes('manual_assign') ||
    auto.needsAttention ||
    (!auto.assigned && !noDrivers)
  ) {
    return {
      title: 'Delivery setup is needed',
      message:
        'Order packed successfully. Create a delivery trip or assign this order manually.',
      missing: missing.length ? missing : ['manual_assign'],
      showAddDriver: false,
      showAddVehicle: noVehicles,
      showAssignTrip: true,
    };
  }

  return {
    title: 'Delivery setup is needed',
    message: 'Order packed successfully. Delivery assignment needs attention.',
    missing,
    showAddDriver: noDrivers,
    showAddVehicle: noVehicles,
    showAssignTrip: true,
  };
}

/** Friendly pack success line when auto-assign succeeds. */
export function formatPackAssignSuccess(auto: PackAutoAssignResult): string {
  if (auto.alreadyAssigned) {
    return 'Order packed · delivery already assigned';
  }
  if (auto.usesOwnVehicle) {
    return 'Order packed and assigned for delivery (driver own vehicle)';
  }
  return 'Order packed and assigned for delivery';
}

export function mapDeliveryBoyUiStatus(input: {
  employmentStatus: string;
  operationalStatus: string;
}): 'Available' | 'On Delivery' | 'Inactive' {
  if (input.employmentStatus === 'INACTIVE') return 'Inactive';
  if (input.operationalStatus === 'ON_ROUTE') return 'On Delivery';
  return 'Available';
}

export function mapVehicleUiStatus(
  status: string,
  isActive: boolean,
): 'Available' | 'In Use' | 'Maintenance' | 'Inactive' {
  if (!isActive) return 'Inactive';
  const s = status.toLowerCase();
  if (s === 'maintenance') return 'Maintenance';
  if (s === 'on_route' || s === 'assigned') return 'In Use';
  if (s === 'unavailable') return 'Inactive';
  return 'Available';
}

/** Map seeded slot labels to Morning / Afternoon / Evening where possible. */
export function friendlyTimeSlotLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('morning') || lower.startsWith('9')) return 'Morning';
  if (lower.includes('midday') || lower.startsWith('11')) return 'Midday';
  if (lower.includes('afternoon') || lower.startsWith('2')) return 'Afternoon';
  if (lower.includes('evening') || lower.startsWith('4')) return 'Evening';
  return label;
}

export const OWN_VEHICLE_VALUE = '__own_vehicle__';

export function isOwnVehicleSelection(vehicleId: string): boolean {
  return vehicleId === OWN_VEHICLE_VALUE || vehicleId === '';
}

export function resolveVehicleIdForRpc(vehicleId: string): string | null {
  return isOwnVehicleSelection(vehicleId) ? null : vehicleId;
}
