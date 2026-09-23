import type { Shop, ShopContact, ShopInvitation, ShopLifecycleStatus } from '@groaurum/shared-types';

export interface CreateShopInput {
  tradeName: string;
  legalName?: string;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
  primaryContactName: string;
  primaryContactMobile: string;
  assignedSalesmanProfileId: string;
  serviceAreaId?: string;
}

export interface ShopService {
  getShopById(shopId: string): Promise<Shop | null>;
  getShopContacts(shopId: string): Promise<ShopContact[]>;
  createShop(input: CreateShopInput): Promise<Shop>;
  updateShopLifecycle(
    shopId: string,
    lifecycleStatus: ShopLifecycleStatus
  ): Promise<Shop>;
  createInvitation(shopId: string, mobile: string): Promise<ShopInvitation>;
}
