export type NewCustomerLocationDefaults = {
  serviceAreaId: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
};

/** Merge optional live snapshot hints — never injects a fallback service-area UUID. */
export function mergeCustomerLocationHints(
  base: NewCustomerLocationDefaults,
  hints?: Partial<NewCustomerLocationDefaults> | null,
): NewCustomerLocationDefaults {
  return {
    serviceAreaId: hints?.serviceAreaId || base.serviceAreaId,
    deliveryCity: hints?.deliveryCity || base.deliveryCity,
    deliveryState: hints?.deliveryState || base.deliveryState,
    deliveryPinCode: hints?.deliveryPinCode || base.deliveryPinCode,
  };
}
