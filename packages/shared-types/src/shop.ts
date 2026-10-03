import type { ShopLifecycleStatus } from './enums';

export interface ShopContact {
  id: string;
  shopId: string;
  name: string;
  mobile: string;
  email?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Shop {
  id: string;
  tradeName: string;
  legalName?: string;
  lifecycleStatus: ShopLifecycleStatus;
  serviceAreaId: string | null;
  assignedSalesmanProfileId: string | null;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
  deliveryLat?: number;
  deliveryLng?: number;
  /** Optional customer GSTIN. */
  gstin?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopInvitation {
  id: string;
  shopId: string;
  mobile: string;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  sentAt: string;
  createdAt: string;
}

/** Links Supabase Auth identity to an existing shop record. */
export interface ShopAuthLink {
  id: string;
  shopId: string;
  authUserId: string;
  linkedAt: string;
}
