import type { SalesmanRetailer } from '@groaurum/api-client';

export function retailerFixture(
  overrides: Partial<SalesmanRetailer> = {},
): SalesmanRetailer {
  return {
    id: 'shop-1',
    tradeName: 'Sharma Stores',
    legalName: null,
    lifecycleStatus: 'ACTIVATED',
    activationStatus: 'activated',
    activationLabel: 'Activated',
    areaLabel: 'North',
    pinCode: '110001',
    addressLine: '1 Main Rd',
    city: 'Delhi',
    state: 'DL',
    serviceAreaId: 'area-1',
    deliveryLat: null,
    deliveryLng: null,
    primaryContactName: 'Ravi',
    primaryContactMobile: '9876543210',
    lastOrderLabel: '—',
    pendingInvitationToken: null,
    ...overrides,
  };
}
