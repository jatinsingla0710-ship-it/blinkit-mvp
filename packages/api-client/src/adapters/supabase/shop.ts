import type { CreateShopInput, ShopService } from '../../contracts/shop';
import type { Shop, ShopContact, ShopInvitation, ShopLifecycleStatus } from '@groaurum/shared-types';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { mapShop, mapShopContact } from './mappers';

const READ_ONLY =
  'Shop writes require trusted/admin workflows and are not available on the customer anon client in Phase 3.';

export function createSupabaseShopService(client: GroAurumSupabaseClient): ShopService {
  return {
    async getShopById(shopId: string): Promise<Shop | null> {
      const { data, error } = await client
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapShop(data) : null;
    },

    async getShopContacts(shopId: string): Promise<ShopContact[]> {
      const { data, error } = await client
        .from('shop_contacts')
        .select('*')
        .eq('shop_id', shopId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapShopContact);
    },

    async createShop(_input: CreateShopInput): Promise<Shop> {
      throw new Error(`ShopService.createShop: ${READ_ONLY}`);
    },

    async updateShopLifecycle(
      _shopId: string,
      _lifecycleStatus: ShopLifecycleStatus,
    ): Promise<Shop> {
      throw new Error(`ShopService.updateShopLifecycle: ${READ_ONLY}`);
    },

    async createInvitation(_shopId: string, _mobile: string): Promise<ShopInvitation> {
      throw new Error(`ShopService.createInvitation: ${READ_ONLY}`);
    },
  };
}
