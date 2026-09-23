import type {
  CustomerAppPhase,
  CustomerSessionSnapshot,
  CustomerShopContext,
  ServiceabilityEvaluationResult,
} from '@groaurum/shared-types';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { createSupabaseAuthService } from './auth';
import { createSupabaseServiceAreaService } from './service-area';
import { createSupabaseShopService } from './shop';
import { mapProfile } from './mappers';

function inactiveOrBlocked(shop: CustomerShopContext['shop']): boolean {
  if (!shop.isActive) return true;
  return shop.lifecycleStatus === 'INACTIVE_OR_FOLLOW_UP';
}

/**
 * Resolve authenticated customer → shop_auth_link → shop → serviceability.
 * Never creates shops or auth links.
 */
export async function resolveCustomerSession(
  client: GroAurumSupabaseClient,
): Promise<CustomerSessionSnapshot> {
  const auth = createSupabaseAuthService(client);
  const shopService = createSupabaseShopService(client);
  const serviceAreaService = createSupabaseServiceAreaService(client);

  try {
    const session = await auth.getCurrentSession();
    if (!session) {
      return {
        phase: 'UNAUTHENTICATED',
        authUserId: null,
        mobile: null,
        profile: null,
        shopContext: null,
        serviceability: null,
      };
    }

    const { data: profileRow } = await client
      .from('profiles')
      .select('*')
      .eq('id', session.authUserId)
      .maybeSingle();
    const profile = profileRow ? mapProfile(profileRow) : session.profile;

    const { data: linkRow, error: linkError } = await client
      .from('shop_auth_links')
      .select('*')
      .eq('auth_user_id', session.authUserId)
      .maybeSingle();
    if (linkError) throw linkError;

    if (!linkRow) {
      return {
        phase: 'AUTHENTICATED_NO_SHOP_LINK',
        authUserId: session.authUserId,
        mobile: profile?.mobile ?? session.mobile,
        profile,
        shopContext: null,
        serviceability: null,
      };
    }

    const shop = await shopService.getShopById(linkRow.shop_id);
    if (!shop) {
      return {
        phase: 'ERROR',
        authUserId: session.authUserId,
        mobile: profile?.mobile ?? session.mobile,
        profile,
        shopContext: null,
        serviceability: null,
        errorMessage: 'Linked shop could not be loaded.',
      };
    }

    const contacts = await shopService.getShopContacts(shop.id);
    const shopContext: CustomerShopContext = {
      authUserId: session.authUserId,
      mobile: profile?.mobile ?? session.mobile,
      profile,
      shop,
      contacts,
    };

    if (inactiveOrBlocked(shop)) {
      return {
        phase: 'LINKED_SHOP_INACTIVE_OR_BLOCKED',
        authUserId: session.authUserId,
        mobile: shopContext.mobile,
        profile,
        shopContext,
        serviceability: null,
      };
    }

    let serviceability: ServiceabilityEvaluationResult;
    try {
      // PIN_CODE uses delivery_pin_code; ADMIN_AREA matches delivery_city codes.
      serviceability = await serviceAreaService.evaluateServiceability({
        pinCode: shop.deliveryPinCode,
        adminAreaCode: shop.deliveryCity,
      });
    } catch (error) {
      serviceability = {
        status: 'ERROR',
        serviceable: false,
        serviceArea: null,
        matchedRuleId: null,
        message: error instanceof Error ? error.message : 'Serviceability check failed.',
      };
    }

    return {
      phase: 'LINKED_SHOP_READY' satisfies CustomerAppPhase,
      authUserId: session.authUserId,
      mobile: shopContext.mobile,
      profile,
      shopContext,
      serviceability,
    };
  } catch (error) {
    return {
      phase: 'ERROR',
      authUserId: null,
      mobile: null,
      profile: null,
      shopContext: null,
      serviceability: null,
      errorMessage: error instanceof Error ? error.message : 'Customer session resolution failed.',
    };
  }
}
