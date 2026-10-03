import { customerCreateSchema } from '@groaurum/validation';
import type { ServiceAreaListItem } from './service-area-model';
import type { SalesmanListRow } from './salesmen-types';
import { lookupPinServiceability } from './customer-pin-lookup';
import { pinBelongsToServiceArea } from './live-entity-helpers';
import { parseOptionalGstin } from './gst';

export type CustomerCreateFormValues = {
  tradeName: string;
  legalName: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  serviceAreaId: string;
  assignedSalesmanProfileId: string;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  gstin?: string;
};

export function validateCustomerCreateForm(
  values: CustomerCreateFormValues,
  context: {
    serviceAreas: readonly ServiceAreaListItem[];
    salesmen: readonly SalesmanListRow[];
  },
): { ok: true; payload: ReturnType<typeof customerCreateSchema.parse> } | { ok: false; message: string } {
  if (context.serviceAreas.length === 0) {
    return {
      ok: false,
      message: 'No active service areas are available. Create one before adding customers.',
    };
  }
  if (context.salesmen.length === 0) {
    return {
      ok: false,
      message: 'No active salesmen are available. Assign a salesman before adding customers.',
    };
  }
  const pinLookup = lookupPinServiceability(
    values.deliveryPinCode.trim(),
    context.serviceAreas,
  );
  if (pinLookup.status === 'not_serviceable') {
    return {
      ok: false,
      message: 'PIN is not serviceable in any active service area.',
    };
  }
  if (pinLookup.status === 'multiple' && !values.serviceAreaId) {
    return {
      ok: false,
      message: 'Select the service area that covers this PIN.',
    };
  }

  if (!values.serviceAreaId) {
    return { ok: false, message: 'Select an active service area' };
  }
  if (!values.assignedSalesmanProfileId) {
    return { ok: false, message: 'Select an active salesman' };
  }
  const area = context.serviceAreas.find((row) => row.id === values.serviceAreaId);
  if (!area) {
    return { ok: false, message: 'Select an active service area' };
  }
  if (!context.salesmen.some((row) => row.id === values.assignedSalesmanProfileId)) {
    return { ok: false, message: 'Select an active salesman' };
  }
  if (!pinBelongsToServiceArea(area, values.deliveryPinCode)) {
    return {
      ok: false,
      message: 'PIN code is not serviceable in the selected service area.',
    };
  }

  const hasLat = values.deliveryLat != null;
  const hasLng = values.deliveryLng != null;
  if (hasLat !== hasLng) {
    return {
      ok: false,
      message: 'Provide both latitude and longitude, or leave location empty.',
    };
  }

  const gstinParsed = parseOptionalGstin(values.gstin);
  if (!gstinParsed.ok) {
    return { ok: false, message: gstinParsed.error };
  }

  const parsed = customerCreateSchema.safeParse({
    tradeName: values.tradeName,
    legalName: values.legalName.trim() || undefined,
    ownerName: values.ownerName,
    ownerMobile: values.ownerMobile,
    ownerEmail: values.ownerEmail.trim() || undefined,
    serviceAreaId: values.serviceAreaId,
    assignedSalesmanProfileId: values.assignedSalesmanProfileId,
    deliveryAddressLine: values.deliveryAddressLine,
    deliveryCity: values.deliveryCity,
    deliveryState: values.deliveryState,
    deliveryPinCode: values.deliveryPinCode.trim(),
    deliveryLat: hasLat ? values.deliveryLat : undefined,
    deliveryLng: hasLng ? values.deliveryLng : undefined,
    gstin: gstinParsed.value,
    isActive: true,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid customer details',
    };
  }
  return { ok: true, payload: parsed.data };
}
